/**
 * LOSY VPN — High-Performance Accelerated Backend
 * Features: GZIP compression, In-Memory Caching, Smart ETag, Fast Tunneling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const crypto = require('crypto');
const { tunnelmole } = require('tunnelmole');

const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edltxsziwwvbdnpblxzc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkbHR4c3ppd3d2YmRucGJseHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjUzNTYsImV4cCI6MjA4NzUwMTM1Nn0._61qClwHcOvsPoh58YijOz1DFv7TEdMg4mSC6Xws7xg';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8123;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'server_db.json');

// Тарифы для реального обмена монет на ключи доступа к VPN
const VPN_TARIFFS = {
  'bronze_3d': {
    id: 'bronze_3d',
    title: '🥉 Fast VLESS',
    badge: '3 дня VLESS',
    price: 50000,
    days: 3,
    botUsername: 'FastVlessTrialBot',
    desc: 'Высокоскоростной VLESS Reality ключ для YouTube 4K и игр без рекламы.'
  },
  'silver_7d': {
    id: 'silver_7d',
    title: '🥈 HitVPN Pro',
    badge: '7 дней Pro',
    price: 100000,
    days: 7,
    botUsername: 'hitvpnbot',
    desc: 'Чистые серверы в Нидерландах и Германии с полной защитой от блокировок.'
  },
  'gold_30d': {
    id: 'gold_30d',
    title: '🥇 Planet Ultra',
    badge: '30 дней VIP',
    price: 250000,
    days: 30,
    botUsername: 'PlanetVPNTrialBot',
    desc: 'Безлимит на месяц: VLESS + Shadowsocks + WireGuard для всех устройств.'
  }
};

// 1. Асинхронный клиент Supabase REST API (PostgreSQL в облаке)
function supabaseRequest(apiPath, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    try {
      const fullUrl = new URL(apiPath, SUPABASE_URL);
      const req = https.request(fullUrl, {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          ...extraHeaders
        },
        timeout: 2500
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'Parse error' });
          }
        });
      });
      req.on('error', err => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

function syncUserToSupabase(user) {
  if (!user || !user.id || String(user.id).startsWith('guest_')) return;
  const safeBalance = (typeof user.balance === 'number' && !isNaN(user.balance)) ? user.balance : 200000;
  const row = {
    id: String(user.id),
    username: user.username || '',
    first_name: user.firstName || '',
    balance: Number(safeBalance),
    space_coins: Number(user.spaceCoins || 0),
    owned: user.owned || ['pen'],
    promocodes: user.promocodes || [],
    vpn_keys: user.vpnKeys || [],
    visited_bots: user.visitedBots || [],
    updated_at: new Date().toISOString()
  };
  supabaseRequest('/rest/v1/losy_users', 'POST', row, {
    'Prefer': 'resolution=merge-duplicates'
  }).catch(() => {});
}

// 2. База данных профилей (Двухуровневая: Supabase Cloud + Local File Cache)
let db = {
  users: {},
  sessions: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.users) db.users = {};
  } catch (e) {
    console.error('DB parse error:', e.message);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

// Восстановление профилей из облака Supabase при старте сервера (защита от Render reset)
async function hydrateDbFromSupabase() {
  try {
    const res = await supabaseRequest('/rest/v1/losy_users?select=*', 'GET');
    if (res.ok && Array.isArray(res.data)) {
      let restoredCount = 0;
      for (const row of res.data) {
        if (!row.id) continue;
        const rowTime = new Date(row.updated_at).getTime();
        const localTime = db.users[row.id]?.updatedAt || 0;
        if (!db.users[row.id] || rowTime > localTime) {
          const rowBal = (row.balance !== undefined && row.balance !== null && !isNaN(Number(row.balance))) ? Number(row.balance) : 200000;
          db.users[row.id] = {
            id: String(row.id),
            username: row.username || '',
            firstName: row.first_name || 'Игрок',
            balance: rowBal,
            spaceCoins: Number(row.space_coins || 0),
            owned: row.owned || ['pen'],
            promocodes: row.promocodes || [],
            vpnKeys: row.vpn_keys || [],
            visitedBots: row.visited_bots || [],
            updatedAt: rowTime
          };
          restoredCount++;
        }
      }
      if (restoredCount > 0) {
        saveDb();
        console.log(`☁️ [SUPABASE HYDRATE]: Восстановлено ${restoredCount} профилей игроков из облака`);
      }
    }
  } catch (err) {
    console.error('Supabase hydrate error:', err.message);
  }
}
hydrateDbFromSupabase();

function getOrCreateUser(userData) {
  const tid = String(userData.id);
  if (!db.users[tid]) {
    db.users[tid] = {
      id: tid,
      username: userData.username || '',
      firstName: userData.first_name || userData.firstName || 'Игрок',
      balance: 200000,
      spaceCoins: 0,
      owned: ['pen'],
      promocodes: [],
      vpnKeys: [],
      visitedBots: [],
      updatedAt: Date.now()
    };
    saveDb();
    syncUserToSupabase(db.users[tid]);
  } else {
    if (userData.username) db.users[tid].username = userData.username;
    if (userData.first_name || userData.firstName) db.users[tid].firstName = userData.first_name || userData.firstName;
    if (typeof db.users[tid].balance !== 'number' || isNaN(db.users[tid].balance)) {
      db.users[tid].balance = 200000;
    }
    if (!db.users[tid].vpnKeys) db.users[tid].vpnKeys = [];
    if (!db.users[tid].promocodes) db.users[tid].promocodes = [];
    if (!db.users[tid].visitedBots) db.users[tid].visitedBots = [];
    if (!db.users[tid].owned) db.users[tid].owned = ['pen'];
  }
  return db.users[tid];
}

// 2. Валидация Telegram WebApp initData (HMAC-SHA256)
function verifyTelegramWebAppData(telegramInitData) {
  if (!telegramInitData) return null;
  try {
    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');
    const params = [];
    for (const [k, v] of urlParams.entries()) {
      params.push(`${k}=${v}`);
    }
    params.sort();
    const dataCheckString = params.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash === hash) {
      const userStr = urlParams.get('user');
      return userStr ? JSON.parse(userStr) : { id: 'unknown' };
    }
  } catch (e) {
    console.error('initData verify error:', e.message);
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// Серверные цены и скины
const SERVER_SKINS = {
  'pen': { id: 'pen', name: 'Ручка', price: 0, value: 3 },
  'lit_energy': { id: 'lit_energy', name: 'Lit Energy', price: 10, value: 10 },
  'sportcar': { id: 'sportcar', name: 'Спорткар', price: 50, value: 50 },
  'mellstroy': { id: 'mellstroy', name: 'Меллстрой', price: 100, value: 100 },
  'revva': { id: 'revva', name: 'Ревва', price: 200, value: 200 },
  'homelander': { id: 'homelander', name: 'Хоумлендер', price: 300, value: 300 },
  'durov': { id: 'durov', name: 'Дуров', price: 500, value: 500 },
  'burunov': { id: 'burunov', name: 'Бурунов', price: 800, value: 800 },
  'mihail_litvin': { id: 'mihail_litvin', name: 'Литвин', price: 1000, value: 1000 },
  'mrbeast': { id: 'mrbeast', name: 'MrBeast', price: 1500, value: 1500 },
  'ronaldo': { id: 'ronaldo', name: 'Роналду', price: 2000, value: 2000 },
  'gazan': { id: 'gazan', name: 'Газан', price: 2500, value: 2500 },
  'valeryanych': { id: 'valeryanych', name: 'Валерьяныч', price: 3000, value: 3000 },
  'zolo': { id: 'zolo', name: 'Золо', price: 3500, value: 3500 },
  'mongol': { id: 'mongol', name: 'Монгол', price: 4000, value: 4000 },
  'tamaev': { id: 'tamaev', name: 'Тамаев', price: 4500, value: 4500 },
  'hippo_tshirt': { id: 'hippo_tshirt', name: 'Бегемот', price: 5000, value: 5000 },
  'trollface': { id: 'trollface', name: 'Троллфейс', price: 5500, value: 5500 },
  'kanye': { id: 'kanye', name: 'Канье', price: 6000, value: 6000 },
  'mahachev': { id: 'mahachev', name: 'Махачев', price: 6500, value: 6500 },
  'maklovin': { id: 'maklovin', name: 'Макловин', price: 7000, value: 7000 },
  'olise': { id: 'olise', name: 'Олисе', price: 7500, value: 7500 },
  'vinisius': { id: 'vinisius', name: 'Винисиус', price: 8000, value: 8000 },
  'mbappe': { id: 'mbappe', name: 'Мбаппе', price: 8500, value: 8500 },
  'ronaldo_bra': { id: 'ronaldo_bra', name: 'Роналдо ЗУБ', price: 9000, value: 9000 },
  'rock': { id: 'rock', name: 'Скала', price: 9500, value: 9500 },
  'jonesy': { id: 'jonesy', name: 'Джонси', price: 10000, value: 10000 },
  'tyson': { id: 'tyson', name: 'Тайсон', price: 10500, value: 10500 },
  'brekotkin': { id: 'brekotkin', name: 'Брекоткин', price: 11000, value: 11000 },
  'sinyak': { id: 'sinyak', name: 'Синяк', price: 11500, value: 11500 },
  'markaryan': { id: 'markaryan', name: 'Маркарян', price: 12000, value: 12000 },
  'khovansky': { id: 'khovansky', name: 'Хованский', price: 12500, value: 12500 },
  'lebedev': { id: 'lebedev', name: 'Лебедев', price: 13000, value: 13000 },
  'snoop_dogg': { id: 'snoop_dogg', name: 'Снуп Догг', price: 13500, value: 13500 },
  'eminem': { id: 'eminem', name: 'Эминем', price: 14000, value: 14000 },
  'shelby': { id: 'shelby', name: 'Томас Шелби', price: 15000, value: 15000 },
  'neymar': { id: 'neymar', name: 'Неймар', price: 16000, value: 16000 },
  'bellingham': { id: 'bellingham', name: 'Беллингем', price: 17000, value: 17000 },
  'krueger': { id: 'krueger', name: 'Фредди Крюгер', price: 18000, value: 18000 },
  'pennywise': { id: 'pennywise', name: 'Пеннивайз', price: 19000, value: 19000 },
  'art': { id: 'art', name: 'Клоун Арт', price: 20000, value: 20000 },
  'babadook': { id: 'babadook', name: 'Бабадук', price: 21000, value: 21000 },
  'stark': { id: 'stark', name: 'Тони Старк', price: 23000, value: 23000 },
  'misolo': { id: 'misolo', name: 'Мисоло', price: 24000, value: 24000 },
  'booster': { id: 'booster', name: 'Бустер', price: 77777, value: 77777 },
  'm0nesy': { id: 'm0nesy', name: 'Монеси', price: 26000, value: 26000 },
  'playboi_carti': { id: 'playboi_carti', name: 'Playboi Carti', price: 27000, value: 27000 },
  'ishowspeed': { id: 'ishowspeed', name: 'IShowSpeed', price: 28000, value: 28000 },
  'hasbik': { id: 'hasbik', name: 'Хасбик', price: 29000, value: 29000 },
  'deadpool': { id: 'deadpool', name: 'Дэдпул', price: 30000, value: 30000 },
  'spider': { id: 'spider', name: 'Человек-паук', price: 32000, value: 32000 },
  'venom': { id: 'venom', name: 'Веном', price: 22000, value: 22000 }
};

// IN-MEMORY COMPRESSION CACHE (УСКОРЕНИЕ В 10 РАЗ)
const fileCache = new Map(); // filePath -> { raw, gzip, br, mtime, etag }
const mediaCache = new Map(); // filePath -> Buffer for instant RAM streaming

function getCachedFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const cached = fileCache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached;
    }

    const raw = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isCompressible = (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json' || ext === '.svg');
    
    let gzip = null;
    let br = null;
    if (isCompressible) {
      gzip = zlib.gzipSync(raw, { level: 6 });
      try {
        br = zlib.brotliCompressSync(raw);
      } catch (_) {}
    }

    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    const entry = { raw, gzip, br, mtime: stats.mtimeMs, size: stats.size, etag };
    fileCache.set(filePath, entry);
    return entry;
  } catch (e) {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Мгновенный легковесный ping для keep-alive и health checks
  if (pathname === '/ping' || pathname === '/health' || pathname === '/api/ping' || pathname === '/api/health') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store'
    });
    res.end(JSON.stringify({ status: 'ok', uptime: Math.floor(process.uptime()), time: Date.now() }));
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org telegram: t.me;");

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // REST API
  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      const initData = req.headers['x-telegram-init-data'] || data.initData || parsedUrl.query.initData;
      let authUser = verifyTelegramWebAppData(initData);
      
      if (!authUser) {
        // Если initData отсутствует или не подписана HMAC — используем переданный userId игрока
        const rawId = String(data.userId || data.user?.id || parsedUrl.query.userId || data.guestId || parsedUrl.query.guestId || req.headers['x-guest-id'] || '').trim();
        if (rawId && rawId !== 'null' && rawId !== 'undefined') {
          authUser = {
            id: rawId,
            first_name: data.firstName || data.first_name || 'Игрок',
            username: data.username || ''
          };
        } else {
          const randomGuest = 'guest_' + crypto.randomBytes(4).toString('hex');
          authUser = { id: randomGuest, first_name: 'Гость', username: '' };
        }
      }

      const user = getOrCreateUser(authUser);

      // 1. Персональный баланс пользователя (получение и сохранение с сервера)
      if (pathname === '/api/user/balance') {
        if (req.method === 'POST') {
          const rawBal = data.balance !== undefined ? data.balance : data.clientBalance;
          const newBal = parseInt(rawBal, 10);
          if (isNaN(newBal) || newBal < 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Некорректный баланс' }));
            return;
          }
          user.balance = Math.min(100000000, Math.max(0, newBal));
          user.initialized = true;
          user.updatedAt = Date.now();
          saveDb();
          syncUserToSupabase(user);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            userId: user.id,
            balance: user.balance,
            updatedAt: user.updatedAt
          }));
          return;
        }

        // GET
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          userId: user.id,
          balance: user.balance,
          firstName: user.firstName,
          username: user.username
        }));
        return;
      }

      // 2. Двусторонняя синхронизация баланса и данных игрока
      if (pathname === '/api/user/sync') {
        const clientBalance = parseInt(data.clientBalance, 10);
        // Если передан флаг прямого обновления (например, syncAction === 'set'):
        if (data.syncAction === 'set' && !isNaN(clientBalance) && clientBalance >= 0) {
          user.balance = Math.min(100000000, clientBalance);
          user.updatedAt = Date.now();
          saveDb();
          syncUserToSupabase(user);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          user: {
            id: user.id,
            firstName: user.firstName,
            username: user.username,
            balance: user.balance,
            spaceCoins: user.spaceCoins,
            owned: user.owned || ['pen'],
            promocodes: user.promocodes || [],
            vpnKeys: user.vpnKeys || [],
            visitedBots: user.visitedBots || []
          },
          verified: !user.id.startsWith('guest_')
        }));
        return;
      }

      // 2. Каталог тарифов для обмена монет на VPN
      if (pathname === '/api/vpn/tariffs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          tariffs: Object.values(VPN_TARIFFS),
          userBalance: user.balance
        }));
        return;
      }

      // 3. Обмен заработанных монет на реальный ключ доступа к VPN
      if (pathname === '/api/vpn/exchange' && req.method === 'POST') {
        const tariffId = data.tariffId;
        const tariff = VPN_TARIFFS[tariffId];
        if (!tariff) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Тариф не найден' }));
          return;
        }

        if (user.balance < tariff.price) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: `Недостаточно золотых монет! Требуется: ${tariff.price.toLocaleString('ru-RU')} 🪙`
          }));
          return;
        }

        // Списываем баланс
        user.balance -= tariff.price;
        const codeSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
        const vpnCode = `LOSY-${tariff.days}D-${codeSuffix}`;

        const newVpnItem = {
          id: 'vpn_' + Date.now() + '_' + codeSuffix,
          tariffId: tariff.id,
          title: tariff.title,
          badge: tariff.badge,
          key: vpnCode,
          botUsername: tariff.botUsername,
          botUrl: `https://t.me/${tariff.botUsername}?start=${vpnCode}`,
          createdAt: Date.now(),
          expiresDays: tariff.days
        };

        if (!user.vpnKeys) user.vpnKeys = [];
        user.vpnKeys.unshift(newVpnItem);
        user.updatedAt = Date.now();
        saveDb();
        syncUserToSupabase(user);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          balance: user.balance,
          vpnItem: newVpnItem,
          vpnKeys: user.vpnKeys
        }));
        return;
      }

      // 4. Инвентарь игрока (скины ракет + полученные VPN ключи)
      if (pathname === '/api/user/inventory') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          ownedSkins: user.owned || ['pen'],
          vpnKeys: user.vpnKeys || [],
          balance: user.balance
        }));
        return;
      }

      // 5. API промокодов Telegram-бота
      if (pathname === '/api/bot/promo' && req.method === 'POST') {
        const PROMO_CODES = {
          'LOSY2026': { reward: 50000, desc: 'Приветственный бонус 50 000 золота' },
          'START': { reward: 25000, desc: 'Стартовый набор 25 000 золота' },
          'VPNWIN': { reward: 35000, desc: 'Бонус за интерес к VPN 35 000 золота' },
          'VIP': { reward: 77777, desc: 'VIP-бонус 77 777 золота' }
        };
        const userId = String(data.userId || authUser.id);
        const code = String(data.code || '').trim().toUpperCase();
        const promo = PROMO_CODES[code];
        
        if (!promo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Промокод не существует или срок действия истёк' }));
          return;
        }

        const targetUser = getOrCreateUser({ id: userId, username: data.username, first_name: data.firstName });
        if (!targetUser.promocodes) targetUser.promocodes = [];

        if (targetUser.promocodes.includes(code)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Вы уже активировали этот промокод ранее!' }));
          return;
        }

        targetUser.promocodes.push(code);
        targetUser.balance = (targetUser.balance || 0) + promo.reward;
        targetUser.updatedAt = Date.now();
        saveDb();
        syncUserToSupabase(targetUser);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          code: code,
          reward: promo.reward,
          desc: promo.desc,
          newBalance: targetUser.balance
        }));
        return;
      }

      if (pathname === '/api/bot/user') {
        const userId = String(parsedUrl.query.userId || data.userId || authUser.id);
        const targetUser = getOrCreateUser({ id: userId, username: data.username, first_name: data.firstName });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          user: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            username: targetUser.username,
            balance: targetUser.balance,
            ownedCount: targetUser.owned ? targetUser.owned.length : 0,
            promosUsed: targetUser.promocodes ? targetUser.promocodes.length : 0,
            vpnKeysCount: targetUser.vpnKeys ? targetUser.vpnKeys.length : 0,
            visitedBots: targetUser.visitedBots || [],
            visitedCount: targetUser.visitedBots ? targetUser.visitedBots.length : 0
          }
        }));
        return;
      }

      if (pathname === '/api/user/visit' && req.method === 'POST') {
        const botId = String(data.botId || '').trim().toLowerCase();
        const userId = String(data.userId || authUser.id);
        const targetUser = getOrCreateUser({ id: userId, username: data.username, first_name: data.firstName });
        if (!targetUser.visitedBots) targetUser.visitedBots = [];
        if (botId && !targetUser.visitedBots.includes(botId)) {
          targetUser.visitedBots.push(botId);
          targetUser.updatedAt = Date.now();
          saveDb();
          syncUserToSupabase(targetUser);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          visitedBots: targetUser.visitedBots,
          visitedCount: targetUser.visitedBots.length
        }));
        return;
      }

      if (pathname === '/api/shop/buy' && req.method === 'POST') {
        const skinId = data.skinId;
        const skin = SERVER_SKINS[skinId];
        if (!skin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Скин не найден' }));
          return;
        }

        if (user.balance < skin.price) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Недостаточно монет на сервере!' }));
          return;
        }

        user.balance -= skin.price;
        if (!user.owned.includes(skinId)) {
          user.owned.push(skinId);
        }
        saveDb();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          balance: user.balance,
          owned: user.owned,
          skin: skin
        }));
        return;
      }

      if (pathname === '/api/upgrade/spin' && req.method === 'POST') {
        const stakeId = data.stakeId;
        const targetId = data.targetId;

        const stakeSkin = SERVER_SKINS[stakeId];
        const targetSkin = SERVER_SKINS[targetId];

        if (!stakeSkin || !targetSkin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Некорректные скины' }));
          return;
        }

        if (stakeId !== 'pen') {
          const idx = user.owned.indexOf(stakeId);
          if (idx === -1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Скин ставки отсутствует в инвентаре' }));
            return;
          }
          user.owned.splice(idx, 1);
        }

        const chance = Math.min(0.75, (stakeSkin.value / targetSkin.value));
        const randomInt = crypto.randomInt(0, 1000000);
        const serverRoll = randomInt / 1000000;
        const willWin = serverRoll < chance;

        if (willWin) {
          user.owned.push(targetId);
        }
        saveDb();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          willWin: willWin,
          chance: chance,
          serverRoll: serverRoll,
          owned: user.owned,
          balance: user.balance
        }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    });
    return;
  }

  // Редирект-ссылка с трекингом: /r/:userId/:botId
  if (pathname.startsWith('/r/')) {
    const parts = pathname.split('/').filter(Boolean); // ['r', userId, botId]
    if (parts.length >= 3) {
      const targetUserId = parts[1];
      const botId = parts[2].toLowerCase();
      const targetUser = getOrCreateUser({ id: targetUserId });
      if (!targetUser.visitedBots) targetUser.visitedBots = [];
      if (botId && !targetUser.visitedBots.includes(botId)) {
        targetUser.visitedBots.push(botId);
        targetUser.updatedAt = Date.now();
        saveDb();
        syncUserToSupabase(targetUser);
      }
      res.writeHead(302, { 'Location': `https://t.me/${botId}?start=losy` });
      res.end();
      return;
    }
  }

  // СТАТИКА
  if (pathname === '/upgrade' || pathname === '/game' || pathname === '/play') {
    pathname = '/modes/losy-upgrade-v24.html';
  }
  if (!pathname || pathname === '/' || pathname === '') pathname = '/index.html';

  // СТРОГАЯ ЗАЩИТА: Блокировка доступа к исходному коду, базам данных и скрытым файлам
  const SENSITIVE_FILES = ['server_fast.js', 'server_db.json', 'bot.py', 'dockerfile', 'package.json', 'package-lock.json', '_headers', 'readme.txt'];
  const SENSITIVE_EXTS = ['.py', '.pyc', '.json', '.env', '.sh', '.sql', '.log', '.md', '.bak'];

  const normalizedLower = pathname.toLowerCase();
  const fileBaseName = path.basename(normalizedLower);
  const fileExt = path.extname(normalizedLower);

  if (
    pathname.includes('..') ||
    pathname.includes('/.') ||
    SENSITIVE_FILES.includes(fileBaseName) ||
    SENSITIVE_EXTS.includes(fileExt)
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  let filePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  // Проверяем директорию
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {}

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isMedia = ext === '.mp4' || ext === '.webm' || ext === '.mp3' || ext === '.ogg';

  // Для медиа (видео/аудио) — мгновенная отдача из RAM с поддержкой Range (HTTP 206)
  if (isMedia) {
    let mediaBuf = mediaCache.get(filePath);
    if (!mediaBuf) {
      try {
        if (fs.existsSync(filePath)) {
          mediaBuf = fs.readFileSync(filePath);
          if (mediaBuf.length < 20 * 1024 * 1024) { // кэшируем файлы до 20 МБ в RAM
            mediaCache.set(filePath, mediaBuf);
          }
        }
      } catch (e) {}
    }

    if (!mediaBuf) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const totalSize = mediaBuf.length;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Content-Type', contentType);

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      if (isNaN(start) || isNaN(end) || start > end || start >= totalSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }
      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize
      });
      res.end(mediaBuf.subarray(start, end + 1));
      return;
    }

    res.setHeader('Content-Length', totalSize);
    res.writeHead(200);
    res.end(mediaBuf);
    return;
  }

  // ДЛЯ ВСЕХ ОСТАЛЬНЫХ ФАЙЛОВ (HTML, JS, CSS, PNG, WEBP, FONTS) — МГНОВЕННЫЙ КЭШ + GZIP!
  const cached = getCachedFile(filePath);
  if (!cached) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  // Проверка ETag для мгновенного 304 Not Modified
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === cached.etag) {
    res.writeHead(304);
    res.end();
    return;
  }

  // Smart Caching Headers
  res.setHeader('ETag', cached.etag);
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (pathname.startsWith('/dist/') || (parsedUrl.search && parsedUrl.search.includes('v='))) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (ext === '.woff2' || ext === '.ttf') {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (ext === '.png' || ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg' || ext === '.ico') {
    res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
  res.setHeader('Content-Type', contentType);

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (cached.br && acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Content-Length', cached.br.length);
    res.writeHead(200);
    res.end(cached.br);
  } else if (cached.gzip && acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', cached.gzip.length);
    res.writeHead(200);
    res.end(cached.gzip);
  } else {
    res.setHeader('Content-Length', cached.raw.length);
    res.writeHead(200);
    res.end(cached.raw);
  }
});

// Pre-warm critical media & shell in RAM
try {
  const heroMp4 = path.join(ROOT_DIR, 'assets', 'hero', 'losy-hero-916.mp4');
  if (fs.existsSync(heroMp4)) {
    mediaCache.set(heroMp4, fs.readFileSync(heroMp4));
    console.log('⚡ [RAM PREWARM]: Hero MP4 loaded in memory (' + (mediaCache.get(heroMp4).length / 1024).toFixed(0) + ' KB)');
  }
  const prewarmList = [
    'index.html',
    'dist/app.bundle.js',
    'dist/shell.bundle.css',
    'js/balance-sync.js',
    'sw.js',
    'vendor/telegram-web-app.js',
    'assets/fonts/Unbounded-Variable.woff2',
    'assets/fonts/Inter-Variable.woff2',
    'assets/fonts/Oswald-Variable.woff2',
    'logo/losyvpn-logo.png',
    'assets/covers/bombs.webp',
    'assets/covers/rocket.webp',
    'assets/covers/upgrade.webp',
    'assets/hero/losy-hero-poster.webp',
    'assets/shop-icon.webp',
    'assets/track-ring-blue.webp',
    'assets/wheel-frame-blue.webp',
    'assets/bg-nebula.webp',
    'assets/coin.png',
    'assets/sounds/losy-ambient-soft-v71.mp3',
    'assets/result-card-bg.webp',
    'modes/losy-upgrade-v24.html',
    'modes/losy-rocket.html',
    'modes/losy-bombs.html'
  ];
  let prewarmedCount = 0;
  for (const rel of prewarmList) {
    const fPath = path.join(ROOT_DIR, rel);
    if (fs.existsSync(fPath)) {
      getCachedFile(fPath);
      prewarmedCount++;
    }
  }
  console.log(`⚡ [RAM PREWARM]: ${prewarmedCount} critical assets cached in memory`);
} catch (e) {
  console.error('Prewarm error:', e.message);
}

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [ACCELERATED SERVER RUNNING]: http://0.0.0.0:${PORT}`);
  console.log(`======================================================\n`);

  let publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

  if (!publicUrl) {
    try {
      console.log('📡 Подключение к HTTPS Tunnelmole...');
      publicUrl = await tunnelmole({ port: PORT });
    } catch (e) {
      console.error('Tunnel error:', e.message);
    }
  }

  if (publicUrl) {
    publicUrl = publicUrl.replace(/\/$/, '');
    console.log(`\n======================================================`);
    console.log(`📱 [PUBLIC TELEGRAM MINI APP URL]: ${publicUrl}`);
    console.log(`======================================================\n`);

    const info = `LOCAL: http://localhost:${PORT}\nPUBLIC: ${publicUrl}\n`;

    // Автоматически синхронизируем кнопку 'Играть' в Telegram боте (v=92 на Vercel)
    try {
      const https = require('https');
      const miniappUrl = process.env.MINIAPP_URL || 'https://losy-miniapp.vercel.app';
      const payload = JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🚀 Играть',
          web_app: { url: `${miniappUrl.replace(/\/$/, '')}/?v=92` }
        }
      });
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/setChatMenuButton`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (resp) => {
        let body = '';
        resp.on('data', c => body += c);
        resp.on('end', () => console.log('✅ [TELEGRAM BOT]: Chat Menu Button обновлена (v=88):', body));
      });
      req.on('error', (err) => console.error('[-] Telegram API error:', err.message));
      req.write(payload);
      req.end();
    } catch (btnErr) {
      console.error('Menu button update error:', btnErr.message);
    }
  }

  // Render Anti-Sleep Keep-Alive Heartbeat:
  // Пингует сервер каждые 8 минут, чтобы Render Free tier не засыпал и открывался моментально
  const keepAliveTarget = publicUrl || process.env.RENDER_EXTERNAL_URL || 'https://losy-miniapp.onrender.com';
  setInterval(() => {
    try {
      const pingUrl = new URL('/ping', keepAliveTarget);
      const reqMod = pingUrl.protocol === 'https:' ? require('https') : require('http');
      reqMod.get(pingUrl.href, (r) => {
        r.resume();
      }).on('error', () => {});
    } catch (_) {}
  }, 8 * 60 * 1000);

  // 4. Автоматический запуск Telegram-бота как фонового сервиса
  if (process.env.AUTOSTART_BOT !== 'false') {
    const { spawn } = require('child_process');
    let botProc = null;
    function launchTelegramBot() {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      console.log(`🤖 [BOT LAUNCHER]: Запуск Telegram-бота (${pythonCmd} bot.py)...`);
      try {
        botProc = spawn(pythonCmd, ['bot.py'], {
          cwd: ROOT_DIR,
          stdio: 'inherit',
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        botProc.on('exit', (code, signal) => {
          console.warn(`[!] Telegram-бот завершился (код: ${code}, сигнал: ${signal}). Перезапуск через 4 сек...`);
          setTimeout(launchTelegramBot, 4000);
        });

        botProc.on('error', (err) => {
          console.error('[-] Ошибка запуска bot.py:', err.message);
        });
      } catch (err) {
        console.error('[-] Исключение при запуске bot.py:', err.message);
      }
    }
    launchTelegramBot();
  }
});


