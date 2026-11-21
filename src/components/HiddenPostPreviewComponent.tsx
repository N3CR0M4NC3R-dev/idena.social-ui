import { Link } from 'react-router';
import { useAppContext } from '../AppContext';
import { getMediaFile } from '../logic/asyncUtils';
import { getDisplayAddressShort, getDisplayTimeAgo, getMessageLines } from '../logic/utils';
import MediaComponent from './MediaComponent';

type HiddenPostPreviewComponentProps = {
    postId: string,
    showAuthor?: boolean,
};

// A hidden post on the Moderation page: who posted it and when, with Show to reveal its text and media on this
// screen only (verified moderators).
function HiddenPostPreviewComponent(props: HiddenPostPreviewComponentProps) {

    const {
        postId,
        showAuthor = true,
    } = props;

    const {
        postsRef,
        postersRef,
        revealedPostIdsRef,
        revealPostHandler,
        concealPostHandler,
    } = useAppContext();

    const post = postsRef.current[postId];
    if (!post?.postId) {
        return <p className="text-[13px] text-ink-muted">This post hasn't loaded yet.</p>;
    }

    const revealed = revealedPostIdsRef.current.has(postId);
    const loading = revealed && post.message?.startsWith('ipfs://') && !post.messageResolved;
    const mediaFile = revealed ? getMediaFile(post) : undefined;
    const level = post.postLevel === 'Post' ? 'Post' : post.postLevel === 'Reply' ? 'Reply' : 'Comment';

    return (
        <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">
                {level}
                {showAuthor && <> by <Link to={`/profile/${post.poster}`} className="hover:underline">{getDisplayAddressShort(post.poster, postersRef.current[post.poster])}</Link></>}
                {` · ${getDisplayTimeAgo(post.timestamp)} · `}
                <button type="button" className="cursor-pointer text-link hover:underline" onClick={() => revealed ? concealPostHandler(postId) : revealPostHandler(postId)}>{revealed ? 'Hide' : 'Show'}</button>
            </p>
            {revealed && <div className="mt-1 rounded-xl bg-ink/[0.04] px-3 py-2">
                {loading ? <p className="text-[13px] text-ink-muted">Loading…</p> : <p className="text-[15px]/5 text-ink [word-break:break-word]">{getMessageLines(post.message).messageLines.map((line, i, lines) => <span key={i}>{line}{i < lines.length - 1 && <br />}</span>)}</p>}
                {mediaFile && <MediaComponent className="mt-2 max-h-80 max-w-full size-auto rounded-2xl border border-line" file={mediaFile} />}
            </div>}
        </div>
    );
}

export default HiddenPostPreviewComponent;
