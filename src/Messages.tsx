import { useEffect, useReducer, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { getPoster, getPosterWithIndexerApi, getPubkeyWithIdenaIndexerApi, getPubkeyWithRpc, type Message, type Poster } from "./logic/asyncUtils";
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from "./App.exports";
import ConversationComponent from "./components/ConversationComponent";

type MessagesProps = {
    copyMessageTxHandler: (location: string, recipients: string[], replyToMessageId?: string | undefined) => Promise<void>,
    submitMessageHandler: (location: string, recipients: string[], replyToMessageId?: string) => Promise<void>
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
    handleOpenRpcSendMessageModal: (location: string, recipients: string[], replyToMessageId?: string | undefined) => void,
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

    const [addNewRecipient, setAddNewRecipient] = useState<string>(zeroAddress);
    const [loadingNewRecipient, setLoadingNewRecipient] = useState<boolean>(false);
    const [addressInvalid, setAddressInvalid] = useState<string>('pubkey missing');

    const [recipients, setRecipients] = useState<string[]>([]);

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['message-main'];

    useEffect(() => {
        setInputCredentialsApplied(true);
    }, []);

    const handleGoBack = () => {
        navigate(-1);
    };

    const addRecipient = async () => {

        try {
            setLoadingNewRecipient(true);

            const candidate = addNewRecipient.toLowerCase();

            if (candidate === zeroAddress) {
                throw 'cannot add zero address';
            }

            if (recipients.includes(candidate)) {
                throw 'already a recipient';
            }

            let recipient = postersRef.current[candidate];

            if (!recipient) {
                const poster = await (findPostsWithRef.current === 'rpc' ? getPoster(rpcClientRef.current, candidate, true) : getPosterWithIndexerApi(indexerApiUrlRef.current, candidate));

                if (poster) {
                    postersRef.current[candidate] = poster;
                    recipient = poster;
                }
            }

            if (!recipient) {
                setAddressInvalid('not found');
                throw 'not found';
            }

            if (!recipient.pubkey) {
                if (findPostsWithRef.current === 'indexer-api') {
                    const pubkey = await getPubkeyWithIdenaIndexerApi(indexerApiUrlRef.current, recipient.address);
                    postersRef.current[candidate].pubkey = pubkey ?? '';
                } else {
                    const pubkey = await getPubkeyWithRpc(rpcClientRef.current, recipient.address);
                    postersRef.current[candidate].pubkey = pubkey ?? '';
                }

                if (!recipient.pubkey) {
                    setAddressInvalid('pubkey missing');
                    throw 'pubkey missing';
                }
            }

            setAddressInvalid('');
            setAddNewRecipient('');

            setRecipients(current => [ ...current, candidate ]);

        } catch (error) {
            alert(error);
        } finally {
            setLoadingNewRecipient(false);
        }
    }

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };
        forceUpdate();
    };

    const localCopyMessageTxHandler = async (location: string, replyToMessageId?: string) => {
        if (!recipients.length) {
            alert('No recipients');
            return;
        }
        copyMessageTxHandler(location, recipients, replyToMessageId);
    }

    const localSubmitMessageHandler = async (location: string, replyToMessageId?: string) => {
        if (!recipients.length) {
            alert('No recipients');
            return;
        }

        setRecipients([]);

        makePostsWith === 'rpc' ? handleOpenRpcSendMessageModal(location, recipients, replyToMessageId) : submitMessageHandler(location, recipients, replyToMessageId);
    }

    const removeRecipient = (recipient: string) => {
        setRecipients(recipients.filter((item) => item !== recipient));
    }

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <div className="mb-4">
            {messageSettingsInvalid && <p className="mt-1 text-red-400 text-[13px]">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
        </div>
        <div className="mb-4">
            <p className="mb-1">Add recipient address:</p>
            <input className="w-full mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" value={addNewRecipient} onChange={e => { setAddressInvalid(''); setAddNewRecipient(e.target.value); }} />
            {addressInvalid && <div className="flex gap-2 text-[11px] text-red-400">
                <span>Invalid address: {addressInvalid}.</span>
                {addressInvalid === 'pubkey missing' && addNewRecipient !== zeroAddress && <><span className="text-blue-400 hover:underline hover:cursor-pointer" onClick={(e) => handleSubmitPubkeyModal(e, addNewRecipient)}>Manually Provide Pubkey</span><span>then try again</span></>}
            </div>}
            <div>
                <button className="h-7 w-30 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer bg-white/10" disabled={loadingNewRecipient} onClick={() => addRecipient()}>{loadingNewRecipient ? 'Loading...' : 'Add Recipient'}</button>
            </div>
        </div>
        {recipients.length && <div className="mb-4">
            <p>Recipients:</p>
            {recipients.map(recipient => <><p className="inline">{recipient}</p><button className="ml-2 text-[10px] align-[2.5px] h-4 w-5 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => removeRecipient(recipient)}>✖</button></>)}
        </div>}
        <div className="mb-4">
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
                    <p id={"message-copytx-main"} className="inline-block -mt-1 ml-2 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={() => !inputPostDisabled && !messageSettingsInvalid && localCopyMessageTxHandler('main')}>Copy tx</p>
                </div>
                <button className="h-9 w-27 my-1 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => localSubmitMessageHandler('main')}>{submittingMessage === 'main' ? 'Sending...' : 'Send!'}</button>
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
