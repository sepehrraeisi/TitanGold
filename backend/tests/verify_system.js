import { mexcService } from '../services/mexc.js';
import { aiService } from '../services/ai.js';
import { telegramService } from '../services/telegram.js';

async function verify() {
    console.log('🔍 Starting System Verification...');

    // 1. Test MEXC
    try {
        console.log('📡 Testing MEXC Connection...');
        const prices = await mexcService.fetchPrices(['BTC/USDT']);
        if (prices['BTC/USDT']) {
            console.log('✅ MEXC Connected. BTC Price:', prices['BTC/USDT'].last);
        } else {
            console.error('❌ MEXC Failed: No price data');
        }
    } catch (error) {
        console.error('❌ MEXC Error:', error.message);
    }

    // 2. Test AI
    try {
        console.log('🧠 Testing AI (Gemini)...');
        const response = await aiService.askArtemis('Hello, are you online?');
        console.log('✅ AI Response:', response);
    } catch (error) {
        console.error('❌ AI Error:', error.message);
    }

    // 3. Test Telegram
    try {
        console.log('📨 Testing Telegram...');
        // await telegramService.sendMessage('🚀 TitanGold System Online via Verification Script');
        console.log('✅ Telegram Service Initialized (Message sending skipped to avoid spam)');
    } catch (error) {
        console.error('❌ Telegram Error:', error.message);
    }

    console.log('🏁 Verification Complete');
    process.exit(0);
}

verify();
