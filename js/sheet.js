/* LOSY Mini App — bottom sheet (About / Профиль).
   Hardware back (popstate) и Telegram BackButton закрывают шит. */

import { showBack, hideBack } from "./telegram.js";

let current = null;
let lastFocus = null;
let onChange = null; // router слушает, чтобы не показывать BackButton поверх

function emit() { onChange?.(current !== null); }

export function onSheetChange(fn) { onChange = fn; }

function openSheet(sheet) {
  if (current) return;
  current = sheet;
  lastFocus = document.activeElement;
  sheet.classList.add("is-open");
  sheet.removeAttribute("aria-hidden");
  document.documentElement.classList.add("sheet-locked");
  history.pushState({ losySheet: true }, "");
  showBack();
  emit();
  sheet.querySelector(".sheet__close")?.focus({ preventScroll: true });
}

function closeSheet(sheet, { restoreHistory = true } = {}) {
  if (current !== sheet) return;
  current = null;
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("sheet-locked");
  // вернем историю на место, если закрытие не из popstate
  if (restoreHistory && history.state?.losySheet) history.back();
  emit();
  lastFocus?.focus?.({ preventScroll: true });
}

export function isOpen() { return current !== null; }
export function closeCurrent() { if (current) closeSheet(current); }

export function initSheets() {
  for (const opener of document.querySelectorAll("[data-open-sheet]")) {
    opener.addEventListener("click", () => {
      const sheet = document.getElementById(opener.dataset.openSheet);
      if (sheet) openSheet(sheet);
    });
  }
  for (const sheet of document.querySelectorAll(".sheet")) {
    sheet.setAttribute("aria-hidden", "true");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.querySelector(".sheet__backdrop")?.addEventListener("click", () => closeSheet(sheet));
    sheet.querySelector(".sheet__close")?.addEventListener("click", () => closeSheet(sheet));
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]")) closeSheet(sheet);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) closeSheet(current);
  });
  // hardware back в Android/Telegram: state уже вытолкнут — просто закрываем
  window.addEventListener("popstate", () => {
    if (current) closeSheet(current, { restoreHistory: false });
  });
}
