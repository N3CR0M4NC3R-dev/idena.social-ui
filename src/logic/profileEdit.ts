import Decimal from 'decimal.js';
import { CallContractAttachment, contractArgumentFormat } from 'idena-sdk-js-lite';
import { getNonceAndEpoch, identityStateConversion, PROFILE_CONTRACT_ADDRESS, readProfileMapWithRpc, type RpcClient } from './asyncUtils';
import { dnaBase, getCallTransaction } from './utils';

// Editing your own idena-profile (github.com/truongfelix/idena-profile, rules in assembly/index.ts): the name with
// claimName and dropName, the bio and picture together with setProfile. The rules are checked here before anyone pays
// a fee: the public node's dry run (bcn_estimateRawTx) runs a call as the zero address, so it can't check them.

export type ProfileCall =
    | { method: 'claimName', args: { name: string } }
    | { method: 'dropName' }
    | { method: 'setProfile', args: { bio: string, picture: string } };

export type PreparedProfileCall = { call: ProfileCall, amount: Decimal, maxFee: Decimal, error?: string };

export type ProfileFields = { name: string, bio: string, picture: string };

export const PROFILE_NAME_RULE = /^[a-z0-9_]{3,20}$/;
export const PROFILE_BIO_MAX = 160;
const PROFILE_PICTURE_URL_MAX = 120;
const CID_RULE = /^[a-zA-Z0-9]{10,}$/;

// Gas. A call reads the caller's identity state, and its voucher's, with a promise once per epoch; the callback's gas
// is reserved out of the call's gas limit. Real calls use 6k to 13k gas acting inline and 0.5M to 1M WASM gas in a
// callback, so these leave about 3x headroom. The max fee only has to be in the balance: the fee charged is for the
// gas used, about 1 iDNA.
const CALLBACK_WASM_GAS = 3_000_000; // _gas; the contract's default, 10M, needs about 11 iDNA of max fee
const KEEP_WASM_GAS = 1_000_000; // _keepGas: the callback that keeps an earlier state, for a vouched member
const WASM_GAS_PER_GAS = 100;
const IDENTITY_READ_GAS = 200; // the contract's IDENTITY_GAS, 20,000 WASM gas
const INLINE_CALL_GAS = 15_000;
const PROMISE_CALL_GAS = 10_000;
const GAS_PER_TX_BYTE = 10;
const TX_BYTES_BESIDES_PAYLOAD = 200;
const FEE_MARGIN = 1.25; // the fee per gas can rise before the block
const VOUCHED_EXTRA_GAS = 25_000; // a vouched member's call sends about one more call's fee, burned
const VOUCHED_EXTRA_MARGIN = 1.1;

const CONFIRM_POLL_MS = 10_000;
const CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

export const CANNOT_EDIT_PROFILE = 'Only a validated identity (Newbie, Verified or Human), or an account vouched for by one, can edit its profile.';

const VALIDATED_STATES = ['Newbie', 'Verified', 'Human'];
// No identity of its own: the node answers Undefined for a Killed one too.
const VOUCHABLE_STATES = ['Undefined', 'Invite', 'Candidate', 'Killed'];

const getProfileArgs = (call: ProfileCall) => {
    if (call.method === 'dropName') return [];
    return [{ format: contractArgumentFormat.String, index: 0, value: JSON.stringify({ ...call.args, _gas: CALLBACK_WASM_GAS, _keepGas: KEEP_WASM_GAS }) }];
};

export const getProfilePayload = (call: ProfileCall) => {
    const payload = new CallContractAttachment();
    payload.method = call.method;

    const args = getProfileArgs(call);
    if (args.length) payload.setArgs(args);

    return payload;
};

export const readProfileWithRpc = async (rpcClient: RpcClient, address: string): Promise<ProfileFields> => {
    const [ name, bio, picture ] = await Promise.all(['a:', 'b:', 'p:'].map((map) => readProfileMapWithRpc(rpcClient, map, address)));
    return { name, bio, picture };
};

// The state the contract acts on: the one it read this epoch ('i:' holds "<epoch>:<state>"), else the node's, which
// the call then reads with a promise.
const getContractState = async (rpcClient: RpcClient, address: string, epoch: number) => {
    const [ savedEpoch, savedState ] = (await readProfileMapWithRpc(rpcClient, 'i:', address)).split(':');

    if (savedState !== undefined && Number(savedEpoch) === epoch) {
        return { state: identityStateConversion[Number(savedState)] ?? 'Undefined', known: true };
    }

    const { result } = await rpcClient('dna_identity', [address], true);
    return { state: (result?.state as string | undefined) ?? 'Undefined', known: false };
};

