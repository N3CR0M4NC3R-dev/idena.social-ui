import type { Tip } from './asyncUtils';
import { getDb, TIPS_STORE } from './db';

export const loadTipsCache = async () => {
    const storedTips = {} as Record<string, Tip>;

    try {
        const db = await getDb();
        if (!db) return storedTips;

        const records = await db.getAll(TIPS_STORE);

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedTips[record.txHash] = record;
        }

    } catch (error) {
        console.warn(`could not load ${TIPS_STORE} content cache`, error);
    }

    return storedTips;
};

export const cacheTip = async (newTip: Tip) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(TIPS_STORE, newTip);
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearTipsCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(TIPS_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
