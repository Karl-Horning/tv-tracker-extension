/**
 * @fileoverview Toggles the sticky "Get TV Tracker" bar.
 */

/**
 * Wires the sticky CTA bar to reveal once heroActions scrolls out of view.
 *
 * @param {Element | null} heroActions - The hero's own CTA element, or null if not found.
 * @param {Element | null} stickyCta - The sticky bar element, or null if not found.
 * @param {typeof IntersectionObserver} [ObserverClass] - Constructor used to
 *   observe heroActions; defaults to the global IntersectionObserver.
 * @returns {IntersectionObserver | undefined} The created observer, or
 *   undefined if either element is missing.
 */
export function initStickyCta(heroActions, stickyCta, ObserverClass) {
    if (!heroActions || !stickyCta) return undefined;
    const Observer = ObserverClass ?? IntersectionObserver;
    const observer = new Observer(([entry]) => {
        stickyCta.classList.toggle("is-visible", !entry.isIntersecting);
    });
    observer.observe(heroActions);
    return observer;
}

initStickyCta(
    document.querySelector(".hero-actions"),
    document.getElementById("sticky-cta"),
);
