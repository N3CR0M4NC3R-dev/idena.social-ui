import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { zeroAddress, type ModerationRequest } from '../App.exports';
import { getPosterPromise, type Post, type Poster, type RpcClient } from '../logic/asyncUtils';
import { describeAddressBanEnd, getAddressBan, getModerationSnapshot, getOwnReport, getTransactionBan, getVouchers, getVouchesGiven, groupReports, isStaker, moderationConfig, type ModeratorRole } from '../logic/moderation';
import { getReasonBytes, prepareModerationCall, waitForModerationCall, type ModerationCall, type PreparedModerationCall, type SentModerationCall } from '../logic/moderationActions';
import { applyConfirmedTransaction } from '../logic/moderationSync';
import { getDisplayAddress, getDisplayAddressShort, getDisplayTimeAgo, getIdentityStatus } from '../logic/utils';

type ModalModerationComponentProps = {
    request: ModerationRequest,
    rpcClient: RpcClient,
    postersAddress: string,
    makePostsWith: string,
    useIndexer: boolean,
    indexerApiUrlRef: React.RefObject<string>,
    postersRef: React.RefObject<Record<string, Poster>>,
    postsRef: React.RefObject<Record<string, Post>>,
    profileActivityPostIds: (address: string) => string[],
    // Yours: stakers vouch and revoke from the Moderate panel.
    moderatorRole?: ModeratorRole,
    sendModerationCallHandler: (prepared: PreparedModerationCall) => Promise<SentModerationCall>,
    moderationChangedHandler: () => void,
    closeModal: () => void,
    // While a call is on its way the sheet can't be closed: it would carry on unseen.
    lockModal: (locked: boolean) => void,
};

type Status = { text: string, error?: boolean };

const BAN_REASONS = ['Spam', 'Scam/phishing', 'Illegal', 'Harassment'];
const LIFT_REASONS = ['Appeal accepted', 'Mistake'];
// A report needs a reason: "Other" asks for one to be written.
const OTHER_REASON = 'Other';
// The check made when a report sheet opens, before a reason is picked, sizes the fee with this one.
const PREVIEW_REPORT_REASON = 'Scam/phishing';
const DURATIONS = [
    { key: 'next', epochs: 1 },
    { key: '3', epochs: 3, label: '3 epochs' },
    { key: '10', epochs: 10, label: '10 epochs' },
    { key: 'permanent', epochs: 0, label: 'Permanent' },
    { key: 'custom', epochs: -1, label: 'Custom' },
];

const radioClassName = 'col-start-1 row-start-1 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-transparent checked:bg-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent forced-colors:appearance-auto';

