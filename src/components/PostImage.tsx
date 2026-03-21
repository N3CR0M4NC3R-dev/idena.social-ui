import { useMemo, useState } from 'react';
import type { ParsedPostMessage } from '../logic/utils';
import { DEFAULT_IPFS_GATEWAYS } from '../logic/ipfs';

type ParsedPostImage = NonNullable<ParsedPostMessage['image']>;

type PostImageProps = {
    image: ParsedPostImage,
    className?: string,
    alt: string,
};

function PostImage(props: PostImageProps) {
    const {
        image,
        className,
        alt,
    } = props;

    const [gatewayIndex, setGatewayIndex] = useState(0);
    const [imageUnavailable, setImageUnavailable] = useState(false);

    const imageSrc = useMemo(() => {
        if (image.kind === 'inline') {
            return image.dataUrl;
        }

        const gateway = DEFAULT_IPFS_GATEWAYS[gatewayIndex] ?? DEFAULT_IPFS_GATEWAYS[0];
        return `${gateway}${image.cid}`;
    }, [image, gatewayIndex]);

    const imageLink = image.kind === 'ipfs' ? `ipfs://${image.cid}` : undefined;

    return (
        <div className="mt-2">
            {!imageUnavailable && (
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
