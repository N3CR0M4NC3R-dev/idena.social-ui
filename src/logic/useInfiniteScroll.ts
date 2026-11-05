import { useEffect, useRef, useState } from 'react';

// Renders a long list a page at a time: only the first `visibleCount` items are returned, and
// the next page is revealed when the sentinel element (placed after the list) nears the viewport.
//
// `resetKey` must be unique to one list in one history entry (derive it from the location key).
// How far each list was paged is remembered under that key, so returning to the entry with the
// back button renders as many items as before and the browser can restore the scroll position.

const DEFAULT_PAGE_SIZE = 20;

// start rendering the next page about a screen and a half before the user reaches the end
const SENTINEL_ROOT_MARGIN = '0px 0px 150% 0px';

// Compared by content, not identity: callers may rebuild the array on every render (e.g. with
// .filter), and treating each new array as a change would set state on every render forever.
const sameItems = <T>(a: T[], b: T[]) => a === b || (a.length === b.length && a.every((item, index) => item === b[index]));

// Lists paged past the first page, by resetKey. The last rendered item is kept as well as the
// count, in case items arrived above it while the user was away.
const pagedLists = new Map<string, { visibleCount: number, lastVisibleItem: unknown }>();

const getInitialVisibleCount = <T>(items: T[], resetKey: string, pageSize: number) => {
    const pagedList = pagedLists.get(resetKey);

    if (!pagedList) {
        return pageSize;
    }

    return Math.max(pagedList.visibleCount, items.indexOf(pagedList.lastVisibleItem as T) + 1);
};

export function useInfiniteScroll<T>(items: T[], resetKey: string, pageSize = DEFAULT_PAGE_SIZE) {
    const [visibleCount, setVisibleCount] = useState(() => getInitialVisibleCount(items, resetKey, pageSize));
    const [prevItems, setPrevItems] = useState(items);
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    const sentinelRef = useRef<HTMLDivElement>(null);

    if (resetKey !== prevResetKey) {
        // a different list (e.g. sort order changed, or navigated to the page afresh): start over
        setPrevResetKey(resetKey);
        setPrevItems(items);
        setVisibleCount(pageSize);
    } else if (!sameItems(items, prevItems)) {
        // Items can arrive above the rendered ones (new posts polled in, or posts moved up by new
        // activity). Grow the window so nothing that was already rendered drops off the bottom.
        setPrevItems(items);
        const lastVisibleItem = prevItems[Math.min(visibleCount, prevItems.length) - 1];
        const lastVisibleIndex = lastVisibleItem === undefined ? -1 : items.indexOf(lastVisibleItem);

        if (lastVisibleIndex + 1 > visibleCount) {
            setVisibleCount(lastVisibleIndex + 1);
        }
    }

    const hasMore = visibleCount < items.length;

    const lastVisibleItem = items[Math.min(visibleCount, items.length) - 1];

    useEffect(() => {
        if (visibleCount > pageSize) {
            pagedLists.set(resetKey, { visibleCount, lastVisibleItem });
        } else {
            pagedLists.delete(resetKey);
        }
    }, [resetKey, visibleCount, lastVisibleItem, pageSize]);

    // Re-created whenever visibleCount changes: a new observer reports the sentinel's current
    // state straight away, so if it is still near the viewport after a page renders (short posts,
    // tall screen) the next page follows without the user having to scroll.
    useEffect(() => {
        const sentinel = sentinelRef.current;

        if (!hasMore || !sentinel) {
            return;
        }

        let active = true;

        const observer = new IntersectionObserver((entries) => {
            if (active && entries.some(entry => entry.isIntersecting)) {
                setVisibleCount(current => current + pageSize);
            }
        }, { rootMargin: SENTINEL_ROOT_MARGIN });

        observer.observe(sentinel);

        return () => {
            active = false;
            observer.disconnect();
        };
    }, [hasMore, visibleCount, pageSize]);

    return { visibleItems: items.slice(0, visibleCount), hasMore, sentinelRef };
}
