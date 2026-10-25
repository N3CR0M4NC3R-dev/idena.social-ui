import { useObjectUrl } from '../logic/objectUrls';

type ModalExpandImageComponentProps = {
    modalExpandImageRef: React.RefObject<{ image?: File, cid?: string} | undefined>,
};

function ModalExpandImageComponent(props: ModalExpandImageComponentProps) {

    const {
        modalExpandImageRef,
    } = props;

    const { image, cid } = modalExpandImageRef.current ?? {};

    const objectUrl = useObjectUrl(image);

    return (<>
        <a className="block" href={cid ? `https://ipfs.idena.io/ipfs/${cid}` : objectUrl} target="_blank" rel="noopener noreferrer">
            <img className="block max-h-[90vh] max-w-[90vw] rounded-2xl" src={objectUrl} />
        </a>
    </>);
}

export default ModalExpandImageComponent;
