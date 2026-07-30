/**
 * ARBITRAGE-CORE — Canonical analytical product API routes.
 * Mounted at /api/ai-agents/:id/arbitrage
 */

import express from 'express';
import { authenticateStrict } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { readAnalyticalSchedulerStatus } from '../services/analyticalSchedulerStatus.js';
import { getRuntimeExecutionState } from '../services/runtimeExecutionStateService.js';
import { sanitizePolicy } from '../services/agentExecutionService.js';
import { evaluateExecutionPolicy, REASON } from '../services/agentExecutionPolicyService.js';
import { logger } from '../services/logger.js';
import {
  executeArbitrageAnalyticalScan,
  getArbitrageCandidates,
  getArbitrageIntegrations,
  getArbitrageOverview,
  getArbitrageRunDetail,
  getArbitrageProfitRisk,
  getArbitrageRunComparison,
  getArbitrageRuns,
  loadArbitrageAgent,
  updateArbitrageSettings,
  updateMonitoringState,
} from '../services/arbitrageRunService.js';
import { buildSettingsDto } from '../services/arbitrageDomain.js';
import { normalizeArbitrageConfig } from '../services/normalizeArbitrageConfig.js';
import {
  readIdempotentScanResponse,
  storeIdempotentScanResponse,
} from '../services/arbitrageScanIdempotency.js';

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

async function requireArbitrageAgent(req, res) {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid agent ID format', 400);
    return null;
  }
  const agent = await loadArbitrageAgent(id);
  if (!agent) {
    sendError(res, 'NOT_FOUND', 'Arbitrage agent not found', 404);
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
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const [scheduler, runtime] = await Promise.all([
        readAnalyticalSchedulerStatus(),
        getRuntimeExecutionState({ preferCache: true }),
      ]);
      const overview = await getArbitrageOverview(agent.id, { scheduler, runtime });

      return res.json({
        ok: true,
        agent: { id: agent.id, agent_key: agent.agent_key, name: agent.name },
        overview,
        scheduler: {
          status: scheduler.status,
          stale: scheduler.stale,
          source: scheduler.source,
        },
        runtime: {
          globalMode: runtime.globalMode,
          killSwitchActive: runtime.killSwitchActive,
          version: runtime.version,
        },
      });
    } catch (error) {
      logger.error('Arbitrage overview error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load arbitrage overview', 500);
    }
  },
);

router.get(
  '/candidates',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const result = await getArbitrageCandidates(agent.id, {
        runId: req.query.runId,
        symbol: req.query.symbol,
        lifecycle: req.query.lifecycle,
        rejectionReason: req.query.rejectionReason,
        freshness: req.query.freshness,
        search: req.query.search,
        sort: req.query.sort,
        page: req.query.page,
        pageSize: req.query.pageSize || req.query.limit,
      });

      const spreadCandidates = [];
      const rejectedCandidates = [];
      const qualifiedCandidates = [];
      for (const item of result.items) {
        if (item.lifecycleState === 'qualified') qualifiedCandidates.push(item);
        else if (['rejected', 'blocked', 'expired'].includes(item.lifecycleState)) {
          rejectedCandidates.push(item);
        } else {
          spreadCandidates.push(item);
        }
      }

      return res.json({
        ok: true,
        runId: result.selectedRun?.runId || req.query.runId || null,
        items: result.items,
        total: result.pagination.total,
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        hasNext: result.pagination.page < result.pagination.totalPages,
        hasPrevious: result.pagination.page > 1,
        selectedRun: result.selectedRun,
        funnel: result.funnel,
        availableFilters: result.availableFilters,
        generatedAt: result.generatedAt,
        spreadCandidates,
        rejectedCandidates,
        qualifiedCandidates,
        candidates: result.items,
        pagination: {
          ...result.pagination,
          hasNext: result.pagination.page < result.pagination.totalPages,
          hasPrevious: result.pagination.page > 1,
        },
      });
    } catch (error) {
      logger.error('Arbitrage candidates error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load candidates', 500);
    }
  },
);

