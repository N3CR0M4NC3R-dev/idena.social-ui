import type { Message, Post, Tip } from "./logic/asyncUtils";

export type BrowserStateHistorySettings = { sortPostsBy: string, postDomSettings: PostDomSettingsCollection };
export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflowHidden: boolean, repliesHidden: boolean, replyInputHidden: boolean, showMaxReplies?: number, discussReplyToPostId?: string };
export type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;
export type PostMediaAttachment = { file: File; ipfsUrl?: string };
export type EventTransaction = {
    txHash: string;
    timestamp: number;
    blockHeight?: number | undefined;
    eventArgs: any;
    eventArgs2nd: any;
    method: any;
};
export type TransactionCached = {
    txHash: string;
    timestamp: number;
    method: any;
    blockHeight?: number | undefined;
    cachedItem: Post | Tip | Message;
};
export type Conversation = { participants: string[], messages: string[] };
export type PostFinderTransaction = { txHash: string, timestamp: number, blockHeight?: number };

export const discussPrefix = 'discuss:';
export const messagePrefix = 'message:';
export const zeroAddress = '0x0000000000000000000000000000000000000000';
export const SET_NEW_POSTS_ADDED_DELAY = 20;

export const initDomSettings = { textOverflowHidden: true, repliesHidden: true, replyInputHidden: true, showMaxReplies: 5 };
export const initPostOutletDomSettings = { textOverflowHidden: false, repliesHidden: false, replyInputHidden: true };
export const initProfileRepliesDomSettings = { textOverflowHidden: true, repliesHidden: false, replyInputHidden: true, showMaxReplies: 1 };

export type ProfileActivity = { posts: string[], replies: string[], comments: string[], likes: string[], tips: string[], media: string[] }
export const defaultProfileActivity = { posts: [], replies: [], comments: [], likes: [], tips: [], media: [] };
export type PostActivityItem = { timestamp: number, postId: string, type: 'reply' | 'commentReply' | 'comment' | 'tip', read: boolean,  tipTxHash?: string };

export type ModerationRequest =
    | { kind: 'moderate', address: string }
    | { kind: 'ban', address: string }
    | { kind: 'unban', address: string }
    | { kind: 'hide', hash: string, author: string }
    | { kind: 'restore', hash: string, author: string }
    | { kind: 'batchHide', address: string, hashes: string[] }
    | { kind: 'reportAccount', address: string }
    | { kind: 'reportPost', hash: string, author: string }
    | { kind: 'vouch' | 'withdrawVouch' | 'revokeVouches', address: string };
