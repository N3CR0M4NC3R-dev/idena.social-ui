import type { Post } from './asyncUtils';

export const TOPIC_PREFIX = 'r/';
// lower case letters, digits and "_", 3 to 21 characters
const TOPIC_NAME_REGEX = /^[a-z0-9_]{3,21}$/;

export const isValidTopicName = (name: string) => TOPIC_NAME_REGEX.test(name);

export const getTopicFromChannelId = (channelId: string) => {
    if (!channelId.startsWith(TOPIC_PREFIX)) return undefined;

    const name = channelId.slice(TOPIC_PREFIX.length);

    return isValidTopicName(name) ? name : undefined;
};

export const getTopicChannelId = (name: string) => TOPIC_PREFIX + name;

export const getDisplayTopic = (name: string) => TOPIC_PREFIX + name;

export const normalizeTypedTopic = (text: string) => {
    const trimmed = text.trim();
    const withoutPrefix = trimmed.toLowerCase().startsWith(TOPIC_PREFIX) ? trimmed.slice(TOPIC_PREFIX.length) : trimmed;

    return withoutPrefix.toLowerCase();
};

export type TopicSummary = { name: string, posts: number, lastActivity: number };

export const getTopicSummaries = (
    postIdsByActivity: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postLatestActivityRef: React.RefObject<Record<string, number>>,
) => {
    const summaries = new Map<string, TopicSummary>();

    for (let index = 0; index < postIdsByActivity.length; index++) {
        const postId = postIdsByActivity[index];
        const post = postsRef.current[postId];
        const name = post && getTopicFromChannelId(post.channelId);

        if (!name) continue;

        const summary = summaries.get(name);

        if (summary) {
            summary.posts++;
        } else {
            summaries.set(name, { name, posts: 1, lastActivity: postLatestActivityRef.current[postId] ?? post.timestamp });
        }
    }

    return [...summaries.values()];
};
