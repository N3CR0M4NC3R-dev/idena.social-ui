import { useAppContext } from './AppContext';
import AddressLinkComponent from './components/AddressLinkComponent';
import { compareModerationEvents, getVouchers, getVouchesGiven, moderationConfig } from './logic/moderation';
import { getModerationEvents } from './logic/moderationSync';
import { getDisplayTimeAgo } from './logic/utils';

// Your vouches in effect, each with Withdraw (docs/moderation.md, "Vouching"). For stakers, and for anyone whose
// vouches outlived their stake or who was banned: withdrawing is the one thing they can still do.
function ModerationVouches() {

    const {
        postersAddress,
        moderatorRole,
        handleOpenModerationSheet,
    } = useAppContext();

    const me = postersAddress.toLowerCase();
    const vouchesGiven = getVouchesGiven(me);
    const maxVouches = moderationConfig?.maxVouches ?? 5;

    // When each vouch in effect was made: your vouch for the address that nothing withdrew or revoked since. One just
    // confirmed has no date until the indexer lists it.
    const vouchedAt = new Map<string, number>();
    for (const event of [...getModerationEvents()].sort(compareModerationEvents)) {
        if (event.name === 'vouch' && event.voucher === me) vouchedAt.set(event.address, event.timestamp);
        else if ((event.name === 'vouchWithdrawn' && event.voucher === me) || event.name === 'vouchesRevoked') vouchedAt.delete(event.address);
    }

    return (<>
        <h3 className="px-4 pt-4 pb-1 text-[17px]/6 font-extrabold">{`My vouches (${vouchesGiven.length}/${maxVouches})`}</h3>
        <p className="border-b border-line px-4 pb-3 text-[13px] text-ink-muted">
            {moderatorRole === 'staker'
                ? 'Each makes an account a moderator. Vouch for an account from its profile: Moderate › Vouch as moderator.'
                : vouchesGiven.length ? 'You can no longer vouch, but these stay in effect until you withdraw them or a staker revokes them.' : 'Only stakers can vouch.'}
        </p>
        {!vouchesGiven.length && <p className="border-b border-line px-4 py-3 text-[15px] text-ink-muted">None.</p>}
        <ul>
            {vouchesGiven.map((address) => {
                const others = getVouchers(address).filter((voucher) => voucher !== me).length;
                const at = vouchedAt.get(address);
                return (
                    <li key={address} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
                        <div className="min-w-0 flex-1 text-[15px]/5">
                            <AddressLinkComponent address={address} />
                            <p className="text-[13px] text-ink-muted">
                                {[at && `Vouched ${getDisplayTimeAgo(at)}`, others ? `also vouched for by ${others} other${others === 1 ? '' : 's'}` : 'only your vouch'].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                        <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" onClick={(e) => handleOpenModerationSheet(e, { kind: 'withdrawVouch', address })}>Withdraw…</button>
                    </li>
                );
            })}
        </ul>
    </>);
}

export default ModerationVouches;
