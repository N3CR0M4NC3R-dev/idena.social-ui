import { useNavigate, useOutletContext, useParams } from "react-router";
import ConversationComponent from "./components/ConversationComponent";
import type { Message, Poster } from "./logic/asyncUtils";
import type { BrowserStateHistorySettings, MouseEventLocal, PostMediaAttachment } from "./App.exports";

type ConversationOutletProps = {
    postersAddress: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    conversationsRef: React.RefObject<Record<string, string[]>>,
    messagesRef: React.RefObject<Record<string, Message>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    inputPostDisabled: boolean,
    messageSettingsInvalid: boolean,
    copyMessageTxHandler: (location: string, recipient: string, replyToMessageId?: string | undefined) => Promise<void>,
    submitMessageHandler: (location: string, recipient: string, replyToMessageId?: string) => Promise<void>,
    makePostsWith: string,
    handleOpenRpcSendMessageModal: (location: string, recipient: string, replyToMessageId?: string | undefined) => void,
    SET_NEW_POSTS_ADDED_DELAY: number,
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, dataUrl: string, cid?: string) => void,
    submittingMessage: string,
};

function ConversationOutlet() {
    const { conversationKey } = useParams();
    const navigate = useNavigate();

    const {
        postersAddress,
        postersRef,
        conversationsRef,
        messagesRef,
        postMediaAttachmentsRef,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        inputPostDisabled,
        messageSettingsInvalid,
        copyMessageTxHandler,
        submitMessageHandler,
        makePostsWith,
        handleOpenRpcSendMessageModal,
        SET_NEW_POSTS_ADDED_DELAY,
        handleSubmitPubkeyModal,
        handleOpenAddMediaModal,
        handleExpandImageModal,
        submittingMessage,
    } = useOutletContext() as ConversationOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <ConversationComponent
            conversationKey={conversationKey!}
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
            isConversationOutlet={true}
        />
    </>);
}

export default ConversationOutlet;
