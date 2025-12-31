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
