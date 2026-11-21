import Decimal from 'decimal.js';
import { Transaction, transactionType } from 'idena-sdk-js-lite';
import { getNonceAndEpoch, type RpcClient } from './asyncUtils';
import { findMinedBuiltTx } from './moderationActions';
import { readWitnesses, recordBuiltTransaction, writeWitnesses, type Witness } from './moderatorWitnesses';

// A moderator sees hidden content only once this browser has proof they own their address (docs/moderation.md,
// "Verifying that you own your address"): a decrypted key for it (checked in App), or a witnessed transaction, kept
// here. The gate only stops someone typing a moderator's address into Settings: the content itself is public on chain.

type WitnessVerification = { address: string, txHash: string, verifiedAt: number };

const VERIFICATION_KEY = 'moderatorVerification';
const GAS_PER_TX_BYTE = 10;
const TX_BYTES_BESIDES_PAYLOAD = 200;
const FEE_MARGIN = 1.25;
// A transaction not seen mined within a day was never signed, or the indexer no longer lists it.
const WITNESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const readWitnessVerification = (address: string) => {
    try {
        const verification = JSON.parse(localStorage.getItem(VERIFICATION_KEY) ?? 'null') as WitnessVerification | null;
        return verification?.address === address.toLowerCase() ? verification : undefined;
    } catch {
        return undefined;
    }
};

// Changing the address in Settings clears the proof made for another one.
export const forgetOtherVerification = (address: string) => {
    const stored = localStorage.getItem(VERIFICATION_KEY);
    if (stored && !readWitnessVerification(address)) localStorage.removeItem(VERIFICATION_KEY);
};

// Looks for a mined transaction of `address` that this browser built. Returns true once the address is verified.
export const checkWitnesses = async (indexerApiUrl: string, address: string) => {
    const from = address.toLowerCase();
    if (readWitnessVerification(from)) return true;

    const forget = (witness: Witness) => writeWitnesses(readWitnesses().filter((other) => !(other.address === witness.address && other.epoch === witness.epoch && other.nonce === witness.nonce)));

    for (const witness of readWitnesses().filter((candidate) => candidate.address === from)) {
        const found = await findMinedBuiltTx(indexerApiUrl, from, witness);

        if (found === 'taken' || (!found && Date.now() - witness.builtAt > WITNESS_MAX_AGE_MS)) {
            forget(witness);
        } else if (found) {
            localStorage.setItem(VERIFICATION_KEY, JSON.stringify({ address: from, txHash: found, verifiedAt: Date.now() }));
            writeWitnesses(readWitnesses().filter((other) => other.address !== from));
            return true;
        }
    }

    return false;
};

// A verification transaction: 0 iDNA to yourself, with a random tag in its payload, signed in the Idena web app.
// Only its fee is charged.
export const sendVerificationTransaction = async (rpcClient: RpcClient, address: string, webAppUrl: string, callbackUrl: string) => {
    const from = address.toLowerCase();
    const [ { nonce, epoch }, { result: feePerGas } ] = await Promise.all([getNonceAndEpoch(rpcClient, from), rpcClient('bcn_feePerGas', [], true)]);
    if (!feePerGas) return { error: 'The node did not answer. Try again.' };

    const payload = new TextEncoder().encode(`idena.social moderator verification ${crypto.randomUUID()}`);
    const tx = new Transaction();
    tx.type = transactionType.SendTx;
    tx.to = from;
    tx.amount = '0';
    tx.nonce = nonce;
    tx.epoch = epoch;
    tx.maxFee = new Decimal(feePerGas).mul((payload.length + TX_BYTES_BESIDES_PAYLOAD) * GAS_PER_TX_BYTE * FEE_MARGIN).toFixed(0);
    tx.payload = payload;

    const txHex = tx.toHex();
    recordBuiltTransaction(from, txHex);
    window.open(`${webAppUrl}/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=verify`, '_blank');

    return { error: undefined };
};
