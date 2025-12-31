import { useEffect, useRef, useState } from 'react';
import {
    CallContractAttachment,
    contractArgumentFormat,
    hexToUint8Array,
    Transaction,
    transactionType,
} from 'idena-sdk-js-lite';
import { getApprovedAds, getMaxFee, getPastBlocksWithTxs, getRpcClient, type AdDetailsExtra, type RpcClient } from './logic/api';
import { calculateMaxFee, getDisplayAddress, getDisplayDateTime, getMessageLines, hex2str, sanitizeStr } from './logic/utils';

const idenaNodeUrl = 'https://restricted.idena.io';
const idenaNodeApiKey = 'idena-restricted-node-key';
const findPastBlocksUrlInit = 'https://api.idena.social/find-blocks-with-txs';
const contractAddress = '0x8d318630eB62A032d2f8073d74f05cbF7c6C87Ae';
const firstBlock = 10135621;
const makePostMethod = 'makePost';
const thisChannelId = '';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const callbackUrl = `${window.location.origin}/confirm-tx.html`;
const termsOfServiceUrl = `${window.location.origin}/terms-of-service.html`;

const POLLING_INTERVAL = 5000;
const SCANNING_INTERVAL = 10;
const SUBMITTING_POST_INTERVAL = 2000;
const POST_DELAY_MESSAGE_INTERVAL = 1 * 60 * 1000;
const ADS_INTERVAL = 10000;
const SCAN_POSTS_TTL = 0.5 * 60;

const DEBUG = false;

if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

