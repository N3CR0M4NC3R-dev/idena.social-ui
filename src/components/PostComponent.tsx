import { useEffect, useReducer, type FocusEventHandler } from 'react';
import { getChildPostIds, breakingChanges, type Post, type PostTips, type Poster } from '../logic/asyncUtils';
import { getDisplayAddress, getDisplayAddressShort, getDisplayDateTime, getDisplayFullDate, getDisplayTimeAgo, getDisplayTipAmount, getIdentityStatus, getMessageLines, getProfilePic, getShortDisplayTipAmount, likeEmoji } from '../logic/utils';
import { initDomSettings, initPostOutletDomSettings, initProfileRepliesDomSettings, type BrowserStateHistorySettings, type MouseEventLocal, type PostDomSettings, type PostMediaAttachment } from '../App.exports';
import { useLocation, useNavigate } from 'react-router';
import ObjectUrlImageComponent from './ObjectUrlImageComponent';
import ComposerToolbarComponent from './ComposerToolbarComponent';
import { CloseIcon, HeartIcon, ReplyIcon, TipIcon } from './icons';

const avatarClassName = 'flex-none cursor-pointer rounded-full bg-surface object-cover hover:opacity-85';
const actionButtonClassName = 'inline-flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-full';
const actionCountClassName = '-ml-0.5 cursor-pointer pr-3 hover:underline';
const commentActionButtonClassName = 'inline-flex size-7 flex-none cursor-pointer items-center justify-center rounded-full';

