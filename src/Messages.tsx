import { useState } from 'react';
import { useOutletContext } from 'react-router';
import type { Poster } from './logic/asyncUtils';
import { getConversationKey, getConversationMessages, getConversationSummaries, getLockedDirectMessagePlaceholder, type DirectMessage, type MessageKeyState } from './logic/messages';
import { getDisplayAddress, getDisplayDateTime } from './logic/utils';

const zeroAddress = '0x0000000000000000000000000000000000000000';
const addressRegex = /^0x[a-fA-F0-9]{40}$/;

type MessagesProps = {
    makePostsWith: string;
    nodeAvailable: boolean;
    viewOnlyNode: boolean;
    postersAddress: string;
    posters: Record<string, Poster>;
    messages: Record<string, DirectMessage>;
    messageKeyState: MessageKeyState;
    unlockMessagesHandler: (password: string) => Promise<void>;
    lockMessagesHandler: () => void;
    submitDirectMessageHandler: (recipient: string, plaintext: string) => Promise<void>;
    lookupPosterHandler: (address: string) => Promise<Poster>;
    submittingMessage: string;
    scanningPastBlocks: boolean;
    noMorePastBlocks: boolean;
    inputPostDisabled: boolean;
};

function Messages() {
    const {
        makePostsWith,
        nodeAvailable,
        viewOnlyNode,
        postersAddress,
        posters,
        messages,
        messageKeyState,
        unlockMessagesHandler,
        lockMessagesHandler,
        submitDirectMessageHandler,
        lookupPosterHandler,
        submittingMessage,
        scanningPastBlocks,
        noMorePastBlocks,
        inputPostDisabled,
    } = useOutletContext() as MessagesProps;

    const [password, setPassword] = useState<string>('');
    const [recipientInput, setRecipientInput] = useState<string>('');
    const [activeCounterparty, setActiveCounterparty] = useState<string>('');
    const [draftMessage, setDraftMessage] = useState<string>('');
    const [routeError, setRouteError] = useState<string>('');
    const [recipientLookupError, setRecipientLookupError] = useState<string>('');

    const conversationSummaries = postersAddress && postersAddress !== zeroAddress
        ? getConversationSummaries(messages, postersAddress)
        : [];
    const selectedCounterparty = activeCounterparty || conversationSummaries[0]?.counterparty || '';
    const activeConversationKey = selectedCounterparty ? getConversationKey(postersAddress, selectedCounterparty) : '';
    const activeMessages = activeConversationKey ? getConversationMessages(messages, activeConversationKey) : [];
    const activeRecipientPoster = selectedCounterparty ? posters[selectedCounterparty] : undefined;
    const activeConversationSubmitting = !!activeConversationKey && submittingMessage === activeConversationKey;
    const messagesBlocked = makePostsWith !== 'rpc' || viewOnlyNode || !postersAddress || postersAddress === zeroAddress;
    const canSendInConversation = messageKeyState.status === 'unlocked' && !!selectedCounterparty && !!activeRecipientPoster?.pubkey && !inputPostDisabled;

    const handleUnlockMessages = async () => {
        setRouteError('');
        await unlockMessagesHandler(password);
        setPassword('');
    };

    const handleSelectConversation = async (counterparty: string) => {
        const normalizedCounterparty = counterparty.toLowerCase();

        setActiveCounterparty(normalizedCounterparty);
        setRecipientInput(normalizedCounterparty);
        setRecipientLookupError('');
        setRouteError('');

        try {
            const poster = await lookupPosterHandler(normalizedCounterparty);

            if (!poster.pubkey) {
                setRecipientLookupError('This identity has no public key; encrypted DMs are disabled.');
            }
        } catch (error) {
            setRecipientLookupError(error instanceof Error ? error.message : 'Unable to load recipient identity');
        }
    };

    const handleOpenConversation = async () => {
        const normalizedRecipient = recipientInput.trim().toLowerCase();

        if (!addressRegex.test(normalizedRecipient)) {
            setRecipientLookupError('Enter a valid Idena address.');
            return;
        }

        await handleSelectConversation(normalizedRecipient);
    };

    const handleSendDirectMessage = async () => {
        const trimmedMessage = draftMessage.trim();

        if (!trimmedMessage || !selectedCounterparty) {
            return;
        }

        setRouteError('');

        try {
            await submitDirectMessageHandler(selectedCounterparty, trimmedMessage);
            setDraftMessage('');
        } catch (error) {
            setRouteError(error instanceof Error ? error.message : 'Unable to send message');
        }
    };

    if (messagesBlocked) {
        return (
            <div className="mt-4 p-4 bg-stone-800">
                <h2 className="text-[24px] font-[600]">Messages</h2>
                <p className="mt-3 text-[14px] text-gray-300">
                    Direct messages are RPC-only in v1. Switch to `Use RPC` with a writable node to unlock encrypted messaging.
                </p>
            </div>
        );
    }

    if (!nodeAvailable) {
        return (
            <div className="mt-4 p-4 bg-stone-800">
                <h2 className="text-[24px] font-[600]">Messages</h2>
                <p className="mt-3 text-[14px] text-red-400">Node unavailable. Encrypted messages cannot be scanned or sent right now.</p>
            </div>
        );
    }

    return (
        <div className="mt-4 flex h-[calc(100vh-3rem)] min-h-[720px] overflow-hidden rounded-sm bg-stone-800">
            <div className="w-[180px] border-r border-stone-700">
                <div className="border-b border-stone-700 p-3">
                    <h2 className="text-[24px] font-[600]">Messages</h2>
                    <p className="mt-1 text-[11px] text-gray-400">{scanningPastBlocks ? 'Syncing message history...' : (noMorePastBlocks ? 'History synced' : 'Recent history loaded')}</p>
                </div>
                <div className="border-b border-stone-700 p-3">
                    <p className="mb-1 text-[12px] font-[600] text-gray-300">New conversation</p>
                    <input
                        className="w-full py-1 px-2 text-[12px] outline-1 placeholder:text-gray-500"
                        placeholder="0x..."
                        value={recipientInput}
                        onChange={(event) => {
                            setRecipientInput(event.target.value);
                            setRecipientLookupError('');
                        }}
                    />
                    <button className="mt-2 h-8 w-full bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={handleOpenConversation}>Open</button>
                    {recipientLookupError && <p className="mt-2 text-[11px] text-red-400">{recipientLookupError}</p>}
                </div>
                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
                    {conversationSummaries.length === 0 && <p className="p-3 text-[12px] italic text-gray-500">No direct messages yet.</p>}
                    {conversationSummaries.map((conversation) => (
                        <button
                            key={conversation.key}
                            className={`block w-full border-b border-stone-700 px-3 py-2 text-left hover:bg-stone-700 ${activeConversationKey === conversation.key ? 'bg-stone-700' : ''}`}
                            onClick={() => handleSelectConversation(conversation.counterparty)}
                        >
                            <p className="text-[13px] font-[600]">{getDisplayAddress(conversation.counterparty)}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{conversation.lastMessagePreview}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-1 flex-col">
                <div className="border-b border-stone-700 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-[12px] text-gray-400">Active RPC identity</p>
                            <p className="text-[16px] font-[600]">{getDisplayAddress(postersAddress)}</p>
                        </div>
                        {messageKeyState.status === 'unlocked' ? (
                            <button className="h-8 px-3 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={lockMessagesHandler}>Lock messages</button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="password"
                                    className="w-[160px] py-1 px-2 text-[12px] outline-1 placeholder:text-gray-500"
                                    placeholder="Node password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                                <button
                                    className="h-8 px-3 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer"
                                    disabled={!password || messageKeyState.status === 'unlocking'}
                                    onClick={handleUnlockMessages}
                                >
                                    {messageKeyState.status === 'unlocking' ? 'Unlocking...' : 'Unlock'}
                                </button>
                            </div>
                        )}
                    </div>
                    {messageKeyState.status === 'error' && <p className="mt-2 text-[11px] text-red-400">{messageKeyState.error}</p>}
                    {messageKeyState.status === 'unlocked' && <p className="mt-2 text-[11px] text-green-400">Messages unlocked in memory for {getDisplayAddress(messageKeyState.unlockedAddress || postersAddress)}.</p>}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {!selectedCounterparty && <p className="mt-6 text-center text-[13px] text-gray-500">Open a conversation to view or send encrypted messages.</p>}
                    {!!selectedCounterparty && (
                        <>
                            <div className="mb-3 border-b border-stone-700 pb-3">
                                <p className="text-[12px] text-gray-400">Conversation with</p>
                                <p className="text-[18px] font-[600]">{getDisplayAddress(selectedCounterparty)}</p>
                                {!activeRecipientPoster?.pubkey && <p className="mt-1 text-[11px] text-red-400">This identity has no public key. Sending is disabled.</p>}
                            </div>

                            {activeMessages.length === 0 && <p className="mt-6 text-center text-[13px] text-gray-500">No messages in this conversation yet.</p>}
                            <ul className="flex flex-col gap-3">
                                {activeMessages.map((message) => {
                                    const isOutgoing = message.sender === postersAddress.toLowerCase();
                                    const { displayDate, displayTime } = getDisplayDateTime(message.timestamp);
                                    const displayMessage = !message.payloadResolved
                                        ? 'Loading encrypted message...'
                                        : message.invalidReason || message.body || message.decryptError || getLockedDirectMessagePlaceholder();

                                    return (
                                        <li key={message.txHash} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[72%] rounded-sm px-3 py-2 ${isOutgoing ? 'bg-blue-500/20' : 'bg-stone-700'}`}>
                                                <p className="text-[11px] text-gray-400">{isOutgoing ? 'You' : getDisplayAddress(message.sender)}</p>
                                                <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{displayMessage}</p>
                                                <div className="mt-2 text-right text-[10px] text-stone-400">
                                                    <a className="hover:underline" href={`https://scan.idena.io/transaction/${message.txHash}`} target="_blank" rel="noreferrer">{`${displayDate}, ${displayTime}`}</a>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </div>

                <div className="border-t border-stone-700 p-3">
                    {routeError && <p className="mb-2 text-[11px] text-red-400">{routeError}</p>}
                    <textarea
                        rows={4}
                        className="w-full field-sizing-content min-h-[104px] max-h-[320px] py-1 px-2 outline-1 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                        placeholder={selectedCounterparty ? 'Write an encrypted direct message...' : 'Select or create a conversation first'}
                        disabled={!selectedCounterparty || !canSendInConversation}
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-[12px] text-gray-400">
                            {messageKeyState.status !== 'unlocked'
                                ? 'Unlock messages to decrypt and send.'
                                : (!selectedCounterparty
                                    ? 'Choose a conversation to start sending.'
                                    : (!activeRecipientPoster?.pubkey ? 'Recipient public key unavailable.' : 'Ciphertext is stored in IPFS and sent through the live contract.'))}
                        </p>
                        <button
                            className="h-9 w-27 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer"
                            disabled={!draftMessage.trim() || !canSendInConversation}
                            onClick={handleSendDirectMessage}
                        >
                            {activeConversationSubmitting ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Messages;
