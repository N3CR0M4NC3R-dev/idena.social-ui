import Decimal from "decimal.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { CallContractAttachment, contractArgumentFormat } from "idena-sdk-js-lite";
import { keccak256, sha3_256 } from "js-sha3";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const exportKeyNonceSize = 12;
const dmInfo = textEncoder.encode('idena.social/dm/v1');
const dmAlgorithm = 'secp256k1-ecdh/aes-256-gcm';

export type EncryptedEnvelopeV1 = {
    v: 1;
    alg: typeof dmAlgorithm;
    sender: string;
    recipient: string;
    senderPubkey: string;
    salt: string;
    iv: string;
    ciphertext: string;
};

export type MessageKeyState = {
    status: 'locked' | 'unlocking' | 'unlocked' | 'error';
    unlockedAddress?: string;
    error?: string;
};

export type DirectMessage = {
    txHash: string;
    timestamp: number;
    sender: string;
    recipient: string;
    channelId: string;
    replyToMessageTxId: string;
    encrypted: boolean;
    messageRef: string;
    payloadResolved: boolean;
    envelopeText?: string;
    envelope?: EncryptedEnvelopeV1;
    body?: string;
    invalidReason?: string;
    decryptError?: string;
};

export type ConversationSummary = {
    key: string;
    counterparty: string;
    latestTimestamp: number;
    lastMessageTxHash: string;
    lastMessagePreview: string;
};

type ParsedEnvelopeResult = {
    envelopeText?: string;
    envelope?: EncryptedEnvelopeV1;
    invalidReason?: string;
};

type ResolveEnvelopeResult = ParsedEnvelopeResult & { txHash: string };

type UnlockMessageKeyResult = {
    privateKey: Uint8Array;
    state: MessageKeyState;
};

type RpcClientResult<T = unknown> = {
    result?: T;
    error?: unknown;
};

type RpcClientLike = (method: string, params: unknown[], skipStateUpdate?: boolean) => Promise<RpcClientResult>;

type ParseSendMessageResult =
    | { continued: true }
    | {
        continued?: false;
        newMessage: DirectMessage;
    };

type EncryptDirectMessageInput = {
    senderPrivateKey: Uint8Array;
    senderAddress: string;
    recipientAddress: string;
    recipientPubkey: string;
    plaintext: string;
};

type DecryptDirectMessageInput = {
    activeAddress: string;
    privateKey: Uint8Array;
    message: DirectMessage;
    recipientPubkey?: string;
};

const lockedMessagePreview = 'Locked encrypted message';

function getCryptoApi() {
    const cryptoApi = globalThis.crypto;

    if (!cryptoApi?.subtle) {
        throw new Error('Web Crypto API unavailable');
    }

    return cryptoApi;
}

function normalizeHex(hex: string) {
    return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function bytesToHex(bytes: Uint8Array, prefix = false) {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return prefix ? `0x${hex}` : hex;
}

function hexToBytes(hex: string) {
    const normalizedHex = normalizeHex(hex);

    if (!normalizedHex || normalizedHex.length % 2 !== 0) {
        return new Uint8Array(0);
    }

    const bytes = new Uint8Array(normalizedHex.length / 2);

    for (let index = 0; index < normalizedHex.length; index += 2) {
        bytes[index / 2] = Number.parseInt(normalizedHex.slice(index, index + 2), 16);
    }

    return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    const base64 = typeof btoa === 'function'
        ? btoa(binary)
        : (() => {
            if (!globalThis.Buffer) {
                throw new Error('Base64 encoder unavailable');
            }

            return globalThis.Buffer.from(binary, 'binary').toString('base64');
        })();

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = typeof atob === 'function'
        ? atob(base64)
        : (() => {
            if (!globalThis.Buffer) {
                throw new Error('Base64 decoder unavailable');
            }

            return globalThis.Buffer.from(base64, 'base64').toString('binary');
        })();
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function getSharedSecretBytes(privateKey: Uint8Array, publicKey: Uint8Array) {
    return secp256k1.getSharedSecret(privateKey, publicKey, false).slice(1);
}

function toBufferSource(bytes: Uint8Array) {
    return Uint8Array.from(bytes);
}

async function deriveDmAesKey(sharedSecret: Uint8Array, salt: Uint8Array, keyUsages: KeyUsage[]) {
    const cryptoApi = getCryptoApi();
    const inputKey = await cryptoApi.subtle.importKey('raw', toBufferSource(sharedSecret), 'HKDF', false, ['deriveKey']);

    return cryptoApi.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: toBufferSource(salt),
            info: toBufferSource(dmInfo),
        },
        inputKey,
        {
            name: 'AES-GCM',
            length: 256,
        },
        false,
        keyUsages,
    );
}

