import { getAddressTxsWithIdenaIndexerApi, getTxEventsWithIdenaIndexerApi, type RpcClient } from './asyncUtils';
import { decodeModerationEvent, deriveModerationState, moderationConfig, normalizeHex, updateModerationSnapshot, type ModerationEvent } from './moderation';
import { clearModerationCache, loadModerationCache, newModerationMeta, saveModerationMeta, saveModerationSync, type ModerationMeta, type PendingReport } from './moderationStore';

// Replays the moderation contract's events into the live moderation snapshot. The history always comes from the
// indexer, whichever source the app finds posts with: a node can't list a contract's transactions without walking
// every block since the deploy.

type IndexerTx = { hash: string, type: string, from?: string, timestamp?: string, txReceipt?: { success: boolean, method?: string } };
type IndexerEvent = { eventName: string, data?: string[] };
type SyncResult = { changed: boolean, error?: unknown };

const TXS_PAGE_LIMIT = 100;
const TXS_POLL_LIMIT = 10;
const EVENTS_LIMIT = 100; // banTransactions emits one event per transaction it bans, at most 100
const EPOCH_REFRESH_MS = 10 * 60 * 1000;
const EPOCH_REFRESH_AFTER_VALIDATION_MS = 60 * 1000;

// Only these methods' events are fetched, one request per transaction. Adding one needs a MODERATION_REPLAY_VERSION
// bump, so older caches are replayed.
const REPLAYED_METHODS = new Set(['ban', 'unban', 'banTransaction', 'banTransactions', 'unbanTransaction', 'vouch', 'withdrawVouch', 'revokeVouches']);
// Reports are cheap and anyone can send them, so their events never hold up the rest: the replay only notes each
// report transaction, and syncModerationReports fetches the events later, every report's for moderators and only
// your own for everyone else.
const REPORT_METHODS = new Set(['report', 'reportTransaction']);
const REPORTS_PER_SYNC = 20;

let events: ModerationEvent[] = [];
let meta: ModerationMeta | undefined;
let syncInFlight: Promise<SyncResult> | undefined;
let reportSyncInFlight: Promise<boolean> | undefined;
let epochRefreshInFlight: Promise<boolean> | undefined;
let epochFetchedAt = 0;
// Bumped when the cache is cleared, so a sync already in flight doesn't apply or save onto the cleared cache.
let generation = 0;
// Set when a save failed: the next save rewrites every event instead of adding the new ones.
let unsaved = false;

// Transactions confirmed from their receipts that the indexer hasn't listed yet: their events are applied on top of
// the replayed ones, so the app shows an action as soon as it's mined. Each is dropped when the indexer lists its
// transaction, or after a few minutes in any case, so a stray one can't outlast the replay.
type ConfirmedTransaction = { txHash: string, events: ModerationEvent[], confirmedAt: number };
let confirmedTransactions: ConfirmedTransaction[] = [];
const CONFIRMED_TTL_MS = 3 * 60 * 1000;

const applyState = () => updateModerationSnapshot({ contract: deriveModerationState([...events, ...confirmedTransactions.flatMap((confirmed) => confirmed.events)]) });

// The replayed events, in chain order: the moderation log reads them.
export const getModerationEvents = () => events;

// Report transactions whose events haven't been fetched yet: the Reports tab says the queue is still loading.
export const getPendingReportCount = () => meta?.pendingReports?.length ?? 0;

// Applies a mined moderation transaction's events (from its receipt) until the indexer lists it.
export const applyConfirmedTransaction = (txHash: string, receiptEvents: { event: string, args: string[] }[]) => {
    const hash = normalizeHex(txHash);
    if (events.some((event) => event.txHash === hash) || confirmedTransactions.some((confirmed) => confirmed.txHash === hash)) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const decoded = receiptEvents
        .map((event, eventIndex) => decodeModerationEvent(event.event, event.args, { key: `${hash}:${eventIndex}`, txHash: hash, timestamp, seq: Number.MAX_SAFE_INTEGER, eventIndex }))
        .filter((event): event is ModerationEvent => !!event);

    confirmedTransactions = [...confirmedTransactions, { txHash: hash, events: decoded, confirmedAt: Date.now() }];
    applyState();
};

// Drops confirmed transactions the indexer has listed, or that are too old. Returns true when the state changed.
export const pruneConfirmedTransactions = () => {
    const listed = new Set(events.map((event) => event.txHash));
    const remaining = confirmedTransactions.filter((confirmed) => !listed.has(confirmed.txHash) && Date.now() - confirmed.confirmedAt < CONFIRMED_TTL_MS);
    if (remaining.length === confirmedTransactions.length) return false;

    confirmedTransactions = remaining;
    applyState();
    return true;
};

