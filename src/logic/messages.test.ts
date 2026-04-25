import { secp256k1 } from '@noble/curves/secp256k1.js';
import { decryptDirectMessage, decryptExportedNodeKey, encryptDirectMessage, getConversationKey, getConversationSummaries, getIdenaAddressFromPrivateKey, parseSendMessageEvent, unlockMessageKey, type DirectMessage } from './messages';

const exportedNodeKeyFixture = {
    password: 'correct horse battery staple',
    privateKeyHex: '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d6e6e59c7c4f',
    exportedHex: '00112233445566778899aabb7349d7979890240e10cfe558c0f3833d70853a1b301bab0ffc55686e28be710f928d22f602cbafe795faa13bbc68f44b',
    address: '0x3a47f895590da041b801fa6dcff9117c24540a9f',
};

function hexToBytes(hex: string) {
    return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function bytesToHex(bytes: Uint8Array) {
    return Buffer.from(bytes).toString('hex');
}

function stringToHex(value: string) {
    return `0x${Buffer.from(value, 'utf8').toString('hex')}`;
}

describe('messages logic', () => {
    it('decrypts a fixed exported node key sample and derives the expected address', async () => {
        const privateKey = await decryptExportedNodeKey(exportedNodeKeyFixture.exportedHex, exportedNodeKeyFixture.password);

        expect(bytesToHex(privateKey)).toBe(exportedNodeKeyFixture.privateKeyHex);
        expect(getIdenaAddressFromPrivateKey(privateKey)).toBe(exportedNodeKeyFixture.address);
    });

    it('unlocks the message key from RPC export data and rejects an invalid password', async () => {
        const rpcClient = vi.fn().mockResolvedValue({ result: exportedNodeKeyFixture.exportedHex });
        const unlockedKey = await unlockMessageKey(rpcClient, exportedNodeKeyFixture.password, exportedNodeKeyFixture.address);

        expect(unlockedKey.state).toEqual({
            status: 'unlocked',
            unlockedAddress: exportedNodeKeyFixture.address,
        });
        expect(getIdenaAddressFromPrivateKey(unlockedKey.privateKey)).toBe(exportedNodeKeyFixture.address);

        await expect(unlockMessageKey(rpcClient, 'wrong password', exportedNodeKeyFixture.address)).rejects.toThrow();
    });

    it('roundtrips encrypted direct messages for both recipient and sender decryption paths', async () => {
        const senderPrivateKey = hexToBytes('1f1e1d1c1b1a191817161514131211101f1e1d1c1b1a19181716151413121110');
        const recipientPrivateKey = hexToBytes('2f2e2d2c2b2a292827262524232221202f2e2d2c2b2a29282726252423222120');
        const senderAddress = getIdenaAddressFromPrivateKey(senderPrivateKey);
        const recipientAddress = getIdenaAddressFromPrivateKey(recipientPrivateKey);
        const recipientPubkey = bytesToHex(secp256k1.getPublicKey(recipientPrivateKey, false));
        const plaintext = 'hello encrypted world';

        const envelope = await encryptDirectMessage({
            senderPrivateKey,
            senderAddress,
            recipientAddress,
            recipientPubkey,
            plaintext,
        });

        const baseMessage: DirectMessage = {
            txHash: '0xmessage',
            timestamp: 1,
            sender: senderAddress,
            recipient: recipientAddress,
            channelId: '',
            replyToMessageTxId: '',
            encrypted: true,
            messageRef: 'ipfs://fixture',
            payloadResolved: true,
            envelope,
        };

        const decryptedForRecipient = await decryptDirectMessage({
            activeAddress: recipientAddress,
            privateKey: recipientPrivateKey,
            message: baseMessage,
        });
        const decryptedForSender = await decryptDirectMessage({
            activeAddress: senderAddress,
            privateKey: senderPrivateKey,
            recipientPubkey,
            message: baseMessage,
        });

        expect(decryptedForRecipient).toBe(plaintext);
        expect(decryptedForSender).toBe(plaintext);
    });

    it('parses sendMessage events and filters out unrelated conversations', () => {
        const sender = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        const parsed = parseSendMessageEvent(
            {
                txHash: '0x123',
                timestamp: 42,
                eventArgs: [
                    sender,
                    stringToHex(recipient),
                    stringToHex(''),
                    stringToHex('ipfs://fixture'),
                    stringToHex('true'),
                    stringToHex(''),
                ],
            },
            sender,
        );

        expect('newMessage' in parsed && parsed.newMessage.recipient).toBe(recipient);
        expect(parseSendMessageEvent(
            {
                txHash: '0x123',
                timestamp: 42,
                eventArgs: [
                    sender,
                    stringToHex(recipient),
                    stringToHex(''),
                    stringToHex('ipfs://fixture'),
                    stringToHex('true'),
                    stringToHex(''),
                ],
            },
            '0xcccccccccccccccccccccccccccccccccccccccc',
        )).toEqual({ continued: true });
    });

    it('builds normalized conversation keys and sorts summaries by latest activity', () => {
        const selfAddress = exportedNodeKeyFixture.address;
        const firstCounterparty = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        const secondCounterparty = '0xcccccccccccccccccccccccccccccccccccccccc';
        const messages: Record<string, DirectMessage> = {
            one: {
                txHash: '0x1',
                timestamp: 10,
                sender: selfAddress,
                recipient: firstCounterparty,
                channelId: '',
                replyToMessageTxId: '',
                encrypted: true,
                messageRef: 'ipfs://one',
                payloadResolved: true,
                body: 'first body',
            },
            two: {
                txHash: '0x2',
                timestamp: 20,
                sender: secondCounterparty,
                recipient: selfAddress,
                channelId: '',
                replyToMessageTxId: '',
                encrypted: true,
                messageRef: 'ipfs://two',
                payloadResolved: true,
                body: 'second body',
            },
        };

        const summaries = getConversationSummaries(messages, selfAddress);

        expect(getConversationKey(selfAddress.toUpperCase(), firstCounterparty)).toBe(`${selfAddress}:${firstCounterparty}`);
        expect(summaries.map((summary) => summary.counterparty)).toEqual([secondCounterparty, firstCounterparty]);
        expect(summaries[0].lastMessagePreview).toBe('second body');
    });
});
