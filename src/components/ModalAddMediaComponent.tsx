import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import { getMedia, getMediaFile, getNonceAndEpoch, mediaInputAccept, type RpcClient } from '../logic/asyncUtils';
import { ERROR_LOADING_MEDIA_FILE_NAME } from '../logic/media';

type ModalAddMediaComponentProps = {
    modalAddMediaRef: React.RefObject<string>,
    addMediaHandler: (attachmentId: string, file: File, ipfsUrl?: string | undefined) => Promise<void>,
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

    const selectIpfsUrlHandler = async (e: MouseEventLocal, attachmentId: string) => {
        e.stopPropagation();

        if (!ipfsUrl.startsWith('ipfs://')) {
            alert('IPFS url must start with ipfs://');
            return;
        }

        const mediaFile = getMediaFile(await getMedia('postId', ipfsUrl, '', rpcClient));

        if (!mediaFile || mediaFile.name === ERROR_LOADING_MEDIA_FILE_NAME) {
            alert('Media cannot be found at IPFS url.');
            return;
        }

        await addMediaHandler(attachmentId, mediaFile, ipfsUrl);
        closeModal();
    };

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
    };

    const localAddMediaHandler = async (e: React.ChangeEvent<HTMLInputElement>, attachmentId: string) => {
        e?.stopPropagation();

        const file = e.currentTarget.files?.[0];

        if (file) {
            await addMediaHandler(attachmentId, file);
            closeModal();
        }
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">Add Media</h2>
            </div>
            <div className="px-4 pb-4 text-[15px]/5">
                <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0">Select an image, video or sound from your device</p>
                    <div className="flex-none">
                        <label htmlFor={`post-input-media-${modalAddMediaRef.current}`} className="btn-outline h-9 px-4 text-[15px]" onClick={(e) => e.stopPropagation()}>Select</label>
                        <input
                            id={`post-input-media-${modalAddMediaRef.current}`}
                            type="file"
                            accept={mediaInputAccept}
                            className="hidden"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => localAddMediaHandler(e, modalAddMediaRef.current)}
                        />
                    </div>
                </div>
                <div className="my-4 flex items-center gap-3 text-[13px] text-ink-muted">
                    <span className="h-px flex-1 bg-line" />
                    <span>or</span>
                    <span className="h-px flex-1 bg-line" />
                </div>
                <p>Select existing media from IPFS url</p>
                <div className="mt-2 flex items-center gap-3">
                    <input
                        placeholder="ipfs://cid"
                        className="form-field min-w-0 flex-1 text-[15px]"
                        value={ipfsUrl}
                        onClick={(e) => e.stopPropagation()}
                        onChange={e => setIpfsUrl(e.target.value)}
                    />
                    <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" onClick={(e) => selectIpfsUrlHandler(e, modalAddMediaRef.current)}>Select</button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="min-w-0 text-ink-muted">Propagate IPFS url to the Idena Network</p>
                    <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" onClick={(e) => storeToIpfsHandler(e)}>storeToIpfs</button>
                </div>
            </div>
        </div>
    </>);
}

export default ModalAddMediaComponent;
