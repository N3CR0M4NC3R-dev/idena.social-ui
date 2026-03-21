import { useReducer, type FocusEventHandler } from 'react';
import { getChildPostIds, breakingChanges, type Post, type Poster, type Tip } from '../logic/asyncUtils';
import { getDisplayAddress, getDisplayAddressShort, getDisplayDateTime, getDisplayTipAmount, getMessageLines, getShortDisplayTipAmount, isLikePostMessage, MAX_POST_IMAGE_BYTES, parsePostMessage, POST_IMAGE_FILE_ACCEPT } from '../logic/utils';
import { initDomSettings, isPostOutletDomSettings, type MouseEventLocal, type PostDomSettings, type PostDomSettingsCollection, type PostImageAttachment } from '../App.exports';
import { useLocation, useNavigate } from 'react-router';
import PostImage from './PostImage';
import commentGraySvg from '../assets/comment-alt-lines-gray.svg';
import commentBlueSvg from '../assets/comment-alt-lines-blue.svg';
import heartGraySvg from '../assets/heart-gray.svg';
import heartRedSvg from '../assets/heart-red.svg';
import cashGraySvg from '../assets/cash-gray.svg';
import cashGreenSvg from '../assets/cash-green.svg';

const likeEmoji = '❤️';

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
        submitLikeHandler,
        postImageAttachments,
        setPostImageAttachmentHandler,
        clearPostImageAttachmentHandler,
        handleAddImageClick,
        submittingPost,
        submittingLike,
        submittingTip,
        browserStateHistoryRef,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        tipsRef,
        isPostOutlet,
    } = props;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const { key: locationKey } = location;

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
    const postTips = tipsRef.current[postId] ?? { totalAmount: 0, tips: [] };
    const displayAddress = getDisplayAddress(poster.address);
    const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
    const postContent = parsePostMessage(post.message);
    const { messageLines, textOverflows, truncatedMessageLines } = getMessageLines(postContent.text, true);

    const postDomSettingsItem = browserStateHistoryRef.current[locationKey][postId][postId];

    const showTruncatedMessageLines = textOverflows === true && postDomSettingsItem.textOverflowHidden === true;

    const messageLinesDisplay = showTruncatedMessageLines ? truncatedMessageLines : messageLines;
    const hasPostText = postContent.text !== '';
    const postComposerImageAttachment = postImageAttachments[post.postId];

    const repliesToThisPost = [ ...getChildPostIds(post.postId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(post.postId, deOrphanedReplyPostsTreeRef.current) ];
    const showReplies = !postDomSettingsItem.repliesHidden;
    const isBreakingChangeDisabled = post.timestamp <= breakingChanges.v5.timestamp;
    const isLikeMessage = (message: string) => isLikePostMessage(message, likeEmoji);

    const replyPosts = repliesToThisPost.map(replyPostId => postsRef.current[replyPostId]);
    const replyLikes = replyPosts.filter(replyPost => isLikeMessage(replyPost.message));
    const replyComments = replyPosts.filter(replyPost => !isLikeMessage(replyPost.message));

    let totalNumberOfReplies = replyComments.length;
    const discussionPostsAll = replyComments.reduce((acc, curr) => {
        const discussParentId = discussPrefix + curr.postId;
        const discussionPostIds = [ ...getChildPostIds(discussParentId, deOrphanedReplyPostsTreeRef.current).reverse(), ...getChildPostIds(discussParentId, replyPostsTreeRef.current) ].reverse(); // reverse for flex-col-reverse
        const discussionPosts = discussionPostIds.map(discussionPostId => postsRef.current[discussionPostId]);
        const discussionPostLikes = discussionPosts.filter(discussionPost => isLikeMessage(discussionPost.message) && !!discussionPost.replyToPostId);
        const discussionPostComments = discussionPosts.filter(discussionPost => !isLikeMessage(discussionPost.message) || (isLikeMessage(discussionPost.message) && !discussionPost.replyToPostId));
        totalNumberOfReplies += discussionPostComments.length;
        return { ...acc, [discussParentId]: { discussionPostLikes, discussionPostComments } };
    }, {}) as Record<string, { discussionPostLikes: Post[], discussionPostComments: Post[] }>;

    const toggleShowRepliesHandler = (e: MouseEventLocal, post: Post, replyPostIds: string[]) => {
        const newRepliesHidden = !browserStateHistoryRef.current[locationKey][postId][post.postId].repliesHidden;

        if (newRepliesHidden || replyPostIds.length < 10 || isPostOutlet) {
            e.stopPropagation();
            setPostDomSettings(post.postId, { repliesHidden: newRepliesHidden }, true);
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

    const setReplyToPostInputFocusHandler = (postId: string, e?: MouseEventLocal) => {
        e?.stopPropagation();

        const replyToPostTextareaElement = document.getElementById(`post-input-${postId}`) as HTMLTextAreaElement;
        replyToPostTextareaElement.focus();
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
    };

    const localSubmitPostHandler = async (location: string, replyToPostId?: string, e?: MouseEventLocal, channelId?: string) => {
        e?.stopPropagation();

        await submitPostHandler(location, replyToPostId, channelId);

        const post = postsRef.current[location];
        if (post) {
            setDiscussReplyToPostIdHandler(post);
        }
    }

    const localSubmitLikeHandler = async (location: string, replyToPostId?: string, e?: MouseEventLocal, channelId?: string) => {
        e?.stopPropagation();

        if (inputPostDisabled || isBreakingChangeDisabled) {
            return;
        }

        await submitLikeHandler(likeEmoji, location, replyToPostId, channelId);
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
            <div id={`post-text-${post.postId}`} className="flex-1 px-4 pt-2 pb-1 text-[17px] text-wrap leading-5">
                {hasPostText && <p className="[word-break:break-word]">{messageLinesDisplay.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}{showTruncatedMessageLines && <span> <a className="hover:underline cursor-pointer text-blue-400 whitespace-nowrap" onClick={(e) => toggleViewMoreHandler(post, e)}>view more</a></span>}</p>}
                {postContent.image && <PostImage image={postContent.image} className={`rounded-md ${hasPostText ? 'max-h-72' : 'max-h-90'}`} alt="Post attachment" />}
            </div>
            <div className="h-6 px-2 flex flex-row justify-between">
                <div className=""></div>
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
                    <div className="mt-1 flex flex-row flex-wrap items-center gap-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
                        <input
                            id={`post-image-input-${post.postId}`}
                            type="file"
                            className="hidden"
                            accept={POST_IMAGE_FILE_ACCEPT}
                            disabled={inputPostDisabled}
                            onChange={(e) => {
                                void setPostImageAttachmentHandler(post.postId, e.currentTarget.files?.[0]);
                                e.currentTarget.value = '';
                            }}
                        />
                        <label htmlFor={`post-image-input-${post.postId}`} className={`px-1.5 py-0.5 rounded-sm bg-white/10 inset-ring inset-ring-white/5 ${inputPostDisabled ? '' : 'hover:bg-white/20 cursor-pointer'}`} onClick={(e) => !inputPostDisabled && handleAddImageClick(e)}>Add image</label>
                        {postComposerImageAttachment && <button className="px-1.5 py-0.5 rounded-sm bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => clearPostImageAttachmentHandler(post.postId)}>Remove image</button>}
                        <span className="text-gray-400">Max {Math.round(MAX_POST_IMAGE_BYTES / 1024)}KB</span>
                    </div>
                    {postComposerImageAttachment && <img className="mt-1 max-h-36 rounded-md" src={postComposerImageAttachment.dataUrl} alt="Selected reply image preview" onClick={(e) => e.stopPropagation()} />}
                </div>
                <div>
                    <button className="h-9 w-17 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={(e) => localSubmitPostHandler(post.postId, post.postId, e)}>{submittingPost === post.postId ? '...' : 'Post!'}</button>
                </div>
            </div>}
            <div className="flex flex-row px-2 mb-1.5 text-[12px]">
                <div className="w-23">
                    {replyComments.length ?
                        <div className="text-blue-400"><img src={commentBlueSvg} className={'h-6 p-[0px] mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={(e) => setReplyToPostInputFocusHandler(post.postId, e)} /><a className="text-blue-400 align-[-0.5px] hover:underline cursor-pointer" onClick={(e) => toggleShowRepliesHandler(e, post, replyComments.map(replyPost => replyPost.postId))}>{ totalNumberOfReplies} replies</a></div>
                    :
                        <div className="text-gray-500"><img src={commentGraySvg} onMouseOver={(e) => { e.currentTarget.src = commentBlueSvg; }} onMouseOut={(e) => { e.currentTarget.src = commentGraySvg; }} className={'h-6 p-[0px] mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={(e) => setReplyToPostInputFocusHandler(post.postId, e)} /><span className="align-[-0.5px]">0 replies</span></div>
                    }
                </div>
                <div className="w-20">
                    {replyLikes.length ?
                        <div className="text-red-400"><img src={heartRedSvg} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === post.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(post.postId, post.postId, e)} /><a className="text-red-400 align-[-0.5px] hover:underline cursor-pointer" onClick={(e) => handleOpenLikesModal(e, replyLikes)}>{ replyLikes.length} likes</a></div>
                    :
                        <div className="text-gray-500"><img src={heartGraySvg} onMouseOver={(e) => { e.currentTarget.src = heartRedSvg; }} onMouseOut={(e) => { e.currentTarget.src = heartGraySvg; }} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === post.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(post.postId, post.postId, e)} /><span className="align-[-0.5px]">0 likes</span></div>
                    }
                </div>
                <div className="flex-1">
                    {postTips.totalAmount ?
                        <div className="text-green-400"><img src={cashGreenSvg} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === post.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, post)} /><a className="text-green-400 align-[-0.5px] hover:underline cursor-pointer" onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getDisplayTipAmount(postTips.totalAmount)} idna</a></div>
                    :
                        <div className="text-gray-500"><img src={cashGraySvg} onMouseOver={(e) => { e.currentTarget.src = cashGreenSvg; }} onMouseOut={(e) => { e.currentTarget.src = cashGraySvg; }} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === post.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, post)} /><span className="align-[-0.5px]">0 idna</span></div>
                    }
                </div>
            </div>
        </div>
        {showReplies && <div className="flex flex-col bg-stone-800">
            <ul>
                {replyComments.map((replyPost, index) => {

                    if (!browserStateHistoryRef.current[locationKey]?.[postId]?.[replyPost.postId]) {
                        setPostDomSettings(replyPost.postId, initDomSettings);
                    }

                    const postTips = tipsRef.current[replyPost.postId] ?? { totalAmount: 0, tips: [] };
                    const poster = postersRef.current[replyPost.poster];
                    const displayAddress = getDisplayAddress(poster.address);
                    const { displayDate, displayTime } = getDisplayDateTime(replyPost.timestamp);
                    const replyPostContent = parsePostMessage(replyPost.message);
                    const { messageLines, textOverflows, truncatedMessageLines } = getMessageLines(replyPostContent.text, true, 3);
                    const postDomSettingsItem = browserStateHistoryRef.current[locationKey][postId][replyPost.postId];

                    const showTruncatedMessageLines = textOverflows === true && postDomSettingsItem.textOverflowHidden === true;

                    const messageLinesDisplay = showTruncatedMessageLines ? truncatedMessageLines : messageLines;
                    const hasReplyPostText = replyPostContent.text !== '';

                    const showDiscussion = !postDomSettingsItem.repliesHidden;
                    const discussParentId = discussPrefix + replyPost.postId;

                    const discussionPostComments = discussionPostsAll[discussParentId].discussionPostComments;
                    const discussionPostLikes = discussionPostsAll[discussParentId].discussionPostLikes;

                    const likesForReplyPost = discussionPostLikes.filter(like => like.replyToPostId === replyPost.postId);

                    const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
                    const discussReplyToPost = discussReplyToPostId && postsRef.current[discussReplyToPostId!];
                    const discussReplyToPostText = discussReplyToPost ? parsePostMessage(discussReplyToPost.message).text : '';
                    const discussionComposerImageAttachment = postImageAttachments[replyPost.postId];

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
                                <div id={`post-text-${replyPost.postId}`} className="flex-1 pl-12 pr-4 pt-2 text-[14px] text-wrap leading-5">
                                    {hasReplyPostText && <p className="[word-break:break-word]">{messageLinesDisplay.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}{showTruncatedMessageLines && <span> <a className="hover:underline cursor-pointer text-[12px] text-blue-400 whitespace-nowrap" onClick={(e) => toggleViewMoreHandler(replyPost, e)}>view more</a></span>}</p>}
                                    {replyPostContent.image && <PostImage image={replyPostContent.image} className={`rounded-md ${hasReplyPostText ? 'max-h-60' : 'max-h-80'}`} alt="Reply attachment" />}
                                </div>
                                <div className="w-full pt-2 px-4 flex flex-row text-[12px]">
                                    {!isBreakingChangeDisabled && <>
                                        <div className="w-26">
                                            {discussionPostComments.length || showDiscussion ?
                                                <div className="text-blue-400"><img src={commentBlueSvg} className={'h-6 p-[0px] mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={() => toggleReplyDiscussionHandler(replyPost)} /><a className="text-blue-400 align-[-0.5px] hover:underline cursor-pointer" onClick={() => toggleShowDiscussionHandler(replyPost)}>{ discussionPostComments.length} comments</a></div>
                                            :
                                                <div className="text-gray-500"><img src={commentGraySvg} onMouseOver={(e) => { e.currentTarget.src = commentBlueSvg; }} onMouseOut={(e) => { e.currentTarget.src = commentGraySvg; }} className={'h-6 p-[0px] mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={() => toggleReplyDiscussionHandler(replyPost)} /><span className="align-[-0.5px]">0 comments</span></div>
                                            }
                                        </div>
                                        <div className="w-19">
                                            {likesForReplyPost.length ?
                                                <div className="text-red-400"><img src={heartRedSvg} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === replyPost.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(replyPost.postId, replyPost.postId, e, discussParentId)} /><a className="text-red-400 align-[-0.5px] hover:underline cursor-pointer" onClick={(e) => handleOpenLikesModal(e, likesForReplyPost)}>{likesForReplyPost.length} likes</a></div>
                                            :
                                                <div className="text-gray-500"><img src={heartGraySvg} onMouseOver={(e) => { e.currentTarget.src = heartRedSvg; }} onMouseOut={(e) => { e.currentTarget.src = heartGraySvg; }} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === replyPost.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(replyPost.postId, replyPost.postId, e, discussParentId)} /><span className="align-[-0.5px]">0 likes</span></div>
                                            }
                                        </div>
                                    </>}
                                    <div className="flex-1">
                                        {postTips.totalAmount ?
                                            <div className="text-green-400"><img src={cashGreenSvg} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === replyPost.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, replyPost)} /><a className="text-green-400 align-[-0.5px] hover:underline cursor-pointer" onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getDisplayTipAmount(postTips.totalAmount)} idna</a></div>
                                        :
                                            <div className="text-gray-500"><img src={cashGraySvg} onMouseOver={(e) => { e.currentTarget.src = cashGreenSvg; }} onMouseOut={(e) => { e.currentTarget.src = cashGraySvg; }} className={'h-6 p-[3px] mr-0.5 inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === replyPost.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, replyPost)} /><span className="align-[-0.5px]">0 idna</span></div>
                                        }
                                    </div>
                                    <div>
                                        <p className="text-[10px]/5 text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                    </div>
                                </div>
                                {showDiscussion && <div className="mt-2.5 ml-4 mr-2 p-2 bg-stone-900 rounded-md text-[14px]">
                                    <ul className="flex flex-col flex-col-reverse max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                                        {discussionPostComments.length === 0 && <li className="mb-1"><p className="italic text-center text-[12px] text-gray-500">no comments yet</p></li>}
                                        {discussionPostComments.map((discussionPost) => {
                                            const postTips = tipsRef.current[discussionPost.postId] ?? { totalAmount: 0, tips: [] };
                                            const poster = postersRef.current[discussionPost.poster];
                                            const displayAddress = getDisplayAddressShort(poster.address);
                                            const { displayDate, displayTime } = getDisplayDateTime(discussionPost.timestamp);
                                            const discussionPostContent = parsePostMessage(discussionPost.message);
                                            const { messageLines } = getMessageLines(discussionPostContent.text);
                                            const hasDiscussionPostText = discussionPostContent.text !== '';
                                            const replyToPost = postsRef.current[discussionPost.replyToPostId];
                                            const replyToPostText = replyToPost ? parsePostMessage(replyToPost.message).text : '';
                                            const likesForDiscussionPost = discussionPostLikes.filter(like => like.replyToPostId === discussionPost.postId);

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
                                                                    <p className="max-w-[120px] text-[12px] text-gray-500">{getMessageLines(replyToPostText).messageLines[0]}</p>
                                                                </div>
                                                            </div>
                                                        </div>}
                                                        <div className="flex flex-row">
                                                            <div className="w-9 flex-none flex flex-col">
                                                                <div className="h-11 flex-none">
                                                                    <img src={`https://robohash.org/${poster.address}?set=set1`} />
                                                                </div>
                                                                <div className="flex-1"></div>
                                                            </div>
                                                            <div className="flex-1 flex flex-col">
                                                                <div className="mx-1 flex flex-row items-center overflow-hidden">
                                                                    <div className="flex-1">
                                                                        <span className="text-[14px] font-[600] hover:cursor-pointer" onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>{displayAddress}</span>
                                                                        <span className="ml-1 text-[9px] align-[2px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                                                    </div>
                                                                    <div>
                                                                        <p className="mx-1 text-[10px] text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                                                    </div>
                                                                </div>
                                                                <div id={`post-text-${discussionPost.postId}`} className="max-h-[9999px] pl-1 pr-2 pt-0.5 pb-1 text-[12px] text-wrap leading-5 overflow-hidden">
                                                                    {hasDiscussionPostText && <p className="[word-break:break-word]">{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>}
                                                                    {discussionPostContent.image && <PostImage image={discussionPostContent.image} className={`rounded-md ${hasDiscussionPostText ? 'max-h-40' : 'max-h-56'}`} alt="Comment attachment" />}
                                                                </div>
                                                            </div>
                                                            <div className="w-11 pt-0.5 text-[10px] flex flex-col gap-0.5">
                                                                <div className=""><img src={commentGraySvg} onMouseOver={(e) => { e.currentTarget.src = commentBlueSvg; }} onMouseOut={(e) => { e.currentTarget.src = commentGraySvg; }} className={'h-6 p-[0px] mr-0.5 inline-block rounded-md hover:bg-blue-400/30 hover:cursor-pointer'} onClick={() => setDiscussReplyToPostIdHandler(replyPost, discussionPost.postId)} /></div>
                                                                {likesForDiscussionPost.length ?
                                                                    <div className="text-red-400 text-left whitespace-nowrap"><img src={heartRedSvg} className={'h-5 p-0.5 inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === discussionPost.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(discussionPost.postId, discussionPost.postId, e, discussParentId)} /><a className="text-red-400 align-[-1px] hover:underline cursor-pointer" onClick={(e) => handleOpenLikesModal(e, likesForDiscussionPost)}>{likesForDiscussionPost.length}</a></div>
                                                                :
                                                                    <div className="text-gray-500 text-left"><img src={heartGraySvg} onMouseOver={(e) => { e.currentTarget.src = heartRedSvg; }} onMouseOut={(e) => { e.currentTarget.src = heartGraySvg; }} className={'h-5 p-[2px] inline-block rounded-md hover:bg-red-400/30 hover:cursor-pointer' + (submittingLike === discussionPost.postId ? ' bg-red-400/30' : '')} onClick={(e) => localSubmitLikeHandler(discussionPost.postId, discussionPost.postId, e, discussParentId)} /></div>
                                                                }
                                                                {postTips.totalAmount ?
                                                                    <div className="text-green-400 text-left whitespace-nowrap"><img src={cashGreenSvg} className={'h-5 p-0.5 -ml-0.5 inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === discussionPost.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, discussionPost)} /><a className="text-green-400 ml-0.5 align-[-1px] hover:underline cursor-pointer" onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getShortDisplayTipAmount(postTips.totalAmount)}</a></div>
                                                                :
                                                                    <div className="text-gray-500 text-left"><img src={cashGraySvg} onMouseOver={(e) => { e.currentTarget.src = cashGreenSvg; }} onMouseOut={(e) => { e.currentTarget.src = cashGraySvg; }} className={'h-5 p-[2px] inline-block rounded-md hover:bg-green-400/30 hover:cursor-pointer' + (submittingTip === discussionPost.postId ? ' bg-green-400/30' : '')} onClick={(e) => handleOpenSendTipModal(e, discussionPost)} /></div>
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {discussReplyToPost && <div className="w-full mt-1 px-1 flex flex-row bg-stone-800 rounded-sm">
                                        <div className="flex-1 overflow-hidden text-nowrap text-[12px] text-gray-500"><p>Replying to {getDisplayAddressShort(discussReplyToPost!.poster)}: {getMessageLines(discussReplyToPostText).messageLines[0]}</p></div>
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
                                            <div className="mt-1 flex flex-row flex-wrap items-center gap-2 text-[11px]">
                                                <input
                                                    id={`post-image-input-${replyPost.postId}`}
                                                    type="file"
                                                    className="hidden"
                                                    accept={POST_IMAGE_FILE_ACCEPT}
                                                    disabled={inputPostDisabled}
                                                    onChange={(e) => {
                                                        void setPostImageAttachmentHandler(replyPost.postId, e.currentTarget.files?.[0]);
                                                        e.currentTarget.value = '';
                                                    }}
                                                />
                                                <label htmlFor={`post-image-input-${replyPost.postId}`} className={`px-1.5 py-0.5 rounded-sm bg-white/10 inset-ring inset-ring-white/5 ${inputPostDisabled ? '' : 'hover:bg-white/20 cursor-pointer'}`} onClick={(e) => !inputPostDisabled && handleAddImageClick(e)}>Add image</label>
                                                {discussionComposerImageAttachment && <button className="px-1.5 py-0.5 rounded-sm bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => clearPostImageAttachmentHandler(replyPost.postId)}>Remove image</button>}
                                                <span className="text-gray-400">Max {Math.round(MAX_POST_IMAGE_BYTES / 1024)}KB</span>
                                            </div>
                                            {discussionComposerImageAttachment && <img className="mt-1 max-h-32 rounded-md" src={discussionComposerImageAttachment.dataUrl} alt="Selected comment image preview" />}
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
