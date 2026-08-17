/**
 * @fileoverview Import/export logic for backing up and restoring tracked shows.
 *
 * A backup file lists only show IDs and names — episode data is always
 * re-fetched from TVmaze on import so restored shows start with current data
 * rather than a stale snapshot.
 */

import { fetchShow } from "../api/tvmaze";
import { addShows, getCachedShows } from "../storage/shows";

/** Current schema version for exported backup files. */
export const BACKUP_VERSION = 1;

/** A single show entry within an exported backup file. */
export interface BackupEntry {
    id: number;
    name: string;
}

/** The full shape of an exported backup file. */
export interface BackupFile {
    version: number;
    exportedAt: string;
    shows: BackupEntry[];
}

/** Outcome of importing a backup file. */
export interface ImportResult {
    imported: number;
    failed: number;
}

/**
 * Builds a backup file from the currently tracked shows.
 *
 * @returns A BackupFile listing every tracked show's ID and name.
 */
export async function buildBackup(): Promise<BackupFile> {
    const shows = await getCachedShows();
    return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        shows: shows.map((show) => ({ id: show.id, name: show.name })),
    };
}

/**
 * Parses and validates a backup file's raw JSON text.
 *
 * @param text - The raw contents of a backup file.
 * @returns The parsed backup file.
 * @throws {Error} If the text is not valid JSON or not a recognised backup file.
 */
export function parseBackup(text: string): BackupFile {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("That file is not valid JSON.");
    }

    if (!isBackupFile(data)) {
        throw new Error("That file is not a recognised TV Tracker backup.");
    }

    return data;
}

/**
 * Imports a backup file, adding each listed show with freshly fetched data.
 *
 * Fetches happen in parallel, but the successfully fetched shows are added
 * to storage in a single batch — adding one at a time from concurrent code
 * would race, with later writes silently clobbering earlier ones. Shows
 * already tracked are left unchanged. A show whose TVmaze fetch fails is
 * skipped without preventing the rest of the import.
 *
 * @param backup - A parsed backup file, typically from parseBackup.
 * @returns Counts of shows successfully imported and shows that failed.
 */
export async function importBackup(backup: BackupFile): Promise<ImportResult> {
    const results = await Promise.allSettled(
        backup.shows.map((entry) => fetchShow(entry.id)),
    );
    const shows = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
    );
    if (shows.length > 0) await addShows(shows);
    const failed = results.length - shows.length;
    return { imported: shows.length, failed };
}

/**
 * Checks whether a parsed JSON value has the shape of a backup file.
 *
 * @param data - The parsed JSON value to check.
 * @returns True if data matches the BackupFile shape.
 */
function isBackupFile(data: unknown): data is BackupFile {
    if (typeof data !== "object" || data === null) return false;
    const candidate = data as Record<string, unknown>;
    return (
        typeof candidate.version === "number" &&
        Array.isArray(candidate.shows) &&
        candidate.shows.every(
            (entry) =>
                typeof entry === "object" &&
                entry !== null &&
                typeof (entry as Record<string, unknown>).id === "number",
        )
    );
}
