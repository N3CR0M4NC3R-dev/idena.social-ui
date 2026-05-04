type ModalExpandImageComponentProps = {
    modalExpandImageRef: React.RefObject<{ dataUrl?: string, cid?: string} | undefined>,
};

function ModalExpandImageComponent(props: ModalExpandImageComponentProps) {

    const {
        modalExpandImageRef,
    } = props;

    const { dataUrl, cid } = modalExpandImageRef.current ?? {};

    return (<>
        <div className="px-3">
            <a href={cid ? `https://ipfs.idena.io/${cid}` : dataUrl} target="_blank" rel="noopener noreferrer">
                <img className="max-h-[95vh] rounded-sm" src={dataUrl} />
            </a>
        </div>
    </>);
}

export default ModalExpandImageComponent;
