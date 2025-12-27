import { mexcService } from '../services/mexc.js';
import { query } from '../database/db.js';
import { tradingEngine } from './tradingEngine.js';

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
            // 🚨 Circuit Breaker: Skip if trading engine is overloaded
            const queueSize = await tradingEngine.getQueueSize?.() || 0;
            if (queueSize > 500) {
                console.warn(`⚠️ Autopilot Circuit Breaker: Trading engine overloaded (queue: ${queueSize})`);
                return;
            }

            // 1. Check if Autopilot is enabled in DB
            const stateResult = await query('SELECT status, config FROM artemis_state ORDER BY created_at DESC LIMIT 1');
            const row = stateResult.rows[0];
            const status = row?.status;
            const config = row?.config || {};

            if (status !== 'active') {
                return;
            }

            const autopilotConfig = config.autopilot || {};
            const minMovePercent = autopilotConfig.minMovePercent || 2;

            console.log('🔍 Autopilot scanning markets...');

            // 2. Fetch Market Data (limited list for safety / rate limits)
            const tickers = await mexcService.fetchSystemPrices([
                'BTC/USDT',
                'ETH/USDT',
                'SOL/USDT',
                'XRP/USDT',
                'ADA/USDT'
            ]);

            // 3. تبدیل بازار به «فرصت خام» و ارسال به موتور تریدینگ
            for (const [symbol, ticker] of Object.entries(tickers)) {
                try {
                    const opportunity = this.buildOpportunity(symbol, ticker, {
                        minMovePercent,
                    });
                    if (opportunity) {
                        await tradingEngine.enqueueOpportunity(opportunity, opportunity.priority || 'HIGH');
                    }
                } catch (err) {
                    console.error(`Autopilot analysis error for ${symbol}:`, err);
                }
            }

        } catch (error) {
            console.error('Autopilot Loop Error:', error);
        }
    }

    buildOpportunity(symbol, ticker, options = {}) {
        const { minMovePercent = 2 } = options;

        const price = ticker.last || ticker.close || ticker.price;
        const change24h = ticker.percentage;

        if (!price || change24h === undefined || change24h === null) {
            return null;
        }

        // فقط روی کوین‌هایی که حرکت معنی‌دار دارند تمرکز کن
        if (Math.abs(change24h) < minMovePercent) return null;

        // اینجا فقط یک «فرصت خام» تولید می‌کنیم؛
        // تصمیم نهایی به عهده ۱۵ Agent + Artemis است داخل TradingEngine.
        const baseConfidence = Math.min(95, 60 + Math.abs(change24h) * 2);
        const side = change24h > 0 ? 'BUY' : 'SELL';

        let priority = 'HIGH';
        if (Math.abs(change24h) >= 8) {
            priority = 'CRITICAL';
        } else if (Math.abs(change24h) < 4) {
            priority = 'MEDIUM';
        }

        return {
            id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'autopilot_price_movement',
            symbol,
            side,
            price,
            changePercent: change24h,
            confidence: baseConfidence,
            priority,
            source: 'autopilot',
            timestamp: Date.now()
        };
    }
}

export const autopilot = new AutopilotEngine();
