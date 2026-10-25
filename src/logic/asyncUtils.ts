import Decimal from "decimal.js";
import imageType from 'image-type';
import isSvg from 'is-svg';
import { decrypt, encrypt } from "eciesjs";
import { calculateMaxFee, dna2num, getCallTransaction, getMakePostTransactionPayload, getSendMessageTransactionPayload, hex2str, hexToDecimal, isValidLowerCaseAddress, sanitizeStr, decryptAESGCM, extractSenderInfoFromRawTx, extractPubkeyAddressFromPrivateKey, likeEmoji } from "./utils";
import { BlockBody, CallContractAttachment, contractArgumentFormat, hexToUint8Array, toHexString, Transaction, transactionType, type ContractArgumentFormatValue, type TransactionTypeValue } from "idena-sdk-js-lite";
import ErrorLoadingMedia from '../assets/error-loading-media.png';
import type { EventTransaction } from "../App.exports";
import { keccak256, sha3_256 } from "js-sha3";
import { cacheTip } from "./tipsStore";
import { cachePoster, isPosterMissingOrStale } from "./postersStore";
import { cachePost } from "./postsStore";
import { cacheMessage } from "./messagesStore";

export const breakingChanges = {
    v3: { timestamp: 1767578641 },
    v5: { timestamp: 1767946325, block: 10219188, postIdPrefix: 'preV5:' },
    v9: { timestamp: 1775551992, block: 10604687, postIdPrefix: 'preV9:' },
    v10: { timestamp: 1775992052, block: 10627018, postIdPrefix: 'preV10:' },
    v11: { timestamp: 1777976356, block: 10727655, postIdPrefix: 'preV11:' },
    v12: { timestamp: 1781956251, block: 10929805, postIdPrefix: 'preV12:' },
};

export const supportedImageTypes = ['image/apng', 'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
export const supportedVideoTypes = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'video/mp4', 'video/webm', 'video/ogg'];

export const identityStateConversion: Record<number, string> = {
    0: 'Undefined',
    1: 'Invite',
    2: 'Candidate',
    3: 'Verified',
    4: 'Suspended',
    5: 'Killed',
    6: 'Zombie',
    7: 'Newbie',
    8: 'Human',
};

export type Post = {
    timestamp: number,
    postId: string,
    poster: string,
    posterDetails_atTimeOfPost: { stake: number, state: string, age: number },
    channelId: string,
    channelPostId: string,
    message: string,
    messageResolved: boolean,
    media: string,
    mediaResolved: boolean,
    txHash: string,
    replyToPostId: string,
    postLevel: 'Post' | 'Reply' | 'Comment',
    isLike: boolean,
    image?: File,
    video?: File,
    cid?: string,
    orphaned: boolean,
};
export type Message = {
    timestamp: number,
    txHash: string,
    messageId: string,
    sender: string,
    participants: string[], // includes sender
    conversationKey: string,
    channelId: string,
    message: string,
    messageResolved: boolean,
    media: string,
    mediaResolved: boolean,
    replyToMessageId: string,
    image?: File,
    video?: File,
    cid?: string,
    tags: string[],
    textPassword: string,
    mediaPassword: string,
    sendersDetails_atTimeOfMessage:  { stake: number, state: string, age: number },
    isLike: boolean,
    orphaned: boolean,
};

export type Poster = { address: string, stake: string, age: number, pubkey: string, state: string, robohash1?: File, robohash5?: File, fetchedAt: number };
export type Tip = { postId: string, txHash: string, timestamp: number, tipper: string, tipperDetails_atTimeOfTip: { stake: number, state: string, age: number }, amount: number, burnAmount: number };
export type PostTips = { postId: string, totalAmount: number, tips: string[] };

export type NodeDetails = { idenaNodeUrl: string, idenaNodeApiKey: string };

export const getRpcClient = (nodeDetails: NodeDetails, setNodeAvailable: React.Dispatch<React.SetStateAction<boolean>>) =>
    async (method: string, params: any[], skipStateUpdate?: boolean) => {
        try {
            const response = await fetch(nodeDetails.idenaNodeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    'method': method,
                    'params': params,
                    'id': 1,
                    'key': nodeDetails.idenaNodeApiKey
                }),
            });
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            !skipStateUpdate && setNodeAvailable(true);

            try {
                return await response.json();
            } catch (error) {
                console.error(error);
                return {};
            }
        } catch (error: unknown) {
            !skipStateUpdate && setNodeAvailable(false);
            console.error(error);
            return { error };
        }
    };
export type RpcClient = ReturnType<typeof getRpcClient>;


type GetMaxFeeData = {
        from: string,
        to: string,
        type: TransactionTypeValue,
        amount: number,
        payload: any,
}
export const getMaxFee = async (rpcClient: RpcClient, data: GetMaxFeeData) => {
    try {
        const params: any = data;
        if (data.payload) params.payload = toHexString(data.payload);
        params.useProto = true;

        const { result: getMaxFeeResult } = await rpcClient('bcn_getRawTx', [params]);

        const tx = new Transaction().fromBytes(hexToUint8Array(getMaxFeeResult));

        return tx.maxFee!.toString(10);
    } catch (error) {
        console.error(error);
        return (0).toString();
    }
};

