#!/usr/bin/env node
/**
 * Engine Worker - Leader Process for Autopilot, Scheduler, and Trading Engine
 * با قابلیت Idle Mode: وقتی کاری نیست، backoff می‌کند (نه query storm)
 */

// 🔍 BOOT LOG - Must be first!
logger.info("🚀 engineWorkerLeader booting", {
  pid: process.pid,
  node: process.version,
  cwd: process.cwd(),
  env: {
    IDLE_MODE_ENABLED: process.env.IDLE_MODE_ENABLED,
    IDLE_CHECK_INTERVAL_MS: process.env.IDLE_CHECK_INTERVAL_MS,
    AUTOPILOT_ENABLED: process.env.AUTOPILOT_ENABLED,
    SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED,
    TRADING_ENGINE_ENABLED: process.env.TRADING_ENGINE_ENABLED,
  }
});

import dotenv from 'dotenv';
import { query } from '../database/db.js';
import { messageQueue } from '../services/messageQueue.js';
import { logger } from '../services/logger.js';

dotenv.config();

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
    this.idleCheckInterval = null;
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

      // Start engines based on env
      if (process.env.AUTOPILOT_ENABLED === 'true') {
        autopilot.start();
        logger.info('✅ Autopilot started');
      } else {
        logger.info('⏸️ Autopilot disabled');
      }

      if (process.env.SCHEDULER_ENABLED === 'true') {
        scheduler.start();
        logger.info('✅ Scheduler started');
      } else {
        logger.info('⏸️ Scheduler disabled');
      }

      if (process.env.TRADING_ENGINE_ENABLED === 'true') {
        tradingEngine.start();
        logger.info('✅ Trading Engine started');
      } else {
        logger.info('⏸️ Trading Engine disabled');
      }

      this.enginesStarted = true;
      logger.info('✅ All engines initialized');

      this.startKillSwitchMonitor();
      
    } catch (error) {
      logger.error('❌ Failed to start engines:', error);
      throw error;
    }
  }

  /**
   * Poll shared kill-switch state and stop trading engine when active.
   */
  startKillSwitchMonitor() {
    if (this.killSwitchInterval) clearInterval(this.killSwitchInterval);
    this.killSwitchInterval = setInterval(async () => {
      try {
        const { getRuntimeExecutionState } = await import('../services/runtimeExecutionStateService.js');
        const state = await getRuntimeExecutionState();
        if (state.killSwitchActive && tradingEngine?.stop) {
          logger.warn(`🛑 Kill switch active (${state.killSwitchReason}) — stopping trading engine`);
          await tradingEngine.stop();
        }
      } catch (err) {
        logger.warn('Kill switch monitor error:', err.message);
      }
    }, 15000);
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
