import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import { defaultProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { createPostDisplayResolverFromRefs, isSpotlightShown } from './logic/postDisplay';

function ProfileLikes() {

    const address = useParams().address!;

    const {
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        profileActivityRef,
    } = useAppContext();

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleLikePostIds, hasMore, sentinelRef } = useInfiniteScroll(
        (profileActivityRef.current[address] ?? defaultProfileActivity).likes.filter((likePostId) => isSpotlightShown(resolveDisplay, postsRef.current[postsRef.current[likePostId]?.replyToPostId], postsRef)),
        locationKey,
    );

    return (<>
        <ul>
            {visibleLikePostIds.map((likePostId: string) => {
                const likePost = postsRef.current[likePostId];
                const likedPost = postsRef.current[likePost.replyToPostId];

                const {
                    replyPostId,
                    discussionPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(likedPost, postsRef);

                const showPostComponent = !!parentPost;
                if (!showPostComponent) {
                    return null;
                }

                const postItemKeyUnique = `${postItemKey}-${likePostId}`;

                return <li key={postItemKeyUnique}>
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

export default ProfileLikes;