type PostComponentProps = {
    uniqueKey: string,
    postId: string,
    postsRef: React.RefObject<Record<string, Post>>,
    replyPostsTreeRef: React.RefObject<Record<string, string>>,
    deOrphanedReplyPostsTreeRef: React.RefObject<Record<string, string>>,
    discussPrefix: string,
    SET_NEW_POSTS_ADDED_DELAY: number,
    inputPostDisabled: boolean,
    submitting: boolean,
    copyPostTxHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    submitLikeHandler: (emoji: string, location: string, replyToPostId?: string | undefined, channelId?: string | undefined) => Promise<void>,
    submittingPost: string,
    submittingLike: string,
    submittingTip: string,
    browserStateHistoryRef: React.RefObject<Record<string, BrowserStateHistorySettings>>,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    handleOpenLikesModal: (e: MouseEventLocal, likePosts: Post[]) => void,
    handleOpenTipsModal: (e: MouseEventLocal, likePosts: string[]) => void,
    handleOpenSendTipModal: (e: MouseEventLocal, location: string, tipToPost: Post) => void,
    handleOpenAddMediaModal: (e: MouseEventLocal, location: string, source: string) => void,
    handleOpenRpcMakePostModal: (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => void,
    handleExpandImageModal: (e: MouseEventLocal, image: File, cid?: string) => void,
    postTipsRef: React.RefObject<Record<string, PostTips>>,
    postMediaAttachmentsRef: React.RefObject<Record<string, PostMediaAttachment | undefined>>,
    makePostsWith: string,
    postersRef: React.RefObject<Record<string, Poster>>,
    isPostOutlet?: boolean,
    spotlightReplyPostId?: string,
    spotlightDiscussionPostId?: string,
};

function PostComponent(props: PostComponentProps) {

    const location = useLocation();
    const navigate = useNavigate();

    const {
        uniqueKey,
        postId,
        postsRef,
        replyPostsTreeRef,
        deOrphanedReplyPostsTreeRef,
        discussPrefix,
        SET_NEW_POSTS_ADDED_DELAY,
        inputPostDisabled,
        submitting,
        copyPostTxHandler,
        submitPostHandler,
        submitLikeHandler,
        submittingPost,
        submittingLike,
        submittingTip,
        browserStateHistoryRef,
        setBrowserStateHistorySettings,
        handleOpenLikesModal,
        handleOpenTipsModal,
        handleOpenSendTipModal,
        handleOpenAddMediaModal,
        handleOpenRpcMakePostModal,
        handleExpandImageModal,
        postTipsRef,
        postMediaAttachmentsRef,
        makePostsWith,
        postersRef,
        isPostOutlet,
        spotlightReplyPostId,
        spotlightDiscussionPostId,
    } = props;

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const { key: locationKey } = location;

    useEffect(() => {
        setTimeout(() => {
            if (spotlightReplyPostId && spotlightDiscussionPostId) {
                const container = document.getElementById(`spotlight-discussion-${uniqueKey}-${spotlightReplyPostId}-${spotlightDiscussionPostId}`) as HTMLElement;
                const target = document.getElementById(`spotlight-comment-${uniqueKey}-${spotlightReplyPostId}-${spotlightDiscussionPostId}`) as HTMLElement;

                const desiredTargetOffsetTop = 80;

                if (target.offsetTop < desiredTargetOffsetTop) {
                    const desiredScrollableAmount = desiredTargetOffsetTop - target.offsetTop;
                    const possibleScrollableAmount = container.scrollHeight - container.clientHeight;

                    const scrollAmount = possibleScrollableAmount > desiredScrollableAmount ? desiredScrollableAmount : possibleScrollableAmount;
                    container.scrollTop = -scrollAmount;
                }
            }
        }, 0);
    }, []);

    const defaultPostDomSettings = (childPostId: string): PostDomSettings => {
        if (childPostId === postId) {
            return isPostOutlet ? initPostOutletDomSettings : spotlightReplyPostId ? initProfileRepliesDomSettings : initDomSettings;
        }
        if (childPostId === spotlightReplyPostId && spotlightDiscussionPostId) {
            return initProfileRepliesDomSettings;
        }
        return initDomSettings;
    };

    const getPostDomSettings = (childPostId: string): PostDomSettings => {
        return browserStateHistoryRef.current[locationKey]?.postDomSettings?.[uniqueKey]?.[childPostId] ?? defaultPostDomSettings(childPostId);
    };

    const setPostDomSettings = (childPostId: string, postDomSettings: Partial<PostDomSettings>, rerender?: boolean) => {
        const postDomSettingsUpdated = {
            ...browserStateHistoryRef.current[locationKey]?.postDomSettings ?? {},
            [uniqueKey]: {
                ...browserStateHistoryRef.current[locationKey]?.postDomSettings?.[uniqueKey] ?? {},
                [childPostId]: {
                    ...getPostDomSettings(childPostId),
                    ...postDomSettings,
                }
            }
        };

        setBrowserStateHistorySettings({ postDomSettings: postDomSettingsUpdated }, rerender);
    };

    const post = postsRef.current[postId];
    const postTips = postTipsRef.current[postId] ?? { totalAmount: 0, tips: [] };
    const posterStake = post.posterDetails_atTimeOfPost.stake;
    const posterState = post.posterDetails_atTimeOfPost.state;
    const posterAge = post.posterDetails_atTimeOfPost.age;
    const posterPic = getProfilePic(postersRef.current[post.poster], posterState);

    const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
    
    const { messageLines, textOverflows, truncatedMessageLines } = getMessageLines(post.message, true);

    const postDomSettingsItem = getPostDomSettings(postId);

    const showTruncatedMessageLines = textOverflows === true && postDomSettingsItem.textOverflowHidden === true;

    const messageLinesDisplay = showTruncatedMessageLines ? truncatedMessageLines : messageLines;

    const postMediaAttachment = postMediaAttachmentsRef.current[`post-${uniqueKey}-${post.postId}`];

    const repliesToThisPost = [ ...getChildPostIds(post.postId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(post.postId, deOrphanedReplyPostsTreeRef.current) ];
    const showReplies = !postDomSettingsItem.repliesHidden;
    const showReplyInput = !postDomSettingsItem.replyInputHidden;
    const showMaxReplies = postDomSettingsItem.showMaxReplies;

    const isBreakingChangeDisabled = post.timestamp <= breakingChanges.v12.timestamp;

    const replyPosts = repliesToThisPost.map(replyPostId => postsRef.current[replyPostId]);
    const replyLikes = replyPosts.filter(replyPost => replyPost.isLike);
    const replyComments = replyPosts.filter(replyPost => !replyPost.isLike);

    if (spotlightReplyPostId) {
        const fromIndex = replyComments.findIndex(value => value.postId === spotlightReplyPostId);
        const element = replyComments.splice(fromIndex, 1)[0];
        replyComments.unshift(element);
    }

    let totalNumberOfReplies = replyComments.length;
    const discussionPostsAll = replyComments.reduce((acc, curr) => {
        const discussParentId = discussPrefix + curr.postId;
        const discussionPostIds = [ ...getChildPostIds(discussParentId, deOrphanedReplyPostsTreeRef.current).reverse(), ...getChildPostIds(discussParentId, replyPostsTreeRef.current) ].reverse(); // reverse for flex-col-reverse
        const discussionPosts = discussionPostIds.map(discussionPostId => postsRef.current[discussionPostId]);
        const discussionPostLikes = discussionPosts.filter(discussionPost => discussionPost.isLike);
        const discussionPostComments = discussionPosts.filter(discussionPost => !discussionPost.isLike);
        totalNumberOfReplies += discussionPostComments.length;
        return { ...acc, [discussParentId]: { discussionPostLikes, discussionPostComments } };
    }, {}) as Record<string, { discussionPostLikes: Post[], discussionPostComments: Post[] }>;

    const toggleShowReplyInputHandler = (e: MouseEventLocal, post: Post) => {
        e?.stopPropagation();

        const newReplyInputHidden = !getPostDomSettings(post.postId).replyInputHidden;
        setPostDomSettings(post.postId, { replyInputHidden: newReplyInputHidden }, true);

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        if (!newReplyInputHidden) {
            setTimeout(() => {
                const replyToPostTextareaElement = document.getElementById(`post-input-${uniqueKey}-${post.postId}`) as HTMLTextAreaElement;
                replyToPostTextareaElement.focus();
            }, SET_NEW_POSTS_ADDED_DELAY);
        }
    };

    const toggleShowRepliesHandler = (e: MouseEventLocal, post: Post, replyPostIds: string[]) => {
        const newRepliesHidden = !getPostDomSettings(post.postId).repliesHidden;

        if (newRepliesHidden || replyPostIds.length < 10 || isPostOutlet) {
            e.stopPropagation();
            setPostDomSettings(post.postId, { repliesHidden: newRepliesHidden }, true);
        }
    };

    const toggleShowDiscussionHandler = (post: Post) => {
        const newRepliesHidden = !getPostDomSettings(post.postId).repliesHidden;
        setPostDomSettings(post.postId, { repliesHidden: newRepliesHidden }, true);
    };

    const increaseShowMaxReplies = (increaseAmount: number) => {
        const showMaxReplies = getPostDomSettings(post.postId).showMaxReplies;
        setPostDomSettings(post.postId, { showMaxReplies: showMaxReplies + increaseAmount }, true);
    };

    const toggleReplyDiscussionHandler = (post: Post) => {
        if (isBreakingChangeDisabled) {
            return;
        }

        const postDomSettings = getPostDomSettings(post.postId);

        const newRepliesHidden = !postDomSettings.repliesHidden;

        if (postDomSettings.repliesHidden || postDomSettings.discussReplyToPostId === post.postId) {
            setPostDomSettings(post.postId, { repliesHidden: newRepliesHidden }, true);
        }

        if (!newRepliesHidden || (!postDomSettings.repliesHidden && postDomSettings.discussReplyToPostId !== post.postId)) {
            setDiscussReplyToPostIdHandler(post, post.postId);
        }
    };

    const replyInputOnFocusHandler: FocusEventHandler<HTMLTextAreaElement> = (e) => {
        e.target.rows = 4;
    };

    const replyInputOnBlurHandler: FocusEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.target.value === '') e.target.rows = 1;
    };

    const setDiscussReplyToPostIdHandler = (post: Post, discussReplyToPostId?: string) => {
        setPostDomSettings(post.postId, { discussReplyToPostId }, true);

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        setTimeout(() => {
            const postTextareaElement = document.getElementById(`post-input-${uniqueKey}-${post.postId}`) as HTMLTextAreaElement;
            postTextareaElement.focus();
        }, SET_NEW_POSTS_ADDED_DELAY);
    };

    const toggleViewMoreHandler = (post: Post, e?: MouseEventLocal) => {
        e?.stopPropagation();

        const topLevelPostId = post.replyToPostId || post.postId;

        if ((post.message?.length ?? 0) > 10000 && !isPostOutlet) {
            const to = `/post/${topLevelPostId}`;
            if (to !== location.pathname) {
                navigate(to);
            }
        } else {
            const newTextOverflowHidden = !getPostDomSettings(post.postId).textOverflowHidden;
            setPostDomSettings(post.postId, { textOverflowHidden: newTextOverflowHidden }, true);
        }
    };

    const removeMediaHandler = (e: MouseEventLocal, location: string) => {
        e.stopPropagation();

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`post-${location}`]: undefined };
        forceUpdate();
    };

    const localCopyPostTxHandler = async (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => {
        e.stopPropagation();

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        copyPostTxHandler(location, replyToPostId, channelId);
    };


    const localSubmitPostHandler = async (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => {
        e.stopPropagation();

        makePostsWith === 'rpc' ? handleOpenRpcMakePostModal(e, location, replyToPostId, channelId) : submitPostHandler(location, replyToPostId, channelId);

        const post = postsRef.current[location];
        if (post) {
            setDiscussReplyToPostIdHandler(post);
        }
    };

    const localSubmitLikeHandler = async (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => {
        e.stopPropagation();

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        await submitLikeHandler(likeEmoji, location, replyToPostId, channelId);
    };

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
                    navigate(to, { state: { spotlightReplyPostId, spotlightDiscussionPostId } });
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
        <div className="border-b border-line">
            <div className={`flex px-4 pt-3 ${isPostOutlet ? 'flex-wrap items-center gap-x-3' : 'gap-3 hover:bg-ink/[0.03]'} ${!isPostOutlet ? 'hover:cursor-pointer' : ''}`} onMouseDown={handlePostMouseDown} onClick={handlePostClick}>
                <div className={isPostOutlet ? 'contents' : 'flex flex-none flex-col items-center'}>
                    <ObjectUrlImageComponent className={`size-10 ${avatarClassName}`} file={posterPic} onClick={(e) => handleClickAddress(e, `/profile/${post.poster}`)} />
                    {!isPostOutlet && showReplies && replyComments.length > 0 && <div className="mt-1 w-0.5 flex-1 bg-line"></div>}
                </div>
                <div className={isPostOutlet ? 'contents' : 'min-w-0 flex-1 pb-1'}>
                    <div className={`mb-1 min-w-0 text-[15px]/5 ${isPostOutlet ? 'flex-1' : 'flex flex-wrap items-center gap-x-1 sm:flex-nowrap'}`}>
                        <span className={`cursor-pointer font-bold text-ink hover:underline ${isPostOutlet ? 'block w-fit max-w-full truncate' : 'whitespace-nowrap'}`} onClick={(e) => handleClickAddress(e, `/profile/${post.poster}`)}>{getDisplayAddress(post.poster)}</span>
                        <span className={`truncate text-ink-muted ${isPostOutlet ? 'block' : 'min-w-0 max-sm:order-last max-sm:basis-full max-sm:text-[13px]/4'}`}>{`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`}</span>
                        {!isPostOutlet && <>
                            <span className="text-ink-muted" aria-hidden="true">·</span>
                            <a className="whitespace-nowrap text-ink-muted hover:underline" href={`https://scan.idena.io/transaction/${post.txHash}`} target="_blank" rel="noopener noreferrer" title={`${displayDate}, ${displayTime}`} onClick={(e) => e.stopPropagation()}>{getDisplayTimeAgo(post.timestamp)}</a>
                        </>}
                    </div>
                    <p className={`min-w-0 basis-full text-ink [word-break:break-word] ${isPostOutlet ? 'mt-3 text-[17px]/6' : 'text-[15px]/5'}`}>{messageLinesDisplay.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}{showTruncatedMessageLines && <span> <a className="cursor-pointer whitespace-nowrap text-accent hover:underline" onClick={(e) => toggleViewMoreHandler(post, e)}>Show more</a></span>}</p>
                    {post.image ? <div className="mt-3 min-w-0 basis-full">
                        <ObjectUrlImageComponent className="max-h-120 max-w-full sm:max-w-100 size-auto rounded-2xl border border-line hover:cursor-pointer" file={post.image} onClick={(e) => handleExpandImageModal(e, post.image!, post.cid)} />
                    </div> : null}
                    {isPostOutlet && <div className="basis-full py-4 text-[15px] text-ink-muted">
                        <a className="hover:underline" href={`https://scan.idena.io/transaction/${post.txHash}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{`${displayTime} · ${getDisplayFullDate(post.timestamp)}`}</a>
                    </div>}
                    <div className={`flex basis-full text-[13px] text-ink-muted ${isPostOutlet ? 'justify-between border-t border-line px-1 py-1' : 'mt-1 -ml-2 max-w-[425px]'}`}>
                        <div className={`flex items-center ${isPostOutlet ? '' : 'flex-1'} ${replyComments.length ? 'text-accent' : ''}`}>
                            <button type="button" aria-label="Reply" title="Reply" className={`${actionButtonClassName} hover:bg-accent/20 hover:text-accent`} onClick={(e) => toggleShowReplyInputHandler(e, post)}>
                                <ReplyIcon className={isPostOutlet ? 'size-[22.5px]' : 'size-[18.75px]'} />
                            </button>
                            {replyComments.length ? <button type="button" className={actionCountClassName} onClick={(e) => toggleShowRepliesHandler(e, post, replyComments.map(replyPost => replyPost.postId))}>{totalNumberOfReplies}<span className="sr-only"> replies</span></button> : null}
                        </div>
                        <div className={`flex items-center ${isPostOutlet ? '' : 'flex-1'} ${replyLikes.length ? 'text-like' : ''}`}>
                            <button type="button" aria-label="Like" title="Like" className={`${actionButtonClassName} hover:bg-like/20 hover:text-like ${submittingLike === `${uniqueKey}-${post.postId}` ? 'bg-like/10 text-like' : ''}`} onClick={(e) => localSubmitLikeHandler(e, `${uniqueKey}-${post.postId}`, post.postId)}>
                                <HeartIcon className={isPostOutlet ? 'size-[22.5px]' : 'size-[18.75px]'} />
                            </button>
                            {replyLikes.length ? <button type="button" className={actionCountClassName} onClick={(e) => handleOpenLikesModal(e, replyLikes)}>{replyLikes.length}<span className="sr-only"> likes</span></button> : null}
                        </div>
                        <div className={`flex items-center ${isPostOutlet ? '' : 'flex-1'} ${postTips.totalAmount ? 'text-tip' : ''}`}>
                            <button type="button" aria-label="Tip" title="Tip" className={`${actionButtonClassName} hover:bg-tip/20 hover:text-tip ${submittingTip === `${uniqueKey}-${post.postId}` ? 'bg-tip/10 text-tip' : ''}`} onClick={(e) => handleOpenSendTipModal(e, `${uniqueKey}-${post.postId}`, post)}>
                                <TipIcon className={isPostOutlet ? 'size-[22.5px]' : 'size-[18.75px]'} />
                            </button>
                            {postTips.totalAmount ? <button type="button" className={actionCountClassName} onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getDisplayTipAmount(postTips.totalAmount)} iDNA</button> : null}
                        </div>
                    </div>
                    {!isBreakingChangeDisabled && showReplyInput && <div className={`basis-full cursor-auto ${isPostOutlet ? 'border-t border-line pt-1 pb-3' : 'pb-2'}`} onClick={(e) => e.stopPropagation()}>
                        <textarea
                            id={`post-input-${uniqueKey}-${post.postId}`}
                            rows={1}
                            className="block w-full field-sizing-content min-h-[29px] max-h-[520px] resize-none border-b border-line bg-transparent py-2 text-[15px]/5 text-ink outline-none placeholder:text-ink-muted focus:border-accent scrollbar-thin"
                            placeholder="Post your reply"
                            disabled={inputPostDisabled || submitting}
                            onFocus={replyInputOnFocusHandler}
                            onBlur={replyInputOnBlurHandler}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {postMediaAttachment ? <div className="mt-3">
                            <ObjectUrlImageComponent className="max-h-100 max-w-full sm:max-w-92 size-auto rounded-2xl border border-line" file={postMediaAttachment.file} />
                        </div> : null}
                        <div className="pt-2">
                            <ComposerToolbarComponent
                                compact
                                hasAttachment={!!postMediaAttachment}
                                onAddImage={(e) => handleOpenAddMediaModal(e, `${uniqueKey}-${post.postId}`, 'post')}
                                onRemoveImage={(e) => removeMediaHandler(e, `${uniqueKey}-${post.postId}`)}
                                copyTxId={`post-copytx-${uniqueKey}-${post.postId}`}
                                onCopyTx={(e) => localCopyPostTxHandler(e, `${uniqueKey}-${post.postId}`, post.postId)}
                                submitText={submittingPost === `${uniqueKey}-${post.postId}` ? '...' : 'Reply'}
                                onSubmit={(e) => localSubmitPostHandler(e, `${uniqueKey}-${post.postId}`, post.postId)}
                                submitDisabled={inputPostDisabled || submitting}
                            />
                        </div>
                    </div>}
                </div>
            </div>
            {showReplies && <div>
                <ul>
                    {replyComments.slice(0, showMaxReplies).map((replyPost, index) => {

                        const postTips = postTipsRef.current[replyPost.postId] ?? { totalAmount: 0, tips: [] };
                        const posterDisplayAddress = getDisplayAddress(replyPost.poster);
                        const posterStake = replyPost.posterDetails_atTimeOfPost.stake;
                        const posterState = replyPost.posterDetails_atTimeOfPost.state;
                        const posterAge = replyPost.posterDetails_atTimeOfPost.age;
                        const posterPic = getProfilePic(postersRef.current[replyPost.poster], posterState);
                        const { displayDate, displayTime } = getDisplayDateTime(replyPost.timestamp);
                        const { messageLines, textOverflows, truncatedMessageLines } = getMessageLines(replyPost.message, true, 3);
                        const postDomSettingsItem = getPostDomSettings(replyPost.postId);

                        const showTruncatedMessageLines = textOverflows === true && postDomSettingsItem.textOverflowHidden === true;

                        const messageLinesDisplay = showTruncatedMessageLines ? truncatedMessageLines : messageLines;

                        const postMediaAttachment = postMediaAttachmentsRef.current[`post-${uniqueKey}-${replyPost.postId}`];

                        const showDiscussion = !postDomSettingsItem.repliesHidden;
                        const discussParentId = discussPrefix + replyPost.postId;

                        const discussionPostComments = discussionPostsAll[discussParentId].discussionPostComments;
                        const discussionPostLikes = discussionPostsAll[discussParentId].discussionPostLikes;

                        const likesForReplyPost = discussionPostLikes.filter(like => like.replyToPostId === replyPost.postId);

                        const discussReplyToPostId = postDomSettingsItem.discussReplyToPostId;
                        const discussReplyToPost = discussReplyToPostId && postsRef.current[discussReplyToPostId!];

                        const isSpotlightReply = !!spotlightReplyPostId && index === 0;

                        const addAttrs = {
                            ...( isSpotlightReply && spotlightDiscussionPostId && { id: `spotlight-comment-${uniqueKey}-${spotlightReplyPostId}-${spotlightDiscussionPostId}`}),
                        };

                        return (
                            <li key={replyPost.postId} className={isPostOutlet ? 'border-t border-line' : ''}>
                                <div className={`flex gap-3 px-4 pb-1 ${isPostOutlet ? 'pt-3' : 'pt-1'} ${isSpotlightReply && !spotlightDiscussionPostId ? 'bg-accent/15 hover:bg-accent/20' : ''}`}>
                                    <div className="flex flex-none flex-col items-center">
                                        <ObjectUrlImageComponent className={`size-10 ${avatarClassName}`} file={posterPic} onClick={(e) => handleClickAddress(e, `/profile/${replyPost.poster}`)} />
                                        {!isPostOutlet && index < replyComments.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-line"></div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-1 text-[15px]/5 sm:flex-nowrap">
                                            <span className="cursor-pointer whitespace-nowrap font-bold text-ink hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${replyPost.poster}`)}>{posterDisplayAddress}</span>
                                            <span className="min-w-0 truncate text-ink-muted max-sm:order-last max-sm:basis-full max-sm:text-[13px]/4" title={`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`}>{`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`}</span>
                                            <span className="text-ink-muted" aria-hidden="true">·</span>
                                            <a className="whitespace-nowrap text-ink-muted hover:underline" href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank" rel="noopener noreferrer" title={`${displayDate}, ${displayTime}`}>{getDisplayTimeAgo(replyPost.timestamp)}</a>
                                        </div>
                                        <p className="text-[15px]/5 text-ink [word-break:break-word]">{messageLinesDisplay.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}{showTruncatedMessageLines && <span> <a className="cursor-pointer whitespace-nowrap text-accent hover:underline" onClick={(e) => toggleViewMoreHandler(replyPost, e)}>Show more</a></span>}</p>
                                        {replyPost.image && <div className="mt-3">
                                            <ObjectUrlImageComponent className="max-h-100 max-w-full sm:max-w-92 size-auto rounded-2xl border border-line hover:cursor-pointer" file={replyPost.image} onClick={(e) => handleExpandImageModal(e, replyPost.image!, replyPost.cid)} />
                                        </div>}
                                        <div className="mt-1 -ml-2 flex max-w-[425px] text-[13px] text-ink-muted">
                                            <div className={`flex flex-1 items-center ${discussionPostComments.length || showDiscussion ? 'text-accent' : ''}`}>
                                                <button type="button" aria-label="Comment" title="Comment" className={`${actionButtonClassName} hover:bg-accent/20 hover:text-accent`} onClick={() => toggleReplyDiscussionHandler(replyPost)}>
                                                    <ReplyIcon className="size-[18.75px]" />
                                                </button>
                                                {discussionPostComments.length || showDiscussion ? <button type="button" className={actionCountClassName} onClick={() => toggleShowDiscussionHandler(replyPost)}>{discussionPostComments.length}<span className="sr-only"> comments</span></button> : null}
                                            </div>
                                            <div className={`flex flex-1 items-center ${likesForReplyPost.length ? 'text-like' : ''}`}>
                                                <button type="button" aria-label="Like" title="Like" className={`${actionButtonClassName} hover:bg-like/20 hover:text-like ${submittingLike === `${uniqueKey}-${replyPost.postId}` ? 'bg-like/10 text-like' : ''}`} onClick={(e) => localSubmitLikeHandler(e, `${uniqueKey}-${replyPost.postId}`, replyPost.postId, discussParentId)}>
                                                    <HeartIcon className="size-[18.75px]" />
                                                </button>
                                                {likesForReplyPost.length ? <button type="button" className={actionCountClassName} onClick={(e) => handleOpenLikesModal(e, likesForReplyPost)}>{likesForReplyPost.length}<span className="sr-only"> likes</span></button> : null}
                                            </div>
                                            <div className={`flex flex-1 items-center ${postTips.totalAmount ? 'text-tip' : ''}`}>
                                                <button type="button" aria-label="Tip" title="Tip" className={`${actionButtonClassName} hover:bg-tip/20 hover:text-tip ${submittingTip === `${uniqueKey}-${replyPost.postId}` ? 'bg-tip/10 text-tip' : ''}`} onClick={(e) => handleOpenSendTipModal(e, `${uniqueKey}-${replyPost.postId}`, replyPost)}>
                                                    <TipIcon className="size-[18.75px]" />
                                                </button>
                                                {postTips.totalAmount ? <button type="button" className={actionCountClassName} onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getDisplayTipAmount(postTips.totalAmount)} iDNA</button> : null}
                                            </div>
                                        </div>
                                        {showDiscussion && <div className="mt-1 mb-2 overflow-hidden border border-line">
                                            <ul {...addAttrs} id={`spotlight-discussion-${uniqueKey}-${spotlightReplyPostId}-${spotlightDiscussionPostId}`} className="relative flex flex-col flex-col-reverse max-h-100 overflow-y-auto scrollbar-thin">
                                                {discussionPostComments.length === 0 && <li className="py-3"><p className="text-center text-[13px] text-ink-muted">No comments yet</p></li>}
                                                {discussionPostComments.map((discussionPost) => {
                                                    const postTips = postTipsRef.current[discussionPost.postId] ?? { totalAmount: 0, tips: [] };
                                                    const posterDisplayAddress = getDisplayAddressShort(discussionPost.poster);
                                                    const posterStake = discussionPost.posterDetails_atTimeOfPost.stake;
                                                    const posterState = discussionPost.posterDetails_atTimeOfPost.state;
                                                    const posterAge = discussionPost.posterDetails_atTimeOfPost.age;
                                                    const posterPic = getProfilePic(postersRef.current[discussionPost.poster], posterState);
                                                    const { displayDate, displayTime } = getDisplayDateTime(discussionPost.timestamp);
                                                    const { messageLines } = getMessageLines(discussionPost.message);
                                                    const replyToPost = postsRef.current[discussionPost.replyToPostId];
                                                    const replyToPostPosterState = replyToPost?.posterDetails_atTimeOfPost.state;
                                                    const replyToPostPosterPic = getProfilePic(postersRef.current[replyToPost?.poster], replyToPostPosterState);
                                                    const likesForDiscussionPost = discussionPostLikes.filter(like => like.replyToPostId === discussionPost.postId);

                                                    const isSpotlightDiscussionPost = discussionPost.postId === spotlightDiscussionPostId;

                                                    const addAttrs = {
                                                        ...( isSpotlightDiscussionPost && { id: `spotlight-comment-${uniqueKey}-${spotlightReplyPostId}-${spotlightDiscussionPostId}`}),
                                                    };

                                                    return (
                                                        <li {...addAttrs} className={`px-3 py-2 ${isSpotlightDiscussionPost ? 'bg-accent/15 hover:bg-accent/20' : 'hover:bg-ink/[0.03]'}`}>
                                                            {replyToPost && <div className="flex items-center gap-1 text-[13px]/5 text-ink-muted">
                                                                <div className="ml-4 h-2.5 w-4 flex-none self-end rounded-tl border-t border-l border-line-strong"></div>
                                                                <ObjectUrlImageComponent className="size-4 flex-none rounded-full bg-surface object-cover" file={replyToPostPosterPic} />
                                                                <p className="min-w-0 truncate">{getMessageLines(replyToPost.message).messageLines[0]}</p>
                                                            </div>}
                                                            <div className="flex gap-2">
                                                                <ObjectUrlImageComponent className={`size-8 ${avatarClassName}`} file={posterPic} onClick={(e) => handleClickAddress(e, `/profile/${discussionPost.poster}`)} />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1 text-[14px]/5">
                                                                        <span className="cursor-pointer whitespace-nowrap font-bold text-ink hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${discussionPost.poster}`)}>{posterDisplayAddress}</span>
                                                                        <span className="min-w-0 truncate text-[13px] text-ink-muted" title={`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`}>{`Age ${posterAge} · ${getIdentityStatus(posterState)} · Stake ${posterStake}`}</span>
                                                                        <span className="text-[13px] text-ink-muted" aria-hidden="true">·</span>
                                                                        <a className="whitespace-nowrap text-[13px] text-ink-muted hover:underline" href={`https://scan.idena.io/transaction/${discussionPost.txHash}`} target="_blank" rel="noopener noreferrer" title={`${displayDate}, ${displayTime}`}>{getDisplayTimeAgo(discussionPost.timestamp)}</a>
                                                                    </div>
                                                                    <div className="max-h-[9999px] text-[14px]/5 text-ink">
                                                                        <p className="[word-break:break-word]">{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                                                    </div>
                                                                    {discussionPost.image && <div className="mt-2">
                                                                        <ObjectUrlImageComponent className="max-h-80 max-w-full sm:max-w-74 size-auto rounded-2xl border border-line hover:cursor-pointer" file={discussionPost.image} onClick={(e) => handleExpandImageModal(e, discussionPost.image!, discussionPost.cid)} />
                                                                    </div>}
                                                                    <div className="-ml-1.5 flex gap-4 text-[13px] text-ink-muted">
                                                                        <button type="button" aria-label="Reply" title="Reply" className={`${commentActionButtonClassName} hover:bg-accent/20 hover:text-accent`} onClick={() => setDiscussReplyToPostIdHandler(replyPost, discussionPost.postId)}>
                                                                            <ReplyIcon className="size-4" />
                                                                        </button>
                                                                        <div className={`flex items-center ${likesForDiscussionPost.length ? 'text-like' : ''}`}>
                                                                            <button type="button" aria-label="Like" title="Like" className={`${commentActionButtonClassName} hover:bg-like/20 hover:text-like ${submittingLike === `${uniqueKey}-${discussionPost.postId}` ? 'bg-like/10 text-like' : ''}`} onClick={(e) => localSubmitLikeHandler(e, `${uniqueKey}-${discussionPost.postId}`, discussionPost.postId, discussParentId)}>
                                                                                <HeartIcon className="size-4" />
                                                                            </button>
                                                                            {likesForDiscussionPost.length ? <button type="button" className="-ml-0.5 cursor-pointer hover:underline" onClick={(e) => handleOpenLikesModal(e, likesForDiscussionPost)}>{likesForDiscussionPost.length}<span className="sr-only"> likes</span></button> : null}
                                                                        </div>
                                                                        <div className={`flex items-center ${postTips.totalAmount ? 'text-tip' : ''}`}>
                                                                            <button type="button" aria-label="Tip" title="Tip" className={`${commentActionButtonClassName} hover:bg-tip/20 hover:text-tip ${submittingTip === `${uniqueKey}-${discussionPost.postId}` ? 'bg-tip/10 text-tip' : ''}`} onClick={(e) => handleOpenSendTipModal(e, `${uniqueKey}-${discussionPost.postId}`, discussionPost)}>
                                                                                <TipIcon className="size-4" />
                                                                            </button>
                                                                            {postTips.totalAmount ? <button type="button" className="-ml-0.5 cursor-pointer hover:underline" onClick={(e) => handleOpenTipsModal(e, postTips.tips)}>{getShortDisplayTipAmount(postTips.totalAmount)}<span className="sr-only"> iDNA</span></button> : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                            {!isBreakingChangeDisabled && <>
                                                {discussReplyToPost && <div className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-[13px] text-ink-muted">
                                                    <p className="min-w-0 flex-1 truncate">Replying to <span className="text-accent">{getDisplayAddressShort(discussReplyToPost!.poster)}</span>: {getMessageLines(discussReplyToPost!.message).messageLines[0]}</p>
                                                    <button type="button" aria-label="Cancel reply" title="Cancel reply" className="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-full text-ink hover:bg-ink/10" onClick={() => setDiscussReplyToPostIdHandler(replyPost)}>
                                                        <CloseIcon className="size-3.5" />
                                                    </button>
                                                </div>}
                                                <div className="border-t border-line px-3 py-2">
                                                    <textarea
                                                        id={`post-input-${uniqueKey}-${replyPost.postId}`}
                                                        rows={2}
                                                        className="block w-full field-sizing-content min-h-[26px] max-h-[312px] resize-none bg-transparent py-1 text-[14px]/5 text-ink outline-none placeholder:text-ink-muted scrollbar-thin"
                                                        placeholder="Post your comment"
                                                        disabled={inputPostDisabled || submitting}
                                                    />
                                                    {postMediaAttachment && <div className="my-2">
                                                        <ObjectUrlImageComponent className="max-h-80 max-w-full sm:max-w-74 size-auto rounded-2xl border border-line" file={postMediaAttachment.file} />
                                                    </div>}
                                                    <div className="pt-1">
                                                        <ComposerToolbarComponent
                                                            compact
                                                            hasAttachment={!!postMediaAttachment}
                                                            onAddImage={(e) => handleOpenAddMediaModal(e, `${uniqueKey}-${replyPost.postId}`, 'post')}
                                                            onRemoveImage={(e) => removeMediaHandler(e, `${uniqueKey}-${replyPost.postId}`)}
                                                            copyTxId={`post-copytx-${uniqueKey}-${replyPost.postId}`}
                                                            onCopyTx={(e) => localCopyPostTxHandler(e, `${uniqueKey}-${replyPost.postId}`, discussReplyToPostId, discussParentId)}
                                                            submitText={submittingPost === `${uniqueKey}-${replyPost.postId}` ? '...' : 'Reply'}
                                                            onSubmit={(e) => localSubmitPostHandler(e, `${uniqueKey}-${replyPost.postId}`, discussReplyToPostId, discussParentId)}
                                                            submitDisabled={inputPostDisabled || submitting}
                                                        />
                                                    </div>
                                                </div>
                                            </>}
                                        </div>}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                {replyComments.length > showMaxReplies && <button type="button" className={`block w-full cursor-pointer py-3 text-left text-[15px] text-accent hover:bg-ink/[0.03] ${isPostOutlet ? 'border-t border-line px-4' : 'pr-4 pl-[68px]'}`} onClick={() => increaseShowMaxReplies(10)}>Show more replies</button>}
            </div>}
        </div>
    </>);
}

export default PostComponent;
