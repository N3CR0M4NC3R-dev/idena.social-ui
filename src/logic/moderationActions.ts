import Decimal from 'decimal.js';
import { CallContractAttachment, contractArgumentFormat, toHexString, Transaction } from 'idena-sdk-js-lite';
import { getAddressTxsWithIdenaIndexerApi, getNonceAndEpoch, getRawTxWithIdenaIndexerApi, type RpcClient } from './asyncUtils';
import { isAddressHex, isHashHex, moderationConfig, normalizeHex, type ModeratorRole } from './moderation';
import { zeroAddress } from '../App.exports';
import { dnaBase, getCallTransaction } from './utils';
import { hashPayload, recordBuiltTransaction } from './moderatorWitnesses';

// Actions on the idena.social-mod contract (rules in its README and assembly/index.ts): moderators' bans and hides,
// stakers' vouches, and everyone's reports. As with idena-profile, the rules are checked here before anyone pays a fee: the public
// node's dry run runs a call as the zero address, and a rejected action is charged, even when a callback rejects it
// and the transaction still succeeds.

export type ModerationCall =
    | { method: 'ban', args: { address: string, epochs: number, reason: string } }
    | { method: 'unban', args: { address: string, reason: string } }
    | { method: 'banTransaction', args: { hash: string, reason: string } }
    | { method: 'unbanTransaction', args: { hash: string, reason: string } }
    | { method: 'banTransactions', args: { hashes: string[], reason: string } }
    | { method: 'report', args: { address: string, reason: string } }
    | { method: 'reportTransaction', args: { hash: string, reason: string } }
    | { method: 'vouch' | 'withdrawVouch' | 'revokeVouches', args: { address: string } };

// role is the caller's moderator role; reports and withdrawing a vouch don't need one. existingVouchers: the target's
// vouchers before a vouch, withdrawal or revocation, which sizes the callback's gas.
export type PreparedModerationCall = { call: ModerationCall, role?: ModeratorRole, existingVouchers?: number, maxFee: Decimal, error?: string };

const isReport = (call: ModerationCall) => call.method === 'report' || call.method === 'reportTransaction';
const isVouchCall = (call: ModerationCall) => call.method === 'vouch' || call.method === 'withdrawVouch' || call.method === 'revokeVouches';
// Only stakers can vouch and revoke.
const isStakerCall = (call: ModerationCall) => call.method === 'vouch' || call.method === 'revokeVouches';

// Gas, in the units the node charges (WASM gas is 100 times finer). Every ban, and a staker's first action in an
// epoch, runs its checks in a callback after an identity lookup; the callback's gas is reserved out of the call's gas
// limit, so the max fee covers it, but only the gas used is charged. A lookup that finds the stake confirms it until
// the epoch ends (s:), so the staker's later actions run inline, like a vouched moderator's, except that a ban still
// looks up its target. The max fee for a staker is still sized for the lookup, which covers the inline path too.
// Figures marked "previous contract" are from the contract before this one, which looked up a staker on every action;
// this one uses less gas on every path.
// Measured on mainnet (the receipt's gas used, size fee excluded), as a vouched moderator with 7- to 24-byte reasons:
// hide 7.3k gas, restore 4.5k, unban 4.5k, ban 10.4k, of which 0.64M WASM gas in the ban's callback. As a staker on the
// previous contract: hide 22.5k, unban 20.3k, ban 32.4k. So each callback uses well under 2M WASM gas; 2.5M leaves
// room for a 280-byte reason. The contract's default is 4M.
const CALLBACK_WASM_GAS = 2_500_000;
const IDENTITY_PROMISE_WASM_GAS = 20_000; // the contract's IDENTITY_PROMISE_GAS
const WASM_GAS_PER_GAS = 100;
const PROMISE_CALL_GAS = 10_000;
const INLINE_CALL_GAS = 30_000;
// Withdrawing a vouch runs inline, rewriting two address lists: 10.3k gas measured on mainnet (previous contract)
// with one voucher.
const WITHDRAW_CALL_GAS = 15_000;
// A report runs inline: one ban read and an event. Measured on mainnet, size excluded: 2.7k gas with a 22-byte reason
// (charged 0.63 iDNA at a fee per gas of 0.000123, size included). On the previous contract, 8.7k with a 4-byte reason
// and 11.8k with a 278-byte one.
const REPORT_CALL_GAS = 14_000;
// A batched transaction ban costs about 0.5M WASM gas with no reason and 1.4M with a 280-byte one (the README).
const BATCHED_BAN_WASM_GAS = 600_000;
const BATCHED_BAN_WASM_GAS_PER_REASON_BYTE = 3_500;
const GAS_PER_TX_BYTE = 10;
const TX_BYTES_BESIDES_PAYLOAD = 200;
const FEE_MARGIN = 1.25; // the fee per gas can rise before the block

