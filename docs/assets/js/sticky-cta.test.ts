// @vitest-environment jsdom

/**
 * @fileoverview Unit tests for the sticky CTA bar toggle logic.
 *
 * IntersectionObserver isn't implemented in jsdom, so a stub class stands
 * in for it, recording what it's asked to observe and exposing the
 * callback so tests can trigger it directly.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { initStickyCta } from "./sticky-cta.js";

/** Minimal IntersectionObserver stand-in for testing. */
class StubObserver {
    callback: (entries: { isIntersecting: boolean }[]) => void;
    observed: Element[] = [];

    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        this.callback = callback;
    }

    observe(el: Element) {
        this.observed.push(el);
    }
}

describe("initStickyCta", () => {
    it("observes the hero actions element", () => {
        const heroActions = document.createElement("div");
        const stickyCta = document.createElement("header");

        const observer = initStickyCta(
            heroActions,
            stickyCta,
            StubObserver as unknown as typeof IntersectionObserver,
        ) as unknown as StubObserver;

        expect(observer.observed).toEqual([heroActions]);
    });

    it("adds is-visible when the hero actions element scrolls out of view", () => {
        const heroActions = document.createElement("div");
        const stickyCta = document.createElement("header");

        const observer = initStickyCta(
            heroActions,
            stickyCta,
            StubObserver as unknown as typeof IntersectionObserver,
        ) as unknown as StubObserver;

        observer.callback([{ isIntersecting: false }]);
        expect(stickyCta.classList.contains("is-visible")).toBe(true);
    });

    it("removes is-visible when the hero actions element scrolls back into view", () => {
        const heroActions = document.createElement("div");
        const stickyCta = document.createElement("header");
        stickyCta.classList.add("is-visible");

        const observer = initStickyCta(
            heroActions,
            stickyCta,
            StubObserver as unknown as typeof IntersectionObserver,
        ) as unknown as StubObserver;

        observer.callback([{ isIntersecting: true }]);
        expect(stickyCta.classList.contains("is-visible")).toBe(false);
    });

    it("does nothing when heroActions is missing", () => {
        const stickyCta = document.createElement("header");

        const observer = initStickyCta(
            null,
            stickyCta,
            StubObserver as unknown as typeof IntersectionObserver,
        );

        expect(observer).toBeUndefined();
    });

    it("does nothing when stickyCta is missing", () => {
        const heroActions = document.createElement("div");

        const observer = initStickyCta(
            heroActions,
            null,
            StubObserver as unknown as typeof IntersectionObserver,
        );

        expect(observer).toBeUndefined();
    });

    it("finds real elements on the actual index.html page", () => {
        const html = readFileSync(
            resolve(import.meta.dirname, "../../index.html"),
            "utf-8",
        );
        const match = html.match(/<body>([\s\S]*?)<\/body>/i);
        document.body.innerHTML = match?.[1] ?? "";

        const observer = initStickyCta(
            document.querySelector(".hero-actions"),
            document.getElementById("sticky-cta"),
            StubObserver as unknown as typeof IntersectionObserver,
        );

        expect(observer).not.toBeUndefined();
    });
});
