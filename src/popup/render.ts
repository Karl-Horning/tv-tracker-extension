/**
 * @fileoverview DOM-building functions for the TV Tracker popup.
 *
 * Pure functions that accept data and return DOM nodes. No side effects,
 * no module-level state.
 */

import { getChannelName, type TvmazeSearchResult, type TvmazeShow } from "../api/tvmaze";
import { classifyShow, type ShowGroup, type SortOrder } from "../filter/classify";

// ── SVG icon strings ─────────────────────────────────────────────────

const SVG_CHECK =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M4 10l4 4 8-8" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

const SVG_CALENDAR =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">` +
    `<rect x="3" y="4" width="14" height="13" rx="2" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6"/>` +
    `<path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" ` +
    `stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`;

const SVG_PAUSE =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">` +
    `<rect x="5" y="3" width="3.2" height="14" rx="1" fill="currentColor"/>` +
    `<rect x="11.8" y="3" width="3.2" height="14" rx="1" fill="currentColor"/>` +
    `</svg>`;

const SVG_FLAG =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M5 2v16M5 3h9l-2.5 3L14 9H5" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
    `</svg>`;

const SVG_TRASH =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">` +
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

/**
 * Parses SVG markup into a live SVG element.
 *
 * @param markup - Well-formed SVG markup, for example "<svg>...</svg>".
 * @returns The parsed root SVG element.
 */
function parseSvg(markup: string): SVGSVGElement {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    return doc.documentElement as unknown as SVGSVGElement;
}

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
 * @param sortOrder - How to order shows within each section; defaults to title (A–Z).
 */
