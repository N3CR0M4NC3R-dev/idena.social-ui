import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import { getMedia, getNonceAndEpoch, supportedImageTypes, type RpcClient } from '../logic/asyncUtils';

type ModalAddMediaComponentProps = {
    modalAddMediaRef: React.RefObject<string>,
    addMediaHandler: (location: string, file: File, ipfsUrl?: string | undefined) => Promise<void>,
    rpcClient: RpcClient,
    postersAddress: string,
    makePostsWith: string,
    closeModal: () => void,
};

function ModalAddMediaComponent(props: ModalAddMediaComponentProps) {

    const {
        modalAddMediaRef,
        addMediaHandler,
        rpcClient,
        postersAddress,
        makePostsWith,
        closeModal,
    } = props;

    const [ipfsUrl, setIpfsUrl] = useState<string>('');

    const selectIpfsUrlHandler = async (e: MouseEventLocal, location: string) => {
        e.stopPropagation();

        if (!ipfsUrl.startsWith('ipfs://')) {
            alert('IPFS url must start with ipfs://');
            return;
        }

        const { image, mediaType, blob } = await getMedia('postId', ipfsUrl, rpcClient);

        if (!image || image.includes('error-loading-media.png')) {
            alert('Image cannot be found at IPFS url.');
            return;
        }

        const file = new File([blob!], 'preview', { type: mediaType });

        if (file) {
            await addMediaHandler(location, file, ipfsUrl);
            closeModal();
        }
    }

    const storeToIpfsHandler = async (e: MouseEventLocal) => {
        e.stopPropagation();

        if (makePostsWith !== 'rpc') {
            alert('storeToIpfs method only available when Make posts with RPC.');
            return;
        }

        const cid = ipfsUrl.split('ipfs://')[1];

        const { nonce, epoch } = await getNonceAndEpoch(rpcClient, postersAddress);
        const { result: storeToIpfsResult } = await rpcClient('dna_storeToIpfs', [{ cid, nonce, epoch }]);

        if (!storeToIpfsResult) {
            alert('something went wrong with storeToIpfs.');
            return;
        };
    }

    const localAddMediaHandler = async (e: React.ChangeEvent<HTMLInputElement>, location: string) => {
        e?.stopPropagation();

        const file = e.currentTarget.files?.[0];

        if (file) {
            await addMediaHandler(location, file);
            closeModal();
        }
    }

    return (<>
        <div className="w-[400px] px-3">
            <p className="mb-2 text-center">Add Image</p>
            <div className="text-[14px]">
                <div className="mt-5 mb-3">
                    <div className="flex flex-row gap-2">
                        <div className="flex-none text-right">
                            <p>Select image from your device:</p>
                        </div>
                        <div>
                            <label htmlFor={`post-input-media-${modalAddMediaRef.current}`} className="h-7 py-1.5 px-3 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={(e) => e.stopPropagation()}>Select</label>
                            <input
                                id={`post-input-media-${modalAddMediaRef.current}`}
                                type="file"
                                accept={supportedImageTypes.join(',')}
                                className="hidden"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => localAddMediaHandler(e, modalAddMediaRef.current)}
                            />
                        </div>
                    </div>
                </div>
                <div className="mb-3">
                    <p>--OR--</p>
                </div>
                <div className="mb-3">
                    <p>Select existing image from IPFS url:</p>
                    <div className="flex flex-row gap-2">
                        <input
                            placeholder="ipfs://cid"
                            className="w-full mt-1 py-0.5 px-1 outline-1 placeholder:text-gray-500"
                            value={ipfsUrl}
                            onClick={(e) => e.stopPropagation()}
                            onChange={e => setIpfsUrl(e.target.value)}
                        />
                        <button className="mt-1 h-7 px-3 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={(e) => selectIpfsUrlHandler(e, modalAddMediaRef.current)}>Select</button>
                    </div>
                    <div className="mt-3 flex flex-row gap-2">
                        <div>
                            <p>Propogate Ipfs url to the Idena Network:</p>
                        </div>
                        <div>
                            <button className="-mt-1 h-7 px-3 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={(e) => storeToIpfsHandler(e)}>storeToIpfs</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>);
}

export default ModalAddMediaComponent;
