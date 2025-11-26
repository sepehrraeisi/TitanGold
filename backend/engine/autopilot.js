import { mexcService } from '../services/mexc.js';
import { aiService } from '../services/ai.js';
import { telegramService } from '../services/telegram.js';
import { query } from '../database/db.js';

class AutopilotEngine {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.scanInterval = 60 * 1000; // 1 minute
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🚀 Autopilot Engine Started');
        this.runLoop();
        this.intervalId = setInterval(() => this.runLoop(), this.scanInterval);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
        console.log('🛑 Autopilot Engine Stopped');
    }

    async runLoop() {
        try {
            // 1. Check if Autopilot is enabled in DB
            const stateResult = await query('SELECT status FROM artemis_state LIMIT 1');
            const status = stateResult.rows[0]?.status;

            if (status !== 'active') {
                // console.log('Autopilot is paused...');
                return;
            }

            console.log('🔍 Autopilot scanning markets...');

            // 2. Fetch Market Data (Top 20 coins for now to save API calls)
            // In production, this would be more comprehensive
            const tickers = await mexcService.fetchPrices(['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT']);

            // 3. Analyze Opportunities
            for (const [symbol, ticker] of Object.entries(tickers)) {
                await this.analyzeSymbol(symbol, ticker);
            }

        } catch (error) {
            console.error('Autopilot Loop Error:', error);
        }
    }

    async analyzeSymbol(symbol, ticker) {
        // Simple logic: Ask AI if we should buy
        // In reality, we would use technical indicators first to filter

        const price = ticker.last;
        const change24h = ticker.percentage;

        // Filter: Only look at things moving significantly
        if (Math.abs(change24h) < 2) return;

        const context = `Symbol: ${symbol}, Price: ${price}, 24h Change: ${change24h}%`;
        const prompt = `Analyze this crypto asset for a potential scalping trade. Return ONLY JSON: {"action": "BUY" | "SELL" | "HOLD", "confidence": 0-100, "reason": "short reason"}`;

        // Rate limit AI calls in real app!
        // For now, we just log
        // const analysis = await aiService.getAnalysis(prompt, context);
        // console.log(`AI Analysis for ${symbol}:`, analysis);

        // Mock decision for safety until fully tested
        const decision = { action: 'HOLD', confidence: 0 };

        if (decision.action !== 'HOLD' && decision.confidence > 80) {
            console.log(`✨ Opportunity found: ${decision.action} ${symbol}`);
            await telegramService.sendMessage(`🤖 *Artemis Signal*\n\nAction: ${decision.action} ${symbol}\nPrice: ${price}\nConfidence: ${decision.confidence}%\nReason: ${decision.reason}`);

            // Execute Trade (Commented out for safety)
            // await mexcService.createOrder(symbol, 'limit', decision.action.toLowerCase(), amount, price);
        }
    }
}

export const autopilot = new AutopilotEngine();