export function renderStatusBoard(
    container: HTMLElement,
    shows: TvmazeShow[],
    now: Date = new Date(),
    sortOrder: SortOrder = "title-asc",
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

    container.querySelectorAll(".status-section").forEach((s) => s.remove());

    for (const { group, label } of SECTION_DEFS) {
        const groupShows = sortShows(groups[group], group, sortOrder);
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
 * @param results - TVmaze search results to render.
 */
export function renderSearchResults(
    container: HTMLElement,
    results: TvmazeSearchResult[],
): void {
    container.replaceChildren();

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
        meta.textContent = `${getChannelName(result.show)} · ${result.show.status}`;

        btn.append(name, meta);
        li.append(btn);
        container.append(li);
    }
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Returns shows sorted for display within a single section.
 *
 * Sorting by title compares show names alphabetically. Sorting by air date
 * compares the episode date shown in that section — the previous episode's
 * airdate for "fresh", "hiatus", and "ended", or the next episode's airdate
 * for "upcoming". Shows missing that date always sort last, regardless of
 * direction.
 *
 * @param shows - The shows belonging to this section.
 * @param group - The section these shows belong to.
 * @param order - The sort field and direction to apply.
 * @returns A new array of shows in the requested order.
 */
function sortShows(
    shows: TvmazeShow[],
    group: ShowGroup,
    order: SortOrder,
): TvmazeShow[] {
    const direction = order.endsWith("-desc") ? -1 : 1;

    if (order.startsWith("title")) {
        return [...shows].sort(
            (a, b) => direction * a.name.localeCompare(b.name),
        );
    }

    const episodeKey = group === "upcoming" ? "nextepisode" : "previousepisode";
    return [...shows].sort((a, b) => {
        const dateA = a._embedded[episodeKey]?.airdate ?? "";
        const dateB = b._embedded[episodeKey]?.airdate ?? "";
        if (!dateA) return 1;
        if (!dateB) return -1;
        return direction * dateA.localeCompare(dateB);
    });
}

/**
 * Builds a single status section element for the given group.
 *
 * @param group - The show group this section represents.
 * @param label - The visible section heading text.
 * @param shows - The shows to render as rows inside this section.
 * @returns The constructed section element.
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

    const indicator = document.createElement("span");
    indicator.className = "section-indicator";
    indicator.setAttribute("aria-hidden", "true");

    const heading = document.createElement("h2");
    heading.className = "section-label";
    heading.id = headingId;
    heading.textContent = label;

    const count = document.createElement("span");
    count.className = "section-count";
    count.setAttribute("aria-hidden", "true");
    count.textContent = String(shows.length);

    head.append(indicator, heading, count);

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
    epPara.append(parseSvg(GROUP_ICON[group]));
    epPara.append(buildEpisodeLines(show, group));

    infoDiv.append(namePara, epPara);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${show.name}`);
    removeBtn.dataset.showId = String(show.id);
    removeBtn.dataset.showName = show.name;
    removeBtn.append(parseSvg(SVG_TRASH));

    li.append(infoDiv, removeBtn);
    return li;
}

/** One show row's episode text, split into separately styleable lines. */
interface EpisodeLines {
    /** Zero-padded episode code, for example "S04E05". Null when there's no episode to show. */
    code: string | null;
    /** Episode name, or a fallback like "Recently aired" when there's no episode. */
    title: string;
    /** Air date, with any status note appended (for example "— renewal pending"). Null when there's no episode. */
    date: string | null;
}

/**
 * Builds the title, channel, and date lines for a show row.
 *
 * Split into separate lines — rather than one long sentence — so each
 * piece of information can be scanned on its own rather than parsed out
 * of a run-on string.
 *
 * @param show - The show to build episode lines for.
 * @param group - Determines which episode (previous or next) is shown.
 * @returns A span containing the title, channel, and date lines.
 */
function buildEpisodeLines(show: TvmazeShow, group: ShowGroup): HTMLSpanElement {
    const lines = getEpisodeLines(show, group);

    const wrap = document.createElement("span");
    wrap.className = "show-ep-lines";

    const titleLine = document.createElement("span");
    titleLine.className = "show-ep-title";
    if (lines.code) {
        const codeSpan = document.createElement("span");
        codeSpan.className = "show-ep-code";
        codeSpan.textContent = lines.code;
        titleLine.append(codeSpan, ` “${lines.title}”`);
    } else {
        titleLine.textContent = lines.title;
    }
    wrap.append(titleLine);

    const channelLine = document.createElement("span");
    channelLine.className = "show-ep-detail";
    channelLine.textContent = getChannelName(show);
    wrap.append(channelLine);

    if (lines.date) {
        const dateLine = document.createElement("span");
        dateLine.className = "show-ep-detail";
        dateLine.textContent = lines.date;
        wrap.append(dateLine);
    }

    return wrap;
}

/**
 * Returns the episode code, title, and date text for a show row.
 *
 * @param show - The show whose episode data to format.
 * @param group - Determines which episode (previous or next) is shown.
 * @returns The episode's code, title, and date as separate strings.
 */
function getEpisodeLines(show: TvmazeShow, group: ShowGroup): EpisodeLines {
    const { previousepisode: prev, nextepisode: next } = show._embedded;

    switch (group) {
        case "fresh":
            return prev
                ? {
                      code: formatEpisodeCode(prev.season, prev.number),
                      title: prev.name,
                      date: formatDate(prev.airdate),
                  }
                : { code: null, title: "Recently aired", date: null };

        case "upcoming":
            return next
                ? {
                      code: formatEpisodeCode(next.season, next.number),
                      title: next.name,
                      date: formatDate(next.airdate),
                  }
                : { code: null, title: "Coming soon", date: null };

        case "hiatus":
            return prev
                ? {
                      code: formatEpisodeCode(prev.season, prev.number),
                      title: prev.name,
                      date: `Last aired ${formatDate(prev.airdate)}${show.status === "To Be Determined" ? " — renewal pending" : ""}`,
                  }
                : { code: null, title: "No episodes aired", date: null };

        case "ended":
            return prev
                ? {
                      code: formatEpisodeCode(prev.season, prev.number),
                      title: prev.name,
                      date: `Last aired ${formatDate(prev.airdate)} — series ended`,
                  }
                : { code: null, title: "No episodes aired", date: null };
    }
}

/**
 * Formats a season and episode number as a zero-padded "SxxExx" code.
 *
 * TVmaze specials have no episode number, in which case only the season
 * part is returned.
 *
 * @param season - The season number.
 * @param number - The episode number within the season, or null for specials.
 * @returns A code string, for example "S02E09" or "S11" for a special.
 */
function formatEpisodeCode(season: number, number: number | null): string {
    const pad = (value: number): string => String(value).padStart(2, "0");
    return number === null ? `S${pad(season)}` : `S${pad(season)}E${pad(number)}`;
}

/**
 * Formats a YYYY-MM-DD air date string as "D Mon YYYY" in UTC.
 *
 * Parsing in UTC prevents the date from shifting due to the user's local
 * timezone offset.
 *
 * @param airdate - An ISO date string in YYYY-MM-DD format.
 * @returns A human-readable date string, for example "28 Jun 2026".
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
