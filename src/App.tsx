import { useEffect, useRef, useState, type FocusEventHandler } from 'react';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { getChildPostIds, submitPost, type Post, type Poster, breakingChanges, getNewPosterAndPost, getReplyPosts, deOrphanReplyPosts, getTransactionDetails, getBlockHeightFromTxHash } from './logic/asyncUtils';
import { getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient } from './logic/api';
import { getDisplayAddress, getDisplayAddressShort, getDisplayDateTime, getMessageLines, isObjectEmpty } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';

const defaultNodeUrl = 'https://restricted.idena.io';
const defaultNodeApiKey = 'idena-restricted-node-key';
const initIndexerApiUrl = 'https://api.idena.io';
const contractAddressV2 = '0xC5B35B4Dc4359Cc050D502564E789A374f634fA9';
const contractAddressV1 = '0x8d318630eB62A032d2f8073d74f05cbF7c6C87Ae';
const firstBlock = 10135627;
const makePostMethod = 'makePost';
const thisChannelId = '';
const discussPrefix = 'discuss:';
const postChannelRegex = new RegExp(String.raw`${discussPrefix}[\d]+$`, 'i');
const zeroAddress = '0x0000000000000000000000000000000000000000';
const callbackUrl = `${window.location.origin}/confirm-tx.html`;
const termsOfServiceUrl = `${window.location.origin}/terms-of-service.html`;
const postTextHeight = 'max-h-[288px]';
const replyPostTextHeight = 'max-h-[146px]';
const defaultAd = {
    title: 'IDENA: Proof-of-Person blockchain',
    desc: 'Coordination of individuals',
    url: 'https://idena.io',
    thumb: '',
    media: WhatIsIdenaPng,
};

const POLLING_INTERVAL = 5000;
const SCANNING_INTERVAL = 10;
const SUBMITTING_POST_INTERVAL = 2000;
const ADS_INTERVAL = 10000;
const SCAN_POSTS_TTL = 1 * 60;
const INDEXER_API_ITEMS_LIMIT = 10;
const SET_NEW_POSTS_ADDED_DELAY = 20;

const DEBUG = false;

if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

