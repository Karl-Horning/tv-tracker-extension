/**
 * @fileoverview Popup controller for the TV Tracker extension.
 *
 * Orchestrates data loading from chrome.storage.local, DOM rendering,
 * and user interactions (add show, remove show, refresh).
 */

import "./style.css";
import { fetchShow, searchShows } from "../api/tvmaze";
import { refreshAllShows } from "../background/refresh";
import { addShow, getCachedShows, removeShow } from "../storage/shows";
import { renderSearchResults, renderStatusBoard } from "./render";

// ── DOM references ────────────────────────────────────────────────────

const $sections = document.getElementById("show-sections") as HTMLElement;
const $emptyState = document.getElementById("empty-state") as HTMLElement;
const $lastUpdated = document.getElementById("last-updated") as HTMLElement;
const $btnAdd = document.getElementById("btn-add-show") as HTMLButtonElement;
const $btnRefresh = document.getElementById("btn-refresh") as HTMLButtonElement;
const $searchPanel = document.getElementById("search-panel") as HTMLElement;
const $searchInput = document.getElementById(
    "search-input",
) as HTMLInputElement;
const $searchResults = document.getElementById(
    "search-results",
) as HTMLElement;
const $btnCancel = document.getElementById(
    "btn-search-cancel",
) as HTMLButtonElement;

// ── Render ────────────────────────────────────────────────────────────

/**
 * Loads tracked shows from storage, renders the status board, and wires
 * remove buttons.
 */
async function loadAndRender(): Promise<void> {
    const shows = await getCachedShows();
    const hasShows = shows.length > 0;

    renderStatusBoard($sections, shows);
    $sections.hidden = !hasShows;
    $emptyState.hidden = hasShows;
    $lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    })}`;

    $sections.querySelectorAll<HTMLButtonElement>(".btn-remove").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = Number(btn.dataset.showId);
            await removeShow(id);
            await loadAndRender();
        });
    });
}

// ── Search panel ──────────────────────────────────────────────────────

/** Opens the search panel and hides the status board. */
function openSearch(): void {
    $searchPanel.hidden = false;
    $sections.hidden = true;
    $emptyState.hidden = true;
    $searchInput.value = "";
    $searchResults.innerHTML = "";
    $searchInput.focus();
}

/** Closes the search panel and reloads the status board. */
function closeSearch(): void {
    $searchPanel.hidden = true;
    void loadAndRender();
    $btnAdd.focus();
}

$btnAdd.addEventListener("click", openSearch);
$btnCancel.addEventListener("click", closeSearch);

$searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;

$searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const query = $searchInput.value.trim();
    if (!query) {
        $searchResults.innerHTML = "";
        return;
    }
    searchTimer = setTimeout(async () => {
        const results = await searchShows(query);
        renderSearchResults($searchResults, results);
    }, 300);
});

$searchResults.addEventListener("click", async (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>("[data-show-id]");
    if (!btn) return;
    const id = Number(btn.dataset.showId);
    if (isNaN(id)) return;

    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
        const show = await fetchShow(id);
        await addShow(show);
        closeSearch();
    } catch (err) {
        console.error("Failed to add show:", err);
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
    }
});

// ── Refresh ───────────────────────────────────────────────────────────

$btnRefresh.addEventListener("click", async () => {
    $btnRefresh.disabled = true;
    try {
        await refreshAllShows();
        await loadAndRender();
    } finally {
        $btnRefresh.disabled = false;
    }
});

// ── Init ──────────────────────────────────────────────────────────────

void loadAndRender();
