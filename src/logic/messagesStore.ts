import { decryptTextWithPrivateKey, encryptTextWithPrivateKey, type Message } from './asyncUtils';
import { getDb, MESSAGES_STORE } from './db';

export type StoredMessage = { txHash: string; owner: string; encryptedMessage: string };

let loadedMessagesOwner = '';

export const loadMessagesCache = async (owner: string, encryptedPrivateKey: string, password: string) => {
    const messagesOwner = owner.toLowerCase();

    if (loadedMessagesOwner === messagesOwner) return;

    loadedMessagesOwner = messagesOwner;

    const storedMessages = {} as Record<string, Message>;

    try {
        const db = await getDb();
        if (!db) return storedMessages;

        const records = await db.getAllFromIndex(MESSAGES_STORE, 'owner_idx', owner);

        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            const stringifiedMessage = await decryptTextWithPrivateKey(record.encryptedMessage, encryptedPrivateKey, password);
            storedMessages[record.txHash] = JSON.parse(stringifiedMessage);
        }

    } catch (error) {
        console.warn(`could not load ${MESSAGES_STORE} content cache`, error);
    }

    if (loadedMessagesOwner !== messagesOwner) return;

    return storedMessages;
};

export const cacheMessage = async (newMessage: Message, owner: string, encryptedPrivateKey: string, password: string) => {
    try {
        const db = await getDb();
        if (!db) return;

        const stringifiedMessage = JSON.stringify(newMessage);
        const { encryptedMessage } = await encryptTextWithPrivateKey(stringifiedMessage, encryptedPrivateKey, password);

        await db.put(MESSAGES_STORE, { txHash: newMessage.txHash, owner, encryptedMessage });
    } catch (error) {
        console.warn('could not save content cache', error);
    }
};

export const clearMessagesCache = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(MESSAGES_STORE);
    } catch (error) {
        console.warn('could not clear content caches', error);
    }
};
