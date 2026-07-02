import { useState } from 'react';
import RpcPostMessageUIComponent from './RpcPostMessageUIComponent';

type ModalRpcSendMessageComponentProps = {
    modalRpcSendMessageRef: React.RefObject<{ location: string; recipient: string; replyToMessageId?: string; }>,
    submitMessageHandler: (location: string, recipient: string, replyToMessageId?: string | undefined, storeTextIpfs?: boolean | undefined, storeMediaIpfs?: boolean | undefined) => Promise<void>,
    closeModal: () => void,
};

function ModalRpcSendMessageComponent(props: ModalRpcSendMessageComponentProps) {

    const {
        modalRpcSendMessageRef,
        submitMessageHandler,
        closeModal,
    } = props;

    const [storeTextIpfs, setStoreTextIpfs] = useState<boolean>(true);
    const [storeMediaIpfs, setStoreMediaIpfs] = useState<boolean>(true);

    const localSubmitMessageHandler = () => {
        const { location, recipient, replyToMessageId } = modalRpcSendMessageRef.current;
        submitMessageHandler(location, recipient, replyToMessageId, storeTextIpfs, storeMediaIpfs);
        closeModal();
    };

    return (<>
        <div className="w-full sm:w-[500px] px-3">
            <p className="mb-2 text-center">Send Message</p>
            <RpcPostMessageUIComponent
                storeTextIpfs={storeTextIpfs}
                setStoreTextIpfs={setStoreTextIpfs}
                storeMediaIpfs={storeMediaIpfs}
                setStoreMediaIpfs={setStoreMediaIpfs}
                localSubmitHandler={localSubmitMessageHandler}
                submitText={'Send!'}
            />
        </div>
    </>);
}

export default ModalRpcSendMessageComponent;
