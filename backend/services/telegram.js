import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

class TelegramService {
    constructor() {
        if (token) {
            this.bot = new TelegramBot(token, { polling: false }); // We only send messages for now
        } else {
            console.warn('Telegram token not provided');
        }
    }

    async sendMessage(message, parseMode = 'Markdown') {
        if (!this.bot || !chatId) {
            console.warn('Telegram bot or Chat ID not configured');
            return;
        }
        try {
            await this.bot.sendMessage(chatId, message, { parse_mode: parseMode });
        } catch (error) {
            console.error('Telegram sendMessage error:', error);
        }
    }

    async sendPhoto(photoUrl, caption = '') {
        if (!this.bot || !chatId) {
            console.warn('Telegram bot or Chat ID not configured');
            return;
        }
        try {
            await this.bot.sendPhoto(chatId, photoUrl, { caption });
        } catch (error) {
            console.error('Telegram sendPhoto error:', error);
        }
    }
}

export const telegramService = new TelegramService();