export const getPastTxsWithIdenaIndexerApi = async (indexerApiUrl: string, contractAddress: string, limit: number, continuationToken?: string) => {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            ...(continuationToken && { continuationToken }),
        });

        const path = `api/Contract/${contractAddress}/BalanceUpdates`;

        const response = await fetch(`${indexerApiUrl}/${path}?${params}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getLastBlockWithIdenaIndexerApi = async (indexerApiUrl: string) => {
    try {
        const path = `/api/Block/Last`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getBlockAtWithIdenaIndexerApi = async (indexerApiUrl: string, blockHeight: number) => {
    try {
        const path = `api/Block/${blockHeight}`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getblockTxsWithIdenaIndexerApi = async (indexerApiUrl: string, blockHeight: number) => {
    try {
        const limit = 100;
        let continuationToken = '';

        let transactions: any[] = [];

        do {
            const params = new URLSearchParams({
                limit: limit.toString(),
                ...(continuationToken && { continuationToken }),
            });

            const path = `api/Block/${blockHeight}/Txs`;

            const response = await fetch(`${indexerApiUrl}/${path}?${params}`);

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const responseBody = await response.json();

            transactions = responseBody.result ? [ ...transactions, ...responseBody.result ] : transactions;

            continuationToken = responseBody.continuationToken ?? '';

        } while (continuationToken);

        return { result: transactions };
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getTxEventsWithIdenaIndexerApi = async (indexerApiUrl: string, txHash: string, limit: number) => {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
        });

        const path = `api/Transaction/${txHash}/Events`;

        const response = await fetch(`${indexerApiUrl}/${path}?${params}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getAddressTxsWithIdenaIndexerApi = async (indexerApiUrl: string, address: string, limit: number, continuationToken?: string) => {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            ...(continuationToken && { continuationToken }),
        });

        const path = `api/Address/${address}/Txs`;

        const response = await fetch(`${indexerApiUrl}/${path}?${params}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getRawTxWithIdenaIndexerApi = async (indexerApiUrl: string, txHash: string) => {
    try {
        const path = `api/Transaction/${txHash}/Raw`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getTxWithIdenaIndexerApi = async (indexerApiUrl: string, txHash: string) => {
    try {
        const path = `api/Transaction/${txHash}`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getAddressWithIndexerApi = async (indexerApiUrl: string, posterAddress: string) => {
    try {
        const path = `api/Address/${posterAddress}`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getIdentityWithIndexerApi = async (indexerApiUrl: string, posterAddress: string) => {
    try {
        const path = `api/Identity/${posterAddress}`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getIdentityAgeWithIndexerApi = async (indexerApiUrl: string, posterAddress: string) => {
    try {
        const path = `api/Identity/${posterAddress}/Age`;

        const response = await fetch(`${indexerApiUrl}/${path}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const responseBody = await response.json();

        return responseBody;
    } catch (error: unknown) {
        console.error(error);
        return { error };
    }
};

export const getChildPostIds = (parentId: string, postsTreeRef: Record<string, string>) => {
    const childPostIds = [];
    let childPostId;
    let index = 0;

    do {
        childPostId = postsTreeRef[`${parentId}-${index}`];
        childPostId && (childPostIds.push(childPostId));
        index++;
    } while (childPostId);

    return childPostIds;
};

export const getNewPost = async (
    transaction: EventTransaction,
    thisChannelId: string,
    discussPrefix: string,
    postsRef: React.RefObject<Record<string, Post>>,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = transaction;

    const preV3 = timestamp < breakingChanges.v3.timestamp;
    const preV5 = timestamp < breakingChanges.v5.timestamp;
    const preV9 = timestamp < breakingChanges.v9.timestamp;
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;
    const preV12 = timestamp < breakingChanges.v12.timestamp;

    if (!preV9 && !eventArgs2nd?.length) {
        return { continued: true };
    }

    const poster = eventArgs[0];
    const channelId = hex2str(eventArgs[2]);
    const message = sanitizeStr(hex2str(eventArgs[3]));
    const media = hex2str(eventArgs[6]);
    const mediaType = hex2str(eventArgs[7]);

    const postChannelRegex = new RegExp(String.raw`${discussPrefix}[\d]+$`, 'i');
    const isDiscussionComment = postChannelRegex.test(channelId);

    if (channelId !== thisChannelId && !isDiscussionComment) {
        return { continued: true };
    }

    if (!message && !(media && mediaType)) {
        return { continued: true };
    }

    let postIdRaw;
    try {
        postIdRaw = hexToDecimal(eventArgs[1]);
    } catch (error) {
        return { continued: true };
    }

    let postId = postIdRaw;

    if (preV5) {
        postId = breakingChanges.v5.postIdPrefix + postId;
    } else if (preV9) {
        postId = breakingChanges.v9.postIdPrefix + postId;
    } else if (preV10) {
        postId = breakingChanges.v10.postIdPrefix + postId;
    } else if (preV11) {
        postId = breakingChanges.v11.postIdPrefix + postId;
    } else if (preV12) {
        postId = breakingChanges.v12.postIdPrefix + postId;
    }

    if (postsRef.current[postId]) {
        return { continued: 'already-captured' };
    }

    let replyToPostIdRaw = '';
    try {
        replyToPostIdRaw = preV3 ? hexToDecimal(hex2str(eventArgs[4])) : hex2str(eventArgs[4]);
    } catch (error) {
        return { continued: true };
    }

    let replyToPostId = '';

    if (replyToPostIdRaw) {
        replyToPostId = replyToPostIdRaw;

        if (preV5) {
            replyToPostId = breakingChanges.v5.postIdPrefix + replyToPostId;
        } else if (preV9) {
            replyToPostId = breakingChanges.v9.postIdPrefix + replyToPostId;
        } else if (preV10) {
            replyToPostId = breakingChanges.v10.postIdPrefix + replyToPostId;
        } else if (preV11) {
            replyToPostId = breakingChanges.v11.postIdPrefix + replyToPostId;
        } else if (preV12) {
            replyToPostId = breakingChanges.v12.postIdPrefix + replyToPostId;
        }
    }

    if (replyToPostId) {
        const replyToPost = postsRef.current[replyToPostId];
        const newReplyExistsAndRespectsTime = replyToPost?.timestamp ? timestamp > replyToPost.timestamp : null;

        if (newReplyExistsAndRespectsTime === false) {
            return { continued: true };
        }

        if (replyToPost?.isLike) {
            return { continued: true };
        }
    }

    let posterDetails_atTimeOfPost;
    try {
        posterDetails_atTimeOfPost = !preV9 ? {
            stake: eventArgs2nd[1] === '0x' ? 0 : Number(dna2num(parseInt(eventArgs2nd[1], 16)).toFixed(0)),
            state: identityStateConversion[Number(hexToDecimal(eventArgs2nd[2]))],
            age: Number(hexToDecimal(eventArgs2nd[3])),
        } : {
            stake: NaN,
            state: 'Unknown',
            age: NaN,
        };
    } catch (error) {
        return { continued: true };
    }

    const postLevel = isDiscussionComment ? 'Comment' : replyToPostId ? 'Reply' : 'Post';
    const channelPostId = isDiscussionComment ? getPostIdFromChannelId(timestamp, channelId, discussPrefix) : '';
    
    const isLike = message === likeEmoji && !!replyToPostId;

    const newPost = {
        timestamp,
        postId,
        poster,
        posterDetails_atTimeOfPost,
        channelId,
        channelPostId,
        txHash,
        replyToPostId,
        postLevel,
        isLike,
        message,
        messageResolved: false,
        media,
        mediaResolved: false,
        orphaned: false,
    } as Post;

    await cachePost(newPost);

    return { newPost };
};

