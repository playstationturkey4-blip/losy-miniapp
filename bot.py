# -*- coding: utf-8 -*-
"""
LOSY VPN & Mini App — Official Telegram Bot
Complete Rebuild:
- 342 Verified VPN Bots Directory with strict list adherence
- Full visit tracking: marked with "(Был тут) ✅" on catalog buttons
- User Profile showing visit counter and list of all visited bots
- Persistent ReplyKeyboardMarkup at the bottom (is_persistent=True)
- Registered Telegram Slash Commands (/start, /vpn, /profile, /app, /promo, /search, /random, /help)
- Promo code section formatted cleanly as "Скоро!"
- Modular image architecture ready for custom images
- Local + Cloud (Supabase) 2-tier database persistence
"""

import sys
import os
import io
import json
import math
import random
import urllib.request
import urllib.error

# UTF-8 stdout / stderr on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import telebot
from telebot import types

BOT_TOKEN = os.environ.get('BOT_TOKEN', '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM')
bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets', 'bot')
DB_FILE = os.path.join(BASE_DIR, 'server_db.json')
VPN_BOTS_FILE = os.path.join(BASE_DIR, 'vpn_bots.json')
SERVER_API_URL = os.environ.get("SERVER_API_URL", "http://127.0.0.1:8123")

# Изображения экранов (легко заменяются при отправке новых файлов)
IMAGES = {
    'welcome': os.path.join(ASSETS_DIR, 'welcome.jpg'),
    'vpn': os.path.join(ASSETS_DIR, 'vpn.jpg'),
    'profile': os.path.join(ASSETS_DIR, 'profile.jpg'),
    'promo': os.path.join(ASSETS_DIR, 'promo.jpg')
}

# -------------------------------------------------------------
# 1. ЗАГРУЗКА БАЗЫ 342 VPN-БОТОВ
# -------------------------------------------------------------
VPN_BOTS = []
VPN_MAP = {}

def load_vpn_bots():
    global VPN_BOTS, VPN_MAP
    try:
        if os.path.exists(VPN_BOTS_FILE):
            with open(VPN_BOTS_FILE, 'r', encoding='utf-8') as f:
                VPN_BOTS = json.load(f)
            VPN_MAP = {b['id']: b for b in VPN_BOTS}
            print(f"[+] Загружено {len(VPN_BOTS)} проверенных VPN-ботов из {VPN_BOTS_FILE}")
        else:
            print(f"[-] Файл {VPN_BOTS_FILE} не найден!")
    except Exception as err:
        print(f"[-] Ошибка загрузки {VPN_BOTS_FILE}: {err}")

load_vpn_bots()

ITEMS_PER_PAGE = 6

def get_app_url():
    """Возвращает актуальный URL Mini App"""
    if os.environ.get("RENDER_EXTERNAL_URL"):
        return os.environ.get("RENDER_EXTERNAL_URL").rstrip('/')
    if os.environ.get("APP_URL"):
        return os.environ.get("APP_URL").rstrip('/')
    return "https://losy-miniapp.onrender.com"

# -------------------------------------------------------------
# 2. БАЗА ДАННЫХ И ТРЕКИНГ ПОСЕЩЕНИЙ ("БЫЛ ТУТ")
# -------------------------------------------------------------
def get_user_data(user_id, username="", first_name=""):
    """
    Получает актуальные данные пользователя (баланс, посещенные боты)
    сначала с сервера /api/bot/user, либо напрямую из server_db.json
    """
    uid_str = str(user_id)

    # 1. Запрос к server_fast.js
    url = f"{SERVER_API_URL}/api/bot/user?userId={uid_str}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LosyBot/2.0'})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('ok') and data.get('user'):
                u = data['user']
                return {
                    'id': uid_str,
                    'firstName': u.get('firstName', first_name or "Игрок"),
                    'username': u.get('username', username or ""),
                    'balance': int(u.get('balance', 200000)),
                    'ownedCount': int(u.get('ownedCount', 1)),
                    'promosUsed': int(u.get('promosUsed', 0)),
                    'visitedBots': list(u.get('visitedBots', []))
                }
    except Exception:
        pass

    # 2. Локальное чтение server_db.json
    try:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)
                users = db.get('users', {})
                if uid_str in users:
                    u = users[uid_str]
                    return {
                        'id': uid_str,
                        'firstName': u.get('firstName', first_name or "Игрок"),
                        'username': u.get('username', username or ""),
                        'balance': int(u.get('balance', 200000)),
                        'ownedCount': len(u.get('owned', [])),
                        'promosUsed': len(u.get('promocodes', [])),
                        'visitedBots': list(u.get('visitedBots', []))
                    }
    except Exception:
        pass

    return {
        'id': uid_str,
        'firstName': first_name or "Игрок",
        'username': username or "",
        'balance': 200000,
        'ownedCount': 1,
        'promosUsed': 0,
        'visitedBots': []
    }

