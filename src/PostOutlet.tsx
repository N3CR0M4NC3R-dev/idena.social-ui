import { useNavigate, useOutletContext, useParams } from "react-router";
import type { Post, Poster, Tip } from "./logic/asyncUtils";
import type { NodeDetails } from "./logic/api";
import PostComponent from "./components/PostComponent";
import { type MouseEventLocal, type PostDomSettingsCollection, type PostImageAttachment } from "./App.exports";

type PostOutletProps = {
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

function PostOutlet() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const {
        activeNodeDetails,
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
    } = useOutletContext() as PostOutletProps;

    const handleGoBack = () => {
        navigate(-1);
    };

    return (<>
        <button className="mb-3 text-[13px] hover:cursor-pointer" onClick={handleGoBack}>&lt; Back</button>
        <PostComponent
            postId={postId!}
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
            isPostOutlet={true}
        />
    </>);
}

export default PostOutlet;
