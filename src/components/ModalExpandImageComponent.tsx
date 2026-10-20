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
        <div className="px-3">
            <a href={cid ? `https://ipfs.idena.io/ipfs/${cid}` : objectUrl} target="_blank" rel="noopener noreferrer">
                <img className="max-h-[95vh] rounded-sm" src={objectUrl} />
            </a>
        </div>
    </>);
}

export default ModalExpandImageComponent;
