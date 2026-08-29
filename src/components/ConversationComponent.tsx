import { getDisplayAddressShort, getDisplayDateTime, getIdentityStatus, getMessageLines, likeEmoji } from "../logic/utils";
import commentGraySvg from '../assets/comment-alt-lines-gray.svg';
import commentBlueSvg from '../assets/comment-alt-lines-blue.svg';
import heartGraySvg from '../assets/heart-gray.svg';
import heartRedSvg from '../assets/heart-red.svg';
import { initDomSettings, type BrowserStateHistorySettings, type MouseEventLocal, type PostDomSettings, type PostMediaAttachment } from "../App.exports";
import { getChildPostIds, type Message, type Poster } from "../logic/asyncUtils";
import { useLocation, useNavigate } from "react-router";
import { useReducer } from "react";
import OneOnOneConversationHeaderComponent from "./OneOnOneConversationHeaderComponent";
import GroupConversationHeaderComponent from "./GroupConversationHeaderComponent";

type ConversationComponentProps = {
    conversationKey: string,
    postersAddress: string,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
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

    const setPostDomSettings = (conversationKey: string, postDomSettings: Partial<PostDomSettings>, rerender?: boolean) => {
        const postDomSettingsUpdated = {
            ...browserStateHistoryRef.current[locationKey]?.postDomSettings ?? {},
            [conversationKey]: {
                ...browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey] ?? {},
                [conversationKey]: {
                    ...(browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey]?.[conversationKey] ?? initDomSettings),
                    ...postDomSettings,
                }
            }
        };

        setBrowserStateHistorySettings({ postDomSettings: postDomSettingsUpdated }, rerender);
    }

    const setDiscussReplyToPostIdHandler = (conversationKey: string, discussReplyToPostId?: string) => {
        setPostDomSettings(conversationKey, { discussReplyToPostId }, true);

        if (inputPostDisabled || messageSettingsInvalid) {
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
    }

    const localSubmitMessageHandler = async (location: string, recipients: string[], replyToMessageId?: string) => {
        if (inputPostDisabled || messageSettingsInvalid) {
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
    }

    const localSubmitLikeHandler = async (location: string, recipients: string[], replyToMessageId: string) => {
        if (inputPostDisabled || messageSettingsInvalid) {
            return;
        }

        await submitMessageLikeHandler(likeEmoji, location, recipients, replyToMessageId);
    }

    const toggleShowConversationHandler = (e: MouseEventLocal, conversationKey: string) => {
        e.stopPropagation();

        const newRepliesHidden = !browserStateHistoryRef.current[locationKey].postDomSettings?.[conversationKey][conversationKey].repliesHidden;
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

    const conversation = conversationsRef.current[conversationKey].map((messageId) => messagesRef.current[messageId]).filter(message => !message.isLike);

    const participants = conversation[0].participants;

    const participantsExcludingSelf = participants.filter(item => item !== postersAddress);
    if (!participantsExcludingSelf.length) {
        participantsExcludingSelf.push(postersAddress);
    }
    const conversationPartners = participantsExcludingSelf.map(participant => postersRef.current[participant]);

    if (!browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey]?.[conversationKey]) {
        const domSettings = { ...initDomSettings, ...(isConversationOutlet && { repliesHidden: false }) };
        setPostDomSettings(conversationKey, domSettings);
    } 

    const postDomSettingsItem = browserStateHistoryRef.current[locationKey].postDomSettings?.[conversationKey][conversationKey];
    const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
    const discussReplyToPost = discussReplyToPostId ? messagesRef.current[discussReplyToPostId!] : undefined;

    const showReplies = !postDomSettingsItem.repliesHidden;

    const postMediaAttachment = postMediaAttachmentsRef.current[`message-${conversationKey}`];

    return <>
        <div className="flex flex-col pt-3 pb-2 bg-stone-800 hover:cursor-pointer" onClick={() => handleConversationClick(conversationKey)}>
            {conversationPartners.length === 1
            ? <OneOnOneConversationHeaderComponent conversationPartner={conversationPartners[0]} handleSubmitPubkeyModal={handleSubmitPubkeyModal} />
            : <GroupConversationHeaderComponent conversationPartners={conversationPartners} handleSubmitPubkeyModal={handleSubmitPubkeyModal} />}
            <div className="ml-3 flex gap-2">
                <span className="inline text-[11px] text-blue-400 hover:underline hover:cursor-pointer" onClick={(e) => toggleShowConversationHandler(e, conversationKey)}>Messages ({conversation.length})</span>
            </div>
        </div>
        {showReplies && <div className="bg-stone-800 pt-1 pb-2">
            <div className="mt-1.5 ml-4 mr-2 p-2 bg-stone-900 text-[14px]">
                <ul className="flex flex-col flex-col-reverse max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                    {conversation.map((message) => {
                        const posterDisplayAddress = getDisplayAddressShort(message.sender);
                        const posterStake = message.sendersDetails_atTimeOfMessage.stake;
                        const posterState = message.sendersDetails_atTimeOfMessage.state;
                        const posterAge = message.sendersDetails_atTimeOfMessage.age;
                        const { displayDate, displayTime } = getDisplayDateTime(message.timestamp);
                        const { messageLines } = getMessageLines(message.message);
                        const replyToMessage = messagesRef.current[message.replyToMessageId];
                        const awaitingReplyToMessage = message.replyToMessageId && !replyToMessage;

                        const messageParentId = messagePrefix + message.messageId;
                        const repliesToThisMessage = [ ...getChildPostIds(messageParentId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(messageParentId, deOrphanedReplyPostsTreeRef.current) ];
                        const replyMessages = repliesToThisMessage.map(replyMessageId => messagesRef.current[replyMessageId]);
                        const replyLikes = replyMessages.filter(replyMessage => replyMessage.message === likeEmoji);

                        return (
                            <li key={message.messageId} className="hover:bg-stone-800">
                                <div className="my-1.5 flex flex-col">
                                    {replyToMessage && <div className="flex flex-row">
                                        <div className="w-8 flex justify-end items-end">
                                            <div className="h-2.5 w-4 border-t-1 border-l-1 border-gray-500"></div>
                                        </div>
                                        <div className="flex-1 flex flex-row mr-3">
                                            <div className="w-5">{!awaitingReplyToMessage && <img src={`https://robohash.org/${replyToMessage?.sender}?set=set1`} />}</div>
                                            <div className="flex-1 text-nowrap overflow-hidden">
                                                {awaitingReplyToMessage ?
                                                    <p className="max-w-[120px] text-[12px] text-gray-500">Reply to message loading...</p>
                                                    :
                                                    <p className="max-w-[120px] text-[12px] text-gray-500">{getMessageLines(replyToMessage.message).messageLines[0]}</p>
                                                }
                                            </div>
                                        </div>
                                    </div>}
                                    <div className="flex flex-row">
                                        <div className="w-9 flex-none flex flex-col">
                                            <div className="h-11 flex-none">
                                                <img src={`https://robohash.org/${message.sender}?set=set1`} />
                                            </div>
                                            <div className="flex-1"></div>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <div className="mx-1 flex flex-row items-center overflow-hidden">
                                                <div className="flex-1">
                                                    <span className="text-[14px] font-[600] hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/address/${message.sender}`)}>{posterDisplayAddress}</span>
                                                    <span className="ml-1 text-[9px] align-[2px]">{`(${posterAge}, ${getIdentityStatus(posterState)}, ${posterStake})`}</span>
                                                </div>
                                                <div>
                                                    <p className="mx-1 text-[10px] text-stone-500 font-[700] hover:underline"><a className="break-all" href={`https://scan.idena.io/transaction/${message.txHash}`} target="_blank" rel="noopener noreferrer">{`${displayDate}, ${displayTime}`}</a></p>
                                                </div>
                                            </div>
                                            <div className="max-h-[9999px] pl-1 pr-2 pt-0.5 pb-1 text-[12px] text-wrap leading-5 overflow-hidden">
                                                <p className="[word-break:break-word]">{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                            </div>
                                            {message.image && <div className="my-1 mx-1">
                                                <img className="max-h-80 max-w-full sm:max-w-74 size-auto rounded-sm hover:cursor-pointer" src={message.image} onClick={(e) => handleExpandImageModal(e, message.image!, message.cid)} />
                                            </div>}
                                        </div>
                                        <div className="pt-0.5 mr-1 text-[12px] flex flex-col gap-0.5">
                                            <div className=""><img src={commentGraySvg} onMouseOver={(e) => { e.currentTarget.src = commentBlueSvg; }} onMouseOut={(e) => { e.currentTarget.src = commentGraySvg; }} className={'h-6 p-[0px] -ml-0.5 mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={() => setDiscussReplyToPostIdHandler(conversationKey, message.messageId)} /></div>
                                            {replyLikes.length ?
                                                <div className="text-red-400 text-left whitespace-nowrap"><img src={heartRedSvg} className={'h-5 p-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === message.messageId ? ' bg-red-400/30' : '')} onClick={() => localSubmitLikeHandler(conversationKey, participantsExcludingSelf, message.messageId)} /><a className="text-red-400 ml-[1px] align-[-1px] hover:underline cursor-pointer" onClick={(e) => handleOpenLikesModal(e, replyLikes)}>{replyLikes.length}</a></div>
                                            :
                                                <div className="text-gray-500 text-left"><img src={heartGraySvg} onMouseOver={(e) => { e.currentTarget.src = heartRedSvg; }} onMouseOut={(e) => { e.currentTarget.src = heartGraySvg; }} className={'h-5 p-[2px] inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === message.messageId ? ' bg-red-400/30' : '')} onClick={() => localSubmitLikeHandler(conversationKey, participantsExcludingSelf, message.messageId)} /></div>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <>
                    {discussReplyToPost && <div className="w-full mt-1 px-1 flex flex-row bg-stone-800">
                        <div className="flex-1 overflow-hidden text-nowrap text-[12px] text-gray-500"><p className="mt-[1px]">Replying to {getDisplayAddressShort(discussReplyToPost!.sender)}: {getMessageLines(discussReplyToPost!.message).messageLines[0]}</p></div>
                        <div className="w-6 text-right">
                            <button className="text-[10px] align-[2.5px] h-4 w-5 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => setDiscussReplyToPostIdHandler(conversationKey)}>✖</button>
                        </div>
                    </div>}
                    <div className="mt-1 flex flex-col">
                        <div className="flex flex-row gap-2 items-end">
                            <div className="flex-1">
                                <textarea
                                    id={`message-input-${conversationKey}`}
                                    rows={2}
                                    className="w-full field-sizing-content max-w-[385px] min-h-[26px] max-h-[312px] py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500 text-[12px] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                                    placeholder="Comment here..."
                                    disabled={inputPostDisabled || messageSettingsInvalid}
                                />
                            </div>
                            <div>
                                <button className="h-7 w-16 mb-1 px-4 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled || messageSettingsInvalid} onClick={() => localSubmitMessageHandler(conversationKey, participantsExcludingSelf, discussReplyToPostId)}>{submittingMessage === conversationKey ? '...' : 'Send!'}</button>
                            </div>
                        </div>
                    </div>
                    {postMediaAttachment && <div className="my-1">
                        <img className="max-h-80 max-w-full sm:max-w-74 size-auto rounded-sm" src={postMediaAttachment.dataUrl} />
                    </div>}
                    <div className="leading-[12px]">
                        {postMediaAttachment ? <>
                            <p className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => removeMediaHandler(e, conversationKey)}>Remove image</p>
                        </> : <>
                            <p className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => handleOpenAddMediaModal(e, conversationKey, 'message')}>Add image</p>
                        </>}
                        <p id={`message-copytx-${conversationKey}`} className="inline-block -mt-1 ml-2 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={() => localCopyMessageTxHandler(conversationKey, participantsExcludingSelf, discussReplyToPostId)}>Copy tx</p>
                    </div>
                </>
            </div>
        </div>}
        <div className="mt-10"></div>
    </>;
}

export default ConversationComponent;