const CONFIRM_POLL_MS = 10_000;
const CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

export const getReasonBytes = (reason: string) => new TextEncoder().encode(reason).length;

const contractAddress = () => normalizeHex(moderationConfig!.contractAddress);

// Map keys are the UTF-8 of a lowercase 0x address or hash, hex-encoded for the RPC call. Returns '' when unset (the
// node's "data is nil"), and undefined when the read failed: a failure must never pass for an empty map. Bans (b:, t:)
// come back as JSON strings; address lists (m:, v:) and stake epochs (s:) as hex.
export const readModerationMap = async (rpcClient: RpcClient, map: 'b:' | 't:' | 'm:' | 'v:' | 's:', key: string) => {
    const hexKey = toHexString(new TextEncoder().encode(normalizeHex(key)), true);
    const { result, error } = await rpcClient('contract_readMap', [contractAddress(), map, hexKey, map === 'b:' || map === 't:' ? 'string' : 'hex'], true);
    if (typeof result === 'string') return result;
    if (typeof error?.message === 'string' && error.message.includes('data is nil')) return '';
    return undefined;
};

const NODE_FAILED = 'The node did not answer. Try again.';

type StoredBan = { moderator: string, epoch: number, permanent: boolean, endEpoch: number, reason: string };

const parseBan = (json: string): StoredBan | undefined => {
    try {
        return json ? JSON.parse(json) as StoredBan : undefined;
    } catch {
        return undefined;
    }
};

// An address list is 20-byte addresses back to back.
const parseAddressList = (hex: string) => (hex.startsWith('0x') ? hex.slice(2) : hex).match(/.{40}/g)?.map((address) => `0x${address.toLowerCase()}`) ?? [];

export const isStoredBanActive = (ban: StoredBan | undefined, epoch: number) => !!ban && (ban.permanent || epoch < ban.endEpoch);

// A stake epoch (s:) is a u16, little-endian: '0xf000' is epoch 240. undefined when unset or not 2 bytes.
export const parseStakeEpoch = (hex: string) => {
    const digits = hex.startsWith('0x') ? hex.slice(2) : hex;
    return /^[0-9a-f]{4}$/i.test(digits) ? parseInt(digits.slice(2, 4) + digits.slice(0, 2), 16) : undefined;
};

// What the contract knows about an address: its stake, vouchers and ban. role is undefined for non-moderators.
// Like the contract, it counts as a staker an address whose stake a lookup confirmed this epoch (s:), even if its
// stake has dropped since: that happens when the identity is killed mid-epoch. Only the checks before signing use
// this; what the UI displays goes by live stake.
export const readModerationStanding = async (rpcClient: RpcClient, address: string) => {
    const [ { result: identity }, { result: epochResult }, vouchersHex, banJson, stakeEpochHex ] = await Promise.all([
        rpcClient('dna_identity', [address], true),
        rpcClient('dna_epoch', [], true),
        readModerationMap(rpcClient, 'm:', address),
        readModerationMap(rpcClient, 'b:', address),
        readModerationMap(rpcClient, 's:', address),
    ]);

    const epoch = epochResult?.epoch as number | undefined;
    const confirmedStaker = epoch !== undefined && parseStakeEpoch(stakeEpochHex ?? '') === epoch;
    const staker = Number(identity?.stake ?? 0) >= moderationConfig!.stakeThreshold || confirmedStaker;
    const vouchers = parseAddressList(vouchersHex ?? '');
    const ban = parseBan(banJson ?? '');
    const banned = epoch !== undefined && isStoredBanActive(ban, epoch);
    const role: ModeratorRole | undefined = banned ? undefined : staker ? 'staker' : vouchers.length ? 'vouched' : undefined;

    const known = !!identity && epoch !== undefined && vouchersHex !== undefined && banJson !== undefined && stakeEpochHex !== undefined;
    return { known, epoch, staker, vouchers, ban, banned, role };
};

