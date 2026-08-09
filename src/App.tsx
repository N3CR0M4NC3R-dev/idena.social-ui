import { useEffect, useReducer, useRef, useState } from 'react';
import Modal from 'react-modal';
import { hexToUint8Array } from 'idena-sdk-js-lite';
import { IdenaApprovedAds, type ApprovedAd } from 'idena-approved-ads';
import { keccak256, sha3_256 } from 'js-sha3';
import { encrypt } from 'eciesjs';
import { type Post, type Poster, type Tip, breakingChanges, getNewPosterAndPost, getReplyPosts, deOrphanReplyPosts, getBlockHeightFromTxHash, submitPost, processTip, submitSendTip, supportedImageTypes, storeFileToIpfs, getPastTxsWithIdenaIndexerApi, getRpcClient, type RpcClient, copyPostTx, getPostIdFromChannelId, getNewPostLatestActivity, getblockTxsWithIdenaIndexerApi, getBlockAtWithIdenaIndexerApi, getTransactionDetailsRpc, getTransactionDetailsIndexerApi, getLastBlockWithIdenaIndexerApi, submitMessage, processMessage, resolveNewPosters, resolveNewMessages, resolveNewMedia, copyMessageTx, type Message, getPubkeyWithIdenaIndexerApi, getPubkeyWithRpc } from './logic/asyncUtils';
import { decryptAESGCM, encryptAESGCM, extractPubkeyAddressFromPrivateKey, getDisplayAddress, getTextAndMediaForPost, getTimestampFromIndexerApi, isObjectEmpty, str2bytes } from './logic/utils';
import WhatIsIdenaPng from './assets/whatisidena.png';
import WhatIsIdenaThumbPng from './assets/whatisidena_thumb.png';
import menuWhiteSvg from './assets/menu-8-white.svg';
import { Link, Outlet, useLocation } from 'react-router';
import type { BrowserStateHistorySettings, EventTransaction, MouseEventLocal, PostMediaAttachment } from './App.exports';
import ModalLikesTipsComponent from './components/ModalLikesTipsComponent';
import ModalSendTipComponent from './components/ModalSendTipComponent';
import ModalAddMediaComponent from './components/ModalAddMediaComponent';
import ModalRpcMakePostComponent from './components/ModalRpcMakePostComponent';
import ModalExpandImageComponent from './components/ModalExpandImageComponent';
import MenuComponent from './components/MenuComponent';
import ModalRpcSendMessageComponent from './components/ModalRpcSendMessageComponent';
import ScanBlocksComponent from './components/ScanBlocksComponent';
import ModalSubmitPubkeyComponent from './components/ModalSubmitPubkeyComponent';

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
const postChannelRegex = new RegExp(String.raw`${discussPrefix}[\d]+$`, 'i');
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
    },
};

Modal.setAppElement('#root');

