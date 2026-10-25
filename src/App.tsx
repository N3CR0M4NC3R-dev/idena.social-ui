import { useEffect, useReducer, useRef, useState } from 'react';
import Modal from 'react-modal';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { sha3_256 } from 'js-sha3';
import { type Post, type Poster, type Tip, breakingChanges, getNewPost, saveReplyPostId, deOrphanReplyPosts, submitPost, processTip, submitSendTip, supportedImageTypes, storeFileToIpfs, getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient, copyPostTx, getNewPostLatestActivity, getblockTxsWithIdenaIndexerApi, getBlockAtWithIdenaIndexerApi, getLastBlockWithIdenaIndexerApi, submitMessage, processMessage, resolveNewTextForPosts, resolveNewMediaForPosts, copyMessageTx, type Message, getPubkeyWithIdenaIndexerApi, getPubkeyWithRpc, encryptRecipientsMessage, type PostTips, getTxEventsWithIdenaIndexerApi, getMedia, getMessage, getPosterPromise, resolveNewTextForMessages, resolveNewMediaForMessages, getTxWithIdenaIndexerApi } from './logic/asyncUtils';
import { decryptAESGCM, encryptAESGCM, extractPubkeyAddressFromPrivateKey, filterIndexerApiBalanceUpdates, filterTransactionsByCutoffTimestamp, getDisplayAddress, getNextContract, getPostActivities, getTextAndMediaForPost, getTimestampFromIndexerApi, isObjectEmpty, str2bytes } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';
import WhatIsIdenaThumbPng from './assets/whatisidena_thumb.png';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { defaultProfileActivity, type BrowserStateHistorySettings, type Conversation, type EventTransaction, type MouseEventLocal, type PostFinderTransaction, type PostMediaAttachment, type ProfileActivity, type TransactionCached } from './App.exports';
import ModalLikesTipsComponent from './components/ModalLikesTipsComponent';
import ModalSendTipComponent from './components/ModalSendTipComponent';
import ModalAddMediaComponent from './components/ModalAddMediaComponent';
import ModalRpcMakePostComponent from './components/ModalRpcMakePostComponent';
import ModalExpandImageComponent from './components/ModalExpandImageComponent';
import MenuComponent from './components/MenuComponent';
import ModalRpcSendMessageComponent from './components/ModalRpcSendMessageComponent';
import ScanBlocksComponent from './components/ScanBlocksComponent';
import ModalSubmitPubkeyComponent from './components/ModalSubmitPubkeyComponent';
import ScrollToTopButtonComponent from './components/ScrollToTopButtonComponent';
import { CloseIcon } from './components/icons';
import { loadPostsCache } from './logic/postsStore';
import { loadTipsCache } from './logic/tipsStore';
import { loadMessagesCache } from './logic/messagesStore';
import { loadPostersCache } from './logic/postersStore';
import { cacheIgnore, loadIgnoresCache, type IgnoreItem } from './logic/ignoreStore';
import { addBlocksCapturedRange, clearBlocksCapturedRange, getBlocksCapturedRange, getBlocksCapturedRangeOverlapping } from './logic/blocksCapturedStore';

const defaultNodeUrl = 'https://restricted.idena.io';
const defaultNodeApiKey = 'idena-restricted-node-key';
const initIndexerApiUrl = 'https://api.idena.io';
const contractAddressCurrent = '0x840e092e31e9656fF15E541505039ed77585338E'; // idena.social-ui v12
const contractAddress5 = '0x18b0a55eb99AcA113f50eEBbdeAf6f96E789277f'; // idena.social-ui v11
const contractAddress4 = '0xa1c5c1A8c6a1Af596078A5c9653F24c216fE1cb2'; // idena.social-ui v10
const contractAddress3 = '0xc0324f3Cf8158D6E27dc0A07c221636056174718'; // idena.social-ui v9
const contractAddress2 = '0xC5B35B4Dc4359Cc050D502564E789A374f634fA9'; // idena.social-ui v5
const contractAddress1 = '0x8d318630eB62A032d2f8073d74f05cbF7c6C87Ae'; // idena.social-ui v1
const firstBlock = 10135627;
const makePostMethod = 'makePost';
const sendTipMethod = 'sendTip';
const sendMessageMethod = 'sendMessage';
const allMethods = [makePostMethod, sendTipMethod, sendMessageMethod];
const thisChannelId = '';
const discussPrefix = 'discuss:';
const messagePrefix = 'message:';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const callbackUrl = `${window.location.origin}/confirm-tx.html`;
const termsOfServiceUrl = `${window.location.origin}/terms-of-service.html`;
const attributionsUrl = `${window.location.origin}/attributions.html`;
const defaultAd = {
    title: 'IDENA: Proof-of-Person blockchain',
    desc: 'Coordination of individuals',
    url: 'https://idena.io',
    thumb: WhatIsIdenaThumbPng,
    media: WhatIsIdenaPng,
};

const POLLING_INTERVAL = 10000;
const SCANNING_INTERVAL = 10;
const SCANNING_INTERVAL_MESSAGES = 1000;
const ADS_INTERVAL = 10000;
const SCAN_PAST_POSTS_TTL = 1 * 60;
const INDEXER_API_ITEMS_LIMIT = 20;
const SET_NEW_POSTS_ADDED_DELAY = 20;
const SUBMITTING_POST_INTERVAL = 2000;
const MAX_POST_MEDIA_BYTES = 1024 * 1024;
const MAX_POST_MEDIA_BYTES_WEBAPP = 1024 * 5;

export const defaultSettings = {
    nodeUrl: defaultNodeUrl,
    nodeKey: defaultNodeApiKey,
    makePostsWith: 'idena-app',
    postersAddress: zeroAddress,
    findPostsWith: 'indexer-api',
    indexerApiUrl: initIndexerApiUrl,
    saveEncryptedKey: false,
    encryptedPrivateKey: '',
    savePassword: false,
    password: '',
};

const initSettings = {
    nodeUrl: localStorage.getItem('nodeUrl') || defaultSettings.nodeUrl,
    nodeKey: localStorage.getItem('nodeKey') || defaultSettings.nodeKey,
    makePostsWith: localStorage.getItem('makePostsWith') || defaultSettings.makePostsWith,
    postersAddress: localStorage.getItem('postersAddress') || defaultSettings.postersAddress,
    findPostsWith: localStorage.getItem('findPostsWith') || defaultSettings.findPostsWith,
    indexerApiUrl: localStorage.getItem('indexerApiUrl') || defaultSettings.indexerApiUrl,
    saveEncryptedKey: localStorage.getItem('saveEncryptedKey') === 'true' || defaultSettings.saveEncryptedKey,
    encryptedPrivateKey: localStorage.getItem('encryptedPrivateKey') || defaultSettings.encryptedPrivateKey,
    savePassword: localStorage.getItem('savePassword') === 'true' || defaultSettings.savePassword,
    password: localStorage.getItem('password') || defaultSettings.password,
};

const DEBUG = false;

if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

const modalClassNames = {
    overlay: 'fixed inset-0 z-50 bg-[rgba(91,112,131,0.4)]',
    content: 'absolute inset-0 overflow-y-auto overscroll-contain scrollbar-thin bg-canvas outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
    closeButton: 'hover:bg-ink/10',
};

const modalExpandImageClassNames = {
    overlay: modalClassNames.overlay,
    content: 'absolute top-1/2 left-1/2 max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 outline-none',
    closeButton: 'bg-black/60 text-white backdrop-blur-sm hover:bg-black/80',
};

Modal.setAppElement('#root');

