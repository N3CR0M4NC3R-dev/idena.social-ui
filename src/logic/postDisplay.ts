import type { RefObject } from 'react';
import { getChildPostIds, type Post } from './asyncUtils';
import { createPostDisplayResolver, type PostDisplay } from './moderation';
import { getSpotlightPostDetails } from './utils';

export type PostDisplayResolver = (postId: string) => PostDisplay;

// How each post displays under moderation: 'visible', 'placeholder' or 'removed'. Build one per render: it memoises,
// and the threads change between renders.
export const createPostDisplayResolverFromRefs = (
    postsRef: RefObject<Record<string, Post>>,
    replyPostsTreeRef: RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: RefObject<Record<string, string>>,
): PostDisplayResolver => createPostDisplayResolver({
    // postsRef also holds 'discuss:' bookkeeping entries and cleared ids: only real posts count.
    getPost: (postId) => {
        const post = postsRef.current[postId];
        return post?.postId ? post : undefined;
    },
    getChildIds: (treeKey) => [
        ...getChildPostIds(treeKey, replyPostsTreeRef.current),
        ...getChildPostIds(treeKey, deOrphanedReplyPostsTreeRef.current),
    ],
});

// Whether a thread item can be shown: none of its root post, reply or comment is removed.
export const isThreadItemShown = (resolveDisplay: PostDisplayResolver, ...postIds: (string | undefined)[]) =>
    postIds.every((postId) => !postId || resolveDisplay(postId) !== 'removed');

// Whether a profile tab or Post Activity item that spotlights spotlightPost can be shown. Posts that haven't loaded
// yet pass: the page already skips those.
export const isSpotlightShown = (resolveDisplay: PostDisplayResolver, spotlightPost: Post | undefined, postsRef: RefObject<Record<string, Post>>) => {
    if (!spotlightPost) return true;
    const { replyPostId, discussionPostId, parentPost } = getSpotlightPostDetails(spotlightPost, postsRef);
    return isThreadItemShown(resolveDisplay, parentPost?.postId, replyPostId, discussionPostId);
};
