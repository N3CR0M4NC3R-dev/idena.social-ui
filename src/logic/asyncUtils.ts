import Decimal from "decimal.js";
import { calculateMaxFee, calculateNonce, dna2num, dnaBase, hex2str, hexToDecimal, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, toHexString, Transaction, transactionType, type ContractArgumentFormatValue, type TransactionTypeValue } from "idena-sdk-js-lite";
import ErrorLoadingMedia from '../assets/error-loading-media.png';

export const breakingChanges = {
    v3: { timestamp: 1767578641 },
    v5: { timestamp: 1767946325, block: 10219188, postIdPrefix: 'preV5:' },
    v9: { timestamp: 1775551992, block: 10604687, postIdPrefix: 'preV9:' },
};

export const supportedImageTypes = ['image/apng', 'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
export const supportedVideoTypes = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'video/mp4', 'video/webm', 'video/ogg'];

const identityStateConversion: Record<number, string> = {
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
    message?: string,
    txHash: string,
    replyToPostId: string,
    image?: string,
    video?: string,
    orphaned: boolean,
};
export type Poster = { address: string, stake: string, age: number, pubkey: string, state: string };
export type Tip = { postId: string, txHash: string, timestamp: number, tipper: string, tipperDetails_atTimeOfTip: { stake: number, state: string, age: number }, amount: number };
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

export const getPastTxsWithIdenaIndexerApi = async (inputIdenaIndexerApiUrl: string, contractAddress: string, limit: number, continuationToken?: string) => {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            ...(continuationToken && { continuationToken }),
        });

        const path = `api/Contract/${contractAddress}/BalanceUpdates`;

        const response = await fetch(`${inputIdenaIndexerApiUrl}/${path}?${params}`);

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

type GetTransactionDetailsInput = { txHash: string, timestamp: number, blockHeight?: number };
export const getTransactionDetails = async (
    transactions: GetTransactionDetailsInput[],
    contractAddress: string,
    methods: string[],
    rpcClient: RpcClient,
) => {
    const transactionReceipts = await Promise.all(transactions.map((transaction) => rpcClient('bcn_txReceipt', [transaction.txHash])));

    const filteredReceipts = transactionReceipts.filter((receipt) =>
        (receipt.error && (() => { throw 'rpc unavailable' })()) ||
        receipt.result &&
        receipt.result.success === true &&
        receipt.result.contract === contractAddress.toLowerCase() &&
        methods.includes(receipt.result.method)
    );

    const reducedTxs = transactions.reduce((acc, curr) => ({ ...acc, [curr.txHash]: curr }), {}) as Record<string, GetTransactionDetailsInput>;
    const transactionDetails = filteredReceipts.map(receipt => ({ eventArgs: receipt.result.events?.[0]?.args, eventArgs2nd: receipt.result.events?.[1]?.args, method: receipt.result.method, ...reducedTxs[receipt.result.txHash] }));

    return transactionDetails;
}

