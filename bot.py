import sys
import os
import io

# Set UTF-8 encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True, write_through=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True, write_through=True)

import telebot
from telebot import types

BOT_TOKEN = '8873699108:AAExuaVHd3bKOj-3mWdGw2So94U7so2fxcM'
bot = telebot.TeleBot(BOT_TOKEN)

URL_FILE = os.path.join(os.path.dirname(__file__), 'current-urls.txt')

import re

def get_app_url():
    if os.path.exists(URL_FILE):
        try:
            with open(URL_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
                m = re.search(r'https://[a-zA-Z0-9.-]+\.tunnelmole\.net', content)
                if m:
                    return m.group(0)
        except Exception:
            pass
    return "https://cwvaqg-ip-196-17-171-227.tunnelmole.net"

print(f"[*] Bot @{bot.get_me().username} успешно запущен!")

@bot.message_handler(commands=['start'])
def start_handler(message):
    app_url = get_app_url()
    name = message.from_user.first_name or "друг"
    
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_app = types.InlineKeyboardButton(
        text="🚀 Играть в LOSY VPN (Mini App)", 
        web_app=types.WebAppInfo(url=app_url)
    )
    btn_upgrade = types.InlineKeyboardButton(
        text="🎰 CS:GO Upgrade (Прямой вход)", 
        web_app=types.WebAppInfo(url=f"{app_url}/modes/losy-upgrade-v24.html?v=60")
    )
    btn_rocket = types.InlineKeyboardButton(
        text="🚀 Ракета (Прямой вход)", 
        web_app=types.WebAppInfo(url=f"{app_url}/modes/losy-rocket.html?v=60")
    )
    btn_vpn = types.InlineKeyboardButton(
        text="🛡️ Бесплатные VPN Боты", 
        callback_data="vpn_list"
    )
    markup.add(btn_app, btn_rocket, btn_upgrade, btn_vpn)

    welcome_text = (
        f"👋 **Привет, {name}!**\n\n"
        f"🔥 Добро пожаловать в **LOSY VPN & Mini App**!\n\n"
        f"🎁 **Что внутри:**\n"
        f"• Бесплатный доступ к лучшим VPN-ботам с пробным периодом;\n"
        f"• Игры: **Upgrade 2.0** (CS:GO рулетка со скинами), **Bombs**, **Rocket**;\n"
        f"• Надежный серверный баланс и инвентарь.\n\n"
        f"👇 **Нажимай кнопку ниже, чтобы начать!**"
    )
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "vpn_list")
def vpn_list_callback(call):
    bot.answer_callback_query(call.id)
    text = (
        "🛡️ **Список проверенных VPN-ботов с бесплатным пробным тарифом:**\n\n"
        "1. 🚀 **Planet VPN Test Bot** — 3 дня бесплатно\n"
        "2. ⚡ **Fast VLESS Trial** — 7 дней без оплаты\n"
        "3. 🔑 **Shadowsocks Keys** — моментальный ключ\n\n"
        "💡 *Скоро прямо в Mini App появится автоматическая выдача ключей подписок!*"
    )
    bot.send_message(call.message.chat.id, text, parse_mode="Markdown")

if __name__ == '__main__':
    try:
        current_url = get_app_url()
        bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(type="web_app", text="🚀 Играть", web_app=types.WebAppInfo(url=current_url))
        )
        print(f"[+] Menu Button настроена на: {current_url}")
    except Exception as e:
        print("[-] Menu button error:", e)

    print("[+] Polling bot messages...")
    bot.infinity_polling()
