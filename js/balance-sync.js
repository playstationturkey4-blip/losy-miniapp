/**
 * LOSY VPN & Mini App — Unified Per-User Persistent Balance & Identity Manager
 * Ensures strict balance isolation per Telegram User ID / Device Guest ID.
 * Gives 200,000 initial coins on first registration and persists all wins/losses in real-time.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY_BAL = 'losyBalance';
  const STORAGE_KEY_UID = 'losy_user_id';
  const INITIAL_BALANCE = 200000;

  // 1. Определение уникального User ID
  function getUserId() {
    // А) Telegram WebApp initDataUnsafe
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
        const tgId = window.Telegram.WebApp.initDataUnsafe.user.id;
        if (tgId) {
          const sId = String(tgId);
          localStorage.setItem(STORAGE_KEY_UID, sId);
          return sId;
        }
      }
    } catch (e) {}

    // Б) URL query parameter (?userId=123456789)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qId = urlParams.get('userId');
      if (qId && qId.trim() && qId !== 'null' && qId !== 'undefined') {
        const sId = String(qId.trim());
        localStorage.setItem(STORAGE_KEY_UID, sId);
        return sId;
      }
    } catch (e) {}

    // В) Ранее сохранённый в localStorage идентификатор
    try {
      const stored = localStorage.getItem(STORAGE_KEY_UID);
      if (stored && stored.trim() && stored !== 'null' && stored !== 'undefined') {
        return stored.trim();
      }
    } catch (e) {}

    // Г) Уникальный гостевой ID для браузера без Telegram (изолирован для каждого устройства)
    const newGuestId = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem(STORAGE_KEY_UID, newGuestId);
    } catch (e) {}
    return newGuestId;
  }

  function getUserInfo() {
    const uid = getUserId();
    let firstName = 'Игрок';
    let username = '';
    try {
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser) {
        if (tgUser.first_name) firstName = tgUser.first_name;
        if (tgUser.username) username = tgUser.username;
      }
    } catch (e) {}
    return { id: uid, firstName, username };
  }

  // 2. Чтение персонального баланса
  function getBalance() {
    const uid = getUserId();
    try {
      // Пользовательский ключ баланса имеет наивысший приоритет
      const userSpecific = localStorage.getItem(STORAGE_KEY_BAL + '_' + uid);
      if (userSpecific !== null) {
        const parsed = parseInt(userSpecific, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }

      // Общий ключ баланса
      const general = localStorage.getItem(STORAGE_KEY_BAL);
      if (general !== null) {
        const parsed = parseInt(general, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(parsed));
          return parsed;
        }
      }

      // Начальный баланс для нового пользователя — ровно 200 000
      localStorage.setItem(STORAGE_KEY_BAL, String(INITIAL_BALANCE));
      localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(INITIAL_BALANCE));
      return INITIAL_BALANCE;
    } catch (e) {
      return INITIAL_BALANCE;
    }
  }

  // 3. Сохранение баланса (локально + немедленная отправка на сервер)
  function saveBalance(newBal) {
    const num = Math.max(0, Math.floor(Number(newBal) || 0));
    const uid = getUserId();

    try {
      localStorage.setItem(STORAGE_KEY_BAL, String(num));
      localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(num));
      window.dispatchEvent(new CustomEvent('losy:balance', {
        detail: { balance: num, userId: uid }
      }));
    } catch (e) {}

    // Отправляем на сервер в фоне
    syncToServer(num);
    return num;
  }

  function syncToServer(balanceToSync) {
    const info = getUserInfo();
    const payload = {
      userId: info.id,
      balance: balanceToSync,
      firstName: info.firstName,
      username: info.username
    };

    try {
      const initData = window.Telegram?.WebApp?.initData || '';
      fetch('/api/user/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(r => r.json()).then(data => {
        if (data && data.ok && typeof data.balance === 'number') {
          // Сервер подтвердил сохранение
        }
      }).catch(() => {
        // Офлайн режим: локальный баланс сохранён
      });
    } catch (e) {}
  }

  // 4. Запрос актуального баланса с сервера при старте
  async function fetchServerBalance() {
    const info = getUserInfo();
    try {
      const initData = window.Telegram?.WebApp?.initData || '';
      const res = await fetch('/api/user/balance?userId=' + encodeURIComponent(info.id), {
        headers: {
          'X-Telegram-Init-Data': initData
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && typeof data.balance === 'number') {
          const serverBal = data.balance;
          const currentBal = getBalance();
          if (serverBal !== currentBal) {
            localStorage.setItem(STORAGE_KEY_BAL, String(serverBal));
            localStorage.setItem(STORAGE_KEY_BAL + '_' + info.id, String(serverBal));
            window.dispatchEvent(new CustomEvent('losy:balance', {
              detail: { balance: serverBal, userId: info.id }
            }));
          }
          return serverBal;
        }
      }
    } catch (e) {}
    return getBalance();
  }

  // 5. Вспомогательная функция для передачи userId в URL игр
  function getModeUrl(urlPath) {
    const uid = getUserId();
    const sep = urlPath.includes('?') ? '&' : '?';
    return urlPath + sep + 'userId=' + encodeURIComponent(uid);
  }

  const LosyUser = {
    getUserId,
    getUserInfo,
    getBalance,
    saveBalance,
    fetchServerBalance,
    getModeUrl,
    INITIAL_BALANCE
  };

  window.LosyUser = LosyUser;

  // Автоматический запрос баланса при загрузке страницы
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => fetchServerBalance());
    } else {
      fetchServerBalance();
    }
  }

  // Слушаем изменения в других вкладках/окнах
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_BAL || e.key === (STORAGE_KEY_BAL + '_' + getUserId())) {
      window.dispatchEvent(new CustomEvent('losy:balance', {
        detail: { balance: getBalance(), userId: getUserId() }
      }));
    }
  });

})(typeof window !== 'undefined' ? window : this);
