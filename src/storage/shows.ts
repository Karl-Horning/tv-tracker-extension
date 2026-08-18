/**
 * @fileoverview Persistence layer for tracked shows using chrome.storage.local.
 *
 * Four keys are maintained in storage:
 *   - `trackedIds`  — ordered list of show IDs the user has added
 *   - `showCache`   — map of show ID → TvmazeShow with cached episode data
 *   - `sortOrder`   — the user's chosen show sort order
 *   - `theme`       — the user's chosen light/dark appearance
 */

import type { TvmazeShow } from "../api/tvmaze";
import type { SortOrder } from "../filter/classify";

/** Storage key for the ordered list of tracked show IDs. */
const KEY_IDS = "trackedIds";

/** Storage key for the cached TVmaze show data, keyed by string show ID. */
const KEY_CACHE = "showCache";

/** Storage key for the user's chosen show sort order. */
const KEY_SORT = "sortOrder";

/** Storage key for the user's chosen light/dark appearance. */
const KEY_THEME = "theme";

/** The popup's light/dark appearance. */
export type Theme = "light" | "dark";

/**
 * Returns the ordered list of tracked show IDs.
 *
 * @returns Show IDs in insertion order, or an empty array if none are tracked.
 */
export async function getTrackedIds(): Promise<number[]> {
    const result = await chrome.storage.local.get(KEY_IDS);
    return (result[KEY_IDS] as number[] | undefined) ?? [];
}

/**
 * Returns cached show data for all tracked shows, in insertion order.
 *
 * Shows not present in the cache are omitted from the result.
 *
 * @returns Array of TvmazeShow objects.
 */
export async function getCachedShows(): Promise<TvmazeShow[]> {
    const result = await chrome.storage.local.get([KEY_IDS, KEY_CACHE]);
    const ids = (result[KEY_IDS] as number[] | undefined) ?? [];
    const cache =
        (result[KEY_CACHE] as Record<string, TvmazeShow> | undefined) ?? {};
    return ids.flatMap((id) => {
        const show = cache[String(id)];
        return show ? [show] : [];
    });
}

/**
 * Adds a show to the tracked list and stores its data in the cache.
 *
 * If the show is already tracked this is a no-op — the existing entry and
 * its cached data are left unchanged.
 *
 * @param show - The TvmazeShow to track (must include embedded episode data).
 */
export async function addShow(show: TvmazeShow): Promise<void> {
    await addShows([show]);
}

/**
 * Adds multiple shows to the tracked list in a single read-modify-write.
 *
 * Shows already tracked are left unchanged. Calling this once for a batch of
 * shows — rather than calling addShow once per show from concurrent code —
 * avoids the lost-update race where overlapping reads of the same stale
 * tracked-list snapshot cause later writes to silently clobber earlier ones.
 *
 * @param shows - The TvmazeShows to track (must include embedded episode data).
 */
export async function addShows(shows: TvmazeShow[]): Promise<void> {
    const result = await chrome.storage.local.get([KEY_IDS, KEY_CACHE]);
    const ids = (result[KEY_IDS] as number[] | undefined) ?? [];
    const cache =
        (result[KEY_CACHE] as Record<string, TvmazeShow> | undefined) ?? {};

    const newIds = [...ids];
    const newCache = { ...cache };
    for (const show of shows) {
        if (newIds.includes(show.id)) continue;
        newIds.push(show.id);
        newCache[String(show.id)] = show;
    }

    await chrome.storage.local.set({
        [KEY_IDS]: newIds,
        [KEY_CACHE]: newCache,
    });
}

/**
 * Removes a show from the tracked list and its data from the cache.
 *
 * If the show is not currently tracked this is a no-op.
 *
 * @param id - The TVmaze show ID to remove.
 */
export async function removeShow(id: number): Promise<void> {
    const result = await chrome.storage.local.get([KEY_IDS, KEY_CACHE]);
    const ids = (result[KEY_IDS] as number[] | undefined) ?? [];
    const cache =
        (result[KEY_CACHE] as Record<string, TvmazeShow> | undefined) ?? {};

    const newCache = { ...cache };
    delete newCache[String(id)];

    await chrome.storage.local.set({
        [KEY_IDS]: ids.filter((i) => i !== id),
        [KEY_CACHE]: newCache,
    });
}

/**
 * Replaces a show's cached data without touching the tracked IDs list.
 *
 * @param show - Updated TvmazeShow data to store in the cache.
 */
export async function updateCachedShow(show: TvmazeShow): Promise<void> {
    await updateCachedShows([show]);
}

/**
 * Replaces cached data for multiple shows in a single read-modify-write,
 * without touching the tracked IDs list.
 *
 * Calling this once for a batch of shows — rather than calling
 * updateCachedShow once per show from concurrent code — avoids the
 * lost-update race where overlapping reads of the same stale cache snapshot
 * cause later writes to silently clobber earlier ones.
 *
 * @param shows - Updated TvmazeShow data to store in the cache.
 */
export async function updateCachedShows(shows: TvmazeShow[]): Promise<void> {
    const result = await chrome.storage.local.get(KEY_CACHE);
    const cache =
        (result[KEY_CACHE] as Record<string, TvmazeShow> | undefined) ?? {};

    const newCache = { ...cache };
    for (const show of shows) {
        newCache[String(show.id)] = show;
    }

    await chrome.storage.local.set({ [KEY_CACHE]: newCache });
}

/**
 * Returns the user's chosen sort order for shows within each section.
 *
 * @returns The stored sort order, or "title-asc" if none has been set.
 */
export async function getSortOrder(): Promise<SortOrder> {
    const result = await chrome.storage.local.get(KEY_SORT);
    return (result[KEY_SORT] as SortOrder | undefined) ?? "title-asc";
}

/**
 * Stores the user's chosen sort order for shows within each section.
 *
 * @param order - The sort order to persist.
 */
export async function setSortOrder(order: SortOrder): Promise<void> {
    await chrome.storage.local.set({ [KEY_SORT]: order });
}

/**
 * Returns the user's explicitly chosen appearance.
 *
 * A null return means the user has never chosen — the popup should follow
 * the operating system's light/dark preference instead of a fixed default.
 *
 * @returns "light", "dark", or null if no explicit choice has been stored.
 */
export async function getTheme(): Promise<Theme | null> {
    const result = await chrome.storage.local.get(KEY_THEME);
    return (result[KEY_THEME] as Theme | undefined) ?? null;
}

/**
 * Stores the user's chosen appearance.
 *
 * @param theme - The appearance to persist.
 */
export async function setTheme(theme: Theme): Promise<void> {
    await chrome.storage.local.set({ [KEY_THEME]: theme });
}
