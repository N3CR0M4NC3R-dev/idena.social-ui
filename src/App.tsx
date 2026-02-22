import { useEffect, useRef, useState } from 'react';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { type Post, type Poster, breakingChanges, getNewPosterAndPost, getReplyPosts, deOrphanReplyPosts, getTransactionDetails, getBlockHeightFromTxHash, submitPost } from './logic/asyncUtils';
import { getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient } from './logic/api';
import { getDisplayAddress, isObjectEmpty } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';
import { Link, Outlet } from 'react-router';
import type { PostDomSettingsCollection } from './App.exports';

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
const defaultAd = {
    title: 'IDENA: Proof-of-Person blockchain',
    desc: 'Coordination of individuals',
    url: 'https://idena.io',
    thumb: '',
    media: WhatIsIdenaPng,
};

const POLLING_INTERVAL = 5000;
const SCANNING_INTERVAL = 10;
const ADS_INTERVAL = 10000;
const SCAN_POSTS_TTL = 1 * 60;
const INDEXER_API_ITEMS_LIMIT = 10;
const SET_NEW_POSTS_ADDED_DELAY = 20;
const SUBMITTING_POST_INTERVAL = 2000;


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
    const [inputPostersAddress, setInputPostersAddress] = useState<string>(zeroAddress);
    const [inputPostersAddressApplied, setInputPostersAddressApplied] = useState<boolean>(true);
    const [inputNodeUrl, setInputNodeUrl] = useState<string>(defaultNodeUrl);
    const [inputNodeKey, setInputNodeKey] = useState<string>(defaultNodeApiKey);
    const [postersAddress, setPostersAddress] = useState<string>(zeroAddress);
    const [postersAddressInvalid, setPostersAddressInvalid] = useState<boolean>(false);
    const [inputSendingTxs, setInputSendingTxs] = useState<string>('idena-app');
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
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const browserStateHistoryRef = useRef<Record<string, PostDomSettingsCollection>>({});

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

        await submitPost(postersAddress, contractAddressV2, makePostMethod, inputText, replyToPostId ?? null, channelId ?? null, inputSendingTxs, rpcClientRef.current!, callbackUrl);
    };

    return (
        <main className="w-full flex flex-row p-2">
            <div className="flex-1 flex justify-end">
                <div className="w-[288px] min-w-[288px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3">
                        <Link to="/">idena.social</Link>
                    </div>
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
            <div className="flex-none min-w-[430px] max-w-[430px]">
                <Outlet
                    context={{
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
                        browserStateHistoryRef,
                    }}
                />
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
