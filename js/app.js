/* LOSY Mini App — точка входа оболочки */

import { initTelegram, userName } from "./telegram.js";
import { initSheets } from "./sheet.js";
import { initReveal, revealScan } from "./reveal.js";
import { initRouter, initTopbar, initCarouselHints, initBalance, initProfileBalances, initProfileSettings } from "./router.js";
import { initUnifiedCurrency, initGlobalTapSounds, initHomeMusic } from "./sound-settings.js";
import { renderModeCards, renderVpnTeaser, initHero } from "./views/home.js";
import { renderOffers } from "./views/offers.js";
import { renderAbout } from "./views/about.js";

/* Пользователь Telegram → аватар/имя */
function initUser() {
  const name = userName();
  const initial = (name.trim()[0] || "L").toUpperCase();
  for (const el of document.querySelectorAll("[data-user-initial]")) el.textContent = initial;
  for (const el of document.querySelectorAll("[data-user-name]")) el.textContent = name;
}

function boot() {
  initUnifiedCurrency();
  initGlobalTapSounds();
  initHomeMusic();
  initTelegram();
  renderModeCards();
  renderVpnTeaser();
  renderOffers();
  renderAbout();
  initUser();
  initHero();
  initSheets();
  initRouter();
  initTopbar();
  initCarouselHints();
  initBalance();
  initProfileBalances();
  initProfileSettings();
  initReveal();
  revealScan();
}

boot();
