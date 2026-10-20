import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'idena-social';
const DB_VERSION = 1;
export const POSTS_STORE = 'posts';
export const POSTERS_STORE = 'posters';
export const TIPS_STORE = 'tips';
export const MESSAGES_STORE = 'messages';
export const IGNORES_STORE = 'ignores';
export const BLOCKS_CAPTURED_RANGE_STORE = 'blocks_captured_range';

let dbPromise: Promise<IDBPDatabase | undefined> | undefined;

export const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(POSTS_STORE)) {
                    db.createObjectStore(POSTS_STORE, { keyPath: 'txHash' });
                }
                if (!db.objectStoreNames.contains(TIPS_STORE)) {
                    db.createObjectStore(TIPS_STORE, { keyPath: 'txHash' });
                }
                if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
                    const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: ['txHash', 'owner'] });
                    messagesStore.createIndex('owner_idx', 'owner');
                }
                if (!db.objectStoreNames.contains(POSTERS_STORE)) {
                    db.createObjectStore(POSTERS_STORE, { keyPath: 'address' });
                }
                if (!db.objectStoreNames.contains(IGNORES_STORE)) {
                    db.createObjectStore(IGNORES_STORE, { keyPath: 'txHash' });
                }
                if (!db.objectStoreNames.contains(BLOCKS_CAPTURED_RANGE_STORE)) {
                    db.createObjectStore(BLOCKS_CAPTURED_RANGE_STORE, { keyPath: 'start_block_height' });
                }
            },
            blocking(_currentVersion, _blockedVersion, event) {
                (event.target as IDBDatabase)?.close();
                dbPromise = undefined;
            },
        }).catch((error) => {
            console.warn('indexeddb cache unavailable, falling back to memory only', error);
            return undefined;
        });
    }

    return dbPromise;
};
