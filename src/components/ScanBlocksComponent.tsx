import { BlockIcon } from './icons';

type ScanBlocksComponentProps = {
    currentBlockCaptured: number,
    scanningPastBlocks: boolean,
    setScanningPastBlocks: React.Dispatch<React.SetStateAction<boolean>>,
    noMorePastBlocks: boolean,
    pastBlockCaptured: number,
    nodeAvailable: boolean,
    variant: 'card' | 'compact' | 'row',
};

const scanButtonClassNames = {
    card: 'btn-outline h-9 w-full px-4 text-[15px]',
    compact: 'btn-outline h-8 flex-none px-3 text-[13px]',
    row: 'flex h-[53px] w-full items-center justify-center border-b border-line text-[15px] text-accent enabled:cursor-pointer enabled:hover:bg-ink/[0.03] disabled:text-ink-muted',
};

function ScanBlocksComponent(props: ScanBlocksComponentProps) {

    const {
        currentBlockCaptured,
        scanningPastBlocks,
        setScanningPastBlocks,
        noMorePastBlocks,
        pastBlockCaptured,
        nodeAvailable,
        variant,
    } = props;

    const scanButton = (
        <button type="button" className={scanButtonClassNames[variant]} disabled={scanningPastBlocks || noMorePastBlocks || !nodeAvailable} onClick={() => setScanningPastBlocks(true)}>
            {scanningPastBlocks ? "Scanning blockchain...." : (noMorePastBlocks ? "Nothing more to scan" : "Scan more past blocks")}
        </button>
    );

    const scannedDownTo = !scanningPastBlocks ? <>Scanned down to block #{pastBlockCaptured || 'unavailable'}</> : <>&nbsp;</>;

    const currentBlock = <>#{currentBlockCaptured ? currentBlockCaptured : (nodeAvailable ? 'Loading...' : '')}</>;

    const nodeWarning = !nodeAvailable && <p className="text-[13px]/4 text-danger">Blocks are not being captured. Please update your node.</p>;

    const blockIcon = (
        <span className="flex size-10 flex-none items-center justify-center rounded-full bg-accent/10 text-accent">
            <BlockIcon className="size-5" />
        </span>
    );

    if (variant === 'row') {
        return (<>
            {scanButton}
            <p className="px-4 py-3 text-center text-[13px]/4 text-ink-muted tabular-nums">{scannedDownTo}</p>
        </>);
    }

    if (variant === 'compact') {
        return (
            <div className="flex flex-col gap-1 border-b border-line px-4 py-3">
                <div className="flex items-center gap-3">
                    {blockIcon}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="min-w-24 flex-1">
                            <p className="text-[13px]/4 text-ink-muted">Current block</p>
                            <p className="truncate text-[15px]/5 font-bold tabular-nums">{currentBlock}</p>
                        </div>
                        {scanButton}
                    </div>
                </div>
                <div className="flex flex-col gap-1 pl-[52px]">
                    <p className="truncate text-[13px]/4 text-ink-muted tabular-nums">{scannedDownTo}</p>
                    {nodeWarning}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-center gap-3">
                {blockIcon}
                <div className="min-w-0">
                    <p className="text-[13px]/4 text-ink-muted">Current block</p>
                    <p className="truncate text-[17px]/6 font-bold tabular-nums">{currentBlock}</p>
                </div>
            </div>
            {nodeWarning}
            <div className="flex flex-col gap-2">
                {scanButton}
                <p className="text-center text-[13px]/4 text-ink-muted tabular-nums">{scannedDownTo}</p>
            </div>
        </div>
    );
}

export default ScanBlocksComponent;
