import { getPastBlocksWithTxs } from "./api";

export const getRecurseBackwardPendingBlock = async (
    initialBlock: number,
    firstBlock: number,
    blockCapturedRef: React.RefObject<number>,
    useFindPastBlocksWithTxsApiRef: React.RefObject<boolean>,
    findPastBlocksUrlInvalidRef: React.RefObject<boolean>,
    pastBlocksWithTxsRef: React.RefObject<number[]>,
    findPastBlocksUrlRef: React.RefObject<string>,
    setPastBlocksWithTxs: React.Dispatch<React.SetStateAction<number[]>>,
) => {
    let pendingBlock;

    const nextPastBlock = blockCapturedRef.current ? blockCapturedRef.current - 1 : undefined;

    if (!nextPastBlock) {
        pendingBlock = initialBlock - 1;
    } else if (useFindPastBlocksWithTxsApiRef.current && !findPastBlocksUrlInvalidRef.current) {
        const noPastBlocksWithTxsGathered = !pastBlocksWithTxsRef.current.length;
        const pastBlocksAlreadyProcessed = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] > nextPastBlock);
        const pastBlocksInRangeForNextBlock = (pastBlocksWithTxsRef.current[0] > nextPastBlock) && (pastBlocksWithTxsRef.current[pastBlocksWithTxsRef.current.length - 1] < nextPastBlock);

        if (noPastBlocksWithTxsGathered || pastBlocksAlreadyProcessed) {
            const { initialblockNumber, blocksWithTxs = [] } = await getPastBlocksWithTxs(findPastBlocksUrlRef.current, nextPastBlock);
            setPastBlocksWithTxs(blocksWithTxs);

            if (!blocksWithTxs[0]) {
                throw 'no more blocks';
            }

            if (nextPastBlock > initialblockNumber) {
                pendingBlock = nextPastBlock;
            } else {
                pendingBlock = blocksWithTxs[0];
            }
        
        } else if (pastBlocksInRangeForNextBlock) {
            const insertionIndex = pastBlocksWithTxsRef.current.findIndex(currentItem => currentItem <= nextPastBlock);
            const finalIndex = insertionIndex === -1 ? pastBlocksWithTxsRef.current.length : insertionIndex;
            pendingBlock = pastBlocksWithTxsRef.current[finalIndex];
        } else {
            pendingBlock = nextPastBlock;
        }
    } else {
        pendingBlock = nextPastBlock;
    }

    if (pendingBlock <= firstBlock) {
        throw 'no more blocks';
    }

    return pendingBlock;
};
