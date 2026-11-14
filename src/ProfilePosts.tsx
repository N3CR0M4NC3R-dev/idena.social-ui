import { useLocation, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import PostComponent from './components/PostComponent';
import SortPostsByComponent from './components/SortPostsByComponent';
import { useInfiniteScroll } from './logic/useInfiniteScroll';

function ProfilePosts() {
    const location = useLocation();
    const { address } = useParams();

    const { key: locationKey } = location;

    const {
        latestPosts,
        latestActivity,
        postsRef,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
    } = useAppContext();

    if (!browserStateHistoryRef.current[locationKey]?.sortPostsBy) {
        setBrowserStateHistorySettings({ sortPostsBy: 'latest-posts' });
    }

    const sortPostsBy = browserStateHistoryRef.current[locationKey].sortPostsBy;

    const filteredOrderedPosts = (sortPostsBy === 'latest-posts' ? latestPosts : latestActivity).filter(postId => {
        const post = postsRef.current[postId];
        return post.poster === address;
    });

    const { visibleItems: visiblePostIds, hasMore, sentinelRef } = useInfiniteScroll(
        filteredOrderedPosts,
        `${locationKey}-${sortPostsBy}`,
    );

    return (<>
        <div className="border-b border-line">
            <SortPostsByComponent sortPostsBy={sortPostsBy} setBrowserStateHistorySettings={setBrowserStateHistorySettings} variant="pills" />
        </div>
        <ul>
            {visiblePostIds.map((postId: string) => (
                <li key={postId}>
                    <PostComponent
                        uniqueKey={postId}
                        postId={postId}
                    />
                </li>
            ))}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default ProfilePosts;
