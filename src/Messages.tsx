import { useEffect, useReducer, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { getPoster, getPosterWithIndexerApi, getPubkeyWithIdenaIndexerApi, getPubkeyWithRpc, type Message, type Poster } from "./logic/asyncUtils";
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from "./App.exports";
import ConversationComponent from "./components/ConversationComponent";

type MessagesProps = {
    copyMessageTxHandler: (location: string, recipient: string, replyToMessageId?: string | undefined) => Promise<void>,
    submitMessageHandler: (location: string, recipient: string, replyToMessageId?: string) => Promise<void>
    nodeAvailable: boolean,
    makePostsWith: string,
    credentialsInvalid: string,
    viewOnlyNode: boolean,
    zeroAddress: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    rpcClientRef: React.RefObject<((method: string, params: any[], skipStateUpdate?: boolean) => Promise<any>)>,
    latestConversationActivity: string[],
    postersAddress: string,
    conversationsRef: React.RefObject<Record<string, string[]>>,
    messagesRef: React.RefObject<Record<string, Message>>,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    submittingMessage: string,
    inputPostDisabled: boolean,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, dataUrl: string, cid?: string) => void,
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
    handleOpenRpcSendMessageModal: (location: string, recipient: string, replyToMessageId?: string | undefined) => void,
    messageSettingsInvalid: boolean,
    setInputCredentialsApplied: React.Dispatch<React.SetStateAction<boolean>>,
    findPostsWithRef: React.RefObject<string>,
    indexerApiUrlRef: React.RefObject<string>,
    SET_NEW_POSTS_ADDED_DELAY: number,
};

