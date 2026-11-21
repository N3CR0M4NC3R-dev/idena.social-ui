import { Link, useLocation } from 'react-router';
import { useAppContext } from './AppContext';
import AddressLinkComponent from './components/AddressLinkComponent';
import HiddenPostPreviewComponent from './components/HiddenPostPreviewComponent';
import { compareModerationEvents, type ModerationEvent } from './logic/moderation';
import { getModerationEvents } from './logic/moderationSync';
import { createPostDisplayResolverFromRefs } from './logic/postDisplay';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { getDisplayTimeAgo, getSpotlightPostDetails } from './logic/utils';

// Every moderation action, newest first, with who took it and why. Reports stay off the log.
function ModerationLog() {

    const {
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
    } = useAppContext();

    const { key: locationKey } = useLocation();

    const events = getModerationEvents()
        .filter((event) => event.name !== 'report' && event.name !== 'reportTransaction')
        .sort((a, b) => compareModerationEvents(b, a));
    const eventsByKey = new Map(events.map((event) => [event.key, event]));

    const { visibleItems: visibleKeys, hasMore, sentinelRef } = useInfiniteScroll(events.map((event) => event.key), locationKey);

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);
    const postIdsByTxHash = new Map(Object.values(postsRef.current).filter((post) => post?.postId).map((post) => [post.txHash.toLowerCase(), post.postId]));

    // A post the event is about: hidden ones collapsed behind Show, visible ones linked.
    const renderPost = (hash: string) => {
        const postId = postIdsByTxHash.get(hash);
        if (!postId) return <p className="text-[13px] text-ink-muted">{`Transaction ${hash.slice(0, 10)}… (not loaded yet)`}</p>;
        if (resolveDisplay(postId) !== 'visible') return <HiddenPostPreviewComponent postId={postId} />;
        const rootPostId = getSpotlightPostDetails(postsRef.current[postId], postsRef).parentPost?.postId ?? postId;
        return <Link to={`/post/${rootPostId}`} className="text-[13px] text-link hover:underline">View the post</Link>;
    };

    const describe = (event: ModerationEvent) => {
        switch (event.name) {
        case 'ban': return <><AddressLinkComponent address={event.moderator} /> banned <AddressLinkComponent address={event.address} /> {event.permanent ? 'permanently' : `until epoch ${event.endEpoch}`}</>;
        case 'unban': return <><AddressLinkComponent address={event.moderator} /> unbanned <AddressLinkComponent address={event.address} /></>;
        case 'banTransaction': return <><AddressLinkComponent address={event.moderator} /> hid a post</>;
        case 'unbanTransaction': return <><AddressLinkComponent address={event.moderator} /> restored a post</>;
        case 'vouch': return <><AddressLinkComponent address={event.voucher} /> vouched for <AddressLinkComponent address={event.address} /></>;
        case 'vouchWithdrawn': return <><AddressLinkComponent address={event.voucher} /> withdrew their vouch for <AddressLinkComponent address={event.address} /></>;
        case 'vouchesRevoked': return <><AddressLinkComponent address={event.staker} /> revoked every vouch for <AddressLinkComponent address={event.address} /></>;
        default: return null;
        }
    };

    if (!events.length) {
        return <p className="px-8 py-6 text-center text-[15px] text-ink-muted">No moderation yet.</p>;
    }

    return (<>
        <ul>
            {visibleKeys.map((key) => {
                const event = eventsByKey.get(key)!;
                const reason = 'reason' in event ? event.reason : '';
                return (
                    <li key={key} className="border-b border-line px-4 py-3 text-[15px]/5">
                        <p className="[word-break:break-word]">{describe(event)}<span className="text-[13px] text-ink-muted">{` · ${getDisplayTimeAgo(event.timestamp)}`}</span></p>
                        {reason && <p className="text-ink-muted [word-break:break-word]">{reason}</p>}
                        {(event.name === 'banTransaction' || event.name === 'unbanTransaction') && <div className="mt-1">{renderPost(event.hash)}</div>}
                    </li>
                );
            })}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </>);
}

export default ModerationLog;
