import type { MouseEventLocal } from '../App.exports';
import { useObjectUrl } from '../logic/objectUrls';

type ObjectUrlImageComponentProps = {
    file?: File,
    className?: string,
    onClick?: (e: MouseEventLocal) => void,
};

function ObjectUrlImageComponent(props: ObjectUrlImageComponentProps) {
    const {
        file,
        className,
        onClick,
    } = props;

    const objectUrl = useObjectUrl(file);

    if (!objectUrl) {
        return <span className={className} onClick={onClick} aria-hidden="true" />;
    }

    return (
        <img className={className} src={objectUrl} onClick={onClick} />
    );
}

export default ObjectUrlImageComponent;
