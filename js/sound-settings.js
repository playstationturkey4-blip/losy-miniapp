/* ===================================================
   LOSY Sound & Music Engine + Unified Currency Migration (v69)
   - Единая валюта: только золотые монеты (200 000 на старте)
   - Тактильные приятные звуки кликов на все кнопки
   - Фоновая приятная музыка на главной странице
   - Настройки звука и музыки в профиле
   =================================================== */

const SOUND_KEY = 'losySound';
const MUSIC_KEY = 'losyMusic';
const CURRENCY_KEY = 'losyBalance';
const MIGRATION_KEY = 'losyCurrencyMigrated_v69';

// 1. НАСТРОЙКИ ЗВУКОВ ЭФФЕКТОВ (losySound: 'on' | 'off')
function readSoundPref() {
  try {
    const s = localStorage.getItem(SOUND_KEY);
    return s !== 'off';
  } catch (e) { return true; }
}

let soundEnabled = readSoundPref();
const soundListeners = new Set();

export const isSoundEnabled = () => soundEnabled;

export function setSoundEnabled(val) {
  soundEnabled = !!val;
  try { localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off'); } catch (e) {}
  for (const fn of soundListeners) fn(soundEnabled);
}

export function onSoundChange(fn) {
  soundListeners.add(fn);
  fn(soundEnabled);
  return () => soundListeners.delete(fn);
}

// 2. НАСТРОЙКИ ФОНОВОЙ МУЗЫКИ (losyMusic: 'on' | 'off')
function readMusicPref() {
  try {
    const m = localStorage.getItem(MUSIC_KEY);
    return m !== 'off';
  } catch (e) { return true; }
}

let musicEnabled = readMusicPref();
const musicListeners = new Set();

export const isMusicEnabled = () => musicEnabled;

export function setMusicEnabled(val) {
  musicEnabled = !!val;
  try { localStorage.setItem(MUSIC_KEY, musicEnabled ? 'on' : 'off'); } catch (e) {}
  for (const fn of musicListeners) fn(musicEnabled);
  const currentView = location.hash.replace('#', '') || 'home';
  updateHomeMusic(currentView);
}

export function onMusicChange(fn) {
  musicListeners.add(fn);
  fn(musicEnabled);
  return () => musicListeners.delete(fn);
}

// 3. ЕДИНАЯ ВАЛЮТА: 200 000 ЗОЛОТЫХ МОНЕТ
export function initUnifiedCurrency() {
  try {
    if (localStorage.getItem(MIGRATION_KEY) !== 'true') {
      localStorage.setItem(CURRENCY_KEY, '200000');
      localStorage.removeItem('losySpaceCoins');
      localStorage.setItem(MIGRATION_KEY, 'true');
      window.dispatchEvent(new CustomEvent('losy:balance'));
    } else if (!localStorage.getItem(CURRENCY_KEY)) {
      localStorage.setItem(CURRENCY_KEY, '200000');
      window.dispatchEvent(new CustomEvent('losy:balance'));
    }
  } catch (e) {}
}

// 4. ТАКТИЛЬНЫЙ ЗВУК ТАПА ДЛЯ ВСЕХ КНОПОК
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTapSound() {
  if (!isSoundEnabled()) return;

  // Telegram Haptic Feedback
  try {
    const tg = window.Telegram?.WebApp?.HapticFeedback || window.parent?.Telegram?.WebApp?.HapticFeedback;
    if (tg) tg.impactOccurred('light');
  } catch (e) {}

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Мягкий бархатный тактильный щелчок (620Hz -> 240Hz за 35мс)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

// Глобальный перехват тапов на всех кликабельных элементах
export function initGlobalTapSounds() {
  document.addEventListener('click', (e) => {
    const clickable = e.target.closest(
      'button, a, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], .gcard, .bottomnav__item, .hero__cta, .hero__about, .sheet__close, .topbar__brand, .topbar__balance, .topbar__avatar, .offer, .xpill, .filter-opt'
    );
    if (clickable) {
      playTapSound();
    }
  }, { capture: true, passive: true });
}

// 5. ФОНОВАЯ МУЗЫКА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ (Lo-Fi / Ambient)
let homeAudio = null;
let fadeInterval = null;

export function initHomeMusic() {
  if (homeAudio) return;
  try {
    homeAudio = new Audio('/assets/sounds/losy-home-theme.mp3?v=69');
    homeAudio.loop = true;
    homeAudio.volume = 0;
    homeAudio.preload = 'auto';

    // Разблокировка по первому взаимодействию
    const unlock = () => {
      const curView = location.hash.replace('#', '') || 'home';
      if (curView === 'home' && isMusicEnabled()) {
        homeAudio.play().then(() => {
          fadeTo(0.28, 800);
        }).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true, passive: true });
  } catch (e) {}
}

function fadeTo(targetVol, durationMs = 500) {
  if (!homeAudio) return;
  clearInterval(fadeInterval);
  const steps = 12;
  const stepTime = Math.max(20, Math.floor(durationMs / steps));
  const startVol = homeAudio.volume;
  const delta = (targetVol - startVol) / steps;
  let currentStep = 0;

  fadeInterval = setInterval(() => {
    currentStep++;
    const nextVol = Math.max(0, Math.min(1, startVol + delta * currentStep));
    homeAudio.volume = nextVol;
    if (currentStep >= steps) {
      clearInterval(fadeInterval);
      homeAudio.volume = targetVol;
      if (targetVol <= 0.02) {
        try { homeAudio.pause(); } catch (e) {}
      }
    }
  }, stepTime);
}

export function updateHomeMusic(currentView) {
  if (!homeAudio) return;
  const isHome = (currentView === 'home' || currentView === '' || currentView === '#/' || currentView === '/');

  if (isHome && isMusicEnabled()) {
    if (homeAudio.paused) {
      homeAudio.volume = 0;
      homeAudio.play().then(() => {
        fadeTo(0.28, 800);
      }).catch(() => {});
    } else {
      fadeTo(0.28, 600);
    }
  } else {
    if (!homeAudio.paused) {
      fadeTo(0, 350);
    }
  }
}

export function renderSoundButton(button) {
  if (!button) return;
  button.textContent = soundEnabled ? '🔊' : '🔇';
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
  button.title = soundEnabled ? 'Звук включён' : 'Звук выключен';
}

window.addEventListener('storage', e => {
  if (e.key === null || e.key === SOUND_KEY) {
    soundEnabled = readSoundPref();
    for (const fn of soundListeners) fn(soundEnabled);
  }
  if (e.key === null || e.key === MUSIC_KEY) {
    musicEnabled = readMusicPref();
    for (const fn of musicListeners) fn(musicEnabled);
    const cur = location.hash.replace('#', '') || 'home';
    updateHomeMusic(cur);
  }
});

// Экспорт на window для глобальной совместимости
window.playTapSound = playTapSound;
window.isSoundEnabled = isSoundEnabled;
window.isMusicEnabled = isMusicEnabled;
window.setSoundEnabled = setSoundEnabled;
window.setMusicEnabled = setMusicEnabled;
window.updateHomeMusic = updateHomeMusic;
