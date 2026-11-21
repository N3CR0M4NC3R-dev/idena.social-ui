import { getDb, IGNORES_STORE } from './db';

// owner: for a message that couldn't be read, the address whose key tried: another address may read it.
export type IgnoreItem = { txHash: string, method: string, reason: string, owner?: string };

// The ignore reason for messages from before v12, which no one can read.
export const MESSAGE_BEFORE_V12 = 'before-v12';

// Whether the scanners skip a transaction. Posts and tips are skipped for everyone, and messages from before v12;
// other messages only for the address that couldn't read them, since another address's key may. Message ignores
// saved without an owner predate owners: they're checked once more.
export const isIgnored = (ignore: IgnoreItem | undefined, address: string, messageMethod: string) => {
    if (!ignore) return false;
    if (ignore.method !== messageMethod || ignore.reason === MESSAGE_BEFORE_V12) return true;
    return ignore.owner === address.toLowerCase();
};

export const loadIgnoresCache = async () => {
    const storedIgnores = {} as Record<string, IgnoreItem>;

    try {
        const db = await getDb();
        if (!db) return storedIgnores;

        const records = await db.getAll(IGNORES_STORE);

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedIgnores[record.txHash] = record;
        }

    } catch (error) {
        console.warn(`could not load ${IGNORES_STORE} content cache`, error);
    }

    return storedIgnores;
};

export const cacheIgnore = async (newIgnore: IgnoreItem) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(IGNORES_STORE, newIgnore);
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearIgnoresCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(IGNORES_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
