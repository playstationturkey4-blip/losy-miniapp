# -*- coding: utf-8 -*-
"""
LOSY VPN & Mini App — Official Telegram Bot
High-tech, modern Telegram bot featuring:
- 401 VPN Bots Directory with 1-tap interactive direct buttons
- Dynamic 2-column & responsive pagination (51 pages)
- Instant Search by name / username (/search <query>)
- Random VPN recommendation picker (/random)
- Server-authoritative Promo Code activation & Real-time balance sync
- Cyberpunk visual banners (welcome, vpn, promo)
- Persistent reply keyboards + interactive inline menus
- Telegram WebApp Menu Button integration
"""

import sys
import os
import io
import json
import math
import random
import urllib.request
import urllib.error

# Ensure UTF-8 stdout on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import telebot
from telebot import types

BOT_TOKEN = '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM'
bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets', 'bot')
DB_FILE = os.path.join(BASE_DIR, 'server_db.json')
VPN_BOTS_FILE = os.path.join(BASE_DIR, 'vpn_bots.json')
SERVER_API_URL = os.environ.get("SERVER_API_URL", "http://127.0.0.1:8123")

IMG_WELCOME = os.path.join(ASSETS_DIR, 'welcome.jpg')
IMG_VPN = os.path.join(ASSETS_DIR, 'vpn.jpg')
IMG_PROMO = os.path.join(ASSETS_DIR, 'promo.jpg')

# -------------------------------------------------------------
# 1. ЗАГРУЗКА БАЗЫ 401 VPN БОТА
# -------------------------------------------------------------
VPN_BOTS = []
try:
    if os.path.exists(VPN_BOTS_FILE):
        with open(VPN_BOTS_FILE, 'r', encoding='utf-8') as f:
            VPN_BOTS = json.load(f)
        print(f"[+] Загружено {len(VPN_BOTS)} VPN-ботов из vpn_bots.json")
    else:
        print("[-] Предупреждение: vpn_bots.json не найден, используется дефолтный список")
except Exception as err:
    print(f"[-] Ошибка загрузки vpn_bots.json: {err}")

if not VPN_BOTS:
    # Фолбэк на случай отсутствия файла
    VPN_BOTS = [
        {"id": "hitvpnbot", "name": "HitVPN", "username": "hitvpnbot"},
        {"id": "finevpnbot", "name": "FineVPN", "username": "FineVPNbot"},
        {"id": "cacaovpn_bot", "name": "CacaoVPN", "username": "CacaoVPN_bot"},
        {"id": "vpneucombot", "name": "VPNEU", "username": "vpneucombot"},
        {"id": "vpndoza_bot", "name": "DOZA VPN", "username": "vpndoza_bot"},
        {"id": "cenzavpnbot", "name": "CenzaVPN", "username": "Cenzavpnbot"},
        {"id": "ma3x_vpn_bot", "name": "MATRIX VPN", "username": "ma3x_vpn_bot"},
        {"id": "mansurvpn_bot", "name": "Mansur VPN", "username": "mansurvpn_bot"}
    ]

ITEMS_PER_PAGE = 8

def filter_bots(query=None):
    """Поиск ботов по названию или юзернейму"""
    if not query:
        return VPN_BOTS
    q = query.strip().lower()
    return [b for b in VPN_BOTS if q in b.get('name', '').lower() or q in b.get('username', '').lower()]

# -------------------------------------------------------------
# 2. СВЯЗЬ С СЕРВЕРОМ И БАЗОЙ ДАННЫХ
# -------------------------------------------------------------
def get_app_url():
    """Возвращает актуальный URL Mini App"""
    if os.environ.get("RENDER_EXTERNAL_URL"):
        return os.environ.get("RENDER_EXTERNAL_URL").rstrip('/')
    if os.environ.get("APP_URL"):
        return os.environ.get("APP_URL").rstrip('/')
    return "https://losy-miniapp.onrender.com"

