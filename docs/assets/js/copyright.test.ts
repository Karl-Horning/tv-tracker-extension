// @vitest-environment jsdom

/**
 * @fileoverview Unit tests for the footer copyright year logic.
 */

import { describe, expect, it } from "vitest";
import { copyrightYearRange, FOUNDING_YEAR } from "./copyright.js";

describe("copyrightYearRange", () => {
    it("returns just the founding year when the current year matches it", () => {
        expect(copyrightYearRange(FOUNDING_YEAR)).toBe(`${FOUNDING_YEAR}`);
    });

    it("returns a range once the current year is later than the founding year", () => {
        expect(copyrightYearRange(FOUNDING_YEAR + 1)).toBe(
            `${FOUNDING_YEAR}–${FOUNDING_YEAR + 1}`,
        );
    });

    it("returns a wider range for years further in the future", () => {
        expect(copyrightYearRange(FOUNDING_YEAR + 4)).toBe(
            `${FOUNDING_YEAR}–${FOUNDING_YEAR + 4}`,
        );
    });
});
