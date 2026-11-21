import { Link, Navigate, Outlet, useLocation, useMatch, useNavigate, useParams } from "react-router";
import { useAppContext } from "./AppContext";
import { type Poster, getPosterPromise } from "./logic/asyncUtils";
import { getDisplayAddress, getIdentityStatus, getProfilePic } from "./logic/utils";
import { CANNOT_EDIT_PROFILE, getEditStanding } from "./logic/profileEdit";
import { zeroAddress, type MouseEventLocal } from "./App.exports";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";
import ObjectUrlImageComponent from "./components/ObjectUrlImageComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import { ExternalLinkIcon, FlagIcon, MessagesIcon, SpinnerIcon } from "./components/icons";
import { keccak256 } from "js-sha3";
import { useState } from "react";
import { describeAddressBanEnd, getAddressBan, isAddressBanned, moderationConfig, type ModeratorRole } from "./logic/moderation";

type ProfileIdentityComponentProps = {
    poster: Poster,
    posterDisplayAddress: string,
    handleConversationClick: () => void,
    handleOpenEditProfileModal?: (e: MouseEventLocal) => void,
    editProfileLoading: boolean,
    handleModerateClick?: (e: MouseEventLocal) => void,
    handleReportClick?: (e: MouseEventLocal) => void,
    ownModeratorRole?: ModeratorRole,
};

function ProfileIdentityComponent(props: ProfileIdentityComponentProps) {
    const {
        poster,
        posterDisplayAddress,
        handleConversationClick,
        handleOpenEditProfileModal,
        editProfileLoading,
        handleModerateClick,
        handleReportClick,
        ownModeratorRole,
    } = props;

    return (<>
        <div className="h-[60px] sm:h-[100px] bg-line" />
        <div className="flex flex-row items-start justify-between gap-3 px-4">
            <ObjectUrlImageComponent className="-mt-[45px] sm:-mt-[67px] size-[90px] sm:size-[134px] flex-none rounded-full border-4 border-canvas bg-surface object-cover" file={getProfilePic(poster)} />
            <div className="flex min-w-0 flex-row flex-wrap justify-end gap-2 pt-3">
                {handleOpenEditProfileModal && <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={editProfileLoading} aria-busy={editProfileLoading} onClick={handleOpenEditProfileModal}>
                    {editProfileLoading && <SpinnerIcon className="size-4" />}
                    Edit profile
                </button>}
                {handleModerateClick && <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={handleModerateClick}>Moderate</button>}
                {handleReportClick && <button type="button" aria-label="Report account" title="Report account" className="size-9 flex flex-none items-center justify-center rounded-full border border-line-strong cursor-pointer hover:bg-ink/10" onClick={handleReportClick}>
                    <FlagIcon className="size-5" />
                </button>}
                <button type="button" aria-label="Message" title="Message" className="size-9 flex flex-none items-center justify-center rounded-full border border-line-strong cursor-pointer hover:bg-ink/10" onClick={handleConversationClick}>
                    <MessagesIcon className="size-5" />
                </button>
                <a className="btn-outline h-9 px-4 text-[15px]" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noopener noreferrer">
                    Explorer
                    <ExternalLinkIcon className="size-4" />
                </a>
            </div>
        </div>
        <div className="px-4 pt-2 pb-3">
            <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 truncate text-xl/6 font-extrabold">{posterDisplayAddress}</div>
                {ownModeratorRole && <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-btn-hover px-1.5 text-[11px]/none font-bold text-btn-ink">
                    <span className="[text-box:trim-both_cap_alphabetic]">{ownModeratorRole === 'staker' ? 'Moderator · staker' : 'Moderator · vouched'}</span>
                </span>}
            </div>
            <div className="text-[14px] sm:text-[15px] text-ink-muted break-all">{poster.address}</div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
                <span><span className="font-bold text-ink">{poster.age}</span> <span className="text-ink-muted">Age</span></span>
                <span><span className="font-bold text-ink">{getIdentityStatus(poster.state)}</span> <span className="text-ink-muted">Status</span></span>
                <span><span className="font-bold text-ink">{parseInt(poster.stake)}</span> <span className="text-ink-muted">Stake</span></span>
            </div>
            {poster.bio && !isAddressBanned(poster.address) && <p className="mt-3 whitespace-pre-line text-[15px]/5 text-ink [word-break:break-word]">{poster.bio}</p>}
        </div>
    </>);
}

type ProfileBanBannerComponentProps = {
    address: string,
    postersAddress: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    handleMessageModerator: (moderator: string) => void,
};

