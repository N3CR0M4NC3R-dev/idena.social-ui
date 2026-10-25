import { Navigate, Outlet, useLocation, useMatch, useNavigate, useOutletContext, useParams } from "react-router";
import { type Post, type Poster, type PostTips, type Tip, getPosterPromise } from "./logic/asyncUtils";
import { getDisplayAddress, getIdentityStatus, getProfilePic } from "./logic/utils";
import { type BrowserStateHistorySettings, type Conversation, type PostMediaAttachment, type ProfileActivity } from "./App.exports";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";
import ObjectUrlImageComponent from "./components/ObjectUrlImageComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import { ExternalLinkIcon, MessagesIcon } from "./components/icons";
import { keccak256 } from "js-sha3";

type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;

type AddressProps = {
    latestPosts: string[],
    latestActivity: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    submitting: boolean,
    copyPostTxHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: Tip[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, location: string, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, image: File, cid?: string) => void,
    postTipsRef: React.RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
    rpcClientRef: React.RefObject<((method: string, params: any[], skipStateUpdate?: boolean) => Promise<any>)>,
    findPostsWithRef: React.RefObject<string>,
    indexerApiUrlRef: React.RefObject<string>,
    profileActivityRef: React.RefObject<Record<string, ProfileActivity>>,
    postersAddress: string,
    conversationsRef: React.RefObject<Record<string, Conversation>>,
};

type ProfileIdentityComponentProps = {
    poster: Poster,
    posterDisplayAddress: string,
    handleConversationClick: () => void,
};

function ProfileIdentityComponent(props: ProfileIdentityComponentProps) {
    const {
        poster,
        posterDisplayAddress,
        handleConversationClick,
    } = props;

    return (<>
        <div className="h-[60px] sm:h-[100px] bg-line" />
        <div className="flex flex-row items-start justify-between gap-3 px-4">
            <ObjectUrlImageComponent className="-mt-[45px] sm:-mt-[67px] size-[90px] sm:size-[134px] flex-none rounded-full border-4 border-canvas bg-surface object-cover" file={getProfilePic(poster)} />
            <div className="flex flex-row gap-2 pt-3">
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
            <div className="text-xl/6 font-extrabold">{posterDisplayAddress}</div>
            <div className="text-[14px] sm:text-[15px] text-ink-muted break-all">{poster.address}</div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
                <span><span className="font-bold text-ink">{poster.age}</span> <span className="text-ink-muted">Age</span></span>
                <span><span className="font-bold text-ink">{getIdentityStatus(poster.state)}</span> <span className="text-ink-muted">Status</span></span>
                <span><span className="font-bold text-ink">{parseInt(poster.stake)}</span> <span className="text-ink-muted">Stake</span></span>
            </div>
        </div>
    </>);
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

    const {
        latestPosts,
        latestActivity,
        postsRef,
        postersRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        submittingPost,
        submittingLike,
        submittingTip,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitting,
        copyPostTxHandler,
        submitPostHandler,
        submitLikeHandler,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        handleOpenAddMediaModal,
        handleOpenRpcMakePostModal,
        handleExpandImageModal,
        postTipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
        rpcClientRef,
        findPostsWithRef,
        indexerApiUrlRef,
        profileActivityRef,
        postersAddress,
        conversationsRef,
    } = useOutletContext() as AddressProps;

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

    const posterDisplayAddress = poster.address ? getDisplayAddress(poster.address) : '';

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleConversationClick = () => {
        const participants = [postersAddress, poster.address].map((item: string) => item.toLowerCase()).sort();
        const conversationKey = keccak256(participants.join('-'));
        const conversation = conversationsRef.current[conversationKey];

        if (!conversation) {
            conversationsRef.current = { ...conversationsRef.current, [conversationKey]: { participants: [postersAddress.toLowerCase(), poster.address], messages: [] } };
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
            <ProfileIdentityComponent poster={poster} posterDisplayAddress={posterDisplayAddress} handleConversationClick={handleConversationClick} />
            <div className="flex flex-row px-2 sm:px-0 border-b border-line overflow-x-auto no-scrollbar" role="tablist">
                <ProfileTabComponent label="Posts" isActive={location.pathname === profilePath} onClick={(e) => handleClickAddress(e, profilePath)} />
                <ProfileTabComponent label="Replies" isActive={location.pathname === `${profilePath}/replies`} onClick={(e) => handleClickAddress(e, `${profilePath}/replies`)} />
                <ProfileTabComponent label="Comments" isActive={location.pathname === `${profilePath}/comments`} onClick={(e) => handleClickAddress(e, `${profilePath}/comments`)} />
                <ProfileTabComponent label="Likes" isActive={location.pathname === `${profilePath}/likes`} onClick={(e) => handleClickAddress(e, `${profilePath}/likes`)} />
                <ProfileTabComponent label="Tips" isActive={location.pathname === `${profilePath}/tips`} onClick={(e) => handleClickAddress(e, `${profilePath}/tips`)} />
                <ProfileTabComponent label="Media" isActive={location.pathname === `${profilePath}/media`} onClick={(e) => handleClickAddress(e, `${profilePath}/media`)} />
            </div>
            <Outlet
                context={{
                    address,
                    latestPosts,
                    latestActivity,
                    postsRef,
                    postersRef,
                    replyPostsTreeRef,
                    deOrphanedReplyPostsTreeRef,
                    discussPrefix,
                    SET_NEW_POSTS_ADDED_DELAY,
                    inputPostDisabled,
                    submitting,
                    copyPostTxHandler,
                    submitPostHandler,
                    submitLikeHandler,
                    submittingPost,
                    submittingLike,
                    submittingTip,
                    browserStateHistoryRef,
                    setBrowserStateHistorySettings,
                    handleOpenLikesModal,
                    handleOpenTipsModal,
                    handleOpenSendTipModal,
                    handleOpenAddMediaModal,
                    handleOpenRpcMakePostModal,
                    handleExpandImageModal,
                    postTipsRef,
                    postMediaAttachmentsRef,
                    makePostsWith,
                    profileActivityRef,
                }}
            />
        </>}
    </>);
}

export default Profile;
