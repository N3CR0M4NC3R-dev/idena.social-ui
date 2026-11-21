import { Link, useLocation } from 'react-router';
import { useAppContext } from './AppContext';
import { type PostActivityItem } from './App.exports';
import PostComponent from './components/PostComponent';
import ObjectUrlImageComponent from './components/ObjectUrlImageComponent';
import PageHeaderComponent from './components/PageHeaderComponent';
import { BellIcon, HeartIcon, ReplyIcon, TipIcon } from './components/icons';
import { getPostActivityKey, getProfilePic, getSpotlightPostDetails } from './logic/utils';
import { cachePostActivity } from './logic/postActivityStore';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { createPostDisplayResolverFromRefs, isSpotlightShown } from './logic/postDisplay';
import { getPostHiddenStatus } from './logic/moderation';

const sortFn = (a: PostActivityItem, b: PostActivityItem) => b.timestamp - a.timestamp;

function PostActivity() {

    const {
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        postersRef,
        postActivityRef,
        unreadPostActivityThisVisitRef,
        tipsRef,
        postersAddress,
    } = useAppContext();

    const { key: locationKey } = useLocation();

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);

    // No activity for hidden replies and comments, even ones shown as placeholders, or for posts in removed threads.
    // Likes and tips still count, but what they're on can be removed.
    const isPostActivityShown = (postActivity: PostActivityItem) => {
        const post = postsRef.current[postActivity.postId];
        if (!post) return true;
        const spotlightPost = post.isLike ? postsRef.current[post.replyToPostId] : post;
        const activityPostShown = post.isLike || postActivity.type === 'tip' || !getPostHiddenStatus(post);
        return activityPostShown && isSpotlightShown(resolveDisplay, spotlightPost, postsRef);
    };

    const shownPostActivityKeys = [...postActivityRef.current.values()].sort(sortFn).filter((postActivity) => {
        if (isPostActivityShown(postActivity)) return true;

        // Unread activity that isn't listed counts as read on this visit, so the unread badge doesn't stay up for it.
        if (postActivity.read === false) {
            const postActivityKey = getPostActivityKey(postActivity);
            unreadPostActivityThisVisitRef.current.add(postActivityKey);
            const newPostActivity = { ...postActivity, read: true };
            postActivityRef.current.set(postActivityKey, newPostActivity);
            cachePostActivity(newPostActivity, postersAddress);
        }
        return false;
    }).map(getPostActivityKey);

    const { visibleItems: visiblePostActivityKeys, hasMore, sentinelRef } = useInfiniteScroll(
        shownPostActivityKeys,
        locationKey,
    );

    return (<>
        <PageHeaderComponent title="Post Activity" />
        <ul>
            {
                visiblePostActivityKeys.map((postActivityKey: string) => {
                    const postActivity = postActivityRef.current.get(postActivityKey)!;
                    const { postId, type: postType, tipTxHash } = postActivity;
                    const post = postsRef.current[postId];
                    const spotlightPost = post?.isLike ? postsRef.current[post.replyToPostId] : post;
                    const tip = tipsRef.current[tipTxHash!];

                    // cached activity can load before the scan has loaded its posts and tips
                    if (!spotlightPost || (postType === 'tip' && !tip)) {
                        return null;
                    }

                    let notificationMessage;
                    let notificationIcon;
                    let notificationFrom = post.poster;
                    let notificationFromState = post.posterDetails_atTimeOfPost.state;
                    if (postType === 'tip') {
                        notificationMessage = `Your ${post.postLevel.toLowerCase()} has received a tip`;
                        notificationIcon = <TipIcon className="size-7 text-tip" />;
                        notificationFrom = tip.tipper;
                        notificationFromState = tip.tipperDetails_atTimeOfTip.state;
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

                    const notificationFromPic = getProfilePic(postersRef.current[notificationFrom], notificationFromState);

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

                    if (postActivity.read === false) {
                        unreadPostActivityThisVisitRef.current.add(postActivityKey);
                        const newPostActivity = { ...postActivity, read: true };
                        postActivityRef.current.set(postActivityKey, newPostActivity);
                        cachePostActivity(newPostActivity, postersAddress);
                    }

                    const addedUniquity = postType === 'tip' ? `-${tipTxHash}` : post.isLike ? `-${post.postId}` : '';
                    const postItemKeyUnique = postItemKey + addedUniquity;

                    return <li key={postItemKeyUnique} className={unreadPostActivityThisVisitRef.current.has(postActivityKey) ? 'bg-btn/50' : ''}>
                        <div className="flex gap-3 px-4 pt-3">
                            <div className="w-10 flex-none flex justify-end">
                                {notificationIcon}
                            </div>
                            <p className="min-w-0 flex-1 pt-1 text-[15px]/5 text-ink [word-break:break-word]">{notificationMessage} from <Link to={`/profile/${notificationFrom}`} className="group inline-flex items-center gap-1 align-top"><ObjectUrlImageComponent file={notificationFromPic} className="size-5 flex-none rounded-full bg-surface object-cover group-hover:opacity-85" /></Link></p>
                        </div>
                        <PostComponent
                            uniqueKey={postItemKeyUnique}
                            postId={parentPost.postId}
                            spotlightReplyPostId={replyPostId}
                            spotlightDiscussionPostId={discussionPostId}
                        />
                    </li>;
                })}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default PostActivity;
