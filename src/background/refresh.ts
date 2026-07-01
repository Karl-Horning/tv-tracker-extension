/**
 * @fileoverview Background refresh logic for the TV Tracker extension.
 *
 * Exports functions for fetching fresh show data from TVmaze and updating
 * the storage cache. No side effects at module load time.
 */

import { fetchShow } from "../api/tvmaze";
import { getTrackedIds, updateCachedShow } from "../storage/shows";

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
 * Uses Promise.allSettled so a failure on one show does not prevent the
 * remaining shows from being refreshed.
 */
export async function refreshAllShows(): Promise<void> {
    const ids = await getTrackedIds();
    await Promise.allSettled(
        ids.map(async (id) => {
            const show = await fetchShow(id);
            await updateCachedShow(show);
        }),
    );
}
