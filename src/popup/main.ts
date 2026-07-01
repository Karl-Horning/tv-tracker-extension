/**
 * @fileoverview Entry point for the TV Tracker popup.
 *
 * Bootstraps the popup UI. As later steps are added, this module will
 * integrate show data from storage, apply status-group filtering, and
 * wire up the add/remove interactions.
 */

const statusEl = document.querySelector<HTMLParagraphElement>('#status');

if (statusEl) {
  statusEl.textContent = 'Scaffold loaded via TypeScript + Vite.';
}
