import { useEffect, useState } from 'react';
import { type Post, type Poster } from './logic/asyncUtils';
import { useLocation, useOutletContext } from 'react-router';
import PostComponent from './components/PostComponent';
import { initDomSettings, type PostDomSettingsCollection } from './components/PostComponent.exports';
import type { NavigateWrapper } from './App.exports';

type LatestPostsProps = {
    currentBlockCaptured: number,
    nodeAvailable: boolean,
    orderedPostIds: string[],
    postsRef: React.RefObject<Record<string, Post>>,
    postersRef: React.RefObject<Record<string, Poster>>,
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
    submittingPost: string,
    navigateWrapper: NavigateWrapper,
    historyStack: React.RefObject<{ key: string; pathname: string; state?: any; }[]>
};

function LatestPosts() {
    const location = useLocation();

    const {
        currentBlockCaptured,
        nodeAvailable,
        orderedPostIds,
        postsRef,
        postersRef,
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
        submittingPost,
        navigateWrapper,
        historyStack,
    } = useOutletContext() as LatestPostsProps;

    const savedState = historyStack.current.find((item) => item.key === location.key)?.state;
    const [postDomSettingsCollection, setPostDomSettingsCollection] = useState(savedState ?? {});

    useEffect(() => {
        const newPostDomSettingsCollection: PostDomSettingsCollection = orderedPostIds.reduce((acc, curr) => ({ ...acc, [curr]: { [curr]: initDomSettings } }), {});
        setPostDomSettingsCollection((current: PostDomSettingsCollection) => ({ ...newPostDomSettingsCollection, ...current }));
    }, [orderedPostIds]);

    return (<>
        <div>
            <textarea
                id='post-input-main'
                rows={4}
                className="w-full min-h-[104px] rounded-md py-1 px-2 mt-5 outline-1 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                placeholder="Write your post here..."
                disabled={inputPostDisabled}
            />
            <div className="flex flex-row gap-2">
                <button className="h-9 w-27 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler('main')}>{submittingPost === 'main' ? 'Posting...' : 'Post!'}</button>
                <p className="mt-1.5 text-gray-400 text-[12px]">Your post will take time to display due to blockchain acceptance.</p>
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
                        postersRef={postersRef}
                        replyPostsTreeRef={replyPostsTreeRef}
                        deOrphanedReplyPostsTreeRef={deOrphanedReplyPostsTreeRef}
                        discussPrefix={discussPrefix}
                        SET_NEW_POSTS_ADDED_DELAY={SET_NEW_POSTS_ADDED_DELAY}
                        inputPostDisabled={inputPostDisabled}
                        submitPostHandler={submitPostHandler}
                        submittingPost={submittingPost}
                        postDomSettingsCollection={postDomSettingsCollection}
                        setPostDomSettingsCollection={setPostDomSettingsCollection}
                        navigateWrapper={navigateWrapper}
                    />
                </li>
            ))}
        </ul>
        <div className="flex flex-col gap-2 mb-15">
            <button className={`h-9 mt-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 ${scanningPastBlocks || noMorePastBlocks ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={scanningPastBlocks || noMorePastBlocks || !nodeAvailable} onClick={() => setScanningPastBlocks(true)}>
                {scanningPastBlocks ? "Scanning blockchain...." : (noMorePastBlocks ? "No more past posts" : "Scan for more posts")}
            </button>
            <p className="pr-12 text-gray-400 text-[12px] text-center">
                {!scanningPastBlocks ? <>Posts found down to Block # <span className="absolute">{pastBlockCaptured || 'unavailable'}</span></> : <>&nbsp;</>}
            </p>
        </div>
    </>);
}

export default LatestPosts;
