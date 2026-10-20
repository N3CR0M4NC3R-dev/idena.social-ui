import { getDb, IGNORES_STORE } from './db';

export type IgnoreItem = { txHash: string, method: string, reason: string };

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