router.get(
  '/profit-risk',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      if (req.query.runId && !isValidUUID(req.query.runId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid run ID format', 400);
      }

      const result = await getArbitrageProfitRisk(agent.id, { runId: req.query.runId });
      if (!result) {
        return sendError(res, 'NOT_FOUND', 'Arbitrage agent not found', 404);
      }

      return res.json({ ok: true, ...result });
    } catch (error) {
      logger.error('Arbitrage profit-risk error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load profit and risk analytics', 500);
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
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const result = await getArbitrageRuns(agent.id, {
        page: req.query.page,
        pageSize: req.query.pageSize || req.query.limit,
        trigger: req.query.trigger,
        status: req.query.status,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search || req.query.runId,
        sort: req.query.sort,
      });

      return res.json({
        ok: true,
        runs: result.items,
        items: result.items,
        summary: result.summary,
        availableFilters: result.availableFilters,
        generatedAt: result.generatedAt,
        pagination: {
          ...result.pagination,
          hasNext: result.pagination.hasNext,
          hasPrevious: result.pagination.hasPrevious,
        },
      });
    } catch (error) {
      logger.error('Arbitrage runs error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load scan runs', 500);
    }
  },
);

router.get(
  '/runs/:runId/compare',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_READ),
  rateLimit({ limit: 60, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      if (!isValidUUID(req.params.runId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid run ID format', 400);
      }

      const comparison = await getArbitrageRunComparison(agent.id, req.params.runId);
      if (!comparison) {
        return sendError(res, 'NOT_FOUND', 'Scan run not found', 404);
      }

      return res.json({ ok: true, ...comparison });
    } catch (error) {
      logger.error('Arbitrage run comparison error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load scan run comparison', 500);
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
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      if (!isValidUUID(req.params.runId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid run ID format', 400);
      }

      const detail = await getArbitrageRunDetail(agent.id, req.params.runId);
      if (!detail) {
        return sendError(res, 'NOT_FOUND', 'Scan run not found', 404);
      }

      return res.json({
        ok: true,
        scanRun: detail.scanRun,
        candidates: detail.candidates,
        malformed: detail.malformed === true,
      });
    } catch (error) {
      logger.error('Arbitrage run detail error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load scan run detail', 500);
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
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const integrations = await getArbitrageIntegrations(agent.id);
      return res.json({ ok: true, integrations });
    } catch (error) {
      logger.error('Arbitrage integrations error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load integrations', 500);
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
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const settings = buildSettingsDto(agent.config || {}, {
        version: agent.config?.settingsVersion,
        updatedAt: agent.config?.settingsUpdatedAt || agent.updated_at,
      });

      return res.json({ ok: true, settings });
    } catch (error) {
      logger.error('Arbitrage settings read error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to load settings', 500);
    }
  },
);

router.put(
  '/settings',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_CONFIGURE),
  rateLimit({ limit: 20, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const expectedVersion = req.body?.expectedVersion ?? req.body?.version ?? req.headers['if-match'];
      const settings = await updateArbitrageSettings(
        agent.id,
        req.body?.settings || req.body,
        req.user,
        expectedVersion,
      );

      return res.json({ ok: true, settings });
    } catch (error) {
      if (error.status === 409) {
        return sendError(res, error.code || 'VERSION_CONFLICT', error.message, 409, error.details);
      }
      if (error.status === 400) {
        return sendError(res, error.code || 'VALIDATION_ERROR', error.message, 400, error.details);
      }
      logger.error('Arbitrage settings update error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to update settings', 500);
    }
  },
);

