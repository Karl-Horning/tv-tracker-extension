/**
 * @fileoverview Popup controller for the TV Tracker extension.
 *
 * Orchestrates data loading from chrome.storage.local, DOM rendering,
 * and user interactions (add show, remove show, refresh, import/export).
 */

import "./style.css";
import { buildBackup, importBackup, parseBackup } from "../backup/backup";
import { fetchShow, searchShows } from "../api/tvmaze";
import { refreshAllShows } from "../background/refresh";
import type { SortOrder } from "../filter/classify";
import {
    addShow,
    getCachedShows,
    getSortOrder,
    removeShow,
    setSortOrder,
} from "../storage/shows";
import { renderSearchResults, renderStatusBoard } from "./render";

// ── DOM references ────────────────────────────────────────────────────

const $sections = document.getElementById("show-sections") as HTMLElement;
const $emptyState = document.getElementById("empty-state") as HTMLElement;
const $lastUpdated = document.getElementById("last-updated") as HTMLElement;
const $btnAdd = document.getElementById("btn-add-show") as HTMLButtonElement;
const $btnRefresh = document.getElementById("btn-refresh") as HTMLButtonElement;
const $sortBar = document.getElementById("sort-bar") as HTMLElement;
const $sortSelect = document.getElementById(
    "sort-select",
) as HTMLSelectElement;
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
const $btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const $btnImport = document.getElementById("btn-import") as HTMLButtonElement;
const $importFile = document.getElementById(
    "import-file",
) as HTMLInputElement;

// ── State ─────────────────────────────────────────────────────────────

let currentSort: SortOrder = "title-asc";

// ── Render ────────────────────────────────────────────────────────────

/**
 * Loads tracked shows from storage, renders the status board, and wires
 * remove buttons.
 */
async function loadAndRender(): Promise<void> {
    const shows = await getCachedShows();
    const hasShows = shows.length > 0;

    renderStatusBoard($sections, shows, new Date(), currentSort);
    $sections.hidden = false;
    $emptyState.hidden = hasShows;
    $sortBar.hidden = !hasShows;
    $lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    })}`;

    $sections.querySelectorAll<HTMLButtonElement>(".btn-remove").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const showName = btn.dataset.showName ?? "this show";
            if (!window.confirm(`Remove ${showName} from your tracked shows?`)) return;

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
    $sortBar.hidden = true;
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

// ── Sort ──────────────────────────────────────────────────────────────

$sortSelect.addEventListener("change", async () => {
    currentSort = $sortSelect.value as SortOrder;
    await setSortOrder(currentSort);
    await loadAndRender();
});

// ── Import / export ──────────────────────────────────────────────────

$btnExport.addEventListener("click", async () => {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tv-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

$btnImport.addEventListener("click", () => $importFile.click());

$importFile.addEventListener("change", async () => {
    const file = $importFile.files?.[0];
    $importFile.value = "";
    if (!file) return;

    try {
        const backup = parseBackup(await file.text());
        const result = await importBackup(backup);
        await loadAndRender();
        window.alert(
            `Imported ${result.imported} show${result.imported === 1 ? "" : "s"}.` +
                (result.failed > 0
                    ? ` ${result.failed} could not be imported.`
                    : ""),
        );
    } catch (err) {
        console.error("Failed to import backup:", err);
        window.alert(
            err instanceof Error ? err.message : "Failed to import backup.",
        );
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

/** Loads the saved sort preference, then renders the status board. */
async function init(): Promise<void> {
    currentSort = await getSortOrder();
    $sortSelect.value = currentSort;
    await loadAndRender();
}

void init();
