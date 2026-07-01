/**
 * @fileoverview Unit tests for the show storage module.
 *
 * chrome.storage.local is replaced with an in-memory stub so tests run
 * in Node without a real browser or extension context.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    addShow,
    getCachedShows,
    getTrackedIds,
    removeShow,
    updateCachedShow,
} from "./shows";
import type { TvmazeShow } from "../api/tvmaze";

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

/**
 * Resets the backing store and stubs chrome.storage.local before each test.
 */
function stubChrome(): void {
    store = {};
    vi.stubGlobal("chrome", {
        storage: {
            local: {
                get: vi.fn(async (keys: string | string[]) => {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    return Object.fromEntries(
                        keyList.map((k) => [k, store[k]]),
                    );
                }),
                set: vi.fn(async (items: Record<string, unknown>) => {
                    Object.assign(store, items);
                }),
            },
        },
    });
}

describe("getTrackedIds", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("returns an empty array when storage is empty", async () => {
        expect(await getTrackedIds()).toEqual([]);
    });

    it("returns the stored IDs in insertion order", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_B);
        expect(await getTrackedIds()).toEqual([83, 84]);
    });
});

describe("getCachedShows", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("returns an empty array when the cache is empty", async () => {
        expect(await getCachedShows()).toEqual([]);
    });

    it("returns shows in insertion order", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_B);
        const shows = await getCachedShows();
        expect(shows[0].id).toBe(83);
        expect(shows[1].id).toBe(84);
    });

    it("omits shows whose cached data is missing", async () => {
        store["trackedIds"] = [83, 99];
        store["showCache"] = { "83": SHOW_A };
        const shows = await getCachedShows();
        expect(shows).toHaveLength(1);
        expect(shows[0].id).toBe(83);
    });
});

describe("addShow", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("adds the show ID to the tracked list", async () => {
        await addShow(SHOW_A);
        expect(await getTrackedIds()).toContain(83);
    });

    it("stores the show data in the cache", async () => {
        await addShow(SHOW_A);
        const shows = await getCachedShows();
        expect(shows).toHaveLength(1);
        expect(shows[0].name).toBe("The Simpsons");
    });

    it("preserves existing shows when adding a new one", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_B);
        const shows = await getCachedShows();
        expect(shows).toHaveLength(2);
    });

    it("is a no-op when the show is already tracked", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_A);
        expect(await getTrackedIds()).toEqual([83]);
    });
});

describe("removeShow", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("removes the show ID from the tracked list", async () => {
        await addShow(SHOW_A);
        await removeShow(83);
        expect(await getTrackedIds()).not.toContain(83);
    });

    it("removes the show data from the cache", async () => {
        await addShow(SHOW_A);
        await removeShow(83);
        expect(await getCachedShows()).toHaveLength(0);
    });

    it("leaves other shows untouched", async () => {
        await addShow(SHOW_A);
        await addShow(SHOW_B);
        await removeShow(83);
        const shows = await getCachedShows();
        expect(shows).toHaveLength(1);
        expect(shows[0].id).toBe(84);
    });

    it("is a no-op when the show is not tracked", async () => {
        await addShow(SHOW_A);
        await removeShow(99999);
        expect(await getTrackedIds()).toEqual([83]);
    });
});

describe("updateCachedShow", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("replaces the cached data for the show", async () => {
        await addShow(SHOW_A);
        const updated: TvmazeShow = { ...SHOW_A, status: "Ended" };
        await updateCachedShow(updated);
        const shows = await getCachedShows();
        expect(shows[0].status).toBe("Ended");
    });

    it("does not change the tracked IDs", async () => {
        await addShow(SHOW_A);
        await updateCachedShow({ ...SHOW_A, status: "Ended" });
        expect(await getTrackedIds()).toEqual([83]);
    });
});
