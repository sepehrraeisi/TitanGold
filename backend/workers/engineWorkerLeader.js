#!/usr/bin/env node
/**
 * Engine Worker - Leader Process for Autopilot, Scheduler, and Trading Engine
 * با قابلیت Idle Mode: وقتی کاری نیست، backoff می‌کند (نه query storm)
 */

import dotenv from 'dotenv';
import { query } from '../database/db.js';
import { autopilot } from '../engine/autopilot.js';
import { scheduler } from '../engine/scheduler.js';
import { tradingEngine } from '../engine/tradingEngine.js';
import { messageQueue } from '../services/messageQueue.js';

dotenv.config();

// Configuration
const IDLE_CHECK_INTERVAL_MS = parseInt(process.env.IDLE_CHECK_INTERVAL_MS) || 5000; // 5s initial
const IDLE_BACKOFF_LEVELS = [5000, 15000, 60000, 300000]; // 5s → 15s → 1min → 5min
let currentBackoffLevel = 0;
let isIdle = false;
let consecutiveIdleChecks = 0;

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
      console.log('⚠️ Engine Worker already running');
      return;
    }

    console.log('🚀 Engine Worker Leader starting...');
    this.isRunning = true;

    // Connect message queue
    try {
      await messageQueue.connect();
      console.log('✅ Message Queue connected');
    } catch (error) {
      console.warn('⚠️ Message Queue unavailable, using fallback:', error.message);
    }

    // Start idle mode checker
    this.startIdleChecker();
  }

  /**
   * بررسی دوره‌ای: آیا کاری هست یا نه؟
   */
  async startIdleChecker() {
    console.log(`🔍 Starting idle checker (interval: ${IDLE_CHECK_INTERVAL_MS}ms)`);
    
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
            console.log('💤 No active work detected, entering Idle Mode');
            isIdle = true;
          }
          
          // Increase backoff progressively
          if (consecutiveIdleChecks > 3 && currentBackoffLevel < IDLE_BACKOFF_LEVELS.length - 1) {
            currentBackoffLevel++;
            const newInterval = IDLE_BACKOFF_LEVELS[currentBackoffLevel];
            console.log(`⏸️ Idle backoff increased to ${newInterval / 1000}s (level ${currentBackoffLevel})`);
            
            // Reschedule with new interval
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = setInterval(checkAndAct, newInterval);
          }
        }
      } catch (error) {
        console.error('❌ Error in idle checker:', error.message);
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
        console.log(`✅ Work detected: connections=${hasConnections}, users=${hasActiveUsers}, jobs=${hasPendingJobs}`);
      } else if (!hasWork && consecutiveIdleChecks % 10 === 0) {
        // Log every 10th idle check to avoid spam
        console.log(`💤 No work: sleeping... (backoff level: ${currentBackoffLevel})`);
      }

      return hasWork;
    } catch (error) {
      console.error('❌ Error checking for work:', error.message);
      return false; // On error, assume no work
    }
  }

  /**
   * شروع Engines
   */
  async startEngines() {
    if (this.enginesStarted) return;

    console.log('🚀 Starting engines...');

    // Start Autopilot
    if (process.env.AUTOPILOT_ENABLED === 'true') {
      try {
        autopilot.start();
        console.log('✅ Autopilot started');
      } catch (error) {
        console.error('❌ Failed to start Autopilot:', error);
      }
    }

    // Start Scheduler
    if (process.env.SCHEDULER_ENABLED === 'true') {
      try {
        scheduler.start();
        console.log('✅ Scheduler started');
      } catch (error) {
        console.error('❌ Failed to start Scheduler:', error);
      }
    }

    // Start Trading Engine
    if (process.env.TRADING_ENGINE_ENABLED === 'true') {
      try {
        tradingEngine.start();
        console.log('✅ Trading Engine started');
      } catch (error) {
        console.error('❌ Failed to start Trading Engine:', error);
      }
    }

    this.enginesStarted = true;
  }

  /**
   * توقف Engine Worker
   */
  async stop() {
    console.log('🛑 Stopping Engine Worker...');
    this.isRunning = false;

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Stop engines
    try {
      if (autopilot.stop) autopilot.stop();
      if (scheduler.stop) scheduler.stop();
      if (tradingEngine.stop) tradingEngine.stop();
    } catch (error) {
      console.error('Error stopping engines:', error);
    }

    // Close message queue
    try {
      await messageQueue.close();
    } catch (error) {
      console.error('Error closing message queue:', error);
    }

    console.log('✅ Engine Worker stopped');
  }
}

// Create and start worker
const worker = new EngineWorkerLeader();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📡 SIGINT received, shutting down...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📡 SIGTERM received, shutting down...');
  await worker.stop();
  process.exit(0);
});

// Start worker
worker.start().catch((error) => {
  console.error('❌ Failed to start Engine Worker:', error);
  process.exit(1);
});

export { worker as engineWorker };
