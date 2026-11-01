import type { PostActivityItem } from '../App.exports';
import { getDb, POST_ACTIVITY_STORE } from './db';
import { getPostActivityKey } from './utils';

export type StoredPostActivity = { key: string; owner: string; postActivity: PostActivityItem };

export const loadPostActivityCache = async (owner: string) => {
    const storedPostActivity = new Map<string, PostActivityItem>();

    try {
        const db = await getDb();
        if (!db) return storedPostActivity;

        const records: StoredPostActivity[] = await db.getAllFromIndex(POST_ACTIVITY_STORE, 'owner_idx', owner.toLowerCase());

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedPostActivity.set(record.key, record.postActivity);
        }

    } catch (error) {
        console.warn(`could not load ${POST_ACTIVITY_STORE} content cache`, error);
    }

    return storedPostActivity;
};

export const cachePostActivity = async (newPostActivity: PostActivityItem, owner: string) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(POST_ACTIVITY_STORE, { key: getPostActivityKey(newPostActivity), owner: owner.toLowerCase(), postActivity: newPostActivity });
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearPostActivityCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(POST_ACTIVITY_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
