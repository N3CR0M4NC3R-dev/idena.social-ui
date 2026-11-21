import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import { defaultProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { createPostDisplayResolverFromRefs, isSpotlightShown } from './logic/postDisplay';

function ProfileTips() {

    const address = useParams().address!;

    const {
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        profileActivityRef,
    } = useAppContext();

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleTipPostIdTxHashes, hasMore, sentinelRef } = useInfiniteScroll(
        (profileActivityRef.current[address] ?? defaultProfileActivity).tips.filter((tipPostIdTxHash) => isSpotlightShown(resolveDisplay, postsRef.current[tipPostIdTxHash.split('|')[0]], postsRef)),
        locationKey,
    );

    return (<>
        <ul>
            {visibleTipPostIdTxHashes.map((tipPostIdTxHash: string) => {
                const [tipPostId, txHash] = tipPostIdTxHash.split('|');
                const post = postsRef.current[tipPostId];

                const {
                    replyPostId,
                    discussionPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(post, postsRef);

                const showPostComponent = parentPost && !post!.isLike;
                if (!showPostComponent) {
                    return null;
                }

                const postItemKeyUnique = `${postItemKey}-${txHash}`;

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

export default ProfileTips;
