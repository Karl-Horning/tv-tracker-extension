/**
 * @fileoverview Toggles the sticky "Get TV Tracker" bar.
 */

const heroActions = document.querySelector(".hero-actions");
const stickyCta = document.getElementById("sticky-cta");

if (heroActions && stickyCta) {
    const observer = new IntersectionObserver(([entry]) => {
        stickyCta.classList.toggle("is-visible", !entry.isIntersecting);
    });
    observer.observe(heroActions);
}
