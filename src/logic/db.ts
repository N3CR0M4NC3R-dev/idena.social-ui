import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'idena-social';
const DB_VERSION = 4;
export const POSTS_STORE = 'posts';
export const POSTERS_STORE = 'posters';
export const TIPS_STORE = 'tips';
export const MESSAGES_STORE = 'messages';
export const IGNORES_STORE = 'ignores';
export const BLOCKS_CAPTURED_RANGE_STORE = 'blocks_captured_range';
export const POST_ACTIVITY_STORE = 'post_activity';
export const MESSAGE_READ_STATUS_STORE = 'message_read_status';
export const MODERATION_EVENTS_STORE = 'moderation_events';
export const MODERATION_META_STORE = 'moderation_meta';

let dbPromise: Promise<IDBPDatabase | undefined> | undefined;

export const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, _newVersion, transaction) {
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
                if (!db.objectStoreNames.contains(POST_ACTIVITY_STORE)) {
                    const postActivityStore = db.createObjectStore(POST_ACTIVITY_STORE, { keyPath: ['key', 'owner'] });
                    postActivityStore.createIndex('owner_idx', 'owner');
                }
                if (!db.objectStoreNames.contains(MESSAGE_READ_STATUS_STORE)) {
                    const messageReadStatusStore = db.createObjectStore(MESSAGE_READ_STATUS_STORE, { keyPath: ['messageId', 'owner'] });
                    messageReadStatusStore.createIndex('owner_idx', 'owner');
                }
                // v4: the moderation contract's decoded events, and where the replay of them got to.
                if (!db.objectStoreNames.contains(MODERATION_EVENTS_STORE)) {
                    db.createObjectStore(MODERATION_EVENTS_STORE, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(MODERATION_META_STORE)) {
                    db.createObjectStore(MODERATION_META_STORE, { keyPath: 'key' });
                }
                // v3: topic posts (channelId "r/<name>") used to be ignored and left out of the captured block ranges,
                // which only list accepted transactions. Forget both so past blocks are scanned again and the topic
                // posts found. Cached posts, tips and messages are kept, so only the listing is fetched again.
                if (oldVersion >= 1 && oldVersion < 3) {
                    transaction.objectStore(IGNORES_STORE).clear();
                    transaction.objectStore(BLOCKS_CAPTURED_RANGE_STORE).clear();
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
