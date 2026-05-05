import Decimal from "decimal.js";
import imageType from 'image-type';
import isSvg from 'is-svg';
import { calculateMaxFee, dna2num, getCallTransaction, getMakePostTransactionPayload, hex2str, hexToDecimal, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, toHexString, Transaction, transactionType, type ContractArgumentFormatValue, type TransactionTypeValue } from "idena-sdk-js-lite";
import ErrorLoadingMedia from '../assets/error-loading-media.png';

export const breakingChanges = {
    v3: { timestamp: 1767578641 },
    v5: { timestamp: 1767946325, block: 10219188, postIdPrefix: 'preV5:' },
    v9: { timestamp: 1775551992, block: 10604687, postIdPrefix: 'preV9:' },
    v10: { timestamp: 1775992052, block: 10627018, postIdPrefix: 'preV10:' },
    v11: { timestamp: 1777976356, block: 10727655, postIdPrefix: 'preV11:' },
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
    cid?: string,
    orphaned: boolean,
};
export type Poster = { address: string, stake: string, age: number, pubkey: string, state: string };
export type Tip = { postId: string, txHash: string, timestamp: number, tipper: string, tipperDetails_atTimeOfTip: { stake: number, state: string, age: number }, amount: number, burnAmount: number };
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

type GetTransactionDetailsRpcInput = { txHash: string, timestamp: number, blockHeight?: number };
export const getTransactionDetailsRpc = async (
    transactions: GetTransactionDetailsRpcInput[],
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

    const reducedTxs = transactions.reduce((acc, curr) => ({ ...acc, [curr.txHash]: curr }), {}) as Record<string, GetTransactionDetailsRpcInput>;
    const transactionDetails = filteredReceipts.map(receipt => ({ eventArgs: receipt.result.events?.[0]?.args, eventArgs2nd: receipt.result.events?.[1]?.args, method: receipt.result.method, ...reducedTxs[receipt.result.txHash] }));

    return transactionDetails;
}

type GetTransactionDetailsIndexerApiInput = { txHash: string, timestamp: number, blockHeight?: number };
export const getTransactionDetailsIndexerApi = async (
    transactions: GetTransactionDetailsIndexerApiInput[],
    indexerApiUrl: string,
) => {
    const transactionReceipts = await Promise.all(transactions.map((transaction) => getTxEventsWithIdenaIndexerApi(indexerApiUrl, transaction.txHash, 10)));

    const filteredReceipts = transactionReceipts.map((tx, index) => ({ ...tx, txHash: transactions[index].txHash })).filter((receipt) =>
        (receipt.error && (() => { throw 'indexer api unavailable' })()) ||
        receipt.result
    );

    const reducedTxs = transactions.reduce((acc, curr) => ({ ...acc, [curr.txHash]: curr }), {}) as Record<string, GetTransactionDetailsIndexerApiInput>;
    const transactionDetails = filteredReceipts.map(receipt => ({ eventArgs: receipt.result?.[0]?.data, eventArgs2nd: receipt.result?.[1]?.data, method: receipt.result?.[0]?.eventName, ...reducedTxs[receipt.txHash] }));

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
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;

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

    let postId = postIdRaw;

    if (preV5) {
        postId = breakingChanges.v5.postIdPrefix + postId;
    } else if (preV9) {
        postId = breakingChanges.v9.postIdPrefix + postId;
    } else if (preV10) {
        postId = breakingChanges.v10.postIdPrefix + postId;
    } else if (preV11) {
        postId = breakingChanges.v11.postIdPrefix + postId;
    }
    
    if (postsRef.current[postId]) {
        return { continued: true };
    }

    const replyToPostIdRaw = preV3 ? hexToDecimal(hex2str(eventArgs[4])) : hex2str(eventArgs[4]);

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
        }
    }

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
    const mediaPromise = (media && mediaType) && getMedia(postId, media, rpcClient);

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
            message = 'Issue loading message from IPFS';
            return { postId, message };
        }

        message = sanitizeStr(hex2str(getCidResult));
    }

    return { postId, message };
};

export const getMedia = async (postId: string, media: string, rpcClient: RpcClient) => {
    let image = '';
    let video = '';
    let mediaType = '';
    let cid = '';
    let blob;

    if (media.startsWith('ipfs://')) {
        cid = media.split('ipfs://')[1];
        const { result: getCidResult } = await rpcClient('ipfs_get', [cid], true);

        if (!getCidResult) {
            image = ErrorLoadingMedia;
            return { postId, image, video, mediaType, blob, cid };
        }

        const bytes = hexToUint8Array(getCidResult);
        ({ image, video, mediaType, blob } = await getMediaFromHex(bytes));
    } else {
        // @ts-ignore: Uint8Array.fromBase64 not recognized yet
        const bytes = Uint8Array.fromBase64(media);
        ({ image, video, mediaType, blob } = await getMediaFromHex(bytes));
    }

    return { postId, image, video, mediaType, blob, cid };
}

