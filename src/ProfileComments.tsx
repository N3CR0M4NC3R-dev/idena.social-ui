import { type Post, type PostTips, type Tip } from './logic/asyncUtils';
import { useOutletContext } from 'react-router';
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment, type ProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';

type ProfileCommentsProps = {
    address: string,
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    copyPostTxHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: Tip[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, dataUrl: string, cid?: string) => void,
    tipsRef: React.RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
    profileActivityRef: React.RefObject<Record<string, ProfileActivity>>,
};

function ProfileComments() {

    const {
        address,
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
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
        tipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
        profileActivityRef,
    } = useOutletContext() as ProfileCommentsProps;

    return (<>
        <ul>
            {profileActivityRef.current[address].comments.map((discussionPostId: string) => {

                const discussionPost = postsRef.current[discussionPostId];

                const {
                    replyPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(discussionPost, postsRef, discussPrefix);

                return <li key={postItemKey}>
                    {parentPost && <PostComponent
                        postId={parentPost.postId}
                        postsRef={postsRef}
                        replyPostsTreeRef={replyPostsTreeRef}
                        deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
                        discussPrefix={discussPrefix}
                        SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                        inputPostDisabled={inputPostDisabled}
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
                        tipsRef={tipsRef}
                        postMediaAttachmentsRef={postMediaAttachmentsRef}
                        makePostsWith={makePostsWith}
                        spotlightReplyPostId={replyPostId}
                        spotlightDiscussionPostId={discussionPostId}
                    />}
                </li>
            })}
        </ul>
    </>);
}

export default ProfileComments;
