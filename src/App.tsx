import { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { type Post, type Poster, type Tip, breakingChanges, getNewPosterAndPost, getReplyPosts, deOrphanReplyPosts, getTransactionDetails, getBlockHeightFromTxHash, submitPost, processTip, submitSendTip, supportedImageTypes, storeFileToIpfs, getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient, copyPostTx } from './logic/asyncUtils';
import { getDisplayAddress, getTextAndMediaForPost, isObjectEmpty, str2bytes } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';
import { Link, Outlet } from 'react-router';
import type { MouseEventLocal, PostDomSettingsCollection, PostMediaAttachment } from './App.exports';
import ModalLikesTipsComponent from './components/ModalLikesTipsComponent';
import ModalSendTipComponent from './components/ModalSendTipComponent';

const defaultNodeUrl = 'https://restricted.idena.io';
const defaultNodeApiKey = 'idena-restricted-node-key';
const initIndexerApiUrl = 'https://api.idena.io';
const contractAddressCurrent = '0xa1c5c1A8c6a1Af596078A5c9653F24c216fE1cb2';
const contractAddress3 = '0xc0324f3Cf8158D6E27dc0A07c221636056174718';
const contractAddress2 = '0xC5B35B4Dc4359Cc050D502564E789A374f634fA9';
const contractAddress1 = '0x8d318630eB62A032d2f8073d74f05cbF7c6C87Ae';
const firstBlock = 10135627;
const makePostMethod = 'makePost';
const sendTipMethod = 'sendTip';
const allMethods = [makePostMethod, sendTipMethod];
const thisChannelId = '';
const discussPrefix = 'discuss:';
const postChannelRegex = new RegExp(String.raw`${discussPrefix}[\d]+$`, 'i');
const zeroAddress = '0x0000000000000000000000000000000000000000';
const callbackUrl = `${window.location.origin}/confirm-tx.html`;
const termsOfServiceUrl = `${window.location.origin}/terms-of-service.html`;
const attributionsUrl = `${window.location.origin}/attributions.html`;
const defaultAd = {
    title: 'IDENA: Proof-of-Person blockchain',
    desc: 'Coordination of individuals',
    url: 'https://idena.io',
    thumb: '',
    media: WhatIsIdenaPng,
};

const POLLING_INTERVAL = 10000;
const SCANNING_INTERVAL = 10;
const ADS_INTERVAL = 10000;
const SCAN_POSTS_TTL = 1 * 60;
const INDEXER_API_ITEMS_LIMIT = 20;
const SET_NEW_POSTS_ADDED_DELAY = 20;
const SUBMITTING_POST_INTERVAL = 2000;
const MAX_POST_MEDIA_BYTES = 1024 * 1024;
const MAX_POST_MEDIA_BYTES_WEBAPP = 1024 * 5;


const DEBUG = false;

if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

const customModalStyles = {
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    content: {
        border: 'none',
        borderRadius: 'none',
        backgroundColor: 'rgb(41, 37, 38)',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
        padding: '5px 0px 5px 0px',
        width: '500px',
    },
};

Modal.setAppElement('#root');

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
    const postersAddressRef = useRef<string>(postersAddress);
    const [postersAddressInvalid, setPostersAddressInvalid] = useState<boolean>(false);
    const postersAddressInvalidRef = useRef<boolean>(postersAddressInvalid);
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
    const pastContractAddressRef = useRef(contractAddressCurrent);
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [submittingLike, setSubmittingLike] = useState<string>('');
    const [submittingTip, setSubmittingTip] = useState<string>('');
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const browserStateHistoryRef = useRef<Record<string, PostDomSettingsCollection>>({});
    const [modalOpen, setModalOpen] = useState<string>('');
    const modalLikePostsRef = useRef<Post[]>([]);
    const modalTipsRef = useRef<Tip[]>([]);
    const modalSendTipRef = useRef<Post>(undefined);
    const tipsRef = useRef<Record<string, { totalAmount: number, tips: Tip[] }>>({});
    const [idenaWalletBalance, setIdenaWalletBalance] = useState<string>('0');
    const postMediaAttachmentsRef = useRef<Record<string, PostMediaAttachment | undefined>>({});
    const copyTxHandlerEnabledRef = useRef<boolean>(true);
    const lastUsedNonceSavedRef = useRef<number>(0);


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
                    } else {
                        if (Number(getBalanceResult.balance) === 0) {
                            alert('Your address has no idna, posting will fail!');
                        }
                        setIdenaWalletBalance(getBalanceResult.balance);
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
                const { result, error } = await getPastTxsWithIdenaIndexerApi(inputIdenaIndexerApiUrl, contractAddressCurrent, 1);

                if (!error && result?.length === 1 && result?.[0]?.contractAddress === contractAddressCurrent) {
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

    useEffect(() => {
        postersAddressRef.current = postersAddress;
    }, [postersAddress]);

    useEffect(() => {
        postersAddressInvalidRef.current = postersAddressInvalid;
    }, [postersAddressInvalid]);

    type RecurseForward = () => Promise<void>;
    useEffect(() => {
        if (initialBlock && nodeAvailable) {
            let recurseForwardIntervalId: NodeJS.Timeout;

            (async function recurseForward() {
                if (nodeAvailableRef.current) {
                    const pendingBlock = currentBlockCapturedRef.current ? currentBlockCapturedRef.current + 1 : initialBlock;
                    const contractAddress = contractAddressCurrent;
                    recurseForwardIntervalId = setTimeout(postScannerFactory('recurseForward', recurseForward, setCurrentBlockCaptured, currentBlockCapturedRef, contractAddress, pendingBlock), POLLING_INTERVAL);
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
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(recurseMethod, recurseBackward, setPastBlockCaptured, pastBlockCapturedRef, contractAddress, pendingBlock), SCANNING_INTERVAL);
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
        blockCapturedRef: React.RefObject<number>,
        contractAddress: string,
        pendingBlock?: number,
    ) => {
        return async function postFinder() {
            const isRecurseForward = recurseMethod === 'recurseForward';
            const isRecurseBackwardWithRpcOnly = recurseMethod === 'recurseBackwardWithRpcOnly';
            const isRecurseBackwardWithIndexerApi = recurseMethod === 'recurseBackwardWithIndexerApi';

            // The ref is updated for immediate effect, the state is updated for the rerender.
            const setBlockCapturedRefState = (block: number) => {
                blockCapturedRef.current = block;
                setBlockCaptured(block);
            };

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
                        setBlockCapturedRefState(pendingBlock!);

                        if (isRecurseBackwardWithRpcOnly) {
                            if (getBlockByHeightResult.timestamp < breakingChanges.v5.timestamp) {
                                pastContractAddressRef!.current = contractAddress1;
                            } else if (getBlockByHeightResult.timestamp < breakingChanges.v9.timestamp) {
                                pastContractAddressRef!.current = contractAddress2;
                            } else if (getBlockByHeightResult.timestamp < breakingChanges.v10.timestamp) {
                                pastContractAddressRef!.current = contractAddress3;
                            }
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

                    transactions = result
                        ?.filter((balanceUpdate: any) => balanceUpdate.type === 'CallContract' && allMethods.includes(balanceUpdate.txReceipt.method) && balanceUpdate.from === balanceUpdate.address && balanceUpdate.txReceipt.success === true)
                        .map((balanceUpdate: any) => ({ txHash: balanceUpdate.hash, timestamp: Math.floor((new Date(balanceUpdate.timestamp)).getTime() / 1000 ) }))
                    ?? [];

                    if (continuationToken) {
                        continuationTokenRef!.current = continuationToken;
                    } else {
                        if (pastContractAddressRef!.current === contractAddressCurrent) {
                            pastContractAddressRef!.current = contractAddress3;
                            continuationTokenRef!.current = undefined;
                        } else if (pastContractAddressRef!.current === contractAddress3) {
                            pastContractAddressRef!.current = contractAddress2;
                            continuationTokenRef!.current = undefined;
                        } else if (pastContractAddressRef!.current === contractAddress2) {
                            pastContractAddressRef!.current = contractAddress1;
                            continuationTokenRef!.current = undefined;
                        } else {
                            continuationTokenRef!.current = 'finished processing';
                        }
                    }

                } else {
                    throw 'this should not happen';
                }

                const transactionsWithDetails = await getTransactionDetails(transactions, contractAddress, allMethods, rpcClientRef.current!);

                let lastValidTransaction;

                const newOrderedPostIds: string[] = [];

                let newReplyPostsCollection = {};

                const posterPromises = [];
                const messagePromises = [];
                const mediaPromises = [];

                for (let index = 0; index < transactionsWithDetails.length; index++) {
                    const transaction = transactionsWithDetails[index];

                    if ([sendTipMethod].includes(transaction.method)) {
                        const { postId, updatedPostTips, posterPromise } = await processTip(transaction, rpcClientRef.current!, tipsRef, postersRef);
                        tipsRef.current = { ...tipsRef.current, [postId]: updatedPostTips };

                        posterPromise && posterPromises.push(posterPromise);

                        lastValidTransaction = transaction;

                        continue;
                    }

                    const {
                        newPost,
                        posterPromise,
                        mediaPromise,
                        messagePromise,
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

                    posterPromise && posterPromises.push(posterPromise);
                    messagePromise && messagePromises.push(messagePromise);
                    mediaPromise && mediaPromises.push(mediaPromise);

                    if (!newPost!.replyToPostId && newPost!.channelId === thisChannelId) {
                        newOrderedPostIds.push(newPost!.postId);
                    }

                    const newPosts = { [newPost!.postId]: newPost as Post };

                    const newReplyPosts: Record<string, string> = {};
                    const newForwardOrphanedReplyPosts: Record<string, string> = {};
                    const newBackwardOrphanedReplyPosts: Record<string, string> = {};
                    const newDeOrphanedReplyPosts: Record<string, string> = {};

                    const updatedPosts: Record<string, Post> = {};

                    if (postChannelRegex.test(newPost!.channelId)) {
                        const preV10 = newPost!.timestamp < breakingChanges.v10.timestamp;
                        const discussionPostIdRaw = newPost!.channelId.split(discussPrefix)[1];
                        const discussionPostId = preV10 ? breakingChanges.v10.postIdPrefix + discussionPostIdRaw : discussionPostIdRaw;
                        const discussionPost = postsRef.current[discussionPostId];
                        const orphaned = !discussionPost || discussionPost.orphaned;

                        const channelId = discussPrefix + discussionPostId;
                        postsRef.current = { ...postsRef.current, [channelId]: { orphaned } as Post };

                        getReplyPosts(
                            newPost!.postId,
                            channelId,
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

                    postsRef.current = { ...postsRef.current, ...updatedPosts, ...newPosts };
                    replyPostsTreeRef.current = { ...replyPostsTreeRef.current, ...newReplyPosts };
                    deOrphanedReplyPostsTreeRef.current = { ...deOrphanedReplyPostsTreeRef.current, ...newDeOrphanedReplyPosts };
                    forwardOrphanedReplyPostsTreeRef.current = { ...forwardOrphanedReplyPostsTreeRef.current, ...newForwardOrphanedReplyPosts };
                    backwardOrphanedReplyPostsTreeRef.current = { ...backwardOrphanedReplyPostsTreeRef.current, ...newBackwardOrphanedReplyPosts };
                }

                const postersResolved = await Promise.all(posterPromises);
                let newPosters = {};
                for (let index = 0; index < postersResolved.length; index++) {
                    const posterResolved = postersResolved[index];
                    newPosters = { ...newPosters, [posterResolved.address]: posterResolved };
                }
                postersRef.current = { ...postersRef.current, ...newPosters };

                const messages = await Promise.all(messagePromises);
                for (let index = 0; index < messages.length; index++) {
                    const messagesProps = messages[index];
                    const updatedPost = { ...postsRef.current[messagesProps!.postId], ...messagesProps };
                    postsRef.current = { ...postsRef.current, [messagesProps!.postId]: updatedPost };
                }

                const media = await Promise.all(mediaPromises);
                for (let index = 0; index < media.length; index++) {
                    const mediaProps = media[index];
                    const updatedPost = { ...postsRef.current[mediaProps!.postId], ...mediaProps };
                    postsRef.current = { ...postsRef.current, [mediaProps!.postId]: updatedPost };
                }

                setOrderedPostIds((currentOrderedPostIds) => isRecurseForward ? [...newOrderedPostIds!, ...currentOrderedPostIds] : [...currentOrderedPostIds, ...newOrderedPostIds!]);

                let lastBlockHeight;

                if (isRecurseForward || isRecurseBackwardWithRpcOnly) {
                    lastBlockHeight = pendingBlock!;
                    partialPastBlockCapturedRef.current = 0;
                    setBlockCapturedRefState(lastBlockHeight);
                }

                if (isRecurseBackwardWithIndexerApi && lastValidTransaction) {
                    lastBlockHeight = lastValidTransaction.blockHeight ?? (await getBlockHeightFromTxHash(lastValidTransaction.txHash, rpcClientRef.current!));
                    partialPastBlockCapturedRef.current = lastBlockHeight;
                    setBlockCapturedRefState(lastBlockHeight);
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
        if (submittingPost || submittingLike || submittingTip) {
            intervalSubmittingPost = setTimeout(() => {
                setSubmittingPost('');
                setSubmittingLike('');
                setSubmittingTip('');
            }, SUBMITTING_POST_INTERVAL);
        }
        return () => clearInterval(intervalSubmittingPost);
    }, [submittingPost, submittingLike, submittingTip]);

    useEffect(() => {
        setInputPostDisabled(!!submittingPost || !!submittingLike || !!submittingTip || (inputSendingTxs === 'rpc' && viewOnlyNode) || postersAddressInvalid);
    }, [submittingPost, submittingLike, submittingTip, inputSendingTxs, viewOnlyNode, postersAddressInvalid]);

    const setPostMediaAttachmentHandler = async (location: string, file: File) => {
        if (!supportedImageTypes.includes(file.type)) {
            alert('Media format not supported.');
            return;
        }

        if (inputSendingTxs === 'rpc' && file.size > MAX_POST_MEDIA_BYTES) {
            alert('1MB is the maximum size. This image is too large.');
            return;
        }

        if (inputSendingTxs === 'idena-app' && file.size > MAX_POST_MEDIA_BYTES_WEBAPP) {
            alert('5KB is the maximum size when using the Idena App. This image is too large.');
            return;
        }

        try {
            const imageDataUrl = await new Promise<string>((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.onload = () => resolve(fileReader.result as string);
                fileReader.onerror = () => reject(new Error('Failed to read image file.'));
                fileReader.readAsDataURL(file);
            });

            const newMedia = { dataUrl: imageDataUrl, file };

            postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [location]: newMedia };
        } catch {
            alert('Failed to read media file.');
        }
    };

    const copyPostTxHandler = async (location: string, replyToPostId?: string, channelId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot copy!');
            return;
        }

        const copyTxTextElement = document.getElementById(`post-copytx-${location}`) as HTMLElement;
        const savedInnerText = copyTxTextElement!.innerText;

        if (copyTxHandlerEnabledRef.current) {
            copyTxHandlerEnabledRef.current = false;
            copyTxTextElement!.innerText = 'Copying';

            const postTextareaElement = document.getElementById(`post-input-${location}`) as HTMLTextAreaElement;
            const postMediaAttachment = postMediaAttachmentsRef.current[location];

            let { inputText, media, mediaType } = getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

            if (!inputText && !postMediaAttachment) {
                alert('No text or media provided!');
                copyTxTextElement!.innerText = savedInnerText;
                copyTxHandlerEnabledRef.current = true;
                return;
            }

            copyPostTx(
                postersAddress,
                contractAddressCurrent,
                makePostMethod,
                inputText,
                media,
                mediaType,
                replyToPostId ?? null,
                channelId ?? null,
                rpcClientRef.current!,
                lastUsedNonceSavedRef,
            ).then((res) => {

                if (res?.success) {
                    copyTxTextElement!.innerText = 'Copied ✅';
                } else {
                    copyTxTextElement!.innerText = 'Copied ❌';
                }

                setTimeout(() => {
                    copyTxTextElement!.innerText = savedInnerText;
                    copyTxHandlerEnabledRef.current = true;
                }, 1000);
            });
        }
    }

    const submitPostHandler = async (location: string, replyToPostId?: string, channelId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot post!');
            return;
        }

        const postTextareaElement = document.getElementById(`post-input-${location}`) as HTMLTextAreaElement;
        const postMediaAttachment = postMediaAttachmentsRef.current[location];

        let { inputText, media, mediaType } = getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

        if (!inputText && !postMediaAttachment) {
            alert('No text or media provided!');
            return;
        }

        if (inputSendingTxs === 'rpc') {
            if (inputText.length > 100) {
                const fileBytes = str2bytes(inputText);
                const cidAddress = await storeFileToIpfs(rpcClientRef.current!, lastUsedNonceSavedRef, fileBytes, postersAddressRef.current);

                if (!cidAddress) {
                    alert('Something went wrong. Probably you have insufficient iDNA.');
                }
                
                inputText = cidAddress!;
            }

            if (postMediaAttachment) {
                const fileBytes = new Uint8Array(await postMediaAttachment.file.arrayBuffer());

                const cidAddress = await storeFileToIpfs(rpcClientRef.current!, lastUsedNonceSavedRef, fileBytes, postersAddressRef.current);

                if (!cidAddress) {
                    alert('Something went wrong. Probably you have insufficient iDNA.');
                }

                media = [cidAddress!];
                mediaType = [postMediaAttachment.file.type];
            }
        }

        postTextareaElement.value = '';
        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [location]: undefined };

        setSubmittingPost(location);

        await submitPost(postersAddress, contractAddressCurrent, makePostMethod, inputText, media, mediaType, replyToPostId ?? null, channelId ?? null, inputSendingTxs, rpcClientRef.current!, lastUsedNonceSavedRef, callbackUrl);
    };

    const submitLikeHandler = async (emoji: string, location: string, replyToPostId?: string, channelId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot like!');
            return;
        }

        setSubmittingLike(location);

        await submitPost(postersAddress, contractAddressCurrent, makePostMethod, emoji, [], [], replyToPostId ?? null, channelId ?? null, inputSendingTxs, rpcClientRef.current!, lastUsedNonceSavedRef, callbackUrl);
    };

    const submitSendTipHandler = async (location: string, tipToPostId: string, tipAmount: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot tip!');
            return;
        }

        setSubmittingTip(location);

        await submitSendTip(postersAddress, contractAddressCurrent, sendTipMethod, tipToPostId, tipAmount, inputSendingTxs, rpcClientRef.current!, lastUsedNonceSavedRef, callbackUrl);
    };

    const handleOpenLikesModal = (e: MouseEventLocal, likePosts: Post[]) => {
        e.stopPropagation();
        modalLikePostsRef.current = [ ...likePosts ];
        setModalOpen('likes');
    };

    const handleOpenTipsModal = (e: MouseEventLocal, tips: Tip[]) => {
        e.stopPropagation();
        modalTipsRef.current = [ ...tips ];
        setModalOpen('tips');
    };

    const handleOpenSendTipModal = (e: MouseEventLocal, tipToPost: Post) => {
        e.stopPropagation();

        const isBreakingChangeDisabled = tipToPost.timestamp <= breakingChanges.v10.timestamp;

        if (inputPostDisabled || isBreakingChangeDisabled) {
            return;
        }

        (async function() {
            const { result: getBalanceResult } = await rpcClientRef.current!('dna_getBalance', [inputPostersAddress]);
            if (!getBalanceResult) {
                return;
            }
            setIdenaWalletBalance(getBalanceResult.balance);
        })();

        modalSendTipRef.current = { ...tipToPost };
        setModalOpen('sendTip');
    };

    return (
        <main className="w-full flex flex-row p-2">
            <div className="flex-1 flex justify-end">
                <div className="w-[200px] min-w-[200px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3">
                        <Link to="/">idena.social</Link>
                    </div>
                    <div className="mb-4 text-[14px]">
                        <div className="flex flex-col">
                            <div className="flex flex-row mb-2 gap-1">
                                <p className="w-13 flex-none text-right">Rpc url:</p>
                                <input className="flex-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeUrl} onChange={e => setInputNodeUrl(e.target.value)} />
                            </div>
                            <div className="flex flex-row mb-1 gap-1">
                                <p className="w-13 flex-none text-right">Api key:</p>
                                <input className="flex-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={inputNodeKey} onChange={e => setInputNodeKey(e.target.value)} />
                            </div>
                            {!nodeAvailable && <p className="ml-14 text-[11px] text-red-400">Node Unavailable. Please try again.</p>}
                        </div>
                        <div className="flex flex-row">
                            <button className={`h-7 w-16 ml-14 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputNodeApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputNodeApplied(!inputNodeApplied)}>{inputNodeApplied ? 'Change' : 'Apply!'}</button>
                            {!inputNodeApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
                        </div>
                    </div>
                    <hr className="mb-3 text-gray-500" />
                    <div className="flex flex-col mb-6">
                        <p>For sending transactions:</p>
                        <div className="flex flex-row gap-2">
                            <input id="useRpc" type="radio" name="useRpc" value="rpc" checked={inputSendingTxs === 'rpc'} onChange={handleInputSendingTxsToggle} />
                            <label htmlFor="useRpc" className="flex-none text-right">Use RPC</label>
                        </div>
                        {inputSendingTxs === 'rpc' && viewOnlyNode && <p className="ml-4.5 text-[11px] text-red-400">Your RPC is View-Only. Switch to: Use Idena App for transactions. (Posting, liking, tipping is disabled)</p>}
                        <div className="flex flex-row gap-2">
                            <input id="notUseRpc" type="radio" name="useRpc" value="idena-app" checked={inputSendingTxs === 'idena-app'} onChange={handleInputSendingTxsToggle} />
                            <label htmlFor="notUseRpc" className="flex-none text-right">Use Idena App</label>
                        </div>
                        {inputSendingTxs === 'idena-app' && (
                            <div className="flex flex-col ml-5 text-[14px]">
                                <p className="mb-1">Your Idena Address:</p>
                                <input className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputPostersAddressApplied} value={inputPostersAddress} onChange={e => setInputPostersAddress(e.target.value)} />
                                {postersAddressInvalid && <p className="text-[11px] text-red-400">Invalid address. (Posting, liking, tipping is disabled)</p>}
                                <div className="flex flex-row">
                                    <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputPostersAddressApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputPostersAddressApplied(!inputPostersAddressApplied)}>{inputPostersAddressApplied ? 'Change' : 'Apply'}</button>
                                    {!inputPostersAddressApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
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
                                    <p className="mb-1 w-13 flex-none text-right">Api Url:</p>
                                    <input className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputIdenaIndexerApiUrlApplied} value={inputIdenaIndexerApiUrl} onChange={e => setInputIdenaIndexerApiUrl(e.target.value)} />
                                </div>
                                {indexerApiUrlInvalid && <p className="ml-14 text-[11px] text-red-400">Invalid Api Url.</p>}
                                <div className="flex flex-row">
                                    <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputIdenaIndexerApiUrlApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputIdenaIndexerApiUrlApplied(!inputIdenaIndexerApiUrlApplied)}>{inputIdenaIndexerApiUrlApplied ? 'Change' : 'Apply'}</button>
                                    {!inputIdenaIndexerApiUrlApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mb-3 text-gray-500">
                        <hr />
                        <div className="flex flex-row gap-1">
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={termsOfServiceUrl} target="_blank">Terms of Service</a></p>
                            <p className="text-[14px]/7">|</p>
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={attributionsUrl} target="_blank">Attributions</a></p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-none min-w-[500px] max-w-[500px]">
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
                        copyPostTxHandler,
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
            <div onClick={(e) => e.stopPropagation()}>
                <Modal
                    isOpen={!!modalOpen} 
                    onRequestClose={() => setModalOpen('')}
                    style={customModalStyles}
                >
                    {modalOpen === 'likes' && <ModalLikesTipsComponent heading={'Likes'} modalItemsRef={modalLikePostsRef} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'tips' && <ModalLikesTipsComponent heading={'Tips'} modalItemsRef={modalTipsRef} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'sendTip' && <ModalSendTipComponent modalSendTipRef={modalSendTipRef} idenaWalletBalance={idenaWalletBalance} submitSendTipHandler={submitSendTipHandler} closeModal={() => setModalOpen('')} />}
                    <div className="text-center"><button className="h-7 w-15 my-1 px-2 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => setModalOpen('')}>Close</button></div>
                </Modal>
            </div>
        </main>
    );
};

export default App;
