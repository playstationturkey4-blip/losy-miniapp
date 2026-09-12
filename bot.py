# -*- coding: utf-8 -*-
"""
LOSY VPN & Mini App — Official Telegram Bot
High-tech, modern Telegram bot with:
- Mini App WebApp launching
- Direct 1-tap VPN Bot directory buttons
- Server-authoritative Promo Code system & Balance sync
- Cyberpunk visual banners
- Persistent reply keyboards + interactive inline menus
"""

import sys
import os
import io
import json
import urllib.request
import urllib.error

# Ensure UTF-8 stdout on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True, write_through=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True, write_through=True)

import telebot
from telebot import types

BOT_TOKEN = '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM'
bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets', 'bot')
DB_FILE = os.path.join(BASE_DIR, 'server_db.json')
SERVER_API_URL = os.environ.get("SERVER_API_URL", "http://127.0.0.1:8123")

IMG_WELCOME = os.path.join(ASSETS_DIR, 'welcome.jpg')
IMG_VPN = os.path.join(ASSETS_DIR, 'vpn.jpg')
IMG_PROMO = os.path.join(ASSETS_DIR, 'promo.jpg')

# -------------------------------------------------------------
# 1. СПИСОК ПРОВЕРЕННЫХ VPN БОТОВ
# Каждая запись отображается отдельной кнопкой с названием,
# которая мгновенно перекидывает пользователя в нужного бота.
# -------------------------------------------------------------
VPN_BOTS = [
    {
        "id": "planet_vpn",
        "name": "🚀 Planet VPN Bot",
        "badge": "3 дня Free",
        "username": "PlanetVPNTrialBot",
        "desc": "Мгновенный VLESS & Shadowsocks ключ, высокая скорость для YouTube 4K и игр."
    },
    {
        "id": "fast_vless",
        "name": "⚡ Fast VLESS Bot",
        "badge": "7 дней тест",
        "username": "FastVlessTrialBot",
        "desc": "Чистые серверы в Европе и Азии, моментальный запуск без рекламы."
    },
    {
        "id": "shadowsocks_key",
        "name": "🔑 Shadowsocks Keys",
        "badge": "Без оплаты",
        "username": "ShadowsocksKeyBot",
        "desc": "Автоматическая выдача конфигураций в 1 клик для любых устройств."
    },
    {
        "id": "cybershield",
        "name": "🛡️ CyberShield VPN",
        "badge": "Пробный тариф",
        "username": "CyberShieldVPNBot",
        "desc": "Шифрование военного уровня, обход любых блокировок и низкий пинг."
    }
]

# -------------------------------------------------------------
# 2. СВЯЗЬ С СЕРВЕРОМ И БАЗОЙ ДАННЫХ
# -------------------------------------------------------------
def get_app_url():
    """Возвращает публичный URL Mini App"""
    if os.environ.get("RENDER_EXTERNAL_URL"):
        return os.environ.get("RENDER_EXTERNAL_URL").rstrip('/')
    if os.environ.get("APP_URL"):
        return os.environ.get("APP_URL").rstrip('/')
    # Дефолтный production URL на Render
    return "https://losy-miniapp.onrender.com"

def get_server_user(user_id, username="", first_name=""):
    """Синхронизация профиля пользователя с сервером"""
    url = f"{SERVER_API_URL}/api/bot/user?userId={user_id}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LosyBot/1.0'})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
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
    """Активация промокода на сервере с начислением золота"""
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
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            res_json = json.loads(resp.read().decode('utf-8'))
            if res_json.get('ok'):
                return res_json
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode('utf-8'))
            if 'error' in err_data and err_data.get('error') != 'Not found':
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
        return {'ok': False, 'error': f'Сбой базы данных: {err}'}

# -------------------------------------------------------------
# 3. КЛАВИАТУРЫ И ИНТЕРФЕЙС
# -------------------------------------------------------------
def get_main_reply_keyboard():
    """Постоянная нижняя клавиатура для 1-тап навигации"""
    app_url = get_app_url()
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    btn_app = types.KeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_vpn = types.KeyboardButton("🛡️ Список VPN")
    btn_promo = types.KeyboardButton("🎁 Промокод")
    btn_profile = types.KeyboardButton("👤 Мой профиль")
    btn_help = types.KeyboardButton("ℹ️ О сервисе")

    markup.row(btn_app)
    markup.row(btn_vpn, btn_promo)
    markup.row(btn_profile, btn_help)
    return markup

