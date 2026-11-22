import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAppContext } from './AppContext';
import PageHeaderComponent from './components/PageHeaderComponent';
import { getAddressBan, getVouchers, getVouchesGiven, moderationConfig } from './logic/moderation';
import ModerationVouches from './ModerationVouches';

const VOUCHES_TAB = { label: 'My vouches', path: '/moderation/vouches' };
const MODERATOR_TABS = [
    { label: 'Reports', path: '/moderation' },
    { label: 'Banned', path: '/moderation/banned' },
    { label: 'Log', path: '/moderation/log' },
    { label: 'Moderators', path: '/moderation/moderators' },
];
// A staker's stake within this share of the threshold gets a warning: below it, they stop moderating.
const STAKE_WARNING_MARGIN = 0.05;

// The Moderation page: moderators only, since it shows hidden content (docs/moderation.md, "The Moderation page"). Someone
// who vouched and can no longer moderate (their stake dropped, or they were banned) only sees their vouches, to
// withdraw them, whatever the URL: it stays as it is, so the tab asked for shows if they turn out to moderate.
function Moderation() {
    const location = useLocation();
    const navigate = useNavigate();

    const {
        postersAddress,
        postersRef,
        moderatorRole,
        moderatorVerified,
        handleOpenVerifyModal,
    } = useAppContext();

    const me = postersAddress.toLowerCase();
    const vouchesGiven = moderationConfig ? getVouchesGiven(me) : [];

    if (!moderationConfig || (!moderatorRole && !vouchesGiven.length)) {
        return (<>
            <PageHeaderComponent title="Moderation" />
            <p className="px-8 py-6 text-center text-[15px] text-ink-muted">Only moderators can see this page.</p>
        </>);
    }

    // A staker's role needs their stake, from their own identity, which loads after the replay: until it does, they
    // can't be told apart from a former staker.
    if (!moderatorRole && !postersRef.current[me]?.address) {
        return (<>
            <PageHeaderComponent title="Moderation" />
            <p className="px-8 py-6 text-center text-[15px] text-ink-muted">Checking your stake…</p>
        </>);
    }

    const showVouchesTab = moderatorRole === 'staker' || vouchesGiven.length > 0 || location.pathname === VOUCHES_TAB.path;
    const tabs = !moderatorRole ? [VOUCHES_TAB] : showVouchesTab ? [...MODERATOR_TABS, VOUCHES_TAB] : MODERATOR_TABS;

    // Stake can drop at validation, and the contract checks it again each epoch: warn a staker close to the threshold,
    // unless vouches keep them a moderator anyway.
    const stake = Number(postersRef.current[me]?.stake ?? 0);
    const threshold = moderationConfig.stakeThreshold;
    const stakeWarning = moderatorRole === 'staker' && !getVouchers(me).length && stake < threshold * (1 + STAKE_WARNING_MARGIN)
        ? `Stake ${Math.floor(stake).toLocaleString('en-US')}: you stop moderating below ${threshold.toLocaleString('en-US')}.`
        : undefined;
    const vouchesKept = `${vouchesGiven.length === 1 ? 'your vouch stays' : `your ${vouchesGiven.length} vouches stay`} in effect.`;
    const status = moderatorRole
        ? (moderatorVerified ? 'Verified ✓ You can view hidden posts.' : 'Not verified: you can moderate, but not view hidden posts.')
        : getAddressBan(me)?.source === 'contract' ? `Banned accounts can't moderate, but ${vouchesKept}` : `You can no longer moderate, but ${vouchesKept}`;
    const subtitle = moderatorRole === 'staker' ? 'Moderator · staker' : moderatorRole === 'vouched' ? 'Moderator · vouched' : 'Not a moderator';

    const activeTab = !moderatorRole ? VOUCHES_TAB : tabs.find((tab) => tab.path === location.pathname) ?? (location.pathname.startsWith('/moderation/banned/') ? MODERATOR_TABS[1] : undefined);

    return (<>
        <PageHeaderComponent title="Moderation" subtitle={subtitle} />
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-[13px] text-ink-muted">
            <span>{status}</span>
            {moderatorRole && !moderatorVerified && <button type="button" className="btn-outline h-8 flex-none px-3 text-[13px]" onClick={handleOpenVerifyModal}>Verify</button>}
        </div>
        {stakeWarning && <p className="border-b border-line px-4 py-2 text-[13px] text-danger">{stakeWarning}</p>}
        <div className="no-scrollbar flex flex-row overflow-x-auto border-b border-line px-2 sm:px-0" role="tablist">
            {tabs.map((tab) => (
                <button key={tab.path} type="button" role="tab" aria-selected={tab === activeTab} className="flex h-[53px] min-w-fit flex-1 cursor-pointer justify-center px-2 hover:bg-ink/10 sm:px-4" onClick={() => tab.path !== location.pathname && navigate(tab.path)}>
                    <span className={`relative flex items-center text-[15px] ${tab === activeTab ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                        {tab.label}
                        {tab === activeTab && <span className="absolute bottom-0 left-1/2 h-1 w-full min-w-14 -translate-x-1/2 rounded-full bg-accent" />}
                    </span>
                </button>
            ))}
        </div>
        {moderatorRole ? <Outlet /> : <ModerationVouches />}
    </>);
}

export default Moderation;
