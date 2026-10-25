import { useState } from 'react';
import RpcPostMessageUIComponent from './RpcPostMessageUIComponent';

type ModalRpcMakePostComponentProps = {
    modalRpcMakePostRef: React.RefObject<{ location: string; replyToPostId?: string; channelId?: string; }>,
    submitPostHandler: (location: string, replyToPostId?: string | undefined, channelId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    closeModal: () => void,
};

function ModalRpcMakePostComponent(props: ModalRpcMakePostComponentProps) {

    const {
        modalRpcMakePostRef,
        submitPostHandler,
        closeModal,
    } = props;

    const [storeTextIpfs, setStoreTextIpfs] = useState<boolean>(true);
    const [storeMediaIpfs, setStoreMediaIpfs] = useState<boolean>(true);

    const localSubmitPostHandler = () => {
        const { location, replyToPostId, channelId } = modalRpcMakePostRef.current;
        submitPostHandler(location, replyToPostId, channelId, storeTextIpfs, storeMediaIpfs);
        closeModal();
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">Make Post</h2>
            </div>
            <div className="px-4 pb-4">
                <RpcPostMessageUIComponent
                    storeTextIpfs={storeTextIpfs}
                    setStoreTextIpfs={setStoreTextIpfs}
                    storeMediaIpfs={storeMediaIpfs}
                    setStoreMediaIpfs={setStoreMediaIpfs}
                    localSubmitHandler={localSubmitPostHandler}
                    submitText={'Post'}
                />
            </div>
        </div>
    </>);
}

export default ModalRpcMakePostComponent;
