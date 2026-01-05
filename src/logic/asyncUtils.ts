import type { RefObject } from "react";
import { getMaxFee, type RpcClient } from "./api";
import { calculateMaxFee, hex2str, hexToDecimal, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, Transaction, transactionType } from "idena-sdk-js-lite";

export const breakingChanges = { timestamp: 1767578641 };

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
export type Poster = { address: string, stake: string, age: number, pubkey: string, state: string, online: boolean };

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

const deOrphanReplyPosts = (parentId: string, replyPostTreeRef: Record<string, string>, postsRef: Record<string, Post>, newOrphanedReplyPosts: Record<string, string>, newReplyPosts: Record<string, string>, newPosts: Record<string, Post>) => {

    const deOrphanedIds = getChildPostIds(parentId, replyPostTreeRef);

    for (let index = 0; index < deOrphanedIds.length; index++) {
        const key = `${parentId}-${index}`;
        const deOrphanedId = deOrphanedIds[index];

        newOrphanedReplyPosts[key] = '';
        newReplyPosts[key] = deOrphanedId;
        newPosts[deOrphanedId] = { ...postsRef[deOrphanedId], orphaned: false };

        deOrphanReplyPosts(deOrphanedId, replyPostTreeRef, postsRef, newOrphanedReplyPosts, newReplyPosts, newPosts);
    }
}

export type Block = { hash: string, height: number, timestamp: number };

export const getNewPostersAndPosts = async (
    transaction: string,
    contractAddress: string,
    makePostMethod: string,
    thisChannelId: string,
    rpcClientRef: RefObject<RpcClient>,
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    orphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
) => {
    const newPosts: Record<string, Post> = {};
    const newPosters: Record<string, Poster> = {};
    const newReplyPosts: Record<string, string> = {};
    const newOrphanedReplyPosts: Record<string, string> = {};

    const { result: getTxReceiptResult } = await rpcClientRef.current('bcn_txReceipt', [transaction]);

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

    const postId = hexToDecimal(getTxReceiptResult.events[0].args[1]);

    if (postsRef.current[postId]) {
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

    const { result: getTransactionResult } = await rpcClientRef.current('bcn_transaction', [transaction]);
    const timestamp = getTransactionResult.timestamp;
    const lastBlockHash = getTransactionResult.blockHash;

    const replyToPostId = timestamp < breakingChanges.timestamp ?
        hexToDecimal(hex2str(getTxReceiptResult.events[0].args[4])) : hex2str(getTxReceiptResult.events[0].args[4]);

    if (!postersRef.current[poster]) {
        const { result: getDnaIdentityResult } = await rpcClientRef.current('dna_identity', [poster]);
        const { address, stake, age, pubkey, state, online } = getDnaIdentityResult;
        newPosters[poster] = { address, stake, age, pubkey, state, online };
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
    };

    const newOrderedPostIds = !replyToPostId ? [newPost.postId] : [];

    if (replyToPostId) {
        const replyToPost = postsRef.current[replyToPostId];
        const newReplyRespectsTime = replyToPost?.timestamp ? newPost.timestamp > replyToPost.timestamp : null;

        if (newReplyRespectsTime === false) {
            return { continued: true };
        }

        const childPostIds = getChildPostIds(replyToPostId, replyToPost?.orphaned ? replyPostsTreeRef.current : orphanedReplyPostsTreeRef.current);

        if (!replyToPost || replyToPost.orphaned) {
            newOrphanedReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
            newPost.orphaned = true;
        } else {
            newReplyPosts[`${replyToPostId}-${childPostIds.length}`] = newPost.postId;
        }
    }

    deOrphanReplyPosts(newPost.postId, orphanedReplyPostsTreeRef.current, postsRef.current, newOrphanedReplyPosts, newReplyPosts, newPosts);

    newPosts[postId] = newPost;

    return { newPosters, newOrderedPostIds, newPosts, newReplyPosts, newOrphanedReplyPosts, lastBlockHash };
};

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
