/**
 * Liquidity Agent Routes
 * Phase 3A: Complete backend API endpoints
 * 
 * Pattern: Same as Fundamental/Arbitrage agents
 * Rule: No fake data, no ML metrics, JSONB merge only
 */

import express from 'express'
import { authenticate } from '../middleware/auth.js'
import pool from '../database/db.js'
import { logger } from '../services/logger.js';
// import { LiquidityAnalyzerService } from '../services/liquidity/LiquidityAnalyzerService.js'
// TODO: Enable after implementing MEXC client and filling TODOs

const router = express.Router()

/**
 * GET /api/agents/liquidity/status
 * Get current agent status and configuration
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    // Load settings from DB
    const result = await pool.query(
      `SELECT enabled, mode, symbols, created_at, updated_at
       FROM agent_settings_liquidity
       WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Return default settings if not found
      return res.json({
        status: 'inactive',
        mode: 'demo',
        symbols: ['BTCUSDT'],
        enabled: false,
        lastRunAt: null,
        isRunning: false
      })
    }

    const settings = result.rows[0]

    // Get last run time
    const lastRun = await pool.query(
      `SELECT started_at FROM agent_runs_liquidity
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    )

    return res.json({
      status: settings.enabled ? 'active' : 'inactive',
      mode: settings.mode,
      symbols: settings.symbols,
      enabled: settings.enabled,
      lastRunAt: lastRun.rows[0]?.started_at || null,
      isRunning: false  // TODO: Track running state
    })
  } catch (error) {
    logger.error('Error fetching liquidity agent status:', error)
    return res.status(500).json({
      error: 'Failed to fetch status',
      message: error.message
    })
  }
})

/**
 * POST /api/agents/liquidity/run
 * Execute liquidity analysis for a symbol
 * 
 * Body: { symbol: 'BTCUSDT' }
 */
router.post('/run', authenticate, async (req, res) => {
  try {
    const { symbol } = req.body
    const userId = req.user.id

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    // 1️⃣ Load settings
    const settingsResult = await pool.query(
      `SELECT enabled, mode, depth_levels, slippage_thresholds
       FROM agent_settings_liquidity
       WHERE user_id = $1`,
      [userId]
    )

    if (settingsResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Agent not configured',
        message: 'Please configure the liquidity agent first'
      })
    }

    const settings = settingsResult.rows[0]

    if (!settings.enabled) {
      return res.status(400).json({
        error: 'Agent disabled',
        message: 'Please enable the agent first'
      })
    }

    // 2️⃣ TODO: Fetch market data from MEXC
    // For now, return error until MEXC client is implemented
    return res.status(501).json({
      error: 'Not implemented',
      message: 'MEXC API integration pending',
      todo: [
        'Implement MEXC order book fetching',
        'Implement MEXC recent trades fetching',
        'Implement MEXC 24h volume fetching',
        'Fill LiquidityAnalyzerService TODOs'
      ]
    })

    // 3️⃣ Analyze (will be enabled after MEXC integration)
    // const analyzer = new LiquidityAnalyzerService(symbol)
    // const result = await analyzer.analyze(orderBook, trades, volume24h)

    // 4️⃣ Save run to DB
    // await saveLiquidityRun(userId, symbol, result)

    // 5️⃣ Update metrics
    // await updateLiquidityMetrics(userId, result)

    // res.json({ success: true, result })
  } catch (error) {
    logger.error('Error running liquidity analysis:', error)
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    })
  }
})

/**
 * GET /api/agents/liquidity/runs/latest
 * Get the most recent analysis result
 */
router.get('/runs/latest', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `SELECT 
         id, symbol, started_at, finished_at, status,
         liquidity_score, risk_level,
         orderbook_snapshot, liquidity_metrics,
         slippage_metrics, capital_flow, alerts_triggered
       FROM agent_runs_liquidity
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({ result: null })
    }

    const run = result.rows[0]

    return res.json({
      result: {
        id: run.id,
        symbol: run.symbol,
        timestamp: run.started_at,
        liquidityScore: run.liquidity_score,
        riskLevel: run.risk_level,
        status: run.status,
        executionTime: run.finished_at 
          ? new Date(run.finished_at) - new Date(run.started_at)
          : null,
        
        // Parse JSONB fields
        orderBook: run.orderbook_snapshot,
        liquidityMetrics: run.liquidity_metrics,
        slippageMetrics: run.slippage_metrics,
        capitalFlow: run.capital_flow,
        alerts: run.alerts_triggered
      }
    })
  } catch (error) {
    logger.error('Error fetching latest liquidity run:', error)
    return res.status(500).json({
      error: 'Failed to fetch latest run',
      message: error.message
    })
  }
})

/**
 * GET /api/agents/liquidity/runs?limit=50
 * Get recent analysis history
 */
router.get('/runs', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const limit = Math.min(parseInt(req.query.limit || 50), 100)

    const result = await pool.query(
      `SELECT 
         id, symbol, started_at, finished_at, status,
         liquidity_score, risk_level,
         alerts_triggered
       FROM agent_runs_liquidity
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [userId, limit]
    )

    return res.json({
      runs: result.rows.map(run => ({
        id: run.id,
        symbol: run.symbol,
        timestamp: run.started_at,
        liquidityScore: run.liquidity_score,
        riskLevel: run.risk_level,
        status: run.status,
        alertsCount: run.alerts_triggered?.length || 0
      }))
    })
  } catch (error) {
    logger.error('Error fetching liquidity runs:', error)
    return res.status(500).json({
      error: 'Failed to fetch runs',
      message: error.message
    })
  }
})