export const getNewPosterAndPost = async (
    transaction: { txHash: string, eventArgs: string[], eventArgs2nd: string[], timestamp: number, blockHeight?: number },
    thisChannelId: string,
    postChannelRegex: RegExp,
    rpcClient: RpcClient,
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = transaction;

    const preV3 = timestamp < breakingChanges.v3.timestamp;
    const preV5 = timestamp < breakingChanges.v5.timestamp;
    const preV9 = timestamp < breakingChanges.v9.timestamp;

    if (!preV9 && !eventArgs2nd?.length) {
        return { continued: true };
    }

    const poster = eventArgs[0];
    const channelId = hex2str(eventArgs[2]);
    const message = sanitizeStr(hex2str(eventArgs[3]));
    const media = hex2str(eventArgs[6]);
    const mediaType = hex2str(eventArgs[7]);

    if (channelId !== thisChannelId && !postChannelRegex.test(channelId)) {
        return { continued: true };
    }

    if (!message && !(media && mediaType)) {
        return { continued: true };
    }

    const postIdRaw = hexToDecimal(eventArgs[1]);
    const postId = preV5 ? breakingChanges.v5.postIdPrefix + postIdRaw : preV9 ? breakingChanges.v9.postIdPrefix + postIdRaw : postIdRaw;

    if (postsRef.current[postId]) {
        return { continued: true };
    }

    const replyToPostIdRaw = preV3 ? hexToDecimal(hex2str(eventArgs[4])) : hex2str(eventArgs[4]);
    const replyToPostId = !replyToPostIdRaw ? '' : (preV5 ? breakingChanges.v5.postIdPrefix + replyToPostIdRaw : preV9 ? breakingChanges.v9.postIdPrefix + replyToPostIdRaw : replyToPostIdRaw);

    if (replyToPostId) {
        const replyToPost = postsRef.current[replyToPostId];
        const newReplyRespectsTime = replyToPost?.timestamp ? timestamp > replyToPost.timestamp : null;

        if (newReplyRespectsTime === false) {
            return { continued: true };
        }
    }

    const posterDetails_atTimeOfPost = !preV9 ? {
        stake: eventArgs2nd[1] === '0x' ? 0 : Number(dna2num(parseInt(eventArgs2nd[1], 16)).toFixed(0)),
        state: identityStateConversion[Number(hexToDecimal(eventArgs2nd[2]))],
        age: Number(hexToDecimal(eventArgs2nd[3])),
    } : {
        stake: NaN,
        state: 'Unknown',
        age: NaN,
    };

    const messagePromise = message && getMessage(postId, message, rpcClient);
    const mediaPromise = (media && mediaType) && getMedia(postId, media, mediaType, rpcClient);

    const newPost = {
        timestamp,
        postId,
        poster,
        posterDetails_atTimeOfPost,
        channelId,
        txHash,
        replyToPostId,
        orphaned: false,
    } as Post;

    let posterPromise: Promise<Poster> | undefined;

    if (!postersRef.current[poster]) {
        posterPromise = getPoster(rpcClient, poster);
    }

    return { newPost, posterPromise, mediaPromise, messagePromise };
}

const getMessage = async (postId: string, message: string, rpcClient: RpcClient) => {
    if (message.startsWith('ipfs://')) {
        const cid = message.split('ipfs://')[1];
        const { result: getCidResult } = await rpcClient('ipfs_get', [cid], true);

        if (!getCidResult) {
            message = 'Issue getting message from IPFS';
            return { postId, message };
        }

        message = sanitizeStr(hex2str(getCidResult));
    }

    return { postId, message };
};

const getMedia = async (postId: string, media: string, mediaType: string, rpcClient: RpcClient) => {
    let image = '';
    let video = '';

    if (media.startsWith('ipfs://')) {
        const cid = media.split('ipfs://')[1];
        const { result: getCidResult } = await rpcClient('ipfs_get', [cid], true);

        if (!getCidResult) {
            image = ErrorLoadingMedia;
            return { postId, image, video };
        }

        const bytes = hexToUint8Array(getCidResult);
        ({ image, video } = await getMediaFromHex(bytes, mediaType));
    } else {
        // @ts-ignore: Uint8Array.fromBase64 not recognized yet
        const bytes = Uint8Array.fromBase64(media);
        ({ image, video } = await getMediaFromHex(bytes, mediaType));
    }

    return { postId, image, video };
}

