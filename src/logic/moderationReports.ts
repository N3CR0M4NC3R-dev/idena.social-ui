import { getTxWithIdenaIndexerApi, type Post } from './asyncUtils';
import { getModerationSnapshot, getReportResolution, groupReports, normalizeHex, type ReportGroup } from './moderation';

// The Reports queue as this browser keeps it (docs/moderation.md, "The reports queue"): what each moderator dismissed,
// and how far they've seen, for the menu badge. The contract can't dismiss a report, so other moderators still see
// a dismissed one. Kept in localStorage, per moderator address.

const DISMISSALS_KEY = 'moderationReportDismissals';
const SEEN_KEY = 'moderationReportsSeen';

// Parsed once, then kept in memory and written through: App reads them on every render.
const stores = new Map<string, Record<string, unknown>>();
// Bumped on every change the badge depends on, besides the moderation snapshot and the posts.
let version = 0;

const readStore = <T>(key: string): Record<string, T> => {
    let store = stores.get(key);
    if (!store) {
        try {
            store = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown> ?? {};
        } catch {
            store = {};
        }
        stores.set(key, store);
    }
    return store as Record<string, T>;
};

const writeStore = <T>(key: string, moderator: string, value: T) => {
    const store = { ...readStore<T>(key), [normalizeHex(moderator)]: value };
    stores.set(key, store);
    version++;
    localStorage.setItem(key, JSON.stringify(store));
};

// A dismissal keeps the time of the newest report it covered: a later report reopens the group.
const readDismissals = (moderator: string) => readStore<Record<string, number>>(DISMISSALS_KEY)[normalizeHex(moderator)] ?? {};

export const dismissReportGroup = (moderator: string, group: ReportGroup) => {
    writeStore(DISMISSALS_KEY, moderator, { ...readDismissals(moderator), [group.key]: group.newest });
};

export const reopenReportGroup = (moderator: string, groupKey: string) => {
    const dismissals = { ...readDismissals(moderator) };
    delete dismissals[groupKey];
    writeStore(DISMISSALS_KEY, moderator, dismissals);
};

// The time of the newest report the moderator has seen in the queue.
const readReportsSeenAt = (moderator: string) => readStore<number>(SEEN_KEY)[normalizeHex(moderator)] ?? 0;

// Returns true when it moved on, so the badge needs redrawing.
export const markReportsSeen = (moderator: string, newest: number) => {
    if (newest <= readReportsSeenAt(moderator)) return false;
    writeStore(SEEN_KEY, moderator, newest);
    return true;
};

// Posts by transaction hash, built once per posts object: App replaces it whenever a post changes.
const postsByTxHashCache = new WeakMap<Record<string, Post>, Map<string, Post>>();

export const findPostByTxHash = (posts: Record<string, Post>, txHash: string) => {
    let postsByTxHash = postsByTxHashCache.get(posts);
    if (!postsByTxHash) {
        postsByTxHash = new Map(Object.values(posts).filter((post) => post?.postId && post.txHash).map((post) => [post.txHash.toLowerCase(), post]));
        postsByTxHashCache.set(posts, postsByTxHash);
    }
    return postsByTxHash.get(normalizeHex(txHash));
};

// A reported transaction that hasn't loaded as a post (a message, an older post, anything else): its sender and type
// from the indexer, fetched once. null when the indexer doesn't know it.
export type ReportedTransaction = { from: string, type: string };
const reportedTransactions = new Map<string, ReportedTransaction | null>();
const reportedTransactionsInFlight = new Map<string, Promise<void>>();

export const getReportedTransaction = (txHash: string) => reportedTransactions.get(normalizeHex(txHash));

export const lookUpReportedTransaction = (indexerApiUrl: string, txHash: string) => {
    const hash = normalizeHex(txHash);
    if (reportedTransactions.has(hash)) return Promise.resolve();

    let inFlight = reportedTransactionsInFlight.get(hash);
    if (!inFlight) {
        inFlight = getTxWithIdenaIndexerApi(indexerApiUrl, hash)
            .then(({ result, error }) => {
                // A failed request is tried again next time; an unknown transaction isn't.
                if (error) return;
                const tx = result as { from?: string, type?: string } | undefined;
                reportedTransactions.set(hash, tx?.from ? { from: tx.from.toLowerCase(), type: tx.type ?? '' } : null);
                version++;
            })
            .finally(() => reportedTransactionsInFlight.delete(hash));
        reportedTransactionsInFlight.set(hash, inFlight);
    }
    return inFlight;
};

// author: the sender of a reported transaction, when known. resolution: why it needs no action now.
export type ReportGroupView = ReportGroup & { post?: Post, author?: string, resolution?: string, dismissed: boolean };

export const getReportGroupViews = (moderator: string, posts: Record<string, Post>): ReportGroupView[] => {
    const dismissals = readDismissals(moderator);
    return groupReports().map((group) => {
        const post = group.kind === 'transaction' ? findPostByTxHash(posts, group.target) : undefined;
        const author = group.kind === 'transaction' ? post?.poster ?? getReportedTransaction(group.target)?.from : undefined;
        return { ...group, post, author, resolution: getReportResolution(group, author), dismissed: (dismissals[group.key] ?? -1) >= group.newest };
    });
};

let badgeCache: { snapshot: object, posts: object, moderator: string, version: number, count: number } | undefined;

// The menu badge: open groups with a report the moderator hasn't seen in the queue. Worked out again only when
// something it depends on changed.
export const countNewReportGroups = (moderator: string, posts: Record<string, Post>) => {
    const snapshot = getModerationSnapshot();
    if (badgeCache?.snapshot === snapshot && badgeCache.posts === posts && badgeCache.moderator === moderator && badgeCache.version === version) {
        return badgeCache.count;
    }

    const seenAt = readReportsSeenAt(moderator);
    const count = getReportGroupViews(moderator, posts).filter((group) => !group.resolution && !group.dismissed && group.newest > seenAt).length;
    badgeCache = { snapshot, posts, moderator, version, count };
    return count;
};
