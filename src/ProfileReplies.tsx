import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import { defaultProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';

function ProfileReplies() {

    const address = useParams().address!;

    const {
        postsRef,
        profileActivityRef,
    } = useAppContext();

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleReplyPostIds, hasMore, sentinelRef } = useInfiniteScroll(
        (profileActivityRef.current[address] ?? defaultProfileActivity).replies,
        locationKey,
    );

    return (<>
        <ul>
            {visibleReplyPostIds.map((replyPostId: string) => {

                const replyPost = postsRef.current[replyPostId];

                const {
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(replyPost, postsRef);

                const showPostComponent = parentPost;
                if (!showPostComponent) {
                    return null;
                }

                return <li key={postItemKey}>
                    <PostComponent
                        uniqueKey={postItemKey}
                        postId={parentPost.postId}
                        spotlightReplyPostId={replyPostId}
                    />
                </li>;
            })}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default ProfileReplies;
