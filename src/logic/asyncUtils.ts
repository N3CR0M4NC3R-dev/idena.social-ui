import type { RefObject } from "react";
import { getMaxFee, getPastBlocksWithTxs, type RpcClient } from "./api";
import { calculateMaxFee, hex2str, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, Transaction, transactionType } from "idena-sdk-js-lite";

export type PostDomSettings = { textOverflows: boolean, textOverflowHidden: boolean, repliesHidden: boolean }
export type Post = {
    blockHeight: number,
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
export type PastBlocksWithTxsGathered = { initialblockNumber: number, blocksWithTxs: number[] };

export const getRecurseBackwardPendingBlock = async (
    initialBlock: number,
    firstBlock: number,
    blockCapturedRef: React.RefObject<number>,
    useFindPastBlocksWithTxsApiRef: React.RefObject<boolean>,
    findPastBlocksUrlInvalidRef: React.RefObject<boolean>,
    pastBlocksWithTxsRef: React.RefObject<PastBlocksWithTxsGathered>,
    findPastBlocksUrlRef: React.RefObject<string>,
) => {
    let pendingBlock;
    let pastBlocksWithTxsGathered: PastBlocksWithTxsGathered | undefined;

    const nextPastBlock = blockCapturedRef.current ? blockCapturedRef.current - 1 : undefined;

    if (!nextPastBlock) {
        pendingBlock = initialBlock - 1;
    } else if (useFindPastBlocksWithTxsApiRef.current && !findPastBlocksUrlInvalidRef.current) {
        const noPastBlocksWithTxsGathered = !pastBlocksWithTxsRef.current.blocksWithTxs.length;
        const pastBlocksAlreadyProcessed = (pastBlocksWithTxsRef.current.initialblockNumber > nextPastBlock) && (pastBlocksWithTxsRef.current.blocksWithTxs[pastBlocksWithTxsRef.current.blocksWithTxs.length - 1] > nextPastBlock);
        const pastBlocksInRangeForNextBlock = (pastBlocksWithTxsRef.current.initialblockNumber > nextPastBlock) && (pastBlocksWithTxsRef.current.blocksWithTxs[pastBlocksWithTxsRef.current.blocksWithTxs.length - 1] < nextPastBlock);

        if (noPastBlocksWithTxsGathered || pastBlocksAlreadyProcessed) {
            const { initialblockNumber, blocksWithTxs = [] } = await getPastBlocksWithTxs(findPastBlocksUrlRef.current, nextPastBlock);
            pastBlocksWithTxsGathered = { initialblockNumber, blocksWithTxs };

            if (!pastBlocksWithTxsGathered.blocksWithTxs![0]) {
                throw 'no more blocks';
            }

            if (nextPastBlock > initialblockNumber) {
                pendingBlock = nextPastBlock;
            } else {
                pendingBlock = pastBlocksWithTxsGathered.blocksWithTxs![0];
            }
        
        } else if (pastBlocksInRangeForNextBlock) {
            const insertionIndex = pastBlocksWithTxsRef.current.blocksWithTxs.findIndex(currentItem => currentItem <= nextPastBlock);
            const finalIndex = insertionIndex === -1 ? pastBlocksWithTxsRef.current.blocksWithTxs.length : insertionIndex;
            pendingBlock = pastBlocksWithTxsRef.current.blocksWithTxs[finalIndex];
        } else {
            pendingBlock = nextPastBlock;
        }
    } else {
        pendingBlock = nextPastBlock;
    }

    if (pendingBlock <= firstBlock) {
        throw 'no more blocks';
    }

    return { pendingBlock, pastBlocksWithTxsGathered };
};

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

export const getNewPostersAndPosts = async (
    contractAddress: string,
    makePostMethod: string,
    thisChannelId: string,
    rpcClientRef: RefObject<RpcClient>,
    getBlockByHeightResult: any,
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    orphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
) => {
    const newPosters: Record<string, Poster> = {};
    const newOrderedPostIds: string[] = [];
    const newPosts: Record<string, Post> = {};
    const newReplyPosts: Record<string, string> = {};
    const newOrphanedReplyPosts: Record<string, string> = {};

    for (let index = 0; index < getBlockByHeightResult.transactions.length; index++) {
        const transaction = getBlockByHeightResult.transactions[index];

        const { result: getTxReceiptResult } = await rpcClientRef.current('bcn_txReceipt', [transaction]);

        if (!getTxReceiptResult) {
            continue;
        }

        if (getTxReceiptResult.contract !== contractAddress.toLowerCase()) {
            continue;
        }

        if (getTxReceiptResult.method !== makePostMethod) {
            continue;
        }

        if (getTxReceiptResult.success !== true) {
            continue;
        }

        const poster = getTxReceiptResult.events[0].args[0];
        const postId = getTxReceiptResult.events[0].args[1];
        const channelId = hex2str(getTxReceiptResult.events[0].args[2]);
        const message = sanitizeStr(hex2str(getTxReceiptResult.events[0].args[3]));
        const replyToPostId = hex2str(getTxReceiptResult.events[0].args[4]);

        if (channelId !== thisChannelId) {
            continue;
        }

        if (!message) {
            continue;
        }

        const { result: getDnaIdentityResult } = await rpcClientRef.current('dna_identity', [poster]);
        const { address, stake, age, pubkey, state, online } = getDnaIdentityResult;
        newPosters[address] = ({ address, stake, age, pubkey, state, online });

        const newPost = {
            blockHeight: getBlockByHeightResult.height,
            timestamp: getBlockByHeightResult.timestamp,
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

        if (!replyToPostId) {
            newOrderedPostIds.unshift(newPost.postId);
        } else {
            const replyToPost = postsRef.current[replyToPostId];
            const newReplyRespectsTime = replyToPost?.blockHeight ? newPost.blockHeight > replyToPost.blockHeight : null;

            if (newReplyRespectsTime === false) {
                continue;
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
    }

    return { newPosters, newOrderedPostIds, newPosts, newReplyPosts, newOrphanedReplyPosts };
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
