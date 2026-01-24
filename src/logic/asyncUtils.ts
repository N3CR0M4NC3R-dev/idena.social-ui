import { getMaxFee, type RpcClient } from "./api";
import { calculateMaxFee, hex2str, hexToDecimal, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, Transaction, transactionType } from "idena-sdk-js-lite";

export const breakingChanges = {
    v3: { timestamp: 1767578641 },
    v5: { timestamp: 1767946325, block: 10219188, firstTxId: '0x8524a0147c9f32ae5b5bbf456b85a062819d971f475607639e59b0fb85be9847', prefixPreV5: 'preV5:' },
};

export type PostDomSettings = { textOverflows: boolean, textOverflowHidden: boolean, repliesHidden: boolean }
export type Post = {
    timestamp: number,
    postId: string,
    poster: string,
    message: string,
    txHash: string,
    replyToPostId: string,
    orphaned: boolean,
    postDomSettings: PostDomSettings
};
export type Poster = { address: string, stake: string, age: number, pubkey: string, state: string };

export const getChildPostIds = (parentId: string, replyPostsTreeRef: Record<string, string>) => {
    const childPostIds = [];
    let childPostId;
    let index = 0;

    do {
        childPostId = replyPostsTreeRef[`${parentId}-${index}`];
        childPostId && (childPostIds.push(childPostId));
        index++;
    } while (childPostId);

    return childPostIds;
};

type GetTransactionDetailsInput = { txHash: string, timestamp: number, blockHeight?: number };
export const getTransactionDetails = async (
    transactions: GetTransactionDetailsInput[],
    contractAddress: string,
    makePostMethod: string,
    rpcClient: RpcClient,
) => {
    const transactionReceipts = await Promise.all(transactions.map((transaction) => rpcClient('bcn_txReceipt', [transaction.txHash])));

    const filteredReceipts = transactionReceipts.filter((receipt) =>
        (receipt.error && (() => { throw 'rpc unavailable' })()) ||
        receipt.result &&
        receipt.result.success === true &&
        receipt.result.contract === contractAddress.toLowerCase() &&
        receipt.result.method === makePostMethod
    );
    const reducedTxs = transactions.reduce((acc, curr) => ({ ...acc, [curr.txHash]: curr }), {}) as Record<string, GetTransactionDetailsInput>;
    const transactionDetails = filteredReceipts.map(receipt => ({ eventArgs: receipt.result.events[0].args, ...reducedTxs[receipt.result.txHash] }));

    return transactionDetails;
}

export const getNewPosterAndPost = async (
    transaction: { txHash: string, eventArgs: string[], timestamp: number, blockHeight?: number },
    thisChannelId: string,
    rpcClient: RpcClient,
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
) => {
    const { txHash, eventArgs, timestamp } = transaction;

    const poster = eventArgs[0];
    const channelId = hex2str(eventArgs[2]);
    const message = sanitizeStr(hex2str(eventArgs[3]));

    if (channelId !== thisChannelId) {
        return { continued: true };
    }

    if (!message) {
        return { continued: true };
    }

    const preV3 = timestamp < breakingChanges.v3.timestamp;
    const preV5 = timestamp < breakingChanges.v5.timestamp;

    const postIdRaw = hexToDecimal(eventArgs[1]);
    const postId = preV5 ? breakingChanges.v5.prefixPreV5 + postIdRaw : postIdRaw;

    if (postsRef.current[postId]) {
        return { continued: true };
    }

    const replyToPostIdRaw = preV3 ? hexToDecimal(hex2str(eventArgs[4])) : hex2str(eventArgs[4]);
    const replyToPostId = !replyToPostIdRaw ? '' : (preV5 ? breakingChanges.v5.prefixPreV5 + replyToPostIdRaw : replyToPostIdRaw);

    if (replyToPostId) {
        const replyToPost = postsRef.current[replyToPostId];
        const newReplyRespectsTime = replyToPost?.timestamp ? timestamp > replyToPost.timestamp : null;

        if (newReplyRespectsTime === false) {
            return { continued: true };
        }
    }

    const newPost = {
        timestamp,
        postId,
        poster,
        message,
        txHash,
        replyToPostId,
        orphaned: false,
        postDomSettings: {
            textOverflows: false,
            textOverflowHidden: true,
            repliesHidden: true,
        },
    } as Post;

    let newPoster: Poster | undefined;

    if (!postersRef.current[poster]) {
        const { result: getDnaIdentityResult, error: getDnaIdentityError } = await rpcClient('dna_identity', [poster]);

        if (getDnaIdentityError) {
            throw 'rpc unavailable';
        }

        const { address, stake, age, pubkey, state } = getDnaIdentityResult;
        newPoster = { address, stake, age, pubkey, state };
    }

    return { newPost, newPoster };
}