// What a vouched member sends with a call, burned: the contract asks for at least 25k gas at the minimum fee per gas.
const getVouchedPayment = (feePerGas: Decimal) => feePerGas.mul(VOUCHED_EXTRA_GAS * VOUCHED_EXTRA_MARGIN).toDecimalPlaces(6, Decimal.ROUND_UP);

export const getVouchedPaymentWithRpc = async (rpcClient: RpcClient) => {
    const { result } = await rpcClient('bcn_feePerGas', [], true);
    return result ? getVouchedPayment(new Decimal(result).div(dnaBase)) : undefined;
};

// Who may claim a name and set a profile, as the contract's standing() decides: a validated identity on its own
// ('own'), or an account without one whose voucher ('v:', accepted in the contract) is validated ('vouched').
// Suspended and Zombie may not, even when vouched for. The voucher's state is read whenever there is one: the
// contract reads it too.
export const getEditStanding = async (rpcClient: RpcClient, address: string, epoch?: number) => {
    const [ epochNow, voucher ] = await Promise.all([
        epoch ?? rpcClient('dna_epoch', [], true).then(({ result }) => result?.epoch as number | undefined),
        readProfileMapWithRpc(rpcClient, 'v:', address),
    ]);

    const [ own, ofVoucher ] = await Promise.all([
        getContractState(rpcClient, address, epochNow ?? -1),
        voucher ? getContractState(rpcClient, voucher, epochNow ?? -1) : undefined,
    ]);

    let standing: 'own' | 'vouched' | 'none' = 'none';
    if (VALIDATED_STATES.includes(own.state)) standing = 'own';
    else if (ofVoucher && VOUCHABLE_STATES.includes(own.state) && VALIDATED_STATES.includes(ofVoucher.state)) standing = 'vouched';

    return { own, voucher, ofVoucher, standing };
};

const checkName = async (rpcClient: RpcClient, address: string, name: string, epoch: number) => {
    if (!PROFILE_NAME_RULE.test(name)) return 'Use 3 to 20 characters: a-z, 0-9 and _.';

    const [ holder, blockedUntil, renamedIn ] = await Promise.all([
        readProfileMapWithRpc(rpcClient, 'n:', name),
        readProfileMapWithRpc(rpcClient, 'x:', name),
        readProfileMapWithRpc(rpcClient, 'r:', address),
    ]);

    if (holder === address) return 'That is already your name.';
    if (holder) return 'That name is taken.';
    if (blockedUntil && epoch < Number(blockedUntil)) return `That name was released recently. It can be claimed again from epoch ${blockedUntil}.`;
    if (renamedIn && Number(renamedIn) >= epoch) return 'You already changed your name this epoch. You can change it again after the next validation.';
};

const checkProfile = (bio: string, picture: string) => {
    if (bio.length > PROFILE_BIO_MAX) return `The bio can be at most ${PROFILE_BIO_MAX} characters.`;

    const cid = picture.slice('ipfs://'.length);
    if (picture && (!picture.startsWith('ipfs://') || picture.length > PROFILE_PICTURE_URL_MAX || !CID_RULE.test(cid))) {
        return 'The picture must be an ipfs:// link.';
    }
};

