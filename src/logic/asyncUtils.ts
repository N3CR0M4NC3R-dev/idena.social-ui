import type { RefObject } from "react";
import type { Post, Poster } from "../App";
import { getMaxFee, getPastBlocksWithTxs, type RpcClient } from "./api";
import { calculateMaxFee, hex2str, sanitizeStr } from "./utils";
import { CallContractAttachment, contractArgumentFormat, hexToUint8Array, Transaction, transactionType } from "idena-sdk-js-lite";

export const getRecurseBackwardPendingBlock = async (
    initialBlock: number,
    firstBlock: number,
    blockCapturedRef: React.RefObject<number>,
    useFindPastBlocksWithTxsApiRef: React.RefObject<boolean>,
    findPastBlocksUrlInvalidRef: React.RefObject<boolean>,
    pastBlocksWithTxsRef: React.RefObject<number[]>,
    findPastBlocksUrlRef: React.RefObject<string>,
    setPastBlocksWithTxs: React.Dispatch<React.SetStateAction<number[]>>,
) => {
    let pendingBlock;

    const nextPastBlock = blockCapturedRef.current ? blockCapturedRef.current - 1 : undefined;

    if (!nextPastBlock) {
        pendingBlock = initialBlock - 1;
    } else if (useFindPastBlocksWithTxsApiRef.current && !findPastBlocksUrlInvalidRef.current) {
        const noPastBlocksWithTxsGathered = !pastBlocksWithTxsRef.current.length;
        const pastBlocksAlreadyProcessed = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] > nextPastBlock);
        const pastBlocksInRangeForNextBlock = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] < nextPastBlock);

        if (noPastBlocksWithTxsGathered || pastBlocksAlreadyProcessed) {
            const { initialblockNumber, blocksWithTxs = [] } = await getPastBlocksWithTxs(findPastBlocksUrlRef.current, nextPastBlock);
            setPastBlocksWithTxs(blocksWithTxs);

            if (!blocksWithTxs[0]) {
                throw 'no more blocks';
            }

            if (nextPastBlock > initialblockNumber) {
                pendingBlock = nextPastBlock;
            } else {
                pendingBlock = blocksWithTxs[0];
            }
        
        } else if (pastBlocksInRangeForNextBlock) {
            const insertionIndex = pastBlocksWithTxsRef.current.findIndex(currentItem => currentItem <= nextPastBlock);
            const finalIndex = insertionIndex === -1 ? pastBlocksWithTxsRef.current.length : insertionIndex;
            pendingBlock = pastBlocksWithTxsRef.current[finalIndex];
        } else {
            pendingBlock = nextPastBlock;
        }
    } else {
        pendingBlock = nextPastBlock;
    }

    if (pendingBlock <= firstBlock) {
        throw 'no more blocks';
    }

    return pendingBlock;
};

export const getNewPostersAndPosts = async (
    contractAddress: string,
    makePostMethod: string,
    thisChannelId: string,
    rpcClientRef: RefObject<RpcClient>,
    getBlockByHeightResult: any,
    postersRef: React.RefObject<Poster[]>,
) => {
    const newPosters: Poster[] = [];
    const newPosts: Post[] = [];

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

        if (channelId !== thisChannelId) {
            continue;
        }

        if (!message) {
            continue;
        }

        if (!postersRef.current.some((item: Poster) => item.address === poster)) {
            const { result: getDnaIdentityResult } = await rpcClientRef.current('dna_identity', [poster]);
            const { address, stake, age, pubkey, state, online } = getDnaIdentityResult;
            newPosters.push({ address, stake, age, pubkey, state, online });
        }

        newPosts.unshift({ blockHeight: getBlockByHeightResult.height, timestamp: getBlockByHeightResult.timestamp, postId, poster, message, transaction });
    }

    return { newPosters, newPosts };
};

export const submitPost = async (
    postersAddress: string,
    contractAddress: string,
    makePostMethod: string,
    inputPost: string,
    inputUseRpc: boolean,
    rpcClient: RpcClient,
    callbackUrl: string,
) => {
    const txAmount = 0.00001;
    const args = [
        {
            format: contractArgumentFormat.String,
            index: 0,
            value: JSON.stringify({ message: inputPost }),
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
