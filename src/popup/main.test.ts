// @vitest-environment jsdom

/**
 * @fileoverview Tests for the popup render functions.
 *
 * Uses the jsdom environment to run DOM manipulation in Node. All tests
 * create a fresh container element so state cannot leak between cases.
 */

import { describe, expect, it } from "vitest";
import type { TvmazeSearchResult, TvmazeShow } from "../api/tvmaze";
import { renderSearchResults, renderStatusBoard } from "./render";

// ── Fixtures ──────────────────────────────────────────────────────────

/** Reference date: the 30-day fresh boundary falls on 2026-06-01. */
const NOW = new Date("2026-07-01T00:00:00.000Z");

/** Show with a recent previous episode and a scheduled next episode. */
const SHOW_FRESH_AND_UPCOMING: TvmazeShow = {
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
        nextepisode: {
            id: 2,
            name: "The Long Goodbye",
            season: 37,
            number: 19,
            airdate: "2026-07-05",
            airstamp: "2026-07-05T20:00:00+00:00",
            runtime: 22,
        },
    },
};

/** Show with only a next episode (previous episode too old to be fresh). */
const SHOW_UPCOMING_ONLY: TvmazeShow = {
    id: 417,
    name: "American Dad!",
    status: "Running",
    _embedded: {
        previousepisode: {
            id: 3,
            name: "Old Ep",
            season: 21,
            number: 3,
            airdate: "2026-04-01",
            airstamp: "2026-04-01T20:00:00+00:00",
            runtime: 22,
        },
        nextepisode: {
            id: 4,
            name: "Francine Unfiltered",
            season: 21,
            number: 4,
            airdate: "2026-07-19",
            airstamp: "2026-07-19T20:00:00+00:00",
            runtime: 22,
        },
    },
};

/** Show with no next episode and an old previous episode (on hiatus). */
const SHOW_HIATUS: TvmazeShow = {
    id: 49,
    name: "South Park",
    status: "Running",
    _embedded: {
        previousepisode: {
            id: 5,
            name: "Season Finale",
            season: 26,
            number: 6,
            airdate: "2026-05-01",
            airstamp: "2026-05-01T22:00:00+00:00",
            runtime: 22,
        },
    },
};

/** Show with status "Ended". */
const SHOW_ENDED: TvmazeShow = {
    id: 120,
    name: "Robot Chicken",
    status: "Ended",
    _embedded: {
        previousepisode: {
            id: 6,
            name: "Final Ep",
            season: 11,
            number: 12,
            airdate: "2026-04-18",
            airstamp: "2026-04-18T23:30:00+00:00",
            runtime: 15,
        },
    },
};

// ── renderStatusBoard ─────────────────────────────────────────────────

describe("renderStatusBoard", () => {
    it("renders the 'Aired recently' section for a fresh show", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_FRESH_AND_UPCOMING], NOW);
        expect(el.querySelector("#heading-fresh")).not.toBeNull();
    });

    it("renders the 'Coming up' section for a show with a next episode", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_UPCOMING_ONLY], NOW);
        expect(el.querySelector("#heading-upcoming")).not.toBeNull();
    });

    it("places a show in both sections when it is both fresh and upcoming", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_FRESH_AND_UPCOMING], NOW);
        expect(el.querySelectorAll("section")).toHaveLength(2);
        expect(el.querySelector("#heading-fresh")).not.toBeNull();
        expect(el.querySelector("#heading-upcoming")).not.toBeNull();
    });

    it("renders the 'On hiatus' section for a hiatus show", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_HIATUS], NOW);
        expect(el.querySelector("#heading-hiatus")).not.toBeNull();
    });

    it("renders the 'No upcoming episode' section for an ended show", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_ENDED], NOW);
        expect(el.querySelector("#heading-ended")).not.toBeNull();
    });

    it("does not render sections that have no shows", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_HIATUS], NOW);
        expect(el.querySelector("#heading-fresh")).toBeNull();
        expect(el.querySelector("#heading-upcoming")).toBeNull();
        expect(el.querySelector("#heading-ended")).toBeNull();
    });

    it("sets aria-label on the remove button to include the show name", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_HIATUS], NOW);
        const btn = el.querySelector<HTMLButtonElement>(".btn-remove");
        expect(btn?.getAttribute("aria-label")).toBe("Remove South Park");
    });

    it("sets data-show-id on the remove button to the show's numeric id", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_HIATUS], NOW);
        const btn = el.querySelector<HTMLButtonElement>(".btn-remove");
        expect(btn?.dataset.showId).toBe("49");
    });

    it("renders the section count chip with the number of shows in that section", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_FRESH_AND_UPCOMING, SHOW_UPCOMING_ONLY], NOW);
        const upcomingSection = el.querySelector(".status-section--upcoming");
        expect(upcomingSection?.querySelector(".section-count")?.textContent).toBe("2");
    });

    it("clears previous content on each call", () => {
        const el = document.createElement("div");
        renderStatusBoard(el, [SHOW_ENDED], NOW);
        renderStatusBoard(el, [SHOW_HIATUS], NOW);
        expect(el.querySelector("#heading-ended")).toBeNull();
        expect(el.querySelector("#heading-hiatus")).not.toBeNull();
    });
});

// ── renderSearchResults ───────────────────────────────────────────────

describe("renderSearchResults", () => {
    /** Creates a minimal TvmazeSearchResult fixture. */
    const makeResult = (id: number, name: string): TvmazeSearchResult => ({
        score: 1,
        show: { id, name, status: "Running", network: { name: "FOX" } },
    });

    it("renders one list item per result", () => {
        const el = document.createElement("ul");
        renderSearchResults(el, [
            makeResult(83, "The Simpsons"),
            makeResult(84, "Simpsons Road Rage"),
        ]);
        expect(el.querySelectorAll(".search-result")).toHaveLength(2);
    });

    it("sets data-show-id on each result button", () => {
        const el = document.createElement("ul");
        renderSearchResults(el, [makeResult(83, "The Simpsons")]);
        const btn = el.querySelector<HTMLButtonElement>(".search-result-btn");
        expect(btn?.dataset.showId).toBe("83");
    });

    it("shows a 'No shows found' item when results are empty", () => {
        const el = document.createElement("ul");
        renderSearchResults(el, []);
        expect(el.querySelector(".search-result--empty")).not.toBeNull();
        expect(el.querySelector(".search-result--empty")?.textContent).toBe(
            "No shows found.",
        );
    });

    it("limits results to 8 items", () => {
        const el = document.createElement("ul");
        const results = Array.from({ length: 12 }, (_, i) =>
            makeResult(i, `Show ${i}`),
        );
        renderSearchResults(el, results);
        expect(el.querySelectorAll(".search-result")).toHaveLength(8);
    });
});
