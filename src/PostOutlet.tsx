import { useNavigate, useOutletContext, useParams } from "react-router";
import type { Post, Tip } from "./logic/asyncUtils";
import PostComponent from "./components/PostComponent";
import { type MouseEventLocal, type PostDomSettingsCollection } from "./App.exports";

type PostOutletProps = {
    orderedPostIds: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    copyPostTxHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, PostDomSettingsCollection>>,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: Tip[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, tipToPost: Post) => void,
    tipsRef: React.RefObject<Record<string, { totalAmount: number, tips: Tip[] }>>,
    setPostMediaAttachmentHandler: (location: string, file?: File | undefined) => Promise<void>,
    postMediaAttachmentsRef: React.RefObject<any>,
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
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        tipsRef,
        setPostMediaAttachmentHandler,
        postMediaAttachmentsRef,
    } = useOutletContext() as PostOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-3 text-[13px] hover:cursor-pointer" onClick={handleGoBack}>&lt; Back</button>
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
            handleOpenLikesModal={handleOpenLikesModal}
            handleOpenTipsModal={handleOpenTipsModal}
            handleOpenSendTipModal={handleOpenSendTipModal}
            tipsRef={tipsRef}
            setPostMediaAttachmentHandler={setPostMediaAttachmentHandler}
            postMediaAttachmentsRef={postMediaAttachmentsRef}
            isPostOutlet={true}
        />
    </>);
}

export default PostOutlet;
