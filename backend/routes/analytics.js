import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

const isMissingTableError = (err) => {
  // Postgres: undefined_table
  return err?.code === '42P01' || String(err?.message || '').includes('does not exist');
};

const safeNumber = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

router.get('/overview', authenticate, async (req, res) => {
  const nowIso = new Date().toISOString();

  // Defaults: never crash the endpoint; return a stable shape.
  const response = {
    realtime: {
      decisionRate: 0,
      successRate: 0,
      systemUptime: Math.floor(process.uptime()),
      agentDistribution: { active: 0, training: 0, offline: 0 },
    },
    performance: {
      totalDecisions: 0,
      totalLearningHours: 0,
      avgAccuracy: 0,
      monthlyImprovement: 0,
    },
    resourceUsage: {
      cpu: 0,
      gpu: 0,
      memory: 0,
      precision: [],
      recall: [],
    },
    agentMatrix: [],
    lastUpdated: nowIso,
  };

  try {
    // 1) Agent distribution and avg accuracy from ai_agents.
    try {
      const dist = await query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'training')::int AS training,
            COUNT(*) FILTER (WHERE status NOT IN ('active', 'training'))::int AS offline
          FROM ai_agents
        `
      );
      const row = dist.rows?.[0] || {};
      response.realtime.agentDistribution.active = safeNumber(row.active);
      response.realtime.agentDistribution.training = safeNumber(row.training);
      response.realtime.agentDistribution.offline = safeNumber(row.offline);
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('⚠️ analytics/overview: ai_agents table missing; returning zeros');
      } else {
        logger.warn('⚠️ analytics/overview: failed to query ai_agents distribution; returning zeros', {
          message: err?.message,
          code: err?.code,
        });
      }
    }

    try {
      const avgAcc = await query(`SELECT AVG(accuracy)::float AS avg_accuracy FROM ai_agents`);
      const avgAccuracy = safeNumber(avgAcc.rows?.[0]?.avg_accuracy);
      response.performance.avgAccuracy = Math.round(avgAccuracy * 10) / 10;
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('⚠️ analytics/overview: ai_agents table missing for avg accuracy; returning 0');
      } else {
        logger.warn('⚠️ analytics/overview: failed to query avg agent accuracy; returning 0', {
          message: err?.message,
          code: err?.code,
        });
      }
    }

    // 2) Decisions + success rate from ai_decisions.
    let totalDecisions = 0;
    let successfulDecisions = 0;
    let totalExecutionMs = 0;

    try {
      const dec = await query(
        `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE was_successful = true)::int AS successful,
            COALESCE(SUM(execution_time_ms), 0)::bigint AS total_execution_ms
          FROM ai_decisions
        `
      );
      const row = dec.rows?.[0] || {};
      totalDecisions = safeNumber(row.total);
      successfulDecisions = safeNumber(row.successful);
      totalExecutionMs = safeNumber(row.total_execution_ms);

      response.performance.totalDecisions = totalDecisions;
      const successRate = totalDecisions > 0 ? (successfulDecisions / totalDecisions) * 100 : 0;
      response.realtime.successRate = Math.round(successRate * 10) / 10;

      // "Learning hours" derived from real execution time. (DB-backed, not mock.)
      const totalLearningHours = totalExecutionMs > 0 ? totalExecutionMs / (1000 * 60 * 60) : 0;
      response.performance.totalLearningHours = Math.round(totalLearningHours * 10) / 10;

      // Decision rate compatible with frontend semantics (decisions per minute of runtime).
      const decisionRate =
        totalLearningHours > 0 ? totalDecisions / (totalLearningHours * 60) : 0;
      response.realtime.decisionRate = Math.round(decisionRate * 10) / 10;
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('⚠️ analytics/overview: ai_decisions table missing; returning zeros');
      } else {
        logger.warn('⚠️ analytics/overview: failed to query ai_decisions; returning zeros', {
          message: err?.message,
          code: err?.code,
        });
      }
    }

    // 3) Monthly improvement from ai_learning_events (improvement impact, last 30d).
    try {
      const imp = await query(
        `
          SELECT COALESCE(AVG(impact), 0)::float AS avg_impact
          FROM ai_learning_events
          WHERE event_type = 'improvement'
            AND created_at >= NOW() - INTERVAL '30 days'
        `
      );
      const avgImpact = safeNumber(imp.rows?.[0]?.avg_impact);
      response.performance.monthlyImprovement = Math.round(avgImpact * 10) / 10;
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('⚠️ analytics/overview: ai_learning_events table missing; returning 0 improvement');
      } else {
        logger.warn('⚠️ analytics/overview: failed to query ai_learning_events improvement; returning 0', {
          message: err?.message,
          code: err?.code,
        });
      }
    }

    // 4) Agent matrix: top 12 agents + per-agent decision stats.
    try {
      const agents = await query(
        `
          SELECT id, name, status, accuracy
          FROM ai_agents
          ORDER BY name ASC
          LIMIT 12
        `
      );

      const agentIds = (agents.rows || []).map((a) => a.id).filter(Boolean);
      let perAgentStats = new Map();

      if (agentIds.length > 0) {
        try {
          const stats = await query(
            `
              SELECT
                agent_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE was_successful = true)::int AS successful
              FROM ai_decisions
              WHERE agent_id = ANY($1::uuid[])
              GROUP BY agent_id
            `,
            [agentIds]
          );
          perAgentStats = new Map(
            (stats.rows || []).map((r) => [
              r.agent_id,
              { total: safeNumber(r.total), successful: safeNumber(r.successful) },
            ])
          );
        } catch (err) {
          if (!isMissingTableError(err)) {
            logger.warn('⚠️ analytics/overview: failed to query per-agent decision stats; continuing', {
              message: err?.message,
              code: err?.code,
            });
          }
        }
      }

      response.agentMatrix = (agents.rows || []).map((a) => {
        const stats = perAgentStats.get(a.id) || { total: 0, successful: 0 };
        const derivedSuccessRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
        const mappedStatus =
          a.status === 'active' || a.status === 'training' ? a.status : 'error';

        const accuracy = safeNumber(a.accuracy);

        return {
          id: a.id,
          name: String(a.name || '').substring(0, 15) + (String(a.name || '').length > 15 ? '...' : ''),
          accuracy: Math.round(accuracy * 10) / 10,
          successRate: Math.round(derivedSuccessRate * 10) / 10,
          progress: 0,
          status: mappedStatus,
        };
      });
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('⚠️ analytics/overview: ai_agents missing for agentMatrix; returning empty array');
      } else {
        logger.warn('⚠️ analytics/overview: failed to build agentMatrix; returning empty array', {
          message: err?.message,
          code: err?.code,
        });
      }
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error('❌ analytics/overview: unexpected error', {
      message: error?.message,
      code: error?.code,
    });
    res.status(200).json(response);
  }
});

export default router;