// A vouch or revocation costs about gasPerExistingVoucher more per voucher the target already has (the README).
// Measured on mainnet: a staker's first vouch in an epoch, for an address with no vouchers, used 0.83M WASM gas in its
// callback (12.8k gas in all, charged 1.82 iDNA at a fee per gas of 0.000123). On the previous contract, 1.34M in
// its callback (24.1k gas in all).
const getVouchCallbackGas = (existingVouchers: number) => CALLBACK_WASM_GAS + existingVouchers * moderationConfig!.gasPerExistingVoucher;

const getCallbackGas = (call: ModerationCall, existingVouchers: number) => {
    if (call.method === 'banTransactions') return getBatchCallbackGas(call.args.hashes.length, call.args.reason);
    if (isStakerCall(call)) return getVouchCallbackGas(existingVouchers);
    return CALLBACK_WASM_GAS;
};

const getArgs = (call: ModerationCall, role: ModeratorRole | undefined, existingVouchers = 0) => {
    // Reports, withdrawals and a vouched moderator's batch run inline: there's no callback gas to set. A staker's calls
    // set it even when the contract has confirmed their stake this epoch and will run them inline, ignoring it.
    const inline = isReport(call) || call.method === 'withdrawVouch' || (role === 'vouched' && call.method === 'banTransactions');
    const args = inline ? call.args : { ...call.args, _gasLimit: getCallbackGas(call, existingVouchers) };
    return [{ format: contractArgumentFormat.String, index: 0, value: JSON.stringify(args) }];
};

const getPayload = (call: ModerationCall, role: ModeratorRole | undefined, existingVouchers = 0) => {
    const payload = new CallContractAttachment();
    payload.method = call.method;
    payload.setArgs(getArgs(call, role, existingVouchers));
    return payload;
};

const getBatchWasmGas = (count: number, reason: string) => count * (BATCHED_BAN_WASM_GAS + getReasonBytes(reason) * BATCHED_BAN_WASM_GAS_PER_REASON_BYTE);
const getBatchCallbackGas = (count: number, reason: string) => CALLBACK_WASM_GAS + getBatchWasmGas(count, reason);

const getCallGas = (call: ModerationCall, role: ModeratorRole | undefined, existingVouchers: number) => {
    if (isReport(call)) return REPORT_CALL_GAS;
    if (call.method === 'withdrawVouch') return WITHDRAW_CALL_GAS + existingVouchers * moderationConfig!.gasPerExistingVoucher / WASM_GAS_PER_GAS;
    // Vouching and revoking look up the caller, unless the contract confirmed their stake earlier this epoch, when
    // they run inline. Sized for the lookup either way, which covers the inline path too.
    if (isStakerCall(call)) return PROMISE_CALL_GAS + (getVouchCallbackGas(existingVouchers) + IDENTITY_PROMISE_WASM_GAS) / WASM_GAS_PER_GAS;
    // Every ban looks up its target first, with room for the caller's lookup and its callback.
    if (call.method === 'ban') return PROMISE_CALL_GAS + (2 * CALLBACK_WASM_GAS + 2 * IDENTITY_PROMISE_WASM_GAS) / WASM_GAS_PER_GAS;
    if (role === 'vouched') {
        return call.method === 'banTransactions' ? INLINE_CALL_GAS + getBatchWasmGas(call.args.hashes.length, call.args.reason) / WASM_GAS_PER_GAS : INLINE_CALL_GAS;
    }
    // A staker's: sized for the caller's lookup, though a staker confirmed this epoch runs inline.
    const callbackGas = call.method === 'banTransactions' ? getBatchCallbackGas(call.args.hashes.length, call.args.reason) : CALLBACK_WASM_GAS;
    return PROMISE_CALL_GAS + (callbackGas + IDENTITY_PROMISE_WASM_GAS) / WASM_GAS_PER_GAS;
};

