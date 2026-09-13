/* LOSY Mini App — Модуль обмена валюты на VPN и Инвентарь игрока */

import { haptic } from "../telegram.js";
import { closeCurrent } from "../sheet.js";

const DEFAULT_TARIFFS = [
  {
    id: "bronze_3d",
    title: "🥉 Fast VLESS",
    badge: "3 дня VLESS",
    days: 3,
    price: 50000,
    features: ["Высокоскоростной VLESS Reality", "YouTube 4K без буферизации", "Доступ на любых устройствах"],
    botUsername: "FastVlessTrialBot"
  },
  {
    id: "silver_7d",
    title: "🥈 HitVPN Pro",
    badge: "7 дней Pro",
    days: 7,
    price: 100000,
    features: ["Чистые серверы Нидерланды/Германия", "Обход всех блокировок РКН", "Высокая скорость до 1 Гбит/с"],
    botUsername: "hitvpnbot"
  },
  {
    id: "gold_30d",
    title: "🥇 Planet Ultra",
    badge: "30 дней VIP",
    days: 30,
    price: 250000,
    features: ["Безлимит на 30 дней", "VLESS + Shadowsocks + WireGuard", "Выделенный VIP-приоритет"],
    botUsername: "PlanetVPNTrialBot"
  }
];

function getStoredBalance() {
  try {
    const v = localStorage.getItem("losyBalance");
    if (v === null) return 200000;
    const n = Number(v);
    return isNaN(n) ? 200000 : n;
  } catch (e) {
    return 200000;
  }
}

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) {
    return null;
  }
}

function getStoredVpnKeys() {
  try {
    const v = localStorage.getItem("losy_vpn_keys");
    return v ? JSON.parse(v) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredVpnKeys(keys) {
  try {
    localStorage.setItem("losy_vpn_keys", JSON.stringify(keys));
  } catch (e) {}
}

let activeTariffs = DEFAULT_TARIFFS;

/* Рендеринг карточек тарифов */
function renderTariffs() {
  const container = document.getElementById("tariffsContainer");
  const balEl = document.getElementById("exchangeCurrentBalance");
  if (!container) return;

  const curBal = getStoredBalance();
  if (balEl) balEl.textContent = curBal.toLocaleString("ru-RU");

  container.innerHTML = activeTariffs.map(t => {
    const canAfford = curBal >= t.price;
    return `
      <div class="tariff-card">
        <div class="tariff-card__header">
          <span class="tariff-card__badge">${t.badge}</span>
          <span class="tariff-card__price">${t.price.toLocaleString("ru-RU")} 🪙</span>
        </div>
        <div class="tariff-card__title">${t.title}</div>
        <div class="tariff-card__features">
          ${t.features ? t.features.map(f => `<div>• ${f}</div>`).join("") : `<div style="font-size:12px;color:var(--c-muted);">${t.desc || ''}</div>`}
        </div>
        <button 
          type="button" 
          class="btn ${canAfford ? 'btn--primary' : 'btn--secondary'}" 
          data-exchange-id="${t.id}"
          style="width:100%;font-size:14px;padding:10px;"
          ${canAfford ? '' : 'style="opacity:0.65;"'}
        >
          ${canAfford ? '⚡ Обменять на ключ' : '🔒 Не хватает монет'}
        </button>
      </div>
    `;
  }).join("");

  // Привязка кликов обмена
  for (const btn of container.querySelectorAll("[data-exchange-id]")) {
    btn.addEventListener("click", () => handleExchangeClick(btn.dataset.exchangeId));
  }
}

/* Обработка запроса на обмен */
async function handleExchangeClick(tariffId) {
  const tariff = activeTariffs.find(t => t.id === tariffId);
  if (!tariff) return;

  const curBal = getStoredBalance();
  if (curBal < tariff.price) {
    haptic("error");
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert(`Недостаточно монет для тарифа "${tariff.title}". Требуется ${tariff.price.toLocaleString('ru-RU')} 🪙`);
    } else {
      alert(`Недостаточно монет! Требуется ${tariff.price.toLocaleString('ru-RU')} 🪙`);
    }
    return;
  }

  const tgUser = getTelegramUser();
  const initData = window.Telegram?.WebApp?.initData || "";

  try {
    const res = await fetch("/api/vpn/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData
      },
      body: JSON.stringify({
        tariffId: tariff.id,
        user: tgUser,
        clientBalance: curBal
      })
    });

    const data = await res.json();
    if (data.ok && data.vpnItem) {
      haptic("success");
      // Обновляем баланс
      localStorage.setItem("losyBalance", data.balance);
      window.dispatchEvent(new Event("losy:balance"));

      // Сохраняем в кэш ключей
      const keys = getStoredVpnKeys();
      keys.unshift(data.vpnItem);
      saveStoredVpnKeys(keys);

      // Показываем карточку успеха
      const successCard = document.getElementById("exchangeSuccessCard");
      const codeEl = document.getElementById("newVpnKeyCode");
      const launchBtn = document.getElementById("btnLaunchVpnBot");
      const copyBtn = document.getElementById("btnCopyGeneratedKey");

      if (successCard && codeEl) {
        codeEl.textContent = data.vpnItem.key;
        if (launchBtn) launchBtn.href = data.vpnItem.botUrl;
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.vpnItem.key).then(() => {
              haptic("light");
              copyBtn.textContent = "✓ Скопировано!";
              setTimeout(() => { copyBtn.textContent = "📋 Скопировать"; }, 2000);
            }).catch(() => {});
          };
        }
        successCard.style.display = "block";
        successCard.scrollIntoView({ behavior: "smooth" });
      }

      renderTariffs();
      refreshInventoryUI();
    } else {
      haptic("error");
      const errMsg = data.error || "Ошибка при обмене";
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(errMsg);
      } else {
        alert(errMsg);
      }
    }
  } catch (err) {
    // Офлайн фолбэк для локального демо
    haptic("success");
    const codeSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const mockKey = `LOSY-${tariff.days}D-${codeSuffix}`;
    const newBal = curBal - tariff.price;
    localStorage.setItem("losyBalance", newBal);
    window.dispatchEvent(new Event("losy:balance"));

    const mockItem = {
      id: "vpn_loc_" + Date.now(),
      tariffId: tariff.id,
      title: tariff.title,
      badge: tariff.badge,
      key: mockKey,
      botUsername: tariff.botUsername,
      botUrl: `https://t.me/${tariff.botUsername}?start=${mockKey}`,
      createdAt: Date.now(),
      expiresDays: tariff.days
    };
    const keys = getStoredVpnKeys();
    keys.unshift(mockItem);
    saveStoredVpnKeys(keys);

    const successCard = document.getElementById("exchangeSuccessCard");
    const codeEl = document.getElementById("newVpnKeyCode");
    const launchBtn = document.getElementById("btnLaunchVpnBot");
    const copyBtn = document.getElementById("btnCopyGeneratedKey");

    if (successCard && codeEl) {
      codeEl.textContent = mockKey;
      if (launchBtn) launchBtn.href = mockItem.botUrl;
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(mockKey).then(() => {
            haptic("light");
            copyBtn.textContent = "✓ Скопировано!";
            setTimeout(() => { copyBtn.textContent = "📋 Скопировать"; }, 2000);
          }).catch(() => {});
        };
      }
      successCard.style.display = "block";
    }
    renderTariffs();
    refreshInventoryUI();
  }
}

