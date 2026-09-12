/* LOSY Mini App — view: Предложения (UI foundation, без реальных цен) */

import { OFFERS } from "../data.js";
import { icon } from "../icons.js";

export function renderOffers() {
  const list = document.querySelector(".offers__list");
  if (!list) return;
  list.innerHTML = OFFERS.map((o) => {
    const locked = o.meta.every(([cls]) => cls === "badge--soon");
    return `
      <div class="offer ${locked ? "offer--locked" : ""}" data-reveal>
        <div class="offer__icon ${o.variant}">${icon(o.icon)}</div>
        <div class="offer__body">
          <div class="offer__name">${o.name}</div>
          <div class="offer__meta">
            ${o.meta.map(([cls, label]) => `<span class="badge ${cls}">${label}</span>`).join("")}
          </div>
        </div>
        <span class="offer__chevron" aria-hidden="true">${icon("chevron")}</span>
      </div>
    `;
  }).join("");
}
