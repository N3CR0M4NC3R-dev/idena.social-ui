import { discussPrefix, zeroAddress } from '../App.exports';

// Moderation: what the UI hides, from the idena.social-mod contract and from the UI's own ban lists.
// The rules are in docs/moderation.md. This module only imports constants, so it can be unit-tested
// without loading the rest of the app.

// ---------------------------------------------------------------------------------------------------------------
// Configuration (code only)
// ---------------------------------------------------------------------------------------------------------------

export type ModerationConfig = {
    contractAddress: string,
    // The rest mirror the contract's rules: update them with the contract.
    stakeThreshold: number,
    maxVouches: number,
    maxReasonBytes: number,
    maxBanEpochs: number,
    maxTransactionBatch: number,
    defaultCallbackGas: number,
    gasPerBatchedBan: number,
    gasPerExistingVoucher: number,
};

// The idena.social-mod contract the UI follows. null turns the contract integration off: no event replay, no
// contract bans; the UI ban lists below still apply. Typed explicitly so the code that reads it still handles null.
export const moderationConfig: ModerationConfig | null = {
    contractAddress: '0x2D063782FC18Fe29be8aaF65df9CDd3a1c53Bf6d', // deploy tx 0x04b6b960…, 2026-11-21
    stakeThreshold: 1_000_000,
    maxVouches: 5,
    maxReasonBytes: 280,
    maxBanEpochs: 65_535,
    maxTransactionBatch: 100,
    defaultCallbackGas: 4_000_000,
    gasPerBatchedBan: 2_000_000,
    gasPerExistingVoucher: 60_000, // approximate, for vouch and revokeVouches
};

// Hidden by this UI whatever the contract says, even when moderationConfig is null.
// Any case, with or without 0x. Removing an entry is the only way to lift it.
export const uiBannedAddresses: string[] = [
    // '0x1234…', // spam, 2026-11-21
];

export const uiBannedTransactions: string[] = [
    // '0xabcd…', // illegal content
];

// ---------------------------------------------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------------------------------------------

export const normalizeHex = (value: string) => {
    const lowerCase = value.trim().toLowerCase();
    return lowerCase.startsWith('0x') ? lowerCase : `0x${lowerCase}`;
};

export const isAddressHex = (value: string) => /^0x[0-9a-f]{40}$/.test(value);
export const isHashHex = (value: string) => /^0x[0-9a-f]{64}$/.test(value);