export type MessagePromise = Promise<{ id: string, message: string }>;
export const getMessage = async (id: string, message: string, rpcClient: RpcClient, textPassword?: string): MessagePromise => {
    if (message.startsWith('ipfs://')) {
        const cid = message.split('ipfs://')[1];
        const { result: getCidResult } = await rpcClient('ipfs_get', [cid], true);

        if (!getCidResult) {
            message = 'Issue loading message from IPFS';
            return { id, message };
        }

        if (textPassword) {
            // @ts-ignore: Uint8Array.fromBase64 not recognized yet
            const keyData = Uint8Array.fromBase64(textPassword);
            message = sanitizeStr(hex2str(await decryptAESGCM(getCidResult, keyData)));
        } else {
            message = sanitizeStr(hex2str(getCidResult));
        }
    }

    return { id, message };
};

export type MediaPromise = Promise<{ id: string, image: File | undefined, video: File | undefined, mediaType: string, cid: string }>;
export const getMedia = async (id: string, media: string, rpcClient: RpcClient, mediaPassword?: string) => {
    let image: File | undefined;
    let video: File | undefined;
    let mediaType = '';
    let cid = '';

    if (media.startsWith('ipfs://')) {
        cid = media.split('ipfs://')[1];
        const { result: getCidResult } = await rpcClient('ipfs_get', [cid], true);

        if (!getCidResult) {
            image = await getErrorLoadingMediaFile();
            return { id, image, video, mediaType, cid };
        }

        let bytes;
        if (mediaPassword) {
            // @ts-ignore: Uint8Array.fromBase64 not recognized yet
            const keyData = Uint8Array.fromBase64(mediaPassword);
            bytes = hexToUint8Array(await decryptAESGCM(getCidResult, keyData));
        } else {
            bytes = hexToUint8Array(getCidResult);
        }
        ({ image, video, mediaType } = await getMediaFromHex(bytes));
    } else {
        // @ts-ignore: Uint8Array.fromBase64 not recognized yet
        const bytes = Uint8Array.fromBase64(media);
        ({ image, video, mediaType } = await getMediaFromHex(bytes));
    }

    return { id, image, video, mediaType, cid };
};

const getMediaFromHex = async (bytes: Uint8Array) => {
    let image: File | undefined;
    let video: File | undefined;
    let mediaType = '';

    const bytesCopy = new Uint8Array(bytes);
    mediaType = await getMediaTypeFromBuffer(bytes) ?? '';

    const blob = new Blob([bytesCopy], { type: mediaType || 'application/octet-stream' });
    const file = new File([blob], '', { type: blob.type });
    const objectUrl = URL.createObjectURL(file);

    if (supportedImageTypes.includes(mediaType)) {
        const validImage = await isValidImageUrlCheck(objectUrl);
        if (validImage) {
            image = file;
        } else {
            image = await getErrorLoadingMediaFile();
            mediaType = 'image/png';
        }
    } else if (supportedVideoTypes.includes(mediaType)) {
        video = file;
    } else {
        image = await getErrorLoadingMediaFile();
        mediaType = 'image/png';
    }

    URL.revokeObjectURL(objectUrl);

    return { image, video, mediaType };
};

const getMediaTypeFromBuffer = async (bytes: Uint8Array) => {
    const imageTypeResult = await imageType(bytes);

    if (imageTypeResult) {
        return imageTypeResult.mime;
    } else {
        const svgString = new TextDecoder().decode(bytes);
        const isSvgResult = isSvg(svgString);

        if (isSvgResult) {
            return 'image/svg+xml';
        }
    }

    return;
};

const isValidImageUrlCheck = (url: string, wait = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();

        const process = (validImageUrl: boolean) => {
            clearTimeout(timer);

            img.onload = null;
            img.onerror = null;

            resolve(validImageUrl);
        };

        const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            // removing src aborts the in-flight image request
            img.removeAttribute('src');
            process(false);
        }, wait);

        img.onload = () => process(true);

        img.onerror = () => process(false);

        img.src = url;
    });
};

export const getErrorLoadingMediaFile = async () => {
    const response = await fetch(ErrorLoadingMedia);
    const blob = await response.blob();
    const errorLoadingMediaFile = new File([blob], 'error-loading-media.png', { type: 'image/png' });

    return errorLoadingMediaFile;
};

