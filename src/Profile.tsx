import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import { getPoster, getPosterWithIndexerApi, type Post, type Poster, type PostTips, type Tip } from "./logic/asyncUtils";
import { getDisplayAddress, getIdentityStatus } from "./logic/utils";
import { type BrowserStateHistorySettings, type PostMediaAttachment, type ProfileActivity } from "./App.exports";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";

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
    handleOpenSendTipModal: (e: MouseEventLocal, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, dataUrl: string, cid?: string) => void,
    tipsRef: React.RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
    rpcClientRef: React.RefObject<((method: string, params: any[], skipStateUpdate?: boolean) => Promise<any>)>,
    findPostsWithRef: React.RefObject<string>,
    indexerApiUrlRef: React.RefObject<string>,
    profileActivityRef: React.RefObject<Record<string, ProfileActivity>>,
};

function Profile() {
    const { address } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

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
        tipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
        rpcClientRef,
        findPostsWithRef,
        indexerApiUrlRef,
        profileActivityRef,
    } = useOutletContext() as AddressProps;

    const poster = postersRef.current[address!] ?? {};

    if (!poster.address) {
        (findPostsWithRef.current === 'rpc' ? getPoster(rpcClientRef.current!, address!, true) : getPosterWithIndexerApi(indexerApiUrlRef.current, address!))
            .then((result) => result && (postersRef.current[address!] = result));
    }

    const posterDisplayAddress = poster.address ? getDisplayAddress(poster.address) : '';

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        {!poster.address && <div className="text-center"><LdsSpinnerComponent /></div>}
        {poster.address && <>
            <div className="flex flex-row p-3">
                <div className="w-35 flex justify-end">
                    <div className="-mt-1"><img className="w-27" src={`https://robohash.org/${poster.address}?set=set1`} /></div>
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="flex flex-col">
                        <div><a className="text-[24px] font-[600] hover:underline" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noopener noreferrer">{posterDisplayAddress}</a></div>
                        <div><p className="text-[16px]">{`Age: ${poster.age}`}</p></div>
                        <div><p className="text-[16px]">{`Status: ${getIdentityStatus(poster.state)}`}</p></div>
                        <div><p className="text-[16px]">{`Stake: ${parseInt(poster.stake)}`}</p></div>
                    </div>
                </div>
            </div>
            <div className="h-8 mb-5 flex border-b-1 border-gray-500 gap-3">
                <p className={location.pathname === `/profile/${poster.address}` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}`)}>Posts</p>
                <p className={location.pathname === `/profile/${poster.address}/replies` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}/replies`)}>Replies</p>
                <p className={location.pathname === `/profile/${poster.address}/comments` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}/comments`)}>Comments</p>
                <p className={location.pathname === `/profile/${poster.address}/likes` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}/likes`)}>Likes</p>
                <p className={location.pathname === `/profile/${poster.address}/tips` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}/tips`)}>Tips</p>
                <p className={location.pathname === `/profile/${poster.address}/media` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/profile/${poster.address}/media`)}>Media</p>
            </div>
            <Outlet
                context={{
                    address,
                    latestPosts,
                    latestActivity,
                    postsRef,
                    replyPostsTreeRef,
                    deOrphanedReplyPostsTreeRef,
                    discussPrefix,
                    SET_NEW_POSTS_ADDED_DELAY,
                    inputPostDisabled,
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
                    tipsRef,
                    postMediaAttachmentsRef,
                    makePostsWith,
                    profileActivityRef,
                }}
            />
        </>}
    </>);
}

export default Profile;