const getMediaFromHex = async (bytes: Uint8Array) => {
    let image = '';
    let video = '';
    let mediaType = '';

    const bytesCopy = new Uint8Array(bytes);
    mediaType = await getMediaTypeFromBuffer(bytes) ?? '';

    const blob = new Blob([bytesCopy], { type: mediaType || 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(blob);

    if (supportedImageTypes.includes(mediaType)) {
        const validImage = await isValidImageUrlCheck(objectUrl);
        if (validImage) {
            image = objectUrl;
        } else {
            image = ErrorLoadingMedia;
            mediaType = 'image/png';
        }
    } else if (supportedVideoTypes.includes(mediaType)) {
        video = objectUrl;
    } else {
        image = ErrorLoadingMedia;
        mediaType = 'image/png';
    }

    return { image, video, mediaType, blob };
}

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
    isRecurseForward: boolean,
) => {
    const { txHash, eventArgs, eventArgs2nd, timestamp } = transaction;

    const preV9 = timestamp < breakingChanges.v9.timestamp;
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;

    const tipper = eventArgs[0];

    const postIdEventArg = preV9 ? eventArgs[1] : eventArgs[2];
    const postIdRaw = hexToDecimal(postIdEventArg);
    let postId;

    if (preV9) {
        postId = breakingChanges.v9.postIdPrefix + postIdRaw;
    } else if (preV10) {
        postId = breakingChanges.v10.postIdPrefix + postIdRaw;
    } else if (preV11) {
        postId = breakingChanges.v11.postIdPrefix + postIdRaw;
    } else {
        postId = postIdRaw;
    }
    
    const amountEventArg = preV9 ? eventArgs[2] : eventArgs[3];
    const amount = parseInt(amountEventArg, 16);

    const sentAmountEventArg = preV11 ? eventArgs[3] : eventArgs[4];
    const sentAmount = parseInt(sentAmountEventArg, 16);

    const burnAmount = sentAmount - amount;

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
        burnAmount,
    };

    const updatedPostTips = {
        totalAmount: (tipsRef.current[postId]?.totalAmount ?? 0) + amount,
        tips: isRecurseForward ? [ newTip, ...(tipsRef.current[postId]?.tips ?? []) ] : [ ...(tipsRef.current[postId]?.tips ?? []), newTip ],
    }

    let posterPromise: Promise<Poster> | undefined;

    if (!postersRef.current[tipper]) {
        posterPromise = getPoster(rpcClient, tipper);
    }

    return { postId, newTip, updatedPostTips, posterPromise };
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

export const getPostIdFromChannelId = (timestamp: number, channelId: string, discussPrefix: string) => {
    const preV9 = timestamp < breakingChanges.v9.timestamp;
    const preV10 = timestamp < breakingChanges.v10.timestamp;
    const preV11 = timestamp < breakingChanges.v11.timestamp;
    const discussionPostIdRaw = channelId.split(discussPrefix)[1];

    let discussionPostId;

    if (preV9) {
        discussionPostId = breakingChanges.v9.postIdPrefix + discussionPostIdRaw;
    } else if (preV10) {
        discussionPostId = breakingChanges.v10.postIdPrefix + discussionPostIdRaw;
    } else if (preV11) {
        discussionPostId = breakingChanges.v11.postIdPrefix + discussionPostIdRaw;
    } else {
        discussionPostId = discussionPostIdRaw;
    }

    return discussionPostId;
}

export const getNewPostLatestActivity = (
    isRecurseForward: boolean,
    newPost: Post,
    postsRef: React.RefObject<Record<string, Post>>,
    postLatestActivityRef: React.RefObject<Record<string, number>>,
    postChannelRegex: RegExp,
    discussPrefix: string,
) => {
    const newPostLatestActivity: Record<string, number> = {};

    if (isRecurseForward) {
        let loopPost: Post | undefined = newPost;

        while (loopPost) {
            newPostLatestActivity[loopPost!.postId] = newPost!.timestamp;

            const replyToPostId: string = loopPost!.replyToPostId;
            const channelId = loopPost!.channelId;
            const timestamp = loopPost!.timestamp;

            if (replyToPostId) {
                loopPost = postsRef.current[replyToPostId];
            } else if (postChannelRegex.test(channelId)) {
                const discussionPostId = getPostIdFromChannelId(timestamp, channelId, discussPrefix);
                loopPost = postsRef.current[discussionPostId];
            } else {
                loopPost = undefined;
            }
        }
    } else {
        let newTimestamp = postLatestActivityRef.current[newPost!.postId] ?? newPost!.timestamp;
        postLatestActivityRef.current[newPost!.postId] = newTimestamp;

        const replyToPostId = newPost!.replyToPostId;
        const channelId = newPost!.channelId;
        const timestamp = newPost!.timestamp;

        if (replyToPostId) {
            newTimestamp = (postLatestActivityRef.current[replyToPostId] ?? 0) > newTimestamp ? postLatestActivityRef.current[replyToPostId] : newTimestamp;
            newPostLatestActivity[replyToPostId] = newTimestamp;
        } else if (postChannelRegex.test(channelId)) {
            const discussionPostId = getPostIdFromChannelId(timestamp, channelId, discussPrefix);
            newTimestamp = (postLatestActivityRef.current[discussionPostId] ?? 0) > newTimestamp ? postLatestActivityRef.current[discussionPostId] : newTimestamp;
            newPostLatestActivity[discussionPostId] = newTimestamp;
        }
    }

    return newPostLatestActivity;
}