export const processTip = async (
    transaction: EventTransaction,
    tipsRef: React.RefObject<Record<string, Tip>>,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = transaction;

    if (tipsRef.current[txHash]) {
        return { continued: 'already-captured' };
    }

    const preV9 = timestamp < breakingChanges.v9.timestamp;
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;
    const preV12 = timestamp < breakingChanges.v12.timestamp;

    const tipper = eventArgs[0];

    const postIdEventArg = preV9 ? eventArgs[1] : eventArgs[2];

    let postIdRaw;
    try {
        postIdRaw = hexToDecimal(postIdEventArg);
    } catch (error) {
        return { continued: true };
    }

    let postId;

    if (preV9) {
        postId = breakingChanges.v9.postIdPrefix + postIdRaw;
    } else if (preV10) {
        postId = breakingChanges.v10.postIdPrefix + postIdRaw;
    } else if (preV11) {
        postId = breakingChanges.v11.postIdPrefix + postIdRaw;
    } else if (preV12) {
        postId = breakingChanges.v12.postIdPrefix + postIdRaw;
    } else {
        postId = postIdRaw;
    }
    
    const amountEventArg = preV9 ? eventArgs[2] : eventArgs[3];
    const amount = parseInt(amountEventArg, 16);

    const sentAmountEventArg = preV11 ? eventArgs[3] : eventArgs[4];
    const sentAmount = parseInt(sentAmountEventArg, 16);

    const burnAmount = sentAmount - amount;

    let tipperDetails_atTimeOfTip;
    try {
        tipperDetails_atTimeOfTip = !preV9 ? {
            stake: eventArgs2nd[1] === '0x' ? 0 : Number(dna2num(parseInt(eventArgs2nd[1], 16)).toFixed(0)),
            state: identityStateConversion[Number(hexToDecimal(eventArgs2nd[2]))],
            age: Number(hexToDecimal(eventArgs2nd[3])),
        } : {
            stake: NaN,
            state: 'Unknown',
            age: NaN,
        };
    } catch (error) {
        return { continued: true };
    }

    const newTip = {
        postId,
        txHash,
        timestamp,
        tipper,
        tipperDetails_atTimeOfTip,
        amount,
        burnAmount,
    };

    await cacheTip(newTip);

    return { newTip };
};

const postersPromised: Record<string, boolean> = {};
export const getPosterPromise = (
    address: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    useIndexer: boolean,
    rpcClient?: RpcClient,
    indexerApiUrlRef?: React.RefObject<string>,
) => {
    const poster = postersRef.current[address];
    if (isPosterMissingOrStale(poster) && !postersPromised[address]) {
        postersPromised[address] = true;
        const posterPromise = (useIndexer ? getPosterWithIndexerApi(indexerApiUrlRef!.current, address) : getPosterWithRpc(rpcClient!, address)) as Promise<Poster>;
        return posterPromise
            .then((newPoster) => {
                postersRef.current = { ...postersRef.current, [address]: newPoster };
                cachePoster(newPoster);
                return newPoster;
            })
            .finally(() => postersPromised[address] = false);
    }
    return poster;
};

export const getPosterWithRpc = async (rpcClient: RpcClient, posterAddress: string, skipStateUpdate?: boolean) => {
    const { result: getDnaIdentityResult, error: getDnaIdentityError } = await rpcClient('dna_identity', [posterAddress], skipStateUpdate);

    if (!skipStateUpdate && getDnaIdentityError) {
        throw 'rpc unavailable';
    }

    if (!getDnaIdentityResult) {
        return;
    }

    const { address, stake, age, pubkey, state } = getDnaIdentityResult;

    const [ robohash1, robohash5 ] = await Promise.all([getRobohash(address, '1'), getRobohash(address, '5')]);

    return { address, stake, age, pubkey, state, robohash1, robohash5, fetchedAt: Date.now() };
};

export const getPosterWithIndexerApi = async (indexerApiUrl: string, posterAddress: string) => {
    const getAddressPromise = getAddressWithIndexerApi(indexerApiUrl, posterAddress);
    const getIdentityPromise = getIdentityWithIndexerApi(indexerApiUrl, posterAddress); // error no identity found...
    const getIdentityAgePromise = getIdentityAgeWithIndexerApi(indexerApiUrl, posterAddress); // result: 0

    const resolvedPromises = await Promise.all([getAddressPromise, getIdentityPromise, getIdentityAgePromise]);

    if (resolvedPromises[0].error) {
        return;
    }

    if (resolvedPromises[1].error) {
        resolvedPromises[1] = { result: { state: 'Not validated' } };
    }

    if (resolvedPromises[2].error) {
        resolvedPromises[2] = { result: 0 };
    }

    const { result: { address: addressRaw, stake } } = resolvedPromises[0];
    const { result: { state } } = resolvedPromises[1];
    const { result: age } = resolvedPromises[2];

    const address = addressRaw.toLowerCase();

    const pubkey = await getPubkeyWithIdenaIndexerApi(indexerApiUrl, posterAddress) ?? '';

    const [ robohash1, robohash5 ] = await Promise.all([getRobohash(address, '1'), getRobohash(address, '5')]);

    return { address, stake, age, pubkey, state, robohash1, robohash5, fetchedAt: Date.now() };
};

export const getRobohash = async (address: string, setNumber: string) => {
    try {
        const profilePicResponse = await fetch(`https://robohash.org/${address}?set=set${setNumber}`);

        if (!profilePicResponse.ok) {
            return undefined;
        }

        const blob = await profilePicResponse.blob();

        return new File([blob], `robohash${setNumber}-${address}`, { type: blob.type });
    } catch {
        return undefined;
    }
};

