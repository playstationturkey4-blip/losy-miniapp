/* LOSY Mini App — данные оболочки.
   Обложки — ПЛЕЙСХОЛДЕРЫ: позже заменить файлы в /assets/covers/
   (bombs.webp / rocket.webp / upgrade.webp) без изменения layout. */

export const BRAND = {
  name: "LOSY",
  wordmark: 'LOSY<em>VPN</em>',
  slogan: "Находи VPN-предложения с бесплатным пробным периодом — и зарабатывай награды в играх.",
};

export const MODES = [
  {
    id: "bombs",
    name: "Бомбы",
    desc: "Вскрывай ячейки, собирай множители и избегай мин.",
    url: "/modes/losy-bombs.html?v=93",
    cover: "/assets/covers/bombs.webp",
    accent: "bombs",
  },
  {
    id: "rocket",
    name: "Ракета",
    desc: "Успей забрать ставку до того, как ракета уйдёт.",
    url: "/modes/losy-rocket.html?v=70",
    cover: "/assets/covers/rocket.webp",
    accent: "rocket",
  },
  {
    id: "upgrade",
    name: "Апгрейд",
    desc: "Обменивай скины и повышай их уровень.",
    url: "/modes/losy-upgrade-v24.html?v=92",
    cover: "/assets/covers/upgrade.webp",
    accent: "upgrade",
  },
];

/* UI FOUNDATION. Реальных цен/курсов нет — только статусы «скоро». */
export const OFFERS = [
  {
    id: "vpn-keys",
    name: "VPN-ключи от ботов",
    meta: [["badge", "Бесплатный период"], ["badge--soon", "скоро"]],
    icon: "key",
    variant: "",
  },
  {
    id: "channels",
    name: "Эксклюзивные каналы",
    meta: [["badge--violet", "Доступ"], ["badge--soon", "скоро"]],
    icon: "chat",
    variant: "offer__icon--violet",
  },
  {
    id: "subs",
    name: "Подписки за валюту",
    meta: [["badge--violet", "Обмен"], ["badge--soon", "скоро"]],
    icon: "star",
    variant: "offer__icon--pink",
  },
  {
    id: "special",
    name: "Специальные предложения",
    meta: [["badge--soon", "скоро"]],
    icon: "spark",
    variant: "",
  },
];

export const ABOUT = {
  title: 'Что такое <em>LOSY</em>?',
  paragraphs: [
    "<strong>LOSY</strong> — Telegram Mini App с каталогом Telegram-ботов и сервисов, где можно находить предложения с бесплатным пробным периодом VPN.",
    "Пользователь также может играть в игровые режимы, зарабатывать внутриигровую валюту и использовать её для получения специальных наград, подписок и эксклюзивных предложений.",
  ],
  features: [
    { icon: "key", label: "VPN-предложения" },
    { icon: "game", label: "Игры и валюта" },
    { icon: "star", label: "Эксклюзив" },
    { icon: "spark", label: "Награды" },
  ],
};
