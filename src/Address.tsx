import { useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import type { Post, Poster, Tip } from "./logic/asyncUtils";
import type { NodeDetails } from "./logic/api";
import { getDisplayAddress } from "./logic/utils";
import PostComponent from "./components/PostComponent";
import { type PostDomSettingsCollection, type PostImageAttachment } from "./App.exports";

type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;

type AddressProps = {
    activeNodeDetails: NodeDetails,
    orderedPostIds: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    postImageAttachments: Record<string, PostImageAttachment>,
    setPostImageAttachmentHandler: (location: string, file?: File) => Promise<void>,
    clearPostImageAttachmentHandler: (location: string) => void,
    handleAddImageClick: (e: MouseEventLocal) => void,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, PostDomSettingsCollection>>,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: Tip[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, tipToPost: Post) => void,
    tipsRef: React.RefObject<Record<string, { totalAmount: number, tips: Tip[] }>>,
};

function Address() {
    const { address } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        activeNodeDetails,
        orderedPostIds,
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
        submitPostHandler,
        submitLikeHandler,
        postImageAttachments,
        setPostImageAttachmentHandler,
        clearPostImageAttachmentHandler,
        handleAddImageClick,
        browserStateHistoryRef,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        tipsRef,
    } = useOutletContext() as AddressProps;

    const poster = postersRef.current[address!];
    const displayAddress = getDisplayAddress(poster.address);

    const filteredOrderedPosts = orderedPostIds.filter(postId => {
        const post = postsRef.current[postId];
        return post.poster === address;
    });

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
        <button className="text-[13px] hover:cursor-pointer" onClick={handleGoBack}>&lt; Back</button>
        <div className="flex flex-row p-3">
            <div className="w-35 flex justify-end">
                <div className="-mt-1"><img className="w-27" src={`https://robohash.org/${poster.address}?set=set1`} /></div>
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col">
                    <div><a className="text-[24px] font-[600]" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noreferrer">{displayAddress}</a></div>
                    <div><p className="text-[16px]">{`Age: ${poster.age}`}</p></div>
                    <div><p className="text-[16px]">{`State: ${poster.state}`}</p></div>
                    <div><p className="text-[16px]">{`Stake: ${parseInt(poster.stake)}`}</p></div>
                </div>
            </div>
        </div>
        <div className="h-8 mb-5 flex border-b-1 border-gray-500 gap-3">
            <p className={location.pathname === `/address/${poster.address}` ? "px-3 border-b-3" : "px-3 hover:border-b-3 hover:cursor-pointer"} onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>Posts</p>
        </div>
        <ul>
            {filteredOrderedPosts.map((postId) => (
                <li key={postId}>
                    <PostComponent
                        postId={postId}
                        postsRef={postsRef}
                        postersRef={postersRef}
                        replyPostsTreeRef={replyPostsTreeRef}
                        deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
                        discussPrefix={discussPrefix}
                        SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                        inputPostDisabled={inputPostDisabled}
                        submitPostHandler={submitPostHandler}
                        submitLikeHandler={submitLikeHandler}
                        postImageAttachments={postImageAttachments}
                        setPostImageAttachmentHandler={setPostImageAttachmentHandler}
                        clearPostImageAttachmentHandler={clearPostImageAttachmentHandler}
                        handleAddImageClick={handleAddImageClick}
                        submittingPost={submittingPost}
                        submittingLike={submittingLike}
                        submittingTip={submittingTip}
                        browserStateHistoryRef={browserStateHistoryRef}
                        handleOpenLikesModal={handleOpenLikesModal}
                        handleOpenTipsModal={handleOpenTipsModal}
                        handleOpenSendTipModal={handleOpenSendTipModal}
                        tipsRef={tipsRef}
                        activeNodeDetails={activeNodeDetails}
                    />
                </li>
            ))}
        </ul>
    </>);
}

export default Address;