const checkCall = async (rpcClient: RpcClient, caller: string, call: ModerationCall, epoch: number) => {
    const config = moderationConfig!;
    const reason = 'reason' in call.args ? call.args.reason : '';
    if (getReasonBytes(reason) > config.maxReasonBytes) return `The reason can be at most ${config.maxReasonBytes} bytes.`;
    if (isReport(call) && !reason) return 'Pick or write a reason.';

    switch (call.method) {
    case 'ban': {
        const target = normalizeHex(call.args.address);
        if (!isAddressHex(target)) return 'That isn\'t an address.';
        if (target === caller) return 'You can\'t ban yourself.';
        if (!Number.isInteger(call.args.epochs) || call.args.epochs < 0 || call.args.epochs > config.maxBanEpochs) return `A ban lasts from 1 to ${config.maxBanEpochs} epochs, or permanently.`;
        const standing = await readModerationStanding(rpcClient, target);
        if (!standing.known) return NODE_FAILED;
        if (standing.staker) return 'Stakers can\'t be banned.';
        if (standing.vouchers.length) return 'Moderators can\'t be banned: a staker must revoke their vouches first.';
        return;
    }
    case 'unban': {
        const banJson = await readModerationMap(rpcClient, 'b:', call.args.address);
        if (banJson === undefined) return NODE_FAILED;
        if (!isStoredBanActive(parseBan(banJson), epoch)) return 'This account isn\'t banned.';
        return;
    }
    case 'banTransaction':
    case 'unbanTransaction': {
        if (!isHashHex(normalizeHex(call.args.hash))) return 'That isn\'t a transaction hash.';
        const stored = await readModerationMap(rpcClient, 't:', call.args.hash);
        if (stored === undefined) return NODE_FAILED;
        if (call.method === 'banTransaction' && stored) return 'This post is already hidden.';
        if (call.method === 'unbanTransaction' && !stored) return 'This post isn\'t hidden.';
        return;
    }
    case 'banTransactions': {
        if (!call.args.hashes.length) return 'Select at least one post.';
        if (call.args.hashes.length > config.maxTransactionBatch) return `At most ${config.maxTransactionBatch} posts at a time.`;
        if (call.args.hashes.some((hash) => !isHashHex(normalizeHex(hash)))) return 'That isn\'t a transaction hash.';
        return;
    }
    case 'report': {
        const target = normalizeHex(call.args.address);
        if (!isAddressHex(target)) return 'That isn\'t an address.';
        if (target === caller) return 'You can\'t report yourself.';
        return;
    }
    case 'reportTransaction':
        if (!isHashHex(normalizeHex(call.args.hash))) return 'That isn\'t a transaction hash.';
        return;
    }
};

// The addresses a voucher's vouches are in effect for, from the contract: its v: list, less the addresses a
// revocation left there (whose m: list no longer has the voucher). undefined when a read failed.
const readVouchesGiven = async (rpcClient: RpcClient, voucher: string) => {
    const given = await readModerationMap(rpcClient, 'v:', voucher);
    if (given === undefined) return undefined;
    const addresses = parseAddressList(given);
    const vouchersLists = await Promise.all(addresses.map((address) => readModerationMap(rpcClient, 'm:', address)));
    if (vouchersLists.some((vouchers) => vouchers === undefined)) return undefined;
    return addresses.filter((_, index) => parseAddressList(vouchersLists[index]!).includes(voucher));
};

