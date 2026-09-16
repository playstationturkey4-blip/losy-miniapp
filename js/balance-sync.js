/**
 * LOSY VPN & Mini App — Unified Per-User Persistent Balance & Identity Manager
 * Ensures strict balance isolation per Telegram User ID / Device Guest ID.
 * Gives 200,000 initial coins on first registration and persists all wins/losses in real-time.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY_BAL = 'losyBalance';
  const STORAGE_KEY_UID = 'losy_user_id';
  const STORAGE_KEY_INIT = 'losy_user_initialized';
  const STORAGE_KEY_MODIFIED = 'losy_balance_modified';
  const STORAGE_KEY_TIME = 'losy_balance_time';
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

  // 2. Чтение персонального баланса: 200 000 начисляется СТРОГО ОДИН РАЗ на старте и НИКОГДА не сбрасывается!
  function getBalance() {
    const uid = getUserId();
    try {
      // Пользовательский ключ баланса (losyBalance_12345) имеет наивысший приоритет
      const userSpecific = localStorage.getItem(STORAGE_KEY_BAL + '_' + uid);
      if (userSpecific !== null) {
        const parsed = parseInt(userSpecific, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          localStorage.setItem(STORAGE_KEY_BAL, String(parsed));
          return parsed;
        }
      }

      // Общий ключ баланса (losyBalance)
      const general = localStorage.getItem(STORAGE_KEY_BAL);
      if (general !== null) {
        const parsed = parseInt(general, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }

      // Если пользователь уже был инициализирован ранее, но баланс = 0 (или был потрачен)
      if (localStorage.getItem(STORAGE_KEY_INIT + '_' + uid) === 'true' || localStorage.getItem(STORAGE_KEY_INIT) === 'true') {
        return 0;
      }

      // Чистый запуск без локальных данных: 200 000 как начальный дефолт (не отмечаем как локальную модификацию!)
      return INITIAL_BALANCE;
    } catch (e) {
      return INITIAL_BALANCE;
    }
  }

  // 3. Сохранение баланса (локально + Telegram CloudStorage + отправка на сервер)
  function saveBalance(newBal) {
    const num = Math.max(0, Math.floor(Number(newBal) || 0));
    const uid = getUserId();
    const now = Date.now();

    try {
      localStorage.setItem(STORAGE_KEY_BAL, String(num));
      localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(num));
      localStorage.setItem(STORAGE_KEY_INIT + '_' + uid, 'true');
      localStorage.setItem(STORAGE_KEY_INIT, 'true');
      localStorage.setItem(STORAGE_KEY_MODIFIED + '_' + uid, 'true');
      localStorage.setItem(STORAGE_KEY_MODIFIED, 'true');
      localStorage.setItem(STORAGE_KEY_TIME + '_' + uid, String(now));
      localStorage.setItem(STORAGE_KEY_TIME, String(now));

      // Облачное хранилище Telegram для 100% защиты от очистки браузерного кэша на телефоне
      if (window.Telegram?.WebApp?.CloudStorage && !uid.startsWith('guest_')) {
        try {
          window.Telegram.WebApp.CloudStorage.setItem('losy_bal_' + uid, String(num), () => {});
          window.Telegram.WebApp.CloudStorage.setItem('losy_time_' + uid, String(now), () => {});
          window.Telegram.WebApp.CloudStorage.setItem('losy_init_' + uid, 'true', () => {});
        } catch (csErr) {}
      }

      window.dispatchEvent(new CustomEvent('losy:balance', {
        detail: { balance: num, userId: uid }
      }));
    } catch (e) {}

    // Отправляем на сервер в фоне вместе с временной меткой
    syncToServer(num, now);
    return num;
  }

  function syncToServer(balanceToSync, timestamp) {
    const info = getUserInfo();
    let ownedList = null;
    try {
      const o = localStorage.getItem('losyOwnedRockets') || localStorage.getItem('losy_owned_skins');
      if (o) ownedList = JSON.parse(o);
    } catch (e) {}

    const payload = {
      userId: info.id,
      balance: balanceToSync,
      clientUpdatedAt: timestamp || Date.now(),
      firstName: info.firstName,
      username: info.username
    };
    if (Array.isArray(ownedList)) {
      payload.owned = ownedList;
    }

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
      })
      .then(r => r.json())
      .then(data => {
        if (data && data.ok && typeof data.balance === 'number') {
          if (data.forcedUpdate || data.balance > getBalance()) {
            console.log('🛡️ [LOSY Balance]: Сервер применил актуальный баланс (бонус/промокод):', data.balance);
            localStorage.setItem(STORAGE_KEY_BAL, String(data.balance));
            localStorage.setItem(STORAGE_KEY_BAL + '_' + info.id, String(data.balance));
            localStorage.setItem(STORAGE_KEY_TIME + '_' + info.id, String(data.updatedAt || Date.now()));
            localStorage.setItem(STORAGE_KEY_TIME, String(data.updatedAt || Date.now()));
            window.dispatchEvent(new CustomEvent('losy:balance', {
              detail: { balance: data.balance, userId: info.id }
            }));
          }
        }
      })
      .catch(() => {});
    } catch (e) {}
  }

  // 4. Запрос актуального баланса с сервера при старте (с абсолютной защитой от сброса в 200k)
  async function fetchServerBalance() {
    const info = getUserInfo();
    const uid = info.id;
    const hasLocalModifications = localStorage.getItem(STORAGE_KEY_MODIFIED + '_' + uid) === 'true' ||
                                 localStorage.getItem(STORAGE_KEY_MODIFIED) === 'true';
    const isInitialized = localStorage.getItem(STORAGE_KEY_INIT + '_' + uid) === 'true' || 
                          localStorage.getItem(STORAGE_KEY_INIT) === 'true';
    const currentBal = getBalance();
    const localTime = parseInt(localStorage.getItem(STORAGE_KEY_TIME + '_' + uid) || localStorage.getItem(STORAGE_KEY_TIME) || '0', 10);

    // Дополнительная проверка из Telegram CloudStorage, если локальный баланс подозрительно пуст
    if (!isInitialized && !hasLocalModifications && window.Telegram?.WebApp?.CloudStorage && !uid.startsWith('guest_')) {
      try {
        await new Promise((resolve) => {
          window.Telegram.WebApp.CloudStorage.getItem('losy_bal_' + uid, (err, val) => {
            if (!err && val !== null && val !== undefined && val !== '') {
              const cloudBal = parseInt(val, 10);
              if (!isNaN(cloudBal) && cloudBal >= 0) {
                localStorage.setItem(STORAGE_KEY_BAL, String(cloudBal));
                localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(cloudBal));
                localStorage.setItem(STORAGE_KEY_INIT + '_' + uid, 'true');
                localStorage.setItem(STORAGE_KEY_INIT, 'true');
                localStorage.setItem(STORAGE_KEY_MODIFIED + '_' + uid, 'true');
              }
            }
            resolve();
          });
        });
      } catch (e) {}
    }

    try {
      const initData = window.Telegram?.WebApp?.initData || '';
      const res = await fetch('/api/user/balance?userId=' + encodeURIComponent(uid), {
        headers: {
          'X-Telegram-Init-Data': initData
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && typeof data.balance === 'number' && !isNaN(data.balance)) {
          const serverBal = data.balance;
          const serverTime = typeof data.updatedAt === 'number' ? data.updatedAt : (data.updatedAt ? new Date(data.updatedAt).getTime() : 0);

          // 1. ПРИОРИТЕТ ПРОМОКОДОВ И НАЧИСЛЕНИЙ:
          // Если баланс на сервере БОЛЬШЕ локального, это 100% начисление промокода в боте,
          // бонус, подарок администратора или победа на другом устройстве.
          // Клиент ОБЯЗАН безоговорочно принять увеличенный баланс!
          if (serverBal > currentBal) {
            console.log('💎 [LOSY Balance]: Получен увеличенный баланс с сервера (промокод/бонус):', serverBal);
            localStorage.setItem(STORAGE_KEY_BAL, String(serverBal));
            localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(serverBal));
            localStorage.setItem(STORAGE_KEY_INIT + '_' + uid, 'true');
            localStorage.setItem(STORAGE_KEY_INIT, 'true');
            const newTime = Math.max(serverTime || Date.now(), Date.now());
            localStorage.setItem(STORAGE_KEY_TIME + '_' + uid, String(newTime));
            localStorage.setItem(STORAGE_KEY_TIME, String(newTime));
            window.dispatchEvent(new CustomEvent('losy:balance', {
              detail: { balance: serverBal, userId: uid }
            }));
            return serverBal;
          }

          // 2. ЕСЛИ У ПОЛЬЗОВАТЕЛЯ ЕЩЕ НЕТ СВОИХ ЛОКАЛЬНЫХ ИГРОВЫХ ДЕЙСТВИЙ НА ЭТОМ УСТРОЙСТВЕ:
          // Сервер и облако являются главным источником правды!
          if (!hasLocalModifications) {
            localStorage.setItem(STORAGE_KEY_BAL, String(serverBal));
            localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(serverBal));
            localStorage.setItem(STORAGE_KEY_INIT + '_' + uid, 'true');
            localStorage.setItem(STORAGE_KEY_INIT, 'true');
            if (serverTime) {
              localStorage.setItem(STORAGE_KEY_TIME + '_' + uid, String(serverTime));
              localStorage.setItem(STORAGE_KEY_TIME, String(serverTime));
            }
            window.dispatchEvent(new CustomEvent('losy:balance', {
              detail: { balance: serverBal, userId: uid }
            }));
            return serverBal;
          }

          // 3. ЕСЛИ У ПОЛЬЗОВАТЕЛЯ ЕСТЬ ЛОКАЛЬНЫЕ ДЕЙСТВИЯ (он уже играл/тратил монеты):
          // А) Защита от сбоя сервера: сервер вернул дефолтные 200 000, а игрок уже играл и имеет реальный баланс
          if (serverBal === INITIAL_BALANCE && currentBal !== INITIAL_BALANCE) {
            console.warn('🛡️ [LOSY Balance]: Сервер вернул дефолтные 200 000, сохраняем реальный баланс игрока:', currentBal);
            syncToServer(currentBal, localTime || Date.now());
            return currentBal;
          }

          // Б) Локальное время свежее серверного более чем на 2 сек (офлайн игра или не успело дойти):
          if (localTime > (serverTime + 2000) && currentBal !== serverBal) {
            console.log('🛡️ [LOSY Balance]: Локальный баланс свежее серверного, обновляем сервер:', currentBal);
            syncToServer(currentBal, localTime);
            return currentBal;
          }

          // В) Сервер имеет более свежий результат (например, выигрыш на другом устройстве):
          if (serverBal !== currentBal) {
            localStorage.setItem(STORAGE_KEY_BAL, String(serverBal));
            localStorage.setItem(STORAGE_KEY_BAL + '_' + uid, String(serverBal));
            localStorage.setItem(STORAGE_KEY_INIT + '_' + uid, 'true');
            localStorage.setItem(STORAGE_KEY_INIT, 'true');
            if (serverTime) {
              localStorage.setItem(STORAGE_KEY_TIME + '_' + uid, String(serverTime));
              localStorage.setItem(STORAGE_KEY_TIME, String(serverTime));
            }
            window.dispatchEvent(new CustomEvent('losy:balance', {
              detail: { balance: serverBal, userId: uid }
            }));
          }
          return serverBal;
        }
      }
    } catch (e) {
      // Офлайн режим: работаем на локальном проверенном балансе
    }
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
