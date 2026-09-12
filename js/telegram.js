/* LOSY Mini App — Telegram WebApp wrapper.
   SDK подключается в index.html отдельным скриптом; всё с guard. */

const tg = window.Telegram && window.Telegram.WebApp;

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initTelegram() {
  if (!tryInit()) {
    // SDK мог ещё не загрузиться (async) — повторяем на load и чуть позже
    window.addEventListener("load", () => tryInit());
    setTimeout(() => tryInit(), 1200);
  }
}

function tryInit() {
  const t = window.Telegram && window.Telegram.WebApp;
  if (!t) return false;
  try { t.ready(); } catch (e) { /* standalone-браузер */ }
  try { t.expand(); } catch (e) { /* no-op */ }
  try { t.setHeaderColor?.("#05070a"); } catch (e) { /* no-op */ }
  try { t.setBackgroundColor?.("#05070a"); } catch (e) { /* no-op */ }
  return true;
}

/* Один глобальный обработчик BackButton: текущее поведение задаёт router/sheet */
let backHandler = null;
export function setBackHandler(fn) { backHandler = fn; }
export function showBack() { try { tg?.BackButton?.show(); } catch (e) { /* no-op */ } }
export function hideBack() { try { tg?.BackButton?.hide(); } catch (e) { /* no-op */ } }
try { tg?.BackButton?.onClick(() => backHandler?.()); } catch (e) { /* no-op */ }

/* Haptic feedback для pressed-состояний */
export function haptic(style = "light") {
  try { tg?.HapticFeedback?.impactOccurred?.(style); } catch (e) { /* no-op */ }
}

/* Имя пользователя для аватара */
export function userName() {
  try {
    const u = tg?.initDataUnsafe?.user;
    return u?.first_name || "Игрок";
  } catch (e) { return "Игрок"; }
}
