/**
 * @fileoverview Unit tests for the show storage module.
 *
 * chrome.storage.local is replaced with an in-memory stub so tests run
 * in Node without a real browser or extension context.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    addShow,
    addShows,
    getCachedShows,
    getSortOrder,
    getTheme,
    getTrackedIds,
    removeShow,
    setSortOrder,
    setTheme,
    updateCachedShow,
    updateCachedShows,
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
                get: vi.fn((keys: string | string[]) => {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    return Object.fromEntries(
                        keyList.map((k) => [k, store[k]]),
                    );
                }),
                set: vi.fn((items: Record<string, unknown>) => {
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

    it("loses shows when called concurrently for different shows", async () => {
        // Regression guard: addShow does a read-then-write against
        // chrome.storage.local, so overlapping calls race — each reads the
        // same stale snapshot before any of them has written back, and
        // later writes silently clobber earlier ones. This is exactly the
        // bug that made importing 16 shows only persist 5. Code that adds
        // several shows at once must use addShows instead, which batches
        // them into a single read-modify-write (see the "addShows" tests
        // below).
        const shows = Array.from({ length: 16 }, (_, i) => ({
            ...SHOW_A,
            id: i,
        }));
        await Promise.all(shows.map((show) => addShow(show)));
        expect((await getTrackedIds()).length).toBeLessThan(16);
    });
});

describe("addShows", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("adds every show's ID to the tracked list", async () => {
        await addShows([SHOW_A, SHOW_B]);
        expect(await getTrackedIds()).toEqual([83, 84]);
    });

    it("stores every show's data in the cache", async () => {
        await addShows([SHOW_A, SHOW_B]);
        const shows = await getCachedShows();
        expect(shows.map((s) => s.name)).toEqual([
            "The Simpsons",
            "Bob's Burgers",
        ]);
    });

    it("preserves shows already tracked from a previous call", async () => {
        await addShow(SHOW_A);
        await addShows([SHOW_B]);
        expect(await getTrackedIds()).toEqual([83, 84]);
    });

    it("skips a show that is already tracked without duplicating it", async () => {
        await addShow(SHOW_A);
        await addShows([SHOW_A, SHOW_B]);
        expect(await getTrackedIds()).toEqual([83, 84]);
    });

    it("does not lose shows when adding a large batch at once", async () => {
        // The scenario this fixes: importing many shows used to call addShow
        // once per show concurrently, and the resulting race lost entries.
        // Batching them into one addShows call must persist all of them.
        const shows = Array.from({ length: 16 }, (_, i) => ({
            ...SHOW_A,
            id: i,
        }));
        await addShows(shows);
        expect(await getTrackedIds()).toHaveLength(16);
    });

    it("writes to storage exactly once", async () => {
        // vi.mocked() only reads the mock's type, it never calls it unbound.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const setSpy = vi.mocked(chrome.storage.local.set);
        await addShows([SHOW_A, SHOW_B]);
        expect(setSpy).toHaveBeenCalledTimes(1);
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

describe("updateCachedShows", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("replaces the cached data for every show", async () => {
        await addShows([SHOW_A, SHOW_B]);
        await updateCachedShows([
            { ...SHOW_A, status: "Ended" },
            { ...SHOW_B, status: "Ended" },
        ]);
        const shows = await getCachedShows();
        expect(shows.every((s) => s.status === "Ended")).toBe(true);
    });

    it("does not change the tracked IDs", async () => {
        await addShows([SHOW_A, SHOW_B]);
        await updateCachedShows([{ ...SHOW_A, status: "Ended" }]);
        expect(await getTrackedIds()).toEqual([83, 84]);
    });

    it("does not lose updates when refreshing a large batch at once", async () => {
        const shows = Array.from({ length: 16 }, (_, i) => ({
            ...SHOW_A,
            id: i,
        }));
        await addShows(shows);
        const refreshed = shows.map((s) => ({ ...s, status: "Ended" as const }));
        await updateCachedShows(refreshed);
        const cached = await getCachedShows();
        expect(cached.every((s) => s.status === "Ended")).toBe(true);
    });

    it("writes to storage exactly once", async () => {
        // vi.mocked() only reads the mock's type, it never calls it unbound.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const setSpy = vi.mocked(chrome.storage.local.set);
        await updateCachedShows([SHOW_A, SHOW_B]);
        expect(setSpy).toHaveBeenCalledTimes(1);
    });
});

describe("getSortOrder", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("returns 'title-asc' when no sort order has been stored", async () => {
        expect(await getSortOrder()).toBe("title-asc");
    });

    it("returns the stored sort order", async () => {
        await setSortOrder("airdate-asc");
        expect(await getSortOrder()).toBe("airdate-asc");
    });
});

describe("setSortOrder", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("persists the sort order across reads", async () => {
        await setSortOrder("airdate-desc");
        await setSortOrder("title-desc");
        expect(await getSortOrder()).toBe("title-desc");
    });
});

describe("getTheme", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("returns null when no theme has been stored", async () => {
        expect(await getTheme()).toBeNull();
    });

    it("returns the stored theme", async () => {
        await setTheme("dark");
        expect(await getTheme()).toBe("dark");
    });
});

describe("setTheme", () => {
    beforeEach(stubChrome);
    afterEach(() => vi.unstubAllGlobals());

    it("persists the theme across reads", async () => {
        await setTheme("dark");
        await setTheme("light");
        expect(await getTheme()).toBe("light");
    });
});