/* Инициализация окна обмена */
export function initVpnExchange() {
  renderTariffs();
  window.addEventListener("losy:balance", renderTariffs);

  // Кнопка обновления тарифов с сервера
  const refreshBtn = document.getElementById("btnRefreshTariffs");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      haptic("light");
      refreshBtn.textContent = "Загрузка...";
      try {
        const res = await fetch("/api/vpn/tariffs");
        if (res.ok) {
          const d = await res.json();
          if (d.ok && Array.isArray(d.tariffs)) {
            activeTariffs = d.tariffs;
          }
        }
      } catch (e) {}
      refreshBtn.textContent = "Обновить";
      renderTariffs();
    });
  }

  // Загружаем тарифы в фоне
  fetch("/api/vpn/tariffs")
    .then(r => r.json())
    .then(d => {
      if (d.ok && Array.isArray(d.tariffs)) {
        activeTariffs = d.tariffs;
        renderTariffs();
      }
    })
    .catch(() => {});
}

/* Обновление UI инвентаря (ключи VPN + скины ракет) */
export function refreshInventoryUI() {
  const vpnContainer = document.getElementById("inventoryVpnList");
  const countEl = document.getElementById("inventoryVpnCount");
  const skinsContainer = document.getElementById("inventorySkinsList");
  const skinsCountEl = document.getElementById("inventorySkinsCount");

  const keys = getStoredVpnKeys();
  if (countEl) countEl.textContent = keys.length;

  if (vpnContainer) {
    if (keys.length === 0) {
      vpnContainer.innerHTML = `
        <div style="padding:18px;text-align:center;background:rgba(255,255,255,0.03);border-radius:12px;border:1px dashed rgba(255,255,255,0.1);font-size:13px;color:var(--c-muted);">
          У вас пока нет активных ключей VPN.<br>
          <button class="btn btn--secondary btn--sm" id="btnGoToExchange" type="button" style="margin-top:10px;">⚡ Перейти к обмену</button>
        </div>
      `;
      const goBtn = document.getElementById("btnGoToExchange");
      if (goBtn) {
        goBtn.addEventListener("click", () => {
          closeCurrent();
          setTimeout(() => {
            const sh = document.getElementById("vpnExchangeSheet");
            if (sh) sh.classList.add("is-open");
          }, 200);
        });
      }
    } else {
      vpnContainer.innerHTML = keys.map(k => {
        const dateStr = k.createdAt ? new Date(k.createdAt).toLocaleDateString("ru-RU") : "Активен";
        return `
          <div class="vpn-key-card">
            <div class="vpn-key-card__header">
              <span class="vpn-key-card__title">${k.title || 'Подписка VPN'}</span>
              <span class="vpn-key-card__badge">${k.badge || 'VPN'}</span>
            </div>
            <div style="font-size:11px;color:var(--c-muted);margin-bottom:8px;">Получен: ${dateStr} • Срок: ${k.expiresDays || 30} дней</div>
            <div class="vpn-key-card__code">${k.key}</div>
            <div class="vpn-key-card__actions">
              <button class="btn btn--secondary btn--sm" data-copy-key="${k.key}" type="button">📋 Скопировать</button>
              <a class="btn btn--primary btn--sm" href="${k.botUrl || `https://t.me/${k.botUsername || 'FineVPNbot'}?start=${k.key}`}" target="_blank" style="text-decoration:none;">🚀 Включить в боте</a>
            </div>
          </div>
        `;
      }).join("");

      for (const btn of vpnContainer.querySelectorAll("[data-copy-key]")) {
        btn.addEventListener("click", () => {
          const code = btn.dataset.copyKey;
          navigator.clipboard.writeText(code).then(() => {
            haptic("light");
            btn.textContent = "✓ Готово!";
            setTimeout(() => { btn.textContent = "📋 Скопировать"; }, 2000);
          }).catch(() => {});
        });
      }
    }
  }

  // Коллекция скинов ракет
  if (skinsContainer) {
    const skins = [
      { id: "pen", name: "Стандартный шаттл", icon: "🚀", status: "Используется", active: true },
      { id: "skin_neon", name: "Неоновый Шторм", icon: "⚡", status: "В ангаре", active: false },
      { id: "skin_gold", name: "Золотой Феникс", icon: "🌟", status: "В ангаре", active: false },
      { id: "skin_cyber", name: "Киберпанк V2", icon: "🔮", status: "В ангаре", active: false }
    ];
    if (skinsCountEl) skinsCountEl.textContent = skins.length;

    skinsContainer.innerHTML = skins.map(s => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid ${s.active ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'};border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:28px;margin-bottom:6px;">${s.icon}</div>
        <div style="font-weight:600;font-size:12px;color:var(--c-text);margin-bottom:4px;">${s.name}</div>
        <div style="font-size:11px;color:${s.active ? '#22c55e' : 'var(--c-muted)'};font-weight:${s.active ? '700' : '400'};">${s.status}</div>
      </div>
    `).join("");
  }
}

/* Инициализация окна инвентаря */
export function initInventory() {
  refreshInventoryUI();

  // При открытии инвентаря подтягиваем свежие данные с сервера
  const invOpenBtn = document.querySelector('[data-open-sheet="inventorySheet"]');
  if (invOpenBtn) {
    invOpenBtn.addEventListener("click", async () => {
      const tgUser = getTelegramUser();
      const uid = tgUser?.id || "guest_local";
      try {
        const res = await fetch(`/api/user/inventory?userId=${uid}`);
        if (res.ok) {
          const d = await res.json();
          if (d.ok && Array.isArray(d.vpnKeys)) {
            saveStoredVpnKeys(d.vpnKeys);
            refreshInventoryUI();
          }
        }
      } catch (e) {}
    });
  }
}

/* Синхронизация с сервером при старте приложения (Supabase + Promo-бонусы) */
export async function syncServerBalance() {
  try {
    const tgUser = getTelegramUser();
    const clientBalance = getStoredBalance();
    const initData = window.Telegram?.WebApp?.initData || "";

    const res = await fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData
      },
      body: JSON.stringify({
        clientBalance: clientBalance,
        user: tgUser
      })
    });

    if (res.ok) {
      const d = await res.json();
      if (d.ok && d.user) {
        const serverBal = Number(d.user.balance);
        if (!isNaN(serverBal) && serverBal !== clientBalance) {
          localStorage.setItem("losyBalance", serverBal);
          window.dispatchEvent(new Event("losy:balance"));
        }
        if (Array.isArray(d.user.vpnKeys) && d.user.vpnKeys.length > 0) {
          saveStoredVpnKeys(d.user.vpnKeys);
          refreshInventoryUI();
        }
      }
    }
  } catch (err) {
    // Офлайн режим — работаем локально без сбоев
  }
}
