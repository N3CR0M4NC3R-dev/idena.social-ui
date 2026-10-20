import type { Post } from './asyncUtils';
import { getDb, POSTS_STORE } from './db';

export const loadPostsCache = async () => {
    const storedPosts = {} as Record<string, Post>;

    try {
        const db = await getDb();
        if (!db) return storedPosts;

        const records = await db.getAll(POSTS_STORE);

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedPosts[record.txHash] = record;
        }

    } catch (error) {
        console.warn(`could not load ${POSTS_STORE} content cache`, error);
    }

    return storedPosts;
};

export const cachePost = async (newPost: Post) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(POSTS_STORE, newPost);
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearPostsCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(POSTS_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