export const processMessage = async (
    message: EventTransaction,
    encryptedPrivateKey: string,
    password: string,
    postersAddress: string,
    messagesRef: React.RefObject<Record<string, Message>>,
    thisChannelId: string,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = message;

    if (!eventArgs2nd?.length) {
        return { continued: true };
    }

    const sender = eventArgs[0];

    let newMessageId;
    try {
        newMessageId = hexToDecimal(eventArgs[1]);
    } catch (error) {
        return { continued: true };
    }

    const messageEventRaw = hex2str(eventArgs[2]);

    if (!messageEventRaw) {
        return { continued: true };
    }

    const messageEventHash = hex2str(eventArgs[3]);
    if (!messageEventHash) {
        return { continued: true };
    }

    const encrypted = hex2str(eventArgs[4]);
    if (encrypted !== 'true') {
        return { continued: true };
    }

    const messageEvent = messageEventRaw.split(',');

    if (messageEvent.length < 2) {
        return { continued: true };
    }

    const keyData = new Uint8Array(sha3_256.array(password));
    const myPrivateKey = await decryptAESGCM(encryptedPrivateKey, keyData);
    const myPrivateKeyBytes = hexToUint8Array(myPrivateKey);

    const iAmSender = sender === postersAddress.toLowerCase();

    let messageDecoded: string | undefined;
    const decryptSuccesses: number[] = [];

    for (let index = 0; index < messageEvent.length; index++) {
        // @ts-ignore: Uint8Array.fromBase64 not recognized yet
        const encryptedMessage = Uint8Array.fromBase64(messageEvent[index]);
        
        try {
            const myMessageDecrypted = await decrypt(myPrivateKeyBytes, encryptedMessage);
            decryptSuccesses.push(index);

            if (decryptSuccesses.length > 1 && messageEvent.length > 2) {
                return { continued: true };
            }

            messageDecoded = new TextDecoder().decode(myMessageDecrypted);

            const rawMessageHash = keccak256(messageDecoded);

            if (rawMessageHash !== messageEventHash) {
                return { continued: true };
            }
        } catch (error) {
            if (index === 0 && iAmSender) {
                return { continued: true };
            }
        }
    }

    if (!decryptSuccesses.length) {
        return { continued: true };
    }

    const [ participantsRaw, channelId, inputText, textPassword, replyToMessageId, mediaArray, mediaTypeArray, mediaPassword, tags ] = JSON.parse(messageDecoded!);

    const media = mediaArray[0] ?? '';
    const mediaType = mediaTypeArray[0] ?? '';

    const sanitizedInputText = sanitizeStr(inputText);

    if (!sanitizedInputText && !(media && mediaType)) {
        return { continued: true };
    }

    if (messagesRef.current[newMessageId]) {
        return { continued: 'already-captured' };
    }

    if (channelId !== thisChannelId) {
        return { continued: true };
    }

    if (replyToMessageId && parseInt(replyToMessageId) >= parseInt(newMessageId)) {
        return { continued: true };
    }

    if (replyToMessageId && messagesRef.current[replyToMessageId]?.isLike) {
        return { continued: true };
    }

    if (participantsRaw.length !== messageEvent.length) {
        return { continued: true };
    }

    if (participantsRaw[0] !== sender) {
        return { continued: true };
    }

    if (participantsRaw.length > 2 && new Set(participantsRaw).size !== participantsRaw.length) {
        return { continued: true };
    }

    for (let index = 0; index < participantsRaw.length; index++) {
        const participant = participantsRaw[index];

        if (!isValidLowerCaseAddress(participant)) {
            return { continued: true };
        }
    }

    const selfParticipants = participantsRaw.filter((participant: string) => participant === postersAddress.toLowerCase());
    if (selfParticipants.length !== decryptSuccesses.length) {
        return { continued: true };
    }

    for (let index = 0; index < decryptSuccesses.length; index++) {
        const jindex = decryptSuccesses[index];

        if (participantsRaw[jindex] !== postersAddress.toLowerCase()) {
            return { continued: true };
        }
    }

    const participants = participantsRaw.map((item: string) => item.toLowerCase()).sort();
    const conversationKey = keccak256(participants.join('-'));

    let sendersDetails_atTimeOfMessage;
    try {
        sendersDetails_atTimeOfMessage = {
            stake: eventArgs2nd[1] === '0x' ? 0 : Number(dna2num(parseInt(eventArgs2nd[1], 16)).toFixed(0)),
            state: identityStateConversion[Number(hexToDecimal(eventArgs2nd[2]))],
            age: Number(hexToDecimal(eventArgs2nd[3])),
        };
    } catch (error) {
        return { continued: true };
    }

    const isLike = sanitizedInputText === likeEmoji && !!replyToMessageId;

    const newMessage = {
        timestamp,
        txHash,
        messageId: newMessageId,
        message: sanitizedInputText,
        messageResolved: false,
        media,
        mediaResolved: false,
        sender,
        participants,
        conversationKey,
        channelId,
        replyToMessageId,
        tags,
        textPassword,
        mediaPassword,
        sendersDetails_atTimeOfMessage,
        isLike,
    } as Message;

    await cacheMessage(newMessage, postersAddress, encryptedPrivateKey, password);

    return { newMessage };
};

export const saveReplyPostId = (
    newReplyPostId: string,
    replyToPostId: string,
    replyToPost: Post | Message,
    isRecurseForward: boolean,
    replyPostsTreeRef: Record<string, string>,
    forwardOrphanedReplyPostsTreeRef: Record<string, string>,
    backwardOrphanedReplyPostsTreeRef: Record<string, string>,
    newReplyPosts: Record<string, string>,
    newForwardOrphanedReplyPosts: Record<string, string>,
    newBackwardOrphanedReplyPosts: Record<string, string>,
) => {
    if (replyToPostId) {
        if (!replyToPost || replyToPost.orphaned) {
            if (isRecurseForward) {
                const childPostIds = getChildPostIds(replyToPostId, forwardOrphanedReplyPostsTreeRef);
                newForwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newReplyPostId;
            } else {
                const childPostIds = getChildPostIds(replyToPostId, backwardOrphanedReplyPostsTreeRef);
                newBackwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newReplyPostId;
            }
        } else {
            const childPostIds = getChildPostIds(replyToPostId, replyPostsTreeRef);
            newReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newReplyPostId;
        }
    }
};

export const deOrphanReplyPosts = (
    parentId: string,
    parentPost: Post | Message,
    forwardOrphanedReplyPostsTreeRef: Record<string, string>,
    backwardOrphanedReplyPostsTreeRef: Record<string, string>,
    postsRef: Record<string, Post> | Record<string, Message>,
    newForwardOrphanedReplyPosts: Record<string, string>,
    newBackwardOrphanedReplyPosts: Record<string, string>,
    newDeOrphanedReplyPosts: Record<string, string>,
    newPosts: Record<string, Post> | Record<string, Message>,
) => {
    const newForwardDeOrphanedIds = getChildPostIds(parentId, forwardOrphanedReplyPostsTreeRef).map((deOrphanedId, index) => ({ recurseForward: true, oldKey: `${parentId}-${index}`, deOrphanedId }));
    const newBackwardDeOrphanedIds = getChildPostIds(parentId, backwardOrphanedReplyPostsTreeRef).map((deOrphanedId, index) => ({ recurseForward: false, oldKey: `${parentId}-${index}`, deOrphanedId }));

    const childDetailsOrdered = [ ...newForwardDeOrphanedIds.reverse(), ...newBackwardDeOrphanedIds ];

    for (let index = 0; index < childDetailsOrdered.length; index++) {
        const newKey = `${parentId}-${index}`;
        const childDetails = childDetailsOrdered[index];

        if (childDetails.recurseForward) {
            newForwardOrphanedReplyPosts[childDetails.oldKey] = '';
        } else {
            newBackwardOrphanedReplyPosts[childDetails.oldKey] = '';
        }

        if (parentPost.isLike) {
            newPosts[childDetails.deOrphanedId] = undefined as unknown as (Post | Message);
            continue;
        }

        newDeOrphanedReplyPosts[newKey] = childDetails.deOrphanedId;
        newPosts[childDetails.deOrphanedId] = { ...postsRef[childDetails.deOrphanedId], orphaned: false };
    }
};

