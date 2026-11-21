import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Message, Post, Poster, PostTips, RpcClient, Tip } from './logic/asyncUtils';
import type { BrowserStateHistorySettings, Conversation, ModerationRequest, MouseEventLocal, PostActivityItem, PostMediaAttachment, ProfileActivity } from './App.exports';
import type { ModeratorRole } from './logic/moderation';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Everything App shares with its routed pages and the post/conversation components they render.
// App builds a fresh value every render, so consumers re-render with it and see the refs' latest .current;
// don't memoize the value, or ref reads during render go stale.
export type AppContextValue = {
    // settings
    nodeUrl: string,
    setNodeUrl: SetState<string>,
    nodeAvailable: boolean,
    nodeKey: string,
    setNodeKey: SetState<string>,
    makePostsWith: string,
    setMakePostsWith: SetState<string>,
    handleMakePostsWithToggle: (value: string) => void,
    webAppUrl: string,
    setWebAppUrl: SetState<string>,
    viewOnlyNode: boolean,
    postersAddress: string,
    postersAddressInvalid: boolean,
    validatePostersAddress: (postersAddress: string) => void,
    findPostsWith: string,
    findPostsWithRef: RefObject<string>,
    handleInputFindPostsWithToggle: (value: string) => void,
    indexerApiUrl: string,
    indexerApiUrlRef: RefObject<string>,
    setIndexerApiUrl: SetState<string>,
    indexerApiUrlInvalid: boolean,
    applyIndexerApiUrl: (indexerApiUrl: string) => void,
    encryptedPrivateKey: string,
    setEncryptedPrivateKey: SetState<string>,
    password: string,
    setPassword: SetState<string>,
    credentialsInvalid: string,
    validateCredentials: (encryptedPrivateKey?: string, password?: string) => void,
    saveEncryptedKey: boolean,
    setSaveEncryptedKey: SetState<boolean>,
    savePassword: boolean,
    setSavePassword: SetState<boolean>,
    messageSettingsInvalid: boolean,
    rpcClientRef: RefObject<RpcClient | undefined>,
    noMorePastBlocks: boolean,

    // posts
    latestPosts: string[],
    latestActivity: string[],
    postLatestActivityRef: RefObject<Record<string, number>>,
    postsRef: RefObject<Record<string, Post>>,
    postersRef: RefObject<Record<string, Poster>>,
    replyPostsTreeRef: RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: RefObject<Record<string, string>>,
    tipsRef: RefObject<Record<string, Tip>>,
    postTipsRef: RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: RefObject<Record<string, PostMediaAttachment | undefined>>,
    profileActivityRef: RefObject<Record<string, ProfileActivity>>,
    postActivityRef: RefObject<Map<string, PostActivityItem>>,
    unreadPostActivityThisVisitRef: RefObject<Set<string>>,
    browserStateHistoryRef: RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,

    // messages
    latestConversationActivity: string[],
    conversationsRef: RefObject<Record<string, Conversation>>,
    messagesRef: RefObject<Record<string, Message>>,
    messageReadStatusRef: RefObject<Map<string, boolean>>,
    unreadMessagesThisVisitRef: RefObject<Map<string, string>>,

    // submitting
    inputPostDisabled: boolean,
    submitting: boolean,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    submittingMessage: string,
    copyPostTxHandler: (location: string, replyToPostId?: string, channelId?: string) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string, channelId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string, channelId?: string) => Promise<void>,
    copyMessageTxHandler: (location: string, recipients: string[], replyToMessageId?: string) => Promise<void>,
    submitMessageHandler: (location: string, recipients: string[], replyToMessageId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => Promise<void>,
    submitMessageLikeHandler: (emoji: string, location: string, recipients: string[], replyToMessageId: string) => Promise<void>,
    retryPostMediaHandler: (postId: string) => Promise<boolean>,
    retryMessageMediaHandler: (messageId: string) => Promise<boolean>,

    // modals
    handleOpenLikesModal: (e: MouseEventLocal, likes: (Post | Message)[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, txHashes: string[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, location: string, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleOpenRpcSendMessageModal: (location: string, recipients: string[], replyToMessageId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, image: File, cid?: string) => void,
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
    handleOpenEditProfileModal: (e: MouseEventLocal) => void,

    // moderation
    moderatorRole: ModeratorRole | undefined,
    moderatorVerified: boolean,
    handleOpenModerationSheet: (e: MouseEventLocal | undefined, request: ModerationRequest) => void,
    handleOpenVerifyModal: () => void,
    revealedPostIdsRef: RefObject<Set<string>>,
    revealPostHandler: (postId: string) => Promise<void>,
    concealPostHandler: (postId: string) => void,
    getProfileActivityPostIds: (address: string) => string[],
    // The Reports tab was seen: redraw the menu badge.
    reportsSeenHandler: () => void,
};

export const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
    const appContext = useContext(AppContext);

    if (!appContext) {
        throw new Error('useAppContext must be used inside <AppContext>');
    }

    return appContext;
};