def record_bot_visit(user_id, bot_id, username="", first_name=""):
    """
    Фиксирует посещение VPN-бота пользователем:
    - Обновляет server_db.json
    - Отправляет POST на /api/user/visit (синхронизирует с Supabase)
    """
    uid_str = str(user_id)
    clean_bot_id = str(bot_id).strip().lower()

    # 1. Локальное немедленное сохранение в server_db.json
    try:
        db = {'users': {}}
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)

        if 'users' not in db:
            db['users'] = {}

        if uid_str not in db['users']:
            db['users'][uid_str] = {
                'id': uid_str,
                'username': username or '',
                'firstName': first_name or 'Игрок',
                'balance': 200000,
                'owned': ['pen'],
                'promocodes': [],
                'vpnKeys': [],
                'visitedBots': [],
                'updatedAt': 0
            }

        user_entry = db['users'][uid_str]
        if 'visitedBots' not in user_entry or not isinstance(user_entry['visitedBots'], list):
            user_entry['visitedBots'] = []

        if clean_bot_id and clean_bot_id not in user_entry['visitedBots']:
            user_entry['visitedBots'].append(clean_bot_id)
            user_entry['updatedAt'] = 0
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(db, f, indent=2, ensure_ascii=False)
    except Exception as err:
        print(f"[-] Ошибка локального сохранения визита: {err}")

    # 2. Асинхронный вызов к серверу для синхронизации с Supabase
    try:
        url = f"{SERVER_API_URL}/api/user/visit"
        payload = json.dumps({
            'userId': uid_str,
            'botId': clean_bot_id,
            'username': username or "",
            'firstName': first_name or ""
        }).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json', 'User-Agent': 'LosyBot/2.0'}
        )
        urllib.request.urlopen(req, timeout=1.5)
    except Exception:
        pass

# -------------------------------------------------------------
# 3. ФИЛЬТРАЦИЯ И ПОИСК БОТОВ
# -------------------------------------------------------------
def filter_bots(filter_mode='all', query=None, visited_list=None):
    """
    Фильтрует ботов по режиму:
    - 'all': все 342 бота
    - 'visited': только те, где пользователь был
    - 'unvisited': только новые
    - query: поиск по тексту названия или юзернейма
    """
    items = VPN_BOTS
    visited_set = set(v.lower() for v in (visited_list or []))

    if filter_mode == 'visited':
        items = [b for b in items if b['id'] in visited_set]
    elif filter_mode == 'unvisited':
        items = [b for b in items if b['id'] not in visited_set]

    if query:
        q = query.strip().lower()
        items = [b for b in items if q in b['name'].lower() or q in b['username'].lower()]

    return items

# -------------------------------------------------------------
# 4. КЛАВИАТУРЫ И ИНТЕРФЕЙС
# -------------------------------------------------------------
def get_main_reply_keyboard():
    """
    Постоянное закрепленное нижнее меню (is_persistent=True)
    """
    app_url = get_app_url()
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, is_persistent=True)
    btn_app = types.KeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.KeyboardButton(f"🛡️ Список VPN ({len(VPN_BOTS)})")
    btn_profile = types.KeyboardButton("👤 Мой профиль")
    btn_promo = types.KeyboardButton("🎁 Промокод")
    btn_search = types.KeyboardButton("🔍 Поиск VPN")

    markup.row(btn_app)
    markup.row(btn_vpn, btn_profile)
    markup.row(btn_promo, btn_search)
    return markup

