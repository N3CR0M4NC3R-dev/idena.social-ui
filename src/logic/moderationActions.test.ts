import type { RpcClient } from './asyncUtils';
import { moderationConfig } from './moderation';
import { parseStakeEpoch, prepareModerationCall, readModerationStanding } from './moderationActions';

const alice = '0x' + 'a1'.repeat(20);
const bob = '0x' + 'b2'.repeat(20);
const carol = '0x' + 'c3'.repeat(20);
const EPOCH = 240;
const threshold = moderationConfig!.stakeThreshold;
const NODE_FAILED = 'The node did not answer. Try again.';

const toHexLE = (value: number, byteLength: number) => {
    let hex = '0x';
    for (let index = 0; index < byteLength; index++) {
        hex += ((value >> (8 * index)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
};
const toHexText = (text: string) => '0x' + Array.from(new TextEncoder().encode(text)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

type MapName = 'b:' | 'm:' | 'v:' | 's:';
// maps: what the contract stores for the address (as the node returns it); a map not listed is unset. failing: maps
// whose read fails.
type FakeAccount = { stake?: number, maps?: Partial<Record<MapName, string>>, failing?: MapName[] };

// A node that knows `accounts`, keyed by lowercase address. Any other address has no stake and nothing stored.
const fakeNode = (accounts: Record<string, FakeAccount>, epoch: number | 'fail' = EPOCH) => {
    const accountByKey = new Map(Object.entries(accounts).map(([address, account]) => [toHexText(address), account]));
    const mapReads: string[][] = [];
    const rpcClient: RpcClient = async (method, params) => {
        switch (method) {
        case 'dna_identity':
            return { result: { address: params[0], stake: String(accounts[params[0]]?.stake ?? 0) } };
        case 'dna_epoch':
            return epoch === 'fail' ? { error: new Error('fetch failed') } : { result: { epoch } };
        case 'bcn_feePerGas':
            return { result: 112_000_000_000_000 }; // 0.000112 iDNA
        case 'dna_getBalance':
            return { result: { balance: '1000' } };
        case 'contract_readMap': {
            const [, map, key, format] = params as [string, MapName, string, string];
            mapReads.push([map, key, format]);
            const account = accountByKey.get(key);
            if (account?.failing?.includes(map)) return { error: new Error('fetch failed') };
            const value = account?.maps?.[map];
            return value === undefined ? { error: { code: -32000, message: 'data is nil' } } : { result: value };
        }
        }
        return { error: { message: `unexpected ${method}` } };
    };
    return { rpcClient, mapReads };
};

describe('parseStakeEpoch', () => {
    it('decodes a little-endian u16', () => {
        expect(parseStakeEpoch('0xf000')).toBe(240);
        expect(parseStakeEpoch('0xF000')).toBe(240);
        expect(parseStakeEpoch('0x0001')).toBe(256);
        expect(parseStakeEpoch('0xffff')).toBe(65_535);
        expect(parseStakeEpoch(toHexLE(EPOCH, 2))).toBe(EPOCH);
    });

    it('returns undefined when unset or not 2 bytes', () => {
        expect(parseStakeEpoch('')).toBeUndefined();
        expect(parseStakeEpoch('0x')).toBeUndefined();
        expect(parseStakeEpoch('0xf0')).toBeUndefined();
        expect(parseStakeEpoch('0xf00000')).toBeUndefined();
        expect(parseStakeEpoch('0xzz00')).toBeUndefined();
    });
});

describe('readModerationStanding', () => {
    it('reads s: as hex, keyed like the other maps', async () => {
        const { rpcClient, mapReads } = fakeNode({});
        await readModerationStanding(rpcClient, alice);
        expect(mapReads).toContainEqual(['m:', toHexText(alice), 'hex']);
        expect(mapReads).toContainEqual(['s:', toHexText(alice), 'hex']);
    });

    it('counts live stake at the threshold', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: threshold } });
        expect(await readModerationStanding(rpcClient, alice)).toMatchObject({ known: true, staker: true, role: 'staker' });
    });

    it('counts a staker confirmed this epoch whose stake is below the threshold', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: 0, maps: { 's:': toHexLE(EPOCH, 2) } } });
        expect(await readModerationStanding(rpcClient, alice)).toMatchObject({ known: true, staker: true, role: 'staker' });
    });

    it('ignores a confirmation from another epoch', async () => {
        for (const confirmed of [EPOCH - 1, EPOCH + 1]) {
            const { rpcClient } = fakeNode({ [alice]: { stake: threshold - 1, maps: { 's:': toHexLE(confirmed, 2) } } });
            expect(await readModerationStanding(rpcClient, alice), `epoch ${confirmed}`).toMatchObject({ known: true, staker: false, role: undefined });
        }
    });

    it('treats an unset s: as not confirmed', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: threshold - 1 } });
        expect(await readModerationStanding(rpcClient, alice)).toMatchObject({ known: true, staker: false, role: undefined });
    });

    it('makes the standing unknown when the s: read fails', async () => {
        for (const stake of [0, threshold]) {
            const { rpcClient } = fakeNode({ [alice]: { stake, failing: ['s:'] } });
            expect((await readModerationStanding(rpcClient, alice)).known, `stake ${stake}`).toBe(false);
        }
    });

    it('never counts a confirmation when the epoch is unknown', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: 0 } }, 'fail');
        expect(await readModerationStanding(rpcClient, alice)).toMatchObject({ known: false, staker: false });
    });
});

