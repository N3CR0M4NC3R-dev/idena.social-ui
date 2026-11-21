import {
    createPostDisplayResolver,
    decodeModerationEvent,
    deriveModerationState,
    describeAddressBanEnd,
    emptyModerationState,
    getAddressBan,
    getOwnReport,
    getPlaceholderText,
    getPostHiddenStatus,
    getReportResolution,
    getTransactionBan,
    getVouchesGiven,
    groupReports,
    isAddressHex,
    isHashHex,
    normalizeHex,
    uiBannedAddresses,
    uiBannedTransactions,
    type ModeratablePost,
    type ModerationEvent,
    type ModerationSnapshot,
    type ThreadAccess,
} from './moderation';

const alice = '0x' + 'a1'.repeat(20);
const bob = '0x' + 'b2'.repeat(20);
const moderator = '0x' + 'c3'.repeat(20);
const hashOf = (n: number) => '0x' + n.toString(16).padStart(64, '0');

const toHexLE = (value: number, byteLength: number) => {
    let hex = '0x';
    for (let index = 0; index < byteLength; index++) {
        hex += ((value >> (8 * index)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
};
const toHexText = (text: string) => '0x' + Array.from(new TextEncoder().encode(text)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

let seq = 0;
const order = (timestamp: number) => {
    seq++;
    return { key: `${hashOf(seq)}:0`, txHash: hashOf(seq), timestamp, seq, eventIndex: 0 };
};

const banEvent = (address: string, timestamp: number, epoch: number, endEpoch: number, reason = 'spam', permanent = false): ModerationEvent =>
    ({ ...order(timestamp), name: 'ban', address, moderator, epoch, permanent, endEpoch, reason });
const unbanEvent = (address: string, timestamp: number): ModerationEvent =>
    ({ ...order(timestamp), name: 'unban', address, moderator, reason: '' });
const banTransactionEvent = (hash: string, timestamp: number, reason = 'scam'): ModerationEvent =>
    ({ ...order(timestamp), name: 'banTransaction', hash, moderator, epoch: 100, reason });
const unbanTransactionEvent = (hash: string, timestamp: number): ModerationEvent =>
    ({ ...order(timestamp), name: 'unbanTransaction', hash, moderator, reason: '' });
const reportEvent = (address: string, reporter: string, timestamp: number, reason = 'Spam'): ModerationEvent =>
    ({ ...order(timestamp), name: 'report', address, reporter, reason });
const reportTransactionEvent = (hash: string, reporter: string, timestamp: number, reason = 'Scam'): ModerationEvent =>
    ({ ...order(timestamp), name: 'reportTransaction', hash, reporter, reason });

const snapshotOf = (events: ModerationEvent[], options: { epoch?: number, uiAddresses?: string[], uiTransactions?: string[] } = {}): ModerationSnapshot => ({
    uiAddresses: new Set(options.uiAddresses ?? []),
    uiTransactions: new Set(options.uiTransactions ?? []),
    contract: deriveModerationState(events),
    epoch: options.epoch,
});

const post = (postId: string, fields: Partial<ModeratablePost> = {}): ModeratablePost => ({
    postId,
    poster: bob,
    txHash: hashOf(1000 + Number(postId.replace(/\D/g, '') || 0)),
    timestamp: 50,
    isLike: false,
    postLevel: 'Post',
    replyToPostId: '',
    channelPostId: '',
    ...fields,
});

// Builds thread access from posts and a parent -> children map.
const threadOf = (posts: ModeratablePost[], children: Record<string, string[]>): ThreadAccess => {
    const byId = Object.fromEntries(posts.map((item) => [item.postId, item]));
    return {
        getPost: (postId) => byId[postId],
        getChildIds: (treeKey) => children[treeKey] ?? [],
    };
};

describe('UI ban lists', () => {
    it('only contains valid entries', () => {
        for (const entry of uiBannedAddresses) {
            expect(isAddressHex(normalizeHex(entry)), entry).toBe(true);
        }
        for (const entry of uiBannedTransactions) {
            expect(isHashHex(normalizeHex(entry)), entry).toBe(true);
        }
    });

    it('normalizes case and a missing 0x', () => {
        expect(normalizeHex(' A1B2 ')).toBe('0xa1b2');
        expect(normalizeHex('0XA1B2')).toBe('0xa1b2');
    });
});

describe('decodeModerationEvent', () => {
    const at = { key: 'k', txHash: hashOf(1), timestamp: 10, seq: 1, eventIndex: 0 };

    it('decodes a ban', () => {
        const event = decodeModerationEvent('ban', [alice, moderator, toHexLE(239, 2), '0x00', toHexLE(242, 4), toHexText('Spam · ünïcode')], at);
        expect(event).toEqual({ ...at, name: 'ban', address: alice, moderator, epoch: 239, permanent: false, endEpoch: 242, reason: 'Spam · ünïcode' });
    });

    it('decodes a permanent ban with no reason', () => {
        const event = decodeModerationEvent('ban', [alice, moderator, toHexLE(239, 2), '0x01', toHexLE(0, 4), '0x'], at);
        expect(event).toMatchObject({ permanent: true, reason: '' });
    });

    it('decodes transaction bans and reports', () => {
        expect(decodeModerationEvent('banTransaction', [hashOf(7), moderator, toHexLE(5, 2), '0x'], at)).toMatchObject({ name: 'banTransaction', hash: hashOf(7), epoch: 5 });
        expect(decodeModerationEvent('reportTransaction', [hashOf(7), alice, toHexText('fake link')], at)).toMatchObject({ reporter: alice, reason: 'fake link' });
        expect(decodeModerationEvent('vouchesRevoked', [alice, moderator, toHexLE(3, 4)], at)).toMatchObject({ staker: moderator, count: 3 });
    });

    it('rejects unknown events and malformed args', () => {
        expect(decodeModerationEvent('makePost', [alice], at)).toBeUndefined();
        expect(decodeModerationEvent('unban', ['0x1234', moderator, '0x'], at)).toBeUndefined();
        expect(decodeModerationEvent('banTransaction', [alice, moderator, '0x0500', '0x'], at)).toBeUndefined();
        expect(decodeModerationEvent('ban', [alice, moderator, toHexLE(1, 4), '0x00', '0x', '0x'], at)).toBeUndefined();
    });
});

describe('deriveModerationState', () => {
    it('keeps the start of a ban that is replaced while still in effect', () => {
        const state = deriveModerationState([banEvent(alice, 100, 10, 12), banEvent(alice, 200, 11, 20)]);
        expect(state.addressBans.get(alice)).toMatchObject({ since: 100, bannedAt: 200, endEpoch: 20 });
    });

    it('starts a new ban after the previous one expired', () => {
        const state = deriveModerationState([banEvent(alice, 100, 10, 12), banEvent(alice, 300, 12, 15)]);
        expect(state.addressBans.get(alice)).toMatchObject({ since: 300 });
    });

    it('continues a permanent ban that is replaced', () => {
        const state = deriveModerationState([banEvent(alice, 100, 10, 0, 'spam', true), banEvent(alice, 300, 40, 45)]);
        expect(state.addressBans.get(alice)).toMatchObject({ since: 100, permanent: false });
    });

    it('starts a new ban after an unban', () => {
        const state = deriveModerationState([banEvent(alice, 100, 10, 20), unbanEvent(alice, 150), banEvent(alice, 300, 11, 20)]);
        expect(state.addressBans.get(alice)).toMatchObject({ since: 300 });
    });

    it('applies events in chain order, whatever order they come in', () => {
        const ban = banEvent(alice, 100, 10, 20);
        const unban = unbanEvent(alice, 150);
        expect(deriveModerationState([unban, ban]).addressBans.has(alice)).toBe(false);
    });

    it('tracks who vouches for whom', () => {
        const vouch = (address: string, voucher: string, name: 'vouch' | 'vouchWithdrawn'): ModerationEvent => ({ ...order(100), name, address, voucher, count: 0 });
        const revoke = (address: string): ModerationEvent => ({ ...order(100), name: 'vouchesRevoked', address, staker: moderator, count: 0 });
        const carol = '0x' + 'd4'.repeat(20);

        let state = deriveModerationState([vouch(alice, bob, 'vouch'), vouch(alice, carol, 'vouch'), vouch(alice, bob, 'vouchWithdrawn')]);
        expect([...state.vouchers.get(alice)!]).toEqual([carol]);

        state = deriveModerationState([vouch(alice, bob, 'vouch'), vouch(alice, bob, 'vouchWithdrawn')]);
        expect(state.vouchers.has(alice)).toBe(false);

        state = deriveModerationState([vouch(alice, bob, 'vouch'), vouch(alice, carol, 'vouch'), revoke(alice), vouch(alice, carol, 'vouch')]);
        expect([...state.vouchers.get(alice)!]).toEqual([carol]);
    });

    it('bans and lifts transactions', () => {
        const state = deriveModerationState([banTransactionEvent(hashOf(7), 100), banTransactionEvent(hashOf(8), 100), unbanTransactionEvent(hashOf(7), 200)]);
        expect([...state.transactionBans.keys()]).toEqual([hashOf(8)]);
    });
});

describe('bans', () => {
    it('expire at their end epoch', () => {
        const events = [banEvent(alice, 100, 10, 12)];
        expect(getAddressBan(alice, snapshotOf(events, { epoch: 11 }))).toMatchObject({ source: 'contract' });
        expect(getAddressBan(alice, snapshotOf(events, { epoch: 12 }))).toBeUndefined();
    });

    it('count as active until the epoch is known', () => {
        expect(getAddressBan(alice, snapshotOf([banEvent(alice, 100, 10, 12)]))).toBeDefined();
    });

    it('match addresses and hashes in any case', () => {
        const snapshot = snapshotOf([banTransactionEvent(hashOf(7), 100)], { uiAddresses: [alice] });
        expect(getAddressBan(alice.toUpperCase().replace('0X', '0x'), snapshot)).toEqual({ source: 'ui' });
        expect(getTransactionBan(hashOf(7).slice(2).toUpperCase(), snapshot)).toMatchObject({ source: 'contract', reason: 'scam' });
    });

    it('prefer the contract ban over the UI list', () => {
        const snapshot = snapshotOf([banEvent(alice, 100, 10, 12)], { uiAddresses: [alice], epoch: 11 });
        expect(getAddressBan(alice, snapshot)).toMatchObject({ source: 'contract' });
        expect(getAddressBan(alice, { ...snapshot, epoch: 12 })).toEqual({ source: 'ui' });
    });
});

describe('getPostHiddenStatus', () => {
    const snapshot = snapshotOf([banEvent(bob, 100, 10, 12, 'spam')], { epoch: 11 });

    it('removes posts made during a ban', () => {
        expect(getPostHiddenStatus(post('1', { timestamp: 100 }), snapshot)).toEqual({ kind: 'duringBan' });
        expect(getPostHiddenStatus(post('1', { timestamp: 150 }), snapshot)).toEqual({ kind: 'duringBan' });
    });

    it('hides posts made before a ban', () => {
        expect(getPostHiddenStatus(post('1', { timestamp: 99 }), snapshot)).toEqual({ kind: 'hidden', source: 'contract', reason: 'spam' });
    });

    it('never hides likes', () => {
        expect(getPostHiddenStatus(post('1', { timestamp: 150, isLike: true }), snapshot)).toBeUndefined();
    });

    it('hides transactions and UI-listed authors', () => {
        const listed = snapshotOf([banTransactionEvent(hashOf(1001), 100)], { uiAddresses: [alice] });
        expect(getPostHiddenStatus(post('1'), listed)).toEqual({ kind: 'hidden', source: 'contract', reason: 'scam' });
        expect(getPostHiddenStatus(post('2', { poster: alice, timestamp: 10_000 }), listed)).toEqual({ kind: 'hidden', source: 'ui', reason: '' });
        expect(getPostHiddenStatus(post('3'), listed)).toBeUndefined();
    });

    it('is undefined with no moderation at all', () => {
        expect(getPostHiddenStatus(post('1'), snapshotOf([]))).toBeUndefined();
    });
});

describe('createPostDisplayResolver', () => {
    // bob is UI-listed: all his posts are hidden, and shown as placeholders only with visible replies or comments.
    const snapshot = snapshotOf([], { uiAddresses: [bob] });
    const carol = '0x' + 'd4'.repeat(20);

    it('removes a hidden post with no replies and keeps a visible one', () => {
        const access = threadOf([post('1'), post('2', { poster: carol })], {});
        const resolve = createPostDisplayResolver(access, snapshot);
        expect(resolve('1')).toBe('removed');
        expect(resolve('2')).toBe('visible');
    });

    it('keeps a placeholder for a hidden post with a visible reply', () => {
        const access = threadOf([post('1'), post('2', { poster: carol, postLevel: 'Reply', replyToPostId: '1' })], { '1': ['2'] });
        expect(createPostDisplayResolver(access, snapshot)('1')).toBe('placeholder');
    });

    it('ignores likes and replies that are themselves removed', () => {
        const access = threadOf([
            post('1'),
            post('2', { poster: carol, postLevel: 'Reply', replyToPostId: '1', isLike: true }),
            post('3', { postLevel: 'Reply', replyToPostId: '1' }),
        ], { '1': ['2', '3'] });
        expect(createPostDisplayResolver(access, snapshot)('1')).toBe('removed');
    });

    it('looks through hidden replies to their comments', () => {
        const access = threadOf([
            post('1'),
            post('2', { postLevel: 'Reply', replyToPostId: '1' }),
            post('3', { poster: carol, postLevel: 'Comment', channelPostId: '2', replyToPostId: '2' }),
        ], { '1': ['2'], 'discuss:2': ['3'] });
        const resolve = createPostDisplayResolver(access, snapshot);
        expect(resolve('1')).toBe('placeholder');
        expect(resolve('2')).toBe('placeholder');
    });

    it('counts only the replies to a comment as its children', () => {
        const access = threadOf([
            post('2', { poster: carol, postLevel: 'Reply', replyToPostId: '1' }),
            post('3', { postLevel: 'Comment', channelPostId: '2', replyToPostId: '2' }),
            post('4', { postLevel: 'Comment', channelPostId: '2', replyToPostId: '3' }),
            post('5', { poster: carol, postLevel: 'Comment', channelPostId: '2', replyToPostId: '2' }),
        ], { 'discuss:2': ['3', '4', '5'] });
        const resolve = createPostDisplayResolver(access, snapshot);
        expect(resolve('3')).toBe('removed');
        const withReply = threadOf([...['2', '3'].map((id) => access.getPost(id)!), post('6', { poster: carol, postLevel: 'Comment', channelPostId: '2', replyToPostId: '3' })], { 'discuss:2': ['3', '6'] });
        expect(createPostDisplayResolver(withReply, snapshot)('3')).toBe('placeholder');
    });

    it('removes posts made during a ban even when they have replies', () => {
        const banned = snapshotOf([banEvent(bob, 40, 10, 12)], { epoch: 11 });
        const access = threadOf([post('1', { timestamp: 50 }), post('2', { poster: carol, postLevel: 'Reply', replyToPostId: '1' })], { '1': ['2'] });
        expect(createPostDisplayResolver(access, banned)('1')).toBe('removed');
    });

    it('survives a cyclic tree', () => {
        const access = threadOf([
            post('1', { postLevel: 'Reply', replyToPostId: '2' }),
            post('2', { postLevel: 'Reply', replyToPostId: '1' }),
        ], { 'discuss:1': [], '1': ['2'], '2': ['1'] });
        const cyclic: ThreadAccess = { ...access, getChildIds: (treeKey) => (treeKey === 'discuss:1' ? ['2'] : treeKey === 'discuss:2' ? ['1'] : []) };
        expect(createPostDisplayResolver(cyclic, snapshot)('1')).toBe('removed');
    });

    it('resolves a long chain of hidden comments without overflowing the stack', () => {
        const depth = 20_000;
        const comments = Array.from({ length: depth }, (_, index) =>
            post(`c${index}`, { postLevel: 'Comment', channelPostId: 'r', replyToPostId: index === 0 ? 'r' : `c${index - 1}` }));
        const last = post('last', { poster: carol, postLevel: 'Comment', channelPostId: 'r', replyToPostId: `c${depth - 1}` });
        const access = threadOf([post('r', { postLevel: 'Reply' }), ...comments, last], { 'discuss:r': [...comments.map((comment) => comment.postId), 'last'] });
        const resolve = createPostDisplayResolver(access, snapshot);
        expect(resolve('c0')).toBe('placeholder');
        expect(resolve('r')).toBe('placeholder');
    });

    it('shows everything when nothing is moderated', () => {
        const resolve = createPostDisplayResolver(threadOf([post('1')], {}), { ...snapshot, uiAddresses: new Set(), contract: emptyModerationState() });
        expect(resolve('1')).toBe('visible');
    });
});

describe('describeAddressBanEnd', () => {
    const ban = deriveModerationState([banEvent(alice, 100, 10, 12)]).addressBans.get(alice)!;

    it('names the end epoch, or the next validation when it is the next epoch', () => {
        expect(describeAddressBanEnd(ban, snapshotOf([], { epoch: 10 }))).toBe('until epoch 12');
        const nextValidation = new Date(2026, 11, 14, 12).getTime(); // the date shows in local time
        expect(describeAddressBanEnd(ban, { ...snapshotOf([], { epoch: 11 }), nextValidation })).toBe('until the validation on 14 Dec');
        expect(describeAddressBanEnd({ ...ban, permanent: true }, snapshotOf([], { epoch: 11 }))).toBe('permanently');
    });
});

describe('getPlaceholderText', () => {
    it('names the moderators and the reason for contract bans only', () => {
        expect(getPlaceholderText({ kind: 'hidden', source: 'contract', reason: 'Spam' })).toBe('Post hidden by moderators · Spam');
        expect(getPlaceholderText({ kind: 'hidden', source: 'contract', reason: '' })).toBe('Post hidden by moderators');
        expect(getPlaceholderText({ kind: 'hidden', source: 'ui', reason: '' })).toBe('Post hidden');
    });
});

describe('getVouchesGiven', () => {
    it('lists the addresses a voucher vouches for, after withdrawals and revocations', () => {
        const carol = '0x' + 'd4'.repeat(20);
        const dave = '0x' + 'e5'.repeat(20);
        const vouch = (address: string, voucher: string, name: 'vouch' | 'vouchWithdrawn' = 'vouch'): ModerationEvent => ({ ...order(100), name, address, voucher, count: 0 });
        const revoke = (address: string): ModerationEvent => ({ ...order(100), name: 'vouchesRevoked', address, staker: moderator, count: 0 });
        const snapshot = snapshotOf([vouch(alice, carol), vouch(bob, carol), vouch(dave, carol), vouch(bob, moderator), vouch(alice, carol, 'vouchWithdrawn'), revoke(dave)]);
        expect(getVouchesGiven(carol.toUpperCase().replace('0X', '0x'), snapshot)).toEqual([bob]);
        expect(getVouchesGiven(moderator, snapshot)).toEqual([bob]);
        expect(getVouchesGiven(alice, snapshot)).toEqual([]);
    });
});

describe('likes', () => {
    it('hides a "like" carrying media like any other post, and never a plain like', () => {
        const snapshot = snapshotOf([banEvent(bob, 10, 10, 12)], { epoch: 10 });
        expect(getPostHiddenStatus(post('1', { isLike: true, timestamp: 5 }), snapshot)).toBeUndefined();
        expect(getPostHiddenStatus(post('2', { isLike: true, timestamp: 5, media: 'ipfs://bafy' }), snapshot)).toEqual({ kind: 'hidden', source: 'contract', reason: 'spam' });
        expect(getPostHiddenStatus(post('3', { isLike: true, timestamp: 20, media: 'ipfs://bafy' }), snapshot)).toEqual({ kind: 'duringBan' });
    });
});

describe('reports', () => {
    const carol = '0x' + 'd4'.repeat(20);
    const dave = '0x' + 'e5'.repeat(20);

    it('decodes a report', () => {
        const at = order(10);
        const event = decodeModerationEvent('reportTransaction', [hashOf(7), alice, toHexText('Fake airdrop')], at);
        expect(event).toEqual({ ...at, name: 'reportTransaction', hash: hashOf(7), reporter: alice, reason: 'Fake airdrop' });
    });

    it('keeps every report in chain order', () => {
        const state = deriveModerationState([reportEvent(bob, alice, 10), reportTransactionEvent(hashOf(7), carol, 20)]);
        expect(state.reports.map((report) => [report.kind, report.target, report.reporter])).toEqual([['address', bob, alice], ['transaction', hashOf(7), carol]]);
    });

    it('groups by target, counts each reporter once with their latest reason, and sorts by reporters', () => {
        const snapshot = snapshotOf([
            reportTransactionEvent(hashOf(7), alice, 10, 'Spam'),
            reportEvent(bob, alice, 20),
            reportEvent(bob, carol, 30),
            reportTransactionEvent(hashOf(7), alice, 40, 'Scam'),
        ]);
        const groups = groupReports(snapshot);
        expect(groups.map((group) => [group.key, group.reports.length, group.newest])).toEqual([
            [`address:${bob}`, 2, 30],
            [`transaction:${hashOf(7)}`, 1, 40],
        ]);
        expect(groups[1].reports[0].reason).toBe('Scam');
    });

    it('sorts groups with as many reporters by their newest report', () => {
        const groups = groupReports(snapshotOf([reportEvent(bob, alice, 10), reportEvent(carol, alice, 20)]));
        expect(groups.map((group) => group.target)).toEqual([carol, bob]);
    });

    it('leaves out reports from accounts banned now', () => {
        const snapshot = snapshotOf([reportEvent(bob, alice, 10), reportEvent(bob, dave, 20), banEvent(dave, 30, 10, 0, 'report spam', true)], { epoch: 10 });
        expect(groupReports(snapshot)[0].reports.map((report) => report.reporter)).toEqual([alice]);
    });

    it('finds your latest report on a target', () => {
        const snapshot = snapshotOf([reportEvent(bob, alice, 10, 'Spam'), reportEvent(bob, alice, 20, 'Scam'), reportEvent(bob, carol, 30)]);
        expect(getOwnReport(alice.toUpperCase().replace('0X', '0x'), bob, snapshot)?.reason).toBe('Scam');
        expect(getOwnReport(dave, bob, snapshot)).toBeUndefined();
    });

    it('resolves a group while its target is banned or hidden', () => {
        const events = [reportEvent(bob, alice, 10), reportTransactionEvent(hashOf(7), alice, 10), reportTransactionEvent(hashOf(8), alice, 10)];
        let snapshot = snapshotOf(events, { epoch: 10 });
        const [account, post7, post8] = ['address', 'transaction', 'transaction'].map((kind, index) => groupReports(snapshot).find((group) => group.kind === kind && group.target === [bob, hashOf(7), hashOf(8)][index])!);
        expect(getReportResolution(account, undefined, snapshot)).toBeUndefined();
        expect(getReportResolution(post7, carol, snapshot)).toBeUndefined();

        snapshot = snapshotOf([...events, banEvent(bob, 20, 10, 12), banTransactionEvent(hashOf(7), 20), banEvent(carol, 20, 10, 12)], { epoch: 10 });
        expect(getReportResolution(account, undefined, snapshot)).toBe('Account banned');
        expect(getReportResolution(post7, undefined, snapshot)).toBe('Post hidden');
        expect(getReportResolution(post8, carol, snapshot)).toBe('Author banned');
        expect(getReportResolution(post8, undefined, snapshot)).toBeUndefined();

        // The ban ended: the group is open again.
        expect(getReportResolution(account, undefined, { ...snapshot, epoch: 12 })).toBeUndefined();
    });
});
