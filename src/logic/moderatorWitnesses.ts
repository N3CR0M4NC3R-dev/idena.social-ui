import { sha3_256 } from 'js-sha3';
import { Transaction } from 'idena-sdk-js-lite';

// Transactions this browser built for the Idena web app to sign. Once one is seen mined from the address it was
// built for, with the same nonce, recipient and payload, the key holder signed exactly what this browser built:
// proof that whoever uses this browser owns the address (docs/moderation.md, "Verifying that you own your address"). Kept in localStorage.

// Nonces restart every epoch, so a witness is a nonce within an epoch.
export type Witness = { address: string, epoch: number, nonce: number, to: string, payloadHash: string, builtAt: number };

const WITNESSES_KEY = 'moderatorWitnesses';
const MAX_WITNESSES = 20;

export const readWitnesses = (): Witness[] => {
    try {
        return JSON.parse(localStorage.getItem(WITNESSES_KEY) ?? '[]') as Witness[];
    } catch {
        return [];
    }
};

export const writeWitnesses = (witnesses: Witness[]) => {
    localStorage.setItem(WITNESSES_KEY, JSON.stringify(witnesses.slice(-MAX_WITNESSES)));
};

export const hashPayload = (payload: Uint8Array | null) => sha3_256(payload ?? new Uint8Array());

// Records an unsigned transaction this browser built for `address` and is about to hand to the web app.
export const recordBuiltTransaction = (address: string, txHex: string) => {
    try {
        const tx = Transaction.fromHex(txHex);
        const witness: Witness = { address: address.toLowerCase(), epoch: tx.epoch, nonce: tx.nonce, to: (tx.to ?? '').toLowerCase(), payloadHash: hashPayload(tx.payload), builtAt: Date.now() };
        writeWitnesses([...readWitnesses().filter((other) => !(other.address === witness.address && other.epoch === witness.epoch && other.nonce === witness.nonce)), witness]);
    } catch (error) {
        console.error(error);
    }
};
