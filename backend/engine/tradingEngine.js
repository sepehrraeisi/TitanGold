// TitanGold Trading Engine - Real-time Automated Trading System
// Event-Driven Architecture for 24/7 Trading

import { query } from '../database/db.js';
import { mexcService } from '../services/mexc.js';
import { aiService } from '../services/ai.js';
import { telegramService } from '../services/telegram.js';

// ============================================================================
// AI Rate-Limit Circuit Breaker (Quick Fix for 429 Storm)
// ============================================================================
const aiRateLimitState = {
  cooldownUntil: 0,
  last429At: 0,
  consecutive429: 0,
};

function aiBreakerShouldSkip() {
  return Date.now() < aiRateLimitState.cooldownUntil;
}

function aiBreakerOn429() {
  aiRateLimitState.last429At = Date.now();
  aiRateLimitState.consecutive429 += 1;

  // Progressive cooldown: 2min, 5min, 10min (capped)
  const mins = aiRateLimitState.consecutive429 === 1 ? 2 :
                aiRateLimitState.consecutive429 === 2 ? 5 : 10;
  aiRateLimitState.cooldownUntil = Date.now() + mins * 60 * 1000;
  
  console.warn(`⚠️ AI Rate Limit Breaker: Cooldown for ${mins} minutes (consecutive 429s: ${aiRateLimitState.consecutive429})`);
}

function aiBreakerOnSuccess() {
  if (aiRateLimitState.consecutive429 > 0) {
    console.log('✅ AI Rate Limit Breaker: Reset (successful call)');
  }
  aiRateLimitState.consecutive429 = 0;
  aiRateLimitState.cooldownUntil = 0;
}

// Virtual Wallet for Demo Mode
class VirtualWallet {
    constructor() {
        this.balances = new Map(); // asset -> { free, locked, total }
        this.transactions = [];
        this.initialize();
    }

    initialize() {
        // Default demo wallet: $10,000 USDT
        this.balances.set('USDT', { free: 10000, locked: 0, total: 10000 });
        this.balances.set('BTC', { free: 0, locked: 0, total: 0 });
        this.balances.set('ETH', { free: 0, locked: 0, total: 0 });
    }

    getBalance(asset) {
        return this.balances.get(asset) || { free: 0, locked: 0, total: 0 };
    }

    getFreeBalance(asset) {
        const balance = this.getBalance(asset);
        return balance.free;
    }

    lockBalance(asset, amount) {
        const balance = this.getBalance(asset);
        if (balance.free < amount) return false;
        balance.free -= amount;
        balance.locked += amount;
        balance.total = balance.free + balance.locked;
        this.balances.set(asset, balance);
        return true;
    }

    unlockBalance(asset, amount) {
        const balance = this.getBalance(asset);
        if (balance.locked < amount) return false;
        balance.free += amount;
        balance.locked -= amount;
        balance.total = balance.free + balance.locked;
        this.balances.set(asset, balance);
        return true;
    }

    deductBalance(asset, amount) {
        const balance = this.getBalance(asset);
        if (balance.free < amount) return false;
        balance.free -= amount;
        balance.total = balance.free + balance.locked;
        this.balances.set(asset, balance);
        return true;
    }

    addBalance(asset, amount) {
        let balance = this.getBalance(asset);
        balance.free += amount;
        balance.total = balance.free + balance.locked;
        this.balances.set(asset, balance);
    }

    executeTrade(side, baseAsset, quoteAsset, quantity, price) {
        const totalCost = quantity * price;
        
        if (side === 'BUY') {
            if (this.getFreeBalance(quoteAsset) < totalCost) return false;
            this.deductBalance(quoteAsset, totalCost);
            this.addBalance(baseAsset, quantity);
            return true;
        } else {
            if (this.getFreeBalance(baseAsset) < quantity) return false;
            this.deductBalance(baseAsset, quantity);
            this.addBalance(quoteAsset, totalCost);
            return true;
        }
    }
}

class TradingEngine {
    constructor() {
        this.isRunning = false;
        this.scanners = new Map();
        this.opportunityQueue = [];
        this.activeTrades = new Map(); // tradeId -> Trade
        this.maxConcurrentTrades = 20;
        this.virtualWallet = new VirtualWallet(); // Virtual wallet for demo mode
        this.config = {
            enabled: true,
            mode: 'demo', // Will be synced with Artemis mode
            maxPositions: 20,
            riskLimits: {
                maxPositionSize: 0.1, // 10% of portfolio per trade
                maxDailyLoss: 0.05, // 5% max daily loss
                maxDrawdown: 0.15, // 15% max drawdown
                minConfidence: 75, // Minimum confidence for trade
            },
            scanners: {
                arbitrage: {
                    enabled: true,
                    interval: 2000, // 2 seconds
                    minProfitPercent: 0.5, // 0.5% minimum profit
                },
                priceMovement: {
                    enabled: true,
                    interval: 5000, // 5 seconds
                    minChangePercent: 2, // 2% minimum change
                },
                volumeSpike: {
                    enabled: true,
                    interval: 10000, // 10 seconds
                    minVolumeMultiplier: 2, // 2x average volume
                },
                pattern: {
                    enabled: true,
                    interval: 30000, // 30 seconds
                },
            },
            exchanges: {
                mexc: {
                    enabled: true,
                    testnet: true,
                },
                // Future: binance, okx, etc.
            },
        };
        this.stats = {
            totalOpportunities: 0,
            executedTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            dailyProfit: 0,
            dailyLoss: 0,
        };
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️ Trading Engine is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Trading Engine Started');

        // Load configuration from database
        await this.loadConfig();

        // Start all scanners
        this.startArbitrageScanner();
        this.startPriceMovementScanner();
        this.startVolumeSpikeScanner();
        this.startPatternScanner();

        // Start opportunity processor
        this.startOpportunityProcessor();

        // Start trade monitor
        this.startTradeMonitor();

        // Start risk monitor
        this.startRiskMonitor();

        console.log('✅ Trading Engine fully initialized');
    }