/**
 * GET /api/agents/liquidity/metrics
 * Get aggregated metrics
 */
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `SELECT 
         total_scans, active_hours,
         avg_liquidity_score, avg_spread, avg_depth_100k,
         last_scan_at
       FROM agent_metrics_liquidity
       WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({
        metrics: {
          totalScans: 0,
          activeHours: 0,
          avgLiquidityScore: 0,
          avgSpread: 0,
          avgDepth: 0,
          lastScanAt: null
        }
      })
    }

    const metrics = result.rows[0]

    return res.json({
      metrics: {
        totalScans: metrics.total_scans,
        activeHours: parseFloat(metrics.active_hours),
        avgLiquidityScore: parseFloat(metrics.avg_liquidity_score),
        avgSpread: parseFloat(metrics.avg_spread),
        avgDepth: parseFloat(metrics.avg_depth_100k),
        lastScanAt: metrics.last_scan_at
      }
    })
  } catch (error) {
    logger.error('Error fetching liquidity metrics:', error)
    return res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error.message
    })
  }
})

/**
 * GET /api/agents/liquidity/settings
 * Get user settings
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `SELECT enabled, mode, symbols, depth_levels, 
              slippage_thresholds, alert_rules, integrations
       FROM agent_settings_liquidity
       WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Return default settings
      return res.json({
        settings: {
          enabled: false,
          mode: 'demo',
          symbols: ['BTCUSDT'],
          depthLevels: [0.1, 0.5, 1, 2],
          slippageThresholds: {
            low: 0.1,
            medium: 0.5,
            high: 1.0
          },
          alertRules: {
            liquidityDrop: { enabled: true, threshold: 40 },
            spreadWiden: { enabled: true, threshold: 0.3 },
            imbalance: { enabled: true, threshold: 0.4 },
            slippageHigh: { enabled: true, threshold: 0.5 }
          },
          integrations: {
            dashboard: true,
            telegram: false
          }
        }
      })
    }

    const settings = result.rows[0]

    return res.json({
      settings: {
        enabled: settings.enabled,
        mode: settings.mode,
        symbols: settings.symbols,
        depthLevels: settings.depth_levels,
        slippageThresholds: settings.slippage_thresholds,
        alertRules: settings.alert_rules,
        integrations: settings.integrations
      }
    })
  } catch (error) {
    logger.error('Error fetching liquidity settings:', error)
    return res.status(500).json({
      error: 'Failed to fetch settings',
      message: error.message
    })
  }
})

/**
 * POST /api/agents/liquidity/settings
 * Update user settings
 * 
 * CRITICAL: Use JSONB merge, NOT overwrite
 */
router.post('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const newSettings = req.body

    // Check if settings exist
    const existing = await pool.query(
      `SELECT id FROM agent_settings_liquidity WHERE user_id = $1`,
      [userId]
    )

    if (existing.rows.length === 0) {
      // Insert new settings
      await pool.query(
        `INSERT INTO agent_settings_liquidity (
          user_id, enabled, mode, symbols, depth_levels,
          slippage_thresholds, alert_rules, integrations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          newSettings.enabled || false,
          newSettings.mode || 'demo',
          newSettings.symbols || ['BTCUSDT'],
          newSettings.depthLevels || [0.1, 0.5, 1, 2],
          JSON.stringify(newSettings.slippageThresholds || {}),
          JSON.stringify(newSettings.alertRules || {}),
          JSON.stringify(newSettings.integrations || {})
        ]
      )
    } else {
      // Update existing (selective fields only)
      const updates = []
      const values = []
      let paramCount = 1

      if (newSettings.enabled !== undefined) {
        updates.push(`enabled = $${paramCount++}`)
        values.push(newSettings.enabled)
      }

      if (newSettings.mode !== undefined) {
        updates.push(`mode = $${paramCount++}`)
        values.push(newSettings.mode)
      }

      if (newSettings.symbols !== undefined) {
        updates.push(`symbols = $${paramCount++}`)
        values.push(newSettings.symbols)
      }

      if (newSettings.depthLevels !== undefined) {
        updates.push(`depth_levels = $${paramCount++}`)
        values.push(newSettings.depthLevels)
      }

      // JSONB merge for complex fields
      if (newSettings.slippageThresholds !== undefined) {
        updates.push(`slippage_thresholds = COALESCE(slippage_thresholds, '{}'::jsonb) || $${paramCount++}::jsonb`)
        values.push(JSON.stringify(newSettings.slippageThresholds))
      }

      if (newSettings.alertRules !== undefined) {
        updates.push(`alert_rules = COALESCE(alert_rules, '{}'::jsonb) || $${paramCount++}::jsonb`)
        values.push(JSON.stringify(newSettings.alertRules))
      }

      if (newSettings.integrations !== undefined) {
        updates.push(`integrations = COALESCE(integrations, '{}'::jsonb) || $${paramCount++}::jsonb`)
        values.push(JSON.stringify(newSettings.integrations))
      }

      updates.push(`updated_at = NOW()`)

      values.push(userId)

      await pool.query(
        `UPDATE agent_settings_liquidity 
         SET ${updates.join(', ')}
         WHERE user_id = $${paramCount}`,
        values
      )
    }

    return res.json({ success: true })
  } catch (error) {
    logger.error('Error updating liquidity settings:', error)
    return res.status(500).json({
      error: 'Failed to update settings',
      message: error.message
    })
  }
})

export default router