def get_server_user(user_id, username="", first_name=""):
    """Получение профиля пользователя с сервера или локальной БД"""
    url = f"{SERVER_API_URL}/api/bot/user?userId={user_id}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LosyBot/1.0'})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('ok'):
                return data.get('user')
    except Exception:
        pass

    # Фолбэк прямое чтение server_db.json
    try:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)
                users = db.get('users', {})
                uid_str = str(user_id)
                if uid_str in users:
                    u = users[uid_str]
                    return {
                        'id': uid_str,
                        'firstName': u.get('firstName', first_name),
                        'username': u.get('username', username),
                        'balance': u.get('balance', 200000),
                        'ownedCount': len(u.get('owned', [])),
                        'promosUsed': len(u.get('promocodes', []))
                    }
    except Exception:
        pass

    return {
        'id': str(user_id),
        'firstName': first_name or "Игрок",
        'username': username or "",
        'balance': 200000,
        'ownedCount': 1,
        'promosUsed': 0
    }

def activate_server_promo(user_id, username, first_name, code):
    """Активация промокода на сервере с зачислением золота"""
    url = f"{SERVER_API_URL}/api/bot/promo"
    payload = json.dumps({
        'userId': str(user_id),
        'username': username or "",
        'firstName': first_name or "",
        'code': code.strip().upper()
    }).encode('utf-8')

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json', 'User-Agent': 'LosyBot/1.0'}
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            res_json = json.loads(resp.read().decode('utf-8'))
            if res_json.get('ok'):
                return res_json
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode('utf-8'))
            if 'error' in err_data:
                return err_data
        except Exception:
            pass
    except Exception:
        pass

    # Фолбэк: локальная обработка через server_db.json
    LOCAL_PROMOS = {
        'LOSY2026': (50000, 'Приветственный бонус 50 000 золота'),
        'START': (25000, 'Стартовый набор 25 000 золота'),
        'VPNWIN': (35000, 'Бонус за интерес к VPN 35 000 золота'),
        'VIP': (77777, 'VIP-бонус 77 777 золота')
    }
    clean_code = code.strip().upper()
    if clean_code not in LOCAL_PROMOS:
        return {'ok': False, 'error': 'Промокод не существует или срок действия истёк'}

    reward, desc = LOCAL_PROMOS[clean_code]
    try:
        db = {'users': {}}
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)

        uid_str = str(user_id)
        if uid_str not in db.get('users', {}):
            db['users'][uid_str] = {
                'id': uid_str,
                'username': username or '',
                'firstName': first_name or 'Игрок',
                'balance': 200000,
                'owned': ['pen'],
                'promocodes': [],
                'updatedAt': 0
            }

        user_entry = db['users'][uid_str]
        if 'promocodes' not in user_entry:
            user_entry['promocodes'] = []

        if clean_code in user_entry['promocodes']:
            return {'ok': False, 'error': 'Вы уже активировали этот промокод ранее!'}

        user_entry['promocodes'].append(clean_code)
        user_entry['balance'] = user_entry.get('balance', 200000) + reward
        user_entry['updatedAt'] = 0

        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(db, f, indent=2, ensure_ascii=False)

        return {
            'ok': True,
            'code': clean_code,
            'reward': reward,
            'desc': desc,
            'newBalance': user_entry['balance']
        }
    except Exception as err:
        return {'ok': False, 'error': f'Сбой локальной базы: {err}'}

# -------------------------------------------------------------
# 3. КЛАВИАТУРЫ И ИНТЕРФЕЙС
# -------------------------------------------------------------
def get_main_reply_keyboard():
    """Постоянная нижняя клавиатура быстрого доступа"""
    app_url = get_app_url()
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    btn_app = types.KeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.KeyboardButton("🛡️ Список VPN (401)")
    btn_promo = types.KeyboardButton("🎁 Промокод")
    btn_profile = types.KeyboardButton("👤 Мой профиль")
    btn_random = types.KeyboardButton("🎲 Случайный VPN")
    btn_search = types.KeyboardButton("🔍 Поиск VPN")
    btn_help = types.KeyboardButton("ℹ️ О сервисе")

    markup.row(btn_app)
    markup.row(btn_vpn, btn_promo)
    markup.row(btn_profile, btn_random)
    markup.row(btn_search, btn_help)
    return markup