function App() {

    const location = useLocation();

    const { key: locationKey } = location;

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
    const partialPastBlockCapturedRef = useRef(0);
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
    const [submittingPost, setSubmittingPost] = useState<string>('');
    const [submittingLike, setSubmittingLike] = useState<string>('');
    const [submittingTip, setSubmittingTip] = useState<string>('');
    const [submittingMessage, setSubmittingMessage] = useState<string>('');
    const [inputPostDisabled, setInputPostDisabled] = useState<boolean>(false);
    const browserStateHistoryRef = useRef<Record<string, BrowserStateHistorySettings>>({});
    const postMediaAttachmentsRef = useRef<Record<string, PostMediaAttachment | undefined>>({});
    const copyTxHandlerEnabledRef = useRef<boolean>(true);
    const tipsRef = useRef<Record<string, { totalAmount: number, tips: Tip[] }>>({});
    const [idenaWalletBalance, setIdenaWalletBalance] = useState<string>('0');
    const postLatestActivityRef = useRef({} as Record<string, number>);
    const latestMessagesForwardQueueRef = useRef([] as EventTransaction[]);
    const latestMessagesBackwardQueueRef = useRef([] as EventTransaction[]);
    const [latestConversationActivity, setLatestConversationActivity] = useState<string[]>([]); // ['0x011', '0x022']
    const conversationsRef = useRef<Record<string, string[]>>({}); // { '0x011': ['messageId1', 'messageId2', 'messageId3'], }
    const messagesRef = useRef<Record<string, Message>>({});

    // modals
    const [modalOpen, setModalOpen] = useState<string>('');
    const modalLikePostsRef = useRef<Post[]>([]);
    const modalTipsRef = useRef<Tip[]>([]);
    const modalSendTipRef = useRef<Post>(undefined);
    const modalAddMediaRef = useRef<string>('');
    const modalRpcMakePostRef = useRef<{ location: string, replyToPostId?: string, channelId?: string }>({ location: '' });
    const modalRpcSendMessageRef = useRef<{ location: string, recipient: string, replyToMessageId?: string }>({ location: '', recipient: '' });
    const modalExpandImageRef = useRef<{ dataUrl?: string, cid?: string }>({});
    const modalSubmitPubkeyRef = useRef<{ address: string }>({ address: '' });

    // miscellaneous
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


    const setBrowserStateHistorySettings = (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => {
        browserStateHistoryRef.current = {
            ...browserStateHistoryRef.current,
            [locationKey]: {
                ...browserStateHistoryRef.current[locationKey] ?? {},
                ...pageDomSetting,
            }
        };

        rerender && forceUpdate();
    }

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

            localStorage.setItem('nodeUrl', idenaNodeUrl);
            localStorage.setItem('nodeKey', idenaNodeApiKey);

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
        if (inputNodeApplied) {
            setRpcClient(nodeUrl, nodeKey, setNodeAvailable);
        }
    }, [inputNodeApplied]);

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

        if (initialBlock && nodeAvailable) {
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
            recurseForwardIntervalId && clearInterval(recurseForwardIntervalId)
        }
    }, [initialBlock, nodeAvailable]);

    type RecurseBackward = (time: number) => Promise<void>;
    useEffect(() => {
        let recurseBackwardIntervalId: NodeJS.Timeout | undefined;

        if (scanningPastBlocks && initialBlock && nodeAvailable) {
            const timeNow = Math.floor(Date.now() / 1000);
            const ttl = timeNow + SCAN_PAST_POSTS_TTL;

            (async function recurseBackward(time: number) {
                if (scanningPastBlocksRef.current && nodeAvailableRef.current && time < ttl) {
                    const recurseDirection = 'backward';
                    const contentSource = findPostsWithRef.current === 'rpc' ? 'rpc' : 'indexer-api';
                    const contractAddress = pastContractAddressRef!.current;
                    const pendingBlock = pastBlockCapturedRef.current ? (partialPastBlockCapturedRef.current ? partialPastBlockCapturedRef.current : pastBlockCapturedRef.current - 1) : initialBlock - 1;
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(recurseDirection, contentSource, recurseBackward, setPastBlockCaptured, pastBlockCapturedRef, contractAddress, pendingBlock), SCANNING_INTERVAL);
                } else {
                    setScanningPastBlocks(false);
                }
            } as RecurseBackward)(timeNow);

            return () => clearInterval(recurseBackwardIntervalId);
        } else {
            recurseBackwardIntervalId && clearInterval(recurseBackwardIntervalId);
        }
    }, [scanningPastBlocks, initialBlock, nodeAvailable]);

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
        return async function postFinder() {
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

            try {
                let transactions = [];

                if (isRecurseForwardWithRpcOnly || isRecurseBackwardWithRpcOnly) {
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
                    const { result, continuationToken, error } = await getPastTxsWithIdenaIndexerApi(indexerApiUrl, pastContractAddressRef!.current, INDEXER_API_ITEMS_LIMIT, continuationTokenRef!.current);
                    
                    if (error) {
                        throw 'indexer api unavailable';
                    }

                    transactions = result
                        ?.filter((balanceUpdate: any) => balanceUpdate.type === 'CallContract' && allMethods.includes(balanceUpdate.txReceipt.method) && balanceUpdate.from === balanceUpdate.address && balanceUpdate.txReceipt.success === true)
                        .map((balanceUpdate: any) => ({ txHash: balanceUpdate.hash, timestamp: getTimestampFromIndexerApi(balanceUpdate.timestamp) }))
                    ?? [];

                    if (!continuationTokenRef!.current) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < initialBlockTimestamp);
                    }

                    const isCurrentContract = pastContractAddressRef!.current === contractAddressCurrent;
                    const isContractAddress5 = pastContractAddressRef!.current === contractAddress5;
                    const isContractAddress4 = pastContractAddressRef!.current === contractAddress4;
                    const isContractAddress3 = pastContractAddressRef!.current === contractAddress3;
                    const isContractAddress2 = pastContractAddressRef!.current === contractAddress2;
                    const isContractAddress1 = pastContractAddressRef!.current === contractAddress1;

                    if (isContractAddress5) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < breakingChanges.v12.timestamp);
                    } else if (isContractAddress4) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < breakingChanges.v11.timestamp);
                    } else if (isContractAddress3) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < breakingChanges.v10.timestamp);
                    } else if (isContractAddress2) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < breakingChanges.v9.timestamp);
                    } else if (isContractAddress1) {
                        transactions = transactions.filter((balanceUpdate: any) => balanceUpdate.timestamp < breakingChanges.v5.timestamp);
                    }

                    if (continuationToken) {
                        continuationTokenRef!.current = continuationToken;
                    } else {
                        if (isCurrentContract) {
                            pastContractAddressRef!.current = contractAddress5;
                            continuationTokenRef!.current = undefined;
                        } else if (isContractAddress5) {
                            pastContractAddressRef!.current = contractAddress4;
                            continuationTokenRef!.current = undefined;
                        } else if (isContractAddress4) {
                            pastContractAddressRef!.current = contractAddress3;
                            continuationTokenRef!.current = undefined;
                        } else if (isContractAddress3) {
                            pastContractAddressRef!.current = contractAddress2;
                            continuationTokenRef!.current = undefined;
                        } else if (isContractAddress2) {
                            pastContractAddressRef!.current = contractAddress1;
                            continuationTokenRef!.current = undefined;
                        } else {
                            continuationTokenRef!.current = 'finished processing';
                        }
                    }

                } else {
                    throw 'this should not happen';
                }

                const transactionsWithDetails: EventTransaction[] = isContentSourceRpc ?
                    await getTransactionDetailsRpc(transactions, contractAddress, allMethods, rpcClientRef.current!)
                    :
                    await getTransactionDetailsIndexerApi(transactions, indexerApiUrl);

                let lastValidTransaction;

                const newLatestPosts: string[] = [];

                let newReplyPostsCollection = {};

                const postersPromised: string[] = [];
                const posterPromises = [];
                const messagePromises = [];
                const mediaPromises = [];

                for (let index = 0; index < transactionsWithDetails.length; index++) {
                    const transaction = transactionsWithDetails[index];

                    if ([sendTipMethod].includes(transaction.method)) {
                        const { postId, newTip, updatedPostTips, posterPromise } = await processTip(transaction, rpcClientRef.current!, tipsRef, postersRef, isRecurseForward, postersPromised, findPostsWithRef, indexerApiUrlRef);
                        tipsRef.current = { ...tipsRef.current, [postId]: updatedPostTips };

                        posterPromise && posterPromises.push(posterPromise);

                        lastValidTransaction = transaction;

                        // transient Post representation of a Tip
                        const newPost = {
                            postId: newTip.txHash,
                            replyToPostId: postId,
                            timestamp: newTip.timestamp,
                        } as Post;

                        const newPostLatestActivity = getNewPostLatestActivity(
                            isRecurseForward,
                            newPost!,
                            postsRef,
                            postLatestActivityRef,
                            postChannelRegex,
                            discussPrefix,
                        );

                        postLatestActivityRef.current = { ...postLatestActivityRef.current, ...newPostLatestActivity };

                        continue;
                    }

                    if ([sendMessageMethod].includes(transaction.method)) {

                        if (transaction.timestamp > breakingChanges.v12.timestamp) {
                            if (isRecurseForward) {
                                latestMessagesForwardQueueRef.current = [ ...latestMessagesForwardQueueRef.current, transaction ];
                            } else {
                                latestMessagesBackwardQueueRef.current = [ ...latestMessagesBackwardQueueRef.current, transaction ];
                            }
                        }

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
                        postersPromised,
                        findPostsWithRef,
                        indexerApiUrlRef,
                    );

                    if (continued) {
                        continue;
                    }

                    lastValidTransaction = transaction;

                    posterPromise && posterPromises.push(posterPromise);
                    messagePromise && messagePromises.push(messagePromise);
                    mediaPromise && mediaPromises.push(mediaPromise);

                    const isTopLevelPost = !newPost!.replyToPostId && newPost!.channelId === thisChannelId;

                    if (isTopLevelPost) {
                        newLatestPosts.push(newPost!.postId);
                    }

                    const newPostLatestActivity = getNewPostLatestActivity(
                        isRecurseForward,
                        newPost!,
                        postsRef,
                        postLatestActivityRef,
                        postChannelRegex,
                        discussPrefix,
                    );

                    postLatestActivityRef.current = { ...postLatestActivityRef.current, ...newPostLatestActivity };

                    const newPosts = { [newPost!.postId]: newPost as Post };

                    const newReplyPosts: Record<string, string> = {};
                    const newForwardOrphanedReplyPosts: Record<string, string> = {};
                    const newBackwardOrphanedReplyPosts: Record<string, string> = {};
                    const newDeOrphanedReplyPosts: Record<string, string> = {};

                    const updatedPosts: Record<string, Post> = {};

                    if (postChannelRegex.test(newPost!.channelId)) {
                        const discussionPostId = getPostIdFromChannelId(newPost!.timestamp, newPost!.channelId, discussPrefix);
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

                await resolveNewPosters(posterPromises, postersRef);
                await resolveNewMessages(messagePromises, postsRef);
                await resolveNewMedia(mediaPromises, postsRef);

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
                    setNodeAvailable(false);
                } else if (error === 'indexer api unavailable') {
                    setScanningPastBlocks(false);
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

        if (initialBlock && nodeAvailable && (canUseIdenaApp || canUseRpc)) {
            (async function recurseBackwardMessages() {
                if (nodeAvailableRef.current && (scanningPastBlocks || latestMessagesBackwardQueueRef.current.length)) {
                    const recurseDirection = 'backward';
                    recurseBackwardIntervalId = setTimeout(messagesProcessorFactory(recurseDirection, recurseBackwardMessages, latestMessagesBackwardQueueRef), POLLING_INTERVAL);
                }
            } as RecurseBackwardMessages)();

            return () => clearInterval(recurseBackwardIntervalId);
        } else {
            recurseBackwardIntervalId && clearInterval(recurseBackwardIntervalId);
        }
    }, [initialBlock, nodeAvailable, makePostsWith, credentialsInvalid, viewOnlyNode, scanningPastBlocks]);

    const messagesProcessorFactory = (
        recurseDirection: string,
        recurse: RecurseForwardMessages | RecurseBackwardMessages,
        latestMessagesQueueRef: React.RefObject<EventTransaction[]>,
    ) => {
        return async function messageProcessor() {
            const isRecurseForward = recurseDirection === 'forward';

            try {
                const postersPromised: string[] = [];
                const posterPromises = [];
                const messagePromises = [];
                const mediaPromises = [];
                const newMessages = [];

                const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
                const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;

                while (latestMessagesQueueRef.current.length) {
                    const firstMessage = latestMessagesQueueRef.current.shift();

                    const { newMessage, posterPromise, mediaPromise, messagePromise, continued } = await processMessage(
                        firstMessage!,
                        encryptedPrivateKeyActual,
                        passwordyActual,
                        postersAddress,
                        messagesRef,
                        thisChannelId,
                        postersRef,
                        rpcClientRef,
                        postersPromised,
                        findPostsWithRef,
                        indexerApiUrlRef,
                    );

                    if (continued) {
                        continue;
                    }

                    posterPromise && posterPromises.push(posterPromise);
                    messagePromise && messagePromises.push(messagePromise);
                    mediaPromise && mediaPromises.push(mediaPromise);

                    messagesRef.current = { ...messagesRef.current, [newMessage!.messageId]: newMessage! };
                    newMessages.push(newMessage);
                }

                await resolveNewPosters(posterPromises, postersRef);
                await resolveNewMessages(messagePromises, null, messagesRef);
                await resolveNewMedia(mediaPromises, null, messagesRef);

                const conversationKeys: string[] = [];

                for (let index = 0; index < newMessages.length; index++) {
                    const newMessage = newMessages[index] as Message;
                    const conversationKey = newMessage.participants.map((item: string) => item.toLowerCase()).sort().join('-');
                    const conversation = isRecurseForward ? [ newMessage.messageId, ...(conversationsRef.current[conversationKey] ?? []) ] : [ ...(conversationsRef.current[conversationKey] ?? []), newMessage!.messageId ];
                    conversationsRef.current = { ...conversationsRef.current, [conversationKey]: conversation };
                    conversationKeys.push(conversationKey);

                    const allParticipants = [newMessage.sender, ...newMessage.participants];
                    for (let index = 0; index < allParticipants.length; index++) {
                        const participantAddress = allParticipants[index];
                        const participant = postersRef.current[participantAddress];
                        if (participant && !participant.pubkey) {
                            if (findPostsWithRef.current === 'indexer-api') {
                                const pubkey = await getPubkeyWithIdenaIndexerApi(indexerApiUrlRef.current, participantAddress);
                                participant.pubkey = pubkey ?? '';
                            } else {
                                const pubkey = await getPubkeyWithRpc(rpcClientRef.current!, participantAddress);
                                participant.pubkey = pubkey ?? '';
                            }
                        }
                    }
                }

                setLatestConversationActivity((currentValue) => {
                    let newLatestConversationActivity = currentValue;
                    if (isRecurseForward) {
                        for (let index = 0; index < conversationKeys.length; index++) {
                            const conversationKey = conversationKeys[index];
                            const currentValueExcluding = newLatestConversationActivity.filter(item => item !== conversationKey);
                            newLatestConversationActivity = [ conversationKey, ...currentValueExcluding ]
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
        }
    }

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
        setInputPostDisabled(!!submittingPost || !!submittingLike || !!submittingTip || !!submittingMessage || (makePostsWith === 'rpc' && viewOnlyNode) || postersAddressInvalid);
    }, [submittingPost, submittingLike, submittingTip, submittingMessage, makePostsWith, viewOnlyNode, postersAddressInvalid]);

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

        try {
            const imageDataUrl = await new Promise<string>((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.onload = () => resolve(fileReader.result as string);
                fileReader.onerror = () => reject(new Error('Failed to read image file.'));
                fileReader.readAsDataURL(file);
            });

            const newMedia = { dataUrl: imageDataUrl, file, ipfsUrl };

            postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [attachmentId]: newMedia };
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
            const postMediaAttachment = postMediaAttachmentsRef.current[`post-${location}`];

            let { inputText, media, mediaType } = getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

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
    }

    const submitPostHandler = async (location: string, replyToPostId?: string, channelId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot post!');
            return;
        }

        const postTextareaElement = document.getElementById(`post-input-${location}`) as HTMLTextAreaElement;
        const postMediaAttachment = postMediaAttachmentsRef.current[`post-${location}`];

        let { inputText, media, mediaType } = getTextAndMediaForPost(postTextareaElement, postMediaAttachment);

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

    const copyMessageTxHandler = async (location: string, recipient: string, replyToMessageId?: string) => {
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

            let { inputText, media, mediaType } = getTextAndMediaForPost(messageTextareaElement, postMediaAttachment);

            if (!inputText && !postMediaAttachment) {
                alert('No text or media provided!');
                copyTxTextElement!.innerText = savedInnerText;
                copyTxHandlerEnabledRef.current = true;
                return;
            }

            let textPassword = '';
            let mediaPassword = '';

            if (postMediaAttachment?.ipfsUrl) {
                media = [postMediaAttachment.ipfsUrl];
                mediaType = [postMediaAttachment.file.type];
            }

            const recipientDetails = postersRef.current[recipient.toLowerCase()];

            // [participants, channelId, message, textPassword (AES-GCM encryption), replyToMessageId, media, mediaType, mediaPassword (AES-GCM encryption), tags]
            const rawMessage = JSON.stringify([[postersAddress.toLowerCase(), recipient.toLowerCase()], '', inputText, textPassword, replyToMessageId ?? '', media, mediaType, mediaPassword, []]);
            const rawMessageHash = keccak256(rawMessage);

            const encodedMessage = new TextEncoder().encode(rawMessage);
            const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
            const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
            const keyData = new Uint8Array(sha3_256.array(passwordyActual));
            const myPrivateKey = await decryptAESGCM(encryptedPrivateKeyActual, keyData);
            const { pubkey: myPubkey } = extractPubkeyAddressFromPrivateKey(myPrivateKey);
            const myEncryptedMessage = await encrypt(hexToUint8Array(myPubkey), encodedMessage);
            // @ts-ignore: Uint8Array.toBase64 not recognized yet
            const mySerializedEncryptedMessage = myEncryptedMessage.toBase64();

            const recipientEncryptedMessage = await encrypt(hexToUint8Array(recipientDetails.pubkey), encodedMessage);
            // @ts-ignore: Uint8Array.toBase64 not recognized yet
            const recipientSerializedEncryptedMessage = recipientEncryptedMessage.toBase64();

            const message = [mySerializedEncryptedMessage, recipientSerializedEncryptedMessage];

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
    }

    const submitMessageHandler = async (location: string, recipient: string, replyToMessageId?: string, storeTextIpfs?: boolean, storeMediaIpfs?: boolean) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot message!');
            return;
        }

        const messageTextareaElement = document.getElementById(`message-input-${location}`) as HTMLTextAreaElement;
        const postMediaAttachment = postMediaAttachmentsRef.current[`message-${location}`];

        let { inputText, media, mediaType } = getTextAndMediaForPost(messageTextareaElement, postMediaAttachment);

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

        const recipientDetails = postersRef.current[recipient.toLowerCase()];

        // [participants, channelId, message, textPassword (AES-GCM encryption), replyToMessageId, media, mediaType, mediaPassword (AES-GCM encryption), tags]
        const rawMessage = JSON.stringify([[postersAddress.toLowerCase(), recipient.toLowerCase()], '', inputText, textPassword, replyToMessageId ?? '', media, mediaType, mediaPassword, []]);
        const rawMessageHash = keccak256(rawMessage);

        const encodedMessage = new TextEncoder().encode(rawMessage);

        const encryptedPrivateKeyActual = makePostsWith === 'rpc' ? encryptedPrivateKeyFromNodeRef.current : encryptedPrivateKey;
        const passwordyActual = makePostsWith === 'rpc' ? passwordFromNodeRef.current : password;
        const keyData = new Uint8Array(sha3_256.array(passwordyActual));
        const myPrivateKey = await decryptAESGCM(encryptedPrivateKeyActual, keyData);
        const { pubkey: myPubkey } = extractPubkeyAddressFromPrivateKey(myPrivateKey);
        const myEncryptedMessage = await encrypt(hexToUint8Array(myPubkey), encodedMessage);
        // @ts-ignore: Uint8Array.toBase64 not recognized yet
        const mySerializedEncryptedMessage = myEncryptedMessage.toBase64();

        const recipientEncryptedMessage = await encrypt(hexToUint8Array(recipientDetails.pubkey), encodedMessage);
        // @ts-ignore: Uint8Array.toBase64 not recognized yet
        const recipientSerializedEncryptedMessage = recipientEncryptedMessage.toBase64();

        const message = [mySerializedEncryptedMessage, recipientSerializedEncryptedMessage];

        messageTextareaElement.value = '';
        postMediaAttachmentsRef.current = { ...postMediaAttachmentsRef.current, [`message-${location}`]: undefined };

        setSubmittingMessage(location);

        await submitMessage(postersAddress, contractAddressCurrent, sendMessageMethod, message, rawMessageHash, makePostsWith, rpcClientRef.current!, callbackUrl);
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

        const isBreakingChangeDisabled = tipToPost.timestamp <= breakingChanges.v12.timestamp;

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

        if (inputPostDisabled) {
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

        if (inputPostDisabled || isBreakingChangeDisabled) {
            return;
        }

        modalRpcMakePostRef.current = { location, replyToPostId, channelId };
        setModalOpen('rpcMakePost');
    };

    const handleOpenRpcSendMessageModal = (location: string, recipient: string, replyToMessageId?: string) => {
        if (!nodeAvailable) {
            alert('Node unavailable, cannot message!');
            return;
        }

        if (messageSettingsInvalid) {
            return;
        }

        modalRpcSendMessageRef.current = { location, recipient, replyToMessageId };
        setModalOpen('rpcSendMessage');
    };

    const handleExpandImageModal = (e: MouseEventLocal, dataUrl: string, cid?: string) => {
        e.stopPropagation();
        modalExpandImageRef.current = { dataUrl, cid };
        setModalOpen('expandImage');
    };

    const handleSubmitPubkeyModal = (address: string) => {
        modalSubmitPubkeyRef.current = { address };
        setModalOpen('submitPubkey');
    };

    const addMediaHandler = async (attachmentId: string, file: File, ipfsUrl?: string) => {
        await setPostMediaAttachmentHandler(attachmentId, file, ipfsUrl);
        forceUpdate();
    };

    return (
        <main className="w-full flex flex-row justify-center p-2">
            <div className="hidden lg:flex flex-1 justify-end">
                <div className="w-[200px] min-w-[200px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3">
                        <Link to="/">idena.social</Link>
                    </div>
                    <MenuComponent postersAddress={postersAddress} />
                    <div className="mb-3 text-gray-500">
                        <div className="flex flex-row gap-1 whitespace-nowrap">
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={termsOfServiceUrl} target="_blank" rel="noopener noreferrer">Terms of Service</a></p>
                            <p className="text-[14px]/7">|</p>
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={attributionsUrl} target="_blank" rel="noopener noreferrer">Attributions</a></p>
                        </div>
                    </div>
                    <ScanBlocksComponent
                        currentBlockCaptured={currentBlockCaptured}
                        scanningPastBlocks={scanningPastBlocks}
                        setScanningPastBlocks={setScanningPastBlocks}
                        noMorePastBlocks={noMorePastBlocks}
                        pastBlockCaptured={pastBlockCaptured}
                        nodeAvailable={nodeAvailable}
                    />
                </div>
            </div>
            <div className="w-full md:w-[500px] flex-none">
                <div className="lg:hidden flex flex-row gap-2 text-[12px] bg-stone-700 rounded-md">
                    <div className="m-1 min-w-[70px]">
                        <a href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">
                            <img className="rounded-md h-[70px] w-[70px]" src={currentAd?.thumb ?? defaultAd.thumb} />
                        </a>
                    </div>
                    <div className="flex flex-col justify-center whitespace-nowrap overflow-hidden">
                        <div className="px-1 font-[700] text-gray-400"><p>{currentAd?.title ?? defaultAd.title}</p></div>
                        <div className="px-1"><p>{currentAd?.desc ?? defaultAd.desc}</p></div>
                        <div className="px-1 text-blue-400"><a className="hover:underline" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">{currentAd?.url ?? defaultAd.url}</a></div>
                    </div>
                    <div className="flex-1 text-right"><p className="text-[12px] mt-1 mr-2">Ad</p></div>
                </div>
                <div className="lg:hidden my-2">
                    <div className="text-[26px] mb-1">
                        <Link to="/">idena.social</Link>
                    </div>
                    <div className="flex flex-row gap-3">
                        <div className="min-w-8">
                            <img src={menuWhiteSvg} className={'h-8 p-[5px] mr-0.5 inline-block rounded-md hover:bg-gray-400/30 hover:cursor-pointer' + (mobileMenuOpen ? ' bg-gray-400/30' : '')} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
                        </div>
                        <div className="flex flex-row gap-1 whitespace-nowrap">
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={termsOfServiceUrl} target="_blank" rel="noopener noreferrer">Terms of Service</a></p>
                            <p className="text-[14px]/7">|</p>
                            <p className="my-1 text-[14px]"><a className="hover:underline" href={attributionsUrl} target="_blank" rel="noopener noreferrer">Attributions</a></p>
                        </div>
                    </div>
                    {mobileMenuOpen && <div className="mt-2 mb-4">
                        <MenuComponent postersAddress={postersAddress} setMobileMenuOpen={setMobileMenuOpen} />
                    </div>}
                    <ScanBlocksComponent
                        currentBlockCaptured={currentBlockCaptured}
                        scanningPastBlocks={scanningPastBlocks}
                        setScanningPastBlocks={setScanningPastBlocks}
                        noMorePastBlocks={noMorePastBlocks}
                        pastBlockCaptured={pastBlockCaptured}
                        nodeAvailable={nodeAvailable}
                    />
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
                        SET_NEW_POSTS_ADDED_DELAY,
                        inputPostDisabled,
                        copyPostTxHandler,
                        submitPostHandler,
                        submitLikeHandler,
                        copyMessageTxHandler,
                        submitMessageHandler,
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
                    }}
                />
            </div>
            <div className="hidden lg:flex flex-1 justify-start">
                <div className="min-w-[320px] mt-3 mr-2 ml-8 flex flex-col text-[13px]">
                    <div className="flex flex-col h-[90px] justify-center">
                        <div className="px-1 font-[700] text-gray-400"><p>{currentAd?.title ?? defaultAd.title}</p></div>
                        <div className="px-1"><p>{currentAd?.desc ?? defaultAd.desc}</p></div>
                        <div className="px-1 text-blue-400"><a className="hover:underline" href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">{currentAd?.url ?? defaultAd.url}</a></div>
                    </div>
                    <div className="my-3">
                        <a href={currentAd?.url ?? defaultAd.url} target="_blank" rel="noopener noreferrer">
                            <img className="rounded-md h-[320px] w-[320px]" src={currentAd?.media ?? defaultAd.media} />
                        </a>
                    </div>
                    <div className="flex flex-row px-1">
                        <div className="w-16 flex-auto">
                            <div className="font-[600] text-gray-400"><p>Sponsored by</p></div>
                            <div>
                                <a className="flex flex-row items-center" href={`https://scan.idena.io/address/${currentAd?.author}`} target="_blank" rel="noopener noreferrer">
                                    <img className="-mt-0.5 -ml-1.5 h-5 w-5" src={`https://robohash.org/${currentAd?.author}?set=set1`} />
                                    <span>{getDisplayAddress(currentAd?.author || '')}</span>
                                </a>
                            </div>
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
                    {modalOpen === 'addMedia' && <ModalAddMediaComponent modalAddMediaRef={modalAddMediaRef} addMediaHandler={addMediaHandler} rpcClient={rpcClientRef.current!} postersAddress={postersAddress} makePostsWith={makePostsWith} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'rpcMakePost' && <ModalRpcMakePostComponent modalRpcMakePostRef={modalRpcMakePostRef} submitPostHandler={submitPostHandler} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'rpcSendMessage' && <ModalRpcSendMessageComponent modalRpcSendMessageRef={modalRpcSendMessageRef} submitMessageHandler={submitMessageHandler} closeModal={() => setModalOpen('')} />}
                    {modalOpen === 'expandImage' && <ModalExpandImageComponent modalExpandImageRef={modalExpandImageRef} />}
                    {modalOpen === 'submitPubkey' && <ModalSubmitPubkeyComponent modalSubmitPubkeyRef={modalSubmitPubkeyRef} postersRef={postersRef} closeModal={() => setModalOpen('')} />}
                    <div className="text-center"><button className="h-7 w-15 my-1 px-2 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => setModalOpen('')}>Close</button></div>
                </Modal>
            </div>
        </main>
    );
};

export default App;
