import { useNavigate, useOutletContext, useParams } from "react-router";
import type { Post, Poster } from "./logic/asyncUtils";
import PostComponent from "./components/PostComponent";
import { type PostDomSettingsCollection } from "./App.exports";

type PostOutletProps = {
    orderedPostIds: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    browserStateHistoryRef: React.RefObject<Record<string, PostDomSettingsCollection>>,
};

function PostOutlet() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const {
        postsRef,
        postersRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        submittingPost,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitPostHandler,
        browserStateHistoryRef,
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
            submittingPost={submittingPost}
            browserStateHistoryRef={browserStateHistoryRef}
            isPostOutlet={true}
        />
    </>);
}

export default PostOutlet;
