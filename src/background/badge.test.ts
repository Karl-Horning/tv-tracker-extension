/**
 * @fileoverview Unit tests for the toolbar badge logic.
 *
 * getCachedShows and getFreshWindowDays are replaced with vi.mock so no
 * real storage calls are made. chrome.action is stubbed per-test so
 * setBadgeText calls can be asserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TvmazeShow } from "../api/tvmaze";
import { getCachedShows, getFreshWindowDays } from "../storage/shows";
import { countFreshShows, updateBadge } from "./badge";

vi.mock("../storage/shows", () => ({
    getCachedShows: vi.fn(),
    getFreshWindowDays: vi.fn(),
}));

const NOW = new Date("2026-07-01T00:00:00.000Z");

const FRESH_SHOW: TvmazeShow = {
    id: 83,
    name: "The Simpsons",
    status: "Running",
    _embedded: {
        previousepisode: {
            id: 1,
            name: "Spring-Cleaning Frenzy",
            season: 37,
            number: 18,
            airdate: "2026-06-21",
            airstamp: "2026-06-21T20:00:00+00:00",
            runtime: 22,
        },
    },
};

const STALE_SHOW: TvmazeShow = {
    id: 49,
    name: "South Park",
    status: "Running",
    _embedded: {
        previousepisode: {
            id: 2,
            name: "Season Finale",
            season: 26,
            number: 6,
            airdate: "2026-05-01",
            airstamp: "2026-05-01T22:00:00+00:00",
            runtime: 22,
        },
    },
};

describe("countFreshShows", () => {
    it("counts shows in the fresh group", () => {
        expect(countFreshShows([FRESH_SHOW, STALE_SHOW], NOW)).toBe(1);
    });

    it("returns zero when no shows are fresh", () => {
        expect(countFreshShows([STALE_SHOW], NOW)).toBe(0);
    });

    it("returns zero for an empty list", () => {
        expect(countFreshShows([], NOW)).toBe(0);
    });
});

describe("updateBadge", () => {
    let mockSetBadgeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockSetBadgeText = vi.fn();
        vi.stubGlobal("chrome", { action: { setBadgeText: mockSetBadgeText } });
        vi.mocked(getFreshWindowDays).mockResolvedValue(30);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("sets the badge text to the fresh count", async () => {
        vi.mocked(getCachedShows).mockResolvedValue([FRESH_SHOW, STALE_SHOW]);
        await updateBadge(NOW);
        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: "1" });
    });

    it("clears the badge when there are no fresh shows", async () => {
        vi.mocked(getCachedShows).mockResolvedValue([STALE_SHOW]);
        await updateBadge(NOW);
        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: "" });
    });

    it("uses the user's stored fresh window instead of the default", async () => {
        vi.mocked(getCachedShows).mockResolvedValue([STALE_SHOW]);
        vi.mocked(getFreshWindowDays).mockResolvedValue(90);
        await updateBadge(NOW);
        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: "1" });
    });
});