const getMediaFromHex = async (bytes: Uint8Array, mediaType: string) => {
    const bytesCopy = new Uint8Array(bytes);
    const blob = new Blob([bytesCopy], { type: mediaType || 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(blob);

    let image = '';
    let video = '';

    if (supportedImageTypes.includes(mediaType)) {
        const validImage = await isValidImageUrlCheck(objectUrl);
        if (validImage) {
            image = objectUrl;
        } else {
            image = ErrorLoadingMedia;
        }
    } else if (supportedVideoTypes.includes(mediaType)) {
        video = objectUrl;
    } else {
        image = ErrorLoadingMedia;
    }

    return { image, video };
}

const isValidImageUrlCheck = (url: string, wait = 2000): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();
        let complete = false;

        const process = (validImageUrl: boolean) => {
            if (complete) {
                return;
            }
            complete = true;

            img.onload = null;
            img.onerror = null;

            resolve(validImageUrl);
        };

        const timer = setTimeout(() => process(false), wait);

        img.onload = () => {
            clearTimeout(timer);
            process(true);
        };

        img.onerror = () => {
            clearTimeout(timer);
            process(false);
        };

        img.src = url;
    });
}

export const processTip = async (
    transaction: { txHash: string, eventArgs: string[], eventArgs2nd: string[], timestamp: number, blockHeight?: number },
    rpcClient: RpcClient,
    tipsRef: React.RefObject<Record<string, { totalAmount: number, tips: Tip[] }>>,
    postersRef: React.RefObject<Record<string, Poster>>,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = transaction;

    const preV9 = timestamp < breakingChanges.v9.timestamp;

    const tipper = eventArgs[0];
    const postIdRaw = hexToDecimal(eventArgs[2]);
    const postId = preV9 ? breakingChanges.v9.postIdPrefix + postIdRaw : postIdRaw;

    const amount = parseInt(eventArgs[3], 16);

    const tipperDetails_atTimeOfTip = !preV9 ? {
        stake: eventArgs2nd[1] === '0x' ? 0 : Number(dna2num(parseInt(eventArgs2nd[1], 16)).toFixed(0)),
        state: identityStateConversion[Number(hexToDecimal(eventArgs2nd[2]))],
        age: Number(hexToDecimal(eventArgs2nd[3])),
    } : {
        stake: NaN,
        state: 'Unknown',
        age: NaN,
    };

    const newTip = {
        postId,
        txHash,
        timestamp,
        tipper,
        tipperDetails_atTimeOfTip,
        amount,
    };

    const updatedPostTips = {
        totalAmount: (tipsRef.current[postId]?.totalAmount ?? 0) + amount,
        tips: [ ...(tipsRef.current[postId]?.tips ?? []), newTip ],
    }

    let posterPromise: Promise<Poster> | undefined;

    if (!postersRef.current[tipper]) {
        posterPromise = getPoster(rpcClient, tipper);
    }

    return { postId, updatedPostTips, posterPromise };
}

export const getPoster = async (rpcClient: RpcClient, posterAddress: string) => {
    const { result: getDnaIdentityResult, error: getDnaIdentityError } = await rpcClient('dna_identity', [posterAddress]);

    if (getDnaIdentityError) {
        throw 'rpc unavailable';
    }

    const { address, stake, age, pubkey, state } = getDnaIdentityResult;

    return { address, stake, age, pubkey, state };
};

export const getReplyPosts = (
    newPostId: string,
    replyToPostId: string,
    isRecurseForward: boolean,
    postsRef: Record<string, Post>,
    replyPostsTreeRef: Record<string, string>,
    forwardOrphanedReplyPostsTreeRef: Record<string, string>,
    backwardOrphanedReplyPostsTreeRef: Record<string, string>,
    newReplyPosts: Record<string, string>,
    newForwardOrphanedReplyPosts: Record<string, string>,
    newBackwardOrphanedReplyPosts: Record<string, string>,
) => {
    if (replyToPostId) {
        const replyToPost = postsRef[replyToPostId];

        if (!replyToPost || replyToPost.orphaned) {
            if (isRecurseForward) {
                const childPostIds = getChildPostIds(replyToPostId, forwardOrphanedReplyPostsTreeRef);
                newForwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPostId;
            } else {
                const childPostIds = getChildPostIds(replyToPostId, backwardOrphanedReplyPostsTreeRef);
                newBackwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPostId;
            }
        } else {
            const childPostIds = getChildPostIds(replyToPostId, replyPostsTreeRef);
            newReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPostId;
        }
    }
};

