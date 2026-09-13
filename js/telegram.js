/* LOSY Mini App — Telegram WebApp wrapper.
   SDK подключается локально в index.html; безопасный доступ через getTg() */

function getTg() {
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initTelegram() {
  tryInit();
}

function tryInit() {
  const t = getTg();
  if (!t) return false;
  try { t.ready(); } catch (e) { /* standalone-браузер */ }
  try { t.expand(); } catch (e) { /* no-op */ }
  try { t.setHeaderColor?.("#05070a"); } catch (e) { /* no-op */ }
  try { t.setBackgroundColor?.("#05070a"); } catch (e) { /* no-op */ }
  return true;
}

/* Один глобальный обработчик BackButton: текущее поведение задаёт router/sheet */
let backHandler = null;
export function setBackHandler(fn) {
  backHandler = fn;
  const t = getTg();
  try {
    t?.BackButton?.onClick(() => backHandler?.());
  } catch (e) {}
}

export function showBack() {
  try { getTg()?.BackButton?.show(); } catch (e) {}
}

export function hideBack() {
  try { getTg()?.BackButton?.hide(); } catch (e) {}
}

/* Haptic feedback для pressed-состояний */
export function haptic(style = "light") {
  try { getTg()?.HapticFeedback?.impactOccurred?.(style); } catch (e) {}
}

/* Имя пользователя для аватара */
export function userName() {
  try {
    const u = getTg()?.initDataUnsafe?.user;
    return u?.first_name || "Игрок";
  } catch (e) {
    return "Игрок";
  }
}