// Vouch, withdraw and revoke: the contract's checks, and the target's vouchers, which size the callback's gas.
const checkVouchCall = async (rpcClient: RpcClient, caller: string, call: ModerationCall): Promise<{ error?: string, existingVouchers?: number }> => {
    const config = moderationConfig!;
    const target = normalizeHex('address' in call.args ? call.args.address : '');
    if (!isAddressHex(target)) return { error: 'That isn\'t an address.' };

    const standing = await readModerationStanding(rpcClient, target);
    if (!standing.known) return { error: NODE_FAILED };
    const existingVouchers = standing.vouchers.length;
    const vouching = standing.vouchers.includes(caller);

    switch (call.method) {
    case 'vouch': {
        if (target === caller) return { error: 'You can\'t vouch for yourself.' };
        if (standing.banned) return { error: 'Banned accounts can\'t be vouched for.' };
        if (vouching) return { error: 'You already vouch for this account.' };
        const given = await readVouchesGiven(rpcClient, caller);
        if (given === undefined) return { error: NODE_FAILED };
        if (given.length >= config.maxVouches) return { error: `All ${config.maxVouches} of your vouches are in use: withdraw one first.` };
        return { existingVouchers };
    }
    case 'withdrawVouch':
        if (!vouching) return { error: 'You don\'t vouch for this account.' };
        return { existingVouchers };
    case 'revokeVouches':
        if (!existingVouchers) return { error: 'This account has no vouches.' };
        return { existingVouchers };
    }
    return {};
};

const ROLE_ERRORS: Partial<Record<ModerationCall['method'], string>> = {
    ban: 'Only moderators can ban.',
    unban: 'Only moderators can unban.',
    banTransaction: 'Only moderators can hide posts.',
    unbanTransaction: 'Only moderators can restore posts.',
    banTransactions: 'Only moderators can hide posts.',
    vouch: 'Only stakers can vouch.',
    revokeVouches: 'Only stakers can revoke moderator status.',
};

// Checks a call against the contract's rules for `caller`, and sizes its max fee. Anyone the contract hasn't banned
// can report, and whoever made a vouch can withdraw it, banned or not. Vouching and revoking need a staker; the rest,
// a moderator.
export const prepareModerationCall = async (rpcClient: RpcClient, caller: string, call: ModerationCall): Promise<PreparedModerationCall> => {
    const prepared: PreparedModerationCall = { call, maxFee: new Decimal(0) };
    const from = normalizeHex(caller);

    if (!moderationConfig) return { ...prepared, error: 'Moderation isn\'t available.' };
    if (!from || from === zeroAddress) return { ...prepared, error: 'Set your address in Settings first.' };
    if (inFlightTargets.has(getTargetKey(call))) return { ...prepared, error: isReport(call) ? 'Your report is already on its way.' : 'An action on this is already on its way: wait for it to confirm.' };

    const [ standing, { result: feePerGasResult }, { result: balanceResult } ] = await Promise.all([
        readModerationStanding(rpcClient, from),
        rpcClient('bcn_feePerGas', [], true),
        rpcClient('dna_getBalance', [from], true),
    ]);

    if (!standing.known || !feePerGasResult || !balanceResult) return { ...prepared, error: NODE_FAILED };
    if (standing.banned && call.method !== 'withdrawVouch') return { ...prepared, error: isReport(call) ? 'Banned accounts can\'t report.' : 'Banned accounts can\'t moderate.' };
    if (isStakerCall(call) && !standing.staker) return { ...prepared, error: ROLE_ERRORS[call.method] };
    if (!standing.role && !isReport(call) && !isVouchCall(call)) return { ...prepared, error: ROLE_ERRORS[call.method] };

    const { error, existingVouchers } = isVouchCall(call) ? await checkVouchCall(rpcClient, from, call) : { error: await checkCall(rpcClient, from, call, standing.epoch!), existingVouchers: undefined };
    if (error) return { ...prepared, role: standing.role, error };

    const feePerGas = new Decimal(feePerGasResult).div(dnaBase);
    const sizeGas = (getPayload(call, standing.role, existingVouchers).toBytes().length + TX_BYTES_BESIDES_PAYLOAD) * GAS_PER_TX_BYTE;
    const maxFee = feePerGas.mul((getCallGas(call, standing.role, existingVouchers ?? 0) + sizeGas) * FEE_MARGIN).toDecimalPlaces(6, Decimal.ROUND_UP);

    const balance = new Decimal(balanceResult.balance);
    if (balance.lessThan(maxFee)) {
        return { ...prepared, role: standing.role, existingVouchers, maxFee, error: `Your balance (${balance.toDecimalPlaces(2)} iDNA) must cover the max fee: ${maxFee.toDecimalPlaces(2, Decimal.ROUND_UP)} iDNA. Only the gas used is charged.` };
    }

    return { ...prepared, role: standing.role, existingVouchers, maxFee };
};

