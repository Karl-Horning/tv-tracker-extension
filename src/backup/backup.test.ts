/**
 * @fileoverview Unit tests for the backup import/export module.
 *
 * Stubs chrome.storage.local with an in-memory store and global fetch with a
 * mock TVmaze response, so tests run in Node without a browser or network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBackup, importBackup, parseBackup } from "./backup";
import type { TvmazeShow } from "../api/tvmaze";
import { addShow } from "../storage/shows";

const SHOW_A: TvmazeShow = {
    id: 83,
    name: "The Simpsons",
    status: "Running",
    _embedded: {},
};
const SHOW_B: TvmazeShow = {
    id: 84,
    name: "Bob's Burgers",
    status: "Running",
    _embedded: {},
};

/** In-memory backing store shared across get/set within a single test. */
let store: Record<string, unknown>;

/** Resets the backing store and stubs chrome.storage.local before each test. */
function stubChrome(): void {
    store = {};
    vi.stubGlobal("chrome", {
        storage: {
            local: {
                get: vi.fn((keys: string | string[]) => {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    return Object.fromEntries(keyList.map((k) => [k, store[k]]));
                }),
                set: vi.fn((items: Record<string, unknown>) => {
                    Object.assign(store, items);
                }),
            },
        },
    });
}

/**
 * Stubs global fetch to resolve the given show for any /shows/:id request,
 * or reject for IDs listed in failIds.
 *
 * @param shows - Shows to serve, keyed by ID.
 * @param failIds - IDs that should reject instead of resolving.
 */
function stubFetch(shows: Record<number, TvmazeShow>, failIds: number[] = []): void {
    vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
            const id = Number(url.match(/\/shows\/(\d+)/)?.[1]);
            if (failIds.includes(id)) {
                return { ok: false, status: 404, json: () => Promise.resolve({}) };
            }
            return { ok: true, status: 200, json: () => Promise.resolve(shows[id]) };
        }),
    );
}

describe("buildBackup", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("returns an empty shows array when nothing is tracked", async () => {
        const backup = await buildBackup();
        expect(backup.shows).toEqual([]);
    });

    it("includes the ID and name of every tracked show", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_B);
        const backup = await buildBackup();
        expect(backup.shows).toEqual([
            { id: 83, name: "The Simpsons" },
            { id: 84, name: "Bob's Burgers" },
        ]);
    });

    it("sets a version and an ISO exportedAt timestamp", async () => {
        const backup = await buildBackup();
        expect(backup.version).toBe(1);
        expect(() => new Date(backup.exportedAt).toISOString()).not.toThrow();
    });
});

describe("parseBackup", () => {
    it("parses a valid backup file", () => {
        const text = JSON.stringify({
            version: 1,
            exportedAt: "2026-08-18T00:00:00.000Z",
            shows: [{ id: 83, name: "The Simpsons" }],
        });
        const backup = parseBackup(text);
        expect(backup.shows).toEqual([{ id: 83, name: "The Simpsons" }]);
    });

    it("throws for text that is not valid JSON", () => {
        expect(() => parseBackup("not json")).toThrow("not valid JSON");
    });

    it("throws when the shows field is missing", () => {
        const text = JSON.stringify({ version: 1, exportedAt: "2026-08-18" });
        expect(() => parseBackup(text)).toThrow("not a recognised TV Tracker backup");
    });

    it("throws when a show entry has no numeric id", () => {
        const text = JSON.stringify({
            version: 1,
            exportedAt: "2026-08-18",
            shows: [{ name: "The Simpsons" }],
        });
        expect(() => parseBackup(text)).toThrow("not a recognised TV Tracker backup");
    });

    it("throws for a JSON array instead of an object", () => {
        expect(() => parseBackup("[]")).toThrow("not a recognised TV Tracker backup");
    });
});

describe("importBackup", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("adds every show in the backup using freshly fetched data", async () => {
        stubFetch({ 83: SHOW_A, 84: SHOW_B });
        const result = await importBackup({
            version: 1,
            exportedAt: "2026-08-18",
            shows: [{ id: 83, name: "The Simpsons" }, { id: 84, name: "Bob's Burgers" }],
        });
        expect(result).toEqual({ imported: 2, failed: 0 });
    });

    it("counts a failed fetch without stopping the rest of the import", async () => {
        stubFetch({ 83: SHOW_A }, [99999]);
        const result = await importBackup({
            version: 1,
            exportedAt: "2026-08-18",
            shows: [
                { id: 83, name: "The Simpsons" },
                { id: 99999, name: "Missing Show" },
            ],
        });
        expect(result).toEqual({ imported: 1, failed: 1 });
    });

    it("does not duplicate a show that is already tracked", async () => {
        stubFetch({ 83: SHOW_A });
        await addShow(SHOW_A);
        await importBackup({
            version: 1,
            exportedAt: "2026-08-18",
            shows: [{ id: 83, name: "The Simpsons" }],
        });
        expect(store["trackedIds"]).toEqual([83]);
    });

    it("imports all shows from a large backup without losing any", async () => {
        // Regression test for a real report: importing a 16-show backup
        // reported "16 imported" but only 5 ended up tracked, because each
        // show was added with its own concurrent addShow call and the
        // resulting storage race silently dropped the rest. importBackup
        // must fetch in parallel but write in a single batch.
        const shows = Object.fromEntries(
            Array.from({ length: 16 }, (_, i) => [i, { ...SHOW_A, id: i }]),
        );
        stubFetch(shows);
        const result = await importBackup({
            version: 1,
            exportedAt: "2026-08-18",
            shows: Object.values(shows).map((s) => ({ id: s.id, name: s.name })),
        });
        expect(result).toEqual({ imported: 16, failed: 0 });
        expect(store["trackedIds"]).toHaveLength(16);
    });
});
