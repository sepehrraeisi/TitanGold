#!/usr/bin/env node
/**
 * Engine Worker - Leader Process for Autopilot, Scheduler, and Trading Engine
 * با قابلیت Idle Mode: وقتی کاری نیست، backoff می‌کند (نه query storm)
 */

import dotenv from 'dotenv';
import { query } from '../database/db.js';
import { messageQueue } from '../services/messageQueue.js';
import { logger } from '../services/logger.js';

dotenv.config();

// 🔍 BOOT LOG
logger.info('🚀 engineWorkerLeader booting', {
  pid: process.pid,
  node: process.version,
  cwd: process.cwd(),
  env: {
    IDLE_MODE_ENABLED: process.env.IDLE_MODE_ENABLED,
    IDLE_CHECK_INTERVAL_MS: process.env.IDLE_CHECK_INTERVAL_MS,
    AUTOPILOT_ENABLED: process.env.AUTOPILOT_ENABLED,
    SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED,
    TRADING_ENGINE_ENABLED: process.env.TRADING_ENGINE_ENABLED,
  },
});

// Configuration
const IDLE_CHECK_INTERVAL_MS = parseInt(process.env.IDLE_CHECK_INTERVAL_MS) || 5000; // 5s initial
const IDLE_BACKOFF_LEVELS = [5000, 15000, 60000, 300000]; // 5s → 15s → 1min → 5min
let currentBackoffLevel = 0;
let isIdle = false;
let consecutiveIdleChecks = 0;

// Engine instances (loaded dynamically)
let autopilot = null;
let scheduler = null;
let tradingEngine = null;

class EngineWorkerLeader {
  constructor() {
    this.isRunning = false;
    this.enginesStarted = false;
    this.analyticalSchedulerReady = false;
    this.killSwitchMonitorStarted = false;
    this.idleCheckInterval = null;
    this._lastKillSwitchActive = null;
    this._lastTradingStopLogAt = 0;
    this._lastStatusHeartbeatAt = 0;
  }

  /**
   * شروع Engine Worker
   */
  async start() {
    if (this.isRunning) {
      logger.info('⚠️ Engine Worker already running');
      return;
    }

    logger.info('🚀 Engine Worker Leader starting...');
    this.isRunning = true;

    // Connect message queue
    try {
      await messageQueue.connect();
      logger.info('✅ Message Queue connected');
    } catch (error) {
      logger.warn('⚠️ Message Queue unavailable, using fallback:', error.message);
    }

    // Safety-critical: always monitor kill switch, even in idle mode
    this.startKillSwitchMonitor();

    // Start idle mode checker
    this.startIdleChecker();
  }

