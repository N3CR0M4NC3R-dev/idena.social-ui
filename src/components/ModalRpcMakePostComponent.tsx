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
        <div className="w-full sm:w-[500px] px-3">
            <p className="mb-2 text-center">Make Post</p>
            <RpcPostMessageUIComponent
                storeTextIpfs={storeTextIpfs}
                setStoreTextIpfs={setStoreTextIpfs}
                storeMediaIpfs={storeMediaIpfs}
                setStoreMediaIpfs={setStoreMediaIpfs}
                localSubmitHandler={localSubmitPostHandler}
                submitText={'Post!'}
            />
        </div>
    </>);
}

export default ModalRpcMakePostComponent;
