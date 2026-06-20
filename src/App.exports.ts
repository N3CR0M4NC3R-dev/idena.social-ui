export type BrowserStateHistorySettings = { sortPostsBy: string, postDomSettings: PostDomSettingsCollection };
export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflowHidden: boolean, repliesHidden: boolean, replyInputHidden: boolean, discussReplyToPostId?: string };
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

export const initDomSettings = { textOverflowHidden: true, repliesHidden: true, replyInputHidden: true };
export const isPostOutletDomSettings = { textOverflowHidden: false, repliesHidden: false, replyInputHidden: true };
