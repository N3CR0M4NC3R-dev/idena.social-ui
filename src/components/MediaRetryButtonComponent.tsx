import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import { RetryIcon, SpinnerIcon } from './icons';

type MediaRetryButtonComponentProps = {
    onRetry: () => Promise<boolean>,
};

function MediaRetryButtonComponent(props: MediaRetryButtonComponentProps) {

    const { onRetry } = props;

    const [status, setStatus] = useState<'idle' | 'retrying' | 'failed'>('idle');

    const retryHandler = async (e: MouseEventLocal) => {
        e.stopPropagation();

        setStatus('retrying');
        const loaded = await onRetry();
        setStatus(loaded ? 'idle' : 'failed');
    };

    const retrying = status === 'retrying';

    return (
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <button type="button" className="btn-outline h-8 px-3.5 text-[14px]" disabled={retrying} onClick={retryHandler}>
                {retrying ? <SpinnerIcon className="size-4" /> : <RetryIcon className="size-4" />}
                {retrying ? 'Retrying...' : 'Retry'}
            </button>
            {status === 'failed' && <span role="status">Still unavailable</span>}
        </div>
    );
}

export default MediaRetryButtonComponent;