export function getIdenaAddressFromPublicKey(publicKey: Uint8Array) {
    const hash = new Uint8Array(keccak256.arrayBuffer(publicKey.slice(1)));
    return normalizeAddress(bytesToHex(hash.slice(-20), true));
}

export function getIdenaAddressFromPrivateKey(privateKey: Uint8Array) {
    return getIdenaAddressFromPublicKey(secp256k1.getPublicKey(privateKey, false));
}

function isEncryptedEnvelopeV1(value: unknown): value is EncryptedEnvelopeV1 {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const envelope = value as Record<string, unknown>;

    return envelope.v === 1 &&
        envelope.alg === dmAlgorithm &&
        typeof envelope.sender === 'string' &&
        typeof envelope.recipient === 'string' &&
        typeof envelope.senderPubkey === 'string' &&
        typeof envelope.salt === 'string' &&
        typeof envelope.iv === 'string' &&
        typeof envelope.ciphertext === 'string';
}

function parseEnvelopeText(envelopeText: string, expectedSender: string): ParsedEnvelopeResult {
    try {
        const parsedEnvelope = JSON.parse(envelopeText);

        if (!isEncryptedEnvelopeV1(parsedEnvelope)) {
            return {
                envelopeText,
                invalidReason: 'Invalid encrypted envelope',
            };
        }

        const normalizedSender = normalizeAddress(parsedEnvelope.sender);
        const normalizedExpectedSender = normalizeAddress(expectedSender);
        const senderPubkeyBytes = base64UrlToBytes(parsedEnvelope.senderPubkey);

        if (normalizedSender !== normalizedExpectedSender) {
            return {
                envelopeText,
                envelope: parsedEnvelope,
                invalidReason: 'Envelope sender does not match transaction sender',
            };
        }

        if (getIdenaAddressFromPublicKey(senderPubkeyBytes) !== normalizedExpectedSender) {
            return {
                envelopeText,
                envelope: parsedEnvelope,
                invalidReason: 'Envelope sender public key is invalid',
            };
        }

        return {
            envelopeText,
            envelope: {
                ...parsedEnvelope,
                sender: normalizedSender,
                recipient: normalizeAddress(parsedEnvelope.recipient),
            },
        };
    } catch {
        return {
            envelopeText,
            invalidReason: 'Unable to parse encrypted envelope',
        };
    }
}

async function readDirectMessageEnvelopeText(messageRef: string, rpcClient: RpcClientLike) {
    if (messageRef.startsWith('ipfs://')) {
        const cid = messageRef.split('ipfs://')[1];
        const { result } = await rpcClient('ipfs_get', [cid], true);

        if (typeof result !== 'string' || !result) {
            throw new Error('Issue getting encrypted message from IPFS');
        }

        return textDecoder.decode(hexToBytes(result));
    }

    return messageRef;
}

export function normalizeAddress(address: string) {
    return address.toLowerCase();
}

export function getConversationKey(addressA: string, addressB: string) {
    return [normalizeAddress(addressA), normalizeAddress(addressB)].sort().join(':');
}

