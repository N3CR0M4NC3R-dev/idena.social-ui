import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import { defaultProfileActivity } from './App.exports';
import PostComponent from './components/PostComponent';
import { getSpotlightPostDetails } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';

function ProfileMedia() {

    const address = useParams().address!;

    const {
        postsRef,
        profileActivityRef,
    } = useAppContext();

    const { key: locationKey } = useLocation();

    const { visibleItems: visibleMediaPostIds, hasMore, sentinelRef } = useInfiniteScroll(
        (profileActivityRef.current[address] ?? defaultProfileActivity).media,
        locationKey,
    );

    return (<>
        <ul>
            {visibleMediaPostIds.map((mediaPostId: string) => {
                const mediaPost = postsRef.current[mediaPostId];

                const {
                    replyPostId,
                    discussionPostId,
                    postItemKey,
                    parentPost,
                } = getSpotlightPostDetails(mediaPost, postsRef);

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

export default ProfileMedia;
