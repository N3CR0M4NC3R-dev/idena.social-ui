import {
    hexToUint8Array,
    toHexString,
    Transaction,
    type TransactionTypeValue,
} from 'idena-sdk-js-lite';
import { Profile } from './idena-web-ads-modified/profile';
import { fetchAdVoting, isApprovedVoting } from './idena-web-ads-modified/utilsAds';
import { Ad, AdBurnKey, type AdDetails } from './idena-web-ads-modified';

export type NodeDetails = { idenaNodeUrl: string, idenaNodeApiKey: string };
export type AdDetailsExtra = AdDetails & {
    cid: string,
    author: string,
    burnAmount: string,
};

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

export const getApprovedAds = async (rpcClient: RpcClient) => {
    try {
        const { result: getBurntCoinsResult } = await rpcClient('bcn_burntCoins', []);

        const promises = [];

        for (let index = 0; index < getBurntCoinsResult.length; index++) {
            const burntCoin = getBurntCoinsResult[index];

            const burntCoinWithKeyDecoded = {
                ...burntCoin,
                ...AdBurnKey.fromHex(burntCoin.key).burnKey,
            };

            promises.push((async () => {
                const { result: getIdentityResult } = await rpcClient('dna_identity', [burntCoinWithKeyDecoded.address]);

                if (getIdentityResult.profileHash) {
                    const { result: getProfileResult } = await rpcClient('ipfs_get', [getIdentityResult.profileHash]);

                    const { ads } = Profile.fromHex(getProfileResult);

                    const ad = ads.find(({ cid }) => cid === burntCoinWithKeyDecoded.cid);

                    if (ad && ad.contract) {
                        const { result: batchDataResult } = await rpcClient('contract_batchReadData', [ad.contract, [
                            { key: 'state', format: 'byte' },
                            { key: 'fact', format: 'hex' },
                            { key: 'result', format: 'byte' },
                        ]]);

                        const voting = fetchAdVoting(ad.contract, batchDataResult);
                        const approvedBurntCoin = isApprovedVoting(voting, ad.cid) ? burntCoinWithKeyDecoded : null;

                        if (approvedBurntCoin) {
                            const { result: getCidResult } = await rpcClient('ipfs_get', [ad.cid]);
                            return {
                                ...Ad.fromHex(getCidResult).details,
                                cid: ad.cid,
                                author: ad.author,
                                burnAmount: burntCoinWithKeyDecoded.amount
                            } as AdDetailsExtra;
                        }
                    }
                }
            })());
        }

        const approvedAdOffers = (await Promise.all(promises)).filter((ad) => !!ad).sort((a, b) => parseInt(b.burnAmount) - parseInt(a.burnAmount));
        return approvedAdOffers;
    } catch (error) {
        console.error(error);
        return [];
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