export function getConversationCounterparty(message: DirectMessage, selfAddress: string) {
    return normalizeAddress(message.sender) === normalizeAddress(selfAddress) ? message.recipient : message.sender;
}

export function getDirectMessagePreview(message: DirectMessage) {
    if (message.invalidReason) {
        return message.invalidReason;
    }

    if (message.body) {
        return message.body;
    }

    if (message.decryptError) {
        return message.decryptError;
    }

    return lockedMessagePreview;
}

export function getConversationSummaries(messages: Record<string, DirectMessage>, selfAddress: string) {
    const conversations: Record<string, ConversationSummary> = {};

    for (const message of Object.values(messages)) {
        const key = getConversationKey(message.sender, message.recipient);
        const counterparty = getConversationCounterparty(message, selfAddress);
        const existingConversation = conversations[key];

        if (!existingConversation || message.timestamp > existingConversation.latestTimestamp) {
            conversations[key] = {
                key,
                counterparty,
                latestTimestamp: message.timestamp,
                lastMessageTxHash: message.txHash,
                lastMessagePreview: getDirectMessagePreview(message),
            };
        }
    }

    return Object.values(conversations).sort((left, right) => right.latestTimestamp - left.latestTimestamp);
}

export function getConversationMessages(messages: Record<string, DirectMessage>, conversationKey: string) {
    return Object.values(messages)
        .filter((message) => getConversationKey(message.sender, message.recipient) === conversationKey)
        .sort((left, right) => left.timestamp - right.timestamp);
}

export function getSendMessageTransactionPayload(sendMessageMethod: string, recipient: string, message: string) {
    const txAmount = new Decimal(0);
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({
                recipient: normalizeAddress(recipient),
                message,
                encrypted: true,
                channelId: '',
                replyToMessageTxId: '',
            }),
        }
    ];

    const payload = new CallContractAttachment();
    payload.setArgs(args);
    payload.method = sendMessageMethod;

    return { txAmount, args, payload };
}

export function parseSendMessageEvent(
    transaction: { txHash: string, eventArgs: string[], timestamp: number },
    activeAddress: string,
): ParseSendMessageResult {
    const sender = normalizeAddress(transaction.eventArgs[0]);
    const recipient = normalizeAddress(textDecoder.decode(hexToBytes(transaction.eventArgs[1])));

    if (!activeAddress || (sender !== activeAddress && recipient !== activeAddress)) {
        return { continued: true };
    }

    return {
        newMessage: {
            txHash: transaction.txHash,
            timestamp: transaction.timestamp,
            sender,
            recipient,
            channelId: textDecoder.decode(hexToBytes(transaction.eventArgs[2])),
            messageRef: textDecoder.decode(hexToBytes(transaction.eventArgs[3])),
            encrypted: textDecoder.decode(hexToBytes(transaction.eventArgs[4])) === 'true',
            replyToMessageTxId: textDecoder.decode(hexToBytes(transaction.eventArgs[5])),
            payloadResolved: false,
        },
    };
}

export async function resolveDirectMessagePayload(
    txHash: string,
    sender: string,
    messageRef: string,
    rpcClient: RpcClientLike,
): Promise<ResolveEnvelopeResult> {
    try {
        const envelopeText = await readDirectMessageEnvelopeText(messageRef, rpcClient);
        return {
            txHash,
            ...parseEnvelopeText(envelopeText, sender),
        };
    } catch (error) {
        return {
            txHash,
            invalidReason: error instanceof Error ? error.message : 'Unable to resolve encrypted message',
        };
    }
}

export async function decryptExportedNodeKey(exportedKeyHex: string, password: string) {
    const encryptedBytes = hexToBytes(exportedKeyHex);
    const nonce = encryptedBytes.slice(0, exportKeyNonceSize);
    const ciphertext = encryptedBytes.slice(exportKeyNonceSize);
    const cryptoApi = getCryptoApi();
    const passwordHash = new Uint8Array(sha3_256.arrayBuffer(password));
    const key = await cryptoApi.subtle.importKey('raw', toBufferSource(passwordHash), 'AES-GCM', false, ['decrypt']);
    const decrypted = await cryptoApi.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: toBufferSource(nonce),
        },
        key,
        toBufferSource(ciphertext),
    );

    return new Uint8Array(decrypted);
}

