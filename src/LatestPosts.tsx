import { supportedImageTypes, type Post, type Tip } from './logic/asyncUtils';
import { useOutletContext } from 'react-router';
import PostComponent from './components/PostComponent';
import { type MouseEventLocal, type PostDomSettingsCollection } from './App.exports';
import { useReducer } from 'react';

type LatestPostsProps = {
    currentBlockCaptured: number,
    nodeAvailable: boolean,
    orderedPostIds: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    scanningPastBlocks: boolean,
    setScanningPastBlocks: React.Dispatch<React.SetStateAction<boolean>>,
    noMorePastBlocks: boolean,
    pastBlockCaptured: number,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
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

function LatestPosts() {
    const {
        currentBlockCaptured,
        nodeAvailable,
        orderedPostIds,
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        scanningPastBlocks,
        setScanningPastBlocks,
        noMorePastBlocks,
        pastBlockCaptured,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitPostHandler,
        submitLikeHandler,
        submittingPost,
        submittingLike,
        submittingTip,
        browserStateHistoryRef,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        tipsRef,
        setPostMediaAttachmentHandler,
        postMediaAttachmentsRef,
    } = useOutletContext() as LatestPostsProps;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const mainPostMediaAttachment = postMediaAttachmentsRef.current['main'];


    const addMediaHandler = async (e: React.ChangeEvent<HTMLInputElement>, location: string) => {
        e?.stopPropagation();

        await setPostMediaAttachmentHandler(location, e.currentTarget.files?.[0])
        forceUpdate();
    };

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e?.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [location]: undefined };
        forceUpdate();
    };

    return (<>
        <div>
            <textarea
                id='post-input-main'
                rows={4}
                className="w-full field-sizing-content min-h-[104px] max-h-[520px] py-1 px-2 mt-5 outline-1 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                placeholder="Write your post here..."
                disabled={inputPostDisabled}
            />
            {mainPostMediaAttachment && <div className="mx-4 my-1">
                <img className="max-h-120 max-w-100 size-auto rounded-sm" src={mainPostMediaAttachment.dataUrl} />
            </div>}
            <div className="flex flex-row gap-2">
                <div className="flex-1 -mt-1.5">
                    {mainPostMediaAttachment ? <>
                        <p className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => removeMediaHandler(e, 'main')}>Remove image</p>
                    </> : <>
                        <label htmlFor="post-input-media-main" className="inline-block -mt-1 text-blue-400 text-[12px] hover:cursor-pointer hover:underline" onClick={(e) => e.stopPropagation()}>Add image</label>
                        <input
                            id="post-input-media-main"
                            type="file"
                            accept={supportedImageTypes.join(',')}
                            className="hidden"
                            disabled={inputPostDisabled}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => addMediaHandler(e, 'main')}
                        />
                    </>}
                </div>
                <p className="text-right w-50 mt-0.5 text-gray-400 text-[12px]">Your post will take time to display due to blockchain acceptance.</p>
                <button className="h-9 w-27 my-1 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler('main')}>{submittingPost === 'main' ? 'Posting...' : 'Post!'}</button>
            </div>
        </div>
        <div className="text-center my-3">
            <p>Current Block: #{currentBlockCaptured ? currentBlockCaptured : (nodeAvailable ? 'Loading...' : '')}</p>
            {!nodeAvailable && <p className="text-[11px] text-red-400">Blocks are not being captured. Please update your node.</p>}
        </div>
        <ul>
            {orderedPostIds.map((postId) => (
                <li key={postId}>
                    <PostComponent
                        postId={postId}
                        postsRef={postsRef}
                        replyPostsTreeRef={replyPostsTreeRef}
                        deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
                        discussPrefix={discussPrefix}
                        SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                        inputPostDisabled={inputPostDisabled}
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
                    />
                </li>
            ))}
        </ul>
        <div className="flex flex-col gap-2 mb-15">
            <button className={`h-9 mt-1 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 ${scanningPastBlocks || noMorePastBlocks ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={scanningPastBlocks || noMorePastBlocks || !nodeAvailable} onClick={() => setScanningPastBlocks(true)}>
                {scanningPastBlocks ? "Scanning blockchain...." : (noMorePastBlocks ? "No more past posts" : "Scan for more posts")}
            </button>
            <p className="pr-12 text-gray-400 text-[12px] text-center">
                {!scanningPastBlocks ? <>Posts found down to Block # <span className="absolute">{pastBlockCaptured || 'unavailable'}</span></> : <>&nbsp;</>}
            </p>
        </div>
    </>);
}

export default LatestPosts;
