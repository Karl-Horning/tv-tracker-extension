/**
 * @fileoverview Background refresh logic for the TV Tracker extension.
 *
 * Exports functions for fetching fresh show data from TVmaze and updating
 * the storage cache. No side effects at module load time.
 */

import { fetchShow } from "../api/tvmaze";
import { getTrackedIds, updateCachedShows } from "../storage/shows";

/** Name of the periodic refresh alarm registered with chrome.alarms. */
export const ALARM_NAME = "refresh";

/** How often the refresh alarm fires, in minutes. */
export const ALARM_PERIOD_MINUTES = 240;

/**
 * Creates the periodic refresh alarm.
 *
 * Safe to call on every install or update — chrome.alarms.create replaces
 * any existing alarm with the same name rather than creating a duplicate.
 */
export function registerAlarm(): void {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

/**
 * Handles a chrome.alarms alarm event.
 *
 * Ignores alarms whose name does not match ALARM_NAME so the handler is
 * safe to register unconditionally even if other alarms exist.
 *
 * @param alarm - The alarm that fired.
 */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== ALARM_NAME) return;
    await refreshAllShows();
}

/**
 * Fetches fresh data for every tracked show and writes it to the cache.
 *
 * Fetches happen in parallel, but the successfully fetched shows are written
 * to storage in a single batch — writing one at a time from concurrent code
 * would race, with later writes silently clobbering earlier ones. A failure
 * fetching one show does not prevent the rest from being refreshed.
 */
export async function refreshAllShows(): Promise<void> {
    const ids = await getTrackedIds();
    const results = await Promise.allSettled(ids.map((id) => fetchShow(id)));
    const shows = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
    );
    if (shows.length > 0) await updateCachedShows(shows);
}