function ProfileBanBannerComponent(props: ProfileBanBannerComponentProps) {
    const {
        address,
        postersAddress,
        postersRef,
        handleMessageModerator,
    } = props;

    const ban = getAddressBan(address);

    if (!ban) {
        return null;
    }

    if (ban.source === 'ui') {
        return (
            <div className="mx-4 mb-3 rounded-2xl border border-line px-4 py-3">
                <p className="text-[15px]/5 font-bold text-ink">This account is hidden on idena.social</p>
            </div>
        );
    }

    const canMessageModerator = ban.moderator !== postersAddress.toLowerCase();

    return (
        <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line px-4 py-3">
            <div className="min-w-0 flex-1">
                <p className="text-[15px]/5 font-bold text-ink [word-break:break-word]">{`Banned ${describeAddressBanEnd(ban)}${ban.reason ? ` · ${ban.reason}` : ''}`}</p>
                <p className="text-[13px] text-ink-muted">by <Link to={`/profile/${ban.moderator}`} className="hover:underline">{getDisplayAddress(ban.moderator, postersRef.current[ban.moderator])}</Link></p>
            </div>
            {canMessageModerator && <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" onClick={() => handleMessageModerator(ban.moderator)}>Message moderator</button>}
        </div>
    );
}

type ProfileTabComponentProps = {
    label: string,
    isActive: boolean,
    onClick: (e: MouseEventLocal) => void,
};

function ProfileTabComponent(props: ProfileTabComponentProps) {
    const {
        label,
        isActive,
        onClick,
    } = props;

    return (
        <button type="button" role="tab" aria-selected={isActive} className="flex-1 min-w-fit px-2 sm:px-4 h-[53px] flex justify-center cursor-pointer hover:bg-ink/10" onClick={onClick}>
            <span className={`relative flex items-center text-[15px] ${isActive ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                {label}
                {isActive && <span className="absolute bottom-0 left-1/2 h-1 w-full min-w-14 -translate-x-1/2 rounded-full bg-accent" />}
            </span>
        </button>
    );
}

function Profile() {
    const { address } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const subTab = useMatch('/profile/:address/:subTab')?.params.subTab;
    const [editProfileLoading, setEditProfileLoading] = useState(false);

    const {
        postersRef,
        inputPostDisabled,
        rpcClientRef,
        findPostsWithRef,
        indexerApiUrlRef,
        postersAddress,
        conversationsRef,
        handleOpenEditProfileModal,
        moderatorRole,
        handleOpenModerationSheet,
    } = useAppContext();

    const profilePath = `/profile/${encodeURIComponent(address!.toLowerCase())}`;
    const canonicalPath = subTab ? `${profilePath}/${subTab.toLowerCase()}` : profilePath;
    if (location.pathname !== canonicalPath) {
        return <Navigate to={canonicalPath} replace />;
    }

    const poster = postersRef.current[address!] ?? {};

    getPosterPromise(
        address!,
        postersRef,
        findPostsWithRef.current === 'indexer-api',
        rpcClientRef.current!,
        indexerApiUrlRef,
    );

    const posterDisplayAddress = poster.address ? getDisplayAddress(poster.address, poster) : '';
    const isOwnProfile = !!poster.address && poster.address === postersAddress.toLowerCase() && postersAddress !== zeroAddress;
    const canEditProfile = isOwnProfile && !inputPostDisabled;
    const canReport = !!moderationConfig && !isOwnProfile && !!poster.address && !isAddressBanned(poster.address) && getAddressBan(postersAddress)?.source !== 'contract';

    const handleEditProfileClick = async (e: MouseEventLocal) => {
        e.stopPropagation();

        if (editProfileLoading) {
            return;
        }

        setEditProfileLoading(true);

        try {
            const validated = ['Newbie', 'Verified', 'Human'].includes(poster.state);

            if (!validated && (await getEditStanding(rpcClientRef.current!, poster.address)).standing === 'none') {
                alert(CANNOT_EDIT_PROFILE);
                return;
            }

            handleOpenEditProfileModal(e);
        } finally {
            setEditProfileLoading(false);
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    const openConversationWith = (otherAddress: string) => {
        const participants = [postersAddress, otherAddress].map((item: string) => item.toLowerCase()).sort();
        const conversationKey = keccak256(participants.join('-'));
        const conversation = conversationsRef.current[conversationKey];

        if (!conversation) {
            conversationsRef.current = { ...conversationsRef.current, [conversationKey]: { participants: [postersAddress.toLowerCase(), otherAddress], messages: [] } };
        }

        const to = `/conversation/${conversationKey}`;
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    return (<>
        <PageHeaderComponent title={posterDisplayAddress || 'Profile'} subtitle={poster.address ? getIdentityStatus(poster.state) : undefined} onBack={handleGoBack} />
        {!poster.address && <LdsSpinnerComponent />}
        {poster.address && <>
            <ProfileIdentityComponent poster={poster} posterDisplayAddress={posterDisplayAddress} handleConversationClick={() => openConversationWith(poster.address)} handleOpenEditProfileModal={canEditProfile ? handleEditProfileClick : undefined} editProfileLoading={editProfileLoading} handleModerateClick={moderatorRole && !isOwnProfile ? (e) => handleOpenModerationSheet(e, { kind: 'moderate', address: poster.address }) : undefined} handleReportClick={canReport ? (e) => handleOpenModerationSheet(e, { kind: 'reportAccount', address: poster.address }) : undefined} ownModeratorRole={isOwnProfile ? moderatorRole : undefined} />
            <ProfileBanBannerComponent address={poster.address} postersAddress={postersAddress} postersRef={postersRef} handleMessageModerator={openConversationWith} />
            <div className="flex flex-row px-2 sm:px-0 border-b border-line overflow-x-auto no-scrollbar" role="tablist">
                <ProfileTabComponent label="Posts" isActive={location.pathname === profilePath} onClick={(e) => handleClickAddress(e, profilePath)} />
                <ProfileTabComponent label="Replies" isActive={location.pathname === `${profilePath}/replies`} onClick={(e) => handleClickAddress(e, `${profilePath}/replies`)} />
                <ProfileTabComponent label="Comments" isActive={location.pathname === `${profilePath}/comments`} onClick={(e) => handleClickAddress(e, `${profilePath}/comments`)} />
                <ProfileTabComponent label="Likes" isActive={location.pathname === `${profilePath}/likes`} onClick={(e) => handleClickAddress(e, `${profilePath}/likes`)} />
                <ProfileTabComponent label="Tips" isActive={location.pathname === `${profilePath}/tips`} onClick={(e) => handleClickAddress(e, `${profilePath}/tips`)} />
                <ProfileTabComponent label="Media" isActive={location.pathname === `${profilePath}/media`} onClick={(e) => handleClickAddress(e, `${profilePath}/media`)} />
            </div>
            <Outlet />
        </>}
    </>);
}

export default Profile;
