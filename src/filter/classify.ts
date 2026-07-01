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
 * - `fresh`    – previous episode aired within the last 30 days
 * - `upcoming` – next episode is scheduled
 * - `hiatus`   – active show with no recent or upcoming episodes
 * - `ended`    – show has concluded with no upcoming episodes
 */
export type ShowGroup = "fresh" | "upcoming" | "hiatus" | "ended";

/**
 * Returns the status groups a show belongs to.
 *
 * "fresh" and "upcoming" are not mutually exclusive — both are returned when
 * a show has a recent previous episode and a scheduled next episode. "hiatus"
 * and "ended" are returned only when neither "fresh" nor "upcoming" applies.
 *
 * @param show - A TvmazeShow with embedded episode data.
 * @param now  - Reference date for the 30-day window (defaults to now).
 * @returns Groups the show belongs to, in display order.
 */
export function classifyShow(
    show: TvmazeShow,
    now: Date = new Date(),
): ShowGroup[] {
    const groups: ShowGroup[] = [];
    const todayStr = toDateString(now);
    const thirtyDaysAgoStr = toDateString(
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    );

    const prev = show._embedded.previousepisode;
    if (prev && prev.airdate >= thirtyDaysAgoStr && prev.airdate <= todayStr) {
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
