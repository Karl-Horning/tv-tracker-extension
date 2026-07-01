/**
 * @fileoverview Unit tests for the background refresh logic.
 *
 * Module dependencies (fetchShow, getTrackedIds, updateCachedShow) are
 * replaced with vi.mock so no real network or storage calls are made.
 * chrome.alarms is stubbed per-describe for the registerAlarm tests only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TvmazeShow } from "../api/tvmaze";
import { fetchShow } from "../api/tvmaze";
import { getTrackedIds, updateCachedShow } from "../storage/shows";
import {
    ALARM_NAME,
    ALARM_PERIOD_MINUTES,
    handleAlarm,
    refreshAllShows,
    registerAlarm,
} from "./refresh";

vi.mock("../api/tvmaze", () => ({ fetchShow: vi.fn() }));
vi.mock("../storage/shows", () => ({
    getTrackedIds: vi.fn(),
    updateCachedShow: vi.fn(),
}));

const FIXTURE_SHOW: TvmazeShow = {
    id: 83,
    name: "The Simpsons",
    status: "Running",
    _embedded: {},
};

describe("registerAlarm", () => {
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCreate = vi.fn();
        vi.stubGlobal("chrome", { alarms: { create: mockCreate } });
    });

    afterEach(() => vi.unstubAllGlobals());

    it("creates an alarm with the correct name", () => {
        registerAlarm();
        expect(mockCreate).toHaveBeenCalledWith(
            ALARM_NAME,
            expect.objectContaining({ periodInMinutes: expect.any(Number) }),
        );
    });

    it("sets the period to 4 hours", () => {
        registerAlarm();
        expect(mockCreate).toHaveBeenCalledWith(ALARM_NAME, {
            periodInMinutes: ALARM_PERIOD_MINUTES,
        });
        expect(ALARM_PERIOD_MINUTES).toBe(240);
    });
});

describe("handleAlarm", () => {
    beforeEach(() => {
        vi.mocked(getTrackedIds).mockResolvedValue([83]);
        vi.mocked(fetchShow).mockResolvedValue(FIXTURE_SHOW);
        vi.mocked(updateCachedShow).mockResolvedValue(undefined);
    });

    afterEach(() => vi.clearAllMocks());

    it("ignores alarms with a different name", async () => {
        await handleAlarm({ name: "other-alarm", scheduledTime: 0 });
        expect(getTrackedIds).not.toHaveBeenCalled();
    });

    it("refreshes all shows when the alarm name matches", async () => {
        await handleAlarm({ name: ALARM_NAME, scheduledTime: 0 });
        expect(getTrackedIds).toHaveBeenCalled();
        expect(updateCachedShow).toHaveBeenCalledWith(FIXTURE_SHOW);
    });
});

describe("refreshAllShows", () => {
    afterEach(() => vi.clearAllMocks());

    it("fetches every tracked show", async () => {
        vi.mocked(getTrackedIds).mockResolvedValue([83, 84]);
        vi.mocked(fetchShow).mockResolvedValue(FIXTURE_SHOW);
        vi.mocked(updateCachedShow).mockResolvedValue(undefined);

        await refreshAllShows();

        expect(fetchShow).toHaveBeenCalledWith(83);
        expect(fetchShow).toHaveBeenCalledWith(84);
    });

    it("updates the cache for each show", async () => {
        vi.mocked(getTrackedIds).mockResolvedValue([83]);
        vi.mocked(fetchShow).mockResolvedValue(FIXTURE_SHOW);
        vi.mocked(updateCachedShow).mockResolvedValue(undefined);

        await refreshAllShows();

        expect(updateCachedShow).toHaveBeenCalledWith(FIXTURE_SHOW);
    });

    it("does nothing when no shows are tracked", async () => {
        vi.mocked(getTrackedIds).mockResolvedValue([]);

        await refreshAllShows();

        expect(fetchShow).not.toHaveBeenCalled();
        expect(updateCachedShow).not.toHaveBeenCalled();
    });

    it("continues refreshing other shows when one fetch fails", async () => {
        vi.mocked(getTrackedIds).mockResolvedValue([83, 84]);
        vi.mocked(fetchShow)
            .mockRejectedValueOnce(new Error("Network failure"))
            .mockResolvedValueOnce(FIXTURE_SHOW);
        vi.mocked(updateCachedShow).mockResolvedValue(undefined);

        await expect(refreshAllShows()).resolves.toBeUndefined();
        expect(updateCachedShow).toHaveBeenCalledTimes(1);
        expect(updateCachedShow).toHaveBeenCalledWith(FIXTURE_SHOW);
    });
});
