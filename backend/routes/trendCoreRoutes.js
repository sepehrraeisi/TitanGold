/**
 * TREND-CORE — Canonical Trend Detection product API routes.
 * Mounted at /api/v1/ai-agents/:id/trend
 */

import express from 'express';
import { authenticateStrict } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { readAnalyticalSchedulerStatus } from '../services/analyticalSchedulerStatus.js';
import { getRuntimeExecutionState } from '../services/runtimeExecutionStateService.js';
import { logger } from '../services/logger.js';
import { validateAnalyzeRequest } from '../services/trendDomain.js';
import {
  executeTrendAnalysis,
  getTrendIntegrations,
  getTrendOverview,
  getTrendRunDetail,
  getTrendRuns,
  getTrendSettings,
  loadTrendAgent,
  updateTrendSettings,
} from '../services/trendRunService.js';

const router = express.Router({ mergeParams: true });

function sendError(res, code, message, status = 400, details = null) {
  return res.status(status).json({
    ok: false,
    error: { code, message, details: details || undefined },
  });
}

function isValidUUID(id) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}

async function requireTrendAgent(req, res) {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid agent ID format', 400);
    return null;
  }
  const agent = await loadTrendAgent(id);
  if (!agent) {
    sendError(res, 'NOT_FOUND', 'Trend agent not found', 404);
    return null;
  }
  return agent;
}

router.get(
  '/overview',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      const [scheduler, runtime] = await Promise.all([
        readAnalyticalSchedulerStatus(),
        getRuntimeExecutionState({ preferCache: true }),
      ]);
      const overview = await getTrendOverview(agent.id, { scheduler, runtime });
      return res.json({ ok: true, agent: { id: agent.id, agent_key: agent.agent_key, name: agent.name }, overview });
    } catch (error) {
      logger.error('Trend overview error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load trend overview', 500);
    }
  },
);

router.post(
  '/analyze',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_EXECUTE_SAFE),
  rateLimit({ limit: 10, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;

      const validation = validateAnalyzeRequest(req.body || {});
      if (!validation.ok) {
        return sendError(res, validation.code, validation.message, 400);
      }

      const settings = await getTrendSettings(agent.id);
      const compareTimeframes =
        Array.isArray(req.body?.compareTimeframes) && req.body.compareTimeframes.length
          ? req.body.compareTimeframes
          : settings?.compareTimeframes || [];

      const result = await executeTrendAnalysis({
        agentId: agent.id,
        user: req.user,
        symbol: validation.symbol,
        timeframe: validation.timeframe,
        idempotencyKey: req.body?.idempotencyKey || req.headers['idempotency-key'] || null,
        compareTimeframes,
      });

      return res.status(result.idempotent ? 200 : 201).json({
        ok: true,
        idempotent: result.idempotent,
        run: result.run,
        snapshot: result.snapshot,
        multiTimeframe: result.multiTimeframe,
      });
    } catch (error) {
      logger.error('Trend analyze error:', error);
      return sendError(res, 'SERVER_ERROR', error.message || 'Trend analysis failed', error.status || 500);
    }
  },
);

router.get(
  '/runs',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      const data = await getTrendRuns(agent.id, {
        page: req.query.page,
        pageSize: req.query.pageSize || req.query.limit,
      });
      return res.json({ ok: true, ...data });
    } catch (error) {
      logger.error('Trend runs error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load trend runs', 500);
    }
  },
);

router.get(
  '/runs/:runId',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      if (!isValidUUID(req.params.runId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid run ID', 400);
      }
      const detail = await getTrendRunDetail(agent.id, req.params.runId);
      if (!detail) return sendError(res, 'NOT_FOUND', 'Run not found', 404);
      return res.json({ ok: true, ...detail });
    } catch (error) {
      logger.error('Trend run detail error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load run detail', 500);
    }
  },
);

router.get(
  '/settings',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      const settings = await getTrendSettings(agent.id);
      return res.json({ ok: true, settings });
    } catch (error) {
      logger.error('Trend settings read error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load settings', 500);
    }
  },
);

router.patch(
  '/settings',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_EXECUTE_SAFE),
  rateLimit({ limit: 20, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      const settings = await updateTrendSettings(agent.id, req.body || {}, req.body?.version);
      return res.json({ ok: true, settings });
    } catch (error) {
      if (error.code === 'VERSION_CONFLICT') {
        return sendError(res, error.code, error.message, 409);
      }
      if (error.status === 400) {
        return sendError(res, error.code || 'VALIDATION_ERROR', error.message, 400);
      }
      logger.error('Trend settings update error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to update settings', 500);
    }
  },
);

router.get(
  '/integrations',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireTrendAgent(req, res);
      if (!agent) return;
      const integrations = await getTrendIntegrations(agent.id);
      return res.json({ ok: true, integrations });
    } catch (error) {
      logger.error('Trend integrations error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load integrations', 500);
    }
  },
);

export default router;