type Post = { blockHeight: number, timestamp: number, postId: string, poster: string, message: string };
type Poster = { address: string, stake: string, age: number, pubkey: string, state: string, online: boolean };

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
    const [inputPost, setInputPost] = useState<string>('');
    const [submittingPost, setSubmittingPost] = useState<boolean>(false);
    const [postDelayMessage, setPostDelayMessage] = useState<boolean>(false);
    const [posts, setPosts] = useState<Post[]>([]);
    const [posters, setPosters] = useState<Poster[]>([]);
    const postersRef = useRef(posters);
    const [initialBlock, setInitialBlock] = useState<number>(0);
    const [pastBlockCaptured, setPastBlockCaptured] = useState<number>(0);
    const pastBlockCapturedRef = useRef(pastBlockCaptured);
    const [currentBlockCaptured, setCurrentBlockCaptured] = useState<number>(0);
    const currentBlockCapturedRef = useRef(currentBlockCaptured);
    const [scanningPastBlocks, setScanningPastBlocks] = useState<boolean>(false);
    const [viewMorePosts, setViewMorePosts] = useState<Record<string, boolean[]>>({});
    const [ads, setAds] = useState<AdDetailsExtra[]>([]);
    const [currentAd, setCurrentAd] = useState<AdDetailsExtra | null>(null);
    const currentAdRef = useRef(currentAd);
    const [useFindPastBlocksWithTxsApi, setUseFindPastBlocksWithTxsApi] = useState<boolean>(true);
    const useFindPastBlocksWithTxsApiRef = useRef(useFindPastBlocksWithTxsApi);
    const [pastBlocksWithTxs, setPastBlocksWithTxs] = useState<number[]>([]);
    const pastBlocksWithTxsRef = useRef(pastBlocksWithTxs);
    const [noMorePastBlocks, setNoMorePastBlocks] = useState<boolean>(false);
    const [findPastBlocksUrl, setFindPastBlocksUrl] = useState<string>(findPastBlocksUrlInit);
    const findPastBlocksUrlRef = useRef(findPastBlocksUrl);
    const [findPastBlocksUrlInvalid, setFindPastBlocksUrlInvalid] = useState<boolean>(false);
    const findPastBlocksUrlInvalidRef = useRef(findPastBlocksUrlInvalid);
    const [inputFindPastBlocksUrl, setInputFindPastBlocksUrl] = useState<string>(findPastBlocksUrlInit);
    const [inputFindPastBlocksUrlApplied, setInputFindPastBlocksUrlApplied] = useState<boolean>(true);

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

            const ads = await getApprovedAds(rpcClient);
            setAds(ads);
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
        if (inputFindPastBlocksUrlApplied && useFindPastBlocksWithTxsApi) {
            setFindPastBlocksUrl(inputFindPastBlocksUrl);

            (async function() {
                const { blocksWithTxs: pastBlocksWithTxsResult = [] } = await getPastBlocksWithTxs(inputFindPastBlocksUrl, 10135627);

                if (pastBlocksWithTxsResult.length === 1 && pastBlocksWithTxsResult[0] === 10135627) {
                    setFindPastBlocksUrlInvalid(false);
                } else {
                    setFindPastBlocksUrlInvalid(true);
                }
            })();
        }
    }, [inputFindPastBlocksUrlApplied]);

    useEffect(() => {
        setCurrentAd(ads[0]);
        if (ads.length) {
            setCurrentAd(ads[0]);

            let rotateAdsIntervalId: any;

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
        rpcClientRef.current = rpcClient;
    }, [rpcClient]);

    useEffect(() => {
        currentBlockCapturedRef.current = currentBlockCaptured;
    }, [currentBlockCaptured]);

    useEffect(() => {
        pastBlockCapturedRef.current = pastBlockCaptured;
    }, [pastBlockCaptured]);

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
        pastBlocksWithTxsRef.current = pastBlocksWithTxs;
    }, [pastBlocksWithTxs]);

    useEffect(() => {
        findPastBlocksUrlRef.current = findPastBlocksUrl;
    }, [findPastBlocksUrl]);

    useEffect(() => {
        findPastBlocksUrlInvalidRef.current = findPastBlocksUrlInvalid;
    }, [findPastBlocksUrlInvalid]);

    useEffect(() => {
        if (initialBlock) {
            setScanningPastBlocks(true);

            let recurseForwardIntervalId: any;

            (async function recurseForward() {
                recurseForwardIntervalId = setTimeout(postScannerFactory(true, recurseForward, currentBlockCapturedRef, setCurrentBlockCaptured), POLLING_INTERVAL);
            })();

            return () => clearInterval(recurseForwardIntervalId);
        }
    }, [initialBlock]);

    useEffect(() => {
        if (scanningPastBlocks) {
            let recurseBackwardIntervalId: any;

            const timeNow = Math.floor(Date.now() / 1000);
            const ttl = timeNow + SCAN_POSTS_TTL;
            (async function recurseBackward(time: number) {
                if (time < ttl) {
                    recurseBackwardIntervalId = setTimeout(postScannerFactory(false, recurseBackward, pastBlockCapturedRef, setPastBlockCaptured), SCANNING_INTERVAL);
                } else {
                    setScanningPastBlocks(false);
                }
            })(timeNow);

            return () => clearInterval(recurseBackwardIntervalId);
        }
    }, [scanningPastBlocks]);

    useEffect(() => {
        const messageDivs = document.getElementsByClassName('messageDiv');

        for (let index = 0; index < messageDivs.length; index++) {
            const div = messageDivs[index];

            if (div.scrollHeight > div.clientHeight) {
                setViewMorePosts(previous => {
                    if (!previous?.[div.id]) {
                        return { ...previous, [div.id]: [true, true] };
                    }
                    return previous;
                });
            }
        }

    }, [posts]);

    useEffect(() => {
        let intervalSubmittingPost: any;

        if (submittingPost) {
            intervalSubmittingPost = setTimeout(() => {
                setSubmittingPost(false);
            }, SUBMITTING_POST_INTERVAL);
        } else {
            setInputPost('');
        }

        return () => clearInterval(intervalSubmittingPost);
    }, [submittingPost]);

    useEffect(() => {
        let intervalPostDelayMessage: any;

        if (submittingPost) {
            setPostDelayMessage(true);
            intervalPostDelayMessage = setTimeout(() => {
                setPostDelayMessage(false);
            }, POST_DELAY_MESSAGE_INTERVAL);
        }

        return () => clearInterval(intervalPostDelayMessage);
    }, [submittingPost]);

    useEffect(() => {
        setInputPostDisabled(submittingPost || (inputUseRpc && viewOnlyNode) || postersAddressInvalid);
    }, [submittingPost, inputUseRpc, viewOnlyNode, postersAddressInvalid]);

    const submitPost = async () => {
        setSubmittingPost(true);

        const txAmount = 0.00001;
        const args = [
            {
                format: contractArgumentFormat.String,
                index: 0,
                value: JSON.stringify({ message: inputPost }),
            }
        ];

        const payload = new CallContractAttachment();
        payload.setArgs(args);
        payload.method = makePostMethod;

        const maxFeeResult = await getMaxFee(rpcClient, {
            from: postersAddress,
            to: contractAddress,
            type: transactionType.CallContractTx,
            amount: txAmount,
            payload: payload,
        });

        const { maxFeeDecimal, maxFeeDna } = calculateMaxFee(maxFeeResult, inputPost.length);

        if (inputUseRpc) {
            await rpcClient('contract_call', [
                {
                    from: postersAddress,
                    contract: contractAddress,
                    method: makePostMethod,
                    amount: txAmount,
                    args,
                    maxFee: maxFeeDecimal,
                }
            ]);
        } else {
            const { result: getBalanceResult } = await rpcClient('dna_getBalance', [postersAddress]);
            const { result: epochResult } = await rpcClient('dna_epoch', []);

            const tx = new Transaction();
            tx.type = transactionType.CallContractTx;
            tx.to = hexToUint8Array(contractAddress);
            tx.amount = txAmount * 1e18;
            tx.nonce = getBalanceResult.nonce + 1;
            tx.epoch = epochResult.epoch;
            tx.maxFee = maxFeeDna;
            tx.payload = payload.toBytes();
            const txHex = tx.toHex();

            const dnaLink = `https://app.idena.io/dna/raw?tx=${txHex}&callback_format=html&callback_url=${callbackUrl}?method=${makePostMethod}`;
            window.open(dnaLink, '_blank');
        }
    };

    const handleUseRpcToggle = (event: any) => {
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

    const handleUseFindPastBlocksWithTxsApiToggle = (event: any) => {
        const useFindPastBlocksWithTxsApi = event.target.checked;
        setUseFindPastBlocksWithTxsApi(useFindPastBlocksWithTxsApi);

        if (!useFindPastBlocksWithTxsApi) {
            setFindPastBlocksUrl('');
            setFindPastBlocksUrlInvalid(false);
        } else {
            if (findPastBlocksUrl) {
                setFindPastBlocksUrl(findPastBlocksUrl);
                setPostersAddressInvalid(false);
            } else {
                setInputFindPastBlocksUrl(findPastBlocksUrlInit);
                setFindPastBlocksUrl(findPastBlocksUrlInit);
            }
        }
    };

    const postScannerFactory = (recurseForward: boolean, recurse: any, blockCapturedRef: any, setBlockCaptured: any) => {
        return async function postFinder() {
            try {
                let pendingBlock;

                if (recurseForward) {
                    pendingBlock = blockCapturedRef.current ? blockCapturedRef.current + 1 : initialBlock;
                } else {
                    const nextPastBlock = blockCapturedRef.current ? blockCapturedRef.current - 1 : undefined;

                    if (!nextPastBlock) {
                        pendingBlock = initialBlock - 1;
                    } else if (useFindPastBlocksWithTxsApiRef.current && !findPastBlocksUrlInvalidRef.current) {
                        const noPastBlocksWithTxsGathered = !pastBlocksWithTxsRef.current.length;
                        const pastBlocksAlreadyProcessed = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] > nextPastBlock);
                        const pastBlocksInRangeForNextBlock = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] < nextPastBlock);

                        if (noPastBlocksWithTxsGathered || pastBlocksAlreadyProcessed) {
                            const { initialblockNumber, blocksWithTxs = [] } = await getPastBlocksWithTxs(findPastBlocksUrlRef.current, nextPastBlock);
                            setPastBlocksWithTxs(blocksWithTxs);

                            if (!blocksWithTxs[0]) {
                                throw 'no more blocks';
                            }

                            if (nextPastBlock > initialblockNumber) {
                                pendingBlock = nextPastBlock;
                            } else {
                                pendingBlock = blocksWithTxs[0];
                            }
                        
                        } else if (pastBlocksInRangeForNextBlock) {
                            const insertionIndex = pastBlocksWithTxsRef.current.findIndex(currentItem => currentItem <= nextPastBlock);
                            const finalIndex = insertionIndex === -1 ? pastBlocksWithTxsRef.current.length : insertionIndex;
                            pendingBlock = pastBlocksWithTxsRef.current[finalIndex];
                        } else {
                            pendingBlock = nextPastBlock;
                        }
                    } else {
                        pendingBlock = nextPastBlock;
                    }

                    if (pendingBlock <= firstBlock) {
                        throw 'no more blocks';
                    }
                }

                const { result: getBlockByHeightResult } = await rpcClientRef.current('bcn_blockAt', [pendingBlock]);

                if (getBlockByHeightResult === null) {
                    throw 'no block';
                }
                
                if (getBlockByHeightResult.transactions === null) {
                    setBlockCaptured(pendingBlock);
                    throw 'no transactions';
                }

                const newPosts: Post[] = [];

                for (let index = 0; index < getBlockByHeightResult.transactions.length; index++) {
                    const transaction = getBlockByHeightResult.transactions[index];

                    const { result: getTxReceiptResult } = await rpcClientRef.current('bcn_txReceipt', [transaction]);

                    if (!getTxReceiptResult) {
                        continue;
                    }

                    if (getTxReceiptResult.contract !== contractAddress.toLowerCase()) {
                        continue;
                    }

                    if (getTxReceiptResult.method !== makePostMethod) {
                        continue;
                    }

                    if (getTxReceiptResult.success !== true) {
                        continue;
                    }

                    const poster = getTxReceiptResult.events[0].args[0];
                    const postId = getTxReceiptResult.events[0].args[1];
                    const channelId = hex2str(getTxReceiptResult.events[0].args[2]);
                    const message = sanitizeStr(hex2str(getTxReceiptResult.events[0].args[3]));

                    if (channelId !== thisChannelId) {
                        continue;
                    }

                    if (!message) {
                        continue;
                    }

                    if (!postersRef.current.some((item) => item.address === poster)) {
                        const { result: getDnaIdentityResult } = await rpcClientRef.current('dna_identity', [poster]);
                        const { address, stake, age, pubkey, state, online } = getDnaIdentityResult;
                        setPosters((currentPosters) => [...currentPosters, { address, stake, age, pubkey, state, online }]);
                    }

                    newPosts.unshift({ blockHeight: getBlockByHeightResult.height, timestamp: getBlockByHeightResult.timestamp, postId, poster, message });
                }

                setBlockCaptured(pendingBlock);
                setPosts((currentPosts) => recurseForward ? [...newPosts, ...currentPosts] : [...currentPosts, ...newPosts]);

                recurse(!recurseForward && Math.floor(Date.now() / 1000));
            } catch(error) {
                console.error(error);
                if (!recurseForward && error === 'no more blocks') {
                    setNoMorePastBlocks(true);
                    setScanningPastBlocks(false);
                } else {
                    recurse(!recurseForward && Math.floor(Date.now() / 1000));
                }
            }
        };
    };

    const viewMoreHandler = (postId: string) => {
        const viewMorePostsItem = viewMorePosts[postId];
        viewMorePostsItem[1] = false;
        setViewMorePosts({ ...viewMorePosts, postId: viewMorePostsItem })
    }

    return (
        <main className="w-full flex flex-row p-2">
            <div className="flex-1 justify-items-end">
                <div className="w-[288px] min-w-[288px] ml-2 mr-8 flex flex-col">
                    <div className="text-[28px] mb-3">idena.social</div>
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
                                <div className={`relative w-9 h-5 bg-neutral-quaternary peer-focus:outline-none peer-focus:ring-brand-soft dark:peer-focus:ring-brand-soft rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-buffer after:content-[\'\'] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand ${useFindPastBlocksWithTxsApi ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                                <span className="select-none ms-3 text-sm font-medium text-heading">Scan blocks with helper Api</span>
                            </label>
                        </div>
                        {useFindPastBlocksWithTxsApi && (
                            <div className="flex flex-col ml-5 text-[14px]">
                                <p className="mb-1">Api Url:</p>
                                <input className="flex-1 mb-1 h-6.6 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputFindPastBlocksUrlApplied} value={inputFindPastBlocksUrl} onChange={e => setInputFindPastBlocksUrl(e.target.value)} />
                                {findPastBlocksUrlInvalid && <p className="text-[11px] text-red-400">Invalid Api Url.</p>}
                                <div className="flex flex-row">
                                    <button className={`w-16 h-7 mt-1 rounded-sm inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputFindPastBlocksUrlApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputFindPastBlocksUrlApplied(!inputFindPastBlocksUrlApplied)}>{inputFindPastBlocksUrlApplied ? 'Change' : 'Apply'}</button>
                                    {!inputFindPastBlocksUrlApplied && <p className="ml-1.5 mt-2.5 text-gray-400 text-[12px]">Apply changes to take effect</p>}
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
                        rows={4}
                        className="w-full rounded-md py-1 px-2 mt-5 outline-1 placeholder:text-gray-500"
                        placeholder="Write your post here..."
                        disabled={inputPostDisabled}
                        value={inputPost}
                        onChange={e => setInputPost(e.target.value)}
                    />
                    <div className="flex flex-row gap-2">
                        <button className={`h-9 w-27 my-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 ${!inputPost || inputPostDisabled ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={!inputPost || inputPostDisabled} onClick={submitPost}>{submittingPost ? 'Posting...' : 'Post!'}</button>
                        {postDelayMessage && <p className="mt-1.5 text-gray-400 text-[12px]">Your post will take time to display due to blockchain acceptance.</p>}
                    </div>
                </div>
                <div className="text-center my-3">
                    <p className="text-center">Current Block: #{currentBlockCaptured ? currentBlockCaptured : 'Loading...'}</p>
                </div>
                <ul>
                    {posts.map((post) => {
                        const poster: Poster = posters.find((item) => item.address === post.poster)! ?? {};
                        const displayAddress = getDisplayAddress(poster.address);
                        const { displayDate, displayTime } = getDisplayDateTime(post.timestamp);
                        const messageLines = getMessageLines(post.message);
                        const viewMorePostsItem = viewMorePosts[post.postId];
                        const displayViewMore = viewMorePostsItem?.[0] && viewMorePostsItem?.[1];
                        const showOverflowPostText = viewMorePostsItem?.[0] === true && viewMorePostsItem?.[1] === false;

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
                                    <div id={post.postId} className={`${showOverflowPostText ? 'max-h-[9999px]' : 'max-h-[288px]'} flex-1 px-4 py-2 text-[16px] text-wrap leading-5 messageDiv ${displayViewMore ? `overflow-hidden` : ''}`}>
                                        <p>{messageLines.map((line, i, arr) => <>{line}{arr.length - 1 !== i && <br />}</>)}</p>
                                    </div>
                                    {displayViewMore && <div className="px-4 text-[12px]/5 text-blue-400"><a className="hover:underline cursor-pointer" onClick={() => viewMoreHandler(post.postId)}>view more</a></div>}
                                    <div className="py-1 px-2">
                                        <p className="text-[11px]/6 text-stone-500 font-[700] text-right">{`${displayDate}, ${displayTime} (Block #${post.blockHeight})`}</p>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex flex-col gap-2 mb-15">
                    <button className={`h-9 mt-1 px-4 py-1 rounded-md bg-white/10 inset-ring inset-ring-white/5 ${scanningPastBlocks || noMorePastBlocks ? '' : 'hover:bg-white/20 cursor-pointer'}`} disabled={scanningPastBlocks || noMorePastBlocks} onClick={() => setScanningPastBlocks(true)}>
                        {scanningPastBlocks ? "Scanning blockchain...." : noMorePastBlocks ? "No more past posts" : "Scan blocks for more posts"}
                    </button>
                    <p className="pr-12 text-gray-400 text-[12px] text-center">Blocks scanned for posts down to Block # <span className="absolute">{pastBlockCaptured}</span></p>
                </div>
            </div>
            <div className="flex-1 justify-items-start">
                <div className="w-[288px] min-w-[288px] mt-3 mr-2 ml-8 flex flex-col text-[13px]">
                    <div className="px-1 font-[700] text-gray-400"><p>{currentAd?.title}</p></div>
                    <div className="px-1"><p>{currentAd?.desc}</p></div>
                    <div className="px-1 text-blue-400"><a className="hover:underline" href={currentAd?.url} target="_blank">{currentAd?.url}</a></div>
                    <div className="my-3"><a className="h-[320px] w-[320px]" href={currentAd?.url} target="_blank"><img className="rounded-md" src={currentAd?.media} /></a></div>
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
