/* LOSY Mini App — view: Home (hero 9:16 + карусель режимов + VPN teaser) */

import { MODES, BRAND } from "../data.js";
import { icon } from "../icons.js";

/* --- Карточки режимов во всех каруселях (home-compact и games-large) --- */
export function renderModeCards() {
  for (const car of document.querySelectorAll("[data-mode-carousel]")) {
    car.innerHTML = MODES.map((m) => {
      const modeUrl = window.LosyUser ? window.LosyUser.getModeUrl(m.url) : m.url;
      return `
      <div class="carousel__item" data-reveal>
        <a class="gcard gcard--${m.accent}" href="${modeUrl}" aria-label="Играть в ${m.name}">
          <div class="gcard__media">
            <img src="${m.cover}" alt="Обложка режима ${m.name}" loading="lazy" width="600" height="600">
            <div class="gcard__scrim"></div>
          </div>
          <div class="gcard__body">
            <h3 class="gcard__name">${m.name}</h3>
            <p class="gcard__desc">${m.desc}</p>
            <span class="gcard__go">Играть ${icon("arrow")}</span>
          </div>
        </a>
      </div>
    `;
    }).join("");
  }
}

/* --- VPN teaser --- */
export function renderVpnTeaser() {
  const wrap = document.querySelector("[data-vpn]");
  if (!wrap) return;
  wrap.innerHTML = `
    <section class="vpn" data-reveal aria-labelledby="vpn-title">
      <span class="vpn__tag">VPN · Каталог</span>
      <h2 class="vpn__title" id="vpn-title">Бесплатный пробный период VPN</h2>
      <p class="vpn__text">Каталог Telegram-ботов и сервисов, где можно получить VPN бесплатно. Играй, зарабатывай валюту и открывай специальные предложения.</p>
      <a class="btn btn--primary" href="#games">Выбрать игру</a>
    </section>
  `;
}

/* --- Hero video: надежный жизненный цикл для мобильных браузеров и Telegram WebView --- */
let playPromise = null;
let userGestureHooked = false;

function hookUserGesture() {
  if (userGestureHooked) return;
  userGestureHooked = true;
  const onFirstTouch = () => {
    window.removeEventListener("touchstart", onFirstTouch, true);
    window.removeEventListener("pointerdown", onFirstTouch, true);
    window.removeEventListener("click", onFirstTouch, true);
    window.removeEventListener("scroll", onFirstTouch, true);
    userGestureHooked = false;
    safePlayHeroVideo();
  };
  const opts = { capture: true, passive: true, once: true };
  window.addEventListener("touchstart", onFirstTouch, opts);
  window.addEventListener("pointerdown", onFirstTouch, opts);
  window.addEventListener("click", onFirstTouch, opts);
  window.addEventListener("scroll", onFirstTouch, opts);
}

export function safePlayHeroVideo() {
  const v = document.getElementById("heroVideo");
  if (!v) return;

  const homeView = document.querySelector('.view[data-view="home"]');
  if (homeView && !homeView.classList.contains("is-active")) return;
  if (document.visibilityState === "hidden") return;

  if (!v.paused && v.currentTime > 0 && !v.ended) {
    v.classList.add("is-live");
    return;
  }

  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");

  if (playPromise) return;

  try {
    const res = v.play();
    if (res && typeof res.then === "function") {
      playPromise = res;
      res
        .then(() => {
          playPromise = null;
          v.classList.add("is-live");
        })
        .catch((err) => {
          playPromise = null;
          if (err && (err.name === "NotAllowedError" || err.name === "NotSupportedError")) {
            hookUserGesture();
          }
        });
    } else {
      v.classList.add("is-live");
    }
  } catch (err) {
    playPromise = null;
    hookUserGesture();
  }
}

export function safePauseHeroVideo() {
  const v = document.getElementById("heroVideo");
  if (!v) return;

  if (playPromise) {
    playPromise
      .then(() => {
        try { v.pause(); } catch (_) {}
      })
      .catch(() => {});
  } else {
    try { v.pause(); } catch (_) {}
  }
}

export function initHero() {
  const v = document.getElementById("heroVideo");
  if (!v) return;

  v.muted = true;
  v.defaultMuted = true;
  v.controls = false;
  v.playsInline = true;
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");

  // Попытка запуска при инициализации
  safePlayHeroVideo();

  // Запуск при готовности медиа-данных и плавное появление
  v.addEventListener("playing", () => v.classList.add("is-live"));
  v.addEventListener("loadedmetadata", safePlayHeroVideo);
  v.addEventListener("loadeddata", safePlayHeroVideo);
  v.addEventListener("canplay", safePlayHeroVideo);
  v.addEventListener("canplaythrough", safePlayHeroVideo);

  // Защита от остановки при условии, что вкладка home активна
  let pauseDebounceTimer = null;
  v.addEventListener("pause", () => {
    const homeView = document.querySelector('.view[data-view="home"]');
    if (!homeView || !homeView.classList.contains("is-active")) return;
    if (document.visibilityState === "hidden") return;

    clearTimeout(pauseDebounceTimer);
    pauseDebounceTimer = setTimeout(() => {
      if (v.paused && document.visibilityState === "visible") {
        const hv = document.querySelector('.view[data-view="home"]');
        if (hv && hv.classList.contains("is-active")) {
          safePlayHeroVideo();
        }
      }
    }, 250);
  });

  // Возобновление при возврате на страницу
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      safePlayHeroVideo();
    } else {
      safePauseHeroVideo();
    }
  });

  // Возврат из фонового режима / экрана блокировки
  window.addEventListener("pageshow", safePlayHeroVideo);
  window.addEventListener("focus", safePlayHeroVideo);

  // Если Telegram WebApp SDK меняет вьюпорт
  if (window.Telegram?.WebApp) {
    try {
      window.Telegram.WebApp.onEvent?.("viewportChanged", safePlayHeroVideo);
    } catch { /* no-op */ }
  }

  // IntersectionObserver: приостанавливаем при глубоком скролле, возобновляем при появлении
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          safePlayHeroVideo();
        } else {
          safePauseHeroVideo();
        }
      }
    }, { threshold: 0.05 });
    io.observe(v);
  }

  // Готовим жест-разблокировку на случай блокировки автоплея политикой Low Power Mode
  hookUserGesture();
}

export { BRAND };
