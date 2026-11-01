import { getDb, MESSAGE_READ_STATUS_STORE } from './db';

export type StoredMessageReadStatus = { messageId: string; owner: string; read: boolean };

export const loadMessageReadStatusCache = async (owner: string) => {
    const storedMessageReadStatus = new Map<string, boolean>();

    try {
        const db = await getDb();
        if (!db) return storedMessageReadStatus;

        const records: StoredMessageReadStatus[] = await db.getAllFromIndex(MESSAGE_READ_STATUS_STORE, 'owner_idx', owner.toLowerCase());

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedMessageReadStatus.set(record.messageId, record.read);
        }

    } catch (error) {
        console.warn(`could not load ${MESSAGE_READ_STATUS_STORE} content cache`, error);
    }

    return storedMessageReadStatus;
};

export const cacheMessageReadStatus = async (messageId: string, read: boolean, owner: string) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(MESSAGE_READ_STATUS_STORE, { messageId, owner: owner.toLowerCase(), read });
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearMessageReadStatusCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(MESSAGE_READ_STATUS_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
