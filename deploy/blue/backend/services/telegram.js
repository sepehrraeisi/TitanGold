import dotenv from 'dotenv';
import { logger } from '../services/logger.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

class TelegramService {
    constructor() {
        this.bot = null;
        if (token || chatId) {
            logger.warn('Legacy TelegramService live delivery is disabled; use Telegram Publisher instead');
        }
    }

    async sendMessage(message, parseMode = 'Markdown') {
        logger.warn('Legacy TelegramService.sendMessage skipped; route through Telegram Publisher', {
            parseMode,
            preview: message ? String(message).slice(0, 120) : '',
        });
    }

    async sendPhoto(photoUrl, caption = '') {
        logger.warn('Legacy TelegramService.sendPhoto skipped; route through Telegram Publisher', {
            photoUrl: photoUrl ? '[masked]' : null,
            preview: caption ? String(caption).slice(0, 120) : '',
        });
    }
}

export const telegramService = new TelegramService();
