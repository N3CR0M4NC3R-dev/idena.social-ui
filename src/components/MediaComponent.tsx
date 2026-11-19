import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import { getMediaKind } from '../logic/media';
import { useObjectUrl } from '../logic/objectUrls';
import ObjectUrlImageComponent from './ObjectUrlImageComponent';

type MediaComponentProps = {
    file: File,
    className: string,
    onExpandImage?: (e: MouseEventLocal) => void,
};

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

function MediaComponent(props: MediaComponentProps) {

    const {
        file,
        className,
        onExpandImage,
    } = props;

    const kind = getMediaKind(file.type);
    const objectUrl = useObjectUrl(kind === 'image' ? undefined : file);

    const [soundOnlyFile, setSoundOnlyFile] = useState<File>();
    const [unplayableFile, setUnplayableFile] = useState<File>();

    if (kind === 'image') {
        return <ObjectUrlImageComponent className={`${className} ${onExpandImage ? 'hover:cursor-pointer' : ''}`} file={file} onClick={onExpandImage} />;
    }

    if (unplayableFile === file) {
        return <p className="text-[13px] text-ink-muted">This browser cannot play this {kind === 'video' ? 'video' : 'sound'}.</p>;
    }

    if (kind === 'video' && soundOnlyFile !== file) {
        return (
            <video
                className={`${className} bg-black`}
                src={objectUrl}
                controls
                playsInline
                preload="metadata"
                onClick={stopPropagation}
                onLoadedMetadata={(e) => e.currentTarget.videoWidth === 0 && setSoundOnlyFile(file)}
                onError={() => setUnplayableFile(file)}
            />
        );
    }

    return (
        <audio
            className="block w-90 max-w-full"
            src={objectUrl}
            controls
            preload="metadata"
            onClick={stopPropagation}
            onError={() => setUnplayableFile(file)}
        />
    );
}

export default MediaComponent;
