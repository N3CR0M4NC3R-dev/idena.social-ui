import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAppContext } from './AppContext';
import AddressLinkComponent from './components/AddressLinkComponent';
import HiddenPostPreviewComponent from './components/HiddenPostPreviewComponent';
import MediaComponent from './components/MediaComponent';
import { getMediaFile, getPosterPromise } from './logic/asyncUtils';
import { getAddressBan, getTransactionBan, getVouchers, isStaker } from './logic/moderation';
import { dismissReportGroup, getReportedTransaction, getReportGroupViews, lookUpReportedTransaction, markReportsSeen, reopenReportGroup, type ReportGroupView } from './logic/moderationReports';
import { getPendingReportCount } from './logic/moderationSync';
import { createPostDisplayResolverFromRefs } from './logic/postDisplay';
import { useInfiniteScroll } from './logic/useInfiniteScroll';
import { getDisplayAddressShort, getDisplayTimeAgo, getIdentityStatus, getMessageLines, getSpotlightPostDetails } from './logic/utils';

// Identities that passed a validation: the "validated reporters only" filter keeps their reports.
const VALIDATED_STATES = new Set(['Newbie', 'Verified', 'Human']);
// Reports shown per group before "+N more".
const REPORTS_SHOWN = 3;
// Identities and transactions looked up at once: they share the indexer's queue with the rest of the app.
const LOAD_BATCH = 20;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// The reports queue (docs/moderation.md, "The reports queue"): reports grouped by what they target, most reporters first.
// A group closes when its target is banned or hidden, or when this moderator dismisses it, in this browser only.
function ModerationReports() {

    const {
        postersAddress,
        postsRef,
        postersRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        rpcClientRef,
        findPostsWithRef,
        indexerApiUrlRef,
        handleOpenModerationSheet,
        reportsSeenHandler,
    } = useAppContext();

    const { key: locationKey } = useLocation();
    const moderator = postersAddress.toLowerCase();

    const [validatedOnly, setValidatedOnly] = useState(false);
    const [showClosed, setShowClosed] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [, rerender] = useReducer((count: number) => count + 1, 0);
    // Addresses and transactions that couldn't be looked up: not tried again on this visit.
    const failedRef = useRef(new Set<string>());

    // undefined while a reporter's identity is loading, or when it couldn't be loaded.
    const isValidated = (address: string) => {
        const state = postersRef.current[address]?.state;
        return state === undefined ? undefined : VALIDATED_STATES.has(state);
    };

    // The filter keeps reporters whose identity isn't known yet: a validated reporter's report must not vanish
    // because their identity is slow to load. Each is marked until it is.
    const allGroups = getReportGroupViews(moderator, postsRef.current);
    const groups = (validatedOnly
        ? allGroups
            .map((group) => ({ ...group, reports: group.reports.filter((report) => isValidated(report.reporter) !== false) }))
            .filter((group) => group.reports.length)
            .sort((a, b) => b.reports.length - a.reports.length || b.reports[0].timestamp - a.reports[0].timestamp)
        : allGroups);
    const openGroups = groups.filter((group) => !group.resolution && !group.dismissed);
    const closedGroups = groups.filter((group) => group.resolution || group.dismissed);
    const listedGroups = showClosed ? [...openGroups, ...closedGroups] : openGroups;
    const groupsByKey = new Map(listedGroups.map((group) => [group.key, group]));

    const { visibleItems: visibleKeys, hasMore, sentinelRef } = useInfiniteScroll(listedGroups.map((group) => group.key), locationKey);

    const resolveDisplay = createPostDisplayResolverFromRefs(postsRef, replyPostsTreeRef, deOrphanedReplyPostsTreeRef);

    // Seeing the queue clears the menu badge.
    const newest = allGroups.reduce((max, group) => Math.max(max, group.newest), 0);
    useEffect(() => {
        if (markReportsSeen(moderator, newest)) reportsSeenHandler();
    }, [moderator, newest]);

    // Loads, a batch at a time, the identities shown (reporters, reported accounts, authors) and the senders of
    // reported transactions that haven't loaded as posts. The validated filter needs every reporter's identity.
    const visibleGroups = visibleKeys.map((key) => groupsByKey.get(key)).filter((group): group is ReportGroupView => !!group);
    const getShownReports = (group: ReportGroupView) => expanded.has(group.key) ? group.reports : group.reports.slice(0, REPORTS_SHOWN);
    const isMissing = (address: string) => !postersRef.current[address] && !failedRef.current.has(address);
    const reporters = validatedOnly
        ? allGroups.flatMap((group) => group.reports.map((report) => report.reporter))
        : visibleGroups.flatMap((group) => getShownReports(group).map((report) => report.reporter));
    const targets = visibleGroups.map((group) => group.kind === 'address' ? group.target : group.author).filter((address): address is string => !!address);
    const missingAddresses = [...new Set([...targets, ...reporters])].filter(isMissing);
    const addressesToLoad = missingAddresses.slice(0, LOAD_BATCH);
    const transactionsToLoad = visibleGroups
        .filter((group) => group.kind === 'transaction' && !group.post && getReportedTransaction(group.target) === undefined && !failedRef.current.has(group.target))
        .map((group) => group.target)
        .slice(0, LOAD_BATCH);
    const loadKey = [...addressesToLoad, ...transactionsToLoad].join();
    const checkingIdentities = validatedOnly ? new Set(reporters.filter(isMissing)).size : 0;
    const pendingReports = getPendingReportCount();
    // App creates the RPC client after its first render.
    const rpcReady = !!rpcClientRef.current;

    useEffect(() => {
        if (!loadKey || !rpcReady) return;
        let ignore = false;

        const useIndexer = findPostsWithRef.current === 'indexer-api';
        Promise.allSettled([
            ...addressesToLoad.map((address) => getPosterPromise(address, postersRef, useIndexer, rpcClientRef.current, indexerApiUrlRef)),
            ...transactionsToLoad.map((hash) => lookUpReportedTransaction(indexerApiUrlRef.current, hash)),
        ]).then(() => {
            // Whatever is still missing failed: leave it out of the next batches.
            addressesToLoad.filter((address) => !postersRef.current[address]).forEach((address) => failedRef.current.add(address));
            transactionsToLoad.filter((hash) => getReportedTransaction(hash) === undefined).forEach((hash) => failedRef.current.add(hash));
            if (!ignore) rerender();
        });

        return () => {
            ignore = true;
        };
    }, [loadKey, rpcReady]);

    const getBanRefusal = (address: string) => {
        if (address === moderator) return 'That\'s you.';
        if (isStaker(postersRef.current[address]?.stake)) return 'Stakers can\'t be banned.';
        if (getVouchers(address).length) return 'Moderators can\'t be banned: a staker must revoke their vouches first.';
    };

    const toggleExpanded = (key: string) => {
        const next = new Set(expanded);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setExpanded(next);
    };

    const renderTitle = (group: ReportGroupView) => {
        if (group.kind === 'address') return <>Account <AddressLinkComponent address={group.target} /></>;
        if (group.post) {
            const level = group.post.isLike ? 'Like' : group.post.postLevel === 'Post' ? 'Post' : group.post.postLevel === 'Reply' ? 'Reply' : 'Comment';
            return <>{level} by <AddressLinkComponent address={group.post.poster} /></>;
        }
        if (group.author) return <>Transaction by <AddressLinkComponent address={group.author} /></>;
        return <>{`Transaction ${group.target.slice(0, 10)}…`}</>;
    };

    // What was reported: an account's identity, or a post (hidden ones behind Show).
    const renderTarget = (group: ReportGroupView) => {
        if (group.kind === 'address') {
            const poster = postersRef.current[group.target];
            return poster?.address && <p className="text-[13px] text-ink-muted">{`${getIdentityStatus(poster.state)} · Age ${poster.age} · Stake ${Math.floor(Number(poster.stake)).toLocaleString('en-US')}`}</p>;
        }

        const post = group.post;
        if (!post) {
            const transaction = getReportedTransaction(group.target);
            const description = transaction === undefined ? 'Loading…' : transaction === null ? 'The indexer doesn\'t know this transaction.' : `A ${transaction.type || 'transaction'} that isn't a loaded post (a message, or an older post).`;
            return <p className="text-[13px] text-ink-muted">{description} <a className="text-link hover:underline" href={`https://scan.idena.io/transaction/${group.target}`} target="_blank" rel="noopener noreferrer">View on explorer</a></p>;
        }

        if (resolveDisplay(post.postId) !== 'visible') return <HiddenPostPreviewComponent postId={post.postId} showAuthor={false} />;

        const rootPostId = getSpotlightPostDetails(post, postsRef).parentPost?.postId ?? post.postId;
        const loading = post.message?.startsWith('ipfs://') && !post.messageResolved;
        const mediaFile = getMediaFile(post);
        return (
            <div className="mt-1 rounded-xl bg-ink/[0.04] px-3 py-2">
                {loading ? <p className="text-[13px] text-ink-muted">Loading…</p> : <p className="line-clamp-6 text-[15px]/5 text-ink [word-break:break-word]">{getMessageLines(post.message).messageLines.map((line, i, lines) => <span key={i}>{line}{i < lines.length - 1 && <br />}</span>)}</p>}
                {mediaFile && <MediaComponent className="mt-2 max-h-60 max-w-full size-auto rounded-2xl border border-line" file={mediaFile} />}
                <Link to={`/post/${rootPostId}`} className="mt-1 block text-[13px] text-link hover:underline">View the post</Link>
            </div>
        );
    };

    const renderGroup = (group: ReportGroupView) => {
        const shownReports = getShownReports(group);
        const accountToBan = group.kind === 'address' ? group.target : group.author;
        const banRefusal = accountToBan && getBanRefusal(accountToBan);
        const banLabel = accountToBan && `Ban ${getDisplayAddressShort(accountToBan, postersRef.current[accountToBan])}…`;
        const canHide = group.kind === 'transaction' && !!group.post && !getTransactionBan(group.target);

        return (
            <li key={group.key} className="border-b border-line px-4 py-3 text-[15px]/5">
                <p className="[word-break:break-word]">
                    {renderTitle(group)}
                    <span className="text-[13px] text-ink-muted">{` · ${plural(group.reports.length, 'reporter')} · newest ${getDisplayTimeAgo(group.reports[0].timestamp)}`}</span>
                </p>
                {(group.resolution || group.dismissed) && <p className="text-[13px] font-bold text-ink-muted">{group.resolution ? `Resolved: ${group.resolution.toLowerCase()}` : 'Dismissed by you'}</p>}
                <div className="mt-1">{renderTarget(group)}</div>
                <ul className="mt-2 flex flex-col gap-1">
                    {shownReports.map((report) => {
                        const reporter = postersRef.current[report.reporter];
                        const reporterRefusal = getBanRefusal(report.reporter);
                        return (
                            <li key={report.key} className="flex items-baseline gap-2 text-[13px]/4">
                                <span aria-hidden="true">•</span>
                                {/* bdi: a reason's own text direction can't reorder the reporter's details after it. */}
                                <div className="min-w-0 flex-1">
                                    <bdi className="line-clamp-3 block text-ink [word-break:break-word]">{report.reason}</bdi>
                                    <AddressLinkComponent address={report.reporter} className="font-normal text-ink-muted" />
                                    <span className="text-ink-muted">{`${reporter?.address ? ` · ${getIdentityStatus(reporter.state)}, stake ${Math.floor(Number(reporter.stake)).toLocaleString('en-US')}` : ` · ${failedRef.current.has(report.reporter) ? 'identity unknown' : 'identity loading'}`} · ${getDisplayTimeAgo(report.timestamp)}`}</span>
                                </div>
                                {!reporterRefusal && !getAddressBan(report.reporter) && <button type="button" className="ml-auto flex-none cursor-pointer text-link hover:underline" title="For accounts that spam reports: their reports leave the queue" onClick={(e) => handleOpenModerationSheet(e, { kind: 'ban', address: report.reporter })}>Ban reporter…</button>}
                            </li>
                        );
                    })}
                </ul>
                {group.reports.length > REPORTS_SHOWN && <button type="button" className="mt-1 cursor-pointer text-[13px] text-link hover:underline" onClick={() => toggleExpanded(group.key)}>
                    {expanded.has(group.key) ? 'Show fewer' : `+${group.reports.length - REPORTS_SHOWN} more`}
                </button>}
                <div className="mt-3 flex flex-wrap gap-2">
                    {canHide && <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'hide', hash: group.target, author: group.author! })}>Hide post…</button>}
                    {accountToBan && !getAddressBan(accountToBan) && (banRefusal
                        ? <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled title={banRefusal}>{banLabel}</button>
                        : <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'ban', address: accountToBan })}>{banLabel}</button>)}
                    {group.dismissed
                        ? <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={() => { reopenReportGroup(moderator, group.key); rerender(); }}>Reopen</button>
                        : !group.resolution && <button type="button" className="btn-outline h-9 px-4 text-[15px]" title="Only in this browser: other moderators still see it" onClick={() => { dismissReportGroup(moderator, group); rerender(); }}>Dismiss</button>}
                </div>
            </li>
        );
    };

    return (<>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[13px] text-ink-muted">
            <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 cursor-pointer accent-ink" checked={validatedOnly} onChange={(e) => setValidatedOnly(e.target.checked)} />
                Validated reporters only
            </label>
            <span>{`${openGroups.length} open${checkingIdentities ? ` · checking ${checkingIdentities} ${checkingIdentities === 1 ? 'identity' : 'identities'}` : ''}`}</span>
        </div>
        {pendingReports > 0 && <p className="border-b border-line px-4 py-2 text-[13px] text-ink-muted">{`Loading ${plural(pendingReports, 'more report')}…`}</p>}
        {!openGroups.length && <p className="px-8 py-6 text-center text-[15px] text-ink-muted">{validatedOnly && allGroups.length ? 'No open reports from validated reporters.' : 'No open reports.'}</p>}
        <ul>
            {visibleGroups.map(renderGroup)}
        </ul>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        {!hasMore && closedGroups.length > 0 && <div className="px-4 py-3">
            <button type="button" className="cursor-pointer text-[13px] text-link hover:underline" onClick={() => setShowClosed(!showClosed)}>
                {showClosed ? 'Hide resolved and dismissed' : `Show ${closedGroups.length} resolved or dismissed`}
            </button>
        </div>}
    </>);
}

export default ModerationReports;
