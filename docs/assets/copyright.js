/**
 * @fileoverview Sets the footer copyright year.
 */

const FOUNDING_YEAR = 2026;

/**
 * Returns the copyright year, or a year range once a later year begins.
 *
 * @returns The founding year alone, or the founding year and the current
 *   year separated by an en dash.
 */
function copyrightYearRange() {
    const currentYear = new Date().getFullYear();
    return currentYear > FOUNDING_YEAR
        ? `${FOUNDING_YEAR}–${currentYear}`
        : `${FOUNDING_YEAR}`;
}

document.querySelectorAll(".footer-meta").forEach((el) => {
    el.textContent = `© ${copyrightYearRange()}. Released under the MIT License.`;
});
