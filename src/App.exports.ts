export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflowHidden: boolean, repliesHidden: boolean, discussReplyToPostId?: string };
export type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;
export type PostImageAttachment = { dataUrl: string, name: string, size: number, file: File };

export const initDomSettings = { textOverflowHidden: true, repliesHidden: true };
export const isPostOutletDomSettings = { textOverflowHidden: false, repliesHidden: false };
