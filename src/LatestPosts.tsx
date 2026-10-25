import { type Post, type Poster, type PostTips } from './logic/asyncUtils';
import { useLocation, useOutletContext } from 'react-router';
import PostComponent from './components/PostComponent';
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from './App.exports';
import { useReducer } from 'react';
import SortPostsByComponent from './components/SortPostsByComponent';
import ObjectUrlImageComponent from './components/ObjectUrlImageComponent';
import PageHeaderComponent from './components/PageHeaderComponent';
import ComposerToolbarComponent from './components/ComposerToolbarComponent';
import { CloseIcon } from './components/icons';
import { getProfilePic } from './logic/utils';

type LatestPostsProps = {
    latestPosts: string[],
    latestActivity: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    submitting: boolean,
    copyPostTxHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: string[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, location: string, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, image: File, cid?: string) => void,
    postTipsRef: React.RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
    postersAddress: string,
};

function LatestPosts() {
    const location = useLocation();

    const { key: locationKey } = location;

    const {
        latestPosts,
        latestActivity,
        postsRef,
        postersRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitting,
        copyPostTxHandler,
        submitPostHandler,
        submitLikeHandler,
        submittingPost,
        submittingLike,
        submittingTip,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        handleOpenAddMediaModal,
        handleOpenRpcMakePostModal,
        handleExpandImageModal,
        postTipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
        postersAddress,
    } = useOutletContext() as LatestPostsProps;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    if (!browserStateHistoryRef.current[locationKey]?.sortPostsBy) {
        setBrowserStateHistorySettings({ sortPostsBy: 'latest-posts' });
    }

    const sortPostsBy = browserStateHistoryRef.current[locationKey].sortPostsBy;

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['post-main'];

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`post-${location}`]: undefined };
        forceUpdate();
    };

    return (<>
        <div className="flex gap-3 px-4 pt-3 pb-2 border-b border-line">
            <ObjectUrlImageComponent className="size-10 rounded-full object-cover bg-surface flex-none" file={getProfilePic(postersRef.current[postersAddress.toLowerCase()])} />
            <div className="min-w-0 flex-1">
                {inputPostDisabled && <p className="pt-1 pb-2 text-danger text-[13px]">Posting is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
                <textarea
                    id='post-input-main'
                    rows={4}
                    className="block w-full resize-none bg-transparent outline-none text-xl/6 py-3 placeholder:text-ink-muted field-sizing-content min-h-[56px] max-h-[520px] scrollbar-thin"
                    placeholder="What's up?"
                    disabled={inputPostDisabled || submitting}
                />
                {mainPostMediaAttachment ? <div className="relative my-2 w-fit max-w-full">
                    <ObjectUrlImageComponent className="max-h-120 max-w-full size-auto rounded-2xl border border-line" file={mainPostMediaAttachment.file} />
                    <button type="button" aria-label="Remove image" title="Remove image" className="absolute top-1 left-1 inline-flex size-8 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm cursor-pointer hover:bg-black/60" onClick={(e) => removeMediaHandler(e, 'main')}>
                        <CloseIcon className="size-[18px]" />
                    </button>
                </div> : null}
                <div className="border-t border-line pt-2 mt-1">
                    <ComposerToolbarComponent
                        hasAttachment={!!mainPostMediaAttachment}
                        onAddImage={(e) => handleOpenAddMediaModal(e, 'main', 'post')}
                        onRemoveImage={(e) => removeMediaHandler(e, 'main')}
                        copyTxId="post-copytx-main"
                        onCopyTx={() => !inputPostDisabled && !submitting && copyPostTxHandler('main')}
                        submitText={submittingPost === 'main' ? 'Posting...' : 'Post'}
                        onSubmit={(e) => makePostsWith === 'rpc' ? handleOpenRpcMakePostModal(e, 'main') : submitPostHandler('main')}
                        submitDisabled={inputPostDisabled || submitting}
                        hint="Your post will take time to display due to blockchain acceptance."
                    />
                </div>
            </div>
        </div>
        <PageHeaderComponent sticky={false}>
            <SortPostsByComponent sortPostsBy={sortPostsBy} setBrowserStateHistorySettings={setBrowserStateHistorySettings} />
        </PageHeaderComponent>
        <ul>
            {(sortPostsBy === 'latest-posts' ? latestPosts : latestActivity).map((postId) => (
                <li key={postId}>
                    <PostComponent
                        uniqueKey={postId}
                        postId={postId}
                        postsRef={postsRef}
                        postersRef={postersRef}
                        replyPostsTreeRef={replyPostsTreeRef}
                        deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
                        discussPrefix={discussPrefix}
                        SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                        inputPostDisabled={inputPostDisabled}
                        submitting={submitting}
                        copyPostTxHandler={copyPostTxHandler}
                        submitPostHandler={submitPostHandler}
                        submitLikeHandler={submitLikeHandler}
                        submittingPost={submittingPost}
                        submittingLike={submittingLike}
                        submittingTip={submittingTip}
                        browserStateHistoryRef={browserStateHistoryRef}
                        setBrowserStateHistorySettings={setBrowserStateHistorySettings}
                        handleOpenLikesModal={handleOpenLikesModal}
                        handleOpenTipsModal={handleOpenTipsModal}
                        handleOpenSendTipModal={handleOpenSendTipModal}
                        handleOpenAddMediaModal={handleOpenAddMediaModal}
                        handleOpenRpcMakePostModal={handleOpenRpcMakePostModal}
                        handleExpandImageModal={handleExpandImageModal}
                        postTipsRef={postTipsRef}
                        postMediaAttachmentsRef={postMediaAttachmentsRef}
                        makePostsWith={makePostsWith}
                    />
                </li>
            ))}
        </ul>
    </>);
}

export default LatestPosts;
