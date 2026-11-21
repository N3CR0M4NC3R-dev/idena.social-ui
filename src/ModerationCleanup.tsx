import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAppContext } from './AppContext';
import AddressLinkComponent from './components/AddressLinkComponent';
import HiddenPostPreviewComponent from './components/HiddenPostPreviewComponent';
import { describeAddressBanEnd, getAddressBan, getTransactionBan } from './logic/moderation';

// Before an unban: a banned account's posts, to hide the ones that should stay hidden, in one batch
// (docs/moderation.md, "Cleaning up a banned account"). Everything not hidden individually reappears on the unban.
function ModerationCleanup() {
    const address = useParams().address!.toLowerCase();

    const {
        postsRef,
        getProfileActivityPostIds,
        handleOpenModerationSheet,
    } = useAppContext();

    const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>();

    const ban = getAddressBan(address);
    if (ban?.source !== 'contract') {
        return (<p className="px-8 py-6 text-center text-[15px] text-ink-muted">
            This account isn't banned by the contract. <Link to="/moderation/banned" className="text-link hover:underline">Back to Banned</Link>
        </p>);
    }

    const posts = [...new Set(getProfileActivityPostIds(address))]
        .map((postId) => postsRef.current[postId])
        .filter((post) => post?.postId && !post.isLike)
        .sort((a, b) => b.timestamp - a.timestamp);

    const alreadyHidden = posts.filter((post) => getTransactionBan(post.txHash));
    const duringBan = posts.filter((post) => !getTransactionBan(post.txHash) && post.timestamp >= ban.since);
    const beforeBan = posts.filter((post) => !getTransactionBan(post.txHash) && post.timestamp < ban.since);

    // Everything is selected at first: unticking a post keeps it out of the batch, so it reappears on the unban.
    const selected = selectedPostIds ?? new Set([...duringBan, ...beforeBan].map((post) => post.postId));
    const toggle = (postId: string) => {
        const next = new Set(selected);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        setSelectedPostIds(next);
    };
    const selectedHashes = [...duringBan, ...beforeBan].filter((post) => selected.has(post.postId)).map((post) => post.txHash);

    const renderGroup = (title: string, groupPosts: typeof posts, selectable: boolean) => groupPosts.length > 0 && <>
        <h3 className="px-4 pt-4 pb-2 text-[15px]/5 font-bold text-ink-muted">{title}</h3>
        <ul>
            {groupPosts.map((post) => (
                <li key={post.postId} className="flex items-start gap-3 border-b border-line px-4 py-3">
                    {selectable && <input type="checkbox" aria-label="Select" className="mt-0.5 size-4 flex-none cursor-pointer accent-ink" checked={selected.has(post.postId)} onChange={() => toggle(post.postId)} />}
                    <HiddenPostPreviewComponent postId={post.postId} showAuthor={false} />
                </li>
            ))}
        </ul>
    </>;

    return (<>
        <div className="border-b border-line px-4 py-3 text-[15px]/5">
            <AddressLinkComponent address={address} />
            <p className="[word-break:break-word]">{`Banned ${describeAddressBanEnd(ban)}${ban.reason ? ` · ${ban.reason}` : ''}`}</p>
            <p className="text-[13px] text-ink-muted">by <AddressLinkComponent address={ban.moderator} className="font-normal text-ink-muted" /></p>
        </div>
        {!posts.length && <p className="px-8 py-6 text-center text-[15px] text-ink-muted">No posts from this account have loaded yet. Scanning further back finds older ones.</p>}
        {renderGroup('Posted during the ban: they first appear on the unban', duringBan, true)}
        {renderGroup('Posted before the ban: restored on the unban', beforeBan, true)}
        {renderGroup(`Already hidden individually (${alreadyHidden.length}): they stay hidden`, alreadyHidden, false)}
        <div className="sticky bottom-[53px] flex flex-wrap justify-end gap-2 border-t border-line bg-canvas px-4 py-3 sm:bottom-0">
            <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={!selectedHashes.length} onClick={(e) => handleOpenModerationSheet(e, { kind: 'batchHide', address, hashes: selectedHashes })}>{`Hide ${selectedHashes.length} selected…`}</button>
            <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'unban', address })}>Unban…</button>
        </div>
    </>);
}

export default ModerationCleanup;
