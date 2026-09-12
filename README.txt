LOSY Mini App — оболочка (app shell)
=====================================

Запуск (обязательно через HTTP, не file://):
    python serve.py            # http://0.0.0.0:8000
    или: python -m http.server 8000

Структура:
  index.html            — app shell: Главная / Игры / Предложения / Профиль (+ About sheet)
  page2.html            — шим совместимости для ссылки «Перейти в награды» из режима Апгрейд
  modes/                — три режима (Бомбы, Ракета, Апгрейд) — НЕ ИЗМЕНЕНЫ
                          (losy-bombs.html, losy-rocket.html, losy-upgrade.html)
  assets/hero/          — новое 9:16 видео (losy-hero-916.mp4, без звука, faststart) + poster
  assets/covers/        — ФИНАЛЬНЫЕ обложки режимов (квадрат 1254×1254, WebP):
                          bombs.webp / rocket.webp / upgrade.webp
  assets/fonts/         — локальные шрифты (Unbounded / Inter / Oswald, variable woff2)
  css/  js/             — оболочка (ES-модули, без сборки и зависимостей)

Навигация: hash-роутер (#home #games #offers #profile), Telegram BackButton,
safe-area (viewport-fit=cover), reduced-motion, save-data (hero не играет при экономии трафика).
Баланс в топбаре — UI-фундамент: читает localStorage.losy_balance (ключ для будущей экономики).
