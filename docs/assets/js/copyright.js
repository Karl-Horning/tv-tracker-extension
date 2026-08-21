/**
 * @fileoverview Sets the footer copyright year.
 */

export const FOUNDING_YEAR = 2026;

/**
 * Returns the copyright year, or a year range once a later year begins.
 *
 * @param {number} [currentYear] - The year to compare against FOUNDING_YEAR.
 * @returns {string} The founding year alone, or the founding year and the
 *   current year separated by an en dash.
 */
export function copyrightYearRange(currentYear = new Date().getFullYear()) {
    return currentYear > FOUNDING_YEAR
        ? `${FOUNDING_YEAR}–${currentYear}`
        : `${FOUNDING_YEAR}`;
}

document.querySelectorAll(".footer-meta").forEach((el) => {
    el.textContent = `© ${copyrightYearRange()} Karl Horning. Released under the MIT License.`;
});
