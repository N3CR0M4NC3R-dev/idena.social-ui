import { useEffect, useReducer, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router";
import { getPoster, type Message, type Poster } from "./logic/asyncUtils";
import { getDisplayAddressShort, getDisplayDateTime, getIdentityStatus, getMessageLines } from "./logic/utils";
import { initDomSettings, type BrowserStateHistorySettings, type MouseEventLocal, type PostDomSettings, type PostMediaAttachment } from "./App.exports";
import commentGraySvg from './assets/comment-alt-lines-gray.svg';
import commentBlueSvg from './assets/comment-alt-lines-blue.svg';
import PosterHeaderComponent from "./components/PosterHeaderComponent";

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
    handleOpenRpcSendMessageModal: (location: string, recipient: string, replyToMessageId?: string | undefined) => void,
    messageSettingsInvalid: boolean,
    handleSetInputCredentialsApplied: (newValue: boolean) => Promise<void>,
};

function Messages() {
    const navigate = useNavigate();
    const location = useLocation();

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
        handleOpenRpcSendMessageModal,
        messageSettingsInvalid,
        handleSetInputCredentialsApplied,
    } = useOutletContext() as MessagesProps;

    const [sendMessageToAddress, setSendMessageToAddress] = useState<string>(zeroAddress);
    const [inputSendMessageToAddressApplied, setInputSendMessageToAddressApplied] = useState<boolean>(true);
    const [addressInvalid, setAddressInvalid] = useState<string>('pubKey missing');

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        handleSetInputCredentialsApplied(true);
    }, []);

    const { key: locationKey } = location;

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
            const poster = await getPoster(rpcClientRef.current, sendMessageToAddress, true);

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
            setAddressInvalid('pubKey missing');
            return;
        }

        setAddressInvalid('');
    };

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
    };

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

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['message-main'];

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };
        forceUpdate();
    };

    const localCopyMessageTxHandler = async (location: string, recipient: string, replyToMessageId?: string) => {
        if (location === 'main' && addressInvalid) {
            alert('Invalid recipient address');
            return;
        }
        copyMessageTxHandler(location, recipient, replyToMessageId);
    };

    const localSubmitMessageHandler = async (location: string, recipient: string, replyToMessageId?: string) => {
        if (location === 'main' && addressInvalid) {
            alert('Invalid recipient address');
            return;
        }

        if (!postersRef.current[recipient].pubkey) {
            alert('Recipient pubKey missing');
            return;
        }

        makePostsWith === 'rpc' ? handleOpenRpcSendMessageModal(location, recipient, replyToMessageId) : submitMessageHandler(location, recipient, replyToMessageId);

        const conversation = conversationsRef.current[location];
        if (conversation) {
            setDiscussReplyToPostIdHandler(location);
        }
    };

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <div className="mb-4">
            {messageSettingsInvalid && <p className="mt-1 text-red-400 text-[13px]">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
        </div>
        <div className="mb-4">
            <p className="mb-1">Send message to address:</p>
            <input className="w-full mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputSendMessageToAddressApplied} value={sendMessageToAddress} onChange={e => setSendMessageToAddress(e.target.value)} />
            {addressInvalid && <p className="text-[11px] text-red-400">Invalid address: {addressInvalid}</p>}
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
                const participantsExcludingSelf = conversationKey.split('-').filter(item => item !== postersAddress);
                if (!participantsExcludingSelf.length) {
                    participantsExcludingSelf.push(postersAddress);
                }
                const conversationPartner = postersRef.current[participantsExcludingSelf[0]];

                const conversation = conversationsRef.current[conversationKey];

                if (!browserStateHistoryRef.current[locationKey]?.postDomSettings?.[conversationKey]?.[conversationKey]) {
                    setPostDomSettings(conversationKey, initDomSettings);
                }

                const postDomSettingsItem = browserStateHistoryRef.current[locationKey].postDomSettings?.[conversationKey][conversationKey];
                const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
                const discussReplyToPost = discussReplyToPostId ? messagesRef.current[discussReplyToPostId!] : undefined;

                const postMediaAttachment = postMediaAttachmentsRef.current[`message-${conversationKey}`];

                return <>
                    <div className="flex flex-col py-3 bg-stone-800">
                        <PosterHeaderComponent address={conversationPartner.address} age={conversationPartner.age} state={conversationPartner.state} stake={conversationPartner.stake} />
                        <div className="mt-2.5 ml-4 mr-2 p-2 bg-stone-900 text-[14px]">
                            <ul className="flex flex-col flex-col-reverse max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                                {conversation.map((messageId) => {
                                    const message = messagesRef.current[messageId];
                                    const posterDisplayAddress = getDisplayAddressShort(message.sender);
                                    const posterStake = message.sendersDetails_atTimeOfMessage.stake;
                                    const posterState = message.sendersDetails_atTimeOfMessage.state;
                                    const posterAge = message.sendersDetails_atTimeOfMessage.age;
                                    const { displayDate, displayTime } = getDisplayDateTime(message.timestamp);
                                    const { messageLines } = getMessageLines(message.message);
                                    const replyToMessage = messagesRef.current[message.replyToMessageId];
                                    const awaitingReplyToMessage = message.replyToMessageId && !replyToMessage;

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
                                                        <div className=""><img src={commentGraySvg} onMouseOver={(e) => { e.currentTarget.src = commentBlueSvg; }} onMouseOut={(e) => { e.currentTarget.src = commentGraySvg; }} className={'h-6 p-[0px] -ml-0.5 mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={() => setDiscussReplyToPostIdHandler(conversationKey, messageId)} /></div>
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
                                            <button className="h-7 w-16 mb-1 px-4 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled || messageSettingsInvalid} onClick={() => localSubmitMessageHandler(conversationKey, conversationPartner.address, discussReplyToPostId)}>{submittingMessage === conversationKey ? '...' : 'Send!'}</button>
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
                                    <p id={`message-copytx-${conversationKey}`} className="inline-block -mt-1 ml-2 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={() => localCopyMessageTxHandler(conversationKey, conversationPartner.address, discussReplyToPostId)}>Copy tx</p>
                                </div>
                            </>
                        </div>
                    </div>
                    <div className="mt-10"></div>
                </>;
            })}
        </div>
    </>);
}

export default Messages;
