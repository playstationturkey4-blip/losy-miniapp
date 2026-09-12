/* LOSY Mini App — reveal-on-scroll (IntersectionObserver) */

import { reduceMotion } from "./telegram.js";

let observer = null;

export function revealScan() {
  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    for (const el of document.querySelectorAll("[data-reveal]")) el.classList.add("is-in");
    return;
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("is-in");
        observer.unobserve(en.target);
      }
    }
  }, { threshold: 0.12 });
  for (const el of document.querySelectorAll("[data-reveal]:not(.is-in)")) {
    observer.observe(el);
  }
}

export function initReveal() {
  if (!reduceMotion.matches) document.documentElement.classList.add("js-anim");
  revealScan();
}