def get_main_inline_keyboard():
    """Инлайн-кнопки под приветственным сообщением"""
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton("🚀 Запустить Mini App (Игры & Баланс)", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.InlineKeyboardButton(f"🛡️ Список VPN ({len(VPN_BOTS)} проверенных ботов)", callback_data="vpn_p:0:all")
    btn_profile = types.InlineKeyboardButton("👤 Мой профиль (посещенные боты)", callback_data="menu_profile")
    btn_promo = types.InlineKeyboardButton("🎁 Промокод (Скоро)", callback_data="menu_promo")
    btn_rnd = types.InlineKeyboardButton("🎲 Случайный VPN", callback_data="vpn_rnd")
    markup.add(btn_app, btn_vpn, btn_profile, btn_promo, btn_rnd)
    return markup

def build_vpn_keyboard(user_visited, page=0, filter_mode='all', query=None):
    """
    Формирует интерактивную клавиатуру каталога VPN:
    - Кнопки ботов с отметкой «(Был тут) ✅» или обычные
    - Нажатие на кнопку бота открывает карточку и фиксирует визит
    - Удобная пагинация и фильтры: [Все] [Был тут] [Новые]
    """
    visited_set = set(v.lower() for v in user_visited)
    items = filter_bots(filter_mode=filter_mode, query=query, visited_list=user_visited)
    total_items = len(items)
    total_pages = max(1, math.ceil(total_items / ITEMS_PER_PAGE))
    page = max(0, min(page, total_pages - 1))

    start_idx = page * ITEMS_PER_PAGE
    page_bots = items[start_idx : start_idx + ITEMS_PER_PAGE]

    markup = types.InlineKeyboardMarkup()

    # Фильтры вверху списка (если нет активного текстового поиска)
    if not query:
        visited_count = len([b for b in VPN_BOTS if b['id'] in visited_set])
        new_count = len(VPN_BOTS) - visited_count

        f_all_text = f"• Все ({len(VPN_BOTS)}) •" if filter_mode == 'all' else f"Все ({len(VPN_BOTS)})"
        f_vis_text = f"• Был тут ({visited_count}) •" if filter_mode == 'visited' else f"Был тут ({visited_count})"
        f_new_text = f"• Новые ({new_count}) •" if filter_mode == 'unvisited' else f"Новые ({new_count})"

        markup.row(
            types.InlineKeyboardButton(f_all_text, callback_data="vpn_f:all"),
            types.InlineKeyboardButton(f_vis_text, callback_data="vpn_f:visited"),
            types.InlineKeyboardButton(f_new_text, callback_data="vpn_f:unvisited")
        )

    # Кнопки ботов на текущей странице
    for b in page_bots:
        is_visited = b['id'] in visited_set
        if is_visited:
            btn_title = f"{b['name']} (Был тут) ✅"
        else:
            btn_title = f"⚡ {b['name']}"

        # Callback открывает детальную карточку бота и отмечает его как посещенный
        cb_data = f"v_open:{b['id']}:{page}:{filter_mode}"
        markup.row(types.InlineKeyboardButton(text=btn_title, callback_data=cb_data))

    # Пагинационная строка
    q_encoded = f":{query[:15]}" if query else ""
    nav_row = []

    if page > 0:
        nav_row.append(types.InlineKeyboardButton("◀️ Пред.", callback_data=f"vpn_p:{page-1}:{filter_mode}{q_encoded}"))
    else:
        nav_row.append(types.InlineKeyboardButton("⏺️", callback_data="noop"))

    nav_row.append(types.InlineKeyboardButton(f"📄 {page + 1} / {total_pages}", callback_data="noop"))

    if page < total_pages - 1:
        nav_row.append(types.InlineKeyboardButton("След. ▶️", callback_data=f"vpn_p:{page+1}:{filter_mode}{q_encoded}"))
    else:
        nav_row.append(types.InlineKeyboardButton("⏺️", callback_data="noop"))

    markup.row(*nav_row)

    # Строка быстрых прыжков (если страниц много)
    if total_pages > 3:
        jump_row = []
        if page >= 3:
            jump_row.append(types.InlineKeyboardButton("⏪ -3", callback_data=f"vpn_p:{page-3}:{filter_mode}{q_encoded}"))
        jump_row.append(types.InlineKeyboardButton("🔍 Поиск", callback_data="vpn_search"))
        if page + 3 < total_pages:
            jump_row.append(types.InlineKeyboardButton("+3 ⏩", callback_data=f"vpn_p:{page+3}:{filter_mode}{q_encoded}"))
        if jump_row:
            markup.row(*jump_row)

    # Кнопка сброса поиска, если был запрос
    if query:
        markup.row(types.InlineKeyboardButton(f"❌ Сбросить поиск ({len(VPN_BOTS)} ботов)", callback_data="vpn_p:0:all"))

    # Сервисные кнопки
    markup.row(
        types.InlineKeyboardButton("🎲 Случайный VPN", callback_data="vpn_rnd"),
        types.InlineKeyboardButton("👤 Мой профиль", callback_data="menu_profile")
    )
    markup.row(types.InlineKeyboardButton("« В главное меню", callback_data="menu_home"))

    return markup

def build_vpn_detail_keyboard(bot_item, return_page=0, filter_mode='all'):
    """
    Клавиатура карточки выбранного VPN-бота:
    - Прямой переход в бота в Telegram
    - Кнопка возврата к списку
    - Кнопка перехода в профиль
    """
    markup = types.InlineKeyboardMarkup(row_width=1)
    direct_url = f"https://t.me/{bot_item['username']}?start=losy"
    btn_open = types.InlineKeyboardButton(f"🚀 Открыть @{bot_item['username']}", url=direct_url)
    btn_back = types.InlineKeyboardButton(f"◀️ Назад к списку (Стр. {return_page + 1})", callback_data=f"vpn_p:{return_page}:{filter_mode}")
    btn_profile = types.InlineKeyboardButton("👤 Мой профиль", callback_data="menu_profile")
    markup.add(btn_open, btn_back, btn_profile)
    return markup

def get_profile_keyboard():
    """Клавиатура раздела «Мой профиль»"""
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton("🎮 Открыть Mini App (Игры)", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.InlineKeyboardButton(f"🛡️ Каталог VPN ({len(VPN_BOTS)})", callback_data="vpn_p:0:all")
    btn_visited = types.InlineKeyboardButton("✅ Показать ботов «Был тут»", callback_data="vpn_f:visited")
    btn_home = types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    markup.add(btn_app, btn_vpn, btn_visited, btn_home)
    return markup

def get_promo_keyboard():
    """Клавиатура раздела промокодов (заглушка «Скоро»)"""
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.InlineKeyboardButton(f"🛡️ Каталог VPN ({len(VPN_BOTS)} ботов)", callback_data="vpn_p:0:all")
    btn_home = types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    markup.add(btn_app, btn_vpn, btn_home)
    return markup

def get_random_bot_keyboard(rand_bot):
    """Клавиатура для случайного бота"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    direct_url = f"https://t.me/{rand_bot['username']}?start=losy"
    btn_open = types.InlineKeyboardButton(f"⚡ Открыть @{rand_bot['username']}", url=direct_url)
    btn_next = types.InlineKeyboardButton("🎲 Другой случайный VPN", callback_data="vpn_rnd")
    btn_cat = types.InlineKeyboardButton(f"🛡️ Весь каталог ({len(VPN_BOTS)})", callback_data="vpn_p:0:all")
    btn_home = types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    markup.add(btn_open, btn_next, btn_cat, btn_home)
    return markup

# -------------------------------------------------------------
# 5. ТЕКСТЫ И ПРЕДСТАВЛЕНИЯ
# -------------------------------------------------------------
def get_welcome_text(name):
    return (
        f"🌌 <b>Добро пожаловать в LOSY VPN, {name}!</b>\n\n"
        f"⚡ <b>LOSY</b> — ваш единый центр свободы интернета и интерактивных WebApp игр.\n\n"
        f"🚀 <b>Разделы сервиса:</b>\n"
        f"• <b>Каталог VPN</b> — строго <b>{len(VPN_BOTS)} проверенных ботов</b> без блокировок. "
        f"Нажимайте на нужного бота — он автоматически отметится как <i>«(Был тут) ✅»</i>!\n"
        f"• <b>Мой профиль</b> — отслеживание всех сервисов, в которые вы уже заходили, и ваш баланс.\n"
        f"• <b>Mini App</b> — игры «Ракета», «Бомбы» 5x5 и «CS:GO Апгрейд» с обменом монет на реальные ключи.\n"
        f"• <b>Промокод</b> — эксклюзивные промокоды (скоро открытие).\n\n"
        f"👇 <i>Выберите раздел в меню ниже:</i>"
    )

def get_vpn_catalog_text(user_visited, page=0, filter_mode='all', query=None):
    visited_set = set(v.lower() for v in user_visited)
    items = filter_bots(filter_mode=filter_mode, query=query, visited_list=user_visited)
    total_items = len(items)
    total_pages = max(1, math.ceil(total_items / ITEMS_PER_PAGE))
    visited_count = len([b for b in VPN_BOTS if b['id'] in visited_set])

    if query:
        return (
            f"🔍 <b>Поиск по каталогу: «{query}»</b>\n\n"
            f"⚡ Найдено: <b>{total_items}</b> сервисов\n"
            f"📄 Страница: <b>{page + 1}</b> из <b>{total_pages}</b>\n\n"
            f"👇 <i>Нажмите на кнопку бота, чтобы открыть его:</i>"
        )

    mode_title = "Все сервисы"
    if filter_mode == 'visited':
        mode_title = "Посещённые боты"
    elif filter_mode == 'unvisited':
        mode_title = "Новые сервисы"

    return (
        f"🛡️ <b>Каталог проверенных VPN-ботов</b>\n\n"
        f"🌐 Режим: <b>{mode_title}</b> ({total_items} ботов)\n"
        f"📊 Ваш прогресс: <b>{visited_count}</b> из <b>{len(VPN_BOTS)}</b> посещено\n"
        f"📄 Страница: <b>{page + 1}</b> из <b>{total_pages}</b>\n\n"
        f"💡 <i>Нажмите на любого бота ниже. Он отметится как <b>«(Был тут) ✅»</b> и откроет прямую ссылку!</i>"
    )

def get_vpn_detail_text(bot_item, is_visited=True):
    status_str = "✅ <b>Вы уже заходили сюда (Был тут)</b>" if is_visited else "⏳ <b>Вы ещё не открывали этого бота</b>"
    return (
        f"🛡️ <b>{bot_item['name']}</b>\n\n"
        f"🌐 <b>Юзернейм:</b> @{bot_item['username']}\n"
        f"📍 <b>Статус:</b> {status_str}\n"
        f"⚡ <b>Протоколы:</b> VLESS Reality / Shadowsocks / WireGuard\n\n"
        f"👇 <i>Нажмите кнопку ниже, чтобы запустить бота и подключить VPN:</i>"
    )

def get_profile_text(user):
    balance_str = f"{user.get('balance', 200000):,}".replace(",", " ")
    visited_ids = user.get('visitedBots', [])
    visited_count = len(visited_ids)

    # Сопоставляем ID с названиями ботов
    visited_details = []
    for vid in visited_ids:
        b = VPN_MAP.get(vid.lower())
        if b:
            visited_details.append(f"• <b>{b['name']}</b> (@{b['username']})")

    lines = [
        f"👤 <b>Мой профиль:</b>\n",
        f"🆔 <b>Telegram ID:</b> <code>{user.get('id')}</code>",
        f"🏷️ <b>Имя:</b> {user.get('firstName', 'Игрок')}",
        f"💰 <b>Баланс монет:</b> <b>{balance_str}</b> 🪙",
        f"🎒 <b>Предметов в инвентаре:</b> {user.get('ownedCount', 1)}\n",
        f"📊 <b>Посещено VPN-ботов:</b> <b>{visited_count}</b> из <b>{len(VPN_BOTS)}</b>"
    ]

    if visited_details:
        lines.append(f"\n📜 <b>Боты, в которые вы уже заходили:</b>")
        # Показываем до 12 последних ботов
        max_show = 12
        for item in visited_details[:max_show]:
            lines.append(item)
        if len(visited_details) > max_show:
            lines.append(f"<i>...и ещё {len(visited_details) - max_show} сервисов</i>")
    else:
        lines.append(
            f"\nℹ️ <i>Вы пока не заходили ни в один VPN-бот из каталога. "
            f"Откройте «Список VPN» и протестируйте сервисы!</i>"
        )

    lines.append(f"\n⚡ <i>Баланс полностью синхронизирован с играми Mini App!</i>")
    return "\n".join(lines)

def get_promo_text():
    return (
        "🎁 <b>Раздел «Промокод»:</b>\n\n"
        "⏳ <b>Раздел находится в разработке (Скоро!)</b>\n\n"
        "Здесь появится ввод секретных промокодов на бесплатное золото, "
        "скины ракет и подарочные VIP-ключи для VPN.\n\n"
        "🎮 <i>Пока вы можете копить монеты в Mini App и тестировать ботов из каталога!</i>"
    )

def get_random_bot_text(rand_bot):
    return (
        f"🎲 <b>Случайная рекомендация VPN:</b>\n\n"
        f"🛡️ <b>{rand_bot['name']}</b>\n"
        f"🌐 Юзернейм: @{rand_bot['username']}\n"
        f"⚡ <i>Проверен, быстрый отклик и чистые серверы.</i>\n\n"
        f"👇 <i>Нажмите кнопку ниже для запуска бота:</i>"
    )

def get_help_text():
    return (
        "ℹ️ <b>О проекте LOSY:</b>\n\n"
        f"• <b>Каталог VPN:</b> {len(VPN_BOTS)} проверенных сервисов с отслеживанием посещений;\n"
        "• <b>Mini App:</b> игры «Ракета», «Бомбы» 5x5 и «CS:GO Апгрейд» с реальным обменом на VPN;\n"
        "• <b>Профиль:</b> единая синхронизация прогресса и монет в облаке.\n\n"
        "🔒 <i>Быстро, безопасно и без блокировок.</i>"
    )

# -------------------------------------------------------------
# 6. УТИЛИТА ОТПРАВКИ И ОБНОВЛЕНИЯ СООБЩЕНИЙ
# -------------------------------------------------------------
def send_or_edit_screen(chat_id, img_key, caption, markup, call=None):
    """
    Универсальная отправка экрана:
    - Если передан call, пробует отредактировать сообщение
    - Если есть картинка, отправляет / редактирует фото
    - Если картинки нет или ошибка — отправляет чистый текст
    """
    img_path = IMAGES.get(img_key)
    has_photo = img_path and os.path.exists(img_path)

    if call and call.message:
        msg = call.message
        # Если текущее сообщение — фото, пробуем обновить подпись
        if msg.content_type == 'photo':
            try:
                bot.edit_message_caption(
                    caption=caption,
                    chat_id=chat_id,
                    message_id=msg.message_id,
                    reply_markup=markup
                )
                return
            except Exception:
                pass
        else:
            try:
                bot.edit_message_text(
                    caption,
                    chat_id=chat_id,
                    message_id=msg.message_id,
                    reply_markup=markup
                )
                return
            except Exception:
                pass

    # Отправка нового сообщения
    if has_photo:
        try:
            with open(img_path, 'rb') as photo:
                bot.send_photo(chat_id, photo=photo, caption=caption, reply_markup=markup)
                return
        except Exception as e:
            print(f"[-] Ошибка отправки фото {img_key}: {e}")

    bot.send_message(chat_id, caption, reply_markup=markup)

# -------------------------------------------------------------
# 7. ОБРАБОТЧИКИ СЛЭШ-КОМАНД (SLASH COMMANDS)
# -------------------------------------------------------------
@bot.message_handler(commands=['start'])
def handle_start(message):
    name = message.from_user.first_name or "друг"
    caption = get_welcome_text(name)
    inline_kb = get_main_inline_keyboard()
    reply_kb = get_main_reply_keyboard()

    send_or_edit_screen(message.chat.id, 'welcome', caption, inline_kb)
    bot.send_message(
        message.chat.id,
        "⚡ <i>Меню быстрого доступа закреплено внизу экрана.</i>",
        reply_markup=reply_kb
    )

@bot.message_handler(commands=['menu'])
def handle_menu(message):
    handle_start(message)

@bot.message_handler(commands=['vpn'])
def handle_vpn_command(message):
    user = get_user_data(message.from_user.id, message.from_user.username, message.from_user.first_name)
    caption = get_vpn_catalog_text(user['visitedBots'], page=0, filter_mode='all')
    kb = build_vpn_keyboard(user['visitedBots'], page=0, filter_mode='all')
    send_or_edit_screen(message.chat.id, 'vpn', caption, kb)

@bot.message_handler(commands=['profile'])
def handle_profile_command(message):
    user = get_user_data(message.from_user.id, message.from_user.username, message.from_user.first_name)
    caption = get_profile_text(user)
    kb = get_profile_keyboard()
    send_or_edit_screen(message.chat.id, 'profile', caption, kb)

@bot.message_handler(commands=['app'])
def handle_app_command(message):
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    markup.add(
        types.InlineKeyboardButton("🚀 Открыть Mini App (Игры)", web_app=types.WebAppInfo(url=app_url)),
        types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    )
    bot.send_message(
        message.chat.id,
        "🎮 <b>Игры и экономика LOSY VPN в Telegram:</b>\n\n"
        "• Ракета (Crash) с моментальной отдачей;\n"
        "• Алмазы 5x5 с WebAudio звуками;\n"
        "• Апгрейд рулетка с реалистичной анимацией дезинтеграции!\n\n"
        "👇 <i>Нажмите кнопку ниже для запуска:</i>",
        reply_markup=markup
    )

@bot.message_handler(commands=['promo'])
def handle_promo_command(message):
    caption = get_promo_text()
    kb = get_promo_keyboard()
    send_or_edit_screen(message.chat.id, 'promo', caption, kb)

@bot.message_handler(commands=['search'])
def handle_search_command(message):
    parts = message.text.split(maxsplit=1)
    if len(parts) > 1:
        query = parts[1].strip()
        do_search(message.chat.id, message.from_user.id, query)
    else:
        msg = bot.send_message(
            message.chat.id,
            "🔍 <b>Поиск по каталогу 342 VPN:</b>\n\n"
            "Введите название бота или юзернейм (например: <code>Hit</code>, <code>Capy</code>, <code>Free</code>, <code>Speed</code>):\n\n"
            "<i>Отправьте «Отмена» для возврата.</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_search)

@bot.message_handler(commands=['random'])
def handle_random_command(message):
    rand_bot = random.choice(VPN_BOTS)
    record_bot_visit(message.from_user.id, rand_bot['id'], message.from_user.username, message.from_user.first_name)
    caption = get_random_bot_text(rand_bot)
    kb = get_random_bot_keyboard(rand_bot)
    bot.send_message(message.chat.id, caption, reply_markup=kb)

@bot.message_handler(commands=['help'])
def handle_help_command(message):
    bot.send_message(message.chat.id, get_help_text(), reply_markup=get_main_inline_keyboard())

# -------------------------------------------------------------
# 8. ОБРАБОТЧИКИ ТЕКСТОВЫХ REPLY КНОПОК
# -------------------------------------------------------------
@bot.message_handler(func=lambda msg: True)
def handle_text_messages(message):
    text = (message.text or "").strip()

    if text.startswith("🛡️ Список VPN") or text in ["Список VPN", "VPN", "vpn"]:
        handle_vpn_command(message)
    elif text in ["👤 Мой профиль", "Профиль", "профиль", "/myprofile"]:
        handle_profile_command(message)
    elif text in ["🎁 Промокод", "🎁 Промокод (Скоро)", "Промокод", "промокод"]:
        handle_promo_command(message)
    elif text in ["🔍 Поиск VPN", "Поиск VPN", "Поиск", "search"]:
        handle_search_command(message)
    elif text in ["🎲 Случайный VPN", "Случайный VPN", "random"]:
        handle_random_command(message)
    elif text in ["🚀 Запустить Mini App", "Mini App", "Игры"]:
        handle_app_command(message)
    elif text in ["ℹ️ О сервисе", "Помощь", "help"]:
        handle_help_command(message)
    else:
        bot.send_message(
            message.chat.id,
            "👋 Используйте кнопки постоянного меню ниже или команду /start для навигации.",
            reply_markup=get_main_reply_keyboard()
        )

# -------------------------------------------------------------
# 9. ОБРАБОТЧИКИ CALLBACK QUERY
# -------------------------------------------------------------
@bot.callback_query_handler(func=lambda call: True)
def handle_callbacks(call):
    data = call.data
    chat_id = call.message.chat.id
    user_id = call.from_user.id
    username = call.from_user.username or ""
    first_name = call.from_user.first_name or ""

    try:
        bot.answer_callback_query(call.id)
    except Exception:
        pass

    if data == "noop":
        return

    # 1. Главное меню
    if data == "menu_home":
        caption = get_welcome_text(first_name or "друг")
        send_or_edit_screen(chat_id, 'welcome', caption, get_main_inline_keyboard(), call=call)

    # 2. Переход к VPN каталогу: "vpn_p:<page>:<filter>" или "vpn_p:<page>:<filter>:<query>"
    elif data.startswith("vpn_p:"):
        parts = data.split(":")
        page = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        filter_mode = parts[2] if len(parts) > 2 else 'all'
        query = parts[3] if len(parts) > 3 and parts[3] else None

        user = get_user_data(user_id, username, first_name)
        caption = get_vpn_catalog_text(user['visitedBots'], page=page, filter_mode=filter_mode, query=query)
        kb = build_vpn_keyboard(user['visitedBots'], page=page, filter_mode=filter_mode, query=query)
        send_or_edit_screen(chat_id, 'vpn', caption, kb, call=call)

    # 3. Переключение фильтра: "vpn_f:<mode>"
    elif data.startswith("vpn_f:"):
        filter_mode = data.split(":")[1]
        user = get_user_data(user_id, username, first_name)
        caption = get_vpn_catalog_text(user['visitedBots'], page=0, filter_mode=filter_mode)
        kb = build_vpn_keyboard(user['visitedBots'], page=0, filter_mode=filter_mode)
        send_or_edit_screen(chat_id, 'vpn', caption, kb, call=call)

    # 4. Нажатие на бота в списке: "v_open:<bot_id>:<page>:<filter>"
    elif data.startswith("v_open:"):
        parts = data.split(":")
        bot_id = parts[1]
        page = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
        filter_mode = parts[3] if len(parts) > 3 else 'all'

        # ФИКСИРУЕМ ПОСЕЩЕНИЕ
        record_bot_visit(user_id, bot_id, username, first_name)

        bot_item = VPN_MAP.get(bot_id.lower())
        if not bot_item:
            bot.send_message(chat_id, "⚠️ Бот не найден в базе данных.")
            return

        caption = get_vpn_detail_text(bot_item, is_visited=True)
        kb = build_vpn_detail_keyboard(bot_item, return_page=page, filter_mode=filter_mode)
        send_or_edit_screen(chat_id, 'vpn', caption, kb, call=call)

    # 5. Мой профиль
    elif data == "menu_profile":
        user = get_user_data(user_id, username, first_name)
        caption = get_profile_text(user)
        kb = get_profile_keyboard()
        send_or_edit_screen(chat_id, 'profile', caption, kb, call=call)

    # 6. Промокоды (Скоро)
    elif data == "menu_promo":
        caption = get_promo_text()
        kb = get_promo_keyboard()
        send_or_edit_screen(chat_id, 'promo', caption, kb, call=call)

    # 7. Случайный VPN
    elif data == "vpn_rnd":
        rand_bot = random.choice(VPN_BOTS)
        record_bot_visit(user_id, rand_bot['id'], username, first_name)
        caption = get_random_bot_text(rand_bot)
        kb = get_random_bot_keyboard(rand_bot)
        send_or_edit_screen(chat_id, 'vpn', caption, kb, call=call)

    # 8. Запуск поиска
    elif data == "vpn_search":
        msg = bot.send_message(
            chat_id,
            "🔍 <b>Поиск по каталогу 342 VPN:</b>\n\n"
            "Введите название или юзернейм бота:\n\n"
            "<i>Отправьте «Отмена» для возврата.</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_search)

# -------------------------------------------------------------
# 10. ШАГИ ПОИСКА
# -------------------------------------------------------------
def step_receive_search(message):
    query = (message.text or "").strip()
    if query.lower() in ["отмена", "cancel", "/cancel", "назад"]:
        bot.send_message(message.chat.id, "❌ Поиск отменен.", reply_markup=get_main_reply_keyboard())
        return
    do_search(message.chat.id, message.from_user.id, query)

def do_search(chat_id, user_id, query):
    user = get_user_data(user_id)
    results = filter_bots(filter_mode='all', query=query, visited_list=user['visitedBots'])

    if not results:
        text = (
            f"🔍 По запросу «<b>{query}</b>» ничего не найдено.\n\n"
            f"💡 Попробуйте другое слово или откройте полный каталог ({len(VPN_BOTS)} ботов)."
        )
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(
            types.InlineKeyboardButton("🔍 Попробовать снова", callback_data="vpn_search"),
            types.InlineKeyboardButton(f"🛡️ Открыть полный каталог ({len(VPN_BOTS)})", callback_data="vpn_p:0:all"),
            types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
        )
        bot.send_message(chat_id, text, reply_markup=markup)
        return

    caption = get_vpn_catalog_text(user['visitedBots'], page=0, query=query)
    kb = build_vpn_keyboard(user['visitedBots'], page=0, query=query)
    send_or_edit_screen(chat_id, 'vpn', caption, kb)

# -------------------------------------------------------------
# 11. РЕГИСТРАЦИЯ СЛЭШ-КОМАНД И WEBAPP МЕНЮ
# -------------------------------------------------------------
def setup_bot_meta():
    """
    Регистрирует команды бота и привязывает кнопку WebApp Меню
    """
    try:
        app_url = get_app_url()
        # 1. Привязка системной кнопки Mini App в поле ввода Telegram
        bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                type="web_app",
                text="🚀 Играть",
                web_app=types.WebAppInfo(url=app_url)
            )
        )
        print(f"[+] Chat Menu Button привязана к WebApp: {app_url}")

        # 2. Регистрация слэш-команд меню в Telegram
        commands = [
            types.BotCommand("start", "🌌 Главное меню"),
            types.BotCommand("vpn", f"🛡️ Каталог {len(VPN_BOTS)} проверенных VPN"),
            types.BotCommand("profile", "👤 Мой профиль и посещенные боты"),
            types.BotCommand("app", "🚀 Запустить Mini App"),
            types.BotCommand("promo", "🎁 Промокод (Скоро)"),
            types.BotCommand("search", "🔍 Быстрый поиск VPN"),
            types.BotCommand("random", "🎲 Случайный VPN"),
            types.BotCommand("help", "ℹ️ Информация о сервисе LOSY")
        ]
        bot.set_my_commands(commands)
        print(f"[+] {len(commands)} Bot Commands (слэшей) успешно зарегистрированы в Telegram")
    except Exception as e:
        print("[-] Meta setup warning:", e)

if __name__ == '__main__':
    try:
        me = bot.get_me()
        print(f"\n=======================================================")
        print(f"🤖 [LOSY TELEGRAM BOT STARTED]: @{me.username} (ID: {me.id})")
        print(f"📦 [VPN DIRECTORY]: {len(VPN_BOTS)} ботов загружено")
        print(f"=======================================================\n")
    except Exception as e:
        print("[!] Bot auth warning:", e)

    setup_bot_meta()
    print("[*] Polling Telegram updates...")
    try:
        bot.infinity_polling(timeout=20, long_polling_timeout=20, skip_pending=True)
    except telebot.apihelper.ApiTelegramException as api_err:
        if api_err.error_code == 409:
            print(f"\n[ℹ️ TELEGRAM CONFLICT (409)]:")
            print(f"Экземпляр бота уже успешно запущен в облаке (на Render) и обрабатывает сообщения пользователей.")
            print(f"Локальный опрос остановлен во избежание конфликта. Бот активен и доступен в Telegram!\n")
        else:
            print(f"[-] Telegram API error ({api_err.error_code}): {api_err}")
    except KeyboardInterrupt:
        print("\n[!] Бот остановлен пользователем.")
    except Exception as e:
        print(f"[-] Ошибка polling: {e}")
