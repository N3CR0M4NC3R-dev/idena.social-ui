import { useLayoutEffect, useReducer } from 'react';

// Object URLs are shared per Blob/File instance and reference counted, so the same
// media rendered in several places reuses one URL, and it is revoked once unused.

type ObjectUrlEntry = { objectUrl: string, refCount: number };

const REVOKE_DELAY_MS = 1000;

const objectUrlEntries = new WeakMap<Blob, ObjectUrlEntry>();

const revokeObjectUrlIfUnused = (blob: Blob) => {
    const entry = objectUrlEntries.get(blob);

    if (!entry || entry.refCount > 0) {
        return;
    }

    URL.revokeObjectURL(entry.objectUrl);
    objectUrlEntries.delete(blob);
};

// Revoking is deferred so that a quick release/retain (e.g. React StrictMode effects,
// remounts) reuses the existing URL instead of revoking and recreating it.
const scheduleRevokeObjectUrlIfUnused = (blob: Blob) => {
    setTimeout(() => revokeObjectUrlIfUnused(blob), REVOKE_DELAY_MS);
};

export const getObjectUrl = (blob: Blob) => {
    let entry = objectUrlEntries.get(blob);

    if (!entry) {
        entry = { objectUrl: URL.createObjectURL(blob), refCount: 0 };
        objectUrlEntries.set(blob, entry);
        // cleans up URLs that are created but never retained (e.g. a discarded render)
        scheduleRevokeObjectUrlIfUnused(blob);
    }

    return entry.objectUrl;
};

export const retainObjectUrl = (blob: Blob) => {
    const objectUrl = getObjectUrl(blob);
    objectUrlEntries.get(blob)!.refCount++;

    return objectUrl;
};

export const releaseObjectUrl = (blob: Blob) => {
    const entry = objectUrlEntries.get(blob);

    if (!entry) {
        return;
    }

    entry.refCount = Math.max(0, entry.refCount - 1);

    if (entry.refCount === 0) {
        scheduleRevokeObjectUrlIfUnused(blob);
    }
};

export const useObjectUrl = (blob?: Blob) => {
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const objectUrl = blob ? getObjectUrl(blob) : undefined;

    // layout effect runs in the same task as the DOM commit, so no revoke timer can fire in between
    useLayoutEffect(() => {
        if (!blob) {
            return;
        }

        // fallback: re-render if the URL used during render was revoked before commit
        if (retainObjectUrl(blob) !== objectUrl) {
            forceUpdate();
        }

        return () => releaseObjectUrl(blob);
    }, [blob, objectUrl]);

    return objectUrl;
};
