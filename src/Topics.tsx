import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAppContext } from './AppContext';
import PageHeaderComponent from './components/PageHeaderComponent';
import { TopicsIcon } from './components/icons';
import { getDisplayTimeAgo } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { getDisplayTopic, getTopicSummaries, isValidTopicName, normalizeTypedTopic } from './logic/topics';
import { createPostDisplayResolverFromRefs } from './logic/postDisplay';

const topicIconClassName = 'flex size-10 flex-none items-center justify-center rounded-full bg-surface';

function Topics() {
    const location = useLocation();

    const { key: locationKey } = location;

    const {
        latestActivity,
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        postLatestActivityRef,
    } = useAppContext();

    const [query, setQuery] = useState('');

    const typedTopic = normalizeTypedTopic(query);

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);
    const shownActivity = latestActivity.filter((postId) => resolveDisplay(postId) !== 'removed');
    const allTopics = getTopicSummaries(shownActivity, postsRef, postLatestActivityRef);
    const topics = typedTopic ? allTopics.filter((topic) => topic.name.includes(typedTopic)) : allTopics;

    // a valid name nobody has posted in yet (as far as scanned): offer to open it, so its first post can be made
    const canStartTopic = isValidTopicName(typedTopic) && !allTopics.some((topic) => topic.name === typedTopic);

    const { visibleItems: visibleTopicNames, hasMore, sentinelRef } = useInfiniteScroll(
        topics.map((topic) => topic.name),
        `${locationKey}-${typedTopic}`,
    );

    const visibleTopics = topics.slice(0, visibleTopicNames.length);

    return (<>
        <PageHeaderComponent title="Topics" />
        <div className="border-b border-line px-4 py-3">
            <input
                className="form-field text-[15px]"
                placeholder="Search or start a topic, e.g. r/idena"
                aria-label="Search or start a topic"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
        </div>
        {canStartTopic && <Link to={`/topics/${typedTopic}`} className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className={topicIconClassName}><TopicsIcon className="size-5" /></span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]/5 font-bold">{getDisplayTopic(typedTopic)}</span>
                <span className="block truncate text-[13px]/4 text-ink-muted">No posts found yet. Open it to write the first one.</span>
            </span>
        </Link>}
        {!topics.length && !canStartTopic && <p className="px-8 py-6 text-center text-[15px] text-ink-muted">
            {typedTopic ? <>
                No topics match “{typedTopic}”. Topic names are 3 to 21 lowercase letters, digits or underscores.
            </> : <>
                No topics found yet. They appear here as their posts are found. Use “Scan more past blocks” below to search further back, or type a name above to start one.
            </>}
        </p>}
        <ul>
            {visibleTopics.map((topic) => (
                <li key={topic.name}>
                    <Link to={`/topics/${topic.name}`} className="flex items-center gap-3 border-b border-line px-4 py-3">
                        <span className={topicIconClassName}><TopicsIcon className="size-5" /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px]/5 font-bold">{getDisplayTopic(topic.name)}</span>
                            <span className="block truncate text-[13px]/4 text-ink-muted">{`${topic.posts} ${topic.posts === 1 ? 'post' : 'posts'} · ${getDisplayTimeAgo(topic.lastActivity)}`}</span>
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default Topics;