// Checks a call against the contract's rules for `address`, and sizes its amount and max fee.
export const prepareProfileCall = async (rpcClient: RpcClient, address: string, call: ProfileCall): Promise<PreparedProfileCall> => {
    const [ { result: epochResult }, { result: feePerGasResult }, { result: balanceResult } ] = await Promise.all([
        rpcClient('dna_epoch', [], true),
        rpcClient('bcn_feePerGas', [], true),
        rpcClient('dna_getBalance', [address], true),
    ]);

    const prepared: PreparedProfileCall = { call, amount: new Decimal(0), maxFee: new Decimal(0) };

    if (!epochResult || !feePerGasResult || !balanceResult) {
        return { ...prepared, error: 'The node did not answer. Try again.' };
    }

    const epoch = epochResult.epoch as number;
    const feePerGas = new Decimal(feePerGasResult).div(dnaBase);
    let promises = 0;

    // dropName reads no identity: the contract lets any holder drop its name.
    if (call.method === 'dropName') {
        if (!await readProfileMapWithRpc(rpcClient, 'a:', address)) return { ...prepared, error: 'You have no name to remove.' };
    } else {
        const { own, voucher, ofVoucher, standing } = await getEditStanding(rpcClient, address, epoch);
        if (standing === 'none') return { ...prepared, error: CANNOT_EDIT_PROFILE };

        const error = call.method === 'claimName' ? await checkName(rpcClient, address, call.args.name, epoch) : checkProfile(call.args.bio, call.args.picture);
        if (error) return { ...prepared, error };

        // An account listed as vouched for sends one more fee with each call, burned (payIfVouched): a vouched member
        // always, and one that got an identity of its own until the contract has read its state this epoch.
        if (voucher && (!own.known || VOUCHABLE_STATES.includes(own.state))) {
            prepared.amount = getVouchedPayment(feePerGas);
        }

        promises = [own, ofVoucher].filter((state) => state && !state.known).length;
    }

    const callGas = promises === 0
        ? INLINE_CALL_GAS
        : PROMISE_CALL_GAS + promises * IDENTITY_READ_GAS + CALLBACK_WASM_GAS / WASM_GAS_PER_GAS + (promises - 1) * KEEP_WASM_GAS / WASM_GAS_PER_GAS;
    const sizeGas = (getProfilePayload(call).toBytes().length + TX_BYTES_BESIDES_PAYLOAD) * GAS_PER_TX_BYTE;
    prepared.maxFee = feePerGas.mul((callGas + sizeGas) * FEE_MARGIN).toDecimalPlaces(6, Decimal.ROUND_UP);

    const balance = new Decimal(balanceResult.balance);
    const needed = prepared.maxFee.add(prepared.amount);
    if (balance.lessThan(needed)) {
        return { ...prepared, error: `Your balance (${balance.toDecimalPlaces(2)} iDNA) must cover the max fee${prepared.amount.isZero() ? '' : ' and the vouched member payment'}: ${needed.toDecimalPlaces(2, Decimal.ROUND_UP)} iDNA. The fee charged is about 1 iDNA.` };
    }

    return prepared;
};

// Sends a prepared call: signed by the node (RPC), or by the user in the Idena web app, which opens in a new tab.
export const sendProfileCall = async (
    rpcClient: RpcClient,
    from: string,
    prepared: PreparedProfileCall,
    makePostsWith: string,
    callbackUrl: string,
    webAppUrl: string,
) => {
    const { call, amount, maxFee } = prepared;

    if (makePostsWith === 'rpc') {
        const { error } = await rpcClient('contract_call', [{ from, contract: PROFILE_CONTRACT_ADDRESS, method: call.method, amount: amount.toNumber(), args: getProfileArgs(call), maxFee: maxFee.toString() }]);
        return { error: error ? (error.message as string | undefined) ?? 'The node refused the transaction.' : undefined };
    }

    const { nonce, epoch } = await getNonceAndEpoch(rpcClient, from);
    const txHex = getCallTransaction(PROFILE_CONTRACT_ADDRESS, amount, nonce, epoch, maxFee.mul(dnaBase).toFixed(0), getProfilePayload(call));
    window.open(`${webAppUrl}/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${call.method}`, '_blank');

    return { error: undefined };
};

const isApplied = (call: ProfileCall, profile: ProfileFields) => {
    if (call.method === 'claimName') return profile.name === call.args.name;
    if (call.method === 'dropName') return profile.name === '';
    return profile.bio === call.args.bio && profile.picture === call.args.picture;
};

// Waits until the contract shows the change. A transaction can be mined and still change nothing, when its callback
// fails (the name was taken meanwhile, for example), so the contract's state is what counts.
export const waitForProfileCall = async (rpcClient: RpcClient, address: string, call: ProfileCall) => {
    const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS));
        if (isApplied(call, await readProfileWithRpc(rpcClient, address))) return true;
    }

    return false;
};

const PICTURE_SIDE = 256;
const PICTURE_MAX_BYTES = 32 * 1024;
const PICTURE_QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];

// Makes the picture the idena-profile apps expect from any image: centre-cropped to a still 256x256 WebP of at most
// 32 KB.
export const makeProfilePicture = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = PICTURE_SIDE;
    canvas.height = PICTURE_SIDE;

    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PICTURE_SIDE, PICTURE_SIDE);
    bitmap.close();

    for (const quality of PICTURE_QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));

        // Safari draws other formats but can't encode WebP: it returns a PNG instead.
        if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot make WebP images. Try Chrome, Edge or Firefox.');
        if (blob.size <= PICTURE_MAX_BYTES) return new File([blob], 'picture.webp', { type: 'image/webp' });
    }

    throw new Error('This image cannot be made small enough (32 KB). Try a simpler one.');
};
