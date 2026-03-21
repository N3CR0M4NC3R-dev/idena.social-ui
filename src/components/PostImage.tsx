import { useEffect, useMemo, useState } from 'react';
import type { NodeDetails } from '../logic/api';
import type { ParsedPostMessage } from '../logic/utils';
import { DEFAULT_IPFS_GATEWAYS, getIpfsBlobUrlFromRpc, normalizeRpcNodeUrl } from '../logic/ipfs';

type ParsedPostImage = NonNullable<ParsedPostMessage['image']>;

type PostImageProps = {
    image: ParsedPostImage,
    rpcNode?: NodeDetails,
    className?: string,
    alt: string,
};

function PostImage(props: PostImageProps) {
    const {
        image,
        rpcNode,
        className,
        alt,
    } = props;

    const imageCid = image.kind === 'ipfs' ? image.cid : '';
    const imageMimeType = image.kind === 'ipfs' ? image.mimeType : '';
    const [gatewayIndex, setGatewayIndex] = useState(0);
    const [imageUnavailable, setImageUnavailable] = useState(false);
    const [rpcImageSrc, setRpcImageSrc] = useState<string>('');
    const [rpcFetchDone, setRpcFetchDone] = useState(true);

    const canUseRpcRead = useMemo(() => {
        if (image.kind !== 'ipfs' || !rpcNode?.idenaNodeUrl) {
            return false;
        }

        const normalizedNodeUrl = normalizeRpcNodeUrl(rpcNode.idenaNodeUrl).toLowerCase();
        if (!normalizedNodeUrl || normalizedNodeUrl.includes('restricted.idena.io')) {
            return false;
        }

        return true;
    }, [image.kind, rpcNode?.idenaNodeUrl]);

    useEffect(() => {
        setGatewayIndex(0);
        setImageUnavailable(false);
        setRpcImageSrc((currentRpcImageSrc) => {
            if (currentRpcImageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(currentRpcImageSrc);
            }
            return '';
        });

        if (image.kind !== 'ipfs' || !canUseRpcRead || !rpcNode) {
            setRpcFetchDone(true);
            return;
        }

        let cancelled = false;
        setRpcFetchDone(false);

        (async function() {
            try {
                const fetchedImageSrc = await getIpfsBlobUrlFromRpc(rpcNode, imageCid, imageMimeType);
                if (cancelled) {
                    if (fetchedImageSrc.startsWith('blob:')) {
                        URL.revokeObjectURL(fetchedImageSrc);
                    }
                    return;
                }
                setRpcImageSrc(fetchedImageSrc);
            } catch {
                // Fallback to public gateways handled by image rendering below.
            } finally {
                if (!cancelled) {
                    setRpcFetchDone(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [image.kind, imageCid, imageMimeType, canUseRpcRead, rpcNode?.idenaNodeUrl, rpcNode?.idenaNodeApiKey]);

    const imageSrc = useMemo(() => {
        if (image.kind === 'inline') {
            return image.dataUrl;
        }

        if (rpcImageSrc) {
            return rpcImageSrc;
        }

        if (canUseRpcRead && !rpcFetchDone) {
            return '';
        }

        const gateway = DEFAULT_IPFS_GATEWAYS[gatewayIndex] ?? DEFAULT_IPFS_GATEWAYS[0];
        return `${gateway}${image.cid}`;
    }, [image, gatewayIndex, rpcImageSrc, canUseRpcRead, rpcFetchDone]);

    const imageLink = image.kind === 'ipfs' ? `${DEFAULT_IPFS_GATEWAYS[0]}${image.cid}` : undefined;

    return (
        <div className="mt-2">
            {!imageUnavailable && !!imageSrc && (
                <img
                    className={className}
                    src={imageSrc}
                    alt={alt}
                    onError={() => {
                        if (image.kind === 'ipfs' && gatewayIndex < DEFAULT_IPFS_GATEWAYS.length - 1) {
                            setGatewayIndex((currentGatewayIndex) => currentGatewayIndex + 1);
                            return;
                        }

                        setImageUnavailable(true);
                    }}
                />
            )}
            {!imageUnavailable && !imageSrc && image.kind === 'ipfs' && canUseRpcRead && !rpcFetchDone && (
                <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-gray-300">
                    Loading pinned image from your RPC node...
                </div>
            )}
            {imageUnavailable && image.kind === 'ipfs' && (
                <div className="rounded-md border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-[12px] text-amber-300">
                    <p>This message lives on the blockchain, but its pinned image lives on IPFS and is currently unavailable.</p>
                    {!!image.pinnedOn.length && <p className="mt-1">Pinned on {image.pinnedOn.length} IPFS node(s) at posting time.</p>}
                    <p className="mt-1">
                        CID:
                        {' '}
                        <a className="underline" href={imageLink} target="_blank" rel="noreferrer">{image.cid}</a>
                    </p>
                </div>
            )}
        </div>
    );
}

export default PostImage;