export const copyPostTx = async (
    postersAddress: string,
    contractAddress: string,
    makePostMethod: string,
    inputPost: string,
    media: string[],
    mediaType: string[],
    replyToPostId: string | null,
    channelId: string | null,
    rpcClient: RpcClient,
) => {
    const { txAmount, payload } = getMakePostTransactionPayload(makePostMethod, inputPost, replyToPostId, channelId, media, mediaType);
    const inputPostLength = inputPost.length + JSON.stringify(media).length;
    const maxFeeResult = await getMaxFee(rpcClient, { from: postersAddress, to: contractAddress, type: transactionType.CallContractTx, amount: txAmount.toNumber(), payload });
    const { maxFeeDna } = calculateMaxFee(maxFeeResult, inputPostLength);
    const { nonce, epoch } = await getNonceAndEpoch(rpcClient, postersAddress);
    const txHex = getCallTransaction(contractAddress, txAmount, nonce, epoch, maxFeeDna, payload);

    try {
        await navigator.clipboard.writeText(txHex);
        return { success: true };
    } catch (err) {
        console.error('Failed to copy: ', err);
        return { success: false };
    }
};

export const submitPost = async (
    postersAddress: string,
    contractAddress: string,
    makePostMethod: string,
    inputPost: string,
    media: string[],
    mediaType: string[],
    replyToPostId: string | null,
    channelId: string | null,
    makePostsWith: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const { txAmount, args, payload } = getMakePostTransactionPayload(makePostMethod, inputPost, replyToPostId, channelId, media, mediaType);
    const inputPostLength = inputPost.length + JSON.stringify(media).length;

    await makeCallTransaction(
        postersAddress,
        contractAddress,
        makePostMethod,
        makePostsWith,
        rpcClient,
        callbackUrl,
        txAmount,
        args,
        payload,
        inputPostLength,
    );
};

export const submitSendTip = async (
    postersAddress: string,
    contractAddress: string,
    sendTipMethod: string,
    postId: string,
    amount: string,
    makePostsWith: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const txAmount = new Decimal(amount);
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({ postId, tipAmount: amount }),
        }
    ];
    const payload = new CallContractAttachment();
    payload.setArgs(args);
    payload.method = sendTipMethod;

    await makeCallTransaction(
        postersAddress,
        contractAddress,
        sendTipMethod,
        makePostsWith,
        rpcClient,
        callbackUrl,
        txAmount,
        args,
        payload,
    );
};

export const copyMessageTx = async (
    postersAddress: string,
    contractAddress: string,
    sendMessageMethod: string,
    inputMessage: string[],
    inputMessageHash: string,
    rpcClient: RpcClient,
) => {
    const { txAmount, payload } = getSendMessageTransactionPayload(sendMessageMethod, inputMessage, inputMessageHash);
    const inputMessageLength = JSON.stringify(inputMessage).length + inputMessageHash.length;
    const maxFeeResult = await getMaxFee(rpcClient, { from: postersAddress, to: contractAddress, type: transactionType.CallContractTx, amount: txAmount.toNumber(), payload });
    const { maxFeeDna } = calculateMaxFee(maxFeeResult, inputMessageLength);
    const { nonce, epoch } = await getNonceAndEpoch(rpcClient, postersAddress);
    const txHex = getCallTransaction(contractAddress, txAmount, nonce, epoch, maxFeeDna, payload);

    try {
        await navigator.clipboard.writeText(txHex);
        return { success: true };
    } catch (err) {
        console.error('Failed to copy: ', err);
        return { success: false };
    }
};

export const submitMessage = async (
    postersAddress: string,
    contractAddress: string,
    sendMessageMethod: string,
    inputMessage: string[],
    inputMessageHash: string,
    makePostsWith: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const { txAmount, args, payload } = getSendMessageTransactionPayload(sendMessageMethod, inputMessage, inputMessageHash);
    const inputMessageLength = JSON.stringify(inputMessage).length + inputMessageHash.length;

    await makeCallTransaction(
        postersAddress,
        contractAddress,
        sendMessageMethod,
        makePostsWith,
        rpcClient,
        callbackUrl,
        txAmount,
        args,
        payload,
        inputMessageLength,
    );
};

type CallContractArg = {
    format: ContractArgumentFormatValue;
    index: number;
    value: string;
};
export const makeCallTransaction = async (
    from: string,
    to: string,
    method: string,
    makePostsWith: string,
    rpcClient: RpcClient,
    callbackUrl: string,
    txAmount: Decimal,
    args: CallContractArg[],
    payload: CallContractAttachment,
    inputPostLength = 0,
) => {
    const maxFeeResult = await getMaxFee(rpcClient, {
        from,
        to,
        type: transactionType.CallContractTx,
        amount: txAmount.toNumber(),
        payload,
    });

    const { maxFeeDecimal, maxFeeDna } = calculateMaxFee(maxFeeResult, inputPostLength);

    if (makePostsWith === 'rpc') {
        await rpcClient('contract_call', [
            {
                from,
                contract: to,
                method,
                amount: txAmount.toNumber(),
                args,
                maxFee: maxFeeDecimal,
            }
        ]);
    }

    if (makePostsWith === 'idena-app') {
        const { nonce, epoch } = await getNonceAndEpoch(rpcClient, from);

        const txHex = getCallTransaction(to, txAmount, nonce, epoch, maxFeeDna, payload);

        const dnaLink = `https://app.idena.io/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${method}`;
        window.open(dnaLink, '_blank');
    }
};

