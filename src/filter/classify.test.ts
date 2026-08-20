/**
 * @fileoverview Unit tests for the show classification logic.
 *
 * All tests pass an explicit `now` date of 2026-07-01 so that "30 days ago"
 * is always 2026-06-01, giving deterministic boundary conditions.
 */

import { describe, expect, it } from "vitest";
import { classifyShow } from "./classify";
import type { TvmazeShow } from "../api/tvmaze";

/** Fixed reference date used across all tests: 2026-07-01 UTC. */
const NOW = new Date("2026-07-01T00:00:00.000Z");

/**
 * Builds a minimal TvmazeShow for testing.
 *
 * @param opts.status      - TVmaze show status (default "Running").
 * @param opts.prevAirdate - Air date of the previous episode, "YYYY-MM-DD".
 * @param opts.nextAirdate - Air date of the next episode, "YYYY-MM-DD".
 * @returns A TvmazeShow with only the fields classifyShow reads.
 */
function makeShow(opts: {
    status?: TvmazeShow["status"];
    prevAirdate?: string;
    nextAirdate?: string;
}): TvmazeShow {
    const makeEpisode = (airdate: string, id: number) => ({
        id,
        name: "Episode",
        season: 1,
        number: id,
        airdate,
        airstamp: `${airdate}T20:00:00+00:00`,
        runtime: 22,
    });

    return {
        id: 1,
        name: "Test Show",
        status: opts.status ?? "Running",
        _embedded: {
            previousepisode: opts.prevAirdate
                ? makeEpisode(opts.prevAirdate, 1)
                : undefined,
            nextepisode: opts.nextAirdate
                ? makeEpisode(opts.nextAirdate, 2)
                : undefined,
        },
    };
}

describe("classifyShow", () => {
    // ── fresh ──────────────────────────────────────────────────────────

    it("is fresh when previous episode aired within 30 days", () => {
        const show = makeShow({ prevAirdate: "2026-06-20" });
        expect(classifyShow(show, NOW)).toContain("fresh");
    });

    it("is fresh when previous episode aired on the 30-day boundary", () => {
        const show = makeShow({ prevAirdate: "2026-06-01" });
        expect(classifyShow(show, NOW)).toContain("fresh");
    });

    it("is not fresh when previous episode aired one day past the boundary", () => {
        const show = makeShow({ prevAirdate: "2026-05-31" });
        expect(classifyShow(show, NOW)).not.toContain("fresh");
    });

    it("is not fresh when there is no previous episode", () => {
        const show = makeShow({ nextAirdate: "2026-07-10" });
        expect(classifyShow(show, NOW)).not.toContain("fresh");
    });

    it("respects a custom fresh window shorter than the default", () => {
        const show = makeShow({ prevAirdate: "2026-06-20" });
        expect(classifyShow(show, NOW, 7)).not.toContain("fresh");
    });

    it("respects a custom fresh window longer than the default", () => {
        const show = makeShow({ prevAirdate: "2026-05-02" });
        expect(classifyShow(show, NOW)).not.toContain("fresh");
        expect(classifyShow(show, NOW, 90)).toContain("fresh");
    });

    // ── upcoming ───────────────────────────────────────────────────────

    it("is upcoming when a next episode is scheduled", () => {
        const show = makeShow({ nextAirdate: "2026-07-10" });
        expect(classifyShow(show, NOW)).toContain("upcoming");
    });

    it("is not upcoming when there is no next episode", () => {
        const show = makeShow({ prevAirdate: "2026-06-20" });
        expect(classifyShow(show, NOW)).not.toContain("upcoming");
    });

    // ── both fresh and upcoming ────────────────────────────────────────

    it("is both fresh and upcoming when recent prev and next episode exist", () => {
        const show = makeShow({
            prevAirdate: "2026-06-20",
            nextAirdate: "2026-07-10",
        });
        expect(classifyShow(show, NOW)).toEqual(["fresh", "upcoming"]);
    });

    it("is upcoming but not fresh when previous episode is older than 30 days", () => {
        const show = makeShow({
            prevAirdate: "2026-04-01",
            nextAirdate: "2026-07-10",
        });
        expect(classifyShow(show, NOW)).toEqual(["upcoming"]);
    });

    // ── hiatus ─────────────────────────────────────────────────────────

    it("is hiatus for a Running show with no recent or upcoming episodes", () => {
        const show = makeShow({ prevAirdate: "2026-04-01", status: "Running" });
        expect(classifyShow(show, NOW)).toEqual(["hiatus"]);
    });

    it("is hiatus for a To Be Determined show with no upcoming episodes", () => {
        const show = makeShow({
            prevAirdate: "2026-04-01",
            status: "To Be Determined",
        });
        expect(classifyShow(show, NOW)).toEqual(["hiatus"]);
    });

    it("is hiatus when there are no episodes at all", () => {
        const show = makeShow({ status: "Running" });
        expect(classifyShow(show, NOW)).toEqual(["hiatus"]);
    });

    // ── ended ──────────────────────────────────────────────────────────

    it("is ended for a show with Ended status and no upcoming episodes", () => {
        const show = makeShow({ prevAirdate: "2026-04-01", status: "Ended" });
        expect(classifyShow(show, NOW)).toEqual(["ended"]);
    });

    it("is upcoming (not ended) when an Ended show still has a next episode", () => {
        const show = makeShow({
            prevAirdate: "2026-04-01",
            status: "Ended",
            nextAirdate: "2026-07-10",
        });
        expect(classifyShow(show, NOW)).toEqual(["upcoming"]);
    });
});
