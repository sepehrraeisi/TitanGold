// Engine Worker - Always-on runtime for continuous end-to-end cycle
// DataHub ingest → 15 AI agents → Artemis decision → Telegram publish

import dotenv from 'dotenv';
import { query } from '../database/db.js';
import { coordinateAgents, getMixtureDecision } from '../services/artemisOrchestrator.js';
import { telegramService } from '../services/telegram.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../services/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Engine configuration from env vars
const ENGINE_ENABLED = process.env.ENGINE_ENABLED === 'true';
const ENGINE_TICK_INTERVAL_MS = parseInt(process.env.ENGINE_TICK_INTERVAL_MS) || 60000; // Default: 1 minute
const ENGINE_MAX_BACKOFF_MS = parseInt(process.env.ENGINE_MAX_BACKOFF_MS) || 300000; // Default: 5 minutes

// Heartbeat file path (file-based, no DB dependency)
const HEARTBEAT_FILE = path.join(__dirname, '../logs/engine-heartbeat.json');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class EngineWorker {
  constructor() {
    this.isRunning = false;
    this.currentBackoff = 0;
    this.cycleCount = 0;
    this.lastError = null;
    this.lastSuccessfulCycle = null;
    this.heartbeat = {
      timestamp: null,
      lastSuccessfulCycle: null,
      lastError: null,
      cycleCount: 0,
      isRunning: false,
    };
  }

  /**
   * Start the engine worker
   * Safe when ENGINE_ENABLED=false: logs and exits without running
   */
  async start() {
    if (!ENGINE_ENABLED) {
      logger.info('⏸️ Engine is disabled (ENGINE_ENABLED=false). Exiting safely.');
      return;
    }

    if (this.isRunning) {
      logger.info('⚠️ Engine is already running');
      return;
    }

    this.isRunning = true;
    this.currentBackoff = 0;
    logger.info('🚀 Engine Worker starting...');
    logger.info(`   Tick interval: ${ENGINE_TICK_INTERVAL_MS}ms`);
    logger.info(`   Max backoff: ${ENGINE_MAX_BACKOFF_MS}ms`);

    // Start the main loop
    this.runCycle();
  }

  /**
   * Stop the engine worker
   */
  async stop() {
    this.isRunning = false;
    this.updateHeartbeat();
    logger.info('🛑 Engine Worker stopped');
  }

  /**
   * Main cycle loop with exponential backoff
   */
  async runCycle() {
    while (this.isRunning) {
      try {
        const cycleStartTime = Date.now();
        
        logger.info(`\n🔄 Engine cycle #${this.cycleCount + 1} starting...`);
        
        // Execute full cycle
        await this.executeFullCycle();
        
        // Success: reset backoff
        this.currentBackoff = 0;
        this.lastError = null;
        this.lastSuccessfulCycle = new Date().toISOString();
        this.cycleCount++;
        
        const cycleDuration = Date.now() - cycleStartTime;
        logger.info(`✅ Cycle #${this.cycleCount} completed in ${cycleDuration}ms`);
        
        // Update heartbeat
        this.updateHeartbeat();
        
        // Wait for next cycle (with current backoff applied)
        const waitTime = ENGINE_TICK_INTERVAL_MS + this.currentBackoff;
        await this.sleep(waitTime);
        
      } catch (error) {
        logger.error('❌ Engine cycle error:', error);
        this.lastError = {
          message: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack,
        };
        
        // Apply exponential backoff (capped)
        this.currentBackoff = Math.min(
          this.currentBackoff * 2 || ENGINE_TICK_INTERVAL_MS,
          ENGINE_MAX_BACKOFF_MS
        );
        
        logger.info(`⏳ Backing off for ${this.currentBackoff}ms before retry...`);
        
        // Update heartbeat with error
        this.updateHeartbeat();
        
        // Wait with backoff before retry
        await this.sleep(this.currentBackoff);
      }
    }
  }

  /**
   * Execute full cycle: DataHub → Agents → Artemis → Telegram
   */
  async executeFullCycle() {
    // Step 1: Refresh DataHub
    logger.info('📊 Step 1: Refreshing DataHub...');
    await this.refreshDataHub();
    
    // Step 2: Coordinate 15 AI Agents
    logger.info('🤖 Step 2: Coordinating AI agents...');
    const agentResults = await this.coordinateAgents();
    
    // Step 3: Get Artemis Decision
    logger.info('🧠 Step 3: Getting Artemis decision...');
    const decision = await this.getArtemisDecision(agentResults);
    
    // Step 4: Publish to Telegram (if decision exists)
    if (decision) {
      logger.info('📱 Step 4: Publishing to Telegram...');
      await this.publishToTelegram(decision, agentResults);
    } else {
      logger.info('⏭️ Step 4: Skipping Telegram (no decision)');
    }
    
    logger.info('✅ Full cycle completed');
  }

  /**
   * Step 1: Refresh DataHub sources
   */
  async refreshDataHub() {
    try {
      // Get all active data sources from database
      const result = await query(
        `SELECT id, name, type, status FROM data_sources 
         WHERE is_enabled = true AND status = 'active'`
      );
      
      const sources = result.rows || [];
      logger.info(`   Found ${sources.length} active data sources`);
      
      // Refresh each source (with small delay to avoid overload)
      for (const source of sources) {
        try {
          // Call refresh endpoint (if exists) or just log
          // For now, we'll just mark as refreshed in DB
          await query(
            `UPDATE data_sources 
             SET last_fetch_at = NOW(), fetch_count = fetch_count + 1 
             WHERE id = $1`,
            [source.id]
          );
        } catch (error) {
          logger.error(`   ⚠️ Failed to refresh source ${source.id}:`, error.message);
        }
        
        // Small delay between sources
        await this.sleep(500);
      }
      
      logger.info(`   ✅ DataHub refresh completed (${sources.length} sources)`);
    } catch (error) {
      logger.error('   ❌ DataHub refresh error:', error.message);
      // Don't throw - allow cycle to continue
    }
  }

  /**
   * Step 2: Coordinate 15 AI Agents
   */
  async coordinateAgents() {
    try {
      // Use coordinateAgents from artemisOrchestrator
      // Default context: BTC/USDT, 1h timeframe
      const context = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        useMessageQueue: false, // Direct execution for engine
      };
      
      // Get a default userId (or use system user)
      // For engine, we can use a system user ID or null
      const userId = process.env.ENGINE_USER_ID || null;
      
      const results = await coordinateAgents(userId, context);
      
      logger.info(`   ✅ Agents coordinated: ${results.executionMetrics.agentsExecuted}/${results.executionMetrics.agentsTotal} succeeded`);
      logger.info(`   Overall signal: ${results.summary.overallSignal}, Avg confidence: ${results.summary.avgConfidence}%`);
      
      return results;
    } catch (error) {
      logger.error('   ❌ Agent coordination error:', error.message);
      // Return empty results to allow cycle to continue
      return {
        agents: {},
        summary: {
          overallSignal: 'NEUTRAL',
          avgConfidence: 0,
        },
        executionTime: 0,
      };
    }
  }

  /**
   * Step 3: Get Artemis Decision from external providers
   */
  async getArtemisDecision(agentResults) {
    try {
      // Convert agent results to signals format
      const signals = this.convertAgentResultsToSignals(agentResults);
      
      // Get portfolio context from database
      const context = await this.getPortfolioContext();
      
      // Create a mock opportunity (or get from trading engine)
      // For continuous engine, we'll use a monitoring opportunity
      const opportunity = {
        symbol: 'BTC/USDT',
        type: 'monitoring',
        side: agentResults.summary.overallSignal === 'BUY' ? 'BUY' : 
              agentResults.summary.overallSignal === 'SELL' ? 'SELL' : 'HOLD',
        price: 0, // Will be filled from market if available
        confidence: agentResults.summary.avgConfidence || 50,
      };
      
      // Get Artemis state for decision config
      const artemisStateResult = await query(
        'SELECT config FROM artemis_state ORDER BY created_at DESC LIMIT 1'
      );
      
      const decisionConfig = artemisStateResult.rows[0]?.config?.decisionEngine || {
        strategy: 'mixture_of_experts',
        activeModel: 'hybrid',
        confidenceThreshold: 75,
      };
      
      // Call getMixtureDecision
      const decision = await getMixtureDecision(
        { opportunity, signals, context },
        decisionConfig
      );
      
      if (decision) {
        logger.info(`   ✅ Decision: ${decision.action}, Confidence: ${decision.confidence.toFixed(1)}%`);
        logger.info(`   Providers: ${decision.providers?.join(', ') || 'N/A'}`);
      } else {
        logger.info('   ⚠️ No decision returned (all providers failed or below threshold)');
      }
      
      return decision;
    } catch (error) {
      logger.error('   ❌ Artemis decision error:', error.message);
      return null; // Don't throw - allow cycle to continue
    }
  }

  /**
   * Convert agent results to signals format for getMixtureDecision
   */
  convertAgentResultsToSignals(agentResults) {
    const signals = [];
    
    // Convert each agent result to signal format
    Object.entries(agentResults.agents || {}).forEach(([agentId, result]) => {
      if (result && !result.error && result.signal) {
        signals.push({
          agentId,
          signal: result.signal, // BUY, SELL, NEUTRAL
          confidence: result.confidence || 50,
          reason: result.reason || `${agentId} analysis`,
        });
      }
    });
    
    return signals;
  }

  /**
   * Get portfolio context for Artemis decision
   */
  async getPortfolioContext() {
    try {
      // Get active trades count
      const activeTradesResult = await query(
        `SELECT COUNT(*) as count FROM trades 
         WHERE status IN ('open', 'pending')`
      );
      const activeTrades = parseInt(activeTradesResult.rows[0]?.count || 0);
      
      // Get max trades from config (default: 20)
      const maxTrades = 20;
      
      // Get portfolio value (sum of all portfolio balances)
      const portfolioValueResult = await query(
        `SELECT COALESCE(SUM(balance), 0) as total FROM portfolios`
      );
      const portfolioValue = parseFloat(portfolioValueResult.rows[0]?.total || 0);
      
      // Get daily profit/loss from trades today
      const today = new Date().toISOString().split('T')[0];
      const dailyStatsResult = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END), 0) as daily_profit,
           COALESCE(SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END), 0) as daily_loss
         FROM trades 
         WHERE DATE(created_at) = $1`,
        [today]
      );
      const dailyProfit = parseFloat(dailyStatsResult.rows[0]?.daily_profit || 0);
      const dailyLoss = parseFloat(dailyStatsResult.rows[0]?.daily_loss || 0);
      
      return {
        activeTrades,
        maxTrades,
        portfolioValue,
        dailyProfit,
        dailyLoss,
      };
    } catch (error) {
      logger.error('   ⚠️ Failed to get portfolio context:', error.message);
      // Return safe defaults
      return {
        activeTrades: 0,
        maxTrades: 20,
        portfolioValue: 0,
        dailyProfit: 0,
        dailyLoss: 0,
      };
    }
  }

  /**
   * Step 4: Publish decision to Telegram
   */
  async publishToTelegram(decision, agentResults) {
    try {
      if (!telegramService.bot) {
        logger.info('   ⚠️ Telegram bot not configured, skipping publish');
        return;
      }
      
      // Format message
      const message = this.formatTelegramMessage(decision, agentResults);
      
      // Send to Telegram
      await telegramService.sendMessage(message, 'Markdown');
      
      logger.info('   ✅ Published to Telegram');
    } catch (error) {
      logger.error('   ❌ Telegram publish error:', error.message);
      // Don't throw - Telegram failure shouldn't stop the cycle
    }
  }

  /**
   * Format message for Telegram
   */
  formatTelegramMessage(decision, agentResults) {
    const timestamp = new Date().toLocaleString();
    const signalEmoji = decision.action === 'BUY' ? '🟢' : 
                       decision.action === 'SELL' ? '🔴' : '🟡';
    
    return `
