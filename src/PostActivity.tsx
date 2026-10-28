import { type Post, type Poster, type PostTips } from './logic/asyncUtils';
import { useOutletContext } from 'react-router';
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from './App.exports';
import PostComponent from './components/PostComponent';
import PageHeaderComponent from './components/PageHeaderComponent';
import { BellIcon, HeartIcon, ReplyIcon, TipIcon } from './components/icons';
import { getSpotlightPostDetails } from './logic/utils';

const sortFn = (a: string, b: string) => (b.split('-')[0] as unknown as number) - (a.split('-')[0] as unknown as number);

type PostActivityProps = {
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
    postActivityRef: React.RefObject<string[]>
};

function PostActivity() {

    const {
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
        postActivityRef,
    } = useOutletContext() as PostActivityProps;

    return (<>
        <PageHeaderComponent title="Post Activity" />
        <ul>
            {
            // @ts-ignore: toSorted not recognized yet
                postActivityRef.current.toSorted(sortFn).map((postActivity: string) => {
                    const [, postIdRaw, postType] = postActivity.split('-');
                    const postId = postType === 'tip' ? postIdRaw.split('|')[0] : postIdRaw;
                    const post = postsRef.current[postId];
                    const spotlightPost = post.isLike ? postsRef.current[post.replyToPostId] : post;

                    let notificationMessage;
                    let notificationIcon;
                    if (postType === 'tip') {
                        notificationMessage = `Your ${post.postLevel.toLowerCase()} has received a tip`;
                        notificationIcon = <TipIcon className="size-7 text-tip" />;
                    } else if (post.isLike) {
                        notificationMessage = `Your ${spotlightPost.postLevel.toLowerCase()} has received a like`;
                        notificationIcon = <HeartIcon filled className="size-7 text-like" />;
                    } else if (postType === 'comment') {
                        notificationMessage = 'Your reply has received a new comment';
                        notificationIcon = <ReplyIcon className="size-7 text-comment" />;
                    } else if (postType === 'commentReply') {
                        notificationMessage = 'Your comment has received a reply comment';
                        notificationIcon = <ReplyIcon className="size-7 text-comment" />;
                    } else if (postType === 'reply') {
                        notificationMessage = 'Your post has received a reply';
                        notificationIcon = <ReplyIcon className="size-7 text-comment" />;
                    } else {
                        notificationMessage = `You have received an interaction`;
                        notificationIcon = <BellIcon className="size-7 text-ink" />;
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
                        <div className="flex gap-3 px-4 pt-3">
                            <div className="w-10 flex-none flex justify-end">
                                {notificationIcon}
                            </div>
                            <p className="min-w-0 flex-1 pt-1 text-[15px]/5 text-ink [word-break:break-word]">{notificationMessage}</p>
                        </div>
                        <PostComponent
                            uniqueKey={postItemKeyUnique}
                            postId={parentPost.postId}
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
                            spotlightReplyPostId={replyPostId}
                            spotlightDiscussionPostId={discussionPostId}
                        />
                    </li>;
                })}
        </ul>
    </>);
}

export default PostActivity;
