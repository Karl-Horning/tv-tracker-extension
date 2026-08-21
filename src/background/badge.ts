/**
 * @fileoverview Toolbar badge logic for the TV Tracker extension.
 *
 * Shows the count of tracked shows with a recently aired episode on the
 * extension's toolbar icon, so that's visible without opening the popup.
 */

import type { TvmazeShow } from "../api/tvmaze";
import { classifyShow, DEFAULT_FRESH_WINDOW_DAYS } from "../filter/classify";
import { getCachedShows, getFreshWindowDays } from "../storage/shows";

/**
 * Counts how many shows are in the "fresh" group.
 *
 * @param shows - Cached shows to classify.
 * @param now - Reference date for the fresh window; defaults to now.
 * @param freshWindowDays - How many days back a previous episode still counts
 *   as fresh; defaults to DEFAULT_FRESH_WINDOW_DAYS.
 * @returns The number of shows with a recently aired episode.
 */
export function countFreshShows(
    shows: TvmazeShow[],
    now: Date = new Date(),
    freshWindowDays: number = DEFAULT_FRESH_WINDOW_DAYS,
): number {
    return shows.filter((show) =>
        classifyShow(show, now, freshWindowDays).includes("fresh"),
    ).length;
}

/**
 * Recomputes the fresh-show count from cached data and the user's chosen
 * window length, then sets the toolbar badge to match. Clears the badge
 * when the count is zero.
 *
 * @param now - Reference date for the fresh window; defaults to now.
 */
export async function updateBadge(now: Date = new Date()): Promise<void> {
    const [shows, freshWindowDays] = await Promise.all([
        getCachedShows(),
        getFreshWindowDays(),
    ]);
    const count = countFreshShows(shows, now, freshWindowDays);
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
}