export const getReplyPosts = (
    newPost: Post,
    recurseForward: boolean,
    postsRef: Record<string, Post>,
    replyPostsTreeRef: Record<string, string>,
    forwardOrphanedReplyPostsTreeRef: Record<string, string>,
    backwardOrphanedReplyPostsTreeRef: Record<string, string>,
) => {
    const newReplyPosts: Record<string, string> = {};
    const newForwardOrphanedReplyPosts: Record<string, string> = {};
    const newBackwardOrphanedReplyPosts: Record<string, string> = {};

    const replyToPostId = newPost.replyToPostId;

    if (replyToPostId) {
        const replyToPost = postsRef[replyToPostId];

        if (!replyToPost || replyToPost.orphaned) {
            if (recurseForward) {
                const childPostIds = getChildPostIds(replyToPostId, forwardOrphanedReplyPostsTreeRef);
                newForwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
            } else {
                const childPostIds = getChildPostIds(replyToPostId, backwardOrphanedReplyPostsTreeRef);
                newBackwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
            }
            newPost.orphaned = true;
        } else {
            const childPostIds = getChildPostIds(replyToPostId, replyPostsTreeRef);
            newReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
        }
    }

    return { newReplyPosts, newForwardOrphanedReplyPosts, newBackwardOrphanedReplyPosts };
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

        deOrphanReplyPosts(
            childDetails.deOrphanedId,
            forwardOrphanedReplyPostsTreeRef,
            backwardOrphanedReplyPostsTreeRef,
            postsRef,
            newForwardOrphanedReplyPosts,
            newBackwardOrphanedReplyPosts,
            newDeOrphanedReplyPosts,
            newPosts,
        );
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
    replyToPostId: string | null,
    inputSendingTxs: string,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const txAmount = 0.00001;
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({
                message: inputPost,
                ...(replyToPostId && { replyToPostId }),
            }),
        }
    ];

    const payload = new CallContractAttachment();
    payload.setArgs(args);
    payload.method = makePostMethod;

    const maxFeeResult = await getMaxFee(rpcClient, {
        from: postersAddress,
        to: contractAddress,
        type: transactionType.CallContractTx,
        amount: txAmount,
        payload: payload,
    });

    const { maxFeeDecimal, maxFeeDna } = calculateMaxFee(maxFeeResult, inputPost.length);

    if (inputSendingTxs === 'rpc') {
        await rpcClient('contract_call', [
            {
                from: postersAddress,
                contract: contractAddress,
                method: makePostMethod,
                amount: txAmount,
                args,
                maxFee: maxFeeDecimal,
            }
        ]);
    }

    if (inputSendingTxs === 'idena-app') {
        const { result: getBalanceResult } = await rpcClient('dna_getBalance', [postersAddress]);
        const { result: epochResult } = await rpcClient('dna_epoch', []);

        const tx = new Transaction();
        tx.type = transactionType.CallContractTx;
        tx.to = hexToUint8Array(contractAddress);
        tx.amount = txAmount * 1e18;
        tx.nonce = getBalanceResult.nonce + 1;
        tx.epoch = epochResult.epoch;
        tx.maxFee = maxFeeDna;
        tx.payload = payload.toBytes();
        const txHex = tx.toHex();

        const dnaLink = `https://app.idena.io/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${makePostMethod}`;
        window.open(dnaLink, '_blank');
    }
};
