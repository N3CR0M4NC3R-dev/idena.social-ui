import { useNavigate, useOutletContext, useParams } from "react-router";
import type { Post, Tip } from "./logic/asyncUtils";
import PostComponent from "./components/PostComponent";
import { type BrowserStateHistorySettings, type MouseEventLocal, type PostMediaAttachment } from "./App.exports";

type PostOutletProps = {
    latestPosts: string[],
    latestActivity: string[],
    postsRef: React.RefObject<Record<string, Post>>,
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
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    tipsRef: React.RefObject<Record<string, { totalAmount: number, tips: Tip[] }>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
};

function PostOutlet() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const {
        postsRef,
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
        tipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
    } = useOutletContext() as PostOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-3 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <PostComponent
            postId={postId!}
            postsRef={postsRef}
            replyPostsTreeRef={replyPostsTreeRef}
            deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
            discussPrefix={discussPrefix}
            SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
            inputPostDisabled={inputPostDisabled}
            copyPostTxHandler={copyPostTxHandler}
            submitPostHandler={submitPostHandler}
            submitLikeHandler={submitLikeHandler}
            submittingPost={submittingPost}
            submittingLike={submittingLike}
            submittingTip={submittingTip}
            browserStateHistoryRef={browserStateHistoryRef}
            setBrowserStateHistorySettings={setBrowserStateHistorySettings}
            handleOpenLikesModal={handleOpenLikesModal}
            handleOpenTipsModal={handleOpenTipsModal}
            handleOpenSendTipModal={handleOpenSendTipModal}
            handleOpenAddMediaModal={handleOpenAddMediaModal}
            handleOpenRpcMakePostModal={handleOpenRpcMakePostModal}
            tipsRef={tipsRef}
            postMediaAttachmentsRef={postMediaAttachmentsRef}
            makePostsWith={makePostsWith}
            isPostOutlet={true}
        />
    </>);
}

export default PostOutlet;
