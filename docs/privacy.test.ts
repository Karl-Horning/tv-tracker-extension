// @vitest-environment jsdom

/**
 * @fileoverview Automated accessibility tests for the privacy policy page.
 *
 * Loads the actual docs/privacy.html body so that structural regressions —
 * a missing landmark, a skipped heading level, a missing alt attribute —
 * fail this test automatically. Colour contrast rules are disabled because
 * jsdom does not compute CSS cascade or paint.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

/**
 * Reads docs/privacy.html and returns the content of its body element.
 *
 * @returns The raw HTML inside the body element.
 */
function loadPageBody(): string {
    const html = readFileSync(
        resolve(import.meta.dirname, "privacy.html"),
        "utf-8",
    );
    const match = html.match(/<body>([\s\S]*?)<\/body>/i);
    return match?.[1] ?? "";
}

const PAGE_BODY = loadPageBody();

/** Rules that require CSS computation, which jsdom does not provide. */
const AXE_OPTIONS: axe.RunOptions = {
    rules: { "color-contrast": { enabled: false } },
};

describe("privacy policy page accessibility", () => {
    it("has no violations", async () => {
        document.body.innerHTML = PAGE_BODY;
        const results = await axe.run(document.body, AXE_OPTIONS);
        const messages = results.violations.map(
            (v) => `[${v.id}] ${v.description}`,
        );
        expect(messages).toEqual([]);
    });
});
