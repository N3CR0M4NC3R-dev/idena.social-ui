import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ModerationRequest, MouseEventLocal } from '../App.exports';
import { useAppContext } from '../AppContext';
import type { Post } from '../logic/asyncUtils';
import { getAddressBan, getVouchers, isStaker, moderationConfig } from '../logic/moderation';
import { getDisplayAddressShort } from '../logic/utils';
import { MoreIcon } from './icons';

type PostMenuComponentProps = {
    post: Post,
    rootPostId: string,
    small?: boolean,
};

const itemClassName = 'block w-full cursor-pointer px-4 py-2.5 text-left text-[15px]/5 text-ink hover:bg-ink/10';
const MENU_HEIGHT_ESTIMATE = 360;
const MENU_GAP = 4;

// A post's "⋯" menu: a link to it and its transaction, and reporting it or its author, for everyone; for moderators,
// hiding it and banning its author too. Actions the contract would refuse are shown disabled, with the reason. Only
// shown when moderation is configured.
function PostMenuComponent(props: PostMenuComponentProps) {

    const {
        post,
        rootPostId,
        small,
    } = props;

    const {
        postersRef,
        postersAddress,
        moderatorRole,
        handleOpenModerationSheet,
    } = useAppContext();

    // Where the menu opens: it's rendered above the page (a portal), so a scrolling or clipping box around the post,
    // such as a reply's comments, can't cut it off.
    const [position, setPosition] = useState<React.CSSProperties>();
    const [copied, setCopied] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const open = !!position;
    const close = () => setPosition(undefined);

    const toggle = () => {
        if (open) {
            close();
            return;
        }
        const rect = buttonRef.current!.getBoundingClientRect();
        const right = window.innerWidth - rect.right;
        setPosition(rect.bottom + MENU_HEIGHT_ESTIMATE + MENU_GAP > window.innerHeight
            ? { position: 'fixed', right, bottom: window.innerHeight - rect.top + MENU_GAP }
            : { position: 'fixed', right, top: rect.bottom + MENU_GAP });
    };

    useEffect(() => {
        if (!open) return;

        const closeOnOutside = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close();
        };
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };

        document.addEventListener('mousedown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
        // Fixed in place, it would drift from its button: close it instead.
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);

        return () => {
            document.removeEventListener('mousedown', closeOnOutside);
            document.removeEventListener('keydown', closeOnEscape);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    if (!moderationConfig) {
        return null;
    }

    const author = post.poster;
    const authorDisplay = getDisplayAddressShort(author, postersRef.current[author]);
    const isOwnPost = author === postersAddress.toLowerCase();
    const authorStake = postersRef.current[author]?.stake ?? post.posterDetails_atTimeOfPost.stake;
    const getBanRefusal = () => {
        if (isStaker(authorStake)) return 'Stakers can\'t be banned.';
        if (getVouchers(author).length) return 'Moderators can\'t be banned: a staker must revoke their vouches first.';
    };
    const banRefusal = getBanRefusal();
    // The contract refuses reports from accounts it has banned.
    const canReport = !isOwnPost && getAddressBan(postersAddress)?.source !== 'contract';

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    const copyLink = async (e: MouseEventLocal) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/post/${rootPostId}`);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
                close();
            }, 800);
        } catch {
            close();
        }
    };

    const openSheet = (e: MouseEventLocal, request: ModerationRequest) => {
        close();
        handleOpenModerationSheet(e, request);
    };

    return (
        <div className="ml-auto flex-none" onMouseDown={stop} onClick={stop}>
            <button ref={buttonRef} type="button" aria-label="More" title="More" aria-expanded={open} className={`inline-flex ${small ? 'size-6' : 'size-[30px]'} cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink`} onClick={toggle}>
                <MoreIcon className={small ? 'size-4' : 'size-[18px]'} />
            </button>
            {open && createPortal(<div ref={menuRef} role="menu" style={position} className="z-40 w-64 overflow-hidden rounded-xl border border-line bg-canvas py-1 shadow-lg" onMouseDown={stop} onClick={stop}>
                <button type="button" role="menuitem" className={itemClassName} onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
                <a role="menuitem" className={itemClassName} href={`https://scan.idena.io/transaction/${post.txHash}`} target="_blank" rel="noopener noreferrer" onClick={close}>View on explorer</a>
                {canReport && <>
                    <button type="button" role="menuitem" className={itemClassName} onClick={(e) => openSheet(e, { kind: 'reportPost', hash: post.txHash, author })}>Report post…</button>
                    <button type="button" role="menuitem" className={itemClassName} onClick={(e) => openSheet(e, { kind: 'reportAccount', address: author })}>{`Report ${authorDisplay}…`}</button>
                </>}
                {moderatorRole && <>
                    <p className="mt-1 border-t border-line px-4 pt-2 pb-1 text-[13px] font-bold text-ink-muted">Moderation</p>
                    <button type="button" role="menuitem" className={itemClassName} onClick={(e) => openSheet(e, { kind: 'hide', hash: post.txHash, author })}>Hide this post…</button>
                    {!isOwnPost && (banRefusal
                        ? <div role="menuitem" aria-disabled="true" className="px-4 py-2.5 text-[15px]/5 text-ink-muted">
                            {`Ban ${authorDisplay}`}
                            <span className="block text-[13px]">{banRefusal}</span>
                        </div>
                        : <button type="button" role="menuitem" className={itemClassName} onClick={(e) => openSheet(e, { kind: 'ban', address: author })}>{`Ban ${authorDisplay}…`}</button>)}
                </>}
            </div>, document.body)}
        </div>
    );
}

export default PostMenuComponent;