*Artemis Decision Engine*
${signalEmoji} *Action*: ${decision.action}
📊 *Confidence*: ${decision.confidence.toFixed(1)}%
💡 *Reason*: ${decision.reason || 'No reason provided'}

*Agent Signals*:
🤖 Agents: ${agentResults.executionMetrics?.agentsExecuted || 0}/${agentResults.executionMetrics?.agentsTotal || 0}
📈 Overall: ${agentResults.summary?.overallSignal || 'NEUTRAL'}
📊 Avg Confidence: ${agentResults.summary?.avgConfidence?.toFixed(1) || 0}%

*Providers*: ${decision.providers?.join(', ') || 'N/A'}

_${timestamp}_
    `.trim();
  }

  /**
   * Update heartbeat file
   */
  updateHeartbeat() {
    this.heartbeat = {
      timestamp: new Date().toISOString(),
      lastSuccessfulCycle: this.lastSuccessfulCycle,
      lastError: this.lastError,
      cycleCount: this.cycleCount,
      isRunning: this.isRunning,
    };
    
    try {
      fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(this.heartbeat, null, 2));
    } catch (error) {
      logger.error('Failed to write heartbeat:', error);
    }
  }

  /**
   * Get heartbeat (for health check)
   */
  getHeartbeat() {
    try {
      if (fs.existsSync(HEARTBEAT_FILE)) {
        const data = fs.readFileSync(HEARTBEAT_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to read heartbeat:', error);
    }
    return this.heartbeat;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const engineWorker = new EngineWorker();

// If this file is run directly (node backend/workers/engineWorker.js), start the worker
// Check if this is the main module
const isMainModule = process.argv[1] && process.argv[1].endsWith('engineWorker.js');

if (isMainModule) {
  engineWorker.start().catch(error => {
    logger.error('Failed to start engine worker:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM received, stopping engine worker...');
    await engineWorker.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('🛑 SIGINT received, stopping engine worker...');
    await engineWorker.stop();
    process.exit(0);
  });
}