describe('prepareModerationCall with confirmed stakers', () => {
    const vouchedBy = (voucher: string) => '0x' + voucher.slice(2);
    const ban = { method: 'ban', args: { address: bob, epochs: 1, reason: 'spam' } } as const;

    it('refuses to ban a target confirmed as a staker this epoch, whatever its stake', async () => {
        const { rpcClient } = fakeNode({ [alice]: { maps: { 'm:': vouchedBy(carol) } }, [bob]: { stake: 0, maps: { 's:': toHexLE(EPOCH, 2) } } });
        expect((await prepareModerationCall(rpcClient, alice, ban)).error).toBe('Stakers can\'t be banned.');
    });

    it('allows banning a target confirmed in an earlier epoch whose stake has dropped', async () => {
        const { rpcClient } = fakeNode({ [alice]: { maps: { 'm:': vouchedBy(carol) } }, [bob]: { stake: 0, maps: { 's:': toHexLE(EPOCH - 1, 2) } } });
        const prepared = await prepareModerationCall(rpcClient, alice, ban);
        expect(prepared.error).toBeUndefined();
        expect(prepared.role).toBe('vouched');
    });

    it('lets a staker confirmed this epoch vouch, with a staker\'s max fee', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: 0, maps: { 's:': toHexLE(EPOCH, 2) } } });
        const prepared = await prepareModerationCall(rpcClient, alice, { method: 'vouch', args: { address: bob } });
        expect(prepared.error).toBeUndefined();
        expect(prepared.role).toBe('staker');
        expect(prepared.maxFee.greaterThan(0)).toBe(true);
    });

    it('stops when the caller\'s s: read fails, even with live stake', async () => {
        const { rpcClient } = fakeNode({ [alice]: { stake: threshold, failing: ['s:'] } });
        expect((await prepareModerationCall(rpcClient, alice, { method: 'vouch', args: { address: bob } })).error).toBe(NODE_FAILED);
    });

    it('stops when the ban target\'s s: read fails', async () => {
        const { rpcClient } = fakeNode({ [alice]: { maps: { 'm:': vouchedBy(carol) } }, [bob]: { failing: ['s:'] } });
        expect((await prepareModerationCall(rpcClient, alice, ban)).error).toBe(NODE_FAILED);
    });
});
