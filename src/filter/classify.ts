/**
 * @fileoverview Show classification logic for the TV Tracker status board.
 *
 * Determines which status sections a show belongs to based on its air dates
 * and TVmaze status. Shows can belong to multiple groups simultaneously: a
 * show with a recent previous episode and a scheduled next episode appears
 * in both "Aired recently" and "Coming up".
 */

import type { TvmazeShow } from "../api/tvmaze";

/**
 * Status group identifiers corresponding to the four popup sections.
 *
 * - `fresh`    – previous episode aired within the fresh window
 * - `upcoming` – next episode is scheduled
 * - `hiatus`   – active show with no recent or upcoming episodes
 * - `ended`    – show has concluded with no upcoming episodes
 */
export type ShowGroup = "fresh" | "upcoming" | "hiatus" | "ended";

/** Sort order for shows within each status section. */
export type SortOrder =
    | "title-asc"
    | "title-desc"
    | "airdate-asc"
    | "airdate-desc";

/** Default number of days a previous episode counts as "fresh". */
export const DEFAULT_FRESH_WINDOW_DAYS = 30;

/**
 * Returns the status groups a show belongs to.
 *
 * "fresh" and "upcoming" are not mutually exclusive — both are returned when
 * a show has a recent previous episode and a scheduled next episode. "hiatus"
 * and "ended" are returned only when neither "fresh" nor "upcoming" applies.
 *
 * @param show - A TvmazeShow with embedded episode data.
 * @param now  - Reference date for the fresh window (defaults to now).
 * @param freshWindowDays - How many days back a previous episode still counts
 *   as fresh (defaults to DEFAULT_FRESH_WINDOW_DAYS).
 * @returns Groups the show belongs to, in display order.
 */
export function classifyShow(
    show: TvmazeShow,
    now: Date = new Date(),
    freshWindowDays: number = DEFAULT_FRESH_WINDOW_DAYS,
): ShowGroup[] {
    const groups: ShowGroup[] = [];
    const todayStr = toDateString(now);
    const windowStartStr = toDateString(
        new Date(now.getTime() - freshWindowDays * 24 * 60 * 60 * 1000),
    );

    const prev = show._embedded.previousepisode;
    if (prev && prev.airdate >= windowStartStr && prev.airdate <= todayStr) {
        groups.push("fresh");
    }

    if (show._embedded.nextepisode) {
        groups.push("upcoming");
    }

    if (groups.length === 0) {
        groups.push(show.status === "Ended" ? "ended" : "hiatus");
    }

    return groups;
}

/**
 * Formats a Date as "YYYY-MM-DD" in UTC for consistent airdate comparisons.
 *
 * @param date - The date to format.
 * @returns ISO date string, for example "2026-07-01".
 */
function toDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
}
