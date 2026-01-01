import {
    hexToUint8Array,
    toHexString,
    Transaction,
    type TransactionTypeValue,
} from 'idena-sdk-js-lite';

export type NodeDetails = { idenaNodeUrl: string, idenaNodeApiKey: string };

export const getRpcClient = (nodeDetails: NodeDetails) => async (method: string, params: any[]) => {
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

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        console.error(error);
        return {};
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


export const getPastBlocksWithTxs = async (findPastsBlocksUrl: string, blockNumber: number) => {
    try {
        const params = new URLSearchParams({
            blockNumber: blockNumber.toString(),
        });

        const response = await fetch(`${findPastsBlocksUrl}?${params}`);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error: unknown) {
        console.error(error);
        return {};
    }
};

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
