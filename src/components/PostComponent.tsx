import { useEffect, useReducer, type FocusEventHandler } from 'react';
import { getChildPostIds, breakingChanges, type Post, type Poster } from '../logic/asyncUtils';
import { getDisplayAddress, getDisplayAddressShort, getDisplayDateTime, getMessageLines } from '../logic/utils';
import { initDomSettings, isPostOutletDomSettings, type PostDomSettings, type PostDomSettingsCollection } from '../App.exports';
import { useLocation, useNavigate } from 'react-router';

const postTextHeight = 'max-h-[288px]';
const replyPostTextHeight = 'max-h-[146px]';

type MouseEventLocal = React.MouseEvent<HTMLElement, MouseEvent>;

type PostComponentProps = {
    postId: string,
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
    isPostOutlet?: boolean,
};

function PostComponent(props: PostComponentProps) {

    const location = useLocation();
    const navigate = useNavigate();

    const {
        postId,
        postsRef,
        postersRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitPostHandler,
        submittingPost,
        browserStateHistoryRef,
        isPostOutlet,
    } = props;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const { key: locationKey } = location;

    useEffect(() => {
        setTimeout(() => {
            setNewPostsAdded([postId]);
        }, SET_NEW_POSTS_ADDED_DELAY);

        if (isPostOutlet) {
            setTimeout(() => {
                setNewPostsAdded(repliesToThisPost);
            }, SET_NEW_POSTS_ADDED_DELAY);
        }
    }, []);

    const setNewPostsAdded = (newPostsAdded: string[]) => {
        for (let index = 0; index < newPostsAdded.length; index++) {
            const key = newPostsAdded[index];
            const post = postsRef.current[key];
            const messageDiv = document.getElementById(`post-text-${post.postId}`);

            if (messageDiv!.scrollHeight > messageDiv!.clientHeight) {
                setPostDomSettings(post.postId, { textOverflows: true }, true);
            }
        }
    };

    const setPostDomSettings = (childPostId: string, postDomSettings: Partial<PostDomSettings>, rerender?: boolean) => {
        browserStateHistoryRef.current = {
            ...browserStateHistoryRef.current,
            [locationKey]: {
                ...browserStateHistoryRef.current[locationKey],
                [postId]: {
                    ...browserStateHistoryRef.current[locationKey]?.[postId],
                    [childPostId]: {
                        ...(browserStateHistoryRef.current[locationKey]?.[postId]?.[childPostId] ?? initDomSettings),
                        ...postDomSettings,
                    }
                }
            }
        };

        rerender && forceUpdate();
    }

    const mainPostDomSettings = isPostOutlet ? isPostOutletDomSettings : initDomSettings;

    if (!browserStateHistoryRef.current[locationKey]?.[postId]?.[postId]) {
        setPostDomSettings(postId, mainPostDomSettings);
    }

    const post = postsRef.current[postId];
    const poster = postersRef.current[post.poster];
    const displayAddress = getDisplayAddress(poster.address);
    const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
    const messageLines = getMessageLines(post.message);
    const postDomSettingsItem = browserStateHistoryRef.current[locationKey][postId][postId];
    const textOverflows = postDomSettingsItem.textOverflows;
    const displayViewMore = postDomSettingsItem.textOverflowHidden;
    const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;
    const repliesToThisPost = [ ...getChildPostIds(post.postId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(post.postId, deOrphanedReplyPostsTreeRef.current) ];
    const showReplies = !postDomSettingsItem.repliesHidden;
    const isBreakingChangeDisabled = post.timestamp <= breakingChanges.v5.timestamp;

    let totalNumberOfReplies = repliesToThisPost.length;
    const discussionPostsAll = repliesToThisPost.reduce((acc, curr) => {
        const discussParentId = discussPrefix + curr;
        const discussionPosts = [ ...getChildPostIds(discussParentId, deOrphanedReplyPostsTreeRef.current).reverse(), ...getChildPostIds(discussParentId, replyPostsTreeRef.current) ].reverse(); // reverse for flex-col-reverse
        totalNumberOfReplies += discussionPosts.length;
        return { ...acc, [discussParentId]: discussionPosts };
    }, {}) as Record<string, string[]>;

    const toggleShowRepliesHandler = (e: MouseEventLocal, post: Post, repliesToThisPost: string[]) => {
        const newRepliesHidden = !browserStateHistoryRef.current[locationKey][postId][post.postId].repliesHidden;

        if (newRepliesHidden || repliesToThisPost.length < 10 || isPostOutlet) {
            e.stopPropagation();
            setPostDomSettings(post.postId, { repliesHidden: newRepliesHidden }, true);

            if (!newRepliesHidden) {
                setTimeout(() => {
                    setNewPostsAdded(repliesToThisPost);
                }, SET_NEW_POSTS_ADDED_DELAY);
            }
        }
    };

    const toggleShowDiscussionHandler = (post: Post, override?: boolean) => {
        const newRepliesHidden = !browserStateHistoryRef.current[locationKey][postId][post.postId].repliesHidden;
        setPostDomSettings(post.postId, { repliesHidden: override ?? newRepliesHidden }, true);
    };

    const toggleReplyDiscussionHandler = (post: Post) => {
        toggleShowDiscussionHandler(post, false);
        setDiscussReplyToPostIdHandler(post, post.postId);
    };

    const replyInputOnFocusHandler: FocusEventHandler<HTMLTextAreaElement> = (e) => {
        e.target.rows = 4;
    };

    const replyInputOnBlurHandler: FocusEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.target.value === '') e.target.rows = 1;
    };

    const setDiscussReplyToPostIdHandler = (post: Post, discussReplyToPostId?: string) => {
        setPostDomSettings(post.postId, { discussReplyToPostId }, true);

        setTimeout(() => {
            const postTextareaElement = document.getElementById(`post-input-${post.postId}`) as HTMLTextAreaElement;
            postTextareaElement.focus();
        }, SET_NEW_POSTS_ADDED_DELAY);
    };

    const toggleViewMoreHandler = (post: Post, e?: MouseEventLocal) => {
        e?.stopPropagation();

        const newTextOverflowHidden = !browserStateHistoryRef.current[locationKey][postId][post.postId].textOverflowHidden;
        setPostDomSettings(post.postId, { textOverflowHidden: newTextOverflowHidden }, true);

        if (newTextOverflowHidden) {
            const messageDiv = document.getElementById(`post-text-${post.postId}`);
            const isReply = !!post.replyToPostId;
            const rawTextHeight = isReply ? replyPostTextHeight : postTextHeight;
            const textHeightNumber = parseInt(rawTextHeight.split('max-h-[')[1].split('px]')[0]);
            const adjustheight = messageDiv!.scrollHeight - textHeightNumber;
            window.scrollBy({ top: -adjustheight });
        }
    };

    const localSubmitPostHandler = async (location: string, replyToPostId?: string, e?: MouseEventLocal, channelId?: string) => {
        e?.stopPropagation();

        await submitPostHandler(location, replyToPostId, channelId);

        const post = postsRef.current[location];
        if (post) {
            setDiscussReplyToPostIdHandler(post);
        }
    }

    let mouseClicked = false;

    const handlePostMouseDown = () => {
        if (!isPostOutlet) {
            mouseClicked = true;
            setTimeout(() => {
                mouseClicked = false;
            }, 500);
        }
    };
    const handlePostClick = () => {
        if (!isPostOutlet) {
            if (mouseClicked) {
                const to = `/post/${postId}`;
                if (to !== location.pathname) {
                    navigate(to);
                }
            }
        }
    };

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    return (<>
        <div className={`flex flex-col pt-3 bg-stone-800 ${!isPostOutlet ? 'hover:cursor-pointer' : ''}`} onMouseDown={handlePostMouseDown} onClick={handlePostClick}>
            <div className="flex flex-row">
                <div className="w-15 flex-none flex flex-col">
                    <div className="h-17 flex-none -mt-3">
                        <img src={`https://robohash.org/${poster.address}?set=set1`} />
                    </div>
                    <div className="flex-1"></div>
                </div>
                <div className="mr-3 flex-1 flex flex-col overflow-hidden">
                    <div className="flex-none flex flex-col gap-x-3 items-start">
                        <p className="text-[18px] font-[600] hover:cursor-pointer" onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>{displayAddress}</p>
                        <div><p className="text-[11px]/4">{`Age: ${poster.age}, State: ${poster.state}, Stake: ${parseInt(poster.stake)}`}</p></div>
                        <div className="flex-1"></div>
                    </div>
                </div>
            </div>
            <div id={`post-text-${post.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : postTextHeight} flex-1 px-4 pt-2 pb-1 text-[17px] text-wrap leading-5 overflow-hidden`}>
                <p className="[word-break:break-word]">{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
            </div>
            <div className="h-6 px-2 flex flex-row justify-between">
                <div className="ml-2 -mt-0.5 text-[12px]/5 text-blue-400">{textOverflows && <a className="hover:underline cursor-pointer" onClick={(e) => toggleViewMoreHandler(post, e)}>{displayViewMore ? 'view more' : 'view less'}</a>}</div>
                <div className="self-end text-[11px]/6 text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${post.txHash}`} target="_blank" onClick={(e) => e.stopPropagation()}>{`${displayDate}, ${displayTime}`}</a></div>
            </div>
            {!isBreakingChangeDisabled && <div className="flex flex-row gap-2 px-2 items-end">
                <div className="flex-1">
                    <textarea
                        id={`post-input-${post.postId}`}
                        rows={1}
                        className="w-full min-h-[32px] rounded-sm py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                        placeholder="Write your reply here..."
                        disabled={inputPostDisabled}
                        onFocus={replyInputOnFocusHandler}
                        onBlur={replyInputOnBlurHandler}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div>
                    <button className="h-9 w-17 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={(e) => localSubmitPostHandler(post.postId, post.postId, e)}>{submittingPost === post.postId ? '...' : 'Post!'}</button>
                </div>
            </div>}
            <div className="px-4 mb-1.5 text-[12px]">
                {repliesToThisPost.length ?
                    <a className="-mt-2 text-blue-400 hover:underline cursor-pointer" onClick={(e) => toggleShowRepliesHandler(e, post, repliesToThisPost)}>{showReplies ? 'hide replies' : `show replies (${totalNumberOfReplies})`}</a>
                :
                    <span className="-mt-2 text-gray-500">no replies</span>
                }
            </div>
        </div>
        {showReplies && <div className="flex flex-col bg-stone-800">
            <ul>
                {repliesToThisPost.map((replyPostId, index) => {

                    if (!browserStateHistoryRef.current[locationKey]?.[postId]?.[replyPostId]) {
                        setPostDomSettings(replyPostId, initDomSettings);
                    }

                    const replyPost = postsRef.current[replyPostId];
                    const poster = postersRef.current[replyPost.poster];
                    const displayAddress = getDisplayAddress(poster.address);
                    const { displayDate, displayTime } = getDisplayDateTime(replyPost.timestamp);
                    const messageLines = getMessageLines(replyPost.message);
                    const postDomSettingsItem = browserStateHistoryRef.current[locationKey][postId][replyPostId];
                    const textOverflows = postDomSettingsItem.textOverflows;
                    const displayViewMore = postDomSettingsItem.textOverflowHidden;
                    const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;
                    const showDiscussion = !postDomSettingsItem.repliesHidden;
                    const discussParentId = discussPrefix + replyPost.postId;
                    const discussionPosts = discussionPostsAll[discussParentId];
                    const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
                    const discussReplyToPost = discussReplyToPostId && postsRef.current[discussReplyToPostId!];

                    return (
                        <li key={replyPost.postId}>
                            {index !== 0 && <hr className="mx-2 text-gray-700" />}
                            <div className="mt-1.5 mb-2.5 flex flex-col">
                                <div className="h-5 flex flex-row">
                                    <div className="w-11 flex-none flex flex-col">
                                        <div className="h-13 flex-none">
                                            <img src={`https://robohash.org/${poster.address}?set=set1`} />
                                        </div>
                                        <div className="flex-1"></div>
                                    </div>
                                    <div className="ml-1 mr-3 flex-1 flex flex-col overflow-hidden">
                                        <div className="flex-none flex flex-col gap-x-3">
                                            <div className="flex flex-row items-center">
                                                <p className="text-[16px] font-[600] hover:cursor-pointer" onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>{displayAddress}</p>
                                                <span className="ml-2 text-[11px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                            </div>
                                            <div className="flex-1"></div>
                                        </div>
                                    </div>
                                </div>
                                <div id={`post-text-${replyPost.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : replyPostTextHeight} flex-1 pl-12 pr-4 pt-2 text-[14px] text-wrap leading-5 overflow-hidden`}>
                                    <p className="[word-break:break-word]">{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                </div>
                                <div className="h-5 px-12 text-[12px]/5 text-blue-400">
                                    {textOverflows && <a className="hover:underline cursor-pointer" onClick={() => toggleViewMoreHandler(replyPost)}>{displayViewMore ? 'view more' : 'view less'}</a>}
                                </div>
                                <div className="w-full px-2 flex flex-row justify-end">
                                    {!isBreakingChangeDisabled && <>
                                        <div className="mt-0.5 w-36 text-[12px]">
                                            {discussionPosts.length || showDiscussion ?
                                                <a className="text-blue-400 hover:underline cursor-pointer" onClick={() => toggleShowDiscussionHandler(replyPost)}>{showDiscussion ? 'hide discussion' : `show discussion (${discussionPosts.length})`}</a>
                                            :
                                                <span className="text-gray-500">no discussion</span>
                                            }
                                        </div>
                                        <div className="-mt-1.5 flex-1"><button className="text-[11px] h-6 w-14 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => toggleReplyDiscussionHandler(replyPost)}>Reply</button></div>
                                    </>}
                                    <div><p className="text-[11px]/6 text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p></div>
                                </div>
                                {showDiscussion && <div className="mt-2.5 mx-2 p-2 bg-stone-900 rounded-md text-[14px]">
                                    <ul className="flex flex-col flex-col-reverse max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                                        {discussionPosts.length === 0 && <li className="mb-1"><p className="italic text-center text-[12px] text-gray-500">no comments yet</p></li>}
                                        {discussionPosts.map((discussionPostId) => {
                                            const discussionPost = postsRef.current[discussionPostId];
                                            const poster = postersRef.current[discussionPost.poster];
                                            const displayAddress = getDisplayAddressShort(poster.address);
                                            const { displayDate, displayTime } = getDisplayDateTime(discussionPost.timestamp);
                                            const messageLines = getMessageLines(discussionPost.message);
                                            const replyToPost = postsRef.current[discussionPost.replyToPostId];

                                            return (
                                                <li key={discussionPost.postId} className="hover:bg-stone-800">
                                                    <div className="my-1.5 flex flex-col">
                                                        {replyToPost && <div className="flex flex-row">
                                                            <div className="w-8 flex justify-end items-end">
                                                                <div className="h-2.5 w-4 border-t-1 border-l-1 border-gray-500"></div>
                                                            </div>
                                                            <div className="flex-1 flex flex-row mr-3">
                                                                <div className="w-5"><img src={`https://robohash.org/${replyToPost.poster}?set=set1`} /></div>
                                                                <div className="flex-1 text-nowrap overflow-hidden">
                                                                    <p className="max-w-[120px] text-[12px] text-gray-500">{getMessageLines(replyToPost.message)[0]}</p>
                                                                </div>
                                                            </div>
                                                        </div>}
                                                        <div className="h-5 flex flex-row">
                                                            <div className="w-9 flex-none flex flex-col">
                                                                <div className="h-11 flex-none">
                                                                    <img src={`https://robohash.org/${poster.address}?set=set1`} />
                                                                </div>
                                                                <div className="flex-1"></div>
                                                            </div>
                                                            <div className="ml-1 mr-3 flex-1 flex flex-row items-center overflow-hidden">
                                                                <div className="flex-1">
                                                                    <span className="text-[14px] font-[600] hover:cursor-pointer" onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>{displayAddress}</span>
                                                                    <span className="ml-2 text-[9px] align-[2px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="ml-2 text-[10px] text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-row">
                                                            <div id={`post-text-${discussionPost.postId}`} className="flex-1 max-h-[9999px] flex-1 pl-10 pr-4 pt-0.5 pb-1 text-[12px] text-wrap leading-5 overflow-hidden">
                                                                <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                                            </div>
                                                            <div className="w-10 pt-0.5"><button className="text-[12px] h-4 w-8 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => setDiscussReplyToPostIdHandler(replyPost, discussionPost.postId)}>↩</button></div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {discussReplyToPost && <div className="w-full mt-1 px-1 flex flex-row bg-stone-800 rounded-sm">
                                        <div className="flex-1 overflow-hidden text-nowrap text-[12px] text-gray-500"><p>Replying to {getDisplayAddressShort(discussReplyToPost!.poster)}: {getMessageLines(discussReplyToPost!.message)[0]}</p></div>
                                        <div className="w-6 text-right">
                                            <button className="text-[10px] align-[2.5px] h-4 w-5 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => setDiscussReplyToPostIdHandler(replyPost)}>✖</button>
                                        </div>
                                    </div>}
                                    <div className="mt-1 flex flex-row gap-2 items-end">
                                        <div className="flex-1">
                                            <textarea
                                                id={`post-input-${replyPost.postId}`}
                                                rows={2}
                                                className="w-full min-h-[26px] rounded-sm py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500 text-[12px] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                                                placeholder="Comment here..."
                                                disabled={inputPostDisabled}
                                            />
                                        </div>
                                        <div>
                                            <button className="h-7.5 w-16 my-1 px-4 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => localSubmitPostHandler(replyPost.postId, discussReplyToPostId, undefined, discussParentId)}>{submittingPost === replyPost.postId ? '...' : 'Post!'}</button>
                                        </div>
                                    </div>
                                </div>}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>}
        <div className="mt-10"></div>
    </>);
}

export default PostComponent;
