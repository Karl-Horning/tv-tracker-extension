// @vitest-environment jsdom

/**
 * @fileoverview Automated accessibility tests for popup render functions.
 *
 * Loads the actual popup.html body so that changes to landmark structure,
 * heading order, or ARIA attributes fail these tests automatically. Colour
 * contrast rules are disabled because jsdom does not compute CSS cascade.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TvmazeSearchResult, TvmazeShow } from "../api/tvmaze";
import { renderSearchResults, renderStatusBoard } from "./render";

// ── Popup HTML ────────────────────────────────────────────────────────

/**
 * Reads popup.html and returns the content of its body element.
 *
 * Any structural change to popup.html — renamed landmark, removed heading,
 * altered aria-label — is reflected here automatically, causing a test
 * failure if it breaks accessibility rules.
 *
 * @returns The raw HTML inside the body element.
 */
function loadPopupBody(): string {
    const html = readFileSync(
        resolve(import.meta.dirname, "../../popup.html"),
        "utf-8",
    );
    const match = html.match(/<body>([\s\S]*?)<\/body>/i);
    return match?.[1] ?? "";
}

const POPUP_BODY = loadPopupBody();

// ── axe configuration ─────────────────────────────────────────────────

/** Rules that require CSS computation, which jsdom does not provide. */
const AXE_OPTIONS: axe.RunOptions = {
    rules: { "color-contrast": { enabled: false } },
};

// ── Fixtures ──────────────────────────────────────────────────────────

const NOW = new Date("2026-07-01T00:00:00.000Z");

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

const SHOW_HIATUS: TvmazeShow = {
    id: 49,
    name: "South Park",
    status: "Running",
    _embedded: {
        previousepisode: {
            id: 3,
            name: "Season Finale",
            season: 26,
            number: 6,
            airdate: "2026-05-01",
            airstamp: "2026-05-01T22:00:00+00:00",
            runtime: 22,
        },
    },
};

const SHOW_ENDED: TvmazeShow = {
    id: 120,
    name: "Robot Chicken",
    status: "Ended",
    _embedded: {
        previousepisode: {
            id: 4,
            name: "Final Ep",
            season: 11,
            number: 12,
            airdate: "2026-04-18",
            airstamp: "2026-04-18T23:30:00+00:00",
            runtime: 15,
        },
    },
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Asserts that axe found no violations.
 *
 * Formats violation IDs and descriptions into the failure message so
 * they are visible without inspecting the raw results object.
 *
 * @param results - The results object returned by axe.run.
 */
function expectNoViolations(results: axe.AxeResults): void {
    const messages = results.violations.map((v) => `[${v.id}] ${v.description}`);
    expect(messages).toEqual([]);
}

// ── renderStatusBoard accessibility ───────────────────────────────────

describe("renderStatusBoard accessibility", () => {
    let container: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = POPUP_BODY;
        container = document.getElementById("show-sections") as HTMLElement;
        container.removeAttribute("hidden");
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("has no violations with a show in the 'Aired recently' section", async () => {
        renderStatusBoard(container, [SHOW_FRESH_AND_UPCOMING], NOW);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations with a show in both 'Aired recently' and 'Coming up'", async () => {
        renderStatusBoard(container, [SHOW_FRESH_AND_UPCOMING], NOW);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations with a hiatus show", async () => {
        renderStatusBoard(container, [SHOW_HIATUS], NOW);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations with an ended show", async () => {
        renderStatusBoard(container, [SHOW_ENDED], NOW);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations with shows spanning all four sections", async () => {
        renderStatusBoard(
            container,
            [SHOW_FRESH_AND_UPCOMING, SHOW_HIATUS, SHOW_ENDED],
            NOW,
        );
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations when the board is empty", async () => {
        renderStatusBoard(container, [], NOW);
        const emptyState = document.getElementById("empty-state") as HTMLElement;
        emptyState.removeAttribute("hidden");
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });
});

// ── renderSearchResults accessibility ─────────────────────────────────

describe("renderSearchResults accessibility", () => {
    let container: HTMLUListElement;

    beforeEach(() => {
        document.body.innerHTML = POPUP_BODY;
        const panel = document.getElementById("search-panel") as HTMLElement;
        panel.removeAttribute("hidden");
        container = document.getElementById("search-results") as HTMLUListElement;
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    const makeResult = (id: number, name: string): TvmazeSearchResult => ({
        score: 1,
        show: { id, name, status: "Running", network: { name: "FOX" }, webChannel: null },
    });

    it("has no violations with search results", async () => {
        renderSearchResults(container, [
            makeResult(83, "The Simpsons"),
            makeResult(417, "American Dad!"),
        ]);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });

    it("has no violations when no results are found", async () => {
        renderSearchResults(container, []);
        expectNoViolations(await axe.run(document.body, AXE_OPTIONS));
    });
});
