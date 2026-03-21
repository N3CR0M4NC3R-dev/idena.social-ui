import type { NodeDetails } from "./api";
import { isValidIpfsCid } from "./utils";
import { hexToUint8Array } from "idena-sdk-js-lite";

export const MIN_IPFS_PIN_NODES = 1;
export const DEFAULT_IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
];

type IpfsErrorDetails = {
    node: string,
    error: string,
};

export type IpfsPinResult = {
    cid: string,
    pinnedNodes: string[],
    failedNodes: IpfsErrorDetails[],
};

export type StoreToIpfsResult = {
    coinbaseAddress: string,
    nonce: number,
    epoch: number,
    txHash?: string,
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'unknown error';
};

export function normalizeRpcNodeUrl(nodeUrl: string) {
    if (!nodeUrl) {
        return '';
    }

    let normalized = nodeUrl.trim();
    if (!normalized) {
        return '';
    }

    if (!/^https?:\/\//i.test(normalized)) {
        normalized = `http://${normalized}`;
    }

    return normalized.replace(/\/+$/g, '');
}

export function parseIpfsRpcNodes(inputIpfsRpcNodes: string, defaultApiKey = '') {
    const parsedNodes = inputIpfsRpcNodes
        .split(/[\n,]+/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [rawUrl, ...rawApiKeyRest] = line.split('|');
            const idenaNodeUrl = normalizeRpcNodeUrl(rawUrl ?? '');
            const idenaNodeApiKey = (rawApiKeyRest.join('|') || defaultApiKey).trim();
            return { idenaNodeUrl, idenaNodeApiKey } as NodeDetails;
        })
        .filter((node) => !!node.idenaNodeUrl);

    const uniqueNodesByUrlAndKey = new Map<string, NodeDetails>();

    for (const node of parsedNodes) {
        uniqueNodesByUrlAndKey.set(`${node.idenaNodeUrl}|${node.idenaNodeApiKey}`, node);
    }

    return [ ...uniqueNodesByUrlAndKey.values() ];
}

const uint8ArrayToHex = (bytes: Uint8Array) => {
    let hex = '0x';

    for (let index = 0; index < bytes.length; index++) {
        hex += bytes[index].toString(16).padStart(2, '0');
    }

    return hex;
};