function App() {

    const location = useLocation();
    const navigate = useNavigate();

    const { key: locationKey, pathname } = location;

    // inputs for settings
    const [inputNodeApplied, setInputNodeApplied] = useState<boolean>(true);
    const [inputPostersAddress, setInputPostersAddress] = useState<string>(initSettings.postersAddress);
    const [inputPostersAddressApplied, setInputPostersAddressApplied] = useState<boolean>(true);
    const [postersAddressInvalid, setPostersAddressInvalid] = useState<boolean>(false);
    const postersAddressInvalidRef = useRef<boolean>(postersAddressInvalid);
    const [inputIdenaIndexerApiUrl, setInputIdenaIndexerApiUrl] = useState<string>(initSettings.indexerApiUrl);
    const [inputIdenaIndexerApiUrlApplied, setInputIdenaIndexerApiUrlApplied] = useState<boolean>(true);
    const [indexerApiUrlInvalid, setIdenaIndexerApiUrlInvalid] = useState<boolean>(false);
    const indexerApiUrlInvalidRef = useRef(indexerApiUrlInvalid);
    const [inputCredentialsApplied, setInputCredentialsApplied] = useState<boolean>(true);
    const [credentialsInvalid, setCredentialsInvalid] = useState<string>('Invalid key or password');
    const [messageSettingsInvalid, setMessageSettingsInvalid] = useState<boolean>(false);

    // settings
    const [nodeUrl, setNodeUrl] = useState<string>(initSettings.nodeUrl);
    const [nodeKey, setNodeKey] = useState<string>(initSettings.nodeKey);
    const [makePostsWith, setMakePostsWith] = useState<string>(initSettings.makePostsWith);
    const [postersAddress, setPostersAddress] = useState<string>(initSettings.postersAddress);
    const postersAddressRef = useRef<string>(postersAddress);
    const [findPostsWith, setFindPostsWith] = useState<string>(initSettings.findPostsWith);
    const findPostsWithRef = useRef(findPostsWith);
    const [indexerApiUrl, setIndexerApiUrl] = useState<string>(initSettings.indexerApiUrl);
    const indexerApiUrlRef = useRef(indexerApiUrl);
    const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<string>(initSettings.encryptedPrivateKey);
    const [password, setPassword] = useState<string>(initSettings.password);
    const [saveEncryptedKey, setSaveEncryptedKey] = useState<boolean>(initSettings.saveEncryptedKey);
    const [savePassword, setSavePassword] = useState<boolean>(initSettings.savePassword);

    // node
    const [nodeAvailable, setNodeAvailable] = useState<boolean>(true);
    const nodeAvailableRef = useRef(nodeAvailable);
    const rpcClientRef = useRef(undefined as undefined | RpcClient);
    const [viewOnlyNode, setViewOnlyNode] = useState<boolean>(false);
    const encryptedPrivateKeyFromNodeRef = useRef('');
    const passwordFromNodeRef = useRef('');

    // ads
    const [ads, setAds] = useState<ApprovedAd[]>([]);
    const [currentAd, setCurrentAd] = useState<ApprovedAd | null>(null);
    const currentAdRef = useRef(currentAd);

    // blocks
    const [initialBlock, setInitialBlock] = useState<number>(0);
    const [initialBlockTimestamp, setInitialBlockTimestamp] = useState<number>(0);
    const [pastBlockCaptured, setPastBlockCaptured] = useState<number>(0);
    const pastBlockCapturedRef = useRef(pastBlockCaptured);
    const partialPastBlockCapturedRef = useRef({ lastBlockHeight: 0, lastValidTxHash: '' });
    const [currentBlockCaptured, setCurrentBlockCaptured] = useState<number>(0);
    const currentBlockCapturedRef = useRef(currentBlockCaptured);
    const [scanningPastBlocks, setScanningPastBlocks] = useState<boolean>(false);
    const scanningPastBlocksRef = useRef(scanningPastBlocks);
    const [noMorePastBlocks, setNoMorePastBlocks] = useState<boolean>(false);

    // posts, posters, tips, messages
    const [latestPosts, setLatestPosts] = useState<string[]>([]);
    const [latestActivity, setLatestActivity] = useState<string[]>([]);
    const postsRef = useRef({} as Record<string, Post>);
    const postersRef = useRef({} as Record<string, Poster>);
    const replyPostsTreeRef = useRef({} as Record<string, string>);
    const deOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const forwardOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const backwardOrphanedReplyPostsTreeRef = useRef({} as Record<string, string>);
    const continuationTokenRef = useRef(undefined as undefined | string);
    const pastContractAddressRef = useRef(contractAddressCurrent);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [submittingLike, setSubmittingLike] = useState<string>('');
    const [submittingTip, setSubmittingTip] = useState<string>('');
    const [submittingMessage, setSubmittingMessage] = useState<string>('');
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const browserStateHistoryRef = useRef<Record<string, BrowserStateHistorySettings>>({});
    const postMediaAttachmentsRef = useRef<Record<string, PostMediaAttachment | undefined>>({});
    const copyTxHandlerEnabledRef = useRef<boolean>(true);
    const tipsRef = useRef<Record<string, Tip>>({});
    const postTipsRef = useRef<Record<string, PostTips>>({});
    const [idenaWalletBalance, setIdenaWalletBalance] = useState<string>('0');
    const postLatestActivityRef = useRef({} as Record<string, number>);
    const latestMessagesForwardQueueRef = useRef([] as (EventTransaction | TransactionCached)[]);
    const latestMessagesBackwardQueueRef = useRef([] as (EventTransaction | TransactionCached)[]);
    const [latestConversationActivity, setLatestConversationActivity] = useState<string[]>([]);
    const conversationsRef = useRef<Record<string, Conversation>>({});
    const messagesRef = useRef<Record<string, Message>>({});
    const profileActivityRef = useRef<Record<string, ProfileActivity>>({});
    const postActivityRef = useRef<string[]>([]);

    // indexeddb cache of posts, posters, tips, messages
    const [cacheLoaded, setCacheLoaded] = useState<boolean>(false);
    const cachedPostsRef = useRef<Record<string, Post>>({});
    const cachedTipsRef = useRef<Record<string, Tip>>({});
    const cachedIgnoresRef = useRef<Record<string, IgnoreItem>>({});
    const [messagesCacheLoaded, setMessagesCacheLoaded] = useState<boolean>(false);
    const cachedMessagesRef = useRef<Record<string, Message>>({});

    // modals
    const [modalOpen, setModalOpen] = useState<string>('');
    const modalLikePostsRef = useRef<Post[]>([]);
    const modalTipsRef = useRef<Tip[]>([]);
    const modalSendTipRef = useRef<{ location: string, postId: string }>(undefined);
    const modalAddMediaRef = useRef<string>('');
    const modalRpcMakePostRef = useRef<{ location: string, replyToPostId?: string, channelId?: string }>({ location: '' });
    const modalRpcSendMessageRef = useRef<{ location: string, recipients: string[], replyToMessageId?: string }>({ location: '', recipients: [] });
    const modalExpandImageRef = useRef<{ image?: File, cid?: string }>({});
    const modalSubmitPubkeyRef = useRef<{ address: string }>({ address: '' });

    // miscellaneous
    const [, forceUpdate] = useReducer(x => x + 1, 0);


    const setBrowserStateHistorySettings = (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => {
        browserStateHistoryRef.current = {
            ...browserStateHistoryRef.current,
            [locationKey]: {
                ...browserStateHistoryRef.current[locationKey] ?? {},
                ...pageDomSetting,
            }
        };

        rerender && forceUpdate();
    };

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
                const { result: getLastBlockResult } = findPostsWith === 'indexer-api' ? await getLastBlockWithIdenaIndexerApi(indexerApiUrl) : await rpcClientRef.current!('bcn_lastBlock', []);
                setInitialBlock(getLastBlockResult?.height ?? 0);
                const timestamp = findPostsWith === 'indexer-api' ? getTimestampFromIndexerApi(getLastBlockResult?.timestamp) : getLastBlockResult?.timestamp;
                setInitialBlockTimestamp(timestamp ?? 0);
                setScanningPastBlocks(true);
            }

            const { result: getCoinbaseAddrResult } = await rpcClientRef.current!('dna_getCoinbaseAddr', [], true);

            if (getCoinbaseAddrResult) {
                setViewOnlyNode(false);
            } else {
                setViewOnlyNode(true);
            }

            if (getCoinbaseAddrResult && makePostsWith === 'rpc') {
                setPostersAddress(getCoinbaseAddrResult);

                const uuid = crypto.randomUUID();
                const { result: exportKeyResult } = await rpcClientRef.current!('dna_exportKey', [uuid]);

                encryptedPrivateKeyFromNodeRef.current = exportKeyResult;
                passwordFromNodeRef.current = uuid;
            }

            const adsClient = new IdenaApprovedAds({ idenaNodeUrl, idenaNodeApiKey });

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
        setRpcClient(nodeUrl, nodeKey, setNodeAvailable);

        if (!cacheLoaded) {
            Promise.all([
                loadPostsCache(),
                loadTipsCache(),
                loadPostersCache(),
                loadIgnoresCache(),
            ]).then(([cachedPosts, cachedTips, cachedPosters, cachedIgnores]) => {
                cachedPostsRef.current = { ...cachedPostsRef.current, ...cachedPosts };
                cachedTipsRef.current = { ...cachedTipsRef.current, ...cachedTips };
                postersRef.current = { ...postersRef.current, ...cachedPosters };
                cachedIgnoresRef.current = { ...cachedIgnoresRef.current, ...cachedIgnores };
                setCacheLoaded(true);
            });
        }
    }, []);

    useEffect(() => {
        const canUseIdenaApp = makePostsWith === 'idena-app' && !credentialsInvalid;
        const canUseRpc = makePostsWith === 'rpc' && !viewOnlyNode;

        if (nodeAvailable && (canUseIdenaApp || canUseRpc)) {
            const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
            const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
            loadMessagesCache(postersAddress, encryptedPrivateKeyActual, passwordyActual).then((cachedMessages) => {
                cachedMessagesRef.current = { ...cachedMessagesRef.current, ...cachedMessages };
                setMessagesCacheLoaded(true);
            });
        }
    }, [postersAddress, nodeAvailable, makePostsWith, credentialsInvalid, viewOnlyNode]);

    useEffect(() => {
        if (!inputPostersAddressApplied || makePostsWith !== 'idena-app') {
            return;
        }
        validatePostersAddress();
    }, [inputPostersAddressApplied]);

    useEffect(() => {
        if (inputIdenaIndexerApiUrlApplied && findPostsWith === 'indexer-api') {
            setIndexerApiUrl(inputIdenaIndexerApiUrl);
            localStorage.setItem('indexerApiUrl', inputIdenaIndexerApiUrl);

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
        if (!inputCredentialsApplied) {
            return;
        }
        validateCredentials();
    }, [inputCredentialsApplied]);

    // special case for restoring defaults
    useEffect(() => {
        if (inputPostersAddress !== zeroAddress || makePostsWith !== 'idena-app' || !inputPostersAddressApplied) {
            return;
        }
        validatePostersAddress();
    }, [inputPostersAddress, makePostsWith]);

    // special case for restoring defaults
    useEffect(() => {
        if (password || encryptedPrivateKey || !inputCredentialsApplied) {
            return;
        }
        validateCredentials();
    }, [password, encryptedPrivateKey]);

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
        if (
            !nodeAvailable ||
            makePostsWith === 'idena-app' && credentialsInvalid ||
            makePostsWith === 'rpc' && viewOnlyNode
        ) {
            setMessageSettingsInvalid(true);
        } else {
            setMessageSettingsInvalid(false);
        }
    }, [nodeAvailable, makePostsWith, credentialsInvalid, viewOnlyNode]);

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
        findPostsWithRef.current = findPostsWith;
    }, [findPostsWith]);

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
        let recurseForwardIntervalId: NodeJS.Timeout | undefined;

        if (initialBlock && nodeAvailable && cacheLoaded) {
            (async function recurseForward() {
                if (nodeAvailableRef.current) {
                    const recurseDirection = 'forward';
                    const contentSource = findPostsWithRef.current === 'rpc' ? 'rpc' : 'indexer-api';
                    const pendingBlock = currentBlockCapturedRef.current ? currentBlockCapturedRef.current + 1 : initialBlock;
                    const contractAddress = contractAddressCurrent;
                    recurseForwardIntervalId = setTimeout(postScannerFactory(recurseDirection, contentSource, recurseForward, setCurrentBlockCaptured, currentBlockCapturedRef, contractAddress, pendingBlock), POLLING_INTERVAL);
                }
            } as RecurseForward)();

            return () => clearInterval(recurseForwardIntervalId);
        } else {
            recurseForwardIntervalId && clearInterval(recurseForwardIntervalId);
        }
    }, [initialBlock, nodeAvailable, cacheLoaded]);

    type RecurseBackward = (time: number) => Promise<void>;
    useEffect(() => {
        let recurseBackwardIntervalId: NodeJS.Timeout | undefined;

        if (scanningPastBlocks && initialBlock && initialBlockTimestamp && nodeAvailable && cacheLoaded) {
            const timeNow = Math.floor(Date.now() / 1000);
            const ttl = timeNow + SCAN_PAST_POSTS_TTL;

            (async function recurseBackward(time: number) {
                if (scanningPastBlocksRef.current && nodeAvailableRef.current && time < ttl) {
                    const recurseDirection = 'backward';
                    const contentSource = findPostsWithRef.current === 'rpc' ? 'rpc' : 'indexer-api';
                    const contractAddress = pastContractAddressRef!.current;
                    const pendingBlock = pastBlockCapturedRef.current ? (partialPastBlockCapturedRef.current?.lastBlockHeight || pastBlockCapturedRef.current - 1) : initialBlock;
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(recurseDirection, contentSource, recurseBackward, setPastBlockCaptured, pastBlockCapturedRef, contractAddress, pendingBlock), SCANNING_INTERVAL);
                } else {
                    setScanningPastBlocks(false);
                }
            } as RecurseBackward)(timeNow);

            return () => clearInterval(recurseBackwardIntervalId);
        } else {
            recurseBackwardIntervalId && clearInterval(recurseBackwardIntervalId);
        }
    }, [scanningPastBlocks, initialBlock, initialBlockTimestamp, nodeAvailable, cacheLoaded]);

    const validatePostersAddress = () => {
        setPostersAddress(inputPostersAddress);

        if (inputPostersAddress === zeroAddress) {
            localStorage.setItem('postersAddress', '');
            setPostersAddressInvalid(true);
        } else {
            localStorage.setItem('postersAddress', inputPostersAddress);
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
    };

    const validateCredentials = () => {
        if (encryptedPrivateKey.length !== 120) {
            setCredentialsInvalid('Key must be 120 chars');
            return;
        }

        if (!password.length) {
            setCredentialsInvalid('Password missing');
            return;
        }

        const keyData = new Uint8Array(sha3_256.array(password));

        decryptAESGCM(encryptedPrivateKey, keyData).then((privateKey) => {
            const { address: calculatedAddress } = extractPubkeyAddressFromPrivateKey(privateKey);

            if (calculatedAddress !== postersAddress.toLowerCase()) {
                setCredentialsInvalid('Key corresponds to wrong address');
                return;
            }

            if (saveEncryptedKey) {
                localStorage.setItem('encryptedPrivateKey', encryptedPrivateKey);
            }

            if (savePassword) {
                localStorage.setItem('password', password);
            }

            setCredentialsInvalid('');
        }).catch(() => {
            setCredentialsInvalid('Invalid key or password');
        });
    };

    const handleMakePostsWithToggle = (value: string) => {
        setMakePostsWith(value);

        localStorage.setItem('makePostsWith', value);

        if (value === 'rpc') {
            setInputPostersAddress('');
            setPostersAddressInvalid(false);
            setRpcClient(nodeUrl, nodeKey, setNodeAvailable);
        }

        if (value === 'idena-app') {
            if (postersAddress) {
                setInputPostersAddress(postersAddress);
                setPostersAddressInvalid(false);
                localStorage.setItem('postersAddress', postersAddress);
            } else {
                setInputPostersAddress(zeroAddress);
                setPostersAddress(zeroAddress);
                setPostersAddressInvalid(true);
            }
        }
    };

    const handleInputFindPostsWithToggle = (value: string) => {
        if (scanningPastBlocks) {
            alert('Cannot change while scanning past blocks. Please wait and try again.');
            return;
        }
        setFindPostsWith(value);
        localStorage.setItem('findPostsWith', value);

        if (value === 'rpc') {
            setIndexerApiUrl('');
            setIdenaIndexerApiUrlInvalid(false);
        }

        if (value === 'indexer-api') {
            if (indexerApiUrl) {
                setIndexerApiUrl(indexerApiUrl);
                setPostersAddressInvalid(false);
                localStorage.setItem('indexerApiUrl', indexerApiUrl);
            } else {
                setInputIdenaIndexerApiUrl(initIndexerApiUrl);
                setIndexerApiUrl(initIndexerApiUrl);
            }

            clearBlocksCapturedRange().then(() => navigate(0));
        }
    };

    const postScannerFactory = (
        recurseDirection: string,
        contentSource: string,
        recurse: RecurseForward | RecurseBackward,
        setBlockCaptured: React.Dispatch<React.SetStateAction<number>>,
        blockCapturedRef: React.RefObject<number>,
        contractAddress: string,
        pendingBlock?: number,
    ) => {
        const isRecurseForward = recurseDirection === 'forward';
        const isContentSourceRpc = contentSource === 'rpc';

        const isRecurseForwardWithRpcOnly = isRecurseForward && isContentSourceRpc;
        const isRecurseForwardWithIndexerApi = isRecurseForward && !isContentSourceRpc;
        const isRecurseBackwardWithRpcOnly = !isRecurseForward && isContentSourceRpc;
        const isRecurseBackwardWithIndexerApi = !isRecurseForward && !isContentSourceRpc;

        // The ref is updated for immediate effect, the state is updated for the rerender.
        const setBlockCapturedRefState = (block: number) => {
            blockCapturedRef.current = block;
            setBlockCaptured(block);
        };

        return async function postFinder() {
            try {
                
                let transactions: PostFinderTransaction[] = [];

                let cachedEndBlockHeight;

                if (isRecurseForwardWithRpcOnly || isRecurseBackwardWithRpcOnly) {
                    const cachedRange = isRecurseBackwardWithRpcOnly && await getBlocksCapturedRange(pendingBlock!);
                    if (cachedRange) {
                        cachedEndBlockHeight = cachedRange.end_block_height;
                        transactions = cachedRange.transactions
                            .map(transaction => {
                                const [ txHash, timestampStr ] = transaction.split('-');
                                return { txHash, timestamp: parseInt(timestampStr) };
                            })
                            .filter((item) => item.timestamp < initialBlockTimestamp);
                    } else if (isRecurseBackwardWithRpcOnly && pendingBlock === initialBlock) {
                        // Note that recurse forward starts at the initial block. We also start recurse backward at initial block for the opportunity to capture a cached range (if existing).
                        throw 'no transactions';
                    } else {
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
                                } else if (getBlockByHeightResult.timestamp < breakingChanges.v11.timestamp) {
                                    pastContractAddressRef!.current = contractAddress4;
                                } else if (getBlockByHeightResult.timestamp < breakingChanges.v12.timestamp) {
                                    pastContractAddressRef!.current = contractAddress5;
                                }
                            }
                            throw 'no transactions';
                        }

                        transactions = getBlockByHeightResult.transactions.map((txHash: string) => ({ txHash, timestamp: getBlockByHeightResult.timestamp, blockHeight: getBlockByHeightResult.height }));
                    }
                } else if (isRecurseForwardWithIndexerApi) {
                    const { result: getBlockByHeightResult, error: getBlockByHeightError } = await getBlockAtWithIdenaIndexerApi(indexerApiUrl, pendingBlock!);

                    if (getBlockByHeightError && getBlockByHeightError?.message !== 'no data found') {
                        throw 'indexer api unavailable';
                    }

                    if (getBlockByHeightError?.message === 'no data found') {
                        throw 'no block';
                    }

                    if (getBlockByHeightResult.txCount === 0) {
                        setBlockCapturedRefState(pendingBlock!);
                        throw 'no transactions';
                    }

                    const { result: getblockTxsResult, error: getblockTxsError } = await getblockTxsWithIdenaIndexerApi(indexerApiUrl, pendingBlock!);
                    
                    if (getblockTxsError) {
                        throw 'indexer api unavailable';
                    }

                    transactions = getblockTxsResult
                        ?.filter((transaction: any) => transaction.type === 'CallContract' && allMethods.includes(transaction.txReceipt?.method) && transaction.to === contractAddressCurrent && transaction.txReceipt?.success === true)
                        .map((transaction: any) => ({ txHash: transaction.hash, timestamp: getTimestampFromIndexerApi(transaction.timestamp), blockHeight: pendingBlock }))
                    ?? [];
                } else if (isRecurseBackwardWithIndexerApi) {
                    if (continuationTokenRef!.current === 'finished processing') {
                        throw 'no more transactions';
                    }

                    const lastBlockHeight = partialPastBlockCapturedRef.current?.lastBlockHeight;
                    const cachedRange = lastBlockHeight ? await getBlocksCapturedRangeOverlapping(partialPastBlockCapturedRef.current?.lastBlockHeight) : undefined;
                    let cachedRangeInvalidated = false;

                    if (cachedRange) {
                        const txIndexStart = cachedRange.transactions.findIndex((item) => item.startsWith(partialPastBlockCapturedRef.current.lastValidTxHash));
                        const txsRemaining = txIndexStart >= 0 ? cachedRange.transactions.slice(txIndexStart + 1) : [];

                        if (txsRemaining.length < INDEXER_API_ITEMS_LIMIT) {
                            cachedRangeInvalidated = true;
                        } else {
                            const continuationDetails = cachedRange.indexer_api_continuation_details!;

                            const rawTransactions = [ ...txsRemaining, ...continuationDetails.nextBlockTransactions ];

                            transactions = rawTransactions
                                .map((item: string) => {
                                    const [ txHash, timestampStr ] = item.split('-');
                                    return { txHash, timestamp: parseInt(timestampStr) };
                                })
                                .filter((item) => item.timestamp < initialBlockTimestamp);

                            pastContractAddressRef!.current = continuationDetails.contract;
                            continuationTokenRef!.current = continuationDetails.continuationToken;
                        }
                    }

                    if (!cachedRange || cachedRangeInvalidated) {
                        const { result, continuationToken, error } = await getPastTxsWithIdenaIndexerApi(indexerApiUrl, pastContractAddressRef!.current, INDEXER_API_ITEMS_LIMIT, continuationTokenRef!.current);
                        
                        if (error) {
                            throw 'indexer api unavailable';
                        }

                        const filteredBalanceUpdates = result ? filterIndexerApiBalanceUpdates(result, allMethods) : [];

                        transactions = filterTransactionsByCutoffTimestamp(
                            pastContractAddressRef!.current,
                            filteredBalanceUpdates,
                            [
                                { contract: contractAddressCurrent, timestamp: initialBlockTimestamp },
                                { contract: contractAddress5, timestamp: breakingChanges.v12.timestamp },
                                { contract: contractAddress4, timestamp: breakingChanges.v11.timestamp },
                                { contract: contractAddress3, timestamp: breakingChanges.v10.timestamp },
                                { contract: contractAddress2, timestamp: breakingChanges.v9.timestamp },
                                { contract: contractAddress1, timestamp: breakingChanges.v5.timestamp },
                            ],
                        );

                        if (continuationToken) {
                            continuationTokenRef!.current = continuationToken;
                        } else {
                            const nextContract = getNextContract(
                                pastContractAddressRef!.current, 
                                [
                                    contractAddressCurrent,
                                    contractAddress5,
                                    contractAddress4,
                                    contractAddress3,
                                    contractAddress2,
                                    contractAddress1,
                                ]
                            );

                            if (nextContract) {
                                pastContractAddressRef!.current = nextContract;
                                continuationTokenRef!.current = undefined;
                            } else {
                                continuationTokenRef!.current = 'finished processing';
                            }
                        }
                    }

                } else {
                    throw 'this should not happen';
                }

                const transactionsWithDetailsPromises = [];

                for (let index = 0; index < transactions.length; index++) {
                    const transaction = transactions[index];

                    if (cachedIgnoresRef.current[transaction.txHash]) {
                        continue;
                    } else if (cachedPostsRef.current[transaction.txHash]) {
                        const cachedItem = cachedPostsRef.current[transaction.txHash];
                        const item = {
                            txHash: cachedItem.txHash,
                            timestamp: cachedItem.timestamp,
                            method: makePostMethod,
                            blockHeight: transaction.blockHeight,
                            cachedItem,
                        };
                        transactionsWithDetailsPromises.push(item);
                    } else if (cachedTipsRef.current[transaction.txHash]) {
                        const cachedItem = cachedTipsRef.current[transaction.txHash];
                        const item = {
                            txHash: cachedItem.txHash,
                            timestamp: cachedItem.timestamp,
                            method: sendTipMethod,
                            blockHeight: transaction.blockHeight,
                            cachedItem,
                        };
                        transactionsWithDetailsPromises.push(item);
                    } else if (cachedMessagesRef.current[transaction.txHash]) {
                        const cachedItem = cachedMessagesRef.current[transaction.txHash];
                        const item = {
                            txHash: cachedItem.txHash,
                            timestamp: cachedItem.timestamp,
                            method: sendMessageMethod,
                            blockHeight: transaction.blockHeight,
                            cachedItem,
                        };
                        transactionsWithDetailsPromises.push(item);
                    } else if (isContentSourceRpc) {
                        const promisedItem = rpcClientRef.current!('bcn_txReceipt', [transaction.txHash]).then(receipt => {
                            const conditional = (receipt.error && (() => { throw 'rpc unavailable'; })()) ||
                                receipt.result &&
                                receipt.result.success === true &&
                                receipt.result.contract === contractAddress.toLowerCase() &&
                                allMethods.includes(receipt.result.method);
                            if (!conditional) {
                                return;
                            }
                            return {
                                eventArgs: receipt.result.events?.[0]?.args,
                                eventArgs2nd: receipt.result.events?.[1]?.args,
                                method: receipt.result.method,
                                txHash: transaction.txHash,
                                timestamp: transaction.timestamp,
                                blockHeight: transaction.blockHeight,
                            };
                        });
                        transactionsWithDetailsPromises.push(promisedItem);
                    } else {
                        const promisedItem = getTxEventsWithIdenaIndexerApi(indexerApiUrl, transaction.txHash, 10).then(receipt => {
                            const conditional = (receipt.error && (() => { throw 'indexer api unavailable'; })()) || receipt.result;
                            if (!conditional) {
                                return;
                            }
                            return {
                                eventArgs: receipt.result?.[0]?.data,
                                eventArgs2nd: receipt.result?.[1]?.data,
                                method: receipt.result?.[0]?.eventName,
                                txHash: transaction.txHash,
                                timestamp: transaction.timestamp,
                                blockHeight: transaction.blockHeight,
                            };
                        });
                        transactionsWithDetailsPromises.push(promisedItem);
                    }
                }

                const transactionsWithDetails: (EventTransaction | TransactionCached)[] = (await Promise.all(transactionsWithDetailsPromises)).filter(item => !!item);

                const newLatestPosts: string[] = [];

                const posterPromises = [];
                const messagePromises = [];
                const mediaPromises = [];

                let transactionsAccepted: (EventTransaction | TransactionCached)[] = [];

                for (let index = 0; index < transactionsWithDetails.length; index++) {
                    const transaction = transactionsWithDetails[index];
                    const cachedTx = (transaction as TransactionCached).cachedItem;

                    if ([sendTipMethod].includes(transaction.method)) {

                        const { newTip, continued } = cachedTx ? { newTip: (cachedTx as Tip) } : await processTip(transaction as EventTransaction, tipsRef);

                        if (continued) {
                            if (continued === 'already-captured') {
                                transactionsAccepted = [ ...transactionsAccepted, transaction ];
                            } else {
                                await cacheIgnore({ txHash: transaction.txHash, method: transaction.method, reason: 'non-compliance' });
                            }
                            continue;
                        }

                        transactionsAccepted = [ ...transactionsAccepted, transaction ];

                        const posterPromise = getPosterPromise(
                            newTip!.tipper,
                            postersRef,
                            findPostsWithRef.current === 'indexer-api',
                            rpcClientRef.current!,
                            indexerApiUrlRef,
                        );

                        const existingPostTips = postTipsRef.current[newTip!.postId];

                        const updatedPostTips: PostTips = {
                            postId: newTip!.postId,
                            totalAmount: (existingPostTips?.totalAmount ?? 0) + newTip!.amount,
                            tips: isRecurseForward ? [ newTip!.txHash, ...(existingPostTips?.tips ?? []) ] : [ ...(existingPostTips?.tips ?? []), newTip!.txHash ],
                        };

                        tipsRef.current = { ...tipsRef.current, [newTip!.txHash]: newTip! };
                        postTipsRef.current = { ...postTipsRef.current, [newTip!.postId]: updatedPostTips! };

                        posterPromise && posterPromises.push(posterPromise);

                        // transient Post representation of a Tip
                        const newPost = {
                            postId: newTip!.txHash,
                            replyToPostId: newTip!.postId,
                            timestamp: newTip!.timestamp,
                        } as Post;

                        const newPostLatestActivity = getNewPostLatestActivity(
                            isRecurseForward,
                            newPost!,
                            postsRef,
                            postLatestActivityRef,
                        );

                        postLatestActivityRef.current = { ...postLatestActivityRef.current, ...newPostLatestActivity };

                        const profileActivity = { ...(profileActivityRef.current[newTip!.tipper] ?? defaultProfileActivity) };
                        profileActivity.tips = isRecurseForward ? [`${newTip!.postId}|${newTip!.txHash}`, ...profileActivity.tips] : [...profileActivity.tips, `${newTip!.postId}|${newTip!.txHash}`];
                        profileActivityRef.current[newTip!.tipper] = profileActivity;

                        if (postsRef.current[newTip!.postId!]?.poster === postersAddress.toLowerCase()) {
                            postActivityRef.current = [ ...postActivityRef.current, `${newTip!.timestamp}-${newTip!.postId}|${newTip!.txHash}-tip` ];
                        }

                        continue;
                    }

                    if ([sendMessageMethod].includes(transaction.method)) {
                        if (transaction.timestamp > breakingChanges.v12.timestamp) {
                            if (isRecurseForward) {
                                latestMessagesForwardQueueRef.current = [ ...latestMessagesForwardQueueRef.current, transaction ];
                            } else {
                                latestMessagesBackwardQueueRef.current = [ ...latestMessagesBackwardQueueRef.current, transaction ];
                            }
                        } else {
                            await cacheIgnore({ txHash: transaction.txHash, method: transaction.method, reason: 'non-compliance' });
                        }

                        transactionsAccepted = [ ...transactionsAccepted, transaction ];

                        continue;
                    }

                    const {
                        newPost,
                        continued,
                    } = cachedTx ? { newPost: (cachedTx as Post) } : await getNewPost(
                        transaction as EventTransaction,
                        thisChannelId,
                        discussPrefix,
                        postsRef,
                    );

                    if (continued) {
                        if (continued === 'already-captured') {
                            transactionsAccepted = [ ...transactionsAccepted, transaction ];
                        } else {
                            await cacheIgnore({ txHash: transaction.txHash, method: transaction.method, reason: 'non-compliance' });
                        }
                        continue;
                    }

                    transactionsAccepted = [ ...transactionsAccepted, transaction ];

                    const messagePromise = newPost!.message && !newPost!.messageResolved && getMessage(newPost!.postId, newPost!.message, rpcClientRef.current!);
                    const mediaPromise = newPost!.media && !newPost!.mediaResolved && getMedia(newPost!.postId, newPost!.media, rpcClientRef.current!);

                    const posterPromise = getPosterPromise(
                        newPost!.poster,
                        postersRef,
                        findPostsWithRef.current === 'indexer-api',
                        rpcClientRef.current!,
                        indexerApiUrlRef,
                    );

                    posterPromise && posterPromises.push(posterPromise);
                    messagePromise && messagePromises.push(messagePromise);
                    mediaPromise && mediaPromises.push(mediaPromise);

                    if (newPost!.postLevel === 'Post') {
                        newLatestPosts.push(newPost!.postId);
                    }

                    const newPostLatestActivity = getNewPostLatestActivity(
                        isRecurseForward,
                        newPost!,
                        postsRef,
                        postLatestActivityRef,
                    );

                    postLatestActivityRef.current = { ...postLatestActivityRef.current, ...newPostLatestActivity };

                    const newPosts = { [newPost!.postId]: newPost as Post };

                    const newReplyPosts: Record<string, string> = {};
                    const newForwardOrphanedReplyPosts: Record<string, string> = {};
                    const newBackwardOrphanedReplyPosts: Record<string, string> = {};
                    const newDeOrphanedReplyPosts: Record<string, string> = {};

                    const updatedDeorphanedPosts: Record<string, Post> = {};

                    if (newPost!.postLevel === 'Comment') {
                        const discussionPostId = newPost!.channelPostId;
                        const discussionPost = postsRef.current[discussionPostId];
                        const orphaned = !discussionPost || discussionPost.orphaned;

                        const channelId = discussPrefix + discussionPostId;
                        postsRef.current = { ...postsRef.current, [channelId]: { orphaned } as Post };

                        const replyToPost = postsRef.current[channelId];

                        saveReplyPostId(
                            newPost!.postId,
                            channelId,
                            replyToPost,
                            isRecurseForward,
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

                    } else {
                        const replyToPost = postsRef.current[newPost!.replyToPostId];

                        saveReplyPostId(
                            newPost!.postId,
                            newPost!.replyToPostId,
                            replyToPost,
                            isRecurseForward,
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

                        deOrphanReplyPosts(
                            newPost!.postId,
                            newPost!,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            postsRef.current,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                            newDeOrphanedReplyPosts,
                            updatedDeorphanedPosts,
                        );

                        deOrphanReplyPosts(
                            discussPrefix + newPost!.postId,
                            newPost!,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            postsRef.current,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                            newDeOrphanedReplyPosts,
                            updatedDeorphanedPosts,
                        );
                    }

                    postsRef.current = { ...postsRef.current, ...updatedDeorphanedPosts, ...newPosts };
                    replyPostsTreeRef.current = { ...replyPostsTreeRef.current, ...newReplyPosts };
                    deOrphanedReplyPostsTreeRef.current = { ...deOrphanedReplyPostsTreeRef.current, ...newDeOrphanedReplyPosts };
                    forwardOrphanedReplyPostsTreeRef.current = { ...forwardOrphanedReplyPostsTreeRef.current, ...newForwardOrphanedReplyPosts };
                    backwardOrphanedReplyPostsTreeRef.current = { ...backwardOrphanedReplyPostsTreeRef.current, ...newBackwardOrphanedReplyPosts };

                    const profileActivity = { ...(profileActivityRef.current[newPost!.poster] ?? defaultProfileActivity) };
                    if (newPost!.isLike) {
                        profileActivity.likes = isRecurseForward ? [newPost!.postId, ...profileActivity.likes] : [...profileActivity.likes, newPost!.postId];
                    }
                    if (newPost!.postLevel === 'Comment' && !newPost!.isLike) {
                        profileActivity.comments = isRecurseForward ? [newPost!.postId, ...profileActivity.comments] : [...profileActivity.comments, newPost!.postId];
                    }
                    if (newPost!.postLevel === 'Reply' && !newPost!.isLike) {
                        profileActivity.replies = isRecurseForward ? [newPost!.postId, ...profileActivity.replies] : [...profileActivity.replies, newPost!.postId];
                    }
                    if (newPost!.postLevel === 'Post' && !newPost!.isLike) {
                        profileActivity.posts = isRecurseForward ? [newPost!.postId, ...profileActivity.posts] : [...profileActivity.posts, newPost!.postId];
                    }
                    if (newPost!.media) {
                        profileActivity.media = isRecurseForward ? [newPost!.postId, ...profileActivity.media] : [...profileActivity.media, newPost!.postId];
                    }
                    profileActivityRef.current[newPost!.poster] = profileActivity;


                    let newPostActivities: string[] = [];

                    if (newPost!.poster === postersAddress.toLowerCase()) {
                        const postTips = postTipsRef.current[newPost!.postId];

                        if (postTips) {
                            const tips = postTips.tips;

                            for (let index = 0; index < tips.length; index++) {
                                const tip = tipsRef.current[tips[index]];
                                newPostActivities = [ ...newPostActivities, `${tip.timestamp}-${tip.postId}|${tip.txHash}-tip` ];
                            }
                        }
                    }

                    if (!newPost!.orphaned) {
                        newPostActivities = [ ...newPostActivities, ...getPostActivities(newPost!, postersAddress, postsRef) ];
                    }

                    const updatedDeorphanedPostsArray = Object.keys(updatedDeorphanedPosts);
                    for (let index = 0; index < updatedDeorphanedPostsArray.length; index++) {
                        const post = updatedDeorphanedPosts[updatedDeorphanedPostsArray[index]];
                        newPostActivities = post ? [ ...newPostActivities, ...getPostActivities(post, postersAddress, postsRef) ] : newPostActivities;
                    }

                    postActivityRef.current = [ ...postActivityRef.current, ...newPostActivities ];
                }

                await Promise.all(posterPromises);
                await resolveNewTextForPosts(messagePromises, postsRef);
                await resolveNewMediaForPosts(mediaPromises, postsRef);

                setLatestPosts((currentLatestPosts) => {
                    const latestPostsUpdated = isRecurseForward ? [...newLatestPosts!, ...currentLatestPosts] : [...currentLatestPosts, ...newLatestPosts!];

                    setLatestActivity(() => {
                        const latestActivityUpdated = latestPostsUpdated
                            .map((postId) => ({ postId, timestamp: postLatestActivityRef.current[postId] }))
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .map((post) => post.postId);

                        return latestActivityUpdated;
                    });

                    return latestPostsUpdated;
                });

                const lastValidTransaction = transactionsAccepted[transactionsAccepted.length - 1];
                let lastBlockHeight;

                if (isRecurseForward || isRecurseBackwardWithRpcOnly) {
                    lastBlockHeight = cachedEndBlockHeight ?? pendingBlock!;
                    partialPastBlockCapturedRef.current = { lastBlockHeight: 0, lastValidTxHash: '' };
                    setBlockCapturedRefState(lastBlockHeight);
                }

                if (isRecurseBackwardWithIndexerApi && lastValidTransaction) {
                    const { result: getTxResult, error: getTxError } = await getTxWithIdenaIndexerApi(indexerApiUrl, lastValidTransaction.txHash);

                    if (!getTxError && getTxResult) {
                        lastBlockHeight = getTxResult.blockHeight;
                    } else {
                        throw 'indexer api unavailable';
                    }

                    partialPastBlockCapturedRef.current = { lastBlockHeight, lastValidTxHash: lastValidTransaction.txHash };
                    setBlockCapturedRefState(lastBlockHeight);
                }

                if (!isRecurseForward && lastBlockHeight) {
                    let endBlock = lastBlockHeight;
                    let filteredTransactionsAccepted = transactionsAccepted;
                    let filteredTransactionsNextBlock: (EventTransaction | TransactionCached)[] = [];

                    if (isRecurseBackwardWithIndexerApi && lastValidTransaction) {
                        endBlock++;
                        filteredTransactionsAccepted = filteredTransactionsAccepted.filter((transaction) => transaction.timestamp > lastValidTransaction.timestamp);
                        const nextBlockTxsLength = transactionsAccepted.length - filteredTransactionsAccepted.length;
                        filteredTransactionsNextBlock = nextBlockTxsLength ? transactionsAccepted.slice(-nextBlockTxsLength) : [];
                    }

                    const firstBlockCaptured = initialBlock - 1;
                    if (endBlock <= firstBlockCaptured) {
                        const filterFn = (tx: EventTransaction | TransactionCached) => `${tx.txHash}-${tx.timestamp}}`;
                        const transactionTxHashArray = filteredTransactionsAccepted.map(filterFn);
                        const nextBlockTransactionTxHashArray = filteredTransactionsNextBlock.map(filterFn);
                        const indexerApiContinuationDetails = isRecurseBackwardWithIndexerApi ? { nextBlockTransactions: nextBlockTransactionTxHashArray, contract: pastContractAddressRef.current, continuationToken: continuationTokenRef.current } : undefined;
                        await addBlocksCapturedRange(firstBlockCaptured, endBlock, transactionTxHashArray, indexerApiContinuationDetails);
                    }
                }

                if (!isRecurseForward && lastBlockHeight && lastBlockHeight <= firstBlock) {
                    throw 'no more transactions';
                }

                if (isRecurseForward) {
                    const transactionTxHashArray = transactionsAccepted.map((transaction) => `${transaction.txHash}-${transaction.timestamp}`);
                    await addBlocksCapturedRange(pendingBlock!, pendingBlock! - 1, transactionTxHashArray);
                    (recurse as RecurseForward)();
                } else {
                    (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                }
            } catch(error) {
                console.error(error);
                if (error === 'no block') {
                    if (isRecurseForward) {
                        (recurse as RecurseForward)();
                    } else {
                        (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                    }
                } else if (error === 'no transactions') {
                    if (isRecurseForward) {
                        await addBlocksCapturedRange(pendingBlock!, pendingBlock! - 1, []);
                        (recurse as RecurseForward)();
                    } else {
                        (recurse as RecurseBackward)(Math.floor(Date.now() / 1000));
                    }
                } else if (!isRecurseForward && error === 'no more transactions') {
                    setNoMorePastBlocks(true);
                    setScanningPastBlocks(false);
                } else if (error === 'rpc unavailable') {
                    setScanningPastBlocks(false);
                    setNodeAvailable(false);
                } else if (error === 'indexer api unavailable') {
                    setScanningPastBlocks(false);
                    setIdenaIndexerApiUrlInvalid(true);
                } else {
                    setScanningPastBlocks(false);
                }
            }
        };
    };

    type RecurseForwardMessages = () => Promise<void>;
    useEffect(() => {
        const canUseIdenaApp = makePostsWith === 'idena-app' && !credentialsInvalid;
        const canUseRpc = makePostsWith === 'rpc' && !viewOnlyNode;

        let recurseForwardIntervalId: NodeJS.Timeout | undefined;

        if (initialBlock && nodeAvailable && (canUseIdenaApp || canUseRpc)) {
            (async function recurseForwardMessages() {
                if (nodeAvailableRef.current) {
                    const recurseDirection = 'forward';
                    recurseForwardIntervalId = setTimeout(messagesProcessorFactory(recurseDirection, recurseForwardMessages, latestMessagesForwardQueueRef), POLLING_INTERVAL);
                }
            } as RecurseForwardMessages)();

            return () => clearInterval(recurseForwardIntervalId);
        } else {
            recurseForwardIntervalId && clearInterval(recurseForwardIntervalId);
        }
    }, [initialBlock, nodeAvailable, makePostsWith, credentialsInvalid, viewOnlyNode]);

    type RecurseBackwardMessages = () => Promise<void>;
    useEffect(() => {
        const canUseIdenaApp = makePostsWith === 'idena-app' && !credentialsInvalid;
        const canUseRpc = makePostsWith === 'rpc' && !viewOnlyNode;

        let recurseBackwardIntervalId: NodeJS.Timeout | undefined;

        if (initialBlock && nodeAvailable && (canUseIdenaApp || canUseRpc) && messagesCacheLoaded) {
            (async function recurseBackwardMessages() {
                if (nodeAvailableRef.current && (scanningPastBlocks || latestMessagesBackwardQueueRef.current.length)) {
                    const recurseDirection = 'backward';
                    recurseBackwardIntervalId = setTimeout(messagesProcessorFactory(recurseDirection, recurseBackwardMessages, latestMessagesBackwardQueueRef), SCANNING_INTERVAL_MESSAGES);
                }
            } as RecurseBackwardMessages)();

            return () => clearInterval(recurseBackwardIntervalId);
        } else {
            recurseBackwardIntervalId && clearInterval(recurseBackwardIntervalId);
        }
    }, [initialBlock, nodeAvailable, makePostsWith, credentialsInvalid, viewOnlyNode, scanningPastBlocks, messagesCacheLoaded]);

    const messagesProcessorFactory = (
        recurseDirection: string,
        recurse: RecurseForwardMessages | RecurseBackwardMessages,
        latestMessagesQueueRef: React.RefObject<(EventTransaction | TransactionCached)[]>,
    ) => {
        const isRecurseForward = recurseDirection === 'forward';

        return async function messageProcessor() {

            try {
                const posterPromises = [];
                const messagePromises = [];
                const mediaPromises = [];
                const newMessages = [];

                const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
                const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;

                while (latestMessagesQueueRef.current.length) {
                    const firstMessage = latestMessagesQueueRef.current.shift();
                    const cachedTx = (firstMessage as TransactionCached).cachedItem;

                    const { newMessage, continued } = cachedTx ? { newMessage: (cachedTx as Message) } : await processMessage(
                        (firstMessage as EventTransaction),
                        encryptedPrivateKeyActual,
                        passwordyActual,
                        postersAddress,
                        messagesRef,
                        thisChannelId,
                    );

                    if (continued) {
                        if (continued === 'already-captured') {
                            // transactionsAccepted.push(firstMessage);
                        } else {
                            await cacheIgnore({ txHash: firstMessage!.txHash, method: firstMessage!.method, reason: 'non-compliance' });
                        }
                        continue;
                    }

                    const messagePromise = newMessage!.message && !newMessage!.messageResolved && getMessage(newMessage!.messageId, newMessage!.message, rpcClientRef.current!, newMessage!.textPassword);
                    const mediaPromise = newMessage!.media && !newMessage!.mediaResolved && getMedia(newMessage!.messageId, newMessage!.media, rpcClientRef.current!, newMessage!.mediaPassword);

                    const allParticipants = [ newMessage!.sender, ...newMessage!.participants ];

                    for (let index = 0; index < allParticipants.length; index++) {
                        const participant = allParticipants[index];

                        const posterPromise = getPosterPromise(
                            participant,
                            postersRef,
                            findPostsWithRef.current === 'indexer-api',
                            rpcClientRef.current!,
                            indexerApiUrlRef,
                        );
                        posterPromises.push(posterPromise);
                    }

                    const newReplyPosts: Record<string, string> = {};
                    const newForwardOrphanedReplyPosts: Record<string, string> = {};
                    const newBackwardOrphanedReplyPosts: Record<string, string> = {};
                    const newDeOrphanedReplyPosts: Record<string, string> = {};

                    const updatedMessages: Record<string, Message> = {};

                    if (newMessage!.isLike) {
                        const replyToMessage = messagesRef.current[newMessage!.replyToMessageId];

                        saveReplyPostId(
                            newMessage!.messageId,
                            messagePrefix + newMessage!.replyToMessageId,
                            replyToMessage,
                            isRecurseForward,
                            replyPostsTreeRef.current,
                            forwardOrphanedReplyPostsTreeRef.current,
                            backwardOrphanedReplyPostsTreeRef.current,
                            newReplyPosts,
                            newForwardOrphanedReplyPosts,
                            newBackwardOrphanedReplyPosts,
                        );

                        if (!isObjectEmpty(newForwardOrphanedReplyPosts) || !isObjectEmpty(newBackwardOrphanedReplyPosts)) {
                            newMessage!.orphaned = true;
                        }
                    }

                    deOrphanReplyPosts(
                        messagePrefix + newMessage!.messageId,
                        newMessage!,
                        forwardOrphanedReplyPostsTreeRef.current,
                        backwardOrphanedReplyPostsTreeRef.current,
                        messagesRef.current,
                        newForwardOrphanedReplyPosts,
                        newBackwardOrphanedReplyPosts,
                        newDeOrphanedReplyPosts,
                        updatedMessages,
                    );

                    messagePromise && messagePromises.push(messagePromise);
                    mediaPromise && mediaPromises.push(mediaPromise);

                    replyPostsTreeRef.current = { ...replyPostsTreeRef.current, ...newReplyPosts };
                    deOrphanedReplyPostsTreeRef.current = { ...deOrphanedReplyPostsTreeRef.current, ...newDeOrphanedReplyPosts };
                    messagesRef.current = { ...messagesRef.current, ...updatedMessages, [newMessage!.messageId]: newMessage! };
                    forwardOrphanedReplyPostsTreeRef.current = { ...forwardOrphanedReplyPostsTreeRef.current, ...newForwardOrphanedReplyPosts };
                    backwardOrphanedReplyPostsTreeRef.current = { ...backwardOrphanedReplyPostsTreeRef.current, ...newBackwardOrphanedReplyPosts };

                    newMessages.push(newMessage);
                }

                await Promise.all(posterPromises);
                await resolveNewTextForMessages(messagePromises, postersAddress, encryptedPrivateKeyActual, passwordyActual, messagesRef);
                await resolveNewMediaForMessages(mediaPromises, postersAddress, encryptedPrivateKeyActual, passwordyActual, messagesRef);

                const conversationKeys: string[] = [];

                for (let index = 0; index < newMessages.length; index++) {
                    const newMessage = newMessages[index] as Message;

                    const participants = newMessage.participants;
                    for (let index = 0; index < participants.length; index++) {
                        const participantAddress = participants[index];
                        const participant = postersRef.current[participantAddress];
                        if (participant && !participant.pubkey) {
                            const pubkey = findPostsWithRef.current === 'indexer-api'
                                ? await getPubkeyWithIdenaIndexerApi(indexerApiUrlRef.current, participantAddress)
                                : await getPubkeyWithRpc(rpcClientRef.current!, participantAddress);

                            postersRef.current = { ...postersRef.current, [participantAddress]: { ...participant, pubkey } };
                        }
                    }

                    const conversationKey = newMessage.conversationKey;
                    
                    const messages = isRecurseForward ? [ newMessage.messageId, ...(conversationsRef.current[conversationKey]?.messages ?? []) ] : [ ...(conversationsRef.current[conversationKey]?.messages ?? []), newMessage!.messageId ];
                    const conversation = { participants, messages };
                    conversationsRef.current = { ...conversationsRef.current, [conversationKey]: conversation };

                    conversationKeys.push(conversationKey);
                }

                setLatestConversationActivity((currentValue) => {
                    let newLatestConversationActivity = currentValue;
                    if (isRecurseForward) {
                        for (let index = 0; index < conversationKeys.length; index++) {
                            const conversationKey = conversationKeys[index];
                            const currentValueExcluding = newLatestConversationActivity.filter(item => item !== conversationKey);
                            newLatestConversationActivity = [ conversationKey, ...currentValueExcluding ];
                        }
                    } else {
                        for (let index = 0; index < conversationKeys.length; index++) {
                            const conversationKey = conversationKeys[index];
                            const conversationKeyExists = newLatestConversationActivity.includes(conversationKey);
                            newLatestConversationActivity = conversationKeyExists ? newLatestConversationActivity : [...newLatestConversationActivity, conversationKey];
                        }
                    }

                    return newLatestConversationActivity;
                });

            } catch (error) {
                // do nothing
            } finally {
                recurse();
            }
        };
    };

    useEffect(() => {
        let intervalSubmittingPost: NodeJS.Timeout;
        if (submittingPost || submittingLike || submittingTip || submittingMessage) {
            intervalSubmittingPost = setTimeout(() => {
                setSubmittingPost('');
                setSubmittingLike('');
                setSubmittingTip('');
                setSubmittingMessage('');
            }, SUBMITTING_POST_INTERVAL);
        }
        return () => clearInterval(intervalSubmittingPost);
    }, [submittingPost, submittingLike, submittingTip, submittingMessage]);

    useEffect(() => {
        setSubmitting(!!submittingPost || !!submittingLike || !!submittingTip || !!submittingMessage);
    }, [submittingPost, submittingLike, submittingTip, submittingMessage]);

    useEffect(() => {
        setInputPostDisabled((makePostsWith === 'rpc' && viewOnlyNode) || postersAddressInvalid);
    }, [viewOnlyNode, postersAddressInvalid]);

    const setPostMediaAttachmentHandler = async (attachmentId: string, file: File, ipfsUrl?: string) => {
        if (!supportedImageTypes.includes(file.type)) {
            alert('Media format not supported.');
            return;
        }

        if (makePostsWith === 'rpc' && file.size > MAX_POST_MEDIA_BYTES) {
            alert('1MB is the maximum size. This image is too large.');
            return;
        }

        if (makePostsWith === 'idena-app' && !ipfsUrl && file.size > MAX_POST_MEDIA_BYTES_WEBAPP) {
            alert('5KB is the maximum size when using the Idena App. Use RPC for images of up to 1MB.');
            return;
        }

        const newMedia = { file, ipfsUrl };

        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [attachmentId]: newMedia };
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
            const postMediaAttachment = postMediaAttachmentsRef.current[`post-${location}`];

            let { inputText, media, mediaType } = await getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

            if (!inputText && !postMediaAttachment) {
                alert('No text or media provided!');
                copyTxTextElement!.innerText = savedInnerText;
                copyTxHandlerEnabledRef.current = true;
                return;
            }

            if (postMediaAttachment?.ipfsUrl) {
                media = [postMediaAttachment.ipfsUrl];
                mediaType = [postMediaAttachment.file.type];
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
    };

    const submitPostHandler = async (location: string, replyToPostId?: string, channelId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot post!');
            return;
        }

        const postTextareaElement = document.getElementById(`post-input-${location}`) as HTMLTextAreaElement;
        const postMediaAttachment = postMediaAttachmentsRef.current[`post-${location}`];

        let { inputText, media, mediaType } = await getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

        if (!inputText && !postMediaAttachment) {
            alert('No text or media provided!');
            return;
        }

        if (makePostsWith === 'rpc' && storeTextIpfs && inputText) {
            const fileBytes = str2bytes(inputText);
            const cidAddress = await storeFileToIpfs(rpcClientRef.current!, fileBytes, postersAddressRef.current);

            if (!cidAddress) {
                alert('Something went wrong. Probably you have insufficient iDNA.');
            }
            
            inputText = cidAddress!;
        }

        if (makePostsWith === 'rpc' && postMediaAttachment && !postMediaAttachment.ipfsUrl) {
            if (storeMediaIpfs) {
                if (postMediaAttachment.file.size > MAX_POST_MEDIA_BYTES) {
                    alert('1MB is the maximum size. This image is too large.');
                    return;
                }

                const fileBytes = new Uint8Array(await postMediaAttachment.file.arrayBuffer());

                const cidAddress = await storeFileToIpfs(rpcClientRef.current!, fileBytes, postersAddressRef.current);

                if (!cidAddress) {
                    alert('Something went wrong. Probably you have insufficient iDNA.');
                }

                media = [cidAddress!];
                mediaType = [postMediaAttachment.file.type];
            } else {
                if (postMediaAttachment.file.size > MAX_POST_MEDIA_BYTES_WEBAPP) {
                    alert('5KB is the maximum size when storing on the blockchain. Store image on IPFS instead.');
                    return;
                }
            }
        }

        if (postMediaAttachment?.ipfsUrl) {
            media = [postMediaAttachment.ipfsUrl];
            mediaType = [postMediaAttachment.file.type];
        }

        postTextareaElement.value = '';
        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`post-${location}`]: undefined };

        setSubmittingPost(location);

        await submitPost(postersAddress, contractAddressCurrent, makePostMethod, inputText, media, mediaType, replyToPostId ?? null, channelId ?? null, makePostsWith, rpcClientRef.current!, callbackUrl);
    };

    const submitLikeHandler = async (emoji: string, location: string, replyToPostId?: string, channelId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot like!');
            return;
        }

        setSubmittingLike(location);

        await submitPost(postersAddress, contractAddressCurrent, makePostMethod, emoji, [], [], replyToPostId ?? null, channelId ?? null, makePostsWith, rpcClientRef.current!, callbackUrl);
    };

    const submitSendTipHandler = async (location: string, tipToPostId: string, tipAmount: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot tip!');
            return;
        }

        setSubmittingTip(location);

        await submitSendTip(postersAddress, contractAddressCurrent, sendTipMethod, tipToPostId, tipAmount, makePostsWith, rpcClientRef.current!, callbackUrl);
    };

    const copyMessageTxHandler = async (location: string, recipients: string[], replyToMessageId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot message!');
            return;
        }

        const copyTxTextElement = document.getElementById(`message-copytx-${location}`) as HTMLElement;
        const savedInnerText = copyTxTextElement!.innerText;

        if (copyTxHandlerEnabledRef.current) {
            copyTxHandlerEnabledRef.current = false;
            copyTxTextElement!.innerText = 'Copying';

            const messageTextareaElement = document.getElementById(`message-input-${location}`) as HTMLTextAreaElement;
            const postMediaAttachment = postMediaAttachmentsRef.current['message-' + location];

            let { inputText, media, mediaType } = await getTextAndMediaForPost(messageTextareaElement, postMediaAttachment);

            if (!inputText && !postMediaAttachment) {
                alert('No text or media provided!');
                copyTxTextElement!.innerText = savedInnerText;
                copyTxHandlerEnabledRef.current = true;
                return;
            }

            const textPassword = '';
            const mediaPassword = '';

            if (postMediaAttachment?.ipfsUrl) {
                media = [postMediaAttachment.ipfsUrl];
                mediaType = [postMediaAttachment.file.type];
            }

            const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
            const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
            const { message, rawMessageHash } = await encryptRecipientsMessage(
                postersAddress,
                recipients,
                inputText,
                textPassword,
                media,
                mediaType,
                mediaPassword,
                encryptedPrivateKeyActual,
                passwordyActual,
                postersRef,
                replyToMessageId,
            );

            messageTextareaElement.value = '';

            copyMessageTx(
                postersAddress,
                contractAddressCurrent,
                sendMessageMethod,
                message,
                rawMessageHash,
                rpcClientRef.current!,
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
    };

    const submitMessageHandler = async (location: string, recipients: string[], replyToMessageId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot message!');
            return;
        }

        const messageTextareaElement = document.getElementById(`message-input-${location}`) as HTMLTextAreaElement;
        const postMediaAttachment = postMediaAttachmentsRef.current[`message-${location}`];

        let { inputText, media, mediaType } = await getTextAndMediaForPost(messageTextareaElement, postMediaAttachment);

        if (!inputText && !postMediaAttachment) {
            alert('No text or media provided!');
            return;
        }

        let textPassword = '';
        let mediaPassword = '';

        if (makePostsWith === 'rpc' && storeTextIpfs && inputText) {

            const textBytes = str2bytes(inputText);

            const rawSecretKey = crypto.getRandomValues(new Uint8Array(32));

            // @ts-ignore: Uint8Array.toBase64 not recognized yet
            textPassword = rawSecretKey.toBase64();

            const combined = await encryptAESGCM(textBytes, rawSecretKey);

            const cidAddress = await storeFileToIpfs(rpcClientRef.current!, combined, postersAddressRef.current);

            if (!cidAddress) {
                alert('Something went wrong. Probably you have insufficient iDNA.');
            }
            
            inputText = cidAddress!;
        }

        if (makePostsWith === 'rpc' && postMediaAttachment && !postMediaAttachment.ipfsUrl) {
            if (storeMediaIpfs) {
                if (postMediaAttachment.file.size > MAX_POST_MEDIA_BYTES) {
                    alert('1MB is the maximum size. This image is too large.');
                    return;
                }

                const fileBytes = new Uint8Array(await postMediaAttachment.file.arrayBuffer());

                const rawSecretKey = crypto.getRandomValues(new Uint8Array(32));

                // @ts-ignore: Uint8Array.toBase64 not recognized yet
                mediaPassword = rawSecretKey.toBase64();

                const combined = await encryptAESGCM(fileBytes, rawSecretKey);

                const cidAddress = await storeFileToIpfs(rpcClientRef.current!, combined, postersAddressRef.current);

                if (!cidAddress) {
                    alert('Something went wrong. Probably you have insufficient iDNA.');
                }

                media = [cidAddress!];
                mediaType = [postMediaAttachment.file.type];
            } else {
                if (postMediaAttachment.file.size > MAX_POST_MEDIA_BYTES_WEBAPP) {
                    alert('5KB is the maximum size when storing on the blockchain. Store image on IPFS instead.');
                    return;
                }
            }
        }

        if (postMediaAttachment?.ipfsUrl) {
            media = [postMediaAttachment.ipfsUrl];
            mediaType = [postMediaAttachment.file.type];
        }

        const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
        const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
        const { message, rawMessageHash } = await encryptRecipientsMessage(
            postersAddress,
            recipients,
            inputText,
            textPassword,
            media,
            mediaType,
            mediaPassword,
            encryptedPrivateKeyActual,
            passwordyActual,
            postersRef,
            replyToMessageId,
        );

        messageTextareaElement.value = '';
        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };

        setSubmittingMessage(location);

        await submitMessage(postersAddress, contractAddressCurrent, sendMessageMethod, message, rawMessageHash, makePostsWith, rpcClientRef.current!, callbackUrl);
    };

    const submitMessageLikeHandler = async (emoji: string, location: string, recipients: string[], replyToMessageId: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot like!');
            return;
        }

        setSubmittingLike(location);

        const inputText = emoji;
        const media: string[] = [];
        const mediaType: string[] = [];
        const textPassword = '';
        const mediaPassword = '';

        const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
        const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
        const { message, rawMessageHash } = await encryptRecipientsMessage(
            postersAddress,
            recipients,
            inputText,
            textPassword,
            media,
            mediaType,
            mediaPassword,
            encryptedPrivateKeyActual,
            passwordyActual,
            postersRef,
            replyToMessageId,
        );

        await submitMessage(postersAddress, contractAddressCurrent, sendMessageMethod, message, rawMessageHash, makePostsWith, rpcClientRef.current!, callbackUrl);
    };

    const handleOpenLikesModal = (e: MouseEventLocal, likePosts: Post[]) => {
        e.stopPropagation();
        modalLikePostsRef.current = [ ...likePosts ];
        setModalOpen('likes');
    };

    const handleOpenTipsModal = (e: MouseEventLocal, txHashArray: string[]) => {
        e.stopPropagation();
        const tips = txHashArray.map(txHash => tipsRef.current[txHash]);
        modalTipsRef.current = [ ...tips ];
        setModalOpen('tips');
    };

    const handleOpenSendTipModal = (e: MouseEventLocal, location: string, tipToPost: Post) => {
        e.stopPropagation();

        const isBreakingChangeDisabled = tipToPost.timestamp <= breakingChanges.v12.timestamp;

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        (async function() {
            const { result: getBalanceResult } = await rpcClientRef.current!('dna_getBalance', [inputPostersAddress]);
            if (!getBalanceResult) {
                return;
            }
            setIdenaWalletBalance(getBalanceResult.balance);
        })();

        modalSendTipRef.current = { location, postId: tipToPost.postId };
        setModalOpen('sendTip');
    };

    const handleOpenAddMediaModal = (e: MouseEventLocal, location: string, source: string) => {
        e.stopPropagation();

        if (source === 'post') {
            const replyToPost = location !== 'main' && postsRef.current[location];

            const isBreakingChangeDisabled = replyToPost && replyToPost.timestamp <= breakingChanges.v12.timestamp;

            if (isBreakingChangeDisabled) {
                return;
            }
        }

        if (source === 'message') {
            if (messageSettingsInvalid) {
                return;
            }
        }

        if (inputPostDisabled || submitting) {
            return;
        }

        modalAddMediaRef.current = `${source}-${location}`;
        setModalOpen('addMedia');
    };

    const handleOpenRpcMakePostModal = (e: MouseEventLocal, location: string, replyToPostId?: string, channelId?: string) => {
        e.stopPropagation();

        if (!nodeAvailable) {
            alert('Node unavailable, cannot post!');
            return;
        }

        const replyToPost = location !== 'main' && postsRef.current[location];

        const isBreakingChangeDisabled = replyToPost && replyToPost.timestamp <= breakingChanges.v12.timestamp;

        if (inputPostDisabled || submitting || isBreakingChangeDisabled) {
            return;
        }

        modalRpcMakePostRef.current = { location, replyToPostId, channelId };
        setModalOpen('rpcMakePost');
    };

    const handleOpenRpcSendMessageModal = (location: string, recipients: string[], replyToMessageId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot message!');
            return;
        }

        if (messageSettingsInvalid) {
            return;
        }

        modalRpcSendMessageRef.current = { location, recipients, replyToMessageId };
        setModalOpen('rpcSendMessage');
    };

    const handleExpandImageModal = (e: MouseEventLocal, image: File, cid?: string) => {
        e.stopPropagation();
        modalExpandImageRef.current = { image, cid };
        setModalOpen('expandImage');
    };

    const handleSubmitPubkeyModal = (e: MouseEventLocal, address: string) => {
        e.stopPropagation();
        modalSubmitPubkeyRef.current = { address };
        setModalOpen('submitPubkey');
    };

    const addMediaHandler = async (attachmentId: string, file: File, ipfsUrl?: string) => {
        await setPostMediaAttachmentHandler(attachmentId, file, ipfsUrl);
        forceUpdate();
    };

    const footerLinks = (<>
        <a className="hover:underline" href={termsOfServiceUrl} target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <span aria-hidden="true">·</span>
        <a className="hover:underline" href={attributionsUrl} target="_blank" rel="noopener noreferrer">Attributions</a>
    </>);

    return (
        <div className="flex min-h-screen w-full justify-center">
            <header className="hidden flex-none sm:block">
                <div className="sticky top-0 flex h-screen w-[88px] flex-col overflow-y-auto no-scrollbar px-2 xl:w-[275px] xl:px-3">
                    <Link to="/" aria-label="Idena Social" title="Idena Social" className="mt-0.5 flex justify-center xl:justify-start">
                        <span className="flex h-16 items-center gap-3 px-2.5 xl:pr-5">
                            <span className="size-11 flex-none overflow-hidden rounded-full"><img className="size-full scale-125" src={WhatIsIdenaThumbPng} alt="" /></span>
                            <span className="hidden text-[26px]/8 font-extrabold xl:inline">Idena Social</span>
                        </span>
                    </Link>
                    <MenuComponent postersAddress={postersAddress} variant="sidebar" />
                    <section className="mt-14 hidden flex-none xl:block" aria-label="Blockchain">
                        <ScanBlocksComponent
                            currentBlockCaptured={currentBlockCaptured}
                            scanningPastBlocks={scanningPastBlocks}
                            setScanningPastBlocks={setScanningPastBlocks}
                            noMorePastBlocks={noMorePastBlocks}
                            pastBlockCaptured={pastBlockCaptured}
                            nodeAvailable={nodeAvailable}
                            variant="card"
                        />
                    </section>
                    <footer className="mt-auto hidden flex-wrap gap-x-3 gap-y-1 px-4 py-3 text-[13px]/4 text-ink-muted xl:flex">
                        {footerLinks}
                    </footer>
                </div>
            </header>
            <main className="min-h-screen w-full min-w-0 max-w-[600px] border-line pb-[calc(53px+env(safe-area-inset-bottom))] [--sticky-top:85px] sm:border-x sm:pb-0 lg:[--sticky-top:0px]">
                <div className="sticky top-0 z-20 h-(--sticky-top) bg-canvas/90 backdrop-blur-md lg:hidden">
                    <div className="flex gap-3 border-b border-line px-4 py-3">
                        <a className="flex-none" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">
                            <img className="size-10 rounded-lg bg-surface object-cover" src={currentAd?.thumb ?? defaultAd.thumb} alt={currentAd?.title ?? defaultAd.title} />
                        </a>
                        <div className="min-w-0 flex-1 text-[15px]/5">
                            <div className="flex items-baseline gap-2">
                                <p className="min-w-0 flex-1 truncate font-bold">{currentAd?.title ?? defaultAd.title}</p>
                                <p className="flex-none text-[13px] text-ink-muted">Ad</p>
                            </div>
                            <p className="truncate">{currentAd?.desc ?? defaultAd.desc}</p>
                            <a className="block w-fit max-w-full truncate text-accent hover:underline" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">{currentAd?.url ?? defaultAd.url}</a>
                        </div>
                    </div>
                </div>
                <div className="flex h-[53px] items-center border-b border-line px-4 sm:hidden">
                    <Link to="/" className="flex items-center gap-3">
                        <span className="size-8 flex-none overflow-hidden rounded-full"><img className="size-full scale-125" src={WhatIsIdenaThumbPng} alt="" /></span>
                        <span className="text-[19px] font-extrabold">Idena Social</span>
                    </Link>
                </div>
                <div className="xl:hidden">
                    <ScanBlocksComponent
                        currentBlockCaptured={currentBlockCaptured}
                        scanningPastBlocks={scanningPastBlocks}
                        setScanningPastBlocks={setScanningPastBlocks}
                        noMorePastBlocks={noMorePastBlocks}
                        pastBlockCaptured={pastBlockCaptured}
                        nodeAvailable={nodeAvailable}
                        variant="compact"
                    />
                    <footer className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-[13px]/4 text-ink-muted">
                        {footerLinks}
                    </footer>
                </div>
                <Outlet
                    context={{
                        inputNodeApplied,
                        nodeUrl,
                        setNodeUrl,
                        nodeAvailable,
                        nodeKey,
                        setNodeKey,
                        setInputNodeApplied,
                        makePostsWith,
                        handleMakePostsWithToggle,
                        viewOnlyNode,
                        inputPostersAddressApplied,
                        inputPostersAddress,
                        setInputPostersAddress,
                        postersAddressInvalid,
                        setInputPostersAddressApplied,
                        findPostsWith,
                        handleInputFindPostsWithToggle,
                        inputIdenaIndexerApiUrlApplied,
                        inputIdenaIndexerApiUrl,
                        setInputIdenaIndexerApiUrl,
                        indexerApiUrlInvalid,
                        setInputIdenaIndexerApiUrlApplied,
                        latestPosts,
                        latestActivity,
                        postsRef,
                        postersRef,
                        replyPostsTreeRef,
                        deOrphanedReplyPostsTreeRef,
                        discussPrefix,
                        messagePrefix,
                        SET_NEW_POSTS_ADDED_DELAY,
                        inputPostDisabled,
                        submitting,
                        copyPostTxHandler,
                        submitPostHandler,
                        submitLikeHandler,
                        copyMessageTxHandler,
                        submitMessageHandler,
                        submitMessageLikeHandler,
                        submittingPost,
                        submittingLike,
                        submittingTip,
                        submittingMessage,
                        browserStateHistoryRef,
                        setBrowserStateHistorySettings,
                        handleOpenLikesModal,
                        handleOpenTipsModal,
                        handleOpenSendTipModal,
                        handleOpenAddMediaModal,
                        handleOpenRpcMakePostModal,
                        handleOpenRpcSendMessageModal,
                        handleExpandImageModal,
                        handleSubmitPubkeyModal,
                        tipsRef,
                        postTipsRef,
                        postMediaAttachmentsRef,
                        rpcClientRef,
                        encryptedPrivateKey,
                        setEncryptedPrivateKey,
                        password,
                        setPassword,
                        inputCredentialsApplied,
                        credentialsInvalid,
                        saveEncryptedKey,
                        setSaveEncryptedKey,
                        savePassword,
                        setSavePassword,
                        setInputCredentialsApplied,
                        zeroAddress,
                        latestConversationActivity,
                        postersAddress,
                        conversationsRef,
                        messagesRef,
                        messageSettingsInvalid,
                        findPostsWithRef,
                        indexerApiUrlRef,
                        setMakePostsWith,
                        setIndexerApiUrl,
                        profileActivityRef,
                        postActivityRef,
                        noMorePastBlocks,
                    }}
                />
                {!['/settings'].includes(pathname) && <div>
                    <ScanBlocksComponent
                        currentBlockCaptured={currentBlockCaptured}
                        scanningPastBlocks={scanningPastBlocks}
                        setScanningPastBlocks={setScanningPastBlocks}
                        noMorePastBlocks={noMorePastBlocks}
                        pastBlockCaptured={pastBlockCaptured}
                        nodeAvailable={nodeAvailable}
                        variant="row"
                    />
                </div>}
                <footer className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-4 py-4 text-[13px]/4 text-ink-muted lg:hidden">
                    <a className="hover:underline" href={termsOfServiceUrl} target="_blank" rel="noopener noreferrer">Terms of Service</a>
                    <span aria-hidden="true">·</span>
                    <a className="hover:underline" href={attributionsUrl} target="_blank" rel="noopener noreferrer">Attributions</a>
                </footer>
            </main>
            <aside className="hidden w-[290px] flex-none -translate-x-5 lg:ml-6 lg:block xl:ml-8 xl:w-[350px]">
                <div className="sticky top-0 flex h-screen flex-col gap-3 pt-[22px] pb-3">
                    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto scrollbar-thin">
                        <section className="flex-none overflow-hidden" aria-label="Sponsored">
                            <a className="mx-4 block" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">
                                <img className="aspect-square w-full rounded-2xl border border-line bg-surface object-cover" src={currentAd?.media ?? defaultAd.media} alt={currentAd?.title ?? defaultAd.title} />
                            </a>
                            <div className="px-4 pt-3 text-[15px]/5">
                                <p className="font-bold">{currentAd?.title ?? defaultAd.title}</p>
                                <p>{currentAd?.desc ?? defaultAd.desc}</p>
                                <a className="block w-fit max-w-full truncate text-accent hover:underline" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">{currentAd?.url ?? defaultAd.url}</a>
                            </div>
                            <div className="grid grid-cols-2 gap-4 px-4 pt-3 pb-4 text-[13px]/5">
                                <div className="min-w-0">
                                    <p className="text-ink-muted">Sponsored by</p>
                                    <a className="flex items-center gap-1.5 hover:underline" href={`https://scan.idena.io/address/${currentAd?.author}`} target="_blank" rel="noopener noreferrer">
                                        <img className="size-5 flex-none rounded-full bg-surface" src={`https://robohash.org/${currentAd?.author}?set=set1`} alt="" />
                                        <span className="truncate font-bold">{getDisplayAddress(currentAd?.author || '')}</span>
                                    </a>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-ink-muted">Burnt, in 24 hr</p>
                                    <p className="truncate font-bold">{currentAd?.burnAmount} iDNA</p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="mt-auto flex flex-none items-center px-4 pb-3">
                        <ScrollToTopButtonComponent variant="fab" />
                    </div>
                </div>
            </aside>
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
                <MenuComponent postersAddress={postersAddress} variant="bottom" />
            </div>
            <ScrollToTopButtonComponent variant="fab" className="fixed right-4 bottom-[calc(69px+env(safe-area-inset-bottom))] z-30 sm:bottom-6 lg:hidden" />
            <div onClick={(e) => e.stopPropagation()}>
                <Modal
                    isOpen={!!modalOpen} 
                    onRequestClose={() => setModalOpen('')}
                    overlayClassName={modalOpen === 'expandImage' ? modalExpandImageClassNames.overlay : modalClassNames.overlay}
                    className={modalOpen === 'expandImage' ? modalExpandImageClassNames.content : modalClassNames.content}
                >
                    <button type="button" aria-label="Close" title="Close" className={`sticky top-2 z-10 mt-2 ml-2 -mb-11 flex size-9 cursor-pointer items-center justify-center rounded-full ${modalOpen === 'expandImage' ? modalExpandImageClassNames.closeButton : modalClassNames.closeButton}`} onClick={() => setModalOpen('')}>
                        <CloseIcon className="size-5" />
                    </button>
                    {modalOpen === 'likes' && <ModalLikesTipsComponent heading={'Likes'} modalItemsRef={modalLikePostsRef} postersRef={postersRef} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'tips' && <ModalLikesTipsComponent heading={'Tips'} modalItemsRef={modalTipsRef} postersRef={postersRef} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'sendTip' && <ModalSendTipComponent modalSendTipRef={modalSendTipRef} idenaWalletBalance={idenaWalletBalance} submitSendTipHandler={submitSendTipHandler} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'addMedia' && <ModalAddMediaComponent modalAddMediaRef={modalAddMediaRef} addMediaHandler={addMediaHandler} rpcClient={rpcClientRef.current!} postersAddress={postersAddress} makePostsWith={makePostsWith} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'rpcMakePost' && <ModalRpcMakePostComponent modalRpcMakePostRef={modalRpcMakePostRef} submitPostHandler={submitPostHandler} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'rpcSendMessage' && <ModalRpcSendMessageComponent modalRpcSendMessageRef={modalRpcSendMessageRef} submitMessageHandler={submitMessageHandler} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'expandImage' && <ModalExpandImageComponent modalExpandImageRef={modalExpandImageRef} />}
                    {modalOpen === 'submitPubkey' && <ModalSubmitPubkeyComponent modalSubmitPubkeyRef={modalSubmitPubkeyRef} postersRef={postersRef} closeModal={() => setModalOpen('')} />}
                </Modal>
            </div>
        </div>
    );
};

export default App;
