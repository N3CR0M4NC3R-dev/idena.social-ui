import { Link } from 'react-router';
import { useAppContext } from './AppContext';
import AddressLinkComponent from './components/AddressLinkComponent';
import HiddenPostPreviewComponent from './components/HiddenPostPreviewComponent';
import { describeAddressBanEnd, getAddressBan, getModerationSnapshot } from './logic/moderation';
import { getDisplayTimeAgo } from './logic/utils';

const sectionTitleClassName = 'px-4 pt-4 pb-2 text-[17px]/6 font-extrabold';
const rowClassName = 'flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3';
const emptyClassName = 'border-b border-line px-4 pb-4 text-[15px] text-ink-muted';

// Everything banned now: accounts and posts banned by the contract, and what this UI hides in code.
function ModerationBanned() {

    const {
        postsRef,
        handleOpenModerationSheet,
    } = useAppContext();

    const snapshot = getModerationSnapshot();

    const bannedAccounts = [...snapshot.contract.addressBans.entries()]
        .filter(([address]) => getAddressBan(address)?.source === 'contract')
        .sort(([, a], [, b]) => b.bannedAt - a.bannedAt);

    const postIdsByTxHash = new Map(Object.values(postsRef.current).filter((post) => post?.postId).map((post) => [post.txHash.toLowerCase(), post.postId]));
    const hiddenPosts = [...snapshot.contract.transactionBans.entries()].sort(([, a], [, b]) => b.bannedAt - a.bannedAt);

    return (<>
        <h3 className={sectionTitleClassName}>Banned accounts</h3>
        {!bannedAccounts.length && <p className={emptyClassName}>None.</p>}
        <ul>
            {bannedAccounts.map(([address, ban]) => (
                <li key={address} className={rowClassName}>
                    <div className="min-w-0 flex-1 text-[15px]/5">
                        <AddressLinkComponent address={address} />
                        <p className="text-ink [word-break:break-word]">{`Banned ${describeAddressBanEnd(ban)}${ban.reason ? ` · ${ban.reason}` : ''}`}</p>
                        <p className="text-[13px] text-ink-muted">by <AddressLinkComponent address={ban.moderator} className="font-normal text-ink-muted" /> · {getDisplayTimeAgo(ban.bannedAt)}</p>
                    </div>
                    <div className="flex flex-none gap-2">
                        <Link to={`/moderation/banned/${address}`} className="btn-outline h-9 px-4 text-[15px]">Review posts</Link>
                        <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'unban', address })}>Unban…</button>
                    </div>
                </li>
            ))}
        </ul>

        <h3 className={sectionTitleClassName}>Posts hidden individually</h3>
        {!hiddenPosts.length && <p className={emptyClassName}>None.</p>}
        <ul>
            {hiddenPosts.map(([hash, ban]) => {
                const postId = postIdsByTxHash.get(hash);
                const post = postId ? postsRef.current[postId] : undefined;
                return (
                    <li key={hash} className={rowClassName}>
                        <div className="min-w-0 flex-1 text-[15px]/5">
                            {postId ? <HiddenPostPreviewComponent postId={postId} /> : <a className="text-[13px] text-link hover:underline" href={`https://scan.idena.io/transaction/${hash}`} target="_blank" rel="noopener noreferrer">{`Transaction ${hash.slice(0, 10)}… (not loaded yet)`}</a>}
                            <p className="mt-1 text-[13px] text-ink-muted [word-break:break-word]">{ban.reason ? `${ban.reason} · ` : ''}by <AddressLinkComponent address={ban.moderator} className="font-normal text-ink-muted" /> · {getDisplayTimeAgo(ban.bannedAt)}</p>
                        </div>
                        {post && <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'restore', hash, author: post.poster })}>Restore…</button>}
                    </li>
                );
            })}
        </ul>

        <h3 className={sectionTitleClassName}>Hidden by this UI (in code)</h3>
        {!snapshot.uiAddresses.size && !snapshot.uiTransactions.size && <p className={emptyClassName}>None.</p>}
        <ul>
            {[...snapshot.uiAddresses].map((address) => (
                <li key={address} className={rowClassName}><AddressLinkComponent address={address} /><span className="text-[13px] text-ink-muted">Account</span></li>
            ))}
            {[...snapshot.uiTransactions].map((hash) => {
                const postId = postIdsByTxHash.get(hash);
                return (
                    <li key={hash} className={rowClassName}>
                        {postId ? <HiddenPostPreviewComponent postId={postId} /> : <span className="text-[13px] text-ink-muted">{`Transaction ${hash.slice(0, 10)}…`}</span>}
                    </li>
                );
            })}
        </ul>
        <p className="px-4 py-3 text-[13px] text-ink-muted">Lifted only by removing them from the code.</p>
    </>);
}

export default ModerationBanned;
