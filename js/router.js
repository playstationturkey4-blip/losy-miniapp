/* LOSY Mini App — hash-роутер: home / games / offers + topbar + BackButton */

import { setBackHandler, showBack, hideBack, haptic } from "./telegram.js";
import { isOpen, closeCurrent, onSheetChange } from "./sheet.js";
import { revealScan } from "./reveal.js";
import { safePlayHeroVideo, safePauseHeroVideo } from "./views/home.js";
import { updateHomeMusic, isMusicEnabled, setMusicEnabled, isSoundEnabled, setSoundEnabled, playTapSound } from "./sound-settings.js";

const VIEWS = ["home", "games", "profile"];

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
  const read = () => {
    try {
      if (window.LosyUser) return window.LosyUser.getBalance();
      const v = localStorage.getItem("losyBalance");
      if (v === null) return 200000;
      const n = parseInt(v, 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) { return 200000; }
  };
  const fill = () => {
    const g = document.getElementById("profileGold");
    if (g) g.textContent = read().toLocaleString("ru-RU");
  };
  fill();
  initPromoCode();
  window.addEventListener("pageshow", fill);
  window.addEventListener("losy:balance", fill);
  window.addEventListener("storage", fill);
}

/* Активация промокодов в профиле игрока */
export function initPromoCode() {
  const input = document.getElementById("promoInput");
  const btn = document.getElementById("promoBtn");
  const status = document.getElementById("promoStatus");
  if (!input || !btn || !status || btn.dataset.bound) return;
  btn.dataset.bound = "true";

  const handleRedeem = async () => {
    const code = (input.value || "").trim().toUpperCase();
    if (!code) {
      status.style.display = "block";
      status.className = "promo-status promo-status--error";
      status.innerHTML = `<div style="font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:13px;">⚠️ Введите промокод!</div>`;
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning'); } catch (_) {}
      return;
    }

    btn.disabled = true;
    btn.style.opacity = "0.6";
    status.style.display = "block";
    status.className = "promo-status";
    status.style.background = "rgba(255, 255, 255, 0.08)";
    status.style.border = "1px solid rgba(255, 255, 255, 0.15)";
    status.style.color = "rgba(255, 255, 255, 0.9)";
    status.innerHTML = `<div style="font-family:'Inter',system-ui,sans-serif;font-size:13px;">⏳ Проверка промокода «${code}»...</div>`;

    const userId = window.LosyUser ? window.LosyUser.getUserId() : (localStorage.getItem("losyUserId") || "");
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
    const username = tgUser.username || "";
    const firstName = tgUser.first_name || "";

    const payload = JSON.stringify({ userId, code, username, firstName });
    const endpoints = [
      "/api/bot/promo",
      "https://losy-miniapp.onrender.com/api/bot/promo"
    ];

    let result = null;
    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
        const data = await resp.json();
        result = data;
        if (data && (data.ok || resp.status < 500)) {
          break;
        }
      } catch (e) {
        // try next endpoint
      }
    }

    if (result && result.ok) {
      status.className = "promo-status promo-status--success";
      status.style.display = "block";
      status.innerHTML = `
        <div style="font-family:'Unbounded',var(--font-brand,sans-serif);font-weight:700;font-size:14px;letter-spacing:0.02em;margin-bottom:3px;color:#3DFFA7;">
          🎉 ПРОМОКОД ПРИМЕНЁН!
        </div>
        <div style="font-family:'Unbounded',var(--font-brand,sans-serif);font-weight:800;font-size:18px;color:#FFD700;margin:4px 0;letter-spacing:0.01em;">
          +${Number(result.reward).toLocaleString("ru-RU")} 🪙
        </div>
        <div style="font-family:'Inter',system-ui,sans-serif;font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">
          ${result.desc || ""}
        </div>
      `;
      input.value = "";
      if (window.LosyUser && typeof result.newBalance === "number") {
        window.LosyUser.setBalance(result.newBalance);
      } else if (typeof result.newBalance === "number") {
        localStorage.setItem("losyBalance", String(result.newBalance));
        window.dispatchEvent(new CustomEvent("losy:balance"));
      }
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch (_) {}
    } else {
      status.className = "promo-status promo-status--error";
      status.style.display = "block";
      const errMsg = (result && result.error) ? result.error : "Не удалось связаться с сервером активации";
      status.innerHTML = `<div style="font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:13px;color:#ff6b6b;">${errMsg}</div>`;
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error'); } catch (_) {}
    }

    btn.disabled = false;
    btn.style.opacity = "1";
  };

  btn.addEventListener("click", handleRedeem);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleRedeem();
  });
}

/* Баланс в топбаре — единая валюта (200 000 на старте). */
export function initBalance() {
  let balance = -1;
  const read = () => {
    try {
      if (window.LosyUser) return window.LosyUser.getBalance();
      const v = localStorage.getItem("losyBalance");
      if (v === null) return 200000;
      const n = Number(v);
      return isNaN(n) || n < 0 ? 0 : n;
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

