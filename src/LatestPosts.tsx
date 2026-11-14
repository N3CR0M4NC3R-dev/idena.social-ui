import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import PostComponent from './components/PostComponent';
import { type MouseEventLocal } from './App.exports';
import { useReducer } from 'react';
import SortPostsByComponent from './components/SortPostsByComponent';
import ObjectUrlImageComponent from './components/ObjectUrlImageComponent';
import PageHeaderComponent from './components/PageHeaderComponent';
import ComposerToolbarComponent from './components/ComposerToolbarComponent';
import { CloseIcon } from './components/icons';
import { getProfilePic } from './logic/utils';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { getDisplayTopic, getTopicChannelId, getTopicFromChannelId, isValidTopicName } from './logic/topics';

// The home feed, or with a topic in the URL (/topics/:topic) the feed of that topic's posts.
function LatestPosts() {
    const location = useLocation();
    const navigate = useNavigate();
    const { topic: topicParam } = useParams();

    const { key: locationKey } = location;

    const topic = topicParam?.toLowerCase();
    const topicValid = !topic || isValidTopicName(topic);

    const {
        latestPosts,
        latestActivity,
        postsRef,
        postersRef,
        inputPostDisabled,
        submitting,
        copyPostTxHandler,
        submitPostHandler,
        submittingPost,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        handleOpenAddMediaModal,
        handleOpenRpcMakePostModal,
        postMediaAttachmentsRef,
        makePostsWith,
        postersAddress,
    } = useAppContext();

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    if (!browserStateHistoryRef.current[locationKey]?.sortPostsBy) {
        setBrowserStateHistorySettings({ sortPostsBy: 'latest-posts' });
    }

    const sortPostsBy = browserStateHistoryRef.current[locationKey].sortPostsBy;

    const isInTopic = (postId: string) => getTopicFromChannelId(postsRef.current[postId]?.channelId ?? '') === topic;
    const feedPostIds = sortPostsBy === 'latest-posts' ? latestPosts : latestActivity;
    const shownPostIds = topic ? (topicValid ? feedPostIds.filter(isInTopic) : []) : feedPostIds;

    const { visibleItems: visiblePostIds, hasMore, sentinelRef } = useInfiniteScroll(
        shownPostIds,
        `${locationKey}-${sortPostsBy}`,
    );

    // the composer's location keys its textarea, copy tx button, media attachment and submitting state
    const composerLocation = topic ? `topic-${topic}` : 'main';
    const composerChannelId = topic ? getTopicChannelId(topic) : undefined;

    const mainPostMediaAttachment = postMediaAttachmentsRef.current[`post-${composerLocation}`];

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`post-${location}`]: undefined };
        forceUpdate();
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    if (topicParam && topicParam !== topic) {
        return <Navigate to={`/topics/${topic}`} replace />;
    }

    const topicHeader = topic && <PageHeaderComponent
        title={getDisplayTopic(topic)}
        subtitle={topicValid ? `${shownPostIds.length} ${shownPostIds.length === 1 ? 'post' : 'posts'}` : undefined}
        onBack={handleGoBack}
    />;

    if (!topicValid) {
        return (<>
            {topicHeader}
            <p className="px-8 py-6 text-center text-[15px] text-ink-muted">This isn't a valid topic name. Topic names are 3 to 21 lowercase letters, digits or underscores.</p>
        </>);
    }

    return (<>
        {topicHeader}
        <div className="flex gap-3 px-4 pt-3 pb-2 border-b border-line">
            <ObjectUrlImageComponent className="size-10 rounded-full object-cover bg-surface flex-none" file={getProfilePic(postersRef.current[postersAddress.toLowerCase()])} />
            <div className="min-w-0 flex-1">
                {inputPostDisabled && <p className="pt-1 pb-2 text-danger text-[13px]">Posting is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>}
                <textarea
                    key={composerLocation}
                    id={`post-input-${composerLocation}`}
                    rows={4}
                    className="block w-full resize-none bg-transparent outline-none text-xl/6 py-3 placeholder:text-ink-muted field-sizing-content min-h-[56px] max-h-[520px] scrollbar-thin"
                    placeholder={topic ? `Post in ${getDisplayTopic(topic)}` : "What's up?"}
                    disabled={inputPostDisabled || submitting}
                />
                {mainPostMediaAttachment ? <div className="relative my-2 w-fit max-w-full">
                    <ObjectUrlImageComponent className="max-h-120 max-w-full size-auto rounded-2xl border border-line" file={mainPostMediaAttachment.file} />
                    <button type="button" aria-label="Remove image" title="Remove image" className="absolute top-1 left-1 inline-flex size-8 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm cursor-pointer hover:bg-black/60" onClick={(e) => removeMediaHandler(e, composerLocation)}>
                        <CloseIcon className="size-[18px]" />
                    </button>
                </div> : null}
                <div className="border-t border-line pt-2 mt-1">
                    <ComposerToolbarComponent
                        hasAttachment={!!mainPostMediaAttachment}
                        onAddImage={(e) => handleOpenAddMediaModal(e, composerLocation, 'post')}
                        onRemoveImage={(e) => removeMediaHandler(e, composerLocation)}
                        copyTxId={`post-copytx-${composerLocation}`}
                        onCopyTx={() => !inputPostDisabled && !submitting && copyPostTxHandler(composerLocation, undefined, composerChannelId)}
                        submitText={submittingPost === composerLocation ? 'Posting...' : 'Post'}
                        onSubmit={(e) => makePostsWith === 'rpc' ? handleOpenRpcMakePostModal(e, composerLocation, undefined, composerChannelId) : submitPostHandler(composerLocation, undefined, composerChannelId)}
                        submitDisabled={inputPostDisabled || submitting}
                        hint="Your post will take time to display due to blockchain acceptance."
                    />
                </div>
            </div>
        </div>
        <PageHeaderComponent sticky={false}>
            <SortPostsByComponent sortPostsBy={sortPostsBy} setBrowserStateHistorySettings={setBrowserStateHistorySettings} />
        </PageHeaderComponent>
        {topic && !shownPostIds.length && <p className="px-8 py-6 text-center text-[15px] text-ink-muted">No posts found in {getDisplayTopic(topic)} yet. Write the first one, or use “Scan more past blocks” below to search further back.</p>}
        <ul>
            {visiblePostIds.map((postId) => (
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

export default LatestPosts;
