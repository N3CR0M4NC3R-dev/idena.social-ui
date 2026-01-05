import { useEffect, useRef, useState, type FocusEventHandler } from 'react';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { getNewPostersAndPosts, getChildPostIds, submitPost, type Post, type Poster } from './logic/asyncUtils';
import { getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient } from './logic/api';
import { getDisplayAddress, getDisplayDateTime, getMessageLines } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';

const idenaNodeUrl = 'https://restricted.idena.io';
const idenaNodeApiKey = 'idena-restricted-node-key';
const initIdenaIndexerApiUrl = 'https://api.idena.io';
const contractAddress = '0x8d318630eB62A032d2f8073d74f05cbF7c6C87Ae';
const firstBlock = 10135627;
const makePostMethod = 'makePost';
const thisChannelId = '';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const callbackUrl = `${window.location.origin}/confirm-tx.html`;
const termsOfServiceUrl = `${window.location.origin}/terms-of-service.html`;
const defaultAdUrl = 'https://idena.io';
const defaultAdImage = WhatIsIdenaPng;
const defaultAdTitle = 'IDENA: Proof-of-Person blockchain';
const defaultAdDesc = 'Coordination of individuals';
const postTextHeight = 'max-h-[288px]';
const replyPostTextHeight = 'max-h-[146px]';

const POLLING_INTERVAL = 5000;
const SCANNING_INTERVAL = 10;
const SUBMITTING_POST_INTERVAL = 2000;
const ADS_INTERVAL = 10000;
const SCAN_POSTS_TTL = 1 * 60;
const INDEXER_ITEMS_LIMIT = 100;

const DEBUG = false;

if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

