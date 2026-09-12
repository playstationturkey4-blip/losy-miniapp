/* LOSY Mini App — hash-роутер: home / games / offers + topbar + BackButton */

import { setBackHandler, showBack, hideBack, haptic } from "./telegram.js";
import { isOpen, closeCurrent, onSheetChange } from "./sheet.js";
import { revealScan } from "./reveal.js";
import { safePlayHeroVideo, safePauseHeroVideo } from "./views/home.js";
import { updateHomeMusic, isMusicEnabled, setMusicEnabled, isSoundEnabled, setSoundEnabled, playTapSound } from "./sound-settings.js";

const VIEWS = ["home", "games", "offers", "profile"];

function currentView() {
  const h = location.hash.replace("#", "");
  return VIEWS.includes(h) ? h : "home";
}

function updateBackVisibility() {
  // BackButton нужен только вне главной (sheet управляет им сам, когда открыт)
  if (isOpen()) return;
  if (currentView() === "home") hideBack(); else showBack();
}

function renderView() {
  const view = currentView();
  for (const el of document.querySelectorAll(".view")) {
    el.classList.toggle("is-active", el.dataset.view === view);
  }
  for (const el of document.querySelectorAll("[data-nav]")) {
    const on = el.dataset.nav === view;
    el.classList.toggle("is-active", on);
    el.setAttribute("aria-current", on ? "page" : "false");
  }
  if (!isOpen()) window.scrollTo({ top: 0, behavior: "instant" });
  revealScan();
  updateBackVisibility();

  if (view === "home") {
    safePlayHeroVideo();
  } else {
    safePauseHeroVideo();
  }
  updateHomeMusic(view);
}

export function initRouter() {
  // Навигация: нижнее меню + любые [data-nav] ссылки — с haptic
  for (const el of document.querySelectorAll("[data-nav]")) {
    el.addEventListener("click", () => haptic("light"));
  }
  // Telegram BackButton: sheet открыт → закрыть его; иначе — на главную
  setBackHandler(() => {
    playTapSound();
    if (isOpen()) closeCurrent();
    else if (currentView() !== "home") location.hash = "#/";
  });
  // sheet open/close меняет видимость BackButton
  onSheetChange(updateBackVisibility);
  window.addEventListener("hashchange", renderView);
  renderView();
}

/* Topbar прячется при скролле вниз ниже hero */
export function initTopbar() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  let lastY = 0;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const heroH = (document.querySelector(".hero")?.offsetHeight || 0) * 0.6;
      if (y > heroH && y > lastY + 4) bar.classList.add("topbar--hidden");
      else if (y < lastY - 4 || y <= heroH) bar.classList.remove("topbar--hidden");
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

/* Swipe-hint у карусели: виден, только когда реально есть что листать */
export function initCarouselHints() {
  for (const car of document.querySelectorAll("[data-mode-carousel]")) {
    const hint = car.closest("section")?.querySelector(".games__hint");
    if (!hint) continue;
    const update = () => {
      hint.hidden = !(car.scrollWidth > car.clientWidth + 8);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
  }
}

/* ПРОФИЛЬ: баланс единой валюты — золотые монеты (200 000 по умолчанию).
   Оболочка и игры живут на одном origin — localStorage общий. */
export function initProfileBalances() {
  const read = (k) => {
    try {
      const v = localStorage.getItem(k);
      if (v === null) return 200000;
      const n = parseInt(v, 10);
      return isNaN(n) ? 200000 : n;
    } catch (e) { return 200000; }
  };
  const fill = () => {
    const g = document.getElementById("profileGold");
    if (g) g.textContent = read("losyBalance").toLocaleString("ru-RU");
  };
  fill();
  window.addEventListener("pageshow", fill);
  window.addEventListener("losy:balance", fill);
  window.addEventListener("storage", fill);
}

/* Баланс в топбаре — единая валюта (200 000 на старте). */
export function initBalance() {
  let balance = 200000;
  const read = () => {
    try {
      const v = localStorage.getItem("losyBalance");
      if (v === null) return 200000;
      const n = Number(v);
      return isNaN(n) ? 200000 : n;
    } catch (e) { return 200000; }
  };
  const el = document.querySelector("[data-balance]");
  if (!el) return;
  const updateUI = () => {
    const v = read();
    if (v !== balance) {
      balance = v;
      el.textContent = balance.toLocaleString("ru-RU");
      const wrap = el.closest(".topbar__balance");
      wrap?.classList.remove("is-pulse");
      void wrap?.offsetWidth;
      wrap?.classList.add("is-pulse");
    }
  };
  balance = read();
  el.textContent = balance.toLocaleString("ru-RU");
  window.addEventListener("pageshow", updateUI);
  window.addEventListener("losy:balance", updateUI);
  window.addEventListener("storage", updateUI);
}

/* НАСТРОЙКИ В ПРОФИЛЕ: переключатели музыки и звуков */
export function initProfileSettings() {
  const musicToggle = document.getElementById("settingMusicToggle");
  const soundToggle = document.getElementById("settingSoundToggle");

  if (musicToggle) {
    musicToggle.checked = isMusicEnabled();
    musicToggle.addEventListener("change", () => {
      setMusicEnabled(musicToggle.checked);
      playTapSound();
    });
  }

  if (soundToggle) {
    soundToggle.checked = isSoundEnabled();
    soundToggle.addEventListener("change", () => {
      setSoundEnabled(soundToggle.checked);
      playTapSound();
    });
  }
}

/* реэкспорт точки вызова */
export { initProfileBalances as initProfileBalancesExport };