export function getMessageKeyStateLocked(): MessageKeyState {
    return { status: 'locked' };
}

export function clearMessageKey(privateKey?: Uint8Array) {
    privateKey?.fill(0);
    return getMessageKeyStateLocked();
}

export async function unlockMessageKey(
    rpcClient: RpcClientLike,
    password: string,
    activeAddress: string,
): Promise<UnlockMessageKeyResult> {
    const normalizedAddress = normalizeAddress(activeAddress);
    const { result, error } = await rpcClient('dna_exportKey', [password], true);

    if (error || typeof result !== 'string' || !result) {
        throw new Error('Unable to export the node key');
    }

    const privateKey = await decryptExportedNodeKey(result, password);
    const derivedAddress = getIdenaAddressFromPrivateKey(privateKey);

    if (derivedAddress !== normalizedAddress) {
        privateKey.fill(0);
        throw new Error('Exported key does not match the active RPC account');
    }

    return {
        privateKey,
        state: {
            status: 'unlocked',
            unlockedAddress: normalizedAddress,
        },
    };
}

export async function encryptDirectMessage({
    senderPrivateKey,
    senderAddress,
    recipientAddress,
    recipientPubkey,
    plaintext,
}: EncryptDirectMessageInput) {
    const cryptoApi = getCryptoApi();
    const salt = cryptoApi.getRandomValues(new Uint8Array(32));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const recipientPubkeyBytes = hexToBytes(recipientPubkey);
    const senderPubkey = secp256k1.getPublicKey(senderPrivateKey, false);
    const sharedSecret = getSharedSecretBytes(senderPrivateKey, recipientPubkeyBytes);
    const aesKey = await deriveDmAesKey(sharedSecret, salt, ['encrypt']);
    const ciphertext = await cryptoApi.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: toBufferSource(iv),
        },
        aesKey,
        toBufferSource(textEncoder.encode(plaintext)),
    );

    return {
        v: 1,
        alg: dmAlgorithm,
        sender: normalizeAddress(senderAddress),
        recipient: normalizeAddress(recipientAddress),
        senderPubkey: bytesToBase64Url(senderPubkey),
        salt: bytesToBase64Url(salt),
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    } satisfies EncryptedEnvelopeV1;
}

export async function decryptDirectMessage({
    activeAddress,
    privateKey,
    message,
    recipientPubkey,
}: DecryptDirectMessageInput) {
    if (!message.envelope) {
        throw new Error('Encrypted envelope unavailable');
    }

    if (message.invalidReason) {
        throw new Error(message.invalidReason);
    }

    const isOutgoing = normalizeAddress(message.envelope.sender) === normalizeAddress(activeAddress);
    const peerPubkey = isOutgoing ? recipientPubkey : bytesToHex(base64UrlToBytes(message.envelope.senderPubkey));

    if (!peerPubkey) {
        throw new Error('Missing counterparty public key');
    }

    const sharedSecret = getSharedSecretBytes(privateKey, hexToBytes(peerPubkey));
    const salt = base64UrlToBytes(message.envelope.salt);
    const iv = base64UrlToBytes(message.envelope.iv);
    const ciphertext = base64UrlToBytes(message.envelope.ciphertext);
    const aesKey = await deriveDmAesKey(sharedSecret, salt, ['decrypt']);
    const cryptoApi = getCryptoApi();
    const decrypted = await cryptoApi.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: toBufferSource(iv),
        },
        aesKey,
        toBufferSource(ciphertext),
    );

    return textDecoder.decode(decrypted);
}

export function getLockedDirectMessagePlaceholder() {
    return lockedMessagePreview;
}
