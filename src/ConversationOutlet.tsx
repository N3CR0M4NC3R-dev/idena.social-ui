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
    copyMessageTxHandler: (location: string, recipients: string[], replyToMessageId?: string | undefined) => Promise<void>,
    submitMessageHandler: (location: string, recipients: string[], replyToMessageId?: string) => Promise<void>,
    submitMessageLikeHandler: (emoji: string, location: string, recipients: string[], replyToMessageId: string) => Promise<void>,
    makePostsWith: string,
    handleOpenRpcSendMessageModal: (location: string, recipients: string[], replyToMessageId?: string | undefined) => void,
    SET_NEW_POSTS_ADDED_DELAY: number,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Message[]) => void,
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, dataUrl: string, cid?: string) => void,
    submittingMessage: string,
    submittingLike: string,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    messagePrefix: string,
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
        submitMessageLikeHandler,
        makePostsWith,
        handleOpenRpcSendMessageModal,
        SET_NEW_POSTS_ADDED_DELAY,
        handleOpenLikesModal,
        handleSubmitPubkeyModal,
        handleOpenAddMediaModal,
        handleExpandImageModal,
        submittingMessage,
        submittingLike,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        messagePrefix,
    } = useOutletContext() as ConversationOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <ConversationComponent
            conversationKey={conversationKey!}
            postersAddress={postersAddress}
            replyPostsTreeRef={replyPostsTreeRef}
            deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
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
            submitMessageLikeHandler={submitMessageLikeHandler}
            makePostsWith={makePostsWith}
            handleOpenRpcSendMessageModal={handleOpenRpcSendMessageModal}
            SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
            handleOpenLikesModal={handleOpenLikesModal}
            handleSubmitPubkeyModal={handleSubmitPubkeyModal}
            handleOpenAddMediaModal={handleOpenAddMediaModal}
            handleExpandImageModal={handleExpandImageModal}
            submittingMessage={submittingMessage}
            submittingLike={submittingLike}
            messagePrefix={messagePrefix}
            isConversationOutlet={true}
        />
    </>);
}

export default ConversationOutlet;
