import { useLocation, useNavigate, useParams } from "react-router";
import { useAppContext } from "./AppContext";
import PostComponent from "./components/PostComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";

function PostOutlet() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        postsRef,
        noMorePastBlocks,
    } = useAppContext();

    const handleGoBack = () => {
        navigate(-1);
    };

    const spotlightReplyPostId = location.state?.spotlightReplyPostId;
    const spotlightDiscussionPostId = location.state?.spotlightDiscussionPostId;

    const post = postsRef.current[postId!];

    const postUnavailable = noMorePastBlocks ? <p className="px-8 py-6 text-center text-[15px] text-ink-muted">This post couldn't be found.</p> : <>
            <LdsSpinnerComponent />
            <p className="px-8 pb-6 text-center text-[15px] text-ink-muted">This post hasn't loaded yet. It will appear here once its block has been scanned. Use “Scan more past blocks” below to search further back.</p>
        </>;

    return (<>
        <PageHeaderComponent title="Post" onBack={handleGoBack} />
        {post ? <PostComponent
            uniqueKey={postId!}
            postId={postId!}
            isPostOutlet={true}
            spotlightReplyPostId={spotlightReplyPostId}
            spotlightDiscussionPostId={spotlightDiscussionPostId}
        /> : postUnavailable}
    </>);
}

export default PostOutlet;
