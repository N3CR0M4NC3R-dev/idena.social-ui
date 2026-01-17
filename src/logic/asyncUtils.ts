import type { RefObject } from "react";
import { getMaxFee, type RpcClient } from "./api";
import { calculateMaxFee, hex2str, hexToDecimal, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, Transaction, transactionType } from "idena-sdk-js-lite";

export const breakingChanges = {
    v3: { timestamp: 1767578641 },
    v5: { timestamp: 1767946325, firstTxId: '0x8524a0147c9f32ae5b5bbf456b85a062819d971f475607639e59b0fb85be9847', prefixPreV5: 'preV5:' },
};

export type PostDomSettings = { textOverflows: boolean, textOverflowHidden: boolean, repliesHidden: boolean }
export type Post = {
    timestamp: number,
    postId: string,
    poster: string,
    message: string,
    transaction: string,
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

export type Block = { hash: string, height: number, timestamp: number };

export const getNewPosterAndPost = async (
    transaction: string,
    contractAddress: string,
    makePostMethod: string,
    thisChannelId: string,
    rpcClientRef: RefObject<RpcClient>,
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
) => {
    const { result: getTxReceiptResult, error: getTxReceiptError } = await rpcClientRef.current('bcn_txReceipt', [transaction]);

    if (getTxReceiptError) {
        throw 'rpc unavailable';
    }

    if (!getTxReceiptResult) {
        return { continued: true };
    }

    if (getTxReceiptResult.contract !== contractAddress.toLowerCase()) {
        return { continued: true };
    }

    if (getTxReceiptResult.method !== makePostMethod) {
        return { continued: true };
    }

    if (getTxReceiptResult.success !== true) {
        return { continued: true };
    }

    const postIdRaw = hexToDecimal(getTxReceiptResult.events[0].args[1]);

    if (postsRef.current[postIdRaw]) {
        return { continued: true };
    }

    const poster = getTxReceiptResult.events[0].args[0];
    const channelId = hex2str(getTxReceiptResult.events[0].args[2]);
    const message = sanitizeStr(hex2str(getTxReceiptResult.events[0].args[3]));

    if (channelId !== thisChannelId) {
        return { continued: true };
    }

    if (!message) {
        return { continued: true };
    }

    const { result: getTransactionResult, error: getTransactionError } = await rpcClientRef.current('bcn_transaction', [transaction]);

    if (getTransactionError) {
        throw 'rpc unavailable';
    }

    const timestamp = getTransactionResult.timestamp;
    const lastBlockHash = getTransactionResult.blockHash;

    const preV3 = timestamp < breakingChanges.v3.timestamp;
    const preV5 = timestamp < breakingChanges.v5.timestamp;

    if (preV5 && postsRef.current[breakingChanges.v5.prefixPreV5 + postIdRaw]) {
        return { continued: true };
    }

    const postId = preV5 ? breakingChanges.v5.prefixPreV5 + postIdRaw : postIdRaw;

    const replyToPostIdRaw = preV3 ? hexToDecimal(hex2str(getTxReceiptResult.events[0].args[4])) : hex2str(getTxReceiptResult.events[0].args[4]);
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
        transaction,
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
        const { result: getDnaIdentityResult, error: getDnaIdentityError } = await rpcClientRef.current('dna_identity', [poster]);

        if (getDnaIdentityError) {
            throw 'rpc unavailable';
        }

        const { address, stake, age, pubkey, state } = getDnaIdentityResult;
        newPoster = { address, stake, age, pubkey, state };
    }

    return { newPost, newPoster, lastBlockHash };
}

export const getReplyPosts = async (
    newPost: Post,
    recurseForward: boolean,
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    forwardOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    backwardOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
) => {
    const newReplyPosts: Record<string, string> = {};
    const newForwardOrphanedReplyPosts: Record<string, string> = {};
    const newBackwardOrphanedReplyPosts: Record<string, string> = {};

    const replyToPostId = newPost.replyToPostId;

    if (replyToPostId) {
        const replyToPost = postsRef.current[replyToPostId];

        if (!replyToPost || replyToPost.orphaned) {
            if (recurseForward) {
                const childPostIds = getChildPostIds(replyToPostId, forwardOrphanedReplyPostsTreeRef.current);
                newForwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
            } else {
                const childPostIds = getChildPostIds(replyToPostId, backwardOrphanedReplyPostsTreeRef.current);
                newBackwardOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
            }
            newPost.orphaned = true;
        } else {
            const childPostIds = getChildPostIds(replyToPostId, replyPostsTreeRef.current);
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

export const submitPost = async (
    postersAddress: string,
    contractAddress: string,
    makePostMethod: string,
    inputPost: string,
    replyToPostId: string | null,
    inputUseRpc: boolean,
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

    if (inputUseRpc) {
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
    } else {
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