// The address or hash a call acts on; a batch's hashes, sorted.
const getCallTarget = (call: ModerationCall) => {
    if ('address' in call.args) return normalizeHex(call.args.address);
    if ('hash' in call.args) return normalizeHex(call.args.hash);
    return call.args.hashes.map(normalizeHex).sort().join(',');
};

// Calls sent and not settled yet, by target: a second call on the same target would only be charged and rejected.
// Reports are kept apart from moderator actions on the same target.
const inFlightTargets = new Set<string>();
const getTargetKey = (call: ModerationCall) => isReport(call) ? `report:${getCallTarget(call)}` : getCallTarget(call);

// A transaction this browser built for the Idena web app: enough to recognise it once signed and mined.
export type BuiltTx = { epoch: number, nonce: number, to: string, payloadHash: string };

export const describeBuiltTx = (txHex: string): BuiltTx => {
    const tx = Transaction.fromHex(txHex);
    return { epoch: tx.epoch, nonce: tx.nonce, to: (tx.to ?? '').toLowerCase(), payloadHash: hashPayload(tx.payload) };
};

// What's known of a sent call: its hash when the node signs it, else the transaction it was built as.
export type SentModerationCall = { error?: string, txHash?: string, built?: BuiltTx };

// Sends a prepared call: signed by the node (RPC), or by the user in the Idena web app, which opens in a new tab.
export const sendModerationCall = async (
    rpcClient: RpcClient,
    from: string,
    prepared: PreparedModerationCall,
    makePostsWith: string,
    callbackUrl: string,
    webAppUrl: string,
): Promise<SentModerationCall> => {
    const { call, role, existingVouchers, maxFee } = prepared;

    if (makePostsWith === 'rpc') {
        const { result, error } = await rpcClient('contract_call', [{ from, contract: contractAddress(), method: call.method, amount: 0, args: getArgs(call, role, existingVouchers), maxFee: maxFee.toString() }]);
        if (error) return { error: (error.message as string | undefined) ?? 'The node refused the transaction.' };
        inFlightTargets.add(getTargetKey(call));
        return { txHash: result as string };
    }

    const { nonce, epoch } = await getNonceAndEpoch(rpcClient, from);
    const txHex = getCallTransaction(contractAddress(), new Decimal(0), nonce, epoch, maxFee.mul(dnaBase).toFixed(0), getPayload(call, role, existingVouchers));
    recordBuiltTransaction(from, txHex);
    if (!window.open(`${webAppUrl}/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${call.method}`, '_blank')) {
        return { error: 'The browser blocked the Idena app tab. Allow pop-ups for this site, then try again.' };
    }
    inFlightTargets.add(getTargetKey(call));

    return { built: describeBuiltTx(txHex) };
};

type IndexerAddressTx = { hash: string, from?: string, nonce?: number, timestamp?: string };

// The hash of the mined transaction that `address` signed from one this browser built; 'taken' when another
// transaction of that epoch used its nonce (it can never be mined now); undefined while it isn't indexed. Nonces
// restart every epoch, so candidates are matched on epoch, recipient and payload, not on the nonce alone.
export const findMinedBuiltTx = async (indexerApiUrl: string, address: string, built: BuiltTx): Promise<string | 'taken' | undefined> => {
    const { result } = await getAddressTxsWithIdenaIndexerApi(indexerApiUrl, address, 20);
    const candidates = ((result ?? []) as IndexerAddressTx[]).filter((tx) => tx.nonce === built.nonce && !!tx.timestamp && tx.from?.toLowerCase() === address);

    for (const candidate of candidates) {
        const { result: rawTx } = await getRawTxWithIdenaIndexerApi(indexerApiUrl, candidate.hash);
        if (typeof rawTx !== 'string') continue;

        const tx = Transaction.fromHex(rawTx);
        if (tx.epoch !== built.epoch) continue;
        return (tx.to ?? '').toLowerCase() === built.to && hashPayload(tx.payload) === built.payloadHash ? candidate.hash : 'taken';
    }
};

