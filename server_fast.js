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

const BOT_TOKEN = '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM';
const PORT = 8123;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'server_db.json');

// 1. База данных профилей (Server-Authoritative)
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

function getOrCreateUser(userData) {
  const tid = String(userData.id);
  if (!db.users[tid]) {
    db.users[tid] = {
      id: tid,
      username: userData.username || '',
      firstName: userData.first_name || 'Игрок',
      balance: 1000,
      spaceCoins: 100,
      owned: ['pen'],
      updatedAt: Date.now()
    };
    saveDb();
  } else {
    if (userData.username) db.users[tid].username = userData.username;
    if (userData.first_name) db.users[tid].firstName = userData.first_name;
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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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

      const initData = req.headers['x-telegram-init-data'] || data.initData;
      let authUser = verifyTelegramWebAppData(initData);
      
      if (!authUser) {
        authUser = { id: 'guest_local', first_name: 'Игрок (Demo)' };
      }

      const user = getOrCreateUser(authUser);

      if (pathname === '/api/user/sync') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            spaceCoins: user.spaceCoins,
            owned: user.owned
          },
          verified: !user.id.startsWith('guest_')
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

  // СТАТИКА
  if (pathname === '/upgrade' || pathname === '/game' || pathname === '/play') {
    pathname = '/modes/losy-upgrade-v24.html';
  }
  if (pathname === '/') pathname = '/index.html';

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
    'assets/space-coin.png',
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

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [ACCELERATED SERVER RUNNING]: http://localhost:${PORT}`);
  console.log(`======================================================\n`);

  try {
    console.log('📡 Подключение к HTTPS Tunnelmole...');
    const tmoleUrl = await tunnelmole({ port: PORT });
    console.log(`\n======================================================`);
    console.log(`📱 [PUBLIC TELEGRAM MINI APP URL]: ${tmoleUrl}`);
    console.log(`======================================================\n`);

    const info = `LOCAL: http://localhost:${PORT}\nPUBLIC: ${tmoleUrl}\n`;
    fs.writeFileSync(path.join(ROOT_DIR, 'current-urls.txt'), info, 'utf8');

    // Автоматически синхронизируем кнопку 'Играть' в Telegram боте
    try {
      const https = require('https');
      const payload = JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🚀 Играть',
          web_app: { url: tmoleUrl }
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
        resp.on('end', () => console.log('✅ [TELEGRAM BOT]: Chat Menu Button обновлена:', body));
      });
      req.on('error', (err) => console.error('[-] Telegram API error:', err.message));
      req.write(payload);
      req.end();
    } catch (btnErr) {
      console.error('Menu button update error:', btnErr.message);
    }
  } catch (e) {
    console.error('Tunnel error:', e.message);
  }
});

