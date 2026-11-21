import AddressLinkComponent from './components/AddressLinkComponent';
import { getModerationSnapshot, moderationConfig } from './logic/moderation';

// Who moderates: vouched moderators and who vouched for them. Stakers moderate by their stake and aren't listed.
function ModerationModerators() {

    const vouched = [...getModerationSnapshot().contract.vouchers.entries()];

    return (<>
        <h3 className="px-4 pt-4 pb-2 text-[17px]/6 font-extrabold">Vouched moderators</h3>
        {!vouched.length && <p className="border-b border-line px-4 pb-4 text-[15px] text-ink-muted">None.</p>}
        <ul>
            {vouched.map(([address, vouchers]) => (
                <li key={address} className="border-b border-line px-4 py-3 text-[15px]/5">
                    <AddressLinkComponent address={address} />
                    <p className="text-[13px] text-ink-muted">vouched for by {[...vouchers].map((voucher, index) => <span key={voucher}>{index > 0 && ', '}<AddressLinkComponent address={voucher} className="font-normal text-ink-muted" /></span>)}</p>
                </li>
            ))}
        </ul>
        <p className="px-4 py-3 text-[13px] text-ink-muted">{`Stakers, identities with ${(moderationConfig?.stakeThreshold ?? 1_000_000).toLocaleString('en-US')}+ iDNA staked, moderate automatically and aren't listed here.`}</p>
    </>);
}

export default ModerationModerators;
