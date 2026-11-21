import { isAddressBanned } from '../logic/moderation';

type BannedLabelComponentProps = {
    address: string,
    className?: string,
};

// A "Banned" pill next to a banned account's address. Renders nothing for other accounts.
function BannedLabelComponent(props: BannedLabelComponentProps) {

    const {
        address,
        className = '',
    } = props;

    if (!isAddressBanned(address)) {
        return null;
    }

    return (
        <span className={`inline-flex h-[18px] flex-none items-center rounded-full bg-btn-hover px-1.5 text-[11px]/none font-bold text-btn-ink ${className}`}>
            <span className="[text-box:trim-both_cap_alphabetic]">Banned</span>
        </span>
    );
}

export default BannedLabelComponent;
