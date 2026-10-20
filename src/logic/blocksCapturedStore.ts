import { getDb, BLOCKS_CAPTURED_RANGE_STORE } from './db';

export type BlocksCapturedRangeItem = {
    start_block_height: number,
    end_block_height: number,
    transactions: string[],
    indexer_api_continuation_details?: { nextBlockTransactions: string[], contract: string, continuationToken?: string },
};

export const getBlocksCapturedRange = async (startBlockHeight: number) => {
    try {
        const db = await getDb();
        if (!db) return;

        const existing = await db.get(BLOCKS_CAPTURED_RANGE_STORE, startBlockHeight) as BlocksCapturedRangeItem | undefined;

        return existing;
    } catch (error) {
        console.warn('could not save content', error);
    }
};

export const getBlocksCapturedRangeOverlapping = async (blockHeight: number) => {
    try {
        const db = await getDb();
        if (!db) return;

        const store = db.transaction(BLOCKS_CAPTURED_RANGE_STORE).store;
        const cursor = await store.openCursor(IDBKeyRange.lowerBound(blockHeight));

        if (!cursor) return;

        const rangeItem = cursor.value as BlocksCapturedRangeItem;

        return rangeItem.end_block_height <= blockHeight ? rangeItem : undefined;
    } catch (error) {
        console.warn('could not get content', error);
    }
};

export const addBlocksCapturedRange = async (
    startBlockHeight: number,
    endBlockHeight: number,
    transactions: string[],
    indexerApiContinuationDetails?: { nextBlockTransactions: string[], contract: string, continuationToken?: string },
) => {
    try {
        const db = await getDb();
        if (!db) return;

        const tx = db.transaction(BLOCKS_CAPTURED_RANGE_STORE, 'readwrite');
        const store = tx.store;

        const enclosingCursor = await store.openCursor(IDBKeyRange.lowerBound(startBlockHeight, true));
        const enclosingCandidate = enclosingCursor?.value as BlocksCapturedRangeItem | undefined;
        const enclosingRange = enclosingCandidate && enclosingCandidate.end_block_height <= startBlockHeight + 1 ? enclosingCandidate : undefined;
        const rangeStartBlockHeight = enclosingRange?.start_block_height ?? startBlockHeight;

        const currentRange: BlocksCapturedRangeItem | undefined = enclosingRange ?? await store.get(startBlockHeight);

        if (currentRange && currentRange.end_block_height <= endBlockHeight) {
            await tx.done;
            return;
        }

        const nextBlock = endBlockHeight - 1;

        const range = IDBKeyRange.bound(nextBlock, rangeStartBlockHeight, false, true);

        let nextRange: BlocksCapturedRangeItem | undefined;
        const encompassedRanges: BlocksCapturedRangeItem[] = [];

        for await (const cursor of store.iterate(range)) {
            const rangeItem = cursor.value as BlocksCapturedRangeItem;

            if (rangeItem.end_block_height <= nextBlock && (!nextRange || rangeItem.end_block_height < nextRange.end_block_height)) {
                if (nextRange) encompassedRanges.push(nextRange);
                nextRange = rangeItem;
            } else {
                encompassedRanges.push(rangeItem);
            }
        }

        const actualEndBlockHeight = nextRange?.end_block_height ?? endBlockHeight;
        const currentRangeTransactions = [ ...(currentRange?.transactions ?? []), ...(currentRange?.indexer_api_continuation_details?.nextBlockTransactions ?? []) ];
        const encompassedRangesTransactions = encompassedRanges.flatMap((encompassedRange) => [ ...encompassedRange.transactions, ...(encompassedRange.indexer_api_continuation_details?.nextBlockTransactions ?? []) ]);
        const nextRangeTransactions = nextRange?.transactions ?? [];
        const actualIndexerApiContinuationDetails = nextRange ? nextRange.indexer_api_continuation_details : indexerApiContinuationDetails;
        const aggregatedUniqueTransactions = [...new Set([...currentRangeTransactions, ...transactions, ...encompassedRangesTransactions, ...nextRangeTransactions])];
        const newTransactions = aggregatedUniqueTransactions.sort((a: string, b: string) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));

        const updatedCurrentRange: BlocksCapturedRangeItem = {
            start_block_height: rangeStartBlockHeight,
            end_block_height: actualEndBlockHeight,
            transactions: newTransactions,
            ...(actualIndexerApiContinuationDetails && { indexer_api_continuation_details: actualIndexerApiContinuationDetails }),
        };

        store.put(updatedCurrentRange);

        if (nextRange) {
            store.delete(nextRange.start_block_height);
        }

        for (const encompassedRange of encompassedRanges) {
            store.delete(encompassedRange.start_block_height);
        }

        await tx.done;
    } catch (error) {
        console.warn('could not save content', error);
    }
};

export const clearBlocksCapturedRange = async () => {
    try {
        const db = await getDb();
        if (!db) return;

        await db.clear(BLOCKS_CAPTURED_RANGE_STORE);
    } catch (error) {
        console.warn('could not clear content', error);
    }
};