export const deOrphanReplyPosts = (
    parentId: string,
    forwardOrphanedReplyPostsTreeRef: Record<string, string>,
    backwardOrphanedReplyPostsTreeRef: Record<string, string>,
    postsRef: Record<string, Post>,
    newForwardOrphanedReplyPosts: Record<string, string>,
    newBackwardOrphanedReplyPosts: Record<string, string>,
    newDeOrphanedReplyPosts: Record<string, string>,
    newPosts: Record<string, Post>
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

        newDeOrphanedReplyPosts[newKey] = childDetails.deOrphanedId;
        newPosts[childDetails.deOrphanedId] = { ...postsRef[childDetails.deOrphanedId], orphaned: false };
    }
}

export const getBlockHeightFromTxHash = async (txHash: string, rpcClient: RpcClient) => {
    const { result: getTransactionResult, error: getTransactionError } = await rpcClient('bcn_transaction', [txHash]);

    if (getTransactionError) {
        throw 'rpc unavailable';
    }

    const { result: getBlockByHashResult, error: getBlockByHashError } = await rpcClient('bcn_block', [getTransactionResult.blockHash]);

    if (getBlockByHashError) {
        throw 'rpc unavailable';
    }

    return getBlockByHashResult.height;
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
    inputSendingTxs: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const txAmount = new Decimal(0.00001);
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({
                message: inputPost,
                ...(replyToPostId && { replyToPostId }),
                ...(channelId && { channelId }),
                ...(media.length && { media }),
                ...(mediaType.length && { mediaType }),
            }),
        }
    ];

    const payload = new CallContractAttachment();
    payload.setArgs(args);
    payload.method = makePostMethod;

    await makeCallTransaction(
        postersAddress,
        contractAddress,
        makePostMethod,
        inputSendingTxs,
        rpcClient,
        callbackUrl,
        txAmount,
        args,
        payload,
        inputPost.length + JSON.stringify(media).length,
    );
};

export const submitSendTip = async (
    postersAddress: string,
    contractAddress: string,
    sendTipMethod: string,
    postId: string,
    amount: string,
    inputSendingTxs: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const txAmount = new Decimal(amount);
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({ postId }),
        }
    ];
    const payload = new CallContractAttachment();
    payload.setArgs(args);
    payload.method = sendTipMethod;

    await makeCallTransaction(
        postersAddress,
        contractAddress,
        sendTipMethod,
        inputSendingTxs,
        rpcClient,
        callbackUrl,
        txAmount,
        args,
        payload,
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
    inputSendingTxs: string,
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

    if (inputSendingTxs === 'rpc') {
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

    if (inputSendingTxs === 'idena-app') {
        const { nonce, epoch } = await getNonceAndEpoch(rpcClient, from);

        const tx = new Transaction();
        tx.type = transactionType.CallContractTx;
        tx.to = hexToUint8Array(to);
        tx.amount = txAmount.mul(dnaBase).toString();
        tx.nonce = nonce;
        tx.epoch = epoch;
        tx.maxFee = maxFeeDna;
        tx.payload = payload.toBytes();
        const txHex = tx.toHex();

        const dnaLink = `https://app.idena.io/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${method}`;
        window.open(dnaLink, '_blank');
    }
};

let savedNonce = 0;
export const getNonceAndEpoch = async (rpcClient: RpcClient, address: string) => {
    const responses = await Promise.all([rpcClient('dna_getBalance', [address]), await rpcClient('dna_epoch', [])]);

    const { result: getBalanceResult } = responses[0];
    const { result: epochResult } = responses[1];

    savedNonce = calculateNonce(savedNonce, getBalanceResult.nonce);

    return { nonce: savedNonce, epoch: epochResult.epoch };
}

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
