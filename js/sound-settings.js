/* Shared preference. Legacy off is respected on first use; no wallet writes. */
const KEY = 'losySound';
function read() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved !== 'off';
    return true;
  } catch { return true; }
}
let enabled = read();
const listeners = new Set();
export const isSoundEnabled = () => enabled;
function emit() { for (const fn of listeners) fn(enabled); }
export function setSoundEnabled(value) {
  enabled = !!value;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* in-memory fallback */ }
  emit();
}
export function onSoundChange(fn) { listeners.add(fn); fn(enabled); return () => listeners.delete(fn); }
export function renderSoundButton(button) {
  if (!button) return;
  button.textContent = enabled ? '🔊' : '🔇';
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
  button.title = enabled ? 'Звук включён' : 'Звук выключен';
}
window.addEventListener('storage', e => {
  if (e.key === null || e.key === KEY || e.key?.startsWith('losySound')) { enabled = read(); emit(); }
});
