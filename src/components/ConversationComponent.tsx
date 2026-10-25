import { getDisplayAddressShort, getDisplayDateTime, getIdentityStatus, getMessageLines, getProfilePic, likeEmoji } from "../logic/utils";
import { initDomSettings, type BrowserStateHistorySettings, type Conversation, type MouseEventLocal, type PostDomSettings, type PostMediaAttachment } from "../App.exports";
import { getChildPostIds, type Message, type Poster } from "../logic/asyncUtils";
import { useLocation, useNavigate } from "react-router";
import { useReducer } from "react";
import OneOnOneConversationHeaderComponent from "./OneOnOneConversationHeaderComponent";
import GroupConversationHeaderComponent from "./GroupConversationHeaderComponent";
import ObjectUrlImageComponent from "./ObjectUrlImageComponent";
import ComposerToolbarComponent from "./ComposerToolbarComponent";
import { CloseIcon, HeartIcon, ReplyIcon } from "./icons";

type ConversationComponentProps = {
    conversationKey: string,
    postersAddress: string,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
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
    messagePrefix: string,
    isConversationOutlet?: boolean,
};

function ConversationComponent(props: ConversationComponentProps) {

    const location = useLocation();
    const navigate = useNavigate();

    const {
        conversationKey,
        postersAddress,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
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
        messagePrefix,
        isConversationOutlet,
    } = props as ConversationComponentProps;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const { key: locationKey } = location;


    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    const getPostDomSettings = (conversationKey: string): PostDomSettings => {
        return browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey]?.[conversationKey] ?? ({ ...initDomSettings, ...(isConversationOutlet && { repliesHidden: false }) });
    };

    const setPostDomSettings = (conversationKey: string, postDomSettings: Partial<PostDomSettings>, rerender?: boolean) => {
        const postDomSettingsUpdated = {
            ...browserStateHistoryRef.current[locationKey]?.postDomSettings ?? {},
            [conversationKey]: {
                ...browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey] ?? {},
                [conversationKey]: {
                    ...getPostDomSettings(conversationKey),
                    ...postDomSettings,
                }
            }
        };

        setBrowserStateHistorySettings({ postDomSettings: postDomSettingsUpdated }, rerender);
    };

    const setDiscussReplyToPostIdHandler = (conversationKey: string, discussReplyToPostId?: string) => {
        setPostDomSettings(conversationKey, { discussReplyToPostId }, true);

        if (inputPostDisabled || submitting || messageSettingsInvalid) {
            return;
        }

        setTimeout(() => {
            const postTextareaElement = document.getElementById(`message-input-${conversationKey}`) as HTMLTextAreaElement;
            postTextareaElement.focus();
        }, 20);
    };

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };
        forceUpdate();
    };

    const localCopyMessageTxHandler = async (location: string, recipients: string[], replyToMessageId?: string) => {
        copyMessageTxHandler(location, recipients, replyToMessageId);
    };

    const localSubmitMessageHandler = async (location: string, recipients: string[], replyToMessageId?: string) => {
        if (inputPostDisabled || submitting || messageSettingsInvalid) {
            return;
        }

        if (recipients.some(recipient => !postersRef.current[recipient].pubkey)) {
            alert('Recipient pubkey missing');
            return;
        }

        makePostsWith === 'rpc' ? handleOpenRpcSendMessageModal(location, recipients, replyToMessageId) : submitMessageHandler(location, recipients, replyToMessageId);

        const conversation = conversationsRef.current[location];
        if (conversation) {
            setDiscussReplyToPostIdHandler(location);
        }
    };

    const localSubmitLikeHandler = async (location: string, recipients: string[], replyToMessageId: string) => {
        if (inputPostDisabled || submitting || messageSettingsInvalid) {
            return;
        }

        await submitMessageLikeHandler(likeEmoji, location, recipients, replyToMessageId);
    };

    const toggleShowConversationHandler = (e: MouseEventLocal, conversationKey: string) => {
        e.stopPropagation();

        const newRepliesHidden = !getPostDomSettings(conversationKey).repliesHidden;
        setPostDomSettings(conversationKey, { repliesHidden: newRepliesHidden }, true);

        if (!newRepliesHidden) {
            setTimeout(() => {
                const messageInputTextareaElement = document.getElementById(`message-input-${conversationKey}`) as HTMLTextAreaElement;
                messageInputTextareaElement.focus();
            }, SET_NEW_POSTS_ADDED_DELAY);
        }
    };

    const handleConversationClick = (conversationKey: string) => {
        const to = `/conversation/${conversationKey}`;
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    const conversation = conversationsRef.current[conversationKey];
    const messages = conversation.messages.map((messageId) => messagesRef.current[messageId]).filter(message => !message.isLike);
    const participants = conversation.participants;

    const participantsExcludingSelf = participants.filter(item => item.toLowerCase() !== postersAddress.toLowerCase());
    if (!participantsExcludingSelf.length) {
        participantsExcludingSelf.push(postersAddress.toLowerCase());
    }
    const conversationPartners = participantsExcludingSelf.map(participant => postersRef.current[participant]);

    const postDomSettingsItem = getPostDomSettings(conversationKey);
    const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
    const discussReplyToPost = discussReplyToPostId ? messagesRef.current[discussReplyToPostId!] : undefined;

    const showReplies = !postDomSettingsItem.repliesHidden;

    const postMediaAttachment = postMediaAttachmentsRef.current[`message-${conversationKey}`];

    return <>
        <div className={`flex flex-col gap-1 border-b border-line px-4 py-3 ${!isConversationOutlet ? 'cursor-pointer hover:bg-ink/[0.03]' : ''}`} onClick={() => handleConversationClick(conversationKey)}>
            {conversationPartners.length === 1
                ? <OneOnOneConversationHeaderComponent conversationPartner={conversationPartners[0]} handleSubmitPubkeyModal={handleSubmitPubkeyModal} />
                : <GroupConversationHeaderComponent conversationPartners={conversationPartners} handleSubmitPubkeyModal={handleSubmitPubkeyModal} />}
            <button type="button" className={`self-start cursor-pointer text-[13px] text-accent hover:underline ${conversationPartners.length === 1 ? 'ml-[52px]' : ''}`} onClick={(e) => toggleShowConversationHandler(e, conversationKey)}>Messages ({messages.length})</button>
        </div>
        {showReplies && <div className="border-b border-line">
            <ul className="flex flex-col flex-col-reverse gap-3 max-h-100 overflow-y-auto scrollbar-thin px-4 py-3">
                {messages.map((message) => {
                    const posterDisplayAddress = getDisplayAddressShort(message.sender);
                    const posterStake = message.sendersDetails_atTimeOfMessage.stake;
                    const posterState = message.sendersDetails_atTimeOfMessage.state;
                    const posterAge = message.sendersDetails_atTimeOfMessage.age;
                    const posterPic = getProfilePic(postersRef.current[message.sender], posterState);
                    const { displayDate, displayTime } = getDisplayDateTime(message.timestamp);
                    const { messageLines } = getMessageLines(message.message);
                    const replyToMessage = messagesRef.current[message.replyToMessageId];
                    const replyToMessagePosterPic = getProfilePic(postersRef.current[replyToMessage?.sender], replyToMessage?.sendersDetails_atTimeOfMessage.state);
                    const awaitingReplyToMessage = message.replyToMessageId && !replyToMessage;

                    const messageParentId = messagePrefix + message.messageId;
                    const repliesToThisMessage = [ ...getChildPostIds(messageParentId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(messageParentId, deOrphanedReplyPostsTreeRef.current) ];
                    const replyMessages = repliesToThisMessage.map(replyMessageId => messagesRef.current[replyMessageId]);
                    const replyLikes = replyMessages.filter(replyMessage => replyMessage.isLike);

                    const isOwnMessage = message.sender === postersAddress.toLowerCase();

                    return (
                        <li key={message.messageId} className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                            {!isOwnMessage && <ObjectUrlImageComponent className="mb-8 size-8 flex-none rounded-full bg-surface object-cover" file={posterPic} />}
                            <div className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                                <span className={`cursor-pointer text-[13px] font-bold hover:underline ${isOwnMessage ? 'text-ink-muted' : ''}`} title={`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`} onClick={(e) => handleClickAddress(e, `/profile/${message.sender}`)}>{posterDisplayAddress}</span>
                                {replyToMessage && <div className="flex max-w-full items-center gap-1.5 rounded-2xl border border-line px-3 py-1.5 text-[13px] text-ink-muted">
                                    {!awaitingReplyToMessage && <ObjectUrlImageComponent className="size-4 flex-none rounded-full bg-surface object-cover" file={replyToMessagePosterPic} />}
                                    {awaitingReplyToMessage ?
                                        <p className="min-w-0 truncate">Reply to message loading...</p>
                                        :
                                        <p className="min-w-0 truncate">{getMessageLines(replyToMessage.message).messageLines[0]}</p>
                                    }
                                </div>}
                                <p className={`max-w-full rounded-3xl px-4 py-2.5 text-[15px]/5 [word-break:break-word] empty:hidden ${isOwnMessage ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-field text-ink'}`}>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                {message.image && <ObjectUrlImageComponent className="max-h-80 max-w-full sm:max-w-74 size-auto cursor-pointer rounded-2xl border border-line" file={message.image} onClick={(e) => handleExpandImageModal(e, message.image!, message.cid)} />}
                                <div className={`flex items-center gap-1 text-[13px] text-ink-muted ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                                    <a className="whitespace-nowrap hover:underline" href={`https://scan.idena.io/transaction/${message.txHash}`} target="_blank" rel="noopener noreferrer">{`${displayDate}, ${displayTime}`}</a>
                                    <button type="button" aria-label="Reply" title="Reply" className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-accent/20 hover:text-accent" onClick={() => setDiscussReplyToPostIdHandler(conversationKey, message.messageId)}>
                                        <ReplyIcon className="size-4" />
                                    </button>
                                    <div className={`flex items-center ${replyLikes.length ? 'text-like' : ''}`}>
                                        <button type="button" aria-label="Like" title="Like" className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-like/20 hover:text-like ${submittingLike === message.messageId ? 'bg-like/10 text-like' : ''}`} onClick={() => localSubmitLikeHandler(conversationKey, participantsExcludingSelf, message.messageId)}>
                                            <HeartIcon className="size-4" />
                                        </button>
                                        {!!replyLikes.length && <button type="button" className="cursor-pointer pr-1 hover:underline" onClick={(e) => handleOpenLikesModal(e, replyLikes)}>{replyLikes.length}</button>}
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                {discussReplyToPost && <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                    <p className="min-w-0 flex-1 truncate">Replying to {getDisplayAddressShort(discussReplyToPost!.sender)}: {getMessageLines(discussReplyToPost!.message).messageLines[0]}</p>
                    <button type="button" aria-label="Cancel reply" title="Cancel reply" className="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-ink/10" onClick={() => setDiscussReplyToPostIdHandler(conversationKey)}>
                        <CloseIcon className="size-3.5" />
                    </button>
                </div>}
                <textarea
                    id={`message-input-${conversationKey}`}
                    rows={2}
                    className="field-sizing-content max-h-[312px] min-h-[44px] w-full resize-none rounded-2xl bg-field px-4 py-2.5 text-[15px]/5 outline-none scrollbar-thin placeholder:text-ink-muted focus:ring-1 focus:ring-accent"
                    placeholder="Start a new message"
                    disabled={inputPostDisabled || submitting || messageSettingsInvalid}
                />
                {postMediaAttachment && <div className="relative w-fit">
                    <ObjectUrlImageComponent className="max-h-80 max-w-full sm:max-w-74 size-auto rounded-2xl border border-line" file={postMediaAttachment.file} />
                    <button type="button" aria-label="Remove image" title="Remove image" className="absolute top-1 left-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm hover:bg-black/60" onClick={(e) => removeMediaHandler(e, conversationKey)}>
                        <CloseIcon className="size-[18px]" />
                    </button>
                </div>}
                <ComposerToolbarComponent
                    compact
                    hasAttachment={!!postMediaAttachment}
                    onAddImage={(e) => handleOpenAddMediaModal(e, conversationKey, 'message')}
                    onRemoveImage={(e) => removeMediaHandler(e, conversationKey)}
                    copyTxId={`message-copytx-${conversationKey}`}
                    onCopyTx={() => localCopyMessageTxHandler(conversationKey, participantsExcludingSelf, discussReplyToPostId)}
                    submitText={submittingMessage === conversationKey ? '...' : 'Send'}
                    onSubmit={() => localSubmitMessageHandler(conversationKey, participantsExcludingSelf, discussReplyToPostId)}
                    submitDisabled={inputPostDisabled || submitting || messageSettingsInvalid}
                />
            </div>
        </div>}
    </>;
}

export default ConversationComponent;
