import { getDb, MODERATION_EVENTS_STORE, MODERATION_META_STORE } from './db';
import type { ModerationEvent } from './moderation';

// A report transaction the replay listed: who sent it, and its place in chain order.
export type PendingReport = { txHash: string, from: string, timestamp: number, seq: number };

// Bump when the replay changes what it keeps (e.g. starts fetching another method's events): caches built by an
// older version are replayed again.
export const MODERATION_REPLAY_VERSION = 3; // 2: reports; 3: report transactions noted as pending, fetched apart

// Where the replay of the moderation contract's events got to. The cache belongs to one contract: when the configured
// address changes, it's cleared and the new contract is replayed from its first transaction.
export type ModerationMeta = {
    key: 'meta',
    version: number,
    contractAddress: string, // lowercase
    headTxHash?: string, // the newest contract transaction already applied
    nextSeq: number,
    eventCount: number, // events stored: a mismatch on load means a save was lost
    // Report transactions up to headTxHash whose events haven't been fetched yet (see syncModerationReports).
    pendingReports?: PendingReport[],
    epoch?: number,
    nextValidation?: number, // ms
};

export const newModerationMeta = (contractAddress: string): ModerationMeta =>
    ({ key: 'meta', version: MODERATION_REPLAY_VERSION, contractAddress, nextSeq: 0, eventCount: 0 });

export const loadModerationCache = async (contractAddress: string) => {
    const empty = { events: [] as ModerationEvent[], meta: newModerationMeta(contractAddress) };

    try {
        const db = await getDb();
        if (!db) return empty;

        const transaction = db.transaction([MODERATION_EVENTS_STORE, MODERATION_META_STORE]);
        const [meta, events] = await Promise.all([
            transaction.objectStore(MODERATION_META_STORE).get('meta') as Promise<ModerationMeta | undefined>,
            transaction.objectStore(MODERATION_EVENTS_STORE).getAll() as Promise<ModerationEvent[]>,
        ]);

        // Another contract, an older replay, or events missing behind the head: start over.
        if (meta?.contractAddress !== contractAddress || meta.version !== MODERATION_REPLAY_VERSION || meta.eventCount !== events.length) {
            await clearModerationCache();
            return empty;
        }

        return { events, meta };
    } catch (error) {
        console.warn(`could not load ${MODERATION_EVENTS_STORE} content cache`, error);
        return empty;
    }
};

// Saves newly replayed events and the new meta in one transaction. replaceAll first drops every stored event.
// Returns false when nothing was saved.
export const saveModerationSync = async (events: ModerationEvent[], meta: ModerationMeta, replaceAll: boolean) => {
    try {
        const db = await getDb();
        if (!db) return false;

        const transaction = db.transaction([MODERATION_EVENTS_STORE, MODERATION_META_STORE], 'readwrite');
        const eventsStore = transaction.objectStore(MODERATION_EVENTS_STORE);

        if (replaceAll) {
            await eventsStore.clear();
        }

        await Promise.all([
            ...events.map((event) => eventsStore.put(event)),
            transaction.objectStore(MODERATION_META_STORE).put(meta),
            transaction.done,
        ]);

        return true;
    } catch (error) {
        console.warn('could not save content cache', error);
        return false;
    }
};

export const saveModerationMeta = async (meta: ModerationMeta) => {
    try {
        const db = await getDb();
        if (!db) return false;

        await db.put(MODERATION_META_STORE, meta);
        return true;
    } catch (error) {
        console.warn('could not save content cache', error);
        return false;
    }
};

export const clearModerationCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        const transaction = db.transaction([MODERATION_EVENTS_STORE, MODERATION_META_STORE], 'readwrite');
        await Promise.all([
            transaction.objectStore(MODERATION_EVENTS_STORE).clear(),
            transaction.objectStore(MODERATION_META_STORE).clear(),
            transaction.done,
        ]);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
