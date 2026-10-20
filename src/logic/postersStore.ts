import type { Poster } from './asyncUtils';
import { getDb, POSTERS_STORE } from './db';

export const POSTER_TTL_MS = 24 * 60 * 60 * 1000;

export const loadPostersCache = async () => {
    const storedPosters = {} as Record<string, Poster>;

    try {
        const db = await getDb();
        if (!db) return storedPosters;

        const records = await db.getAll(POSTERS_STORE);

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            storedPosters[record.address] = record;
        }

    } catch (error) {
        console.warn(`could not load ${POSTERS_STORE} content cache`, error);
    }

    return storedPosters;
};

export const cachePoster = async (newPoster: Poster) => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.put(POSTERS_STORE, newPoster);
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearPostersCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(POSTERS_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};

export const isPosterMissingOrStale = (poster?: Poster) => {
    return !poster?.address || !poster.fetchedAt || Date.now() - poster.fetchedAt > POSTER_TTL_MS;
};