const hexToBytes = (hex: string) => {
    const digits = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (digits.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(digits)) return undefined;
    const bytes = new Uint8Array(digits.length / 2);
    for (let index = 0; index < bytes.length; index++) {
        bytes[index] = parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
};

const readAddress = (hex: string | undefined) => {
    const address = hex === undefined ? '' : normalizeHex(hex);
    return isAddressHex(address) ? address : undefined;
};

const readHash = (hex: string | undefined) => {
    const hash = hex === undefined ? '' : normalizeHex(hex);
    return isHashHex(hash) ? hash : undefined;
};

// Little-endian unsigned integer of at most byteLength bytes ("0x" reads as 0).
const readUint = (hex: string | undefined, byteLength: number) => {
    const bytes = hexToBytes(hex ?? '');
    if (!bytes || bytes.length > byteLength) return undefined;
    let value = 0;
    for (let index = bytes.length - 1; index >= 0; index--) {
        value = value * 256 + bytes[index];
    }
    return value;
};

const readText = (hex: string | undefined) => {
    const bytes = hexToBytes(hex ?? '');
    return bytes ? new TextDecoder().decode(bytes) : undefined;
};

// ---------------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------------

// seq orders transactions in chain order (assigned when they're stored), eventIndex orders events within one.
export type ModerationEventOrder = { key: string, txHash: string, timestamp: number, seq: number, eventIndex: number };

export type ModerationEvent = ModerationEventOrder & (
    | { name: 'ban', address: string, moderator: string, epoch: number, permanent: boolean, endEpoch: number, reason: string }
    | { name: 'unban', address: string, moderator: string, reason: string }
    | { name: 'banTransaction', hash: string, moderator: string, epoch: number, reason: string }
    | { name: 'unbanTransaction', hash: string, moderator: string, reason: string }
    | { name: 'vouch' | 'vouchWithdrawn', address: string, voucher: string, count: number }
    | { name: 'vouchesRevoked', address: string, staker: string, count: number }
    | { name: 'report', address: string, reporter: string, reason: string }
    | { name: 'reportTransaction', hash: string, reporter: string, reason: string }
);

// Decodes one event as the indexer or a node returns it: the event name and its args as 0x hex strings.
// Returns undefined for events this UI doesn't know or can't decode.
export const decodeModerationEvent = (name: string, args: string[], order: ModerationEventOrder): ModerationEvent | undefined => {
    switch (name) {
    case 'ban': {
        const address = readAddress(args[0]);
        const moderator = readAddress(args[1]);
        const epoch = readUint(args[2], 2);
        const permanent = readUint(args[3], 1);
        const endEpoch = readUint(args[4], 4);
        const reason = readText(args[5]);
        if (!address || !moderator || epoch === undefined || permanent === undefined || endEpoch === undefined || reason === undefined) return;
        return { ...order, name, address, moderator, epoch, permanent: permanent !== 0, endEpoch, reason };
    }
    case 'unban': {
        const address = readAddress(args[0]);
        const moderator = readAddress(args[1]);
        const reason = readText(args[2]);
        if (!address || !moderator || reason === undefined) return;
        return { ...order, name, address, moderator, reason };
    }
    case 'banTransaction': {
        const hash = readHash(args[0]);
        const moderator = readAddress(args[1]);
        const epoch = readUint(args[2], 2);
        const reason = readText(args[3]);
        if (!hash || !moderator || epoch === undefined || reason === undefined) return;
        return { ...order, name, hash, moderator, epoch, reason };
    }
    case 'unbanTransaction': {
        const hash = readHash(args[0]);
        const moderator = readAddress(args[1]);
        const reason = readText(args[2]);
        if (!hash || !moderator || reason === undefined) return;
        return { ...order, name, hash, moderator, reason };
    }
    case 'vouch':
    case 'vouchWithdrawn': {
        const address = readAddress(args[0]);
        const voucher = readAddress(args[1]);
        const count = readUint(args[2], 4);
        if (!address || !voucher || count === undefined) return;
        return { ...order, name, address, voucher, count };
    }
    case 'vouchesRevoked': {
        const address = readAddress(args[0]);
        const staker = readAddress(args[1]);
        const count = readUint(args[2], 4);
        if (!address || !staker || count === undefined) return;
        return { ...order, name, address, staker, count };
    }
    case 'report': {
        const address = readAddress(args[0]);
        const reporter = readAddress(args[1]);
        const reason = readText(args[2]);
        if (!address || !reporter || reason === undefined) return;
        return { ...order, name, address, reporter, reason };
    }
    case 'reportTransaction': {
        const hash = readHash(args[0]);
        const reporter = readAddress(args[1]);
        const reason = readText(args[2]);
        if (!hash || !reporter || reason === undefined) return;
        return { ...order, name, hash, reporter, reason };
    }
    default:
        return;
    }
};

export const compareModerationEvents = (a: ModerationEventOrder, b: ModerationEventOrder) => a.seq - b.seq || a.eventIndex - b.eventIndex;

// ---------------------------------------------------------------------------------------------------------------
// Ban state
// ---------------------------------------------------------------------------------------------------------------

// since: when the current uninterrupted ban started. A replacement ban made while the previous one was still in
// effect keeps it; a ban after an unban or after the previous one expired starts a new one.
export type AddressBan = { moderator: string, epoch: number, permanent: boolean, endEpoch: number, reason: string, since: number, bannedAt: number };
export type TransactionBan = { moderator: string, epoch: number, reason: string, bannedAt: number };
// A report of an address or a transaction (target), from the contract's events.
export type ModerationReport = { key: string, txHash: string, kind: 'address' | 'transaction', target: string, reporter: string, reason: string, timestamp: number };
// vouchers: who vouches for each vouched moderator. An address is a vouched moderator while it has any.
// reports: every report, in chain order.
export type ModerationState = {
    addressBans: Map<string, AddressBan>,
    transactionBans: Map<string, TransactionBan>,
    vouchers: Map<string, Set<string>>,
    reports: ModerationReport[],
};

export const emptyModerationState = (): ModerationState => ({ addressBans: new Map(), transactionBans: new Map(), vouchers: new Map(), reports: [] });

export const deriveModerationState = (events: ModerationEvent[]): ModerationState => {
    const { addressBans, transactionBans, vouchers, reports } = emptyModerationState();

    for (const event of [...events].sort(compareModerationEvents)) {
        switch (event.name) {
        case 'ban': {
            const previous = addressBans.get(event.address);
            const continuesPrevious = !!previous && (previous.permanent || event.epoch < previous.endEpoch);
            addressBans.set(event.address, {
                moderator: event.moderator,
                epoch: event.epoch,
                permanent: event.permanent,
                endEpoch: event.endEpoch,
                reason: event.reason,
                since: continuesPrevious ? previous.since : event.timestamp,
                bannedAt: event.timestamp,
            });
            break;
        }
        case 'unban':
            addressBans.delete(event.address);
            break;
        case 'banTransaction':
            transactionBans.set(event.hash, { moderator: event.moderator, epoch: event.epoch, reason: event.reason, bannedAt: event.timestamp });
            break;
        case 'unbanTransaction':
            transactionBans.delete(event.hash);
            break;
        case 'vouch':
            vouchers.set(event.address, new Set([...vouchers.get(event.address) ?? [], event.voucher]));
            break;
        case 'vouchWithdrawn': {
            const remaining = new Set(vouchers.get(event.address));
            remaining.delete(event.voucher);
            if (remaining.size) vouchers.set(event.address, remaining);
            else vouchers.delete(event.address);
            break;
        }
        case 'vouchesRevoked':
            vouchers.delete(event.address);
            break;
        case 'report':
        case 'reportTransaction': {
            const { key, txHash, reporter, reason, timestamp } = event;
            reports.push(event.name === 'report'
                ? { key, txHash, kind: 'address', target: event.address, reporter, reason, timestamp }
                : { key, txHash, kind: 'transaction', target: event.hash, reporter, reason, timestamp });
            break;
        }
        }
    }

    return { addressBans, transactionBans, vouchers, reports };
};

// Everything the hiding rules read. epoch is undefined until the current epoch is known; bans then count as active,
// so content doesn't flash up and disappear again.
export type ModerationSnapshot = {
    uiAddresses: Set<string>,
    uiTransactions: Set<string>,
    contract: ModerationState,
    epoch?: number,
    nextValidation?: number, // ms
};

let liveSnapshot: ModerationSnapshot = {
    uiAddresses: new Set(uiBannedAddresses.map(normalizeHex)),
    uiTransactions: new Set(uiBannedTransactions.map(normalizeHex)),
    contract: emptyModerationState(),
};

export const getModerationSnapshot = () => liveSnapshot;

export const updateModerationSnapshot = (changes: Partial<Pick<ModerationSnapshot, 'contract' | 'epoch' | 'nextValidation'>>) => {
    liveSnapshot = { ...liveSnapshot, ...changes };
};

const hasModeration = (snapshot: ModerationSnapshot) =>
    snapshot.uiAddresses.size > 0 ||
    snapshot.uiTransactions.size > 0 ||
    snapshot.contract.addressBans.size > 0 ||
    snapshot.contract.transactionBans.size > 0;

export const isAddressBanActive = (ban: AddressBan, epoch: number | undefined) => ban.permanent || epoch === undefined || epoch < ban.endEpoch;

export type AddressBanStatus = ({ source: 'contract' } & AddressBan) | { source: 'ui' };
export type TransactionBanStatus = ({ source: 'contract' } & TransactionBan) | { source: 'ui' };

export const getAddressBan = (address: string, snapshot = liveSnapshot): AddressBanStatus | undefined => {
    if (!hasModeration(snapshot) || !address) return;
    const key = normalizeHex(address);
    const ban = snapshot.contract.addressBans.get(key);
    if (ban && isAddressBanActive(ban, snapshot.epoch)) return { source: 'contract', ...ban };
    if (snapshot.uiAddresses.has(key)) return { source: 'ui' };
};

export const isAddressBanned = (address: string, snapshot = liveSnapshot) => !!getAddressBan(address, snapshot);

// Who vouches for an address, from the replayed events. Empty when it isn't a vouched moderator.
export const getVouchers = (address: string, snapshot = liveSnapshot) => [...snapshot.contract.vouchers.get(normalizeHex(address)) ?? []];

// The addresses a voucher's vouches are in effect for: at most maxVouches. A voucher whose stake dropped, or who was
// banned, keeps them until they withdraw them or a staker revokes them.
export const getVouchesGiven = (voucher: string, snapshot = liveSnapshot) => {
    const key = normalizeHex(voucher);
    return [...snapshot.contract.vouchers.entries()].filter(([, vouchers]) => vouchers.has(key)).map(([address]) => address);
};


// Whether an address counts as a staker, from a known stake (in iDNA). Stakers moderate and can't be banned.
export const isStaker = (stake: string | number | undefined, config = moderationConfig) =>
    !!config && Number(stake ?? 0) >= config.stakeThreshold;

export type ModeratorRole = 'staker' | 'vouched';

// The role the replayed state and a known stake give an address, to show moderator tools. Actions check the
// contract itself before anything is signed.
export const getModeratorRole = (address: string, stake: string | number | undefined, snapshot = liveSnapshot): ModeratorRole | undefined => {
    if (!moderationConfig || !address || normalizeHex(address) === zeroAddress) return;
    const ban = snapshot.contract.addressBans.get(normalizeHex(address));
    if (ban && isAddressBanActive(ban, snapshot.epoch)) return;
    if (isStaker(stake)) return 'staker';
    if (getVouchers(address, snapshot).length) return 'vouched';
};

// When a contract ban ends, for display: "permanently", "until the validation on 14 Dec" or "until epoch 182".
export const describeAddressBanEnd = (ban: AddressBan, snapshot = liveSnapshot) => {
    if (ban.permanent) return 'permanently';
    if (snapshot.epoch !== undefined && snapshot.nextValidation !== undefined && ban.endEpoch === snapshot.epoch + 1) {
        return `until the validation on ${new Date(snapshot.nextValidation).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    return `until epoch ${ban.endEpoch}`;
};

export const getTransactionBan = (txHash: string, snapshot = liveSnapshot): TransactionBanStatus | undefined => {
    if (!hasModeration(snapshot) || !txHash) return;
    const key = normalizeHex(txHash);
    const ban = snapshot.contract.transactionBans.get(key);
    if (ban) return { source: 'contract', ...ban };
    if (snapshot.uiTransactions.has(key)) return { source: 'ui' };
};

// ---------------------------------------------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------------------------------------------

export type ModeratablePost = {
    postId: string,
    poster: string,
    txHash: string,
    timestamp: number,
    isLike: boolean,
    media?: string,
    postLevel: string,
    replyToPostId: string,
    channelPostId: string,
};

// duringBan: posted while its author is banned by the contract; never shown.
// hidden: posted before the ban, hidden individually, or by a UI-listed author; shown as a placeholder only while
// it has visible replies or comments.
export type PostHiddenStatus = { kind: 'duringBan' } | { kind: 'hidden', source: 'contract' | 'ui', reason: string };

export const getPostHiddenStatus = (post: ModeratablePost, snapshot = liveSnapshot): PostHiddenStatus | undefined => {
    // Likes are never hidden: they keep counting. A "like" carrying media isn't one the app sends: it's hidden like
    // any other post, or its media would get past every ban.
    if (!hasModeration(snapshot) || (post.isLike && !post.media)) return;

    const addressBan = getAddressBan(post.poster, snapshot);
    if (addressBan?.source === 'contract' && post.timestamp >= addressBan.since) return { kind: 'duringBan' };

    const transactionBan = getTransactionBan(post.txHash, snapshot);
    if (transactionBan) return { kind: 'hidden', source: transactionBan.source, reason: transactionBan.source === 'contract' ? transactionBan.reason : '' };

    if (addressBan) return { kind: 'hidden', source: addressBan.source, reason: addressBan.source === 'contract' ? addressBan.reason : '' };
};

export type PostDisplay = 'visible' | 'placeholder' | 'removed';

export type ThreadAccess = {
    getPost: (postId: string) => ModeratablePost | undefined,
    // Child ids under a tree key: a root's replies under its id, a reply's comments under discussPrefix + its id.
    getChildIds: (treeKey: string) => string[],
};

// Returns a function telling how each post displays. Create one per render: it memoises, and the threads change
// between renders.
export const createPostDisplayResolver = (access: ThreadAccess, snapshot = liveSnapshot): ((postId: string) => PostDisplay) => {
    if (!hasModeration(snapshot)) {
        return () => 'visible';
    }

    const memo = new Map<string, PostDisplay>();

    // Each tree key's children, and each discussion's comments grouped by the comment they reply to, are looked up
    // once per resolver: a flood of hidden comments would otherwise rescan its discussion for every comment.
    const childIdsByTreeKey = new Map<string, string[]>();
    const commentRepliesByDiscussion = new Map<string, Map<string, string[]>>();

    const getTreeChildIds = (treeKey: string) => {
        let childIds = childIdsByTreeKey.get(treeKey);
        if (!childIds) {
            childIds = access.getChildIds(treeKey);
            childIdsByTreeKey.set(treeKey, childIds);
        }
        return childIds;
    };

    // The replies and comments shown under a post, likes excluded. A root's are its replies; a reply's, every comment
    // in its discussion; a comment's, the comments in the same discussion that reply to it.
    const getChildIds = (post: ModeratablePost) => {
        if (post.postLevel === 'Post') return getTreeChildIds(post.postId);
        if (post.postLevel === 'Reply') return getTreeChildIds(discussPrefix + post.postId);

        const discussionKey = discussPrefix + post.channelPostId;
        let repliesByComment = commentRepliesByDiscussion.get(discussionKey);
        if (!repliesByComment) {
            repliesByComment = new Map();
            for (const commentId of getTreeChildIds(discussionKey)) {
                const replyToPostId = access.getPost(commentId)?.replyToPostId ?? '';
                repliesByComment.set(replyToPostId, [...repliesByComment.get(replyToPostId) ?? [], commentId]);
            }
            commentRepliesByDiscussion.set(discussionKey, repliesByComment);
        }
        return repliesByComment.get(post.postId) ?? [];
    };

    const getChildren = (post: ModeratablePost) =>
        getChildIds(post).map((childId) => access.getPost(childId)).filter((child): child is ModeratablePost => !!child && !child.isLike);

    // How a post displays without looking at its children: hidden posts still need them.
    const getOwnDisplay = (postId: string): PostDisplay | 'hidden' => {
        const post = access.getPost(postId);
        if (!post) return 'visible';
        const status = getPostHiddenStatus(post, snapshot);
        if (!status) return 'visible';
        return status.kind === 'duringBan' ? 'removed' : 'hidden';
    };

    // Depth-first with an explicit stack: a long chain of hidden comments would overflow the call stack.
    // A hidden post is a placeholder when any child isn't removed.
    const resolve = (postId: string): PostDisplay => {
        const memoised = memo.get(postId);
        if (memoised) return memoised;

        type Frame = { postId: string, childIds?: string[], index: number, hasVisibleChild: boolean };
        const stack: Frame[] = [{ postId, index: 0, hasVisibleChild: false }];
        const onStack = new Set<string>();

        while (stack.length) {
            const frame = stack[stack.length - 1];

            if (!frame.childIds) {
                const ownDisplay = getOwnDisplay(frame.postId);
                if (ownDisplay !== 'hidden') {
                    memo.set(frame.postId, ownDisplay);
                    stack.pop();
                    continue;
                }
                frame.childIds = getChildren(access.getPost(frame.postId)!).map((child) => child.postId);
                onStack.add(frame.postId);
            }

            let pushedChild = false;
            while (frame.index < frame.childIds.length && !frame.hasVisibleChild) {
                const childId = frame.childIds[frame.index];
                const childDisplay = memo.get(childId);
                if (childDisplay) {
                    frame.hasVisibleChild = childDisplay !== 'removed';
                    frame.index++;
                } else if (onStack.has(childId)) {
                    // A reply pointing at a later post can make the tree cyclic: count the loop as removed.
                    frame.index++;
                } else {
                    stack.push({ postId: childId, index: 0, hasVisibleChild: false });
                    pushedChild = true;
                    break;
                }
            }
            if (pushedChild) continue;

            memo.set(frame.postId, frame.hasVisibleChild ? 'placeholder' : 'removed');
            onStack.delete(frame.postId);
            stack.pop();
        }

        return memo.get(postId)!;
    };

    return resolve;
};

export const getPlaceholderText = (status: PostHiddenStatus | undefined) => {
    if (status?.kind !== 'hidden' || status.source === 'ui') return 'Post hidden';
    return status.reason ? `Post hidden by moderators · ${status.reason}` : 'Post hidden by moderators';
};

// ---------------------------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------------------------

// The latest report `reporter` made on an address or transaction: the contract doesn't remove duplicates, so the
// report sheet shows it instead of reporting again.
export const getOwnReport = (reporter: string, target: string, snapshot = liveSnapshot) => {
    const from = normalizeHex(reporter);
    const key = normalizeHex(target);
    const reports = snapshot.contract.reports;
    for (let index = reports.length - 1; index >= 0; index--) {
        if (reports[index].reporter === from && reports[index].target === key) return reports[index];
    }
};

// The reports on one address or transaction. reports holds each reporter's latest, newest first.
export type ReportGroup = { key: string, kind: 'address' | 'transaction', target: string, reports: ModerationReport[], newest: number };

const reportGroupsCache = new WeakMap<ModerationSnapshot, ReportGroup[]>();

// Groups reports by target, counting each reporter once. Reports from accounts banned now are left out: banning an
// account that spams reports clears them from the queue. Sorted by reporter count, then by the newest report.
// Worked out once per snapshot, which is replaced whenever it changes: App reads it on every render.
export const groupReports = (snapshot = liveSnapshot): ReportGroup[] => {
    let groups = reportGroupsCache.get(snapshot);
    if (!groups) {
        groups = buildReportGroups(snapshot);
        reportGroupsCache.set(snapshot, groups);
    }
    return groups;
};

const buildReportGroups = (snapshot: ModerationSnapshot): ReportGroup[] => {
    const byTarget = new Map<string, Map<string, ModerationReport>>();
    for (const report of snapshot.contract.reports) {
        if (isAddressBanned(report.reporter, snapshot)) continue;
        const key = `${report.kind}:${report.target}`;
        const byReporter = byTarget.get(key) ?? new Map<string, ModerationReport>();
        byReporter.set(report.reporter, report); // chain order: the latest wins
        byTarget.set(key, byReporter);
    }

    return [...byTarget.entries()]
        .map(([key, byReporter]) => {
            const reports = [...byReporter.values()].sort((a, b) => b.timestamp - a.timestamp);
            return { key, kind: reports[0].kind, target: reports[0].target, reports, newest: reports[0].timestamp };
        })
        .sort((a, b) => b.reports.length - a.reports.length || b.newest - a.newest);
};

// Why a group needs no action now, or undefined while it's open: its account is banned, or its transaction hidden,
// individually or by its author's ban. author is the reported transaction's sender, when known. Unbanning reopens it.
export const getReportResolution = (group: ReportGroup, author: string | undefined, snapshot = liveSnapshot) => {
    if (group.kind === 'address') return getAddressBan(group.target, snapshot) ? 'Account banned' : undefined;
    if (getTransactionBan(group.target, snapshot)) return 'Post hidden';
    if (author && getAddressBan(author, snapshot)) return 'Author banned';
};