function RadioCheckMark() {
    return (
        <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-btn-ink opacity-0 group-has-checked:opacity-100">
            <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// The sheets moderators act through (ban, unban, hide or restore a post, and a profile's Moderate panel), the
// vouching sheets for stakers, and the report sheets everyone uses. Each checks the action against the contract when it opens and again before it's
// sent, then waits for the contract to show it.
function ModalModerationComponent(props: ModalModerationComponentProps) {

    const {
        request,
        rpcClient,
        postersAddress,
        makePostsWith,
        useIndexer,
        indexerApiUrlRef,
        postersRef,
        postsRef,
        profileActivityPostIds,
        moderatorRole,
        sendModerationCallHandler,
        moderationChangedHandler,
        closeModal,
        lockModal,
    } = props;

    const [current, setCurrent] = useState<ModerationRequest>(request);
    const [reason, setReason] = useState('');
    const [durationKey, setDurationKey] = useState('next');
    const [customEpochs, setCustomEpochs] = useState('');
    const [preview, setPreview] = useState<PreparedModerationCall>();
    const [status, setStatus] = useState<Status>();
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    // A batch in the Idena web app: the next transaction to sign. Each needs its own click, or popups are blocked.
    const [nextChunk, setNextChunk] = useState(0);
    const [otherReason, setOtherReason] = useState(false);
    const reasonInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        lockModal(busy);
        return () => lockModal(false);
    }, [busy]);
    const [, setPosterLoaded] = useState(0);

    const kind = current.kind;
    const isReport = kind === 'reportAccount' || kind === 'reportPost';
    const address = 'address' in current ? current.address.toLowerCase() : current.author.toLowerCase();
    const poster = postersRef.current[address];
    const displayAddress = getDisplayAddress(address, poster);
    const shortAddress = getDisplayAddressShort(address, poster);
    const ban = getAddressBan(address);
    const contractBan = ban?.source === 'contract' ? ban : undefined;
    const maxReasonBytes = moderationConfig?.maxReasonBytes ?? 280;
    const reasonBytes = getReasonBytes(reason);
    const { epoch, nextValidation } = getModerationSnapshot();

    const duration = DURATIONS.find((option) => option.key === durationKey)!;
    const epochs = duration.key === 'custom' ? Number(customEpochs) : duration.epochs;
    const epochsValid = Number.isInteger(epochs) && epochs >= (duration.key === 'custom' ? 1 : 0) && epochs <= (moderationConfig?.maxBanEpochs ?? 65_535);

    // A batch is sent in chunks of at most maxTransactionBatch posts, one transaction each.
    const batchSize = moderationConfig?.maxTransactionBatch ?? 100;
    const batchChunks = current.kind === 'batchHide'
        ? Array.from({ length: Math.ceil(current.hashes.length / batchSize) }, (_, index) => current.hashes.slice(index * batchSize, (index + 1) * batchSize))
        : [];

    const getCall = (callReason: string, chunk = 0): ModerationCall | undefined => {
        switch (current.kind) {
        case 'batchHide': return { method: 'banTransactions', args: { hashes: batchChunks[chunk] ?? [], reason: callReason } };
        case 'ban': return { method: 'ban', args: { address, epochs: epochsValid ? epochs : 1, reason: callReason } };
        case 'unban': return { method: 'unban', args: { address, reason: callReason } };
        case 'hide': return { method: 'banTransaction', args: { hash: current.hash, reason: callReason } };
        case 'restore': return { method: 'unbanTransaction', args: { hash: current.hash, reason: callReason } };
        case 'reportAccount': return { method: 'report', args: { address, reason: callReason } };
        case 'reportPost': return { method: 'reportTransaction', args: { hash: current.hash, reason: callReason } };
        case 'vouch':
        case 'withdrawVouch':
        case 'revokeVouches': return { method: current.kind, args: { address } };
        }
    };

    useEffect(() => {
        let ignore = false;

        const posterPromise = getPosterPromise(address, postersRef, useIndexer, rpcClient, indexerApiUrlRef);
        if (posterPromise instanceof Promise) posterPromise.then(() => !ignore && setPosterLoaded((count) => count + 1));

        return () => {
            ignore = true;
        };
    }, [address]);

    // Checks the action as soon as the sheet opens, so a refusal or the max fee shows before a reason is written.
    useEffect(() => {
        let ignore = false;

        const call = getCall(isReport ? PREVIEW_REPORT_REASON : '');
        if (call) {
            prepareModerationCall(rpcClient, postersAddress, call).then((prepared) => {
                if (!ignore) setPreview(prepared);
            });
        }

        return () => {
            ignore = true;
        };
    }, [kind]);

    const switchTo = (next: ModerationRequest) => {
        setCurrent(next);
        setReason('');
        setOtherReason(false);
        setDone(false);
        setPreview(undefined);
        setStatus(undefined);
    };

    // Checks, sends and waits for one call; returns whether the contract shows it.
    const runCall = async (call: ModerationCall, prefix: string) => {
        setStatus({ text: `${prefix}Checking…` });

        const prepared = await prepareModerationCall(rpcClient, postersAddress, call);
        setPreview(prepared);
        if (prepared.error) {
            setStatus({ text: `${prefix}${prepared.error}`, error: true });
            return false;
        }

        const sent = await sendModerationCallHandler(prepared);
        if (sent.error) {
            setStatus({ text: `${prefix}${sent.error}`, error: true });
            return false;
        }

        setStatus({ text: `${prefix}${makePostsWith === 'rpc' ? 'Sent. Waiting for the next block…' : 'Sign the transaction in the Idena app tab. Waiting for it to reach a block…'}` });

        const result = await waitForModerationCall(rpcClient, postersAddress, call, sent, indexerApiUrlRef.current);
        if (!result.applied) {
            setStatus({ text: `${prefix}${result.error ?? 'Not confirmed.'}`, error: true });
            return false;
        }

        // The contract shows it: so does the app, without waiting for the indexer.
        if (result.txHash && result.events) applyConfirmedTransaction(result.txHash, result.events);
        return true;
    };

    const submit = async () => {
        setBusy(true);

        const chunks = current.kind === 'batchHide' ? batchChunks.length : 1;
        for (let chunk = nextChunk; chunk < chunks; chunk++) {
            const call = getCall(reason.trim(), chunk);
            if (!call || !await runCall(call, chunks > 1 ? `Transaction ${chunk + 1} of ${chunks}: ` : '')) {
                setBusy(false);
                return;
            }

            // The Idena web app opens in a tab, which browsers only allow right after a click: wait for the next one.
            if (makePostsWith !== 'rpc' && chunk + 1 < chunks) {
                moderationChangedHandler();
                setNextChunk(chunk + 1);
                setStatus({ text: `Transaction ${chunk + 1} of ${chunks} done.` });
                setBusy(false);
                return;
            }
        }

        // The change shows across the app at once, and in the replay once its events reach the indexer.
        moderationChangedHandler();
        setStatus({ text: isReport ? 'Reported. Thank you: moderators will review it.' : 'Done.' });
        setDone(true);
        setBusy(false);
    };

    // What an unban brings back: posts made before the ban are restored, those made during it appear for the first
    // time, and those hidden individually stay hidden.
    const getUnbanPreview = () => {
        if (!contractBan) return;
        let restored = 0;
        let firstTime = 0;
        let stayHidden = 0;
        for (const postId of profileActivityPostIds(address)) {
            const post = postsRef.current[postId];
            if (!post || post.isLike) continue;
            if (getTransactionBan(post.txHash)) stayHidden++;
            else if (post.timestamp >= contractBan.since) firstTime++;
            else restored++;
        }
        return { restored, firstTime, stayHidden };
    };

    const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

    const titles: Record<ModerationRequest['kind'], string> = {
        moderate: `Moderate ${shortAddress}`,
        ban: `Ban ${shortAddress}`,
        unban: `Unban ${shortAddress}`,
        hide: 'Hide post',
        restore: 'Restore post',
        batchHide: current.kind === 'batchHide' ? `Hide ${plural(current.hashes.length, 'post')}` : '',
        reportAccount: `Report ${shortAddress}`,
        reportPost: `Report post by ${shortAddress}`,
        vouch: `Vouch for ${shortAddress}`,
        withdrawVouch: `Withdraw your vouch for ${shortAddress}`,
        revokeVouches: `Revoke ${shortAddress}'s moderator status`,
    };

    const me = postersAddress.toLowerCase();
    const maxVouches = moderationConfig?.maxVouches ?? 5;
    // The vouching sheets describe the vouches as they were when the sheet opened: once the action confirms, the live
    // state already shows its result.
    const vouchersAtOpen = useMemo(() => ({ vouchers: getVouchers(address), given: getVouchesGiven(me) }), [kind, address, me]);
    const listAddresses = (addresses: string[]) => addresses.map((item) => getDisplayAddressShort(item, postersRef.current[item])).join(', ');

    const banLine = contractBan && <p className="text-[15px]/5">
        <span className="font-bold">{`Banned ${describeAddressBanEnd(contractBan)}`}</span>
        {contractBan.reason && <span className="[word-break:break-word]">{` · ${contractBan.reason}`}</span>}
        <span className="block text-[13px] text-ink-muted">by <Link to={`/profile/${contractBan.moderator}`} className="hover:underline" onClick={closeModal}>{getDisplayAddressShort(contractBan.moderator, postersRef.current[contractBan.moderator])}</Link></span>
    </p>;

    const targetSummary = <div className="flex items-baseline justify-between gap-3">
        <Link to={`/profile/${address}`} className="min-w-0 truncate font-bold hover:underline" onClick={closeModal}>{displayAddress}</Link>
        {poster?.address && <span className="flex-none text-[13px] text-ink-muted">{`${getIdentityStatus(poster.state)} · Age ${poster.age} · Stake ${parseInt(poster.stake)}`}</span>}
    </div>;

    const reasonPresets = kind === 'unban' || kind === 'restore' ? LIFT_REASONS : isReport ? [...BAN_REASONS, OTHER_REASON] : BAN_REASONS;
    const pickReason = (preset: string) => {
        setOtherReason(preset === OTHER_REASON);
        if (preset === OTHER_REASON) {
            setReason('');
            reasonInputRef.current?.focus();
        } else {
            setReason(preset);
        }
    };
    const isPicked = (preset: string) => preset === OTHER_REASON ? otherReason : !otherReason && reason === preset;
    const reasonField = <div className="mt-4">
        <span className="block font-bold">{kind === 'unban' || kind === 'restore' || kind === 'batchHide' ? 'Reason (optional)' : isReport ? 'Why?' : 'Reason'}</span>
        <div className="mt-2 flex flex-wrap gap-2">
            {reasonPresets.map((preset) => (
                <button key={preset} type="button" className={`btn-outline h-8 px-3 text-[13px] ${isPicked(preset) ? 'bg-ink/10' : ''}`} disabled={busy || done} onClick={() => pickReason(preset)}>{preset}</button>
            ))}
        </div>
        <textarea
            ref={reasonInputRef}
            className="form-field mt-2 block min-h-20 resize-y text-[15px]"
            placeholder={otherReason ? 'What\'s wrong with it?' : undefined}
            value={reason}
            disabled={busy || done}
            onChange={(e) => setReason(e.target.value)}
        />
        <p className={`mt-1 text-right text-[13px] ${reasonBytes > maxReasonBytes ? 'text-danger' : 'text-ink-muted'}`}>{reasonBytes} / {maxReasonBytes} bytes</p>
    </div>;

    const feeLine = preview && !preview.error && <p className="text-[13px] text-ink-muted">{`Max fee ${preview.maxFee.toDecimalPlaces(2, 0)} iDNA: only the gas used is charged.`}</p>;

    const actionDisabled = busy || done || !preview || !!preview.error || reasonBytes > maxReasonBytes || (kind === 'ban' && !epochsValid) || (isReport && !reason.trim());

    const actionRow = (label: string) => <div className="mt-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {status ? <p className={`mr-auto text-[13px] ${status.error ? 'text-danger' : 'text-ink-muted'}`}>{status.text}</p> : preview?.error ? <p className="mr-auto text-[13px] text-danger">{preview.error}</p> : null}
        {!preview && !status && <p className="mr-auto text-[13px] text-ink-muted">Checking…</p>}
        <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={busy} onClick={closeModal}>{done ? 'Close' : 'Cancel'}</button>
        {!done && <button type="button" className="btn-primary h-9 px-4 text-[15px]" disabled={actionDisabled} onClick={submit}>{nextChunk ? `Sign transaction ${nextChunk + 1} of ${batchChunks.length}` : label}</button>}
    </div>;

    const renderModerate = () => {
        const staker = isStaker(poster?.stake);
        const vouchers = getVouchers(address);
        const vouchesGiven = getVouchesGiven(address);
        const reports = groupReports().find((group) => group.kind === 'address' && group.target === address)?.reports;
        // Vouching: for stakers, on anyone but themselves and other stakers. Whoever vouched can withdraw.
        const vouching = vouchers.includes(me);
        const canVouch = moderatorRole === 'staker' && !vouching && !staker && address !== me;
        const vouchRefusal = contractBan ? 'Banned accounts can\'t be vouched for.' : getVouchesGiven(me).length >= maxVouches ? `All ${maxVouches} of your vouches are in use: withdraw one first.` : undefined;
        return (<>
            {targetSummary}
            <div className="mt-3 rounded-2xl border border-line px-4 py-3">
                {banLine ?? (ban?.source === 'ui' ? <p className="text-[15px]/5 font-bold">Hidden by this UI (in code)</p> : <p className="text-[15px]/5 text-ink-muted">Not banned</p>)}
                {staker && <p className="mt-1 text-[13px] text-ink-muted">A staker: stakers can't be banned.</p>}
                {!staker && vouchers.length > 0 && <p className="mt-1 text-[13px] text-ink-muted">{`A moderator, vouched for by ${listAddresses(vouchers)}. Moderators can't be banned.`}</p>}
                {vouchesGiven.length > 0 && <p className="mt-1 text-[13px] text-ink-muted">{`Vouches for ${listAddresses(vouchesGiven)}.`}</p>}
                {reports && <div className="mt-1 text-[13px] text-ink-muted">
                    <p>
                        {`Reported by ${plural(reports.length, 'account')}, newest ${getDisplayTimeAgo(reports[0].timestamp)} · `}
                        <Link to="/moderation" className="text-link hover:underline" onClick={closeModal}>Reports</Link>
                    </p>
                    <p className="line-clamp-3 [word-break:break-word]">{reports.slice(0, 3).map((report, index) => <span key={report.key}>{index > 0 && ' · '}“<bdi>{report.reason}</bdi>”</span>)}</p>
                </div>}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={closeModal}>Close</button>
                {contractBan && <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={() => switchTo({ kind: 'unban', address })}>Unban…</button>}
                {!contractBan && !staker && !vouchers.length && address !== me && <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={() => switchTo({ kind: 'ban', address })}>Ban…</button>}
                {vouching && <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={() => switchTo({ kind: 'withdrawVouch', address })}>Withdraw vouch…</button>}
                {canVouch && <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={!!vouchRefusal} onClick={() => switchTo({ kind: 'vouch', address })}>Vouch as moderator…</button>}
                {moderatorRole === 'staker' && vouchers.length > 0 && !staker && <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={() => switchTo({ kind: 'revokeVouches', address })}>Revoke moderator status…</button>}
            </div>
            {canVouch && vouchRefusal && <p className="mt-2 text-right text-[13px] text-ink-muted">{vouchRefusal}</p>}
        </>);
    };

    const renderVouch = () => {
        const { vouchers, given } = vouchersAtOpen;
        return (<>
            {targetSummary}
            <p className="mt-4">{`${shortAddress} will be able to ban and unban any non-moderator, and hide and restore posts. Your vouch stays even if your stake drops. You can withdraw it at any time.`}</p>
            {vouchers.length > 0 && <p className="mt-2 text-[13px] text-ink-muted">{`Already vouched for by ${listAddresses(vouchers)}.`}</p>}
            <p className="mt-2 text-[13px] text-ink-muted">{`Your vouches in effect: ${given.length} of ${maxVouches}.`}</p>
            {feeLine}
            {actionRow('Vouch')}
        </>);
    };

    const renderWithdrawVouch = () => {
        const others = vouchersAtOpen.vouchers.filter((voucher) => voucher !== me);
        const getOutcome = () => {
            if (isStaker(poster?.stake)) return `${shortAddress} stays a moderator as a staker.`;
            if (others.length) return `${shortAddress} stays a moderator: ${listAddresses(others)} also ${others.length === 1 ? 'vouches' : 'vouch'} for them.`;
            return `${shortAddress} stops being a moderator, and can then be banned.`;
        };
        return (<>
            {targetSummary}
            <p className="mt-4">{getOutcome()}</p>
            <p className="mt-2 text-[13px] text-ink-muted">{`It frees one of your ${maxVouches} vouches.`}</p>
            {feeLine}
            {actionRow('Withdraw')}
        </>);
    };

    const renderRevokeVouches = () => {
        const { vouchers } = vouchersAtOpen;
        return (<>
            {targetSummary}
            <p className="mt-4">{`Removes ${vouchers.length === 1 ? 'the vouch' : `all ${vouchers.length} vouches`} for ${shortAddress}, from ${listAddresses(vouchers)}. ${shortAddress} stops being a moderator immediately and can then be banned.`}</p>
            <p className="mt-2 text-[13px] text-ink-muted">Each voucher gets their vouch back to use again.</p>
            {feeLine}
            {actionRow('Revoke')}
        </>);
    };

    const renderBan = () => (<>
        {targetSummary}
        {contractBan && <div className="mt-3 rounded-2xl border border-line px-4 py-3">
            {banLine}
            <p className="mt-1 text-[13px] text-ink-muted">This ban will replace it.</p>
        </div>}
        <div className="mt-4">
            <span className="block font-bold">Duration</span>
            <div className="mt-2 flex flex-col gap-1">
                {DURATIONS.map((option) => (
                    <div key={option.key} className="flex flex-row items-center gap-3 py-1">
                        <div className="group grid size-5 flex-none grid-cols-1">
                            <input id={`ban-duration-${option.key}`} type="radio" name="banDuration" checked={durationKey === option.key} disabled={busy || done} onChange={() => setDurationKey(option.key)} className={radioClassName} />
                            <RadioCheckMark />
                        </div>
                        <label htmlFor={`ban-duration-${option.key}`} className="cursor-pointer text-[15px]/5">
                            {option.key === 'next' ? `Until the next validation${nextValidation && epoch !== undefined ? ` (${new Date(nextValidation).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})` : ''}` : option.label}
                        </label>
                        {option.key === 'custom' && durationKey === 'custom' && <input className="form-field h-9 w-28 text-[15px]" inputMode="numeric" placeholder="epochs" value={customEpochs} disabled={busy || done} onChange={(e) => setCustomEpochs(e.target.value.replace(/\D/g, ''))} />}
                    </div>
                ))}
            </div>
        </div>
        {reasonField}
        <p className="mt-2 text-[13px] text-ink-muted">{`Hides ${shortAddress}'s posts, replies and comments on idena.social while the ban lasts.`}</p>
        {feeLine}
        {actionRow('Ban')}
    </>);

    const renderUnban = () => {
        const unbanPreview = getUnbanPreview();
        return (<>
            {targetSummary}
            {contractBan && <div className="mt-3 rounded-2xl border border-line px-4 py-3">{banLine}</div>}
            {reasonField}
            {unbanPreview && <p className="mt-2 text-[13px] text-ink-muted">
                {`${plural(unbanPreview.restored, 'post')} restored, ${plural(unbanPreview.firstTime, 'post')} shown for the first time (made during the ban). ${plural(unbanPreview.stayHidden, 'post')} hidden individually stay hidden.`}
            </p>}
            {feeLine}
            {actionRow('Unban')}
        </>);
    };

    const renderHide = () => (<>
        <p className="text-[13px] text-ink-muted">A post by</p>
        {targetSummary}
        {reasonField}
        <p className="mt-2 text-[13px] text-ink-muted">{`Only this post is hidden. ${shortAddress} can keep posting.`}</p>
        {feeLine}
        {actionRow('Hide post')}
    </>);

    const renderRestore = () => (<>
        <p className="text-[13px] text-ink-muted">A post by</p>
        {targetSummary}
        {reasonField}
        <p className="mt-2 text-[13px] text-ink-muted">{contractBan ? `${shortAddress} is banned, so this post stays hidden until the ban ends.` : 'This post becomes visible to everyone.'}</p>
        {feeLine}
        {actionRow('Restore')}
    </>);

    // A report: anyone the contract hasn't banned, once per target. Reports are public, reporter included.
    const renderReport = () => {
        const target = current.kind === 'reportPost' ? current.hash : address;
        const ownReport = !busy && !done ? getOwnReport(postersAddress, target) : undefined;
        const noAddress = !postersAddress || postersAddress.toLowerCase() === zeroAddress;
        return (<>
            {kind === 'reportPost' && <p className="text-[13px] text-ink-muted">A post by</p>}
            {targetSummary}
            {noAddress ? <>
                <p className="mt-4">To report, set your address in Settings first: reports are signed by your account.</p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={closeModal}>Cancel</button>
                    <Link to="/settings" className="btn-primary h-9 px-4 text-[15px]" onClick={closeModal}>Open Settings</Link>
                </div>
            </> : ownReport ? <>
                <p className="mt-4 [word-break:break-word]">{`You reported this on ${new Date(ownReport.timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}: `}<bdi>{ownReport.reason}</bdi></p>
                <div className="mt-4 flex justify-end">
                    <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={closeModal}>Close</button>
                </div>
            </> : <>
                {reasonField}
                <p className="mt-2 text-[13px] text-ink-muted">Reports are public on the blockchain: anyone can see your address and this reason.</p>
                {feeLine}
                {actionRow('Report')}
            </>}
        </>);
    };

    const renderBatchHide = () => {
        const count = current.kind === 'batchHide' ? current.hashes.length : 0;
        return (<>
            <p className="text-[13px] text-ink-muted">Posts by</p>
            {targetSummary}
            <p className="mt-3">{`${plural(count, 'post')} · ${plural(batchChunks.length, 'transaction')}${batchChunks.length > 1 ? ` (${batchChunks.map((chunk) => chunk.length).join(' + ')})` : ''}`}</p>
            {reasonField}
            <p className="mt-2 text-[13px] text-ink-muted">These posts stay hidden after the account is unbanned. The reason is stored with every post, so a shorter one costs less: the account's ban already says why.</p>
            {feeLine}
            {batchChunks.length > 1 && <p className="text-[13px] text-ink-muted">That's for the first transaction: each is checked and signed in turn.</p>}
            {actionRow(`Hide ${plural(count, 'post')}`)}
        </>);
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="truncate text-xl/6 font-extrabold">{titles[kind]}</h2>
            </div>
            <div className="px-4 pb-4 text-[15px]/5">
                {kind === 'moderate' && renderModerate()}
                {kind === 'ban' && renderBan()}
                {kind === 'unban' && renderUnban()}
                {kind === 'hide' && renderHide()}
                {kind === 'restore' && renderRestore()}
                {kind === 'batchHide' && renderBatchHide()}
                {isReport && renderReport()}
                {kind === 'vouch' && renderVouch()}
                {kind === 'withdrawVouch' && renderWithdrawVouch()}
                {kind === 'revokeVouches' && renderRevokeVouches()}
            </div>
        </div>
    </>);
}

export default ModalModerationComponent;
