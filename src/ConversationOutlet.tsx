import { useNavigate, useOutletContext, useParams } from "react-router";
import ConversationComponent from "./components/ConversationComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";
import type { Message, Poster } from "./logic/asyncUtils";
import type { BrowserStateHistorySettings, Conversation, MouseEventLocal, PostMediaAttachment } from "./App.exports";

type ConversationOutletProps = {
    postersAddress: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    conversationsRef: React.RefObject<Record<string, Conversation>>,
    messagesRef: React.RefObject<Record<string, Message>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    inputPostDisabled: boolean,
    submitting: boolean,
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
    handleExpandImageModal: (e: MouseEventLocal, image: File, cid?: string) => void,
    submittingMessage: string,
    submittingLike: string,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    messagePrefix: string,
    noMorePastBlocks: boolean,
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
        submitting,
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
        noMorePastBlocks,
    } = useOutletContext() as ConversationOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    const conversation = conversationsRef.current[conversationKey!];

    const conversationUnavailable = messageSettingsInvalid
        ? <p className="px-8 py-6 text-center text-[15px] text-danger">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>
        : noMorePastBlocks
            ? <p className="px-8 py-6 text-center text-[15px] text-ink-muted">No messages found for this conversation yet.</p>
            : <>
                <LdsSpinnerComponent />
                <p className="px-8 pb-6 text-center text-[15px] text-ink-muted">This conversation hasn't loaded yet. It will appear here once its messages have been scanned. Use “Scan more past blocks” below to search further back.</p>
            </>;

    return (<>
        <PageHeaderComponent title="Conversation" onBack={handleGoBack} />
        {conversation ? <ConversationComponent
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
            submitting={submitting}
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
        /> : conversationUnavailable}
    </>);
}

export default ConversationOutlet;
