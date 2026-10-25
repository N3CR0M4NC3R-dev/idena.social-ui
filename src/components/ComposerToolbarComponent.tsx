import type { MouseEventLocal } from '../App.exports';
import { CloseIcon, CopyIcon, ImageIcon } from './icons';

type ComposerToolbarComponentProps = {
    hasAttachment: boolean,
    onAddImage: (e: MouseEventLocal) => void,
    onRemoveImage: (e: MouseEventLocal) => void,
    copyTxId: string,
    onCopyTx: (e: MouseEventLocal) => void,
    submitText: string,
    onSubmit: (e: MouseEventLocal) => void,
    submitDisabled?: boolean,
    hint?: string,
    compact?: boolean,
};

function ComposerToolbarComponent(props: ComposerToolbarComponentProps) {

    const {
        hasAttachment,
        onAddImage,
        onRemoveImage,
        copyTxId,
        onCopyTx,
        submitText,
        onSubmit,
        submitDisabled,
        hint,
        compact,
    } = props;

    return (
        <div className="flex flex-row items-center gap-2">
            <div className="flex-1 flex flex-row items-center gap-0.5 -ml-2 text-accent">
                {hasAttachment ?
                    <button type="button" className="h-8 px-2 inline-flex items-center gap-1 rounded-full text-[13px] font-bold cursor-pointer hover:bg-accent/20" onClick={onRemoveImage}>
                        <CloseIcon className="size-4" />
                        <span>Remove image</span>
                    </button>
                    :
                    <button type="button" aria-label="Add image" title="Add image" className={`${compact ? 'size-8' : 'size-[34px]'} inline-flex items-center justify-center rounded-full cursor-pointer hover:bg-accent/20`} onClick={onAddImage}>
                        <ImageIcon className={compact ? 'size-[18px]' : 'size-5'} />
                    </button>
                }
                <button type="button" title="Copy the transaction to sign it elsewhere" className="h-8 px-2 inline-flex items-center gap-1 rounded-full text-[13px] font-bold cursor-pointer hover:bg-accent/20" onClick={onCopyTx}>
                    <CopyIcon className="size-4" />
                    <span id={copyTxId}>Copy tx</span>
                </button>
            </div>
            {hint && <p className="hidden sm:block max-w-56 text-right text-[13px]/4 text-ink-muted">{hint}</p>}
            <button type="button" className={`btn-primary ${compact ? 'h-8 px-4 text-[14px]' : 'h-9 px-4 text-[15px]'}`} disabled={submitDisabled} onClick={onSubmit}>{submitText}</button>
        </div>
    );
}

export default ComposerToolbarComponent;
