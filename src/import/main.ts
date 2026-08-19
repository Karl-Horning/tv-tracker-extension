/** @fileoverview Controller for the standalone import page. */

import "../popup/style.css";
import { importBackup, parseBackup } from "../backup/backup";
import { getTheme, type Theme } from "../storage/shows";

const $fileInput = document.getElementById("file-input") as HTMLInputElement;
const $status = document.getElementById("status") as HTMLElement;
const $btnClose = document.getElementById("btn-close") as HTMLButtonElement;

const CLOSE_DELAY_MS = 1500;

$fileInput.addEventListener("change", () => void handleFileChange());

/** Reads the chosen file and imports its shows. */
async function handleFileChange(): Promise<void> {
    const file = $fileInput.files?.[0];
    if (!file) return;

    try {
        const backup = parseBackup(await file.text());
        const result = await importBackup(backup);
        $status.textContent =
            `Imported ${result.imported} show${result.imported === 1 ? "" : "s"}.` +
            (result.failed > 0
                ? ` ${result.failed} could not be imported.`
                : "");
        setTimeout(() => window.close(), CLOSE_DELAY_MS);
    } catch (err) {
        $status.textContent =
            err instanceof Error ? err.message : "Failed to import backup.";
    } finally {
        $btnClose.hidden = false;
    }
}

$btnClose.addEventListener("click", () => window.close());

/** Applies the saved theme, or the system preference if none is saved. */
async function applySavedTheme(): Promise<void> {
    const savedTheme = await getTheme();
    const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
    ).matches;
    const theme: Theme = savedTheme ?? (systemPrefersDark ? "dark" : "light");
    document.body.dataset.theme = theme;
}

void applySavedTheme();
