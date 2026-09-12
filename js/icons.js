/* LOSY Mini App — инлайн-SVG иконки (без внешних зависимостей) */

const PATHS = {
  key: '<path d="M14 10a4 4 0 1 0-3.6 2.3L8 14.6V17H5.7l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  game: '<rect x="3" y="6.5" width="18" height="11" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10v4M6 12h4M15.5 11h.01M18 13.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  star: '<path d="M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.2l-5.1 2.7 1.1-5.6-4.2-3.9 5.7-.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.2 6.2l3 3M14.8 14.8l3 3M17.8 6.2l-3 3M9.2 14.8l-3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  chat: '<path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H9l-4.2 3.4c-.5.4-.8.1-.8-.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  arrow: '<path d="M5 12h13M13 6.5L18.5 12 13 17.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  swipe: '<path d="M4 12h16M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  down: '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M8 6.5v11l9-5.5z" fill="currentColor"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v11M4 13h16M12 9s-4.5.3-5.4-2C5.9 5.4 7.5 4 9 4.7c1.8.8 3 4.3 3 4.3s1.2-3.5 3-4.3c1.5-.7 3.1.7 2.4 2.3-.9 2.3-5.4 2-5.4 2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  home: '<path d="M4.5 10.5L12 4l7.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4V15h-4v5.5h-4A1.5 1.5 0 0 1 4.5 19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}
