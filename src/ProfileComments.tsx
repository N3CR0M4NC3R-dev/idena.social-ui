import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import { defaultProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { createPostDisplayResolverFromRefs, isSpotlightShown } from './logic/postDisplay';

function ProfileComments() {

    const address = useParams().address!;

    const {
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        profileActivityRef,
    } = useAppContext();

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleDiscussionPostIds, hasMore, sentinelRef } = useInfiniteScroll(
        (profileActivityRef.current[address] ?? defaultProfileActivity).comments.filter((discussionPostId) => isSpotlightShown(resolveDisplay, postsRef.current[discussionPostId], postsRef)),
        locationKey,
    );

    return (<>
        <ul>
            {visibleDiscussionPostIds.map((discussionPostId: string) => {

                const discussionPost = postsRef.current[discussionPostId];

                const {
                    replyPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(discussionPost, postsRef);

                const showPostComponent = !!parentPost;
                if (!showPostComponent) {
                    return null;
                }

                return <li key={postItemKey}>
                    <PostComponent
                        uniqueKey={postItemKey}
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

export default ProfileComments;