export const getNonceAndEpoch = async (rpcClient: RpcClient, address: string) => {
    const responses = await Promise.all([rpcClient('dna_getBalance', [address]), rpcClient('dna_epoch', [])]);

    const { result: getBalanceResult } = responses[0];
    const { result: epochResult } = responses[1];

    return { nonce: getBalanceResult.mempoolNonce + 1, epoch: epochResult.epoch as number };
};

export const storeFileToIpfs = async (rpcClient: RpcClient, bytes: Uint8Array, address: string) => {
    const fileHexData = toHexString(bytes);

    const { result: cid } = await rpcClient('ipfs_add', [fileHexData, true], true);

    if (!cid) {
        return;
    };

    const { nonce, epoch } = await getNonceAndEpoch(rpcClient, address);
    const { result: storeToIpfsResult } = await rpcClient('dna_storeToIpfs', [{ cid, nonce, epoch }]);

    if (!storeToIpfsResult) return;

    return `ipfs://${cid}`;
};

export const getPostIdFromChannelId = (timestamp: number, channelId: string, discussPrefix: string) => {
    const preV9 = timestamp < breakingChanges.v9.timestamp;
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;
    const preV12 = timestamp < breakingChanges.v12.timestamp;
    const discussionPostIdRaw = channelId.split(discussPrefix)[1];

    let discussionPostId;

    if (preV9) {
        discussionPostId = breakingChanges.v9.postIdPrefix + discussionPostIdRaw;
    } else if (preV10) {
        discussionPostId = breakingChanges.v10.postIdPrefix + discussionPostIdRaw;
    } else if (preV11) {
        discussionPostId = breakingChanges.v11.postIdPrefix + discussionPostIdRaw;
    } else if (preV12) {
        discussionPostId = breakingChanges.v12.postIdPrefix + discussionPostIdRaw;
    } else {
        discussionPostId = discussionPostIdRaw;
    }

    return discussionPostId;
};

export const getNewPostLatestActivity = (
    isRecurseForward: boolean,
    newPost: Post,
    postsRef: React.RefObject<Record<string, Post>>,
    postLatestActivityRef: React.RefObject<Record<string, number>>,
) => {
    const newPostLatestActivity: Record<string, number> = {};

    if (isRecurseForward) {
        let loopPost: Post | undefined = newPost;

        while (loopPost) {
            newPostLatestActivity[loopPost!.postId] = newPost!.timestamp;

            const replyToPostId: string = loopPost!.replyToPostId;
            const postLevel = loopPost!.postLevel;

            if (replyToPostId) {
                loopPost = postsRef.current[replyToPostId];
            } else if (postLevel === 'Comment') {
                const discussionPostId = loopPost!.channelPostId as string;
                loopPost = postsRef.current[discussionPostId];
            } else {
                loopPost = undefined;
            }
        }
    } else {
        let newTimestamp = postLatestActivityRef.current[newPost!.postId] ?? newPost!.timestamp;
        postLatestActivityRef.current[newPost!.postId] = newTimestamp;

        const replyToPostId = newPost!.replyToPostId;
        const postLevel = newPost!.postLevel;

        if (replyToPostId) {
            newTimestamp = (postLatestActivityRef.current[replyToPostId] ?? 0) > newTimestamp ? postLatestActivityRef.current[replyToPostId] : newTimestamp;
            newPostLatestActivity[replyToPostId] = newTimestamp;
        } else if (postLevel === 'Comment') {
            const discussionPostId = newPost!.channelPostId;
            newTimestamp = (postLatestActivityRef.current[discussionPostId] ?? 0) > newTimestamp ? postLatestActivityRef.current[discussionPostId] : newTimestamp;
            newPostLatestActivity[discussionPostId] = newTimestamp;
        }
    }

    return newPostLatestActivity;
};

export const resolveNewTextForPosts = async (
    textPromises: MessagePromise[],
    postsRef: React.RefObject<Record<string, Post>>,
) => {
    const texts = await Promise.all(textPromises);
    for (let index = 0; index < texts.length; index++) {
        const { id, ...messagesPropsWithoutId } = texts[index];
        const updatedPost = { ...postsRef!.current[id], ...messagesPropsWithoutId, messageResolved: true };
        await cachePost(updatedPost as Post);
        postsRef!.current = { ...postsRef!.current, [id]: updatedPost };
    }
};

export const resolveNewTextForMessages = async (
    textPromises: MessagePromise[],
    postersAddress: string,
    encryptedPrivateKey: string,
    password: string,
    messagesRef: React.RefObject<Record<string, Message>>,
) => {
    const texts = await Promise.all(textPromises);
    for (let index = 0; index < texts.length; index++) {
        const { id, ...messagesPropsWithoutId } = texts[index];
        const updatedMessage = { ...messagesRef!.current[id], ...messagesPropsWithoutId, messageResolved: true };
        await cacheMessage(updatedMessage, postersAddress, encryptedPrivateKey, password);
        messagesRef!.current = { ...messagesRef!.current, [id]: updatedMessage };
    }
};

export const resolveNewMediaForPosts = async (
    mediaPromises: MediaPromise[],
    postsRef: React.RefObject<Record<string, Post>>,
) => {
    const media = await Promise.all(mediaPromises);
    for (let index = 0; index < media.length; index++) {
        const { id, ...messagesPropsWithoutId } = media[index];
        const updatedPost = { ...postsRef!.current[id], ...messagesPropsWithoutId, mediaResolved: true };
        await cachePost(updatedPost as Post);
        postsRef!.current = { ...postsRef!.current, [id]: updatedPost };
    }
};