const rpcCall = async (node: NodeDetails, method: string, params: unknown[]) => {
    const response = await fetch(node.idenaNodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            method,
            params,
            id: 1,
            key: node.idenaNodeApiKey,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${node.idenaNodeUrl}`);
    }

    const responseText = await response.text();

    let responseBody: {
        result?: unknown,
        error?: {
            message?: string,
        },
    };

    try {
        responseBody = JSON.parse(responseText);
    } catch {
        throw new Error(`Invalid RPC response from ${node.idenaNodeUrl}: ${responseText || 'empty response'}`);
    }

    if (responseBody.error) {
        throw new Error(responseBody.error.message || `RPC call failed on ${node.idenaNodeUrl}`);
    }

    return responseBody.result;
};

const addFileToRpcIpfs = async (node: NodeDetails, fileHexData: string) => {
    const result = await rpcCall(node, 'ipfs_add', [fileHexData, true]);

    if (typeof result !== 'string' || !isValidIpfsCid(result)) {
        throw new Error(`Invalid CID from ${node.idenaNodeUrl}`);
    }

    return result;
};

const getNonceFromBalance = (balanceResult: unknown) => {
    if (!balanceResult || typeof balanceResult !== 'object') {
        throw new Error('Invalid dna_getBalance response.');
    }

    const balanceData = balanceResult as { nonce?: unknown, mempoolNonce?: unknown };

    if (typeof balanceData.mempoolNonce === 'number') {
        return balanceData.mempoolNonce + 1;
    }

    if (typeof balanceData.nonce === 'number') {
        return balanceData.nonce + 1;
    }

    throw new Error('dna_getBalance response is missing nonce.');
};

const getEpochValue = (epochResult: unknown) => {
    if (!epochResult || typeof epochResult !== 'object') {
        throw new Error('Invalid dna_epoch response.');
    }

    const epochData = epochResult as { epoch?: unknown };

    if (typeof epochData.epoch !== 'number') {
        throw new Error('dna_epoch response is missing epoch.');
    }

    return epochData.epoch;
};

const getTxHashFromStoreToIpfsResult = (storeResult: unknown) => {
    if (typeof storeResult === 'string') {
        return storeResult;
    }

    if (!storeResult || typeof storeResult !== 'object') {
        return undefined;
    }

    const storeData = storeResult as { txHash?: unknown, hash?: unknown };

    if (typeof storeData.txHash === 'string') {
        return storeData.txHash;
    }

    if (typeof storeData.hash === 'string') {
        return storeData.hash;
    }

    return undefined;
};

export const storeCidWithDnaStoreToIpfs = async (node: NodeDetails, cid: string) => {
    const normalizedNode = {
        idenaNodeUrl: normalizeRpcNodeUrl(node.idenaNodeUrl),
        idenaNodeApiKey: node.idenaNodeApiKey,
    } as NodeDetails;

    const coinbaseAddressResult = await rpcCall(normalizedNode, 'dna_getCoinbaseAddr', []);

    if (typeof coinbaseAddressResult !== 'string' || !coinbaseAddressResult) {
        throw new Error('RPC node is view-only or dna_getCoinbaseAddr is unavailable.');
    }

    const balanceResult = await rpcCall(normalizedNode, 'dna_getBalance', [coinbaseAddressResult]);
    const epochResult = await rpcCall(normalizedNode, 'dna_epoch', []);
    const nonce = getNonceFromBalance(balanceResult);
    const epoch = getEpochValue(epochResult);

    const storeResult = await rpcCall(normalizedNode, 'dna_storeToIpfs', [{
        cid,
        nonce,
        epoch,
    }]);

    const txHash = getTxHashFromStoreToIpfsResult(storeResult);

    return {
        coinbaseAddress: coinbaseAddressResult,
        nonce,
        epoch,
        txHash,
    } as StoreToIpfsResult;
};

export const uploadImageToIpfsRpcNodes = async (
    file: File,
    primaryRpcNode: NodeDetails,
    sharedRpcNodes: NodeDetails[],
    minPinnedNodes = MIN_IPFS_PIN_NODES,
) => {
    const normalizedPrimaryRpcNode = {
        idenaNodeUrl: normalizeRpcNodeUrl(primaryRpcNode.idenaNodeUrl),
        idenaNodeApiKey: primaryRpcNode.idenaNodeApiKey,
    } as NodeDetails;

    const allNodes = [normalizedPrimaryRpcNode, ...sharedRpcNodes.filter((node) => !!node.idenaNodeUrl)]
        .filter((node) => !!node.idenaNodeUrl);

    const uniqueNodesByUrlAndKey = new Map<string, NodeDetails>();

    for (const node of allNodes) {
        uniqueNodesByUrlAndKey.set(`${node.idenaNodeUrl}|${node.idenaNodeApiKey}`, node);
    }

    const uniqueNodes = [ ...uniqueNodesByUrlAndKey.values() ];

    if (!uniqueNodes.length) {
        throw new Error('No Idena RPC node configured for IPFS uploads.');
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileHexData = uint8ArrayToHex(fileBytes);

    const pinnedNodes: string[] = [];
    const failedNodes: IpfsErrorDetails[] = [];
    let cid = '';

    for (let index = 0; index < uniqueNodes.length; index++) {
        const node = uniqueNodes[index];

        try {
            const nodeCid = await addFileToRpcIpfs(node, fileHexData);

            if (!cid) {
                cid = nodeCid;
            } else if (nodeCid !== cid) {
                throw new Error(`CID mismatch. Expected ${cid}, got ${nodeCid}`);
            }

            pinnedNodes.push(node.idenaNodeUrl);
        } catch (error) {
            failedNodes.push({ node: node.idenaNodeUrl, error: getErrorMessage(error) });
        }
    }

    if (!cid) {
        const failedNodesSummary = failedNodes.map((failedNode) => `${failedNode.node} (${failedNode.error})`).join(', ');
        throw new Error(`Could not upload image via Idena RPC IPFS. Failures: ${failedNodesSummary || 'none'}`);
    }

    if (pinnedNodes.length < minPinnedNodes) {
        const failedNodesSummary = failedNodes.map((failedNode) => `${failedNode.node} (${failedNode.error})`).join(', ');
        throw new Error(`Image pinned on ${pinnedNodes.length}/${minPinnedNodes} required RPC node(s). Failures: ${failedNodesSummary || 'none'}`);
    }

    return { cid, pinnedNodes, failedNodes } as IpfsPinResult;
};

export const getIpfsBlobUrlFromRpc = async (node: NodeDetails, cid: string, mimeType?: string) => {
    const normalizedNode = {
        idenaNodeUrl: normalizeRpcNodeUrl(node.idenaNodeUrl),
        idenaNodeApiKey: node.idenaNodeApiKey,
    } as NodeDetails;

    if (!normalizedNode.idenaNodeUrl) {
        throw new Error('No Idena RPC node configured for IPFS reads.');
    }

    const result = await rpcCall(normalizedNode, 'ipfs_get', [cid]);

    if (typeof result !== 'string' || !result.startsWith('0x')) {
        throw new Error(`Invalid ipfs_get payload from ${normalizedNode.idenaNodeUrl}`);
    }

    const bytes = hexToUint8Array(result);
    if (!bytes.length) {
        throw new Error(`Empty ipfs_get payload from ${normalizedNode.idenaNodeUrl}`);
    }

    const bytesCopy = new Uint8Array(bytes);
    const blob = new Blob([bytesCopy], { type: mimeType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
};