function App() {
    const [rpcClient, setRpcClient] = useState<RpcClient>(() => getRpcClient({ idenaNodeUrl, idenaNodeApiKey }));
    const rpcClientRef = useRef(rpcClient);
    const [viewOnlyNode, setViewOnlyNode] = useState<boolean>(false);
    const [inputNodeApplied, setInputNodeApplied] = useState<boolean>(true);
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const [inputPostersAddress, setInputPostersAddress] = useState<string>(zeroAddress);
    const [inputPostersAddressApplied, setInputPostersAddressApplied] = useState<boolean>(true);
    const [inputNodeUrl, setInputNodeUrl] = useState<string>(idenaNodeUrl);
    const [inputNodeKey, setInputNodeKey] = useState<string>(idenaNodeApiKey);
    const [postersAddress, setPostersAddress] = useState<string>(zeroAddress);
    const [postersAddressInvalid, setPostersAddressInvalid] = useState<boolean>(false);
    const [inputUseRpc, setInputUseRpc] = useState<boolean>(false);
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [orderedPostIds, setOrderedPostIds] = useState<string[]>([]);
    const [posts, setPosts] = useState<Record<string, Post>>({});
    const postsRef = useRef(posts);
    const [posters, setPosters] = useState<Record<string, Poster>>({});
    const postersRef = useRef(posters);
    const [newPostsAdded, setNewPostsAdded] = useState<string[]>([]);
    const [initialBlock, setInitialBlock] = useState<number>(0);
    const [pastBlockCaptured, setPastBlockCaptured] = useState<number>(0);
    const pastBlockCapturedRef = useRef(pastBlockCaptured);
    const [partialPastBlockCaptured, setPartialPastBlockCaptured] = useState<number>(0);
    const partialPastBlockCapturedRef = useRef(partialPastBlockCaptured);
    const [currentBlockCaptured, setCurrentBlockCaptured] = useState<number>(0);
    const currentBlockCapturedRef = useRef(currentBlockCaptured);
    const [scanningPastBlocks, setScanningPastBlocks] = useState<boolean>(true);
    const [ads, setAds] = useState<ApprovedAd[]>([]);
    const [currentAd, setCurrentAd] = useState<ApprovedAd | null>(null);
    const currentAdRef = useRef(currentAd);
    const [useFindPastBlocksWithTxsApi, setUseFindPastBlocksWithTxsApi] = useState<boolean>(true);
    const useFindPastBlocksWithTxsApiRef = useRef(useFindPastBlocksWithTxsApi);
    const [noMorePastBlocks, setNoMorePastBlocks] = useState<boolean>(false);
    const [idenaIndexerApiUrl, setIdenaIndexerApiUrl] = useState<string>(initIdenaIndexerApiUrl);
    const idenaIndexerApiUrlRef = useRef(idenaIndexerApiUrl);
    const [idenaIndexerApiUrlInvalid, setIdenaIndexerApiUrlInvalid] = useState<boolean>(false);
    const idenaIndexerApiUrlInvalidRef = useRef(idenaIndexerApiUrlInvalid);
    const [inputIdenaIndexerApiUrl, setInputIdenaIndexerApiUrl] = useState<string>(initIdenaIndexerApiUrl);
    const [inputIdenaIndexerApiUrlApplied, setInputIdenaIndexerApiUrlApplied] = useState<boolean>(true);
    const [replyPostsTree, setReplyPostsTree] = useState<Record<string, string>>({});
    const replyPostsTreeRef = useRef(replyPostsTree);
    const [orphanedReplyPostsTree, setOrphanedReplyPostsTree] = useState<Record<string, string>>({});
    const orphanedReplyPostsTreeRef = useRef(orphanedReplyPostsTree);
    const [continuationToken, setContinuationToken] = useState<string | undefined>();
    const continuationTokenRef = useRef(continuationToken);


    useEffect(() => {
        (async function() {
            try {
                const { result: getLastBlockResult } = await rpcClient('bcn_lastBlock', []);
                setInitialBlock(getLastBlockResult.height);
            } catch (error) {
                console.error(error);
            }
        })();
    }, []);

    useEffect(() => {
        if (inputNodeApplied) {
            setRpcClient(() => getRpcClient({ idenaNodeUrl: inputNodeUrl, idenaNodeApiKey: inputNodeKey }));
        }
    }, [inputNodeApplied]);

    useEffect(() => {
        (async function() {
            const { result: syncingResult } = await rpcClient('bcn_syncing', []);

            if (!syncingResult) {
                alert('Your node has an issue! Please check if you typed in the correct details.');
            }
            if (syncingResult.syncing) {
                alert('Your node is still syncing! Please try again after syncing has completed.');
            }

            const { result: getCoinbaseAddrResult } = await rpcClient('dna_getCoinbaseAddr', []);

            if (getCoinbaseAddrResult) {
                setPostersAddress(getCoinbaseAddrResult);
                setViewOnlyNode(false);
            } else {
                setPostersAddress('');
                setViewOnlyNode(true);
            }

            const adsClient = new IdenaApprovedAds({ idenaNodeUrl, idenaNodeApiKey });

            try {
                const ads = await adsClient.getApprovedAds();
                setAds(ads);
            } catch (error) {
                console.error(error);
                setAds([]);
            }

        })();
    }, [rpcClient]);

    useEffect(() => {
        if (inputPostersAddressApplied && !inputUseRpc) {
            setPostersAddress(inputPostersAddress);

            if (inputPostersAddress === zeroAddress) {
                setPostersAddressInvalid(true);
            } else {
                (async function() {
                    const { result: getBalanceResult } = await rpcClient('dna_getBalance', [inputPostersAddress]);

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
        if (inputIdenaIndexerApiUrlApplied && useFindPastBlocksWithTxsApi) {
            setIdenaIndexerApiUrl(inputIdenaIndexerApiUrl);

            (async function() {
                const { result } = await getPastTxsWithIdenaIndexerApi(inputIdenaIndexerApiUrl, contractAddress, 1);

                if (result.length === 1 && result[0].address === contractAddress) {
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
        setOrderedPostIds(current => [...current]);
    }, [replyPostsTree]);

    useEffect(() => {
        rpcClientRef.current = rpcClient;
    }, [rpcClient]);

    useEffect(() => {
        currentBlockCapturedRef.current = currentBlockCaptured;
    }, [currentBlockCaptured]);

    useEffect(() => {
        pastBlockCapturedRef.current = pastBlockCaptured;
    }, [pastBlockCaptured]);

    useEffect(() => {
        partialPastBlockCapturedRef.current = partialPastBlockCaptured;
    }, [partialPastBlockCaptured]);

    useEffect(() => {
        postsRef.current = posts;
    }, [posts]);

    useEffect(() => {
        postersRef.current = posters;
    }, [posters]);

    useEffect(() => {
        currentAdRef.current = currentAd;
    }, [currentAd]);

    useEffect(() => {
        useFindPastBlocksWithTxsApiRef.current = useFindPastBlocksWithTxsApi;
    }, [useFindPastBlocksWithTxsApi]);

    useEffect(() => {
        idenaIndexerApiUrlRef.current = idenaIndexerApiUrl;
    }, [idenaIndexerApiUrl]);

    useEffect(() => {
        idenaIndexerApiUrlInvalidRef.current = idenaIndexerApiUrlInvalid;
    }, [idenaIndexerApiUrlInvalid]);

    useEffect(() => {
        replyPostsTreeRef.current = replyPostsTree;
    }, [replyPostsTree]);

    useEffect(() => {
        orphanedReplyPostsTreeRef.current = orphanedReplyPostsTree;
    }, [orphanedReplyPostsTree]);

    useEffect(() => {
        continuationTokenRef.current = continuationToken;
    }, [continuationToken]);

    type RecurseForward = () => Promise<void>;
    useEffect(() => {
        if (initialBlock) {
            setScanningPastBlocks(true);

            let recurseForwardIntervalId: NodeJS.Timeout;

            (async function recurseForward() {
                recurseForwardIntervalId = setTimeout(postScannerFactory(true, recurseForward, currentBlockCapturedRef, setCurrentBlockCaptured), POLLING_INTERVAL);
            } as RecurseForward)();

            return () => clearInterval(recurseForwardIntervalId);
        }
    }, [initialBlock]);

    type RecurseBackward = (time: number) => Promise<void>;
    useEffect(() => {
        if (scanningPastBlocks) {
            let recurseBackwardIntervalId: NodeJS.Timeout;

            const timeNow = Math.floor(Date.now() / 1000);
            const ttl = timeNow + SCAN_POSTS_TTL;

            (async function recurseBackward(time: number) {
                if (time < ttl) {
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(false, recurseBackward, pastBlockCapturedRef, setPastBlockCaptured, continuationTokenRef), SCANNING_INTERVAL);
                } else {
                    setScanningPastBlocks(false);
                }
            } as RecurseBackward)(timeNow);

            return () => clearInterval(recurseBackwardIntervalId);
        }
    }, [scanningPastBlocks]);

    useEffect(() => {
        const updatedPosts: Record<string, Post> = {};

        for (let index = 0; index < newPostsAdded.length; index++) {
            const key = newPostsAdded[index];
            const post = posts[key];
            const messageDiv = document.getElementById(`post-text-${post.postId}`);

            if (messageDiv!.scrollHeight > messageDiv!.clientHeight) {
                updatedPosts[post.postId] = { ...post, postDomSettings: { ...post.postDomSettings, textOverflows: true } };
            }
        }

        setPosts(currentPosts => ({ ...currentPosts, ...updatedPosts }));

    }, [newPostsAdded]);

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
        setInputPostDisabled(!!submittingPost || (inputUseRpc && viewOnlyNode) || postersAddressInvalid);
    }, [submittingPost, inputUseRpc, viewOnlyNode, postersAddressInvalid]);

    const submitPostHandler = async (postId: string) => {
        const postTextareaElement = document.getElementById(`post-input-${postId}`) as HTMLTextAreaElement;
        const inputText = postTextareaElement.value;

        if (inputText) {
            postTextareaElement.value = '';
        } else {
            return;
        }

        let replyToPostId = postId !== 'main' ? postId : null;

        if (replyToPostId) {
            postTextareaElement.rows = 1;
        }

        setSubmittingPost(postId);
        await submitPost(postersAddress, contractAddress, makePostMethod, inputText, replyToPostId, inputUseRpc, rpcClient, callbackUrl);
    };

    const handleUseRpcToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        const useRpc = (event.target.value === 'true');
        setInputUseRpc(useRpc);

        if (useRpc) {
            setInputPostersAddress('');
            setPostersAddressInvalid(false);
            setRpcClient(() => getRpcClient({ idenaNodeUrl: inputNodeUrl, idenaNodeApiKey: inputNodeKey }));
        } else {
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

    const handleUseFindPastBlocksWithTxsApiToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        const useFindPastBlocksWithTxsApi = event.target.checked;
        setUseFindPastBlocksWithTxsApi(useFindPastBlocksWithTxsApi);

        if (!useFindPastBlocksWithTxsApi) {
            setIdenaIndexerApiUrl('');
            setIdenaIndexerApiUrlInvalid(false);
        } else {
            if (idenaIndexerApiUrl) {
                setIdenaIndexerApiUrl(idenaIndexerApiUrl);
                setPostersAddressInvalid(false);
            } else {
                setInputIdenaIndexerApiUrl(initIdenaIndexerApiUrl);
                setIdenaIndexerApiUrl(initIdenaIndexerApiUrl);
            }
        }
    };

    const postScannerFactory = (recurseForward: boolean, recurse: RecurseForward | RecurseBackward, blockCapturedRef: React.RefObject<number>, setBlockCaptured: React.Dispatch<React.SetStateAction<number>>, continuationTokenRef?: React.RefObject<string | undefined>) => {
        return async function postFinder() {
            try {
                let pendingBlock: number;
                let transactions: string[] = [];

                const recurseBackwardWithoutIndexer = !recurseForward && !useFindPastBlocksWithTxsApiRef.current;
                const getTransactionsIncrementally = recurseForward || recurseBackwardWithoutIndexer;

                if (getTransactionsIncrementally) {
                    pendingBlock = recurseForward ? (blockCapturedRef.current ? blockCapturedRef.current + 1 : initialBlock) : (blockCapturedRef.current ? (partialPastBlockCapturedRef.current ? partialPastBlockCapturedRef.current : blockCapturedRef.current - 1) : initialBlock - 1);

                    const { result: getBlockByHeightResult } = await rpcClientRef.current('bcn_blockAt', [pendingBlock]);

                    if (getBlockByHeightResult === null) {
                        throw 'no block';
                    }
                    
                    if (getBlockByHeightResult.transactions === null) {
                        setBlockCaptured(pendingBlock);
                        throw 'no transactions';
                    }

                    transactions = [ ...getBlockByHeightResult.transactions ];
                } else {
                    if (continuationTokenRef!.current === 'finished processing') {
                        throw 'no more transactions';
                    }
                    const responseBody = await getPastTxsWithIdenaIndexerApi(inputIdenaIndexerApiUrl, contractAddress, INDEXER_ITEMS_LIMIT, continuationTokenRef!.current);
                    setContinuationToken(responseBody.continuationToken ?? 'finished processing');

                    transactions = responseBody.result
                        ?.filter((balanceUpdate: any) => balanceUpdate.type === 'CallContract' && balanceUpdate.txReceipt.method === 'makePost' && balanceUpdate.txReceipt.success === true)
                        .map((balanceUpdate: any) => balanceUpdate.hash)
                    ?? [];
                }

                for (let index = 0; index < transactions.length; index++) {
                    const { newPosters, newOrderedPostIds, newPosts, newReplyPosts, newOrphanedReplyPosts, lastBlockHash, continued } = await getNewPostersAndPosts(
                        transactions[index],
                        contractAddress,
                        makePostMethod,
                        thisChannelId,
                        rpcClientRef,
                        postsRef,
                        postersRef,
                        replyPostsTreeRef,
                        orphanedReplyPostsTreeRef,
                    );

                    if (continued) {
                        continue;
                    }

                    setPosters((currentPosters) => ({ ...currentPosters, ...newPosters }));
                    setPosts((currentPosts) => ({ ...currentPosts, ...newPosts }));
                    setReplyPostsTree((currentReplyPosts) => ({ ...currentReplyPosts, ...newReplyPosts }));
                    setOrphanedReplyPostsTree((currentOrphanedReplyPosts) => ({ ...currentOrphanedReplyPosts, ...newOrphanedReplyPosts }));
                    setOrderedPostIds((currentOrderedPostIds) => recurseForward ? [...newOrderedPostIds!, ...currentOrderedPostIds] : [...currentOrderedPostIds, ...newOrderedPostIds!]);
                    setNewPostsAdded(newOrderedPostIds!);
                    
                    let lastBlockHeight;

                    if (getTransactionsIncrementally) {
                        lastBlockHeight = pendingBlock!;
                        setPartialPastBlockCaptured(0);
                        setBlockCaptured(lastBlockHeight);
                    }
                    
                    const lastIteration = index === transactions.length - 1;
                    if (!getTransactionsIncrementally && lastIteration) {
                        const { result: getBlockByHashResult } = await rpcClientRef.current('bcn_block', [lastBlockHash]);
                        lastBlockHeight = getBlockByHashResult.height;
                        setPartialPastBlockCaptured(lastBlockHeight);
                        setBlockCaptured(lastBlockHeight);
                    }

                    if (!recurseForward && lastBlockHeight <= firstBlock) {
                        throw 'no more transactions';
                    }
                }

                if (recurseForward) {
                    (recurse as RecurseForward)();
                } else {
                    (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                }
            } catch(error) {
                console.error(error);
                if (!recurseForward && error === 'no more transactions') {
                    setNoMorePastBlocks(true);
                    setScanningPastBlocks(false);
                } else {
                    if (recurseForward) {
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
        setPosts(currentPosts => ({ ...currentPosts, [post.postId]: post }));

        if (post.postDomSettings.textOverflowHidden) {
            const messageDiv = document.getElementById(`post-text-${post.postId}`);
            const isReply = !!post.replyToPostId;
            const rawTextHeight = isReply ? replyPostTextHeight : postTextHeight;
            const textHeightNumber = parseInt(rawTextHeight.split('max-h-[')[1].split('px]')[0]);
            const adjustheight = messageDiv!.scrollHeight - textHeightNumber;
            window.scrollBy({ top: -adjustheight });
        }
    };

    const toggleShowRepliesHandler = (post: Post) => {
        post.postDomSettings.repliesHidden = !post.postDomSettings.repliesHidden;
        setPosts(currentPosts => ({ ...currentPosts, [post.postId]: post }));

        if (!post.postDomSettings.repliesHidden) {
            const repliesToThisPost = getChildPostIds(post.postId, replyPostsTree);
            setTimeout(() => {
                setNewPostsAdded(repliesToThisPost);
            }, 0);
        }
    };

    const replyInputOnFocusHandler: FocusEventHandler<HTMLTextAreaElement> = (event) => {
        event.target.rows = 4;
    };

    const replyInputOnBlurHandler: FocusEventHandler<HTMLTextAreaElement> = (event) => {
        if (event.target.value === '') event.target.rows = 1;
    };

    return (
        <main className="w-full flex flex-row p-2">
            <div className="flex-1 justify-items-end">
                <div className="w-[288px] min-w-[288px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3"><a href={`https://scan.idena.io/contract/${contractAddress}`} target="_blank">idena.social</a></div>
                    <div className="mb-4 text-[14px]">
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-row gap-1">
                                <p className="w-13 flex-none text-right leading-7">Rpc url:</p>
                                <input className="h-6.5 flex-1 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeUrl} onChange={e => setInputNodeUrl(e.target.value)} />
                            </div>
                            <div className="flex flex-row gap-1">
                                <p className="w-13 flex-none text-right leading-7">Api key:</p>
                                <input className="h-6.5 flex-1 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeKey} onChange={e => setInputNodeKey(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex flex-row">
                            <button className={`h-7 w-16 ml-14 mt-1.5 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputNodeApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputNodeApplied(!inputNodeApplied)}>{inputNodeApplied ? 'Change' : 'Apply!'}</button>
                            {!inputNodeApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[11px]">Apply changes to take effect</p>}
                        </div>
                    </div>
                    <div className="flex flex-col mb-6">
                        <div className="flex flex-row gap-2">
                            <input id="useRpc" type="radio" name="useRpc" value="true" checked={inputUseRpc === true} onChange={handleUseRpcToggle} />
                            <label htmlFor="useRpc" className="flex-none text-right">Use RPC for transactions</label>
                        </div>
                        {inputUseRpc && viewOnlyNode && <p className="ml-4.5 text-[11px] text-red-400">Your RPC is View-Only. Switch to: Use Idena App for transactions. (Posting is disabled)</p>}
                        <div className="flex flex-row gap-2">
                            <input id="notUseRpc" type="radio" name="useRpc" value="false" checked={inputUseRpc === false} onChange={handleUseRpcToggle} />
                            <label htmlFor="notUseRpc" className="flex-none text-right">Use Idena App for transactions</label>
                        </div>
                        {!inputUseRpc && (
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
                    <div>
                        <div>
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="checkbox" value="" className="sr-only peer" checked={useFindPastBlocksWithTxsApi} onChange={handleUseFindPastBlocksWithTxsApiToggle} />
                                <div className={`relative w-9 h-5 bg-neutral-quaternary peer-focus:outline-none peer-focus:ring-brand-soft dark:peer-focus:ring-brand-soft rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-buffer after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand ${useFindPastBlocksWithTxsApi ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                                <span className="select-none ms-3 text-sm font-medium text-heading">Scan past txs with indexer api</span>
                            </label>
                        </div>
                        {useFindPastBlocksWithTxsApi && (
                            <div className="flex flex-col ml-5 text-[14px]">

                                <div className="flex flex-row gap-1">
                                    <p className="mb-1 w-13 flex-none text-right leading-7">Api Url:</p>
                                    <input className="flex-1 mb-1 h-6.6 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputIdenaIndexerApiUrlApplied} value={inputIdenaIndexerApiUrl} onChange={e => setInputIdenaIndexerApiUrl(e.target.value)} />
                                </div>
                                {idenaIndexerApiUrlInvalid && <p className="ml-14 text-[11px] text-red-400">Invalid Api Url.</p>}
                                <div className="flex flex-row">
                                    <button className={`w-16 h-7 mt-1 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputIdenaIndexerApiUrlApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputIdenaIndexerApiUrlApplied(!inputIdenaIndexerApiUrlApplied)}>{inputIdenaIndexerApiUrlApplied ? 'Change' : 'Apply'}</button>
                                    {!inputIdenaIndexerApiUrlApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[12px]">Apply changes to take effect</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="my-7 text-[14px] text-gray-500">
                        <hr />
                        <p className="my-1"><a className="hover:underline" href={termsOfServiceUrl} target="_blank">Terms of Service</a></p>
                    </div>
                </div>
            </div>
            <div className="flex-none min-w-[400px] max-w-[400px]">
                <div>
                    <textarea
                        id='post-input-main'
                        rows={4}
                        className="w-full rounded-md py-1 px-2 mt-5 outline-1 placeholder:text-gray-500"
                        placeholder="Write your post here..."
                        disabled={inputPostDisabled}
                    />
                    <div className="flex flex-row gap-2">
                        <button className="h-9 w-27 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler('main')}>{submittingPost === 'main' ? 'Posting...' : 'Post!'}</button>
                        <p className="mt-1.5 text-gray-400 text-[12px]">Your post will take time to display due to blockchain acceptance.</p>
                    </div>
                </div>
                <div className="text-center my-3">
                    <p className="text-center">Current Block: #{currentBlockCaptured ? currentBlockCaptured : 'Loading...'}</p>
                </div>
                <ul>
                    {orderedPostIds.map((postId) => {
                        const post = posts[postId];
                        const poster = posters[post.poster];
                        const displayAddress = getDisplayAddress(poster.address);
                        const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
                        const messageLines = getMessageLines(post.message);
                        const postDomSettingsItem = post.postDomSettings;
                        const textOverflows = postDomSettingsItem.textOverflows;
                        const displayViewMore = postDomSettingsItem.textOverflowHidden;
                        const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;
                        const repliesToThisPost = getChildPostIds(post.postId, replyPostsTree);
                        const showReplies = !post.postDomSettings.repliesHidden;

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
                                    <div id={`post-text-${post.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : postTextHeight} flex-1 px-4 py-2 text-[17px] text-wrap leading-5 overflow-hidden`}>
                                        <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                    </div>
                                    {textOverflows && <div className="px-4 text-[12px]/5 text-blue-400"><a className="hover:underline cursor-pointer" onClick={() => toggleViewMoreHandler(post)}>{displayViewMore ? 'view more' : 'view less'}</a></div>}
                                    <div className="py-1 px-2">
                                        <p className="text-[11px]/6 text-stone-500 font-[700] text-right"><a href={`https://scan.idena.io/transaction/${post.transaction}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                    </div>
                                    <div className="flex flex-row gap-2 px-2 items-end">
                                        <div className="flex-1">
                                            <textarea
                                                id={`post-input-${post.postId}`}
                                                rows={1}
                                                className="w-full rounded-sm py-1 px-2 outline-1 bg-stone-900 placeholder:text-gray-500"
                                                placeholder="Write your reply here..."
                                                disabled={inputPostDisabled}
                                                onFocus={replyInputOnFocusHandler}
                                                onBlur={replyInputOnBlurHandler}
                                            />
                                        </div>
                                        <div>
                                            <button className="h-9 w-17 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" disabled={inputPostDisabled} onClick={() => submitPostHandler(post.postId)}>{submittingPost === post.postId ? '...' : 'Post!'}</button>
                                        </div>
                                    </div>
                                    <div className="px-4 mb-1.5 text-[12px]">
                                        {repliesToThisPost.length ?
                                            <a className="-mt-2 text-blue-400 hover:underline cursor-pointer" onClick={() => toggleShowRepliesHandler(post)}>{showReplies ? 'hide replies' : `show replies (${repliesToThisPost.length})`}</a>
                                        :
                                            <span className="-mt-2 text-gray-500">no replies</span>
                                        }
                                    </div>
                                    {showReplies && <div className="mt-1">
                                        <ul>
                                            {repliesToThisPost.map((replyPostId, index) => {
                                                const replyPost = posts[replyPostId];
                                                const poster = posters[replyPost.poster];
                                                const displayAddress = getDisplayAddress(poster.address);
                                                const { displayDate, displayTime } = getDisplayDateTime(replyPost.timestamp);
                                                const messageLines = getMessageLines(replyPost.message);
                                                const postDomSettingsItem = replyPost.postDomSettings;
                                                const textOverflows = postDomSettingsItem.textOverflows;
                                                const displayViewMore = postDomSettingsItem.textOverflowHidden;
                                                const showOverflowPostText = postDomSettingsItem.textOverflows === true && postDomSettingsItem.textOverflowHidden === false;

                                                return (
                                                    <li key={replyPost.postId}>
                                                        {index !== 0 && <hr className="mx-2 text-gray-700" />}
                                                        <div className="mt-1.5 flex flex-col">
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
                                                            <div id={`post-text-${replyPost.postId}`} className={`${showOverflowPostText ? 'max-h-[9999px]' : replyPostTextHeight} flex-1 pl-12 pr-4 py-2 text-[14px] text-wrap leading-5 overflow-hidden`}>
                                                                <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                                            </div>
                                                            {textOverflows && <div className="px-12 text-[12px]/5 text-blue-400"><a className="hover:underline cursor-pointer" onClick={() => toggleViewMoreHandler(replyPost)}>{displayViewMore ? 'view more' : 'view less'}</a></div>}
                                                            <div className="py-1 px-2">
                                                                <p className="text-[11px]/6 text-stone-500 font-[700] text-right"><a href={`https://scan.idena.io/transaction/${replyPost.transaction}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                                                            </div>
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
                    <button className={`h-9 mt-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 ${scanningPastBlocks || noMorePastBlocks ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={scanningPastBlocks || noMorePastBlocks} onClick={() => setScanningPastBlocks(true)}>
                        {scanningPastBlocks ? "Scanning blockchain...." : noMorePastBlocks ? "No more past posts" : "Scan for more posts"}
                    </button>
                    {!scanningPastBlocks && <p className="pr-12 text-gray-400 text-[12px] text-center">Posts found down to Block # <span className="absolute">{pastBlockCaptured}</span></p>}
                </div>
            </div>
            <div className="flex-1 justify-items-start">
                <div className="w-[288px] min-w-[288px] mt-3 mr-2 ml-8 flex flex-col text-[13px]">
                    <div className="flex flex-col h-[90px] justify-center">
                        <div className="px-1 font-[700] text-gray-400"><p>{currentAd?.title ?? defaultAdTitle}</p></div>
                        <div className="px-1"><p>{currentAd?.desc ?? defaultAdDesc}</p></div>
                        <div className="px-1 text-blue-400"><a className="hover:underline" href={currentAd?.url ?? defaultAdUrl} target="_blank">{currentAd?.url ?? defaultAdUrl}</a></div>
                    </div>
                    <div className="my-3 h-[320px] w-[320px]"><a href={currentAd?.url ?? defaultAdUrl} target="_blank"><img className="rounded-md" src={currentAd?.media ?? defaultAdImage} /></a></div>
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