router.post(
  '/scan',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_EXECUTE_SAFE),
  rateLimit({ limit: 10, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const confirmed =
        req.body?.confirm === true
        || req.body?.confirmed === true
        || req.body?.confirmation?.confirmed === true;

      if (!confirmed) {
        return sendError(
          res,
          'CONFIRMATION_REQUIRED',
          'Manual analytical scan requires explicit confirmation',
          409,
          {
            confirmationRequired: true,
            sideEffectClass: 'analytical_read_only',
            executionSupported: false,
          },
        );
      }

      const idempotencyKey =
        req.headers['idempotency-key']
        || req.headers['x-idempotency-key']
        || req.body?.idempotencyKey
        || null;

      if (idempotencyKey) {
        const cached = await readIdempotentScanResponse(agent.id, String(idempotencyKey));
        if (cached) {
          return res.status(200).json({ ...cached, idempotentReplay: true });
        }
      }

      const executionPolicy = await evaluateExecutionPolicy({
        identityType: 'user',
        user: req.user,
        agentKey: agent.agent_key,
        agentEnabled: agent.is_enabled,
        params: { config: req.body?.config, input: { trigger: 'manual', action: 'manual_scan' } },
        confirmLive: false,
        action: 'agent.run',
      });

      if (!executionPolicy.allowed) {
        const status = executionPolicy.reasonCode === REASON.CONFIRMATION_REQUIRED ? 409 : 403;
        return sendError(
          res,
          executionPolicy.reasonCode,
          executionPolicy.suppressionReason || executionPolicy.reasonCode,
          status,
          { policy: sanitizePolicy(executionPolicy) },
        );
      }

      const scanResult = await executeArbitrageAnalyticalScan({
        agentId: agent.id,
        trigger: 'manual',
        user: req.user,
        configOverride: req.body?.config || {},
        runtimeMode: executionPolicy.effectiveMode,
        schedulerOwner: 'manual-api',
      });

      if (scanResult.skipped) {
        const skippedBody = {
          ok: true,
          skipped: true,
          reason: scanResult.reason,
          policy: sanitizePolicy(executionPolicy),
        };
        if (idempotencyKey) {
          await storeIdempotentScanResponse(agent.id, String(idempotencyKey), skippedBody);
        }
        return res.json(skippedBody);
      }

      const responseBody = {
        ok: true,
        agent_id: agent.id,
        agent_key: 'arbitrage',
        policy: sanitizePolicy(executionPolicy),
        execution: {
          requested_mode: executionPolicy.requestedMode,
          effective_mode: executionPolicy.effectiveMode,
          side_effects_suppressed: true,
          trigger: 'manual',
        },
        scanRun: scanResult.scanRun,
        candidates: scanResult.candidates,
      };

      if (idempotencyKey) {
        await storeIdempotentScanResponse(agent.id, String(idempotencyKey), responseBody);
      }

      return res.json(responseBody);
    } catch (error) {
      if (
        error.code === 'ARBITRAGE_SCAN_IN_PROGRESS'
        || error.code === 'SCAN_IN_PROGRESS'
        || (error.status === 409 && error.code !== 'CONFIRMATION_REQUIRED')
      ) {
        return sendError(
          res,
          'ARBITRAGE_SCAN_IN_PROGRESS',
          'An analytical scan is already running. Try again after it finishes.',
          409,
          { retryAfterMs: 5000 },
        );
      }
      logger.error('Arbitrage manual scan error:', error);
      return sendError(res, 'SERVER_ERROR', error.message || 'Failed to run analytical scan', 500);
    }
  },
);

router.post(
  '/monitoring-state',
  authenticateStrict,
  requireCapability(CAP.AI_AGENT_CONFIGURE),
  rateLimit({ limit: 20, windowMs: 60000 }),
  async (req, res) => {
    try {
      const agent = await requireArbitrageAgent(req, res);
      if (!agent) return;

      const { monitoringState } = req.body || {};
      if (!monitoringState) {
        return sendError(res, 'VALIDATION_ERROR', 'monitoringState is required', 400);
      }

      const settings = await updateMonitoringState({
        agentId: agent.id,
        monitoringState,
        user: req.user,
      });

      return res.json({ ok: true, settings });
    } catch (error) {
      if (error.status === 400) {
        return sendError(res, 'VALIDATION_ERROR', error.message, 400);
      }
      if (error.status === 404) {
        return sendError(res, 'NOT_FOUND', error.message, 404);
      }
      logger.error('Arbitrage monitoring-state error:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to update monitoring state', 500);
    }
  },
);

export default router;
