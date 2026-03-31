export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflowHidden: boolean, repliesHidden: boolean, replyInputHidden: boolean, discussReplyToPostId?: string };
export type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;

export const initDomSettings = { textOverflowHidden: true, repliesHidden: true, replyInputHidden: true };
export const isPostOutletDomSettings = { textOverflowHidden: false, repliesHidden: false, replyInputHidden: true };