// Why a mined call changed nothing: the first error in its receipt or in a callback.
const getReceiptError = (receipt: { error?: string, actionResult?: unknown }) => {
    const errors: string[] = [];
    const walk = (result: { error?: string, subActionResults?: unknown[] } | undefined) => {
        if (!result) return;
        if (result.error) errors.push(result.error);
        (result.subActionResults as typeof result[] | undefined)?.forEach(walk);
    };
    if (receipt.error) errors.push(receipt.error);
    walk(receipt.actionResult as Parameters<typeof walk>[0]);
    return errors[0];
};

export type ReceiptEvent = { contract?: string, event: string, args: string[] };

const EXPECTED_EVENTS: Record<ModerationCall['method'], string> = {
    ban: 'ban',
    unban: 'unban',
    banTransaction: 'banTransaction',
    unbanTransaction: 'unbanTransaction',
    banTransactions: 'banTransaction',
    report: 'report',
    reportTransaction: 'reportTransaction',
    vouch: 'vouch',
    withdrawVouch: 'vouchWithdrawn',
    revokeVouches: 'vouchesRevoked',
};

// The call's own events in its receipt: what the contract did. The first arg is the address or hash acted on.
const getAppliedEvents = (call: ModerationCall, events: ReceiptEvent[]) => {
    const targets = new Set('hashes' in call.args ? call.args.hashes.map(normalizeHex) : [getCallTarget(call)]);
    return events.filter((event) => event.contract?.toLowerCase() === contractAddress() && event.event === EXPECTED_EVENTS[call.method] && targets.has(normalizeHex(event.args?.[0] ?? '')));
};

export type ModerationCallResult = { applied: boolean, error?: string, txHash?: string, events?: ReceiptEvent[] };

// Waits for the call's receipt and decides from it. A rejected action is charged either way, but shows in one of two
// ways. The checks that follow an identity lookup run in a callback: a ban's, which always looks up its target, and
// the stake check on a staker's first action in an epoch. A callback that rejects leaves a successful transaction
// without the action's event. Every other check runs inside the call and fails the transaction, with the reason in
// receipt.error: that covers reports, withdrawals, and actions other than a ban by a vouched moderator or by a staker
// the contract has confirmed this epoch. So the events are what count, not the contract's state (which another
// moderator can change meanwhile). The hash comes from the node, or, in the Idena web app's case, from the indexer
// once the transaction this browser built is mined.
export const waitForModerationCall = async (rpcClient: RpcClient, caller: string, call: ModerationCall, sent: SentModerationCall, indexerApiUrl: string): Promise<ModerationCallResult> => {
    const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
    const from = normalizeHex(caller);
    let txHash = sent.txHash;

    try {
        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));

            if (!txHash && sent.built) {
                const found = await findMinedBuiltTx(indexerApiUrl, from, sent.built);
                if (found === 'taken') return { applied: false, error: 'Another transaction from your account used this one\'s place, so it was never sent. Nothing was charged for it.' };
                txHash = found;
            }
            if (!txHash) continue;

            const { result: receipt } = await rpcClient('bcn_txReceipt', [txHash], true);
            if (!receipt) continue;

            const events = getAppliedEvents(call, (receipt.events ?? []) as ReceiptEvent[]);
            const error = getReceiptError(receipt);
            // A batch skips posts already hidden: it applies even if it emits fewer events, or none.
            if (receipt.success && !error && (events.length || call.method === 'banTransactions')) return { applied: true, txHash, events };

            return { applied: false, txHash, error: `Rejected: ${error ?? 'the contract changed nothing'}. The fee was still charged.` };
        }

        return { applied: false, error: 'Not confirmed after 5 minutes. If you signed it, check it in the explorer: the contract may have refused it.' };
    } finally {
        inFlightTargets.delete(getTargetKey(call));
    }
};