function App() {
    const [nodeAvailable, setNodeAvailable] = useState<boolean>(true);
    const nodeAvailableRef = useRef(nodeAvailable);
    const rpcClientRef = useRef(undefined as undefined | RpcClient);
    const [viewOnlyNode, setViewOnlyNode] = useState<boolean>(false);
    const [inputNodeApplied, setInputNodeApplied] = useState<boolean>(true);
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const [inputPostersAddress, setInputPostersAddress] = useState<string>(zeroAddress);
    const [inputPostersAddressApplied, setInputPostersAddressApplied] = useState<boolean>(true);
    const [inputNodeUrl, setInputNodeUrl] = useState<string>(defaultNodeUrl);
    const [inputNodeKey, setInputNodeKey] = useState<string>(defaultNodeApiKey);
    const [postersAddress, setPostersAddress] = useState<string>(zeroAddress);
    const [postersAddressInvalid, setPostersAddressInvalid] = useState<boolean>(false);
    const [inputSendingTxs, setInputSendingTxs] = useState<string>('idena-app');
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [orderedPostIds, setOrderedPostIds] = useState<string[]>([]);
    const postsRef = useRef({} as Record<string, Post>);
    const postersRef = useRef({} as Record<string, Poster>);
    const [initialBlock, setInitialBlock] = useState<number>(0);
    const [pastBlockCaptured, setPastBlockCaptured] = useState<number>(0);
    const pastBlockCapturedRef = useRef(pastBlockCaptured);
    const partialPastBlockCapturedRef = useRef(0);
    const [currentBlockCaptured, setCurrentBlockCaptured] = useState<number>(0);
    const currentBlockCapturedRef = useRef(currentBlockCaptured);
    const [scanningPastBlocks, setScanningPastBlocks] = useState<boolean>(false);
    const scanningPastBlocksRef = useRef(scanningPastBlocks);
    const [ads, setAds] = useState<ApprovedAd[]>([]);
    const [currentAd, setCurrentAd] = useState<ApprovedAd | null>(null);
    const currentAdRef = useRef(currentAd);
    const [inputFindingPastPosts, setInputFindingPastPosts] = useState<string>('indexer-api');
    const inputFindingPastPostsRef = useRef(inputFindingPastPosts);
    const [noMorePastBlocks, setNoMorePastBlocks] = useState<boolean>(false);
    const [indexerApiUrl, setIdenaIndexerApiUrl] = useState<string>(initIndexerApiUrl);
    const indexerApiUrlRef = useRef(indexerApiUrl);
    const [indexerApiUrlInvalid, setIdenaIndexerApiUrlInvalid] = useState<boolean>(false);
    const indexerApiUrlInvalidRef = useRef(indexerApiUrlInvalid);
    const [inputIdenaIndexerApiUrl, setInputIdenaIndexerApiUrl] = useState<string>(initIndexerApiUrl);
    const [inputIdenaIndexerApiUrlApplied, setInputIdenaIndexerApiUrlApplied] = useState<boolean>(true);
    const replyPostsTreeRef = useRef({} as Record<string, string>);
    const deOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const forwardOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const backwardOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const continuationTokenRef = useRef(undefined as undefined | string);
    const pastContractAddressRef = useRef(contractAddressV2);

    const setRpcClient = (idenaNodeUrl: string, idenaNodeApiKey: string, setNodeAvailable: React.Dispatch<React.SetStateAction<boolean>>) => {
        rpcClientRef.current = getRpcClient({ idenaNodeUrl, idenaNodeApiKey }, setNodeAvailable);

        (async function() {
            const { result: syncingResult } = await rpcClientRef.current!('bcn_syncing', []);

            if (!syncingResult) {
                alert('Your node has an issue! Please check if you typed in the correct details.');
                return;
            }
            if (syncingResult.syncing) {
                alert('Your node is still syncing! Please try again after syncing has completed.');
                return;
            }

            if (!initialBlock) {
                const { result: getLastBlockResult } = await rpcClientRef.current!('bcn_lastBlock', []);
                setInitialBlock(getLastBlockResult?.height ?? 0);
                setScanningPastBlocks(true);
            }

            const { result: getCoinbaseAddrResult } = await rpcClientRef.current!('dna_getCoinbaseAddr', [], true);

            if (getCoinbaseAddrResult) {
                setPostersAddress(getCoinbaseAddrResult);
                setViewOnlyNode(false);
            } else {
                setPostersAddress('');
                setViewOnlyNode(true);
            }

            const adsClient = new IdenaApprovedAds({ idenaNodeUrl: inputNodeUrl, idenaNodeApiKey: inputNodeKey });

            try {
                const ads = await adsClient.getApprovedAds();
                setAds([defaultAd as ApprovedAd, ...ads]);
            } catch (error) {
                console.error(error);
                setAds([defaultAd as ApprovedAd]);
            }

        })();
    };

    useEffect(() => {
        if (inputNodeApplied) {
            setRpcClient(inputNodeUrl, inputNodeKey, setNodeAvailable);
        }
    }, [inputNodeApplied]);

    useEffect(() => {
        if (inputPostersAddressApplied && inputSendingTxs === 'idena-app') {
            setPostersAddress(inputPostersAddress);

            if (inputPostersAddress === zeroAddress) {
                setPostersAddressInvalid(true);
            } else {
                (async function() {
                    const { result: getBalanceResult } = await rpcClientRef.current!('dna_getBalance', [inputPostersAddress]);

                    if (!getBalanceResult) {
                        setPostersAddressInvalid(true);
                    } else if (Number(getBalanceResult.balance) === 0) {
                        alert('Your address has no idna, posting will fail!');
                        setPostersAddressInvalid(false);
                    } else {
                        setPostersAddressInvalid(false);
                    }
                })();
            }
        }
    }, [inputPostersAddressApplied]);

    useEffect(() => {
        if (inputIdenaIndexerApiUrlApplied && inputFindingPastPosts === 'indexer-api') {
            setIdenaIndexerApiUrl(inputIdenaIndexerApiUrl);

            (async function() {
                const { result, error } = await getPastTxsWithIdenaIndexerApi(inputIdenaIndexerApiUrl, contractAddressV2, 1);

                if (!error && result?.length === 1 && result?.[0]?.address === contractAddressV2) {
                    setIdenaIndexerApiUrlInvalid(false);
                } else {
                    setIdenaIndexerApiUrlInvalid(true);
                }
            })();
        }
    }, [inputIdenaIndexerApiUrlApplied]);

    useEffect(() => {
        setCurrentAd(ads[0]);
        if (ads.length) {
            setCurrentAd(ads[0]);

            let rotateAdsIntervalId: NodeJS.Timeout;

            async function recurse() {
                rotateAdsIntervalId = setTimeout(() => {
                    const adIndex = ads.findIndex((ad) => ad.cid === currentAdRef.current?.cid);
                    const nextIndex = adIndex !== (ads.length - 1) ? adIndex + 1 : 0;
                    setCurrentAd(ads[nextIndex]);
                    recurse();
                }, ADS_INTERVAL);
            };
            recurse();

            return () => clearInterval(rotateAdsIntervalId);
        }
    }, [ads]);

    useEffect(() => {
        nodeAvailableRef.current = nodeAvailable;
    }, [nodeAvailable]);

    useEffect(() => {
        currentBlockCapturedRef.current = currentBlockCaptured;
    }, [currentBlockCaptured]);

    useEffect(() => {
        scanningPastBlocksRef.current = scanningPastBlocks;
    }, [scanningPastBlocks]);

    useEffect(() => {
        pastBlockCapturedRef.current = pastBlockCaptured;
    }, [pastBlockCaptured]);

    useEffect(() => {
        currentAdRef.current = currentAd;
    }, [currentAd]);

    useEffect(() => {
        inputFindingPastPostsRef.current = inputFindingPastPosts;
    }, [inputFindingPastPosts]);

    useEffect(() => {
        indexerApiUrlRef.current = indexerApiUrl;
    }, [indexerApiUrl]);

    useEffect(() => {
        indexerApiUrlInvalidRef.current = indexerApiUrlInvalid;
    }, [indexerApiUrlInvalid]);

    type RecurseForward = () => Promise<void>;
    useEffect(() => {
        if (initialBlock && nodeAvailable) {
            let recurseForwardIntervalId: NodeJS.Timeout;

            (async function recurseForward() {
                if (nodeAvailableRef.current) {
                    const pendingBlock = currentBlockCapturedRef.current ? currentBlockCapturedRef.current + 1 : initialBlock;
                    const contractAddress = contractAddressV2;
                    recurseForwardIntervalId = setTimeout(postScannerFactory('recurseForward', recurseForward, setCurrentBlockCaptured, contractAddress, pendingBlock), POLLING_INTERVAL);
                }
            } as RecurseForward)();

            return () => clearInterval(recurseForwardIntervalId);
        }
    }, [initialBlock, nodeAvailable]);

    type RecurseBackward = (time: number) => Promise<void>;
    useEffect(() => {
        if (scanningPastBlocks && initialBlock && nodeAvailable) {
            let recurseBackwardIntervalId: NodeJS.Timeout;

            const timeNow = Math.floor(Date.now() / 1000);
            const ttl = timeNow + SCAN_POSTS_TTL;

            (async function recurseBackward(time: number) {
                if (scanningPastBlocksRef.current && nodeAvailableRef.current && time < ttl) {
                    const recurseMethod = inputFindingPastPostsRef.current === 'rpc' ? 'recurseBackwardWithRpcOnly' : 'recurseBackwardWithIndexerApi';
                    const contractAddress = pastContractAddressRef!.current;
                    // pendingBlock only relevant if recurseBackwardWithRpcOnly
                    const pendingBlock = pastBlockCapturedRef.current ? (partialPastBlockCapturedRef.current ? partialPastBlockCapturedRef.current : pastBlockCapturedRef.current - 1) : initialBlock - 1;
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(recurseMethod, recurseBackward, setPastBlockCaptured, contractAddress, pendingBlock), SCANNING_INTERVAL);
                } else {
                    setScanningPastBlocks(false);
                }
            } as RecurseBackward)(timeNow);

            return () => clearInterval(recurseBackwardIntervalId);
        }
    }, [scanningPastBlocks, initialBlock, nodeAvailable]);

    useEffect(() => {
        let intervalSubmittingPost: NodeJS.Timeout;

        if (submittingPost) {
            intervalSubmittingPost = setTimeout(() => {
                setSubmittingPost('');
            }, SUBMITTING_POST_INTERVAL);
        }

        return () => clearInterval(intervalSubmittingPost);
    }, [submittingPost]);

    useEffect(() => {
        setInputPostDisabled(!!submittingPost || (inputSendingTxs === 'rpc' && viewOnlyNode) || postersAddressInvalid);
    }, [submittingPost, inputSendingTxs, viewOnlyNode, postersAddressInvalid]);

    const setNewPostsAdded = (newPostsAdded: string[]) => {
        const updatedPosts: Record<string, Post> = {};

        for (let index = 0; index < newPostsAdded.length; index++) {
            const key = newPostsAdded[index];
            const post = postsRef.current[key];
            const messageDiv = document.getElementById(`post-text-${post.postId}`);

            if (messageDiv!.scrollHeight > messageDiv!.clientHeight) {
                updatedPosts[post.postId] = { ...post, postDomSettings: { ...post.postDomSettings, textOverflows: true } };
            }
        }

        postsRef.current = ({ ...postsRef.current, ...updatedPosts });
        setOrderedPostIds(current => [...current]);
    }

    const submitPostHandler = async (location: string, replyToPostId?: string, channelId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot post!');
            return;
        }

        const postTextareaElement = document.getElementById(`post-input-${location}`) as HTMLTextAreaElement;
        const inputText = postTextareaElement.value;

        if (inputText) {
            postTextareaElement.value = '';
        } else {
            return;
        }

        setSubmittingPost(location);

        if (location !== 'main') {
            postTextareaElement.rows = 1;
        }

        const post = postsRef.current[location];
        if (post) {
            setDiscussReplyToPostIdHandler(post);
        }

        await submitPost(postersAddress, contractAddressV2, makePostMethod, inputText, replyToPostId ?? null, channelId ?? null, inputSendingTxs, rpcClientRef.current!, callbackUrl);
    };

    const handleInputSendingTxsToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputSendingTxs(event.target.value);

        if (event.target.value === 'rpc') {
            setInputPostersAddress('');
            setPostersAddressInvalid(false);
            setRpcClient(inputNodeUrl, inputNodeKey, setNodeAvailable);
        }
        
        if (event.target.value === 'idena-app') {
            if (postersAddress) {
                setInputPostersAddress(postersAddress);
                setPostersAddressInvalid(false);
            } else {
                setInputPostersAddress(zeroAddress);
                setPostersAddress(zeroAddress);
                setPostersAddressInvalid(true);
            }
        }
    };

    const handleInputFindingPastPostsToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputFindingPastPosts(event.target.value);

        if (event.target.value === 'rpc') {
            setIdenaIndexerApiUrl('');
            setIdenaIndexerApiUrlInvalid(false);
        }

        if (event.target.value === 'indexer-api') {
            if (indexerApiUrl) {
                setIdenaIndexerApiUrl(indexerApiUrl);
                setPostersAddressInvalid(false);
            } else {
                setInputIdenaIndexerApiUrl(initIndexerApiUrl);
                setIdenaIndexerApiUrl(initIndexerApiUrl);
            }
        }
    };

    const postScannerFactory = (
        recurseMethod: string,
        recurse: RecurseForward | RecurseBackward,
        setBlockCaptured: React.Dispatch<React.SetStateAction<number>>,
        contractAddress: string,
        pendingBlock?: number,
    ) => {
        return async function postFinder() {
            const isRecurseForward = recurseMethod === 'recurseForward';
            const isRecurseBackwardWithRpcOnly = recurseMethod === 'recurseBackwardWithRpcOnly';
            const isRecurseBackwardWithIndexerApi = recurseMethod === 'recurseBackwardWithIndexerApi';

            try {
                let transactions = [];

                if (isRecurseForward || isRecurseBackwardWithRpcOnly) {
                    const { result: getBlockByHeightResult, error } = await rpcClientRef.current!('bcn_blockAt', [pendingBlock!]);

                    if (error) {
                        throw 'rpc unavailable';
                    }

                    if (getBlockByHeightResult === null) {
                        throw 'no block';
                    }
                    
                    if (getBlockByHeightResult.transactions === null) {
                        setBlockCaptured(pendingBlock!);

                        if (isRecurseBackwardWithRpcOnly && getBlockByHeightResult.timestamp < breakingChanges.v5.timestamp) {
                            pastContractAddressRef!.current = contractAddressV1;
                        }
                        throw 'no transactions';
                    }

                    transactions = getBlockByHeightResult.transactions.map((txHash: string) => ({ txHash, timestamp: getBlockByHeightResult.timestamp, blockHeight: getBlockByHeightResult.height }));
                } else if (isRecurseBackwardWithIndexerApi) {
                    if (continuationTokenRef!.current === 'finished processing') {
                        throw 'no more transactions';
                    }
                    const { result, continuationToken, error } = await getPastTxsWithIdenaIndexerApi(inputIdenaIndexerApiUrl, pastContractAddressRef!.current, INDEXER_API_ITEMS_LIMIT, continuationTokenRef!.current);
                    
                    if (error) {
                        throw 'indexer api unavailable';
                    }

                    if (continuationToken) {
                        continuationTokenRef!.current = continuationToken;
                    } else {
                        if (pastContractAddressRef!.current === contractAddressV2) {
                            pastContractAddressRef!.current = contractAddressV1;
                            continuationTokenRef!.current = undefined;
                        } else {
                            continuationTokenRef!.current = 'finished processing';
                        }
                    }

                    transactions = result
                        ?.filter((balanceUpdate: any) => balanceUpdate.type === 'CallContract' && balanceUpdate.txReceipt.method === makePostMethod && balanceUpdate.txReceipt.success === true)
                        .map((balanceUpdate: any) => ({ txHash: balanceUpdate.hash, timestamp: Math.floor((new Date(balanceUpdate.timestamp)).getTime() / 1000 ) }))
                    ?? [];
                } else {
                    throw 'this should not happen';
                }

                const transactionsWithDetails = await getTransactionDetails(transactions, contractAddress, makePostMethod, rpcClientRef.current!);

                let lastValidTransaction;

                const newOrderedPostIds: string[] = [];

                let newReplyPostsCollection = {};

                for (let index = 0; index < transactionsWithDetails.length; index++) {
                    const transaction = transactionsWithDetails[index];

                    const {
                        newPost,
                        newPoster,
                        continued,
                    } = await getNewPosterAndPost(
                        transaction,
                        thisChannelId,
                        postChannelRegex,
                        rpcClientRef.current!,
                        postsRef,
                        postersRef,
                    );

                    if (continued) {
                        continue;
                    }

                    lastValidTransaction = transaction;

                    if (!newPost!.replyToPostId && newPost!.channelId === thisChannelId) {
                        newOrderedPostIds.push(newPost!.postId);
                    }

                    const newPosts = { [newPost!.postId]: newPost as Post };
                    const newPosters = newPoster ? { [newPoster.address]: newPoster } : {};

                    const newReplyPosts: Record<string, string> = {};
                    const newForwardOrphanedReplyPosts: Record<string, string> = {};
                    const newBackwardOrphanedReplyPosts: Record<string, string> = {};
                    const newDeOrphanedReplyPosts: Record<string, string> = {};

                    const updatedPosts: Record<string, Post> = {};

                    if (postChannelRegex.test(newPost!.channelId)) {
                        const discussionPostId = newPost!.channelId.split(':')[1];
                        const discussionPost = postsRef.current[discussionPostId];
                        const orphaned = !discussionPost || discussionPost.orphaned;
                        postsRef.current = { ...postsRef.current, [newPost!.channelId]: { orphaned } as Post };

                        getReplyPosts(
                            newPost!.postId,
                            newPost!.channelId,
                            isRecurseForward,
                            postsRef.current,
                            replyPostsTreeRef.current,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            newReplyPosts,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                        );

                        if (!isObjectEmpty(newForwardOrphanedReplyPosts) || !isObjectEmpty(newBackwardOrphanedReplyPosts)) {
                            newPost!.orphaned = true;
                        }

                    } else if (newPost!.channelId === thisChannelId) {
                        getReplyPosts(
                            newPost!.postId,
                            newPost!.replyToPostId,
                            isRecurseForward,
                            postsRef.current,
                            replyPostsTreeRef.current,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            newReplyPosts,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                        );

                        if (!isObjectEmpty(newForwardOrphanedReplyPosts) || !isObjectEmpty(newBackwardOrphanedReplyPosts)) {
                            newPost!.orphaned = true;
                        }

                        newReplyPostsCollection = { ...newReplyPostsCollection, ...newReplyPosts };

                        deOrphanReplyPosts(
                            newPost!.postId,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            postsRef.current,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                            newDeOrphanedReplyPosts,
                            updatedPosts,
                        );

                        deOrphanReplyPosts(
                            discussPrefix + newPost!.postId,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            postsRef.current,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                            newDeOrphanedReplyPosts,
                            updatedPosts,
                        );

                    } else {
                        throw 'this should not happen';
                    }

                    postersRef.current = { ...postersRef.current, ...newPosters };
                    postsRef.current = { ...postsRef.current, ...updatedPosts, ...newPosts };
                    replyPostsTreeRef.current = { ...replyPostsTreeRef.current, ...newReplyPosts };
                    deOrphanedReplyPostsTreeRef.current = { ...deOrphanedReplyPostsTreeRef.current, ...newDeOrphanedReplyPosts };
                    forwardOrphanedReplyPostsTreeRef.current = { ...forwardOrphanedReplyPostsTreeRef.current, ...newForwardOrphanedReplyPosts };
                    backwardOrphanedReplyPostsTreeRef.current = { ...backwardOrphanedReplyPostsTreeRef.current, ...newBackwardOrphanedReplyPosts };
                }

                setOrderedPostIds((currentOrderedPostIds) => isRecurseForward ? [...newOrderedPostIds!, ...currentOrderedPostIds] : [...currentOrderedPostIds, ...newOrderedPostIds!]);
                setTimeout(() => {
                    setNewPostsAdded(newOrderedPostIds!);
                }, SET_NEW_POSTS_ADDED_DELAY);

                const newReplyToPostIds = [ ...new Set([ ...Object.keys(newReplyPostsCollection!) ].map(item => item.split('-')[0])) ];
                newReplyToPostIds.forEach((replyToId) => {
                    if (!postsRef.current[replyToId]?.postDomSettings?.repliesHidden) {
                        const repliesToThisPost = getChildPostIds(replyToId, newReplyPostsCollection!);
                        setTimeout(() => {
                            setNewPostsAdded(repliesToThisPost);
                        }, SET_NEW_POSTS_ADDED_DELAY);
                    }
                });

                let lastBlockHeight;

                if (isRecurseForward || isRecurseBackwardWithRpcOnly) {
                    lastBlockHeight = pendingBlock!;
                    partialPastBlockCapturedRef.current = 0;
                    setBlockCaptured(lastBlockHeight);
                }

                if (isRecurseBackwardWithIndexerApi && lastValidTransaction) {
                    lastBlockHeight = lastValidTransaction.blockHeight ?? (await getBlockHeightFromTxHash(lastValidTransaction.txHash, rpcClientRef.current!));
                    partialPastBlockCapturedRef.current = lastBlockHeight;
                    setBlockCaptured(lastBlockHeight);
                }

                if (!isRecurseForward && lastBlockHeight <= firstBlock) {
                    throw 'no more transactions';
                }

                if (isRecurseForward) {
                    (recurse as RecurseForward)();
                } else {
                    (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                }
            } catch(error) {
                console.error(error);
                if (!isRecurseForward && error === 'no more transactions') {
                    setNoMorePastBlocks(true);
                    setScanningPastBlocks(false);
                } else if (error === 'rpc unavailable') {
                    setScanningPastBlocks(false);
                } else if (error === 'indexer api unavailable') {
                    setIdenaIndexerApiUrlInvalid(true);
                } else {
                    if (isRecurseForward) {
                        (recurse as RecurseForward)();
                    } else {
                        (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                    }
                }
            }
        };
    };

    const toggleViewMoreHandler = (post: Post) => {
        post.postDomSettings.textOverflowHidden = !post.postDomSettings.textOverflowHidden;
        postsRef.current = ({ ...postsRef.current, [post.postId]: post });

        if (post.postDomSettings.textOverflowHidden) {
            const messageDiv = document.getElementById(`post-text-${post.postId}`);
            const isReply = !!post.replyToPostId;
            const rawTextHeight = isReply ? replyPostTextHeight : postTextHeight;
            const textHeightNumber = parseInt(rawTextHeight.split('max-h-[')[1].split('px]')[0]);
            const adjustheight = messageDiv!.scrollHeight - textHeightNumber;
            window.scrollBy({ top: -adjustheight });
        }
        setOrderedPostIds(current => [...current]);
    };

    const toggleShowRepliesHandler = (post: Post, repliesToThisPost: string[]) => {
        post.postDomSettings.repliesHidden = !post.postDomSettings.repliesHidden;
        postsRef.current = ({ ...postsRef.current, [post.postId]: post });
        setOrderedPostIds(current => [...current]);
        
        if (!post.postDomSettings.repliesHidden) {
            setOrderedPostIds(current => [...current]);
            setTimeout(() => {
                setNewPostsAdded(repliesToThisPost);
            }, SET_NEW_POSTS_ADDED_DELAY);
        }
    };

    const toggleShowDiscussionHandler = (post: Post, override?: boolean) => {
        post.postDomSettings.repliesHidden = override ?? !post.postDomSettings.repliesHidden;
        postsRef.current = ({ ...postsRef.current, [post.postId]: post });
        setOrderedPostIds(current => [...current]);
    };

    const toggleReplyDiscussionHandler = (post: Post) => {
        toggleShowDiscussionHandler(post, false);
        setDiscussReplyToPostIdHandler(post, post.postId);
    };

    const replyInputOnFocusHandler: FocusEventHandler<HTMLTextAreaElement> = (event) => {
        event.target.rows = 4;
    };

    const replyInputOnBlurHandler: FocusEventHandler<HTMLTextAreaElement> = (event) => {
        if (event.target.value === '') event.target.rows = 1;
    };

    const setDiscussReplyToPostIdHandler = (post: Post, discussReplyToPostId?: string) => {
        post.postDomSettings.discussReplyToPostId = discussReplyToPostId;
        postsRef.current = ({ ...postsRef.current, [post.postId]: post });
        setOrderedPostIds(current => [...current]);

        setTimeout(() => {
            const postTextareaElement = document.getElementById(`post-input-${post.postId}`) as HTMLTextAreaElement;
            postTextareaElement.focus();
        }, SET_NEW_POSTS_ADDED_DELAY);
    };

    return (
        <main className="w-full flex flex-row p-2">
            <div className="flex-1 flex justify-end">
                <div className="w-[288px] min-w-[288px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3"><a href={`https://scan.idena.io/contract/${contractAddressV2}`} target="_blank">idena.social</a></div>
                    <div className="mb-4 text-[14px]">
                        <div className="flex flex-col">
                            <div className="flex flex-row mb-2 gap-1">
                                <p className="w-13 flex-none text-right leading-7">Rpc url:</p>
                                <input className="h-6.5 flex-1 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeUrl} onChange={e => setInputNodeUrl(e.target.value)} />
                            </div>
                            <div className="flex flex-row mb-1 gap-1">
                                <p className="w-13 flex-none text-right leading-7">Api key:</p>
                                <input className="h-6.5 flex-1 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeKey} onChange={e => setInputNodeKey(e.target.value)} />
                            </div>
                            {!nodeAvailable && <p className="ml-14 text-[11px] text-red-400">Node Unavailable. Please try again.</p>}
                        </div>
                        <div className="flex flex-row">
                            <button className={`h-7 w-16 ml-14 mt-1 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputNodeApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputNodeApplied(!inputNodeApplied)}>{inputNodeApplied ? 'Change' : 'Apply!'}</button>
                            {!inputNodeApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[11px]">Apply changes to take effect</p>}
                        </div>
                    </div>
                    <hr className="mb-3 text-gray-500" />
                    <div className="flex flex-col mb-6">
                        <p>For sending transactions:</p>
                        <div className="flex flex-row gap-2">
                            <input id="useRpc" type="radio" name="useRpc" value="rpc" checked={inputSendingTxs === 'rpc'} onChange={handleInputSendingTxsToggle} />
                            <label htmlFor="useRpc" className="flex-none text-right">Use RPC</label>
                        </div>
                        {inputSendingTxs === 'rpc' && viewOnlyNode && <p className="ml-4.5 text-[11px] text-red-400">Your RPC is View-Only. Switch to: Use Idena App for transactions. (Posting is disabled)</p>}
                        <div className="flex flex-row gap-2">
                            <input id="notUseRpc" type="radio" name="useRpc" value="idena-app" checked={inputSendingTxs === 'idena-app'} onChange={handleInputSendingTxsToggle} />
                            <label htmlFor="notUseRpc" className="flex-none text-right">Use Idena App</label>
                        </div>
                        {inputSendingTxs === 'idena-app' && (
                            <div className="flex flex-col ml-5 text-[14px]">
                                <p className="mb-1">Your Idena Address:</p>
                                <input className="flex-1 mb-1 h-6.6 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputPostersAddressApplied} value={inputPostersAddress} onChange={e => setInputPostersAddress(e.target.value)} />
                                {postersAddressInvalid && <p className="text-[11px] text-red-400">Invalid address. (Posting is disabled)</p>}
                                <div className="flex flex-row">
                                    <button className={`w-16 h-7 mt-1 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputPostersAddressApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputPostersAddressApplied(!inputPostersAddressApplied)}>{inputPostersAddressApplied ? 'Change' : 'Apply'}</button>
                                    {!inputPostersAddressApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[12px]">Apply changes to take effect</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <hr className="mb-3 text-gray-500" />
                    <div className="flex flex-col mb-6">
                        <p>For finding past posts:</p>
                        <div className="flex flex-row gap-2">
                            <input id="inputFindingPastPosts" type="radio" name="inputFindingPastPosts" value="rpc" checked={inputFindingPastPosts === 'rpc'} onChange={handleInputFindingPastPostsToggle} />
                            <label htmlFor="inputFindingPastPosts" className="flex-none text-right">Use RPC</label>
                        </div>
                        <div className="flex flex-row gap-2">
                            <input id="notUseFindPastBlocksWithTxsApi" type="radio" name="inputFindingPastPosts" value="indexer-api" checked={inputFindingPastPosts === 'indexer-api'} onChange={handleInputFindingPastPostsToggle} />
                            <label htmlFor="notUseFindPastBlocksWithTxsApi" className="flex-none text-right">Use Indexer Api</label>
                        </div>
                        {inputFindingPastPosts === 'indexer-api' && (
                            <div className="flex flex-col ml-5 text-[14px]">

                                <div className="flex flex-row gap-1">
                                    <p className="mb-1 w-13 flex-none text-right leading-7">Api Url:</p>
                                    <input className="flex-1 mb-1 h-6.6 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputIdenaIndexerApiUrlApplied} value={inputIdenaIndexerApiUrl} onChange={e => setInputIdenaIndexerApiUrl(e.target.value)} />
                                </div>
                                {indexerApiUrlInvalid && <p className="ml-14 text-[11px] text-red-400">Invalid Api Url.</p>}
                                <div className="flex flex-row">
                                    <button className={`w-16 h-7 mt-1 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputIdenaIndexerApiUrlApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputIdenaIndexerApiUrlApplied(!inputIdenaIndexerApiUrlApplied)}>{inputIdenaIndexerApiUrlApplied ? 'Change' : 'Apply'}</button>
                                    {!inputIdenaIndexerApiUrlApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[12px]">Apply changes to take effect</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mb-3">
                        <hr className="text-gray-500" />
                        <p className="my-1 text-[14px] text-gray-500"><a className="hover:underline" href={termsOfServiceUrl} target="_blank">Terms of Service</a></p>
                    </div>
                </div>
            </div>
            <div className="flex-none min-w-[400px] max-w-[400px]">
                <div>
                    <textarea
                        id='post-input-main'
                        rows={4}
                        className="w-full min-h-[104px] rounded-md py-1 px-2 mt-5 outline-1 placeholder:text-gray-500"
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
                    {orderedPostIds.map((postId) => {
                        const post = postsRef.current[postId];
                        const poster = postersRef.current[post.poster];
                        const displayAddress = getDisplayAddress(poster.address);
                        const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
                        const messageLines = getMessageLines(post.message);
                        const postDomSettingsItem = post.postDomSettings;
                        const textOverflows = postDomSettingsItem.textOverflows;
                        const displayViewMore = postDomSettingsItem.textOverflowHidden;
                        const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;
                        const repliesToThisPost = [ ...getChildPostIds(post.postId, replyPostsTreeRef.current).reverse(), ...getChildPostIds(post.postId, deOrphanedReplyPostsTreeRef.current) ];
                        const showReplies = !post.postDomSettings.repliesHidden;
                        const isBreakingChangeDisabled = post.timestamp <= breakingChanges.v5.timestamp;

                        return (
                            <li key={post.postId}>
                                <div className="flex flex-col mb-10 pt-3 rounded-md bg-stone-800">
                                    <div className="flex flex-row">
                                        <div className="w-15 flex-none flex flex-col">
                                            <div className="h-17 flex-none -mt-3">
                                                <img src={`https://robohash.org/${poster.address}?set=set1`} />
                                            </div>
                                            <div className="flex-1"></div>
                                        </div>
                                        <div className="mr-3 flex-1 flex flex-col overflow-hidden">
                                            <div className="flex-none flex flex-col gap-x-3 items-start">
                                                <div><a className="text-[18px] font-[600]" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noreferrer">{displayAddress}</a></div>
                                                <div><p className="text-[11px]/4">{`Age: ${poster.age}, State: ${poster.state}, Stake: ${parseInt(poster.stake)}`}</p></div>
                                                <div className="flex-1"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div id={`post-text-${post.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : postTextHeight} flex-1 px-4 pt-2 pb-1 text-[17px] text-wrap leading-5 overflow-hidden`}>
                                        <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                    </div>
                                    {textOverflows && <div className="px-4 text-[12px]/5 text-blue-400"><a className="hover:underline cursor-pointer" onClick={() => toggleViewMoreHandler(post)}>{displayViewMore ? 'view more' : 'view less'}</a></div>}
                                    <div className="px-2">
                                        <p className="text-[11px]/6 text-stone-500 font-[700] text-right"><a href={`https://scan.idena.io/transaction/${post.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                    </div>
                                    {!isBreakingChangeDisabled && <div className="flex flex-row gap-2 px-2 items-end">
                                        <div className="flex-1">
                                            <textarea
                                                id={`post-input-${post.postId}`}
                                                rows={1}
                                                className="w-full min-h-[32px] rounded-sm py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500"
                                                placeholder="Write your reply here..."
                                                disabled={inputPostDisabled}
                                                onFocus={replyInputOnFocusHandler}
                                                onBlur={replyInputOnBlurHandler}
                                            />
                                        </div>
                                        <div>
                                            <button className="h-9 w-17 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler(post.postId, post.postId)}>{submittingPost === post.postId ? '...' : 'Post!'}</button>
                                        </div>
                                    </div>}
                                    <div className="px-4 mb-1.5 text-[12px]">
                                        {repliesToThisPost.length ?
                                            <a className="-mt-2 text-blue-400 hover:underline cursor-pointer" onClick={() => toggleShowRepliesHandler(post, repliesToThisPost)}>{showReplies ? 'hide replies' : `show replies (${repliesToThisPost.length})`}</a>
                                        :
                                            <span className="-mt-2 text-gray-500">no replies</span>
                                        }
                                    </div>
                                    {showReplies && <div className="mt-1">
                                        <ul>
                                            {repliesToThisPost.map((replyPostId, index) => {
                                                const replyPost = postsRef.current[replyPostId];
                                                const poster = postersRef.current[replyPost.poster];
                                                const displayAddress = getDisplayAddress(poster.address);
                                                const { displayDate, displayTime } = getDisplayDateTime(replyPost.timestamp);
                                                const messageLines = getMessageLines(replyPost.message);
                                                const postDomSettingsItem = replyPost.postDomSettings;
                                                const textOverflows = postDomSettingsItem.textOverflows;
                                                const displayViewMore = postDomSettingsItem.textOverflowHidden;
                                                const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;
                                                const showDiscussion = !replyPost.postDomSettings.repliesHidden;
                                                const discussParentId = discussPrefix + replyPost.postId;
                                                const discussionPosts = [ ...getChildPostIds(discussParentId, deOrphanedReplyPostsTreeRef.current).reverse(), ...getChildPostIds(discussParentId, replyPostsTreeRef.current) ].reverse(); // reverse for flex-col-reverse
                                                const discussReplyToPostId = replyPost.postDomSettings.discussReplyToPostId;
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
                                                                            <a className="text-[16px] font-[600]" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noreferrer">{displayAddress}</a>
                                                                            <span className="ml-2 text-[11px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                                                        </div>
                                                                        <div className="flex-1"></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div id={`post-text-${replyPost.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : replyPostTextHeight} flex-1 pl-12 pr-4 pt-2 pb-1 text-[14px] text-wrap leading-5 overflow-hidden`}>
                                                                <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                                            </div>
                                                            {textOverflows && <div className="px-12 text-[12px]/5 text-blue-400"><a className="hover:underline cursor-pointer" onClick={() => toggleViewMoreHandler(replyPost)}>{displayViewMore ? 'view more' : 'view less'}</a></div>}
                                                            <div className="w-full px-2 flex flex-row justify-end">
                                                                {!isBreakingChangeDisabled && <>
                                                                    <div className="mt-0.5 w-36 text-[12px]">
                                                                        {discussionPosts.length || showDiscussion ?
                                                                            <a className="text-blue-400 hover:underline cursor-pointer" onClick={() => toggleShowDiscussionHandler(replyPost)}>{showDiscussion ? 'hide discussion' : `show discussion (${discussionPosts.length})`}</a>
                                                                        :
                                                                            <span className="text-gray-500">no discussion</span>
                                                                        }
                                                                    </div>
                                                                    <div className="-mt-0.5 flex-1"><button className="text-[11px] h-4 w-14 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => toggleReplyDiscussionHandler(replyPost)}>Reply</button></div>
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
                                                                                        <div className="ml-1 mr-3 flex-1 flex flex-col overflow-hidden">
                                                                                            <div className="flex-none flex flex-col gap-x-3">
                                                                                                <div className="flex flex-row items-center">
                                                                                                    <div className="flex-1">
                                                                                                        <a className="text-[14px] font-[600]" href={`https://scan.idena.io/address/${poster.address}`} target="_blank" rel="noreferrer">{displayAddress}</a>
                                                                                                        <span className="ml-2 text-[9px] align-[2px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="ml-2 text-[10px] text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${replyPost.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex-1"></div>
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
                                                                <div className="flex flex-row gap-2 items-end">
                                                                    <div className="flex-1">
                                                                        <textarea
                                                                            id={`post-input-${replyPost.postId}`}
                                                                            rows={1}
                                                                            className="w-full min-h-[26px] rounded-sm py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500 text-[12px]"
                                                                            placeholder="Comment here..."
                                                                            disabled={inputPostDisabled}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <button className="h-7.5 w-16 my-1 px-4 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler(replyPost.postId, discussReplyToPostId, discussParentId)}>{submittingPost === replyPost.postId ? '...' : 'Post!'}</button>
                                                                    </div>
                                                                </div>
                                                            </div>}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex flex-col gap-2 mb-15">
                    <button className={`h-9 mt-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 ${scanningPastBlocks || noMorePastBlocks ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={scanningPastBlocks || noMorePastBlocks || !nodeAvailable} onClick={() => setScanningPastBlocks(true)}>
                        {scanningPastBlocks ? "Scanning blockchain...." : (noMorePastBlocks ? "No more past posts" : "Scan for more posts")}
                    </button>
                    <p className="pr-12 text-gray-400 text-[12px] text-center">
                        {!scanningPastBlocks ? <>Posts found down to Block # <span className="absolute">{pastBlockCaptured || 'unavailable'}</span></> : <>&nbsp;</>}
                    </p>
                </div>
            </div>
            <div className="flex-1 flex justify-start">
                <div className="w-[288px] min-w-[288px] mt-3 mr-2 ml-8 flex flex-col text-[13px]">
                    <div className="flex flex-col h-[90px] justify-center">
                        <div className="px-1 font-[700] text-gray-400"><p>{currentAd?.title ?? defaultAd.title}</p></div>
                        <div className="px-1"><p>{currentAd?.desc ?? defaultAd.desc}</p></div>
                        <div className="px-1 text-blue-400"><a className="hover:underline" href={currentAd?.url ?? defaultAd.url} target="_blank">{currentAd?.url ?? defaultAd.url}</a></div>
                    </div>
                    <div className="my-3 h-[320px] w-[320px]"><a href={currentAd?.url ?? defaultAd.url} target="_blank"><img className="rounded-md" src={currentAd?.media ?? defaultAd.media} /></a></div>
                    <div className="flex flex-row px-1">
                        <div className="w-16 flex-auto">
                            <div className="font-[600] text-gray-400"><p>Sponsored by</p></div>
                            <div><a className="flex flex-row items-center" href={`https://scan.idena.io/address/${currentAd?.author}`} target="_blank"><img className="-mt-0.5 -ml-1.5 h-5 w-5" src={`https://robohash.org/${currentAd?.author}?set=set1`} /><span>{getDisplayAddress(currentAd?.author || '')}</span></a></div>
                        </div>
                        <div className="flex-1" />
                        <div className="w-16 flex-auto">
                            <div className="font-[600] text-gray-400"><p>Burnt, in 24 hr</p></div>
                            <div><p>{currentAd?.burnAmount} iDNA</p></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default App;
