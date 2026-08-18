/**
 * @fileoverview Popup controller for the TV Tracker extension.
 *
 * Orchestrates data loading from chrome.storage.local, DOM rendering,
 * and user interactions (add show, remove show, refresh, import/export,
 * sort, appearance).
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
    getTheme,
    removeShow,
    setSortOrder,
    setTheme,
    type Theme,
} from "../storage/shows";
import { renderSearchResults, renderStatusBoard } from "./render";

// ── DOM references ────────────────────────────────────────────────────

const $sections = document.getElementById("show-sections") as HTMLElement;
const $boardStatus = document.getElementById("board-status") as HTMLElement;
const $emptyState = document.getElementById("empty-state") as HTMLElement;
const $btnAdd = document.getElementById("btn-add-show") as HTMLButtonElement;
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
const $appFooter = document.getElementById("app-footer") as HTMLElement;
const $showsCount = document.getElementById("shows-count") as HTMLElement;

const $settingsMenu = document.getElementById(
    "settings-menu",
) as HTMLDetailsElement;
const $settingsSummary = $settingsMenu.querySelector(
    "summary",
) as HTMLElement;
const $settingsPanel = document.getElementById(
    "settings-panel",
) as HTMLElement;
const $themeSwitch = document.getElementById(
    "theme-switch",
) as HTMLButtonElement;
const $sortSelect = document.getElementById(
    "sort-select",
) as HTMLSelectElement;
const $btnRefresh = document.getElementById("btn-refresh") as HTMLButtonElement;
const $btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const $btnImport = document.getElementById("btn-import") as HTMLButtonElement;
const $importFile = document.getElementById(
    "import-file",
) as HTMLInputElement;
const $lastUpdated = document.getElementById("last-updated") as HTMLElement;

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
    $appFooter.hidden = !hasShows;
    $showsCount.textContent = `${shows.length} show${shows.length === 1 ? "" : "s"} tracked`;
    $boardStatus.textContent = hasShows
        ? `Showing ${shows.length} tracked show${shows.length === 1 ? "" : "s"}`
        : "No shows tracked yet";
    $lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    })}`;

    $sections.querySelectorAll<HTMLButtonElement>(".btn-remove").forEach((btn) => {
        btn.addEventListener("click", () => void handleRemoveClick(btn));
    });
}

/**
 * Removes a tracked show after the user confirms, then re-renders.
 *
 * @param btn - The remove button clicked, carrying the show's ID and name.
 */
async function handleRemoveClick(btn: HTMLButtonElement): Promise<void> {
    const showName = btn.dataset.showName ?? "this show";
    if (!window.confirm(`Remove ${showName} from your tracked shows?`)) return;

    const id = Number(btn.dataset.showId);
    await removeShow(id);
    await loadAndRender();
}

// ── Search panel ──────────────────────────────────────────────────────

/** Opens the search panel and hides the status board. */
function openSearch(): void {
    $searchPanel.hidden = false;
    $sections.hidden = true;
    $appFooter.hidden = true;
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
    searchTimer = setTimeout(() => void runSearch(query), 300);
});

/**
 * Searches TVmaze for the given query and renders the results.
 *
 * @param query - The search text entered by the user.
 */
async function runSearch(query: string): Promise<void> {
    const results = await searchShows(query);
    renderSearchResults($searchResults, results);
}

$searchResults.addEventListener("click", (e) => void handleSearchResultClick(e));

/**
 * Adds a show from the search results after its "Add" button is clicked.
 *
 * @param e - The click event, used to find the clicked result's button.
 */
async function handleSearchResultClick(e: Event): Promise<void> {
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
}

// ── Settings menu ─────────────────────────────────────────────────────

/** Closes the settings menu and returns focus to the button that opened it. */
function closeSettingsMenu(): void {
    if (!$settingsMenu.open) return;
    $settingsMenu.open = false;
    $settingsSummary.focus();
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $settingsMenu.open) closeSettingsMenu();
});

document.addEventListener("click", (e) => {
    if (!$settingsMenu.open) return;
    if (!$settingsMenu.contains(e.target as Node)) closeSettingsMenu();
});

// Fixed positioning needs pixel values, not CSS's percentage-of-ancestor
// trick, so the panel's position is computed here. Chrome also sizes the
// popup window to the page's rendered height, so reserve enough height
// while the menu is open — measured live, so it's correct at any zoom
// level or font size — and release it again on close.
$settingsMenu.addEventListener("toggle", () => {
    if ($settingsMenu.open) {
        const summaryRect = $settingsSummary.getBoundingClientRect();
        $settingsPanel.style.top = `${Math.round(summaryRect.bottom + 6)}px`;
        $settingsPanel.style.right = `${Math.round(window.innerWidth - summaryRect.right)}px`;

        const panelBottom = $settingsPanel.getBoundingClientRect().bottom;
        document.body.style.minHeight = `${Math.ceil(panelBottom) + 8}px`;
    } else {
        document.body.style.minHeight = "";
    }
});

// ── Appearance ────────────────────────────────────────────────────────

/**
 * Applies a theme to the document and updates the switch to match.
 *
 * @param theme - The theme to apply.
 */
function applyTheme(theme: Theme): void {
    document.body.dataset.theme = theme;
    $themeSwitch.setAttribute("aria-checked", String(theme === "dark"));
}

$themeSwitch.addEventListener("click", () => void handleThemeSwitchClick());

/** Toggles between light and dark theme and persists the choice. */
async function handleThemeSwitchClick(): Promise<void> {
    const next: Theme =
        document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    await setTheme(next);
}

// ── Sort ──────────────────────────────────────────────────────────────

$sortSelect.addEventListener("change", () => void handleSortChange());

/** Applies the selected sort order, persists it, and re-renders. */
async function handleSortChange(): Promise<void> {
    currentSort = $sortSelect.value as SortOrder;
    await setSortOrder(currentSort);
    await loadAndRender();
}

// ── Import / export ──────────────────────────────────────────────────

$btnRefresh.addEventListener("click", () => void handleRefreshClick());

/** Refetches every tracked show from TVmaze and re-renders the board. */
async function handleRefreshClick(): Promise<void> {
    $btnRefresh.disabled = true;
    try {
        await refreshAllShows();
        await loadAndRender();
    } finally {
        $btnRefresh.disabled = false;
        closeSettingsMenu();
    }
}

$btnExport.addEventListener("click", () => void handleExportClick());

/** Downloads the current tracked shows as a JSON backup file. */
async function handleExportClick(): Promise<void> {
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
    closeSettingsMenu();
}

$btnImport.addEventListener("click", () => $importFile.click());

$importFile.addEventListener("change", () => void handleImportFileChange());

/** Reads the chosen backup file and imports its shows. */
async function handleImportFileChange(): Promise<void> {
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
    } finally {
        closeSettingsMenu();
    }
}

// ── Init ──────────────────────────────────────────────────────────────

/**
 * Loads the saved theme and sort preference, applies them, then renders
 * the status board.
 *
 * Falls back to the operating system's light/dark preference when the user
 * has never made an explicit choice, without persisting that fallback.
 */
async function init(): Promise<void> {
    const savedTheme = await getTheme();
    const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
    ).matches;
    applyTheme(savedTheme ?? (systemPrefersDark ? "dark" : "light"));

    currentSort = await getSortOrder();
    $sortSelect.value = currentSort;
    await loadAndRender();
}

void init();