export const loadModeration = async () => {
    if (!moderationConfig) return;

    const cache = await loadModerationCache(normalizeHex(moderationConfig.contractAddress));
    events = cache.events;
    meta = cache.meta;
    updateModerationSnapshot({ contract: deriveModerationState(events), epoch: meta.epoch, nextValidation: meta.nextValidation });
};

const save = async (newEvents: ModerationEvent[], replaceAll: boolean) => {
    const rewrite = replaceAll || unsaved;
    unsaved = !(await saveModerationSync(rewrite ? events : newEvents, meta!, rewrite));
};

// Fetches the contract transactions the cache hasn't seen, newest first, and applies their events oldest first.
// Nothing is applied unless every page and event list arrived, so an interrupted sync simply runs again.
// changed is true when new events were applied. A call made while a sync runs gets that sync's result.
export const syncModeration = (indexerApiUrl: string): Promise<SyncResult> => {
    if (!moderationConfig || !meta) return Promise.resolve({ changed: false });

    syncInFlight ??= runSync(indexerApiUrl).finally(() => {
        syncInFlight = undefined;
    });

    return syncInFlight;
};

const runSync = async (indexerApiUrl: string): Promise<SyncResult> => {
    const syncGeneration = generation;
    const contractAddress = normalizeHex(moderationConfig!.contractAddress);
    const head = meta!.headTxHash;
    const newTxs: IndexerTx[] = [];
    let continuationToken: string | undefined;
    let reachedHead = false;

    do {
        const limit = head && !continuationToken ? TXS_POLL_LIMIT : TXS_PAGE_LIMIT;
        const response = await getAddressTxsWithIdenaIndexerApi(indexerApiUrl, contractAddress, limit, continuationToken);
        if (response.error) return { changed: false, error: response.error };

        for (const tx of (response.result ?? []) as IndexerTx[]) {
            // The first page starts with mempool transactions, which have no timestamp or receipt yet. They're
            // picked up once mined; one must never become the head.
            if (!tx.timestamp || !tx.txReceipt) continue;

            if (normalizeHex(tx.hash) === head) {
                reachedHead = true;
                break;
            }
            newTxs.push(tx);
        }

        continuationToken = response.continuationToken;
    } while (!reachedHead && continuationToken);

    if (!newTxs.length) return { changed: false };

    // The last applied transaction is no longer listed: replay everything that is.
    const replaceAll = !!head && !reachedHead;
    const newestTxHash = normalizeHex(newTxs[0].hash);
    const newEvents: ModerationEvent[] = [];
    const newPendingReports: PendingReport[] = [];
    let seq = replaceAll ? 0 : meta!.nextSeq;

    for (const tx of newTxs.reverse()) {
        const method = tx.txReceipt?.method ?? '';
        const txHash = normalizeHex(tx.hash);
        const timestamp = Math.floor(new Date(tx.timestamp!).getTime() / 1000);

        // A callback that rejects an action still leaves success: true, but emits no event: the events are the truth.
        // A rejection inside the call fails the transaction, which is skipped.
        if (tx.type === 'CallContract' && tx.txReceipt?.success === true && REPLAYED_METHODS.has(method)) {
            const response = await getTxEventsWithIdenaIndexerApi(indexerApiUrl, txHash, EVENTS_LIMIT);
            if (response.error) return { changed: false, error: response.error };
            newEvents.push(...decodeEvents(response.result, { txHash, timestamp, seq }));
        } else if (tx.type === 'CallContract' && tx.txReceipt?.success === true && REPORT_METHODS.has(method)) {
            newPendingReports.push({ txHash, from: normalizeHex(tx.from ?? ''), timestamp, seq });
        }
        seq++;
    }

    if (syncGeneration !== generation) return { changed: false };

    // A replay that starts over drops the reports already fetched: their transactions are pending again.
    events = replaceAll ? newEvents : [...events, ...newEvents];
    meta = {
        ...meta!,
        headTxHash: newestTxHash,
        nextSeq: seq,
        eventCount: events.length,
        pendingReports: replaceAll ? newPendingReports : [...meta!.pendingReports ?? [], ...newPendingReports],
    };
    if (!pruneConfirmedTransactions()) applyState();
    await save(newEvents, replaceAll);

    return { changed: newEvents.length > 0 || newPendingReports.length > 0 || replaceAll };
};

