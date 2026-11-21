import { zeroAddress } from '../App.exports';
import { describeAddressBanEnd, getAddressBan } from '../logic/moderation';

type OwnBanNoticeComponentProps = {
    postersAddress: string,
    className?: string,
};

// Warns, before a fee is paid, that this account's posts won't be shown. Renders nothing unless it's banned.
function OwnBanNoticeComponent(props: OwnBanNoticeComponentProps) {

    const {
        postersAddress,
        className = '',
    } = props;

    if (!postersAddress || postersAddress.toLowerCase() === zeroAddress) {
        return null;
    }

    const ban = getAddressBan(postersAddress);

    if (!ban) {
        return null;
    }

    const notice = ban.source === 'contract'
        ? `Your account is banned ${describeAddressBanEnd(ban)}: your posts won't be shown on idena.social.`
        : 'Your account is hidden on idena.social: your posts won\'t be shown.';

    return <p className={`rounded-lg bg-surface px-3 py-2 text-[13px] text-ink ${className}`}>{notice}</p>;
}

export default OwnBanNoticeComponent;
