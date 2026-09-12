/* LOSY Mini App — view: About modal content */

import { ABOUT } from "../data.js";
import { icon } from "../icons.js";

export function renderAbout() {
  const body = document.querySelector("[data-about-body]");
  if (!body) return;
  body.innerHTML = `
    <h2 class="sheet__title" id="about-title">${ABOUT.title}</h2>
    ${ABOUT.paragraphs.map((p) => `<p class="sheet__text">${p}</p>`).join("")}
    <div class="sheet__features">
      ${ABOUT.features.map((f) => `<span class="sheet__feat">${icon(f.icon)} ${f.label}</span>`).join("")}
    </div>
    <button class="btn btn--primary sheet__ok" type="button" data-close-sheet>Понятно</button>
  `;
}