def get_main_inline_keyboard():
    """Инлайн клавиатура главного меню под приветственным баннером"""
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton(
        text="🚀 Запустить Mini App (Игры & Баланс)",
        web_app=types.WebAppInfo(url=app_url)
    )
    btn_vpn = types.InlineKeyboardButton(
        text=f"🛡️ Каталог VPN ({len(VPN_BOTS)} проверенных ботов)",
        callback_data="vpn_p:0"
    )
    btn_promo = types.InlineKeyboardButton(
        text="🎁 Промокод (+50 000 золота)",
        callback_data="menu_promo"
    )
    btn_profile = types.InlineKeyboardButton(
        text="👤 Мой профиль и баланс монет",
        callback_data="menu_profile"
    )
    btn_rnd = types.InlineKeyboardButton(
        text="🎲 Подобрать случайный VPN",
        callback_data="vpn_rnd"
    )
    btn_about = types.InlineKeyboardButton(
        text="ℹ️ О проекте LOSY",
        callback_data="menu_about"
    )
    markup.add(btn_app, btn_vpn, btn_promo, btn_profile, btn_rnd, btn_about)
    return markup

def build_vpn_keyboard(page=0, query=None):
    """
    Клавиатура каталога VPN-ботов с интерактивными кнопками и пагинацией.
    Каждая кнопка ведет прямо в бота через t.me ссылку!
    """
    items = filter_bots(query)
    total_items = len(items)
    total_pages = max(1, math.ceil(total_items / ITEMS_PER_PAGE))
    page = max(0, min(page, total_pages - 1))

    start_idx = page * ITEMS_PER_PAGE
    page_bots = items[start_idx : start_idx + ITEMS_PER_PAGE]

    markup = types.InlineKeyboardMarkup()

    # Формируем кнопки ботов: если имена компактные, ставим по 2 в ряд
    i = 0
    while i < len(page_bots):
        bot1 = page_bots[i]
        btn1_title = f"⚡ {bot1['name']}"
        btn1_url = f"https://t.me/{bot1['username']}?start=losy"

        if i + 1 < len(page_bots):
            bot2 = page_bots[i + 1]
            btn2_title = f"⚡ {bot2['name']}"
            btn2_url = f"https://t.me/{bot2['username']}?start=losy"

            # Если названия короткие (до 15 символов), размещаем аккуратно в 2 колонки
            if len(bot1['name']) <= 15 and len(bot2['name']) <= 15:
                markup.row(
                    types.InlineKeyboardButton(text=btn1_title, url=btn1_url),
                    types.InlineKeyboardButton(text=btn2_title, url=btn2_url)
                )
                i += 2
                continue

        markup.row(types.InlineKeyboardButton(text=btn1_title, url=btn1_url))
        i += 1

    # Пагинационная строка
    q_param = f":{query[:20]}" if query else ""
    nav_row = []

    if page > 0:
        nav_row.append(types.InlineKeyboardButton("◀️ Пред.", callback_data=f"vpn_p:{page-1}{q_param}"))
    else:
        nav_row.append(types.InlineKeyboardButton("⏺️", callback_data="noop"))

    nav_row.append(types.InlineKeyboardButton(f"📄 {page + 1} / {total_pages}", callback_data="noop"))

    if page < total_pages - 1:
        nav_row.append(types.InlineKeyboardButton("След. ▶️", callback_data=f"vpn_p:{page+1}{q_param}"))
    else:
        nav_row.append(types.InlineKeyboardButton("⏺️", callback_data="noop"))

    markup.row(*nav_row)

    # Строка быстрого перехода и поиска
    jump_row = []
    if page >= 5:
        jump_row.append(types.InlineKeyboardButton("⏪ -5", callback_data=f"vpn_p:{page-5}{q_param}"))
    jump_row.append(types.InlineKeyboardButton("🔍 Поиск", callback_data="vpn_search"))
    if page + 5 < total_pages:
        jump_row.append(types.InlineKeyboardButton("+5 ⏩", callback_data=f"vpn_p:{page+5}{q_param}"))
    if jump_row:
        markup.row(*jump_row)

    # Если включен режим поиска — кнопка сброса
    if query:
        markup.row(types.InlineKeyboardButton(f"❌ Сбросить поиск ({len(VPN_BOTS)} ботов)", callback_data="vpn_p:0"))

    # Сервисные кнопки
    markup.row(types.InlineKeyboardButton("🎲 Случайный VPN", callback_data="vpn_rnd"))
    markup.row(types.InlineKeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=get_app_url())))
    markup.row(types.InlineKeyboardButton("« В главное меню", callback_data="menu_home"))

    return markup