    async stop() {
        this.isRunning = false;

        // Stop all scanners
        this.scanners.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.scanners.clear();

        // Close all active trades (optional - depends on strategy)
        // await this.closeAllTrades();

        console.log('🛑 Trading Engine Stopped');
    }

    async loadConfig() {
        try {
            const result = await query(
                'SELECT config FROM trading_engine_config WHERE id = 1'
            );

            if (result.rows.length > 0 && result.rows[0].config) {
                this.config = { ...this.config, ...result.rows[0].config };
            }
        } catch (error) {
            console.error('Failed to load trading engine config:', error);
            // Use default config
        }
    }

    async saveConfig() {
        try {
            await query(
                `INSERT INTO trading_engine_config (id, config, updated_at) 
                 VALUES (1, $1, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW()`,
                [JSON.stringify(this.config)]
            );
        } catch (error) {
            console.error('Failed to save trading engine config:', error);
        }
    }

    // ============================================================================
    // MARKET SCANNERS
    // ============================================================================

    // Arbitrage Scanner - Find price differences between exchanges
    startArbitrageScanner() {
        if (!this.config.scanners.arbitrage.enabled) {
            console.log('⏸️ Arbitrage Scanner is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.scanners.arbitrage.enabled) return;

            // 🚨 Circuit Breaker: Skip tick if too many pending operations
            if (this.opportunityQueue.length > 200) {
                console.warn(`⚠️ Circuit Breaker: Skipping arbitrage scan (queue: ${this.opportunityQueue.length})`);
                return;
            }

            try {
                // Get all trading pairs from MEXC
                const symbols = await this.getAllTradingSymbols();
                
                // For now, scan top 100 coins (in production, scan all 400+)
                const topSymbols = symbols.slice(0, 100);

                for (const symbol of topSymbols) {
                    try {
                        const opportunity = await this.scanArbitrageOpportunity(symbol);
                        if (opportunity) {
                            await this.addOpportunity(opportunity, 'CRITICAL');
                        }
                    } catch (error) {
                        console.error(`Error scanning arbitrage for ${symbol}:`, error);
                    }
                }
            } catch (error) {
                console.error('Arbitrage Scanner error:', error);
            }
        }, this.config.scanners.arbitrage.interval);

        this.scanners.set('arbitrage', intervalId);
        console.log(`✅ Arbitrage Scanner started (interval: ${this.config.scanners.arbitrage.interval}ms)`);
    }

    async scanArbitrageOpportunity(symbol) {
        try {
            // Get prices from MEXC (in future, compare with other exchanges)
            const ticker = await mexcService.fetchSystemTicker(symbol);
            if (!ticker) return null;

            // For now, check spot vs perpetual (future: check other exchanges)
            const spotPrice = parseFloat(ticker.lastPrice);
            const perpTicker = await mexcService.fetchSystemPerpetualTicker(symbol);
            if (!perpTicker) return null;

            const perpPrice = parseFloat(perpTicker.lastPrice || perpTicker.fairPrice);
            const priceDiff = Math.abs(spotPrice - perpPrice);
            const profitPercent = (priceDiff / spotPrice) * 100;

            if (profitPercent >= this.config.scanners.arbitrage.minProfitPercent) {
                return {
                    type: 'arbitrage',
                    symbol,
                    side: spotPrice < perpPrice ? 'BUY_SPOT_SELL_PERP' : 'BUY_PERP_SELL_SPOT',
                    spotPrice,
                    perpPrice,
                    profitPercent,
                    confidence: Math.min(95, 70 + profitPercent * 5),
                    priority: 'CRITICAL',
                    timestamp: Date.now(),
                };
            }

            return null;
        } catch (error) {
            console.error(`Arbitrage scan error for ${symbol}:`, error);
            return null;
        }
    }