const decodeEvents = (result: unknown, { txHash, timestamp, seq }: Pick<PendingReport, 'txHash' | 'timestamp' | 'seq'>) =>
    ((result ?? []) as IndexerEvent[])
        .map((event, eventIndex) => decodeModerationEvent(event.eventName, event.data ?? [], { key: `${txHash}:${eventIndex}`, txHash, timestamp, seq, eventIndex }))
        .filter((event): event is ModerationEvent => !!event);

// Fetches the events of report transactions the replay noted, oldest first, at most REPORTS_PER_SYNC per call: all of
// them when allReports (moderators), otherwise only those `reporter` sent, for "You reported this". Returns true when
// reports were added. A call made while one runs gets its result.
export const syncModerationReports = (indexerApiUrl: string, reporter: string, allReports: boolean): Promise<boolean> => {
    if (!moderationConfig || !meta) return Promise.resolve(false);

    reportSyncInFlight ??= runReportSync(indexerApiUrl, normalizeHex(reporter), allReports).finally(() => {
        reportSyncInFlight = undefined;
    });

    return reportSyncInFlight;
};

const runReportSync = async (indexerApiUrl: string, reporter: string, allReports: boolean) => {
    const syncGeneration = generation;
    const due = (meta!.pendingReports ?? []).filter((pending) => allReports || pending.from === reporter).slice(0, REPORTS_PER_SYNC);
    const fetched = new Map<string, unknown>();

    for (const pending of due) {
        const response = await getTxEventsWithIdenaIndexerApi(indexerApiUrl, pending.txHash, EVENTS_LIMIT);
        // Keep what arrived: the rest waits for the next call.
        if (response.error) break;
        fetched.set(pending.txHash, response.result);
    }

    if (!fetched.size || syncGeneration !== generation) return false;

    // Applied to the state as it is now: a sync may have run meanwhile, and one that started over renumbered the
    // pending transactions.
    const pendingReports = meta!.pendingReports ?? [];
    const newEvents = pendingReports.filter((pending) => fetched.has(pending.txHash)).flatMap((pending) => decodeEvents(fetched.get(pending.txHash), pending));
    events = [...events, ...newEvents];
    meta = { ...meta!, eventCount: events.length, pendingReports: pendingReports.filter((pending) => !fetched.has(pending.txHash)) };
    if (!pruneConfirmedTransactions()) applyState();
    await save(newEvents, false);

    return true;
};

// Keeps the current epoch, which decides when address bans expire. Refreshes every 10 minutes, and every minute
// once the next validation is due. Returns true when the epoch or the next validation time changed. A call made
// while a refresh runs gets that refresh's result.
export const refreshModerationEpoch = (rpcClient: RpcClient): Promise<boolean> => {
    if (!moderationConfig || !meta) return Promise.resolve(false);

    epochRefreshInFlight ??= runEpochRefresh(rpcClient).finally(() => {
        epochRefreshInFlight = undefined;
    });

    return epochRefreshInFlight;
};

const runEpochRefresh = async (rpcClient: RpcClient) => {
    const now = Date.now();
    const validationDue = meta!.nextValidation !== undefined && now >= meta!.nextValidation;
    if (now - epochFetchedAt < (validationDue ? EPOCH_REFRESH_AFTER_VALIDATION_MS : EPOCH_REFRESH_MS)) return false;

    const refreshGeneration = generation;
    const { result } = await rpcClient('dna_epoch', [], true);
    if (typeof result?.epoch !== 'number' || refreshGeneration !== generation) return false;

    epochFetchedAt = now;
    const nextValidation = result.nextValidation ? new Date(result.nextValidation).getTime() : undefined;
    if (result.epoch === meta!.epoch && nextValidation === meta!.nextValidation) return false;

    meta = { ...meta!, epoch: result.epoch, nextValidation };
    updateModerationSnapshot({ epoch: result.epoch, nextValidation });

    if (unsaved) {
        await save([], true);
    } else {
        await saveModerationMeta(meta);
    }

    return true;
};

// Settings' "clear cached content": forget the replay so the next sync replays the contract from its first
// transaction. The current bans stay in effect until then, so nothing hidden flashes up.
export const clearModeration = async () => {
    generation++;

    if (moderationConfig) {
        events = [];
        meta = newModerationMeta(normalizeHex(moderationConfig.contractAddress));
        epochFetchedAt = 0;
        unsaved = false;
    }

    await clearModerationCache();
};