def get_promo_keyboard():
    """Клавиатура раздела промокодов"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_enter = types.InlineKeyboardButton("✍️ Ввести промокод", callback_data="input_promo")
    app_url = get_app_url()
    btn_app = types.InlineKeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_back = types.InlineKeyboardButton("« Назад в главное меню", callback_data="menu_home")
    markup.add(btn_enter, btn_app, btn_back)
    return markup

def get_profile_keyboard():
    """Клавиатура профиля"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    app_url = get_app_url()
    btn_app = types.InlineKeyboardButton("🎮 Играть в Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_promo = types.InlineKeyboardButton("🎁 Активировать промокод", callback_data="menu_promo")
    btn_vpn = types.InlineKeyboardButton(f"🛡️ Каталог VPN ({len(VPN_BOTS)})", callback_data="vpn_p:0")
    btn_back = types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    markup.add(btn_app, btn_promo, btn_vpn, btn_back)
    return markup

def get_random_bot_keyboard(rand_bot):
    """Клавиатура для случайной рекомендации"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_visit = types.InlineKeyboardButton(
        text=f"⚡ Перейти в @{rand_bot['username']}",
        url=f"https://t.me/{rand_bot['username']}?start=losy"
    )
    btn_next = types.InlineKeyboardButton("🎲 Выбрать другой случайный VPN", callback_data="vpn_rnd")
    btn_cat = types.InlineKeyboardButton(f"🛡️ Весь каталог ({len(VPN_BOTS)} ботов)", callback_data="vpn_p:0")
    btn_back = types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
    markup.add(btn_visit, btn_next, btn_cat, btn_back)
    return markup

# -------------------------------------------------------------
# 4. ТЕКСТЫ И ПРЕДСТАВЛЕНИЯ
# -------------------------------------------------------------
def get_welcome_text(name):
    return (
        f"🌌 <b>Добро пожаловать в экосистему LOSY VPN, {name}!</b>\n\n"
        f"⚡ <b>LOSY</b> — это единый центр надежных VPN-решений и интерактивных WebApp игр прямо в Telegram.\n\n"
        f"🚀 <b>Что доступно в боте:</b>\n"
        f"• <b>Mini App</b> — игры «Ракета», «Бомбы» 5x5 и рулетка «CS:GO Апгрейд» с общим балансом монет.\n"
        f"• <b>Каталог VPN</b> — более <b>{len(VPN_BOTS)} проверенных ботов</b> в 1 клик с бесплатным тестом.\n"
        f"• <b>Промокоды</b> — секретные бонусы и моментальное начисление золота на серверный баланс.\n\n"
        f"👇 <i>Выберите нужный раздел в меню ниже:</i>"
    )

def get_vpn_catalog_text(page=0, query=None):
    items = filter_bots(query)
    total_items = len(items)
    total_pages = max(1, math.ceil(total_items / ITEMS_PER_PAGE))

    if query:
        return (
            f"🔍 <b>Результаты поиска: «{query}»</b>\n\n"
            f"⚡ Найдено: <b>{total_items}</b> сервисов\n"
            f"📄 Страница: <b>{page + 1}</b> из <b>{total_pages}</b>\n\n"
            f"👇 <i>Нажмите на кнопку с названием бота для перехода:</i>"
        )

    return (
        f"🛡️ <b>Каталог проверенных VPN-ботов</b>\n\n"
        f"🌐 Всего в каталоге: <b>{total_items}</b> проверенных сервисов\n"
        f"📄 Страница: <b>{page + 1}</b> из <b>{total_pages}</b>\n\n"
        f"💡 <i>Нажмите на кнопку любого бота ниже, чтобы мгновенно перейти к нему и получить бесплатный ключ!</i>"
    )

def get_promo_text():
    return (
        "🎁 <b>Система промокодов LOSY:</b>\n\n"
        "Активируйте секретные промокоды и получайте золотые монеты прямо на свой игровой аккаунт Mini App!\n\n"
        "🔥 <b>Стартовый бонус для игроков:</b>\n"
        "<code>LOSY2026</code> — даёт <b>+50 000 золота</b>!\n\n"
        "💡 <b>Как активировать:</b>\n"
        "• Нажмите <b>«✍️ Ввести промокод»</b> ниже или\n"
        "• Отправьте команду: <code>/promo ТВОЙ_КОД</code>"
    )

def get_profile_text(user):
    balance_str = f"{user.get('balance', 200000):,}".replace(",", " ")
    return (
        f"👤 <b>Профиль игрока LOSY:</b>\n\n"
        f"🆔 <b>Telegram ID:</b> <code>{user.get('id')}</code>\n"
        f"🏷️ <b>Имя:</b> {user.get('firstName', 'Игрок')}\n"
        f"💰 <b>Баланс:</b> <b>{balance_str}</b> золотых монет 🪙\n"
        f"🎒 <b>Предметов в инвентаре:</b> {user.get('ownedCount', 1)}\n"
        f"🎟️ <b>Активировано промокодов:</b> {user.get('promosUsed', 0)}\n\n"
        f"⚡ <i>Баланс полностью синхронизирован с играми Mini App!</i>"
    )

def get_random_bot_text(rand_bot):
    return (
        f"🎲 <b>Случайная рекомендация VPN:</b>\n\n"
        f"🛡️ <b>{rand_bot['name']}</b>\n"
        f"👤 Юзернейм: @{rand_bot['username']}\n"
        f"⚡ Статус: <i>Проверен и активен</i>\n\n"
        f"👇 <i>Нажмите кнопку ниже для запуска бота:</i>"
    )

def get_about_text():
    return (
        "ℹ️ <b>О проекте LOSY:</b>\n\n"
        "<b>LOSY</b> объединяет лучшие инструменты свободы интернета и геймификации:\n\n"
        f"• <b>Каталог из {len(VPN_BOTS)} ботов:</b> VLESS Reality, Shadowsocks, WireGuard без блокировок;\n"
        "• <b>Интерактивная оболочка:</b> Mini App со звуковым сопровождением и современными играми;\n"
        "• <b>Единый серверный баланс:</b> надежное сохранение прогресса и промокоды.\n\n"
        "🔒 <i>Ваша конфиденциальность и безопасность — наш приоритет.</i>"
    )

# -------------------------------------------------------------
# 5. ОБРАБОТЧИКИ КОМАНД
# -------------------------------------------------------------
@bot.message_handler(commands=['start'])
def handle_start(message):
    name = message.from_user.first_name or "друг"
    caption = get_welcome_text(name)
    inline_kb = get_main_inline_keyboard()
    reply_kb = get_main_reply_keyboard()

    if os.path.exists(IMG_WELCOME):
        try:
            with open(IMG_WELCOME, 'rb') as photo:
                bot.send_photo(
                    message.chat.id,
                    photo=photo,
                    caption=caption,
                    reply_markup=inline_kb
                )
                bot.send_message(
                    message.chat.id,
                    "⚡ <i>Меню быстрого доступа закреплено внизу экрана.</i>",
                    reply_markup=reply_kb
                )
                return
        except Exception as e:
            print("Photo send error:", e)

    bot.send_message(message.chat.id, caption, reply_markup=inline_kb)
    bot.send_message(message.chat.id, "⚡ <i>Меню закреплено.</i>", reply_markup=reply_kb)

@bot.message_handler(commands=['menu'])
def handle_menu(message):
    handle_start(message)

@bot.message_handler(commands=['vpn'])
def handle_vpn(message):
    caption = get_vpn_catalog_text(page=0)
    kb = build_vpn_keyboard(page=0)
    if os.path.exists(IMG_VPN):
        try:
            with open(IMG_VPN, 'rb') as photo:
                bot.send_photo(message.chat.id, photo=photo, caption=caption, reply_markup=kb)
                return
        except Exception:
            pass
    bot.send_message(message.chat.id, caption, reply_markup=kb)

@bot.message_handler(commands=['search'])
def handle_search_command(message):
    parts = message.text.split(maxsplit=1)
    if len(parts) > 1:
        query = parts[1].strip()
        do_search(message.chat.id, query)
    else:
        msg = bot.send_message(
            message.chat.id,
            "🔍 <b>Поиск по каталогу VPN:</b>\n\n"
            "Введите название или юзернейм (например: <code>Nord</code>, <code>Hit</code>, <code>Capy</code>, <code>Free</code>):\n\n"
            "<i>Отправьте «Отмена» для возврата.</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_search)

@bot.message_handler(commands=['random'])
def handle_random_command(message):
    rand_bot = random.choice(VPN_BOTS)
    caption = get_random_bot_text(rand_bot)
    kb = get_random_bot_keyboard(rand_bot)
    bot.send_message(message.chat.id, caption, reply_markup=kb)

@bot.message_handler(commands=['promo'])
def handle_promo_command(message):
    parts = message.text.split(maxsplit=1)
    if len(parts) > 1:
        code = parts[1].strip()
        process_promo_activation(message, code)
    else:
        caption = get_promo_text()
        kb = get_promo_keyboard()
        if os.path.exists(IMG_PROMO):
            try:
                with open(IMG_PROMO, 'rb') as photo:
                    bot.send_photo(message.chat.id, photo=photo, caption=caption, reply_markup=kb)
                    return
            except Exception:
                pass
        bot.send_message(message.chat.id, caption, reply_markup=kb)

@bot.message_handler(commands=['profile'])
def handle_profile_command(message):
    user = get_server_user(message.from_user.id, message.from_user.username, message.from_user.first_name)
    bot.send_message(message.chat.id, get_profile_text(user), reply_markup=get_profile_keyboard())

@bot.message_handler(commands=['help'])
def handle_help_command(message):
    bot.send_message(message.chat.id, get_about_text(), reply_markup=get_main_inline_keyboard())

# -------------------------------------------------------------
# 6. ОБРАБОТЧИКИ ТЕКСТА (REPLY КНОПКИ)
# -------------------------------------------------------------
@bot.message_handler(func=lambda msg: True)
def handle_text_buttons(message):
    text = (message.text or "").strip()

    if text in ["🛡️ Список VPN (401)", "🛡️ Список VPN", "Список VPN", "VPN", "vpn"]:
        handle_vpn(message)
    elif text in ["🎁 Промокод", "Промокод", "промокод"]:
        handle_promo_command(message)
    elif text in ["👤 Мой профиль", "Профиль", "профиль"]:
        handle_profile_command(message)
    elif text in ["🎲 Случайный VPN", "Случайный VPN", "random"]:
        handle_random_command(message)
    elif text in ["🔍 Поиск VPN", "Поиск VPN", "Поиск", "search"]:
        handle_search_command(message)
    elif text in ["ℹ️ О сервисе", "О сервисе", "Помощь", "help"]:
        handle_help_command(message)
    else:
        # Проверяем, не промокод ли отправлен напрямую
        clean_text = text.upper()
        if clean_text in ['LOSY2026', 'START', 'VPNWIN', 'VIP']:
            process_promo_activation(message, clean_text)
        else:
            bot.send_message(
                message.chat.id,
                "👋 Используйте кнопки меню ниже или команду /start для навигации.",
                reply_markup=get_main_reply_keyboard()
            )

# -------------------------------------------------------------
# 7. ОБРАБОТЧИКИ CALLBACK QUERY
# -------------------------------------------------------------
@bot.callback_query_handler(func=lambda call: True)
def handle_callbacks(call):
    data = call.data
    chat_id = call.message.chat.id
    msg_id = call.message.message_id

    try:
        bot.answer_callback_query(call.id)
    except Exception:
        pass

    if data == "noop":
        return

    # 1. Главное меню
    if data == "menu_home":
        name = call.from_user.first_name or "друг"
        caption = get_welcome_text(name)
        kb = get_main_inline_keyboard()
        if call.message.content_type == 'photo':
            try:
                bot.edit_message_caption(
                    caption=caption,
                    chat_id=chat_id,
                    message_id=msg_id,
                    reply_markup=kb
                )
                return
            except Exception:
                pass
        bot.send_message(chat_id, caption, reply_markup=kb)

    # 2. Пагинация VPN каталога: "vpn_p:<page>" или "vpn_p:<page>:<query>"
    elif data.startswith("vpn_p:"):
        parts = data.split(":")
        page = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        query = parts[2] if len(parts) > 2 and parts[2] else None

        caption = get_vpn_catalog_text(page=page, query=query)
        kb = build_vpn_keyboard(page=page, query=query)

        if call.message.content_type == 'photo':
            try:
                bot.edit_message_caption(
                    caption=caption,
                    chat_id=chat_id,
                    message_id=msg_id,
                    reply_markup=kb
                )
                return
            except Exception:
                pass
        try:
            bot.edit_message_text(
                caption,
                chat_id=chat_id,
                message_id=msg_id,
                reply_markup=kb
            )
        except Exception:
            bot.send_message(chat_id, caption, reply_markup=kb)

    # 3. Поиск VPN
    elif data == "vpn_search":
        msg = bot.send_message(
            chat_id,
            "🔍 <b>Поиск по каталогу VPN:</b>\n\n"
            "Введите название или юзернейм (например: <code>Nord</code>, <code>Hit</code>, <code>Capy</code>, <code>Free</code>):\n\n"
            "<i>Отправьте «Отмена» для возврата.</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_search)

    # 4. Случайный VPN
    elif data == "vpn_rnd":
        rand_bot = random.choice(VPN_BOTS)
        caption = get_random_bot_text(rand_bot)
        kb = get_random_bot_keyboard(rand_bot)
        bot.send_message(chat_id, caption, reply_markup=kb)

    # 5. Раздел промокодов
    elif data == "menu_promo":
        caption = get_promo_text()
        kb = get_promo_keyboard()
        if os.path.exists(IMG_PROMO):
            try:
                with open(IMG_PROMO, 'rb') as photo:
                    bot.send_photo(chat_id, photo=photo, caption=caption, reply_markup=kb)
                    return
            except Exception:
                pass
        bot.send_message(chat_id, caption, reply_markup=kb)

    # 6. Ввод промокода через инлайн кнопку
    elif data == "input_promo":
        msg = bot.send_message(
            chat_id,
            "✍️ <b>Введите промокод в ответном сообщении:</b>\n\n"
            "<i>(Например: <code>LOSY2026</code> или отправьте «Отмена» для возврата)</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_promo)

    # 7. Профиль
    elif data == "menu_profile":
        user = get_server_user(call.from_user.id, call.from_user.username, call.from_user.first_name)
        bot.send_message(chat_id, get_profile_text(user), reply_markup=get_profile_keyboard())

    # 8. О сервисе
    elif data == "menu_about":
        bot.send_message(chat_id, get_about_text(), reply_markup=get_main_inline_keyboard())

# -------------------------------------------------------------
# 8. ШАГИ ПОИСКА И ПРОМОКОДОВ
# -------------------------------------------------------------
def step_receive_search(message):
    query = (message.text or "").strip()
    if query.lower() in ["отмена", "cancel", "/cancel", "назад"]:
        bot.send_message(message.chat.id, "❌ Поиск отменен.", reply_markup=get_main_reply_keyboard())
        return
    do_search(message.chat.id, query)

def do_search(chat_id, query):
    results = filter_bots(query)
    if not results:
        text = (
            f"🔍 По запросу «<b>{query}</b>» ничего не найдено.\n\n"
            f"💡 Попробуйте другое слово или откройте полный каталог ({len(VPN_BOTS)} ботов)."
        )
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(
            types.InlineKeyboardButton("🔍 Попробовать другой запрос", callback_data="vpn_search"),
            types.InlineKeyboardButton(f"🛡️ Открыть полный каталог ({len(VPN_BOTS)})", callback_data="vpn_p:0"),
            types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
        )
        bot.send_message(chat_id, text, reply_markup=markup)
        return

    caption = get_vpn_catalog_text(page=0, query=query)
    kb = build_vpn_keyboard(page=0, query=query)
    bot.send_message(chat_id, caption, reply_markup=kb)

def step_receive_promo(message):
    text = (message.text or "").strip()
    if text.lower() in ["отмена", "cancel", "/cancel", "назад"]:
        bot.send_message(message.chat.id, "❌ Ввод промокода отменен.", reply_markup=get_main_reply_keyboard())
        return

    process_promo_activation(message, text)

def process_promo_activation(message, code):
    user_id = message.from_user.id
    username = message.from_user.username or ""
    first_name = message.from_user.first_name or ""

    res = activate_server_promo(user_id, username, first_name, code)
    if res.get('ok'):
        reward_str = f"{res.get('reward', 0):,}".replace(",", " ")
        balance_str = f"{res.get('newBalance', 0):,}".replace(",", " ")

        text = (
            f"🎉 <b>Промокод успешно активирован!</b>\n\n"
            f"🎁 <b>Начислено:</b> +{reward_str} золотых монет!\n"
            f"📜 <b>Описание:</b> {res.get('desc', 'Бонус')}\n"
            f"💰 <b>Твой новый баланс:</b> <b>{balance_str}</b> золота 🪙\n\n"
            f"🚀 <i>Монеты уже доступны в играх Mini App!</i>"
        )
        markup = types.InlineKeyboardMarkup(row_width=1)
        app_url = get_app_url()
        markup.add(
            types.InlineKeyboardButton("🎮 Открыть Mini App и играть", web_app=types.WebAppInfo(url=app_url)),
            types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
        )
        bot.send_message(message.chat.id, text, reply_markup=markup)
    else:
        err_msg = res.get('error', 'Не удалось активировать промокод')
        text = (
            f"⚠️ <b>Ошибка:</b> {err_msg}\n\n"
            f"💡 Проверьте правильность написания или используйте промокод: <code>LOSY2026</code>"
        )
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(
            types.InlineKeyboardButton("✍️ Попробовать снова", callback_data="input_promo"),
            types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
        )
        bot.send_message(message.chat.id, text, reply_markup=markup)

# -------------------------------------------------------------
# 9. ИНИЦИАЛИЗАЦИЯ И РЕГИСТРАЦИЯ КОМАНД
# -------------------------------------------------------------
def setup_bot_meta():
    """Настройка команд и кнопки WebApp меню в Telegram"""
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

        # 2. Регистрация команд в меню / бота
        commands = [
            types.BotCommand("start", "🌌 Главное меню бота"),
            types.BotCommand("vpn", f"🛡️ Каталог {len(VPN_BOTS)} VPN ботов"),
            types.BotCommand("search", "🔍 Поиск VPN по названию"),
            types.BotCommand("promo", "🎁 Активация промокода на золото"),
            types.BotCommand("profile", "👤 Мой профиль и баланс монет"),
            types.BotCommand("random", "🎲 Подобрать случайный VPN"),
            types.BotCommand("help", "ℹ️ Информация о сервисе LOSY")
        ]
        bot.set_my_commands(commands)
        print(f"[+] {len(commands)} Bot Commands успешно зарегистрированы в Telegram")
    except Exception as e:
        print("[-] Meta setup warning:", e)

if __name__ == '__main__':
    try:
        me = bot.get_me()
        print(f"\n=======================================================")
        print(f"🤖 [LOSY TELEGRAM BOT STARTED]: @{me.username} (ID: {me.id})")
        print(f"📦 [VPN CATALOG]: {len(VPN_BOTS)} ботов загружено")
        print(f"=======================================================\n")
    except Exception as e:
        print("[!] Bot auth warning:", e)

    setup_bot_meta()
    print("[*] Polling Telegram updates...")
    bot.infinity_polling(timeout=20, long_polling_timeout=20)
