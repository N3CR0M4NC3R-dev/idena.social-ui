import { type Post, type PostTips, type Tip } from './logic/asyncUtils';
import { useNavigate, useOutletContext } from 'react-router';
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';

const sortFn = (a: string, b: string) => (b.split('-')[0] as unknown as number) - (a.split('-')[0] as unknown as number);

type PostActivityProps = {
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
    postActivityRef: React.RefObject<string[]>
};

function PostActivity() {

    const navigate = useNavigate();

    const {
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
        postActivityRef,
    } = useOutletContext() as PostActivityProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <ul>
            {
            // @ts-ignore: toSorted not recognized yet
            postActivityRef.current.toSorted(sortFn).map((postActivity: string) => {
                const [, postIdRaw, postType] = postActivity.split('-');
                const postId = postType === 'tip' ? postIdRaw.split('|')[0] : postIdRaw;
                const post = postsRef.current[postId];
                const spotlightPost = post.isLike ? postsRef.current[post.replyToPostId] : post;

                let notificationMessage;
                if (postType === 'tip') {
                    notificationMessage = `Your ${post.postLevel.toLowerCase()} has recieved a tip`;
                } else if (post.isLike) {
                    notificationMessage = `Your ${spotlightPost.postLevel.toLowerCase()} has recieved a like`;
                } else if (postType === 'comment') {
                    notificationMessage = 'Your reply has received a new comment';
                } else if (postType === 'commentReply') {
                    notificationMessage = `Your ${''} has received a reply comment`;
                } else if (postType === 'reply') {
                    notificationMessage = 'Your post has received a reply';
                } else {
                    notificationMessage = `You have recieved an interaction`;
                }

                const {
                    replyPostId,
                    discussionPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(spotlightPost, postsRef);

                const showPostComponent = !!parentPost;
                if (!showPostComponent) {
                    return null;
                }

                const addedUniquity = postType === 'tip' ? `-${postIdRaw.split('|')[1]}` : post.isLike ? `-${post.postId}` : '';
                const postItemKeyUnique = postItemKey + addedUniquity;

                return <li key={postItemKeyUnique}>
                    <div className="text-center text-[13px] bg-stone-700">
                        <p>{notificationMessage}</p>
                    </div>
                    <PostComponent
                        uniqueKey={postItemKeyUnique}
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
                    />
                </li>
            })}
        </ul>
    </>);
}

export default PostActivity;
