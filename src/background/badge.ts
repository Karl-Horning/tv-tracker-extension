/**
 * @fileoverview Toolbar badge logic for the TV Tracker extension.
 *
 * Shows the count of tracked shows with a recently aired episode on the
 * extension's toolbar icon, so that's visible without opening the popup.
 */

import type { TvmazeShow } from "../api/tvmaze";
import { classifyShow } from "../filter/classify";
import { getCachedShows } from "../storage/shows";

/**
 * Counts how many shows are in the "fresh" group (aired within 30 days).
 *
 * @param shows - Cached shows to classify.
 * @param now - Reference date for the 30-day window; defaults to now.
 * @returns The number of shows with a recently aired episode.
 */
export function countFreshShows(
    shows: TvmazeShow[],
    now: Date = new Date(),
): number {
    return shows.filter((show) => classifyShow(show, now).includes("fresh"))
        .length;
}

/**
 * Recomputes the fresh-show count from cached data and sets the toolbar
 * badge to match. Clears the badge when the count is zero.
 *
 * @param now - Reference date for the 30-day window; defaults to now.
 */
export async function updateBadge(now: Date = new Date()): Promise<void> {
    const shows = await getCachedShows();
    const count = countFreshShows(shows, now);
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
}
