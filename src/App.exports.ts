export type BrowserStateHistorySettings = { sortPostsBy: string, postDomSettings: PostDomSettingsCollection };
export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflowHidden: boolean, repliesHidden: boolean, replyInputHidden: boolean, showMaxReplies: number, discussReplyToPostId?: string };
export type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;
export type PostMediaAttachment = { dataUrl: string; file: File; ipfsUrl?: string };
export type EventTransaction = {
    txHash: string;
    timestamp: number;
    blockHeight?: number | undefined;
    eventArgs: any;
    eventArgs2nd: any;
    method: any;
};

export const initDomSettings = { textOverflowHidden: true, repliesHidden: true, replyInputHidden: true, showMaxReplies: 5 };
export const initPostOutletDomSettings = { textOverflowHidden: false, repliesHidden: false, replyInputHidden: true, showMaxReplies: 10 };
export const initProfileRepliesDomSettings = { textOverflowHidden: true, repliesHidden: false, replyInputHidden: true, showMaxReplies: 1 };

export type ProfileActivity = { posts: string[], replies: string[], comments: string[], likes: string[], tips: string[], media: string[] }
export const defaultProfileActivity = { posts: [], replies: [], comments: [], likes: [], tips: [], media: [] };
