import { useEffect, useReducer, useState } from "react";
import { useLocation } from "react-router";
import { useAppContext } from "./AppContext";
import { getPubkeyWithIdenaIndexerApi, getPubkeyWithRpc, getPosterPromise } from "./logic/asyncUtils";
import { zeroAddress, type MouseEventLocal } from "./App.exports";
import ConversationComponent from "./components/ConversationComponent";
import MediaComponent from "./components/MediaComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import ComposerToolbarComponent from "./components/ComposerToolbarComponent";
import { CloseIcon, UserPlusIcon } from "./components/icons";
import { getMediaKind } from "./logic/media";
import { useInfiniteScroll } from "./logic/useInfiniteScroll";

function Messages() {

    const {
        copyMessageTxHandler,
        submitMessageHandler,
        makePostsWith,
        postersRef,
        rpcClientRef,
        latestConversationActivity,
        submittingMessage,
        inputPostDisabled,
        submitting,
        postMediaAttachmentsRef,
        handleOpenAddMediaModal,
        handleSubmitPubkeyModal,
        handleOpenRpcSendMessageModal,
        messageSettingsInvalid,
        validateCredentials,
        findPostsWithRef,
        indexerApiUrlRef,
    } = useAppContext();

    const [addNewRecipient, setAddNewRecipient] = useState<string>(zeroAddress);
    const [loadingNewRecipient, setLoadingNewRecipient] = useState<boolean>(false);
    const [addressInvalid, setAddressInvalid] = useState<string>('pubkey missing');

    const [recipients, setRecipients] = useState<string[]>([]);

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleConversationKeys, hasMore, sentinelRef } = useInfiniteScroll(latestConversationActivity, locationKey);

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['message-main'];

    useEffect(() => {
        validateCredentials();
    }, []);

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

            let recipient = await getPosterPromise(
                candidate,
                postersRef,
                findPostsWithRef.current === 'indexer-api',
                rpcClientRef.current!,
                indexerApiUrlRef,
            );

            if (!recipient) {
                setAddressInvalid('not found');
                throw 'not found';
            }

            if (!recipient.pubkey) {
                const pubkey = findPostsWithRef.current === 'indexer-api'
                    ? await getPubkeyWithIdenaIndexerApi(indexerApiUrlRef.current, recipient.address)
                    : await getPubkeyWithRpc(rpcClientRef.current!, recipient.address);

                recipient = { ...recipient, pubkey };
                postersRef.current = { ...postersRef.current, [candidate]: recipient };

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
    };

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
    };

    const localSubmitMessageHandler = async (location: string, replyToMessageId?: string) => {
        if (!recipients.length) {
            alert('No recipients');
            return;
        }

        setRecipients([]);

        makePostsWith === 'rpc' ? handleOpenRpcSendMessageModal(location, recipients, replyToMessageId) : submitMessageHandler(location, recipients, replyToMessageId);
    };

    const removeRecipient = (recipient: string) => {
        setRecipients(recipients.filter((item) => item !== recipient));
    };

    return (<>
        <PageHeaderComponent title="Messages" />
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
            {messageSettingsInvalid && <p className="text-[13px] text-danger">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
            <div className="flex flex-col gap-1.5">
                <p className="text-[13px] text-ink-muted">To</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input className="form-field min-w-0 flex-1 text-[12px] md:text-[15px]" placeholder="Recipient address (0x...)" value={addNewRecipient} onChange={e => { setAddressInvalid(''); setAddNewRecipient(e.target.value); }} />
                    <button type="button" className="btn-outline h-8 flex-none self-start px-4 text-[14px] sm:self-auto" disabled={loadingNewRecipient} onClick={() => addRecipient()}>
                        <UserPlusIcon className="size-4" />
                        {loadingNewRecipient ? 'Loading...' : 'Add Recipient'}
                    </button>
                </div>
                {addressInvalid && <div className="flex flex-wrap gap-x-2 text-[13px] text-danger">
                    <span>Invalid address: {addressInvalid}.</span>
                    {addressInvalid === 'pubkey missing' && addNewRecipient !== zeroAddress && <><span className="cursor-pointer text-link hover:underline" onClick={(e) => handleSubmitPubkeyModal(e, addNewRecipient.toLowerCase())}>Manually Provide Pubkey</span><span>then try again</span></>}
                </div>}
            </div>
            {!!recipients.length && <div className="flex flex-col gap-1.5">
                <p className="text-[13px] text-ink-muted">Recipients</p>
                <div className="flex flex-wrap gap-2">
                    {recipients.map(recipient => <div key={recipient} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-line-strong pr-1 pl-3 text-[13px] sm:text-[14px]">
                        <span className="min-w-0 break-all">{recipient}</span>
                        <button type="button" aria-label="Remove recipient" title="Remove recipient" className="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-ink/10" onClick={() => removeRecipient(recipient)}>
                            <CloseIcon className="size-3.5" />
                        </button>
                    </div>)}
                </div>
            </div>}
            <textarea
                id='message-input-main'
                rows={4}
                className="field-sizing-content max-h-[520px] min-h-[104px] w-full resize-none rounded-2xl bg-field px-4 py-3 text-[15px]/5 outline-none scrollbar-thin placeholder:text-ink-muted focus:ring-1 focus:ring-accent"
                placeholder="Start a new message"
                disabled={inputPostDisabled || submitting || messageSettingsInvalid}
            />
            {mainPostMediaAttachment && <div className="relative w-fit max-w-full">
                <MediaComponent className="max-h-120 max-w-full sm:max-w-100 size-auto rounded-2xl border border-line" file={mainPostMediaAttachment.file} />
                {getMediaKind(mainPostMediaAttachment.file.type) !== 'audio' && <button type="button" aria-label="Remove media" title="Remove media" className="absolute top-1 left-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm hover:bg-black/60" onClick={(e) => removeMediaHandler(e, 'main')}>
                    <CloseIcon className="size-[18px]" />
                </button>}
            </div>}
            <ComposerToolbarComponent
                hasAttachment={!!mainPostMediaAttachment}
                onAddImage={(e) => handleOpenAddMediaModal(e, 'main', 'message')}
                onRemoveImage={(e) => removeMediaHandler(e, 'main')}
                copyTxId="message-copytx-main"
                onCopyTx={() => !inputPostDisabled && !submitting && !messageSettingsInvalid && localCopyMessageTxHandler('main')}
                submitText={submittingMessage === 'main' ? 'Sending...' : 'Send'}
                onSubmit={() => localSubmitMessageHandler('main')}
            />
        </div>
        <div>
            {visibleConversationKeys.map(conversationKey => {
                return <ConversationComponent
                    key={conversationKey}
                    conversationKey={conversationKey}
                />;
            })}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default Messages;