    // Price Movement Scanner - Detect significant price movements
    startPriceMovementScanner() {
        if (!this.config.scanners.priceMovement.enabled) {
            console.log('⏸️ Price Movement Scanner is disabled');
            return;
        }

        const priceHistory = new Map(); // symbol -> { price, timestamp }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.scanners.priceMovement.enabled) return;

            // 🚨 Circuit Breaker: Skip tick if too many pending operations
            if (this.opportunityQueue.length > 200) {
                console.warn(`⚠️ Circuit Breaker: Skipping price movement scan (queue: ${this.opportunityQueue.length})`);
                return;
            }

            try {
                const symbols = await this.getAllTradingSymbols();
                const topSymbols = symbols.slice(0, 200); // Scan top 200

                for (const symbol of topSymbols) {
                    try {
                        const ticker = await mexcService.fetchSystemTicker(symbol);
                        if (!ticker) continue;

                        const currentPrice = parseFloat(ticker.lastPrice);
                        const history = priceHistory.get(symbol);

                        if (history) {
                            const priceChange = Math.abs(currentPrice - history.price);
                            const changePercent = (priceChange / history.price) * 100;

                            if (changePercent >= this.config.scanners.priceMovement.minChangePercent) {
                                const opportunity = {
                                    type: 'price_movement',
                                    symbol,
                                    side: currentPrice > history.price ? 'BUY' : 'SELL',
                                    price: currentPrice,
                                    previousPrice: history.price,
                                    changePercent,
                                    confidence: Math.min(90, 60 + changePercent * 2),
                                    priority: 'HIGH',
                                    timestamp: Date.now(),
                                };

                                await this.addOpportunity(opportunity, 'HIGH');
                            }
                        }

                        priceHistory.set(symbol, { price: currentPrice, timestamp: Date.now() });
                    } catch (error) {
                        console.error(`Price movement scan error for ${symbol}:`, error);
                    }
                }
            } catch (error) {
                console.error('Price Movement Scanner error:', error);
            }
        }, this.config.scanners.priceMovement.interval);

        this.scanners.set('priceMovement', intervalId);
        console.log(`✅ Price Movement Scanner started (interval: ${this.config.scanners.priceMovement.interval}ms)`);
    }

    // Volume Spike Scanner - Detect unusual volume
    startVolumeSpikeScanner() {
        if (!this.config.scanners.volumeSpike.enabled) {
            console.log('⏸️ Volume Spike Scanner is disabled');
            return;
        }

        const volumeHistory = new Map(); // symbol -> [volumes...] (rolling average)

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.scanners.volumeSpike.enabled) return;

            // 🚨 Circuit Breaker: Skip tick if too many pending operations
            if (this.opportunityQueue.length > 200) {
                console.warn(`⚠️ Circuit Breaker: Skipping volume spike scan (queue: ${this.opportunityQueue.length})`);
                return;
            }

            try {
                const symbols = await this.getAllTradingSymbols();
                const topSymbols = symbols.slice(0, 200);

                for (const symbol of topSymbols) {
                    try {
                        const ticker = await mexcService.fetchSystemTicker(symbol);
                        if (!ticker) continue;

                        const currentVolume = parseFloat(ticker.quoteVolume || ticker.volume || 0);
                        const volumes = volumeHistory.get(symbol) || [];

                        if (volumes.length >= 10) {
                            const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
                            const volumeMultiplier = currentVolume / avgVolume;

                            if (volumeMultiplier >= this.config.scanners.volumeSpike.minVolumeMultiplier) {
                                const opportunity = {
                                    type: 'volume_spike',
                                    symbol,
                                    side: 'BUY', // Volume spike usually indicates buying pressure
                                    price: parseFloat(ticker.lastPrice),
                                    volume: currentVolume,
                                    avgVolume,
                                    volumeMultiplier,
                                    confidence: Math.min(85, 50 + volumeMultiplier * 5),
                                    priority: 'HIGH',
                                    timestamp: Date.now(),
                                };

                                await this.addOpportunity(opportunity, 'HIGH');
                            }

                            volumes.shift(); // Remove oldest
                        }

                        volumes.push(currentVolume);
                        volumeHistory.set(symbol, volumes);
                    } catch (error) {
                        console.error(`Volume spike scan error for ${symbol}:`, error);
                    }
                }
            } catch (error) {
                console.error('Volume Spike Scanner error:', error);
            }
        }, this.config.scanners.volumeSpike.interval);

        this.scanners.set('volumeSpike', intervalId);
        console.log(`✅ Volume Spike Scanner started (interval: ${this.config.scanners.volumeSpike.interval}ms)`);
    }

    // Pattern Scanner - Use Pattern Recognition Agent
    startPatternScanner() {
        if (!this.config.scanners.pattern.enabled) {
            console.log('⏸️ Pattern Scanner is disabled');
            return;
        }

        const intervalId = setInterval(async () => {
            if (!this.isRunning || !this.config.scanners.pattern.enabled) return;

            try {
                // Use Pattern Recognition Agent to find patterns
                // This integrates with existing Agent system
                const symbols = await this.getAllTradingSymbols();
                const topSymbols = symbols.slice(0, 50); // Scan top 50 for patterns

                for (const symbol of topSymbols) {
                    try {
                        // Call Pattern Recognition Agent (existing system)
                        const patternResult = await this.callPatternAgent(symbol);
                        
                        if (patternResult && patternResult.confidence >= this.config.riskLimits.minConfidence) {
                            const opportunity = {
                                type: 'pattern',
                                symbol,
                                side: patternResult.signal === 'BULLISH' ? 'BUY' : 'SELL',
                                price: patternResult.price,
                                pattern: patternResult.patternName,
                                confidence: patternResult.confidence,
                                priority: 'MEDIUM',
                                timestamp: Date.now(),
                            };

                            await this.addOpportunity(opportunity, 'MEDIUM');
                        }
                    } catch (error) {
                        console.error(`Pattern scan error for ${symbol}:`, error);
                    }
                }
            } catch (error) {
                console.error('Pattern Scanner error:', error);
            }
        }, this.config.scanners.pattern.interval);

        this.scanners.set('pattern', intervalId);
        console.log(`✅ Pattern Scanner started (interval: ${this.config.scanners.pattern.interval}ms)`);
    }

    // ============================================================================
    // OPPORTUNITY PROCESSING
    // ============================================================================

    async addOpportunity(opportunity, priority) {
        // Add to priority queue
        const queueItem = {
            ...opportunity,
            priority,
            id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            addedAt: Date.now(),
        };

        // Insert based on priority
        const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
        const insertIndex = this.opportunityQueue.findIndex(
            item => priorityOrder[item.priority] > priorityOrder[priority]
        );

        if (insertIndex === -1) {
            this.opportunityQueue.push(queueItem);
        } else {
            this.opportunityQueue.splice(insertIndex, 0, queueItem);
        }

        this.stats.totalOpportunities++;

        // Limit queue size (keep top 100)
        if (this.opportunityQueue.length > 100) {
            this.opportunityQueue = this.opportunityQueue.slice(0, 100);
        }
    }

    /**
     * Public helper for external modules (like Autopilot) to enqueue opportunities
     * so that they pass through the full TradingEngine + Artemis + Agents pipeline.
     */
    async enqueueOpportunity(opportunity, priority = 'MEDIUM') {
        await this.addOpportunity(opportunity, priority);
    }

    startOpportunityProcessor() {
        const processInterval = setInterval(async () => {
            if (!this.isRunning) return;

            // Process opportunities from queue
            while (this.opportunityQueue.length > 0 && this.activeTrades.size < this.maxConcurrentTrades) {
                const opportunity = this.opportunityQueue.shift();

                try {
                    // Check if we should execute
                    const shouldExecute = await this.shouldExecuteTrade(opportunity);
                    
                    if (shouldExecute) {
                        await this.executeTrade(opportunity);
                    }
                } catch (error) {
                    console.error(`Failed to process opportunity ${opportunity.id}:`, error);
                }
            }
        }, 1000); // Process every second

        this.scanners.set('opportunityProcessor', processInterval);
        console.log('✅ Opportunity Processor started');
    }

    async shouldExecuteTrade(opportunity) {
        // Check confidence threshold
        if (opportunity.confidence < this.config.riskLimits.minConfidence) {
            return false;
        }

        // Check if we have capacity
        if (this.activeTrades.size >= this.maxConcurrentTrades) {
            return false;
        }

        // Check if we already have a position in this symbol
        const existingTrade = Array.from(this.activeTrades.values())
            .find(trade => trade.symbol === opportunity.symbol && trade.status === 'open');
        
        if (existingTrade) {
            return false; // Already have position
        }

        // Check risk limits
        const riskCheck = await this.checkRiskLimits(opportunity);
        if (!riskCheck.allowed) {
            console.log(`Risk check failed for ${opportunity.symbol}: ${riskCheck.reason}`);
            return false;
        }

        // Get Artemis approval (integrate with Decision Engine)
        const artemisApproval = await this.getArtemisApproval(opportunity);
        if (!artemisApproval.approved) {
            console.log(`Artemis rejected ${opportunity.symbol}: ${artemisApproval.reason}`);
            return false;
        }

        return true;
    }

    async checkRiskLimits(opportunity) {
        try {
            // Get current portfolio value
            const portfolio = await this.getPortfolioValue();
            
            // Calculate position size
            const positionSize = portfolio * this.config.riskLimits.maxPositionSize;
            
            // Check daily loss limit
            if (this.stats.dailyLoss >= portfolio * this.config.riskLimits.maxDailyLoss) {
                return { allowed: false, reason: 'Daily loss limit reached' };
            }

            // Check drawdown
            const drawdown = this.calculateDrawdown();
            if (drawdown >= this.config.riskLimits.maxDrawdown) {
                return { allowed: false, reason: 'Max drawdown reached' };
            }

            return { allowed: true, positionSize };
        } catch (error) {
            console.error('Risk check error:', error);
            return { allowed: false, reason: 'Risk check failed' };
        }
    }

    async getArtemisApproval(opportunity) {
        try {
            // Get signals from relevant AI Agents
            const agentSignals = await this.getAgentSignals(opportunity);
            
            // Build decision request for Artemis
            const decisionRequest = {
                opportunity: {
                    symbol: opportunity.symbol,
                    type: opportunity.type,
                    side: opportunity.side,
                    price: opportunity.price,
                    confidence: opportunity.confidence,
                },
                signals: agentSignals,
                context: {
                    activeTrades: this.activeTrades.size,
                    maxTrades: this.maxConcurrentTrades,
                    portfolioValue: await this.getPortfolioValue(),
                    dailyProfit: this.stats.dailyProfit,
                    dailyLoss: this.stats.dailyLoss,
                }
            };

            // Call Artemis Decision Engine via API
            const response = await fetch(`http://localhost:${process.env.PORT || 5001}/api/artemis/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decisionRequest)
            });

            if (response.ok) {
                const decision = await response.json();
                return {
                    approved: decision.action === 'EXECUTE' || decision.action === 'BUY' || decision.action === 'SELL',
                    reason: decision.reason || 'Artemis decision',
                    confidence: decision.confidence || opportunity.confidence,
                    decision: decision,
                };
            } else {
                // Fallback to AI service
                return await this.getArtemisApprovalFallback(opportunity);
            }
        } catch (error) {
            console.error('Artemis approval error:', error);
            // Fallback to high confidence threshold
            return await this.getArtemisApprovalFallback(opportunity);
        }
    }

    async getArtemisApprovalFallback(opportunity) {
        try {
            const prompt = `Should we execute this trade opportunity?
Symbol: ${opportunity.symbol}
Type: ${opportunity.type}
Side: ${opportunity.side}
Confidence: ${opportunity.confidence}%
Price: ${opportunity.price}

Return ONLY JSON: {"approved": true/false, "reason": "short reason", "confidence": 0-100}`;

            const response = await aiService.askArtemis(prompt);
            
            try {
                const decision = JSON.parse(response);
                return {
                    approved: decision.approved === true,
                    reason: decision.reason || 'Artemis decision',
                    confidence: decision.confidence || 0,
                };
            } catch {
                return {
                    approved: opportunity.confidence >= 80,
                    reason: 'Artemis response parsing failed, using confidence threshold',
                    confidence: opportunity.confidence,
                };
            }
        } catch (error) {
            return {
                approved: opportunity.confidence >= 85,
                reason: 'Artemis unavailable, using high confidence threshold',
                confidence: opportunity.confidence,
            };
        }
    }

    async getAgentSignals(opportunity) {
        const signals = [];

        try {
            // Get signals from relevant agents based on opportunity type
            if (opportunity.type === 'arbitrage') {
                // Use Arbitrage Agent
                signals.push({
                    agent: 'arbitrage',
                    signal: opportunity.side,
                    confidence: opportunity.confidence,
                    data: { profitPercent: opportunity.profitPercent }
                });
            }

            if (opportunity.type === 'price_movement' || opportunity.type === 'volume_spike') {
                // Use Technical Analysis Agent
                try {
                    const techAnalysis = await this.callTechnicalAgent(opportunity.symbol);
                    if (techAnalysis) {
                        signals.push({
                            agent: 'technical',
                            signal: techAnalysis.signal,
                            confidence: techAnalysis.confidence,
                            data: techAnalysis
                        });
                    }
                } catch (error) {
                    console.error('Error calling technical agent:', error);
                }

                // Use Risk Management Agent
                try {
                    const riskAssessment = await this.callRiskAgent(opportunity.symbol);
                    if (riskAssessment) {
                        signals.push({
                            agent: 'risk',
                            signal: riskAssessment.recommendation,
                            confidence: riskAssessment.confidence,
                            data: riskAssessment
                        });
                    }
                } catch (error) {
                    console.error('Error calling risk agent:', error);
                }
            }

            if (opportunity.type === 'pattern') {
                // Pattern signal already included
                signals.push({
                    agent: 'pattern',
                    signal: opportunity.side,
                    confidence: opportunity.confidence,
                    data: { pattern: opportunity.pattern }
                });
            }

            // Always get Timing Agent signal
            try {
                const timingSignal = await this.callTimingAgent(opportunity.symbol);
                if (timingSignal) {
                    signals.push({
                        agent: 'timing',
                        signal: timingSignal.signal,
                        confidence: timingSignal.confidence,
                        data: timingSignal
                    });
                }
            } catch (error) {
                console.error('Error calling timing agent:', error);
            }

        } catch (error) {
            console.error('Error getting agent signals:', error);
        }

        return signals;
    }

    async callTechnicalAgent(symbol) {
        // AI Rate-Limit Circuit Breaker
        if (aiBreakerShouldSkip()) {
            console.warn(`⏸️ AI call skipped (cooldown): agent-1 for ${symbol}`);
            return null;
        }

        try {
            // Call Technical Analysis Agent via API
            const response = await fetch(`http://localhost:${process.env.PORT || 5001}/api/ai-agents/agent-1/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, timeframe: '1h' })
            });

            if (response.status === 429) {
                aiBreakerOn429();
                return null;
            }

            if (response.ok) {
                const result = await response.json();
                aiBreakerOnSuccess();
                return {
                    signal: result.signal || 'NEUTRAL',
                    confidence: result.confidence || 50,
                    indicators: result.indicators
                };
            }
            return null;
        } catch (error) {
            console.error('Error calling technical agent:', error);
            return null;
        }
    }

    async callRiskAgent(symbol) {
        // AI Rate-Limit Circuit Breaker
        if (aiBreakerShouldSkip()) {
            console.warn(`⏸️ AI call skipped (cooldown): agent-2 for ${symbol}`);
            return null;
        }

        try {
            // Call Risk Management Agent via API
            const response = await fetch(`http://localhost:${process.env.PORT || 5001}/api/ai-agents/agent-2/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });

            if (response.status === 429) {
                aiBreakerOn429();
                return null;
            }

            if (response.ok) {
                const result = await response.json();
                aiBreakerOnSuccess();
                return {
                    recommendation: result.recommendation || 'HOLD',
                    confidence: result.confidence || 50,
                    riskLevel: result.riskLevel
                };
            }
            return null;
        } catch (error) {
            console.error('Error calling risk agent:', error);
            return null;
        }
    }

    async callTimingAgent(symbol) {
        // AI Rate-Limit Circuit Breaker
        if (aiBreakerShouldSkip()) {
            console.warn(`⏸️ AI call skipped (cooldown): agent-15 for ${symbol}`);
            return null;
        }

        try {
            // Call Timing Agent via API
            const response = await fetch(`http://localhost:${process.env.PORT || 5001}/api/ai-agents/agent-15/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });

            if (response.status === 429) {
                aiBreakerOn429();
                return null;
            }

            if (response.ok) {
                const result = await response.json();
                aiBreakerOnSuccess();
                return {
                    signal: result.signal || 'NEUTRAL',
                    confidence: result.confidence || 50,
                    timing: result.timing
                };
            }
            return null;
        } catch (error) {
            console.error('Error calling timing agent:', error);
            return null;
        }
    }

    // ============================================================================
    // TRADE EXECUTION
    // ============================================================================

    async executeTrade(opportunity) {
        const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const trade = {
            id: tradeId,
            symbol: opportunity.symbol,
            side: opportunity.side,
            type: opportunity.type,
            entryPrice: opportunity.price,
            quantity: 0, // Will be calculated
            status: 'pending',
            createdAt: Date.now(),
            opportunity,
        };

        try {
            // Calculate quantity based on position size
            const riskCheck = await this.checkRiskLimits(opportunity);
            const positionSize = riskCheck.positionSize || 100; // Default $100
            const quantity = positionSize / opportunity.price;

            trade.quantity = quantity;

            // Execute order
            if (this.config.mode === 'demo') {
                // Demo mode - use virtual wallet
                const [baseAsset, quoteAsset] = this.parseSymbol(opportunity.symbol);
                const executed = this.virtualWallet.executeTrade(
                    opportunity.side,
                    baseAsset,
                    quoteAsset || 'USDT',
                    quantity,
                    opportunity.price
                );
                
                if (executed) {
                    trade.status = 'open';
                    trade.executedAt = Date.now();
                    console.log(`📊 [DEMO] Trade executed: ${trade.side} ${trade.symbol} @ ${trade.entryPrice}`);
                } else {
                    trade.status = 'failed';
                    trade.error = 'Insufficient balance in virtual wallet';
                    console.log(`❌ [DEMO] Trade failed: Insufficient balance`);
                }
            } else {
                // Live mode - real execution (system-level)
                const order = await mexcService.createSystemOrder(
                    opportunity.symbol,
                    'market', // or 'limit'
                    opportunity.side.toLowerCase(),
                    quantity,
                    opportunity.price
                );

                if (order && order.id) {
                    trade.status = 'open';
                    trade.orderId = order.id;
                    trade.executedAt = Date.now();
                    console.log(`✅ [LIVE] Trade executed: ${trade.side} ${trade.symbol} @ ${trade.entryPrice}`);
                } else {
                    trade.status = 'failed';
                    throw new Error('Order execution failed');
                }
            }

            // Add to active trades
            this.activeTrades.set(tradeId, trade);
            this.stats.executedTrades++;

            // Save to database
            await this.saveTrade(trade);

            // Notify via Telegram
            await this.notifyTrade(trade);

        } catch (error) {
            console.error(`Trade execution error for ${tradeId}:`, error);
            trade.status = 'failed';
            trade.error = error.message;
            this.stats.failedTrades++;
        }
    }

    // ============================================================================
    // TRADE MONITORING
    // ============================================================================

    startTradeMonitor() {
        const monitorInterval = setInterval(async () => {
            if (!this.isRunning) return;

            // Monitor all active trades
            for (const [tradeId, trade] of this.activeTrades.entries()) {
                try {
                    await this.monitorTrade(trade);
                } catch (error) {
                    console.error(`Error monitoring trade ${tradeId}:`, error);
                }
            }
        }, 5000); // Check every 5 seconds

        this.scanners.set('tradeMonitor', monitorInterval);
        console.log('✅ Trade Monitor started');
    }

    async monitorTrade(trade) {
        try {
            // Get current price
            const ticker = await mexcService.fetchSystemTicker(trade.symbol);
            if (!ticker) return;

            const currentPrice = parseFloat(ticker.lastPrice);
            const priceChange = currentPrice - trade.entryPrice;
            const profitPercent = (priceChange / trade.entryPrice) * 100;

            // Update trade P&L
            trade.currentPrice = currentPrice;
            trade.profit = priceChange * trade.quantity;
            trade.profitPercent = profitPercent;

            // Update in database
            await this.updateTradePnl(trade);

            // Check exit conditions
            const shouldExit = await this.checkExitConditions(trade);

            if (shouldExit.shouldExit) {
                await this.closeTrade(trade, shouldExit.reason);
            }
        } catch (error) {
            console.error(`Error monitoring trade ${trade.id}:`, error);
        }
    }

    async checkExitConditions(trade) {
        // Take profit: +5%
        if (trade.profitPercent >= 5) {
            return { shouldExit: true, reason: 'take_profit' };
        }

        // Stop loss: -3%
        if (trade.profitPercent <= -3) {
            return { shouldExit: true, reason: 'stop_loss' };
        }

        // Time-based exit (optional - e.g., close after 1 hour)
        const tradeAge = Date.now() - trade.createdAt;
        if (tradeAge > 3600000 && trade.profitPercent > 2) { // 1 hour, 2% profit
            return { shouldExit: true, reason: 'time_based' };
        }

        return { shouldExit: false };
    }

    async closeTrade(trade, reason) {
        try {
            if (this.config.mode === 'demo') {
                // In demo mode, calculate P&L and update virtual wallet
                const [baseAsset, quoteAsset] = this.parseSymbol(trade.symbol);
                const exitSide = trade.side === 'BUY' ? 'SELL' : 'BUY';
                const exitQuantity = trade.quantity;
                const exitPrice = trade.currentPrice || trade.entryPrice;
                
                // Execute opposite trade in virtual wallet
                this.virtualWallet.executeTrade(
                    exitSide,
                    baseAsset,
                    quoteAsset || 'USDT',
                    exitQuantity,
                    exitPrice
                );
                
                trade.status = 'closed';
                trade.exitPrice = trade.currentPrice;
                trade.exitReason = reason;
                trade.closedAt = Date.now();
                console.log(`📊 [DEMO] Trade closed: ${trade.symbol} @ ${trade.exitPrice} (${reason})`);
            } else {
                // Live mode - execute opposite order (system-level)
                const exitSide = trade.side === 'BUY' ? 'SELL' : 'BUY';
                const order = await mexcService.createSystemOrder(
                    trade.symbol,
                    'market',
                    exitSide.toLowerCase(),
                    trade.quantity
                );

                if (order && order.id) {
                    trade.status = 'closed';
                    trade.exitPrice = trade.currentPrice;
                    trade.exitOrderId = order.id;
                    trade.exitReason = reason;
                    trade.closedAt = Date.now();
                    console.log(`✅ [LIVE] Trade closed: ${trade.symbol} @ ${trade.exitPrice} (${reason})`);
                } else {
                    throw new Error('Exit order failed');
                }
            }

            // Update stats
            if (trade.profit > 0) {
                this.stats.successfulTrades++;
                this.stats.totalProfit += trade.profit;
                this.stats.dailyProfit += trade.profit;
            } else {
                this.stats.failedTrades++;
                this.stats.totalProfit += trade.profit;
                this.stats.dailyProfit += trade.profit;
                this.stats.dailyLoss += Math.abs(trade.profit);
            }

            // Remove from active trades
            this.activeTrades.delete(trade.id);

            // Update in database
            await this.updateTrade(trade);

            // Notify
            await this.notifyTradeClose(trade);

        } catch (error) {
            console.error(`Error closing trade ${trade.id}:`, error);
            trade.error = error.message;
        }
    }

    // ============================================================================
    // RISK MONITORING
    // ============================================================================

    startRiskMonitor() {
        const riskInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                // Check daily limits
                const portfolio = await this.getPortfolioValue();
                const dailyLossLimit = portfolio * this.config.riskLimits.maxDailyLoss;

                if (this.stats.dailyLoss >= dailyLossLimit) {
                    console.warn('⚠️ Daily loss limit reached! Stopping trading...');
                    await this.emergencyStop('daily_loss_limit');
                }

                // Check drawdown
                const drawdown = this.calculateDrawdown();
                if (drawdown >= this.config.riskLimits.maxDrawdown) {
                    console.warn('⚠️ Max drawdown reached! Stopping trading...');
                    await this.emergencyStop('max_drawdown');
                }

            } catch (error) {
                console.error('Risk monitor error:', error);
            }
        }, 60000); // Check every minute

        this.scanners.set('riskMonitor', riskInterval);
        console.log('✅ Risk Monitor started');
    }

    async emergencyStop(reason) {
        console.log(`🛑 Emergency stop triggered: ${reason}`);
        
        // Close all open trades
        for (const [tradeId, trade] of this.activeTrades.entries()) {
            await this.closeTrade(trade, `emergency_${reason}`);
        }

        // Disable trading
        this.config.enabled = false;
        await this.saveConfig();

        // Notify
        await telegramService.sendMessage(
            `🚨 *Trading Engine Emergency Stop*\n\nReason: ${reason}\nAll positions closed.`
        );
    }

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    async getAllTradingSymbols() {
        try {
            // Get all USDT pairs from MEXC
            const exchangeInfo = await mexcService.getSystemExchangeInfo();
            if (exchangeInfo && exchangeInfo.symbols) {
                return exchangeInfo.symbols
                    .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
                    .map(s => s.symbol);
            }
            return [];
        } catch (error) {
            console.error('Error getting trading symbols:', error);
            return [];
        }
    }

    async callPatternAgent(symbol) {
        try {
            // Call Pattern Recognition Agent (existing system)
            // This would integrate with your existing Agent API
            // For now, return mock data
            return {
                signal: 'BULLISH',
                patternName: 'Double Bottom',
                confidence: 75,
                price: 50000,
            };
        } catch (error) {
            console.error(`Error calling pattern agent for ${symbol}:`, error);
            return null;
        }
    }

    async getPortfolioValue() {
        try {
            // Get total portfolio value from database
            const result = await query(
                'SELECT SUM(balance_usd) as total FROM portfolios WHERE user_id IS NULL'
            );
            return parseFloat(result.rows[0]?.total || 10000); // Default $10k
        } catch (error) {
            console.error('Error getting portfolio value:', error);
            return 10000; // Default
        }
    }

    calculateDrawdown() {
        // Calculate current drawdown
        const peak = this.stats.totalProfit;
        const current = this.stats.totalProfit - this.stats.dailyLoss;
        if (peak <= 0) return 0;
        return Math.abs((current - peak) / peak);
    }

    async saveTrade(trade) {
        try {
            await query(
                `INSERT INTO trades (
                    id, symbol, side, type, entry_price, quantity, status, 
                    opportunity_data, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                    trade.id,
                    trade.symbol,
                    trade.side,
                    trade.type,
                    trade.entryPrice,
                    trade.quantity,
                    trade.status,
                    JSON.stringify(trade.opportunity),
                ]
            );
        } catch (error) {
            console.error('Error saving trade:', error);
        }
    }

    async updateTrade(trade) {
        try {
            await query(
                `UPDATE trades SET
                    status = $1,
                    exit_price = $2,
                    exit_reason = $3,
                    profit = $4,
                    profit_percent = $5,
                    closed_at = $6,
                    updated_at = NOW()
                WHERE id = $7`,
                [
                    trade.status,
                    trade.exitPrice,
                    trade.exitReason,
                    trade.profit,
                    trade.profitPercent,
                    trade.closedAt ? new Date(trade.closedAt) : null,
                    trade.id,
                ]
            );
        } catch (error) {
            console.error('Error updating trade:', error);
        }
    }

    async updateTradePnl(trade) {
        try {
            await query(
                `UPDATE trades SET
                    profit = $1,
                    profit_percent = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status = 'open'`,
                [
                    trade.profit,
                    trade.profitPercent,
                    trade.id,
                ]
            );
        } catch (error) {
            console.error('Error updating trade P&L:', error);
        }
    }

    async notifyTrade(trade) {
        try {
            const message = `📊 *New Trade Executed*\n\n` +
                `Symbol: ${trade.symbol}\n` +
                `Side: ${trade.side}\n` +
                `Price: $${trade.entryPrice}\n` +
                `Quantity: ${trade.quantity.toFixed(4)}\n` +
                `Type: ${trade.type}\n` +
                `Mode: ${this.config.mode.toUpperCase()}`;

            await telegramService.sendMessage(message);
        } catch (error) {
            console.error('Error sending trade notification:', error);
        }
    }

    async notifyTradeClose(trade) {
        try {
            const profitEmoji = trade.profit > 0 ? '✅' : '❌';
            const message = `${profitEmoji} *Trade Closed*\n\n` +
                `Symbol: ${trade.symbol}\n` +
                `Entry: $${trade.entryPrice}\n` +
                `Exit: $${trade.exitPrice}\n` +
                `P&L: $${trade.profit.toFixed(2)} (${trade.profitPercent.toFixed(2)}%)\n` +
                `Reason: ${trade.exitReason}`;

            await telegramService.sendMessage(message);
        } catch (error) {
            console.error('Error sending trade close notification:', error);
        }
    }

    // ============================================================================
    // STATUS & STATS
    // ============================================================================

    getStatus() {
        return {
            isRunning: this.isRunning,
            mode: this.config.mode,
            activeTrades: this.activeTrades.size,
            maxConcurrentTrades: this.maxConcurrentTrades,
            queueSize: this.opportunityQueue.length,
            stats: { ...this.stats },
            scanners: Array.from(this.scanners.keys()),
        };
    }

    getActiveTrades() {
        return Array.from(this.activeTrades.values());
    }

    getOpportunityQueue() {
        return this.opportunityQueue;
    }

    getQueueSize() {
        return this.opportunityQueue.length;
    }
}

export const tradingEngine = new TradingEngine();