export const resolveNewMediaForMessages = async (
    mediaPromises: MediaPromise[],
    postersAddress: string,
    encryptedPrivateKey: string,
    password: string,
    messagesRef: React.RefObject<Record<string, Message>>,
) => {
    const media = await Promise.all(mediaPromises);
    for (let index = 0; index < media.length; index++) {
        const { id, ...messagesPropsWithoutId } = media[index];
        const updatedMessage = { ...messagesRef!.current[id], ...messagesPropsWithoutId, mediaResolved: true };
        await cacheMessage(updatedMessage, postersAddress, encryptedPrivateKey, password);
        messagesRef!.current = { ...messagesRef!.current, [id]: updatedMessage };
    }
};

export const getPubkeyWithIdenaIndexerApi = async (indexerApiUrl: string, address: string) => {
    let pubkey = '';
    const limit = 100;
    let continuationToken = '';
    let txHash;

    outerLoop: do {
        const { result: getAddressTxsResult, error: getAddressTxsError, continuationToken: continuationTokenCurrent } = await getAddressTxsWithIdenaIndexerApi(indexerApiUrl, address, limit, continuationToken);
        
        if (!getAddressTxsError && getAddressTxsResult?.length) {
            for (let index = 0; index < getAddressTxsResult.length; index++) {
                const tx = getAddressTxsResult[index];
                if (tx.from.toLowerCase() === address.toLowerCase()) {
                    txHash = tx.hash;
                    break outerLoop;
                }
            }
        } else {
            break;
        }

        continuationToken = continuationTokenCurrent ?? '';

    } while (continuationToken);

    if (txHash) {
        const { result: getRawTxResult, error: getRawTxError } = await getRawTxWithIdenaIndexerApi(indexerApiUrl, txHash);

        if (!getRawTxError && getRawTxResult) {
            try {
                pubkey = extractSenderInfoFromRawTx(getRawTxResult).pubkey ?? '';
            } catch (error) {
                // do nothing
            }
        }
    }

    return pubkey;
};

export const getPubkeyWithRpc = async (rpcClient: RpcClient, address: string) => {
    let pubkey = '';
    const count = 100;
    let token;
    let txHash;
    let blockHash;

    outerLoop: do {
        const { result: getTransactionsResult, error: getTransactionsError } = await rpcClient('bcn_transactions', [{ address, count, ...(token && { token }) }], true);

        if (!getTransactionsError && getTransactionsResult.transactions?.length) {
            for (let index = 0; index < getTransactionsResult.transactions.length; index++) {
                const tx = getTransactionsResult.transactions[index];
                if (tx.from.toLowerCase() === address.toLowerCase()) {
                    txHash = tx.hash;
                    blockHash = tx.blockHash;
                    break outerLoop;
                }
            }
        } else {
            break;
        }

        token = getTransactionsResult.token;

    } while (token);

    let ipfsCid;
    let txIndex;
    let blockBodyData;

    if (txHash && blockHash) {
        const { result: getBlockResult, error: getBlockError } = await rpcClient('bcn_block', [blockHash], true);

        if (!getBlockError && getBlockResult) {
            ipfsCid = getBlockResult.ipfsCid;
            txIndex = getBlockResult.transactions.findIndex((item: string) => item === txHash);
        }

        if (ipfsCid && txIndex > -1) {
            ({ result: blockBodyData } = await rpcClient('ipfs_get', [ipfsCid], true));
        }

        if (blockBodyData) {
            const blockBody = BlockBody.fromHex(blockBodyData);
            const transaction = blockBody.transactions[txIndex];
            pubkey = transaction.senderPubKey ?? '';
        }
    }

    return pubkey;
};

export const encryptRecipientsMessage = async (
    postersAddress: string,
    recipients: string[],
    inputText: string,
    textPassword: string,
    media: string[],
    mediaType: string[],
    mediaPassword: string,
    encryptedPrivateKey: string,
    password: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyToMessageId?: string,
) => {
    // [participants, channelId, message, textPassword (AES-GCM encryption), replyToMessageId, media, mediaType, mediaPassword (AES-GCM encryption), tags]
    const rawMessage = JSON.stringify([[postersAddress.toLowerCase(), ...recipients], '', inputText, textPassword, replyToMessageId ?? '', media, mediaType, mediaPassword, []]);
    const rawMessageHash = keccak256(rawMessage);

    const { encryptedMessage, encodedMessage } = await encryptTextWithPrivateKey(rawMessage, encryptedPrivateKey, password);

    const message = [encryptedMessage];

    for (let index = 0; index < recipients.length; index++) {
        const recipient = recipients[index];
        const recipientDetails = postersRef.current[recipient];

        const recipientEncryptedMessage = await encrypt(hexToUint8Array(recipientDetails.pubkey), encodedMessage);
        // @ts-ignore: Uint8Array.toBase64 not recognized yet
        const recipientSerializedEncryptedMessage = recipientEncryptedMessage.toBase64();

        message.push(recipientSerializedEncryptedMessage);
    }

    return { message, rawMessageHash };
};

export const encryptTextWithPrivateKey = async (text: string, encryptedPrivateKey: string, password: string) => {
    const encodedMessage = new TextEncoder().encode(text);
    const keyData = new Uint8Array(sha3_256.array(password));
    const myPrivateKey = await decryptAESGCM(encryptedPrivateKey, keyData);
    const { pubkey: myPubkey } = extractPubkeyAddressFromPrivateKey(myPrivateKey);
    const myEncryptedMessage = await encrypt(hexToUint8Array(myPubkey), encodedMessage);
    // @ts-ignore: Uint8Array.toBase64 not recognized yet
    return { encryptedMessage: myEncryptedMessage.toBase64(), encodedMessage };
};

export const decryptTextWithPrivateKey = async (text: string, encryptedPrivateKey: string, password: string) => {
    const keyData = new Uint8Array(sha3_256.array(password));
    const myPrivateKey = await decryptAESGCM(encryptedPrivateKey, keyData);
    const myPrivateKeyBytes = hexToUint8Array(myPrivateKey);
    // @ts-ignore: Uint8Array.fromBase64 not recognized yet
    const encryptedMessage = Uint8Array.fromBase64(text);
    const myMessageDecrypted = await decrypt(myPrivateKeyBytes, encryptedMessage);
    return (new TextDecoder()).decode(myMessageDecrypted);
};
