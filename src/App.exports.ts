export type PostDomSettingsCollection = Record<string, Record<string, PostDomSettings>>;
export type PostDomSettings = { textOverflows: boolean, textOverflowHidden: boolean, repliesHidden: boolean, discussReplyToPostId?: string };
export type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;

export const initDomSettings = { textOverflows: false, textOverflowHidden: true, repliesHidden: true };
export const isPostOutletDomSettings = { textOverflows: false, textOverflowHidden: false, repliesHidden: false };