  /**
   * بررسی دوره‌ای: آیا کاری هست یا نه؟
   */
  async startIdleChecker() {
    logger.info(`🔍 Starting idle checker (interval: ${IDLE_CHECK_INTERVAL_MS}ms)`);
    
    const checkAndAct = async () => {
      if (!this.isRunning) return;

      try {
        // Check if there are active users/connections/jobs
        const hasWork = await this.checkForWork();

        if (hasWork) {
          // Work found: start engines if not already started
          if (!this.enginesStarted) {
            await this.startEngines();
          }
          
          // Reset backoff
          currentBackoffLevel = 0;
          consecutiveIdleChecks = 0;
          isIdle = false;
          
        } else {
          // No work: enter idle mode
          consecutiveIdleChecks++;
          
          if (!isIdle) {
            logger.info('💤 No active work detected, entering Idle Mode');
            isIdle = true;
          }
          
          // Increase backoff progressively
          if (consecutiveIdleChecks > 3 && currentBackoffLevel < IDLE_BACKOFF_LEVELS.length - 1) {
            currentBackoffLevel++;
            const newInterval = IDLE_BACKOFF_LEVELS[currentBackoffLevel];
            logger.info(`⏸️ Idle backoff increased to ${newInterval / 1000}s (level ${currentBackoffLevel})`);
            
            // Reschedule with new interval
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = setInterval(checkAndAct, newInterval);
          }
        }
      } catch (error) {
        logger.error('❌ Error in idle checker:', error.message);
      }
    };

    // Initial check
    await checkAndAct();
    
    // Start interval
    this.idleCheckInterval = setInterval(checkAndAct, IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * بررسی: آیا کاری هست؟
   */
  async checkForWork() {
    try {
      // Check 1: Active exchange connections
      const connectionsResult = await query(
        `SELECT COUNT(*) as count 
         FROM exchange_connections 
         WHERE is_active = true AND api_key IS NOT NULL`,
        []
      );
      const hasConnections = parseInt(connectionsResult.rows[0]?.count || 0) > 0;

      // Check 2: Active users (logged in recently)
      const usersResult = await query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE last_login_at > NOW() - INTERVAL '24 hours'`,
        []
      );
      const hasActiveUsers = parseInt(usersResult.rows[0]?.count || 0) > 0;

      // Check 3: Pending AI jobs
      const jobsResult = await query(
        `SELECT COUNT(*) as count 
         FROM ai_jobs 
         WHERE status IN ('pending', 'running')`,
        []
      );
      const hasPendingJobs = parseInt(jobsResult.rows[0]?.count || 0) > 0;

      const hasWork = hasConnections || hasActiveUsers || hasPendingJobs;

      if (isIdle && hasWork) {
        logger.info(`✅ Work detected: connections=${hasConnections}, users=${hasActiveUsers}, jobs=${hasPendingJobs}`);
      } else if (!hasWork && consecutiveIdleChecks % 10 === 0) {
        // Log every 10th idle check to avoid spam
        logger.info(`💤 No work: sleeping... (backoff level: ${currentBackoffLevel})`);
      }

      return hasWork;
    } catch (error) {
      logger.error('❌ Error checking for work:', error.message);
      return false; // On error, assume no work
    }
  }

  /**
   * شروع Engines با Dynamic Import (فقط یک‌بار)
   */
  async startEngines() {
    if (this.enginesStarted) {
      logger.info('⚠️ Engines already started');
      return;
    }

    logger.info('⚙️ Starting engines (dynamic import)...');
    
    try {
      // Dynamic import to avoid side-effects on module load
      const [
        { autopilot: autopilotModule },
        { scheduler: schedulerModule },
        { tradingEngine: tradingEngineModule }
      ] = await Promise.all([
        import('../engine/autopilot.js'),
        import('../engine/scheduler.js'),
        import('../engine/tradingEngine.js')
      ]);

      // Store references
      autopilot = autopilotModule;
      scheduler = schedulerModule;
      tradingEngine = tradingEngineModule;

      // Runtime state for Emergency Stop separation (AI-FOUNDATION-R2)
      let killSwitchActive = false;
      try {
        const { getRuntimeExecutionState } = await import('../services/runtimeExecutionStateService.js');
        const runtimeState = await getRuntimeExecutionState({ preferCache: false });
        killSwitchActive = runtimeState.killSwitchActive === true;
      } catch (err) {
        logger.warn('Runtime state unavailable at engine start; assuming Emergency Stop active', {
          error: err.message,
        });
        killSwitchActive = true;
      }

      // Autopilot / trading are Live-adjacent — do not start under Emergency Stop
      if (process.env.AUTOPILOT_ENABLED === 'true') {
        if (killSwitchActive) {
          logger.info('⏸️ Autopilot not started — Emergency Stop active');
        } else {
          autopilot.start();
          logger.info('✅ Autopilot started');
        }
      } else {
        logger.info('⏸️ Autopilot disabled');
      }

      if (process.env.SCHEDULER_ENABLED === 'true') {
        if (killSwitchActive) {
          await scheduler.applyEmergencyStopSeparation();
          logger.info('✅ Analytical scheduler started under Emergency Stop separation');
        } else {
          await scheduler.start();
          logger.info('✅ Scheduler started');
        }
        this.analyticalSchedulerReady = true;
      } else {
        logger.info('⏸️ Scheduler disabled');
      }

      if (process.env.TRADING_ENGINE_ENABLED === 'true') {
        if (killSwitchActive) {
          logger.info('⏸️ Trading Engine not started — Emergency Stop active');
        } else {
          tradingEngine.start();
          logger.info('✅ Trading Engine started');
        }
      } else {
        logger.info('⏸️ Trading Engine disabled');
      }

      this.enginesStarted = true;
      logger.info('✅ All engines initialized', {
        killSwitchActive,
        analyticalSchedulerReady: this.analyticalSchedulerReady,
      });
      
    } catch (error) {
      logger.error('❌ Failed to start engines:', error);
      throw error;
    }
  }

  /**
   * Immediate pub/sub + fallback poll for kill-switch propagation.
   */
  startKillSwitchMonitor() {
    if (this.killSwitchMonitorStarted) return;
    this.killSwitchMonitorStarted = true;

    if (this.killSwitchInterval) clearInterval(this.killSwitchInterval);

    const handleState = async (state, source = 'poll') => {
      try {
        const { acknowledgeWorkerState } = await import('../services/runtimeExecutionStateService.js');
        const killActive = state.killSwitchActive === true;
        const transitioned = this._lastKillSwitchActive !== killActive;
        this._lastKillSwitchActive = killActive;

        if (killActive) {
          // AI-FOUNDATION-R2: do NOT call scheduler.stop() — preserve safe analytical timers
          if (scheduler?.applyEmergencyStopSeparation) {
            await scheduler.applyEmergencyStopSeparation();
            this.analyticalSchedulerReady = true;
          } else if (scheduler?.ensureAnalyticalAgentScheduler) {
            await scheduler.ensureAnalyticalAgentScheduler();
          }

          if (autopilot?.stop) {
            try { autopilot.stop(); } catch { /* ignore */ }
          }

          if (tradingEngine?.stop) {
            const now = Date.now();
            // Idempotent: log at most once per transition (or rare heartbeat ≥60s)
            if (transitioned || now - this._lastTradingStopLogAt > 60000) {
              logger.warn(`🛑 Kill switch (${source}): stopping trading engine — ${state.killSwitchReason}`);
              this._lastTradingStopLogAt = now;
            }
            await tradingEngine.stop();
          }

          // Keep worker status fresh between long agent intervals (TTL 700s; refresh ≤60s)
          const nowHb = Date.now();
          if (scheduler?.publishStatus && nowHb - this._lastStatusHeartbeatAt > 60000) {
            this._lastStatusHeartbeatAt = nowHb;
            await scheduler.publishStatus();
          }
        } else if (transitioned) {
          if (scheduler?.clearEmergencyStopSeparation) {
            await scheduler.clearEmergencyStopSeparation();
          }
          logger.info(`Kill switch cleared (${source}) — analytical separation lifted`);
        } else if (scheduler?.ensureAnalyticalAgentScheduler) {
          // Steady state: keep analytical timer healthy without spam
          await scheduler.ensureAnalyticalAgentScheduler();
        }

        await acknowledgeWorkerState({ revision: state.version });
      } catch (err) {
        logger.warn('Kill switch handler error:', err.message);
      }
    };

    import('../services/runtimeExecutionStateService.js').then(async (runtime) => {
      const state = await runtime.getRuntimeExecutionState({ preferCache: false });
      await handleState(state, 'startup');

      const sub = await runtime.subscribeRuntimeEvents(async (event) => {
        if (event?.state) await handleState(event.state, 'pubsub');
      });
      this.runtimeSubscriber = sub;
    }).catch((err) => logger.warn('Runtime pub/sub setup failed:', err.message));

    this.killSwitchInterval = setInterval(async () => {
      try {
        const { getRuntimeExecutionState } = await import('../services/runtimeExecutionStateService.js');
        const state = await getRuntimeExecutionState({ preferCache: false });
        await handleState(state, 'poll');
      } catch (err) {
        logger.warn('Kill switch poll error:', err.message);
      }
    }, 3000);
  }

  /**
   * توقف Engines
   */
  async stopEngines() {
    if (!this.enginesStarted) return;

    logger.info('🛑 Stopping engines...');

    try {
      if (autopilot && autopilot.stop) autopilot.stop();
      if (scheduler && scheduler.stop) scheduler.stop();
      if (tradingEngine && tradingEngine.stop) tradingEngine.stop();
    } catch (error) {
      logger.error('Error stopping engines:', error);
    }

    this.enginesStarted = false;
  }

  /**
   * توقف Engine Worker
   */
  async stop() {
    logger.info('🛑 Stopping Engine Worker...');
    this.isRunning = false;

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Stop engines
    await this.stopEngines();

    // Close message queue
    try {
      await messageQueue.close();
    } catch (error) {
      logger.error('Error closing message queue:', error);
    }

    logger.info('✅ Engine Worker stopped');
  }
}

// Create and start worker
const worker = new EngineWorkerLeader();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n📡 SIGINT received, shutting down...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\n📡 SIGTERM received, shutting down...');
  await worker.stop();
  process.exit(0);
});

// Start worker
worker.start().catch((error) => {
  logger.error('❌ Failed to start Engine Worker:', error);
  process.exit(1);
});

export { worker as engineWorker };