function Messages() {
    const navigate = useNavigate();

    const {
        copyMessageTxHandler,
        submitMessageHandler,
        makePostsWith,
        zeroAddress,
        postersRef,
        rpcClientRef,
        latestConversationActivity,
        postersAddress,
        conversationsRef,
        messagesRef,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        submittingMessage,
        inputPostDisabled,
        postMediaAttachmentsRef,
        handleOpenAddMediaModal,
        handleExpandImageModal,
        handleSubmitPubkeyModal,
        handleOpenRpcSendMessageModal,
        messageSettingsInvalid,
        setInputCredentialsApplied,
        findPostsWithRef,
        indexerApiUrlRef,
        SET_NEW_POSTS_ADDED_DELAY,
    } = useOutletContext() as MessagesProps;

    const [sendMessageToAddress, setSendMessageToAddress] = useState<string>(zeroAddress);
    const [inputSendMessageToAddressApplied, setInputSendMessageToAddressApplied] = useState<boolean>(true);
    const [addressInvalid, setAddressInvalid] = useState<string>('pubkey missing');

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['message-main'];

    useEffect(() => {
        setInputCredentialsApplied(true);
    }, []);

    const handleGoBack = () => {
        navigate(-1);
    };

    const setInputSendMessageToAddressAppliedLocal = async (applied: boolean) => {
        setInputSendMessageToAddressApplied(applied);

        if (!applied) {
            return;
        }

        let recipient = postersRef.current[sendMessageToAddress];

        if (!recipient) {
            const poster = await (findPostsWithRef.current === 'rpc' ? getPoster(rpcClientRef.current, sendMessageToAddress, true) : getPosterWithIndexerApi(indexerApiUrlRef.current, sendMessageToAddress));

            if (poster) {
                postersRef.current[sendMessageToAddress] = poster;
                recipient = poster;
            }
        }

        if (!recipient) {
            setAddressInvalid('not found');
            return;
        }

        if (!recipient.pubkey) {
            if (findPostsWithRef.current === 'indexer-api') {
                const pubkey = await getPubkeyWithIdenaIndexerApi(indexerApiUrlRef.current, recipient.address);
                postersRef.current[sendMessageToAddress].pubkey = pubkey ?? '';
            } else {
                const pubkey = await getPubkeyWithRpc(rpcClientRef.current, recipient.address);
                postersRef.current[sendMessageToAddress].pubkey = pubkey ?? '';
            }

            if (!recipient.pubkey) {
                setAddressInvalid('pubkey missing');
                return;
            }
        }

        setAddressInvalid('');
    }

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };
        forceUpdate();
    };

    const localCopyMessageTxHandler = async (location: string, recipient: string, replyToMessageId?: string) => {
        if (addressInvalid) {
            alert('Invalid recipient address');
            return;
        }
        copyMessageTxHandler(location, recipient, replyToMessageId);
    }

    const localSubmitMessageHandler = async (location: string, recipient: string, replyToMessageId?: string) => {
        if (addressInvalid) {
            alert('Invalid recipient address');
            return;
        }

        if (!postersRef.current[recipient].pubkey) {
            alert('Recipient pubkey missing');
            return;
        }

        makePostsWith === 'rpc' ? handleOpenRpcSendMessageModal(location, recipient, replyToMessageId) : submitMessageHandler(location, recipient, replyToMessageId);
    }

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <div className="mb-4">
            {messageSettingsInvalid && <p className="mt-1 text-red-400 text-[13px]">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
        </div>
        <div className="mb-4">
            <p className="mb-1">Send message to address:</p>
            <input className="w-full mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputSendMessageToAddressApplied} value={sendMessageToAddress} onChange={e => setSendMessageToAddress(e.target.value)} />
            {addressInvalid && <div className="flex gap-2">
                <span className="text-[11px] text-red-400">Invalid address: {addressInvalid}</span>
                {addressInvalid === 'pubkey missing' && sendMessageToAddress !== zeroAddress && <span className="inline text-[11px] text-blue-400 hover:underline hover:cursor-pointer" onClick={(e) => handleSubmitPubkeyModal(e, sendMessageToAddress)}>Manually Provide Pubkey</span>}
            </div>}
            <div>
                <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputSendMessageToAddressApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputSendMessageToAddressAppliedLocal(!inputSendMessageToAddressApplied)}>{inputSendMessageToAddressApplied ? 'Change' : 'Apply'}</button>
                {!inputSendMessageToAddressApplied && <p className="mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
            </div>
        </div>
        <div className="mb-4">
            <p>Message to send:</p>
            <textarea
                id='message-input-main'
                rows={4}
                className="w-full field-sizing-content min-h-[104px] max-h-[520px] py-1 px-2 outline-1 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                placeholder="Write your message here..."
                disabled={inputPostDisabled || messageSettingsInvalid}
            />
            {mainPostMediaAttachment && <div className="mx-4 my-1">
                <img className="max-h-120 max-w-100 size-auto rounded-sm" src={mainPostMediaAttachment.dataUrl} />
            </div>}
            <div className="flex flex-row gap-2">
                <div className="flex-1 -mt-1.5">
                    {mainPostMediaAttachment ? <>
                        <p className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => removeMediaHandler(e, 'main')}>Remove image</p>
                    </> : <>
                        <p className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => handleOpenAddMediaModal(e, 'main', 'message')}>Add image</p>
                    </>}
                    <p id={"message-copytx-main"} className="inline-block -mt-1 ml-2 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={() => !inputPostDisabled && !messageSettingsInvalid && localCopyMessageTxHandler('main', sendMessageToAddress)}>Copy tx</p>
                </div>
                <button className="h-9 w-27 my-1 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => localSubmitMessageHandler('main', sendMessageToAddress)}>{submittingMessage === 'main' ? 'Sending...' : 'Send!'}</button>
            </div>
        </div>
        <div className="mb-4">
            {!!latestConversationActivity.length && latestConversationActivity.map(conversationKey => {
                return <ConversationComponent
                    conversationKey={conversationKey}
                    postersAddress={postersAddress}
                    postersRef={postersRef}
                    conversationsRef={conversationsRef}
                    messagesRef={messagesRef}
                    postMediaAttachmentsRef={postMediaAttachmentsRef}
                    browserStateHistoryRef={browserStateHistoryRef}
                    setBrowserStateHistorySettings={setBrowserStateHistorySettings}
                    inputPostDisabled={inputPostDisabled}
                    messageSettingsInvalid={messageSettingsInvalid}
                    copyMessageTxHandler={copyMessageTxHandler}
                    submitMessageHandler={submitMessageHandler}
                    makePostsWith={makePostsWith}
                    handleOpenRpcSendMessageModal={handleOpenRpcSendMessageModal}
                    SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                    handleSubmitPubkeyModal={handleSubmitPubkeyModal}
                    handleOpenAddMediaModal={handleOpenAddMediaModal}
                    handleExpandImageModal={handleExpandImageModal}
                    submittingMessage={submittingMessage}
                />
            })}
        </div>
    </>);
}

export default Messages;