def get_main_inline_keyboard():
    """Инлайн клавиатура под приветственным баннером"""
    app_url = get_app_url()
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton(
        text="🚀 Запустить Mini App (Игры & Баланс)",
        web_app=types.WebAppInfo(url=app_url)
    )
    btn_vpn = types.InlineKeyboardButton(
        text="🛡️ Список проверенных VPN-ботов",
        callback_data="menu_vpn"
    )
    btn_promo = types.InlineKeyboardButton(
        text="🎁 Ввести промокод",
        callback_data="menu_promo"
    )
    btn_profile = types.InlineKeyboardButton(
        text="👤 Мой профиль и баланс",
        callback_data="menu_profile"
    )
    btn_about = types.InlineKeyboardButton(
        text="ℹ️ О сервисе LOSY VPN",
        callback_data="menu_about"
    )
    markup.add(btn_app, btn_vpn, btn_promo, btn_profile, btn_about)
    return markup

def get_vpn_catalog_keyboard():
    """
    Клавиатура каталога: для КАЖДОГО бота отдельная кнопка с названием,
    которая сразу перекидывает в бота по прямой t.me ссылке!
    """
    markup = types.InlineKeyboardMarkup(row_width=1)
    for bot_info in VPN_BOTS:
        btn_bot = types.InlineKeyboardButton(
            text=f"{bot_info['name']} • {bot_info['badge']}",
            url=f"https://t.me/{bot_info['username']}?start=losy"
        )
        markup.add(btn_bot)

    # Кнопки возврата и запуска аппки
    app_url = get_app_url()
    btn_app = types.InlineKeyboardButton("🚀 Открыть Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_back = types.InlineKeyboardButton("« Назад в главное меню", callback_data="menu_home")
    markup.add(btn_app, btn_back)
    return markup

def get_promo_keyboard():
    """Клавиатура промокодов"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_enter = types.InlineKeyboardButton("✍️ Ввести промокод", callback_data="input_promo")
    app_url = get_app_url()
    btn_app = types.InlineKeyboardButton("🚀 Запустить Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_back = types.InlineKeyboardButton("« Назад в меню", callback_data="menu_home")
    markup.add(btn_enter, btn_app, btn_back)
    return markup

def get_profile_keyboard():
    """Клавиатура профиля"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    app_url = get_app_url()
    btn_app = types.InlineKeyboardButton("🎮 Играть в Mini App", web_app=types.WebAppInfo(url=app_url))
    btn_promo = types.InlineKeyboardButton("🎁 Активировать промокод", callback_data="menu_promo")
    btn_back = types.InlineKeyboardButton("« Назад в меню", callback_data="menu_home")
    markup.add(btn_app, btn_promo, btn_back)
    return markup

# -------------------------------------------------------------
# 4. ТЕКСТЫ И ПРЕДСТАВЛЕНИЯ
# -------------------------------------------------------------
def get_welcome_text(name):
    return (
        f"🌌 <b>Добро пожаловать в экосистему LOSY VPN, {name}!</b>\n\n"
        f"⚡ <b>LOSY</b> — это единый центр надежных VPN-решений и интерактивных игр прямо в Telegram.\n\n"
        f"🚀 <b>Главные возможности бота:</b>\n"
        f"• <b>Запуск Mini App</b> — полноценная WebApp игра: «Ракета», «Бомбы» 5x5 и рулетка «CS:GO Апгрейд» с золотыми монетами.\n"
        f"• <b>Каталог VPN-ботов</b> — проверенные сервисы с бесплатным пробным периодом (VLESS, Shadowsocks, WireGuard) в 1 клик.\n"
        f"• <b>Промокоды</b> — мгновенные награды золотыми монетами прямо на твой игровой баланс.\n\n"
        f"👇 <i>Выбери нужный раздел в меню ниже:</i>"
    )

def get_vpn_catalog_text():
    text = (
        "🛡️ <b>Каталог проверенных VPN-ботов:</b>\n\n"
        "Каждый бот предоставляет <b>бесплатный пробный период</b> и моментальную настройку ключа подписки для iOS, Android, Windows и macOS.\n\n"
    )
    for i, b in enumerate(VPN_BOTS, 1):
        text += f"{i}. <b>{b['name']}</b> ({b['badge']})\n"
        text += f"   <i>{b['desc']}</i>\n\n"

    text += "👉 <b>Нажми на кнопку нужного бота ниже</b>, чтобы сразу перейти в него и получить доступ!"
    return text

def get_promo_text():
    return (
        "🎁 <b>Система промокодов LOSY VPN:</b>\n\n"
        "Активируй секретные коды и получай золотые монеты прямо на свой серверный аккаунт Mini App!\n\n"
        "🔥 <b>Стартовый промокод для новых игроков:</b>\n"
        "<code>LOSY2026</code> — дает <b>+50 000 золота</b>!\n\n"
        "💡 <b>Как активировать:</b>\n"
        "• Нажми кнопку <b>«✍️ Ввести промокод»</b> ниже или\n"
        "• Отправь команду: <code>/promo ТВОЙ_КОД</code>"
    )

def get_profile_text(user):
    balance_str = f"{user.get('balance', 200000):,}".replace(",", " ")
    return (
        f"👤 <b>Профиль игрока:</b>\n\n"
        f"🆔 <b>Telegram ID:</b> <code>{user.get('id')}</code>\n"
        f"🏷️ <b>Имя:</b> {user.get('firstName', 'Игрок')}\n"
        f"💰 <b>Баланс:</b> <b>{balance_str}</b> золотых монет 🪙\n"
        f"🎒 <b>Предметов в инвентаре:</b> {user.get('ownedCount', 1)}\n"
        f"🎟️ <b>Активировано промокодов:</b> {user.get('promosUsed', 0)}\n\n"
        f"⚡ <i>Баланс полностью синхронизирован с сервером Mini App!</i>"
    )

def get_about_text():
    return (
        "ℹ️ <b>О проекте LOSY VPN:</b>\n\n"
        "<b>LOSY</b> объединяет лучшие инструменты свободы интернета и геймификации:\n\n"
        "• <b>Быстрые протоколы:</b> VLESS Reality, Shadowsocks, WireGuard без блокировок;\n"
        "• <b>Интерактивная оболочка:</b> Mini App со звуковым сопровождением и современными играми;\n"
        "• <b>Единый серверный баланс:</b> надежная авторизация и сохранение прогресса.\n\n"
        "🔒 <i>Ваша конфиденциальность и безопасность — наш главный приоритет.</i>"
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

    # Сначала отправляем нижнюю Reply-клавиатуру для постоянного доступа
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

@bot.message_handler(commands=['menu'])
def handle_menu(message):
    handle_start(message)

@bot.message_handler(commands=['vpn'])
def handle_vpn(message):
    caption = get_vpn_catalog_text()
    kb = get_vpn_catalog_keyboard()
    if os.path.exists(IMG_VPN):
        try:
            with open(IMG_VPN, 'rb') as photo:
                bot.send_photo(message.chat.id, photo=photo, caption=caption, reply_markup=kb)
                return
        except Exception:
            pass
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

    if text in ["🛡️ Список VPN", "Список VPN", "VPN", "vpn"]:
        handle_vpn(message)
    elif text in ["🎁 Промокод", "Промокод", "промокод"]:
        handle_promo_command(message)
    elif text in ["👤 Мой профиль", "Профиль", "профиль"]:
        handle_profile_command(message)
    elif text in ["ℹ️ О сервисе", "О сервисе", "Помощь", "help"]:
        handle_help_command(message)
    else:
        # Если пользователь просто отправил текст, проверяем, не промокод ли это
        clean_text = text.upper()
        if clean_text in ['LOSY2026', 'START', 'VPNWIN', 'VIP']:
            process_promo_activation(message, clean_text)
        else:
            bot.send_message(
                message.chat.id,
                f"👋 Привет! Используй кнопки меню ниже или команду /start для навигации.",
                reply_markup=get_main_reply_keyboard()
            )

# -------------------------------------------------------------
# 7. ОБРАБОТЧИКИ CALLBACK QUERY
# -------------------------------------------------------------
@bot.callback_query_handler(func=lambda call: True)
def handle_callbacks(call):
    data = call.data
    chat_id = call.message.chat.id

    try:
        bot.answer_callback_query(call.id)
    except Exception:
        pass

    if data == "menu_home":
        name = call.from_user.first_name or "друг"
        caption = get_welcome_text(name)
        kb = get_main_inline_keyboard()
        if os.path.exists(IMG_WELCOME):
            try:
                with open(IMG_WELCOME, 'rb') as photo:
                    bot.send_photo(chat_id, photo=photo, caption=caption, reply_markup=kb)
                    return
            except Exception:
                pass
        bot.send_message(chat_id, caption, reply_markup=kb)

    elif data == "menu_vpn":
        caption = get_vpn_catalog_text()
        kb = get_vpn_catalog_keyboard()
        if os.path.exists(IMG_VPN):
            try:
                with open(IMG_VPN, 'rb') as photo:
                    bot.send_photo(chat_id, photo=photo, caption=caption, reply_markup=kb)
                    return
            except Exception:
                pass
        bot.send_message(chat_id, caption, reply_markup=kb)

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

    elif data == "input_promo":
        msg = bot.send_message(
            chat_id,
            "✍️ <b>Введи промокод в ответном сообщении:</b>\n\n"
            "<i>(Например: <code>LOSY2026</code> или отправь «Отмена» для возврата)</i>",
            reply_markup=types.ForceReply(selective=True)
        )
        bot.register_next_step_handler(msg, step_receive_promo)

    elif data == "menu_profile":
        user = get_server_user(call.from_user.id, call.from_user.username, call.from_user.first_name)
        bot.send_message(chat_id, get_profile_text(user), reply_markup=get_profile_keyboard())

    elif data == "menu_about":
        bot.send_message(chat_id, get_about_text(), reply_markup=get_main_inline_keyboard())

# -------------------------------------------------------------
# 8. ШАГИ АКТИВАЦИИ ПРОМОКОДА
# -------------------------------------------------------------
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
            f"💡 Проверь правильность написания или попробуй промокод: <code>LOSY2026</code>"
        )
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(
            types.InlineKeyboardButton("✍️ Попробовать снова", callback_data="input_promo"),
            types.InlineKeyboardButton("« В главное меню", callback_data="menu_home")
        )
        bot.send_message(message.chat.id, text, reply_markup=markup)

# -------------------------------------------------------------
# 9. ИНИЦИАЛИЗАЦИЯ И ЗАПУСК
# -------------------------------------------------------------
def setup_bot_meta():
    """Настройка команд и кнопки меню Mini App в Telegram"""
    try:
        app_url = get_app_url()
        # 1. Настройка Menu Button в Telegram
        bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                type="web_app",
                text="🚀 Играть",
                web_app=types.WebAppInfo(url=app_url)
            )
        )
        print(f"[+] Chat Menu Button привязана к: {app_url}")

        # 2. Настройка списка команд в интерфейсе Telegram
        commands = [
            types.BotCommand("start", "Главное меню и запуск"),
            types.BotCommand("vpn", "Каталог проверенных VPN-ботов"),
            types.BotCommand("promo", "Активация промокода на золото"),
            types.BotCommand("profile", "Мой баланс и статистика"),
            types.BotCommand("help", "Информация о сервисе LOSY")
        ]
        bot.set_my_commands(commands)
        print("[+] Bot Commands успешно зарегистрированы в Telegram")
    except Exception as e:
        print("[-] Meta setup warning:", e)

if __name__ == '__main__':
    try:
        me = bot.get_me()
        print(f"\n=======================================================")
        print(f"🤖 [LOSY TELEGRAM BOT STARTED]: @{me.username} (ID: {me.id})")
        print(f"=======================================================\n")
    except Exception as e:
        print("[!] Bot auth warning:", e)

    setup_bot_meta()
    print("[*] Polling Telegram updates...")
    bot.infinity_polling(timeout=20, long_polling_timeout=20)
