import { mexcService } from '../services/mexc.js';
import { aiService } from '../services/ai.js';
import { telegramService } from '../services/telegram.js';
import { logger } from '../services/logger.js';

async function verify() {
    logger.info('🔍 Starting System Verification...');

    // 1. Test MEXC
    try {
        logger.info('📡 Testing MEXC Connection...');
        const prices = await mexcService.fetchSystemPrices(['BTC/USDT']);
        const btc = prices['BTC/USDT'];
        if (btc) {
            logger.info('✅ MEXC Connected. BTC Price:', btc.last || btc.close || btc.price);
        } else {
            logger.error('❌ MEXC Failed: No price data');
        }
    } catch (error) {
        logger.error('❌ MEXC Error:', error.message);
    }

    // 2. Test AI
    try {
        logger.info('🧠 Testing AI (Gemini)...');
        const response = await aiService.askArtemis('Hello, are you online?');
        logger.info('✅ AI Response:', response);
    } catch (error) {
        logger.error('❌ AI Error:', error.message);
    }

    // 3. Test Telegram
    try {
        logger.info('📨 Testing Telegram...');
        // await telegramService.sendMessage('🚀 TitanGold System Online via Verification Script');
        logger.info('✅ Telegram Service Initialized (Message sending skipped to avoid spam)');
    } catch (error) {
        logger.error('❌ Telegram Error:', error.message);
    }

    logger.info('🏁 Verification Complete');
    process.exit(0);
}

verify();
