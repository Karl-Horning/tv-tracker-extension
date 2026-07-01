/**
 * @fileoverview DOM-building functions for the TV Tracker popup.
 *
 * Pure functions that accept data and return DOM nodes. No side effects,
 * no module-level state.
 */

import type { TvmazeSearchResult, TvmazeShow } from "../api/tvmaze";
import { classifyShow, type ShowGroup } from "../filter/classify";

// ── SVG icon strings ─────────────────────────────────────────────────

const SVG_CHECK =
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M4 10l4 4 8-8" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

const SVG_CALENDAR =
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<rect x="3" y="4" width="14" height="13" rx="2" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6"/>` +
    `<path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" ` +
    `stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`;

const SVG_PAUSE =
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<rect x="5" y="3" width="3.2" height="14" rx="1" fill="currentColor"/>` +
    `<rect x="11.8" y="3" width="3.2" height="14" rx="1" fill="currentColor"/>` +
    `</svg>`;

const SVG_FLAG =
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M5 2v16M5 3h9l-2.5 3L14 9H5" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    `</svg>`;

const SVG_TRASH =
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M4 6h12M8 6V4h4v2M6 6l.7 10a1 1 0 001 .9h4.6a1 1 0 001-.9L14 6" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

// ── Section configuration ─────────────────────────────────────────────

const GROUP_ICON: Record<ShowGroup, string> = {
    fresh: SVG_CHECK,
    upcoming: SVG_CALENDAR,
    hiatus: SVG_PAUSE,
    ended: SVG_FLAG,
};

const SECTION_DEFS: Array<{ group: ShowGroup; label: string }> = [
    { group: "fresh", label: "Aired recently" },
    { group: "upcoming", label: "Coming up" },
    { group: "hiatus", label: "On hiatus" },
    { group: "ended", label: "No upcoming episode" },
];

// ── Public API ────────────────────────────────────────────────────────

/**
 * Renders the full status board into container, replacing any existing
 * content.
 *
 * Shows that belong to multiple groups appear once per group. Sections
 * with no shows are omitted.
 *
 * @param container - The element to render sections into.
 * @param shows - The list of tracked shows to classify and render.
 * @param now - Reference time for classification; defaults to the current time.
 */
export function renderStatusBoard(
    container: HTMLElement,
    shows: TvmazeShow[],
    now: Date = new Date(),
): void {
    const groups: Record<ShowGroup, TvmazeShow[]> = {
        fresh: [],
        upcoming: [],
        hiatus: [],
        ended: [],
    };

    for (const show of shows) {
        for (const group of classifyShow(show, now)) {
            groups[group].push(show);
        }
    }

    container.innerHTML = "";

    for (const { group, label } of SECTION_DEFS) {
        const groupShows = groups[group];
        if (groupShows.length === 0) continue;
        container.append(buildSection(group, label, groupShows));
    }
}

/**
 * Renders TVmaze search results into container, replacing any existing
 * content.
 *
 * Renders up to 8 results. Shows a "No shows found" message when the
 * list is empty.
 *
 * @param container - The element to render results into.
 * @param results - The search results returned by searchShows.
 */
export function renderSearchResults(
    container: HTMLElement,
    results: TvmazeSearchResult[],
): void {
    container.innerHTML = "";

    if (results.length === 0) {
        const li = document.createElement("li");
        li.className = "search-result search-result--empty";
        li.textContent = "No shows found.";
        container.append(li);
        return;
    }

    for (const result of results.slice(0, 8)) {
        const li = document.createElement("li");
        li.className = "search-result";

        const btn = document.createElement("button");
        btn.className = "search-result-btn";
        btn.type = "button";
        btn.dataset.showId = String(result.show.id);

        const name = document.createElement("span");
        name.className = "search-result-name";
        name.textContent = result.show.name;

        const meta = document.createElement("span");
        meta.className = "search-result-meta";
        const network = result.show.network?.name ?? "Streaming";
        meta.textContent = `${network} · ${result.show.status}`;

        btn.append(name, meta);
        li.append(btn);
        container.append(li);
    }
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Builds a single status section element for the given group.
 *
 * @param group - The show group this section represents.
 * @param label - The visible section heading text.
 * @param shows - The shows to render as rows inside this section.
 * @returns A section element ready to be appended to the board.
 */
function buildSection(
    group: ShowGroup,
    label: string,
    shows: TvmazeShow[],
): HTMLElement {
    const headingId = `heading-${group}`;

    const section = document.createElement("section");
    section.className = `status-section status-section--${group}`;
    section.setAttribute("aria-labelledby", headingId);

    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML =
        `<span class="section-indicator" aria-hidden="true"></span>` +
        `<h2 class="section-label" id="${headingId}">${label}</h2>` +
        `<span class="section-count" aria-hidden="true">${shows.length}</span>`;

    const body = document.createElement("ul");
    body.className = "section-body";
    for (const show of shows) {
        body.append(buildShowRow(show, group));
    }

    section.append(head, body);
    return section;
}

/**
 * Builds a single show row element for the given group.
 *
 * @param show - The show to render.
 * @param group - The group context, which determines episode info display.
 * @returns A li element containing show info and a remove button.
 */
function buildShowRow(show: TvmazeShow, group: ShowGroup): HTMLLIElement {
    const muted = group === "hiatus" || group === "ended";

    const li = document.createElement("li");
    li.className = "show-row";

    const infoDiv = document.createElement("div");
    infoDiv.className = "show-info";

    const namePara = document.createElement("p");
    namePara.className = "show-name";
    namePara.textContent = show.name;

    const epPara = document.createElement("p");
    epPara.className = `show-ep${muted ? " show-ep--muted" : ""}`;
    epPara.innerHTML = GROUP_ICON[group];

    const epText = document.createElement("span");
    epText.textContent = buildEpisodeText(show, group);
    epPara.append(epText);

    infoDiv.append(namePara, epPara);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${show.name}`);
    removeBtn.dataset.showId = String(show.id);
    removeBtn.innerHTML = SVG_TRASH;

    li.append(infoDiv, removeBtn);
    return li;
}

/**
 * Returns the episode description line for a show row.
 *
 * @param show - The show whose episode data to format.
 * @param group - Determines which episode (previous or next) is shown.
 * @returns A plain text description string.
 */
function buildEpisodeText(show: TvmazeShow, group: ShowGroup): string {
    const { previousepisode: prev, nextepisode: next } = show._embedded;

    switch (group) {
        case "fresh":
            return prev
                ? `S${prev.season}E${prev.number} “${prev.name}” — ${formatDate(prev.airdate)}`
                : "Recently aired";

        case "upcoming":
            return next
                ? `S${next.season}E${next.number} “${next.name}” — ${formatDate(next.airdate)}`
                : "Coming soon";

        case "hiatus":
            return prev
                ? `Last aired ${formatDate(prev.airdate)}${show.status === "To Be Determined" ? " — renewal pending" : ""}`
                : "No episodes aired";

        case "ended":
            return prev
                ? `Last aired ${formatDate(prev.airdate)} — series ended`
                : "No episodes aired";
    }
}

/**
 * Formats a YYYY-MM-DD air date string as "Mon D, YYYY" in UTC.
 *
 * Parsing in UTC prevents the date from shifting due to the user's local
 * timezone offset.
 *
 * @param airdate - An ISO date string in YYYY-MM-DD format.
 * @returns A human-readable date string such as "Jun 28, 2026".
 */
function formatDate(airdate: string): string {
    const parts = airdate.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    return new Date(Date.UTC(year, month, day)).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}
