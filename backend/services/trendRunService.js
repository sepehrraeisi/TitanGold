/**
 * TREND-CORE — Manual analytical run orchestration and read models.
 */

import { query } from '../database/db.js';
import agentRegistry from './agents/registry.js';
import { logger } from './logger.js';
import { readAnalyticalSchedulerStatus } from './analyticalSchedulerStatus.js';
import { getRuntimeExecutionState } from './runtimeExecutionStateService.js';
import { isRedisAvailable } from '../utils/redis.js';
import { writeExecutionAudit } from './agentExecutionService.js';
import {
  TREND_AGENT_KEY,
  TREND_DECISION_TYPE,
  buildSettingsDto,
  buildTrendIntegrationsDto,
  buildTrendSnapshot,
  buildMtfCompareEntry,
  buildMtfSummary,
  compareSnapshots,
  computeMtfAgreement,
  mapDecisionRowToRun,
  normalizeCompareTimeframes,
  resolveRunSymbolTimeframe,
  resolveSchedulerIntegrationStatus,
  validateAnalyzeRequest,
  validateSettingsInput,
} from './trendDomain.js';
import { defaultConfig as trendDefaultConfig } from './agents/trend.js';

export async function loadTrendAgent(agentId) {
  const result = await query(
    `SELECT id, agent_key, name, type, status, config, metadata, is_enabled, updated_at, version
     FROM ai_agents WHERE id = $1 LIMIT 1`,
    [agentId],
  );
  if (result.rows.length === 0) return null;
  const agent = result.rows[0];
  if (agent.agent_key !== TREND_AGENT_KEY && agent.agent_key !== 'trend_detection') return null;
  return agent;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function getTrendOverview(agentId, { scheduler, runtime } = {}) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;

  const settings = buildSettingsDto(agent.config || {}, trendDefaultConfig());
  const latest = await query(
    `SELECT id, created_at, execution_time_ms, output_data, input_data, was_successful
     FROM ai_decisions WHERE agent_id = $1 AND decision_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [agent.id, TREND_DECISION_TYPE],
  );

  const latestRow = latest.rows[0] || null;
  const latestOutput = latestRow ? parseJson(latestRow.output_data) : null;
  const latestInput = latestRow ? parseJson(latestRow.input_data) : null;
  const latestSnapshot = latestOutput ? buildTrendSnapshot(latestOutput) : null;

  let priorRow = null;
  let priorOutput = null;
  if (latestRow && latestSnapshot) {
    const { symbol, timeframe } = resolveRunSymbolTimeframe(latestInput, latestOutput, latestSnapshot);
    if (symbol && timeframe) {
      const prior = await findPriorComparableRun(agent.id, latestRow.created_at, symbol, timeframe);
      priorRow = prior;
      priorOutput = prior ? parseJson(prior.output_data) : null;
    }
  }
  const priorSnapshot = priorOutput ? buildTrendSnapshot(priorOutput) : null;

  const latestMultiTimeframe = Array.isArray(latestOutput?.multiTimeframe) ? latestOutput.multiTimeframe : [];
  const mtfSummary = latestOutput?.mtfSummary || null;
  const requestedCompareTimeframes = normalizeCompareTimeframes(
    latestSnapshot?.timeframe || latestInput?.timeframe || settings.timeframe,
    latestInput?.compareTimeframes || latestOutput?.compareTimeframes || settings.compareTimeframes || [],
  );

  const metadata = parseJson(agent.metadata);
  const totalRuns = await query(
    `SELECT COUNT(*)::int AS c FROM ai_decisions WHERE agent_id = $1 AND decision_type = $2`,
    [agent.id, TREND_DECISION_TYPE],
  );

  return {
    productIdentity: {
      agentKey: TREND_AGENT_KEY,
      executionClass: 'analytical',
      sideEffectClass: 'read_only_public_data',
      liveCapable: false,
    },
    settings,
    latestSnapshot,
    latestMultiTimeframe,
    mtfSummary,
    requestedCompareTimeframes,
    latestRun: latestRow
      ? mapDecisionRowToRun(
          {
            id: latestRow.id,
            created_at: latestRow.created_at,
            execution_time_ms: latestRow.execution_time_ms,
            output_data: latestOutput,
            input_data: parseJson(latestRow.input_data),
            was_successful: latestRow.was_successful,
          },
          agent.id,
        )
      : null,
    comparison: compareSnapshots(latestSnapshot, priorSnapshot, {
      currentSuccessful: latestRow?.was_successful !== false && !latestOutput?.error,
      priorSuccessful: priorRow?.was_successful !== false && !priorOutput?.error,
      priorRunId: priorRow?.id || null,
    }),
    metrics: {
      totalRuns: totalRuns.rows[0]?.c ?? 0,
      lastRunAt: metadata.last_run_at || latestRow?.created_at || null,
      lastRunId: metadata.last_run_id || latestRow?.id || null,
    },
    runtime: {
      effectiveMode: runtime?.globalMode || 'demo',
      killSwitchActive: Boolean(runtime?.killSwitchActive),
    },
    manualAnalysis: {
      available: true,
      mode: 'public_manual',
      reasonKey: 'trend_manual_analysis_available',
    },
    scheduler: {
      trendScheduled: false,
      scheduledMonitoringStatus: 'not_scheduled',
      scheduledMonitoringReasonKey: 'trend_scheduled_monitoring_off',
      workerStatus: resolveSchedulerIntegrationStatus(scheduler),
      schedulerReadiness: resolveSchedulerIntegrationStatus(scheduler),
    },
  };
}

export async function executeTrendAnalysis({
  agentId,
  user,
  symbol,
  timeframe,
  idempotencyKey = null,
  compareTimeframes = [],
}) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) {
    const err = new Error('Trend agent not found');
    err.status = 404;
    throw err;
  }

  if (idempotencyKey) {
    const existing = await query(
      `SELECT id, output_data, created_at, execution_time_ms, input_data, was_successful
       FROM ai_decisions
       WHERE agent_id = $1 AND decision_type = $2
         AND input_data->>'idempotencyKey' = $3
       ORDER BY created_at DESC LIMIT 1`,
      [agent.id, TREND_DECISION_TYPE, idempotencyKey],
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const output = parseJson(row.output_data);
      return {
        idempotent: true,
        run: mapDecisionRowToRun(
          {
            id: row.id,
            created_at: row.created_at,
            execution_time_ms: row.execution_time_ms,
            output_data: output,
            input_data: parseJson(row.input_data),
            was_successful: row.was_successful,
          },
          agent.id,
        ),
        snapshot: buildTrendSnapshot(output),
        multiTimeframe: output.multiTimeframe || [],
        mtfSummary: output.mtfSummary || buildMtfSummary(output.compareTimeframes || [], output.multiTimeframe || []),
        compareTimeframes: output.compareTimeframes || normalizeCompareTimeframes(
          parseJson(row.input_data)?.timeframe,
          parseJson(row.input_data)?.compareTimeframes || [],
        ),
      };
    }
  }

  const settings = buildSettingsDto(agent.config || {}, trendDefaultConfig());
  const normalizedCompare = normalizeCompareTimeframes(timeframe, compareTimeframes);
  const config = {
    adxPeriod: settings.adxPeriod,
    smaPeriod: settings.smaPeriod,
    emaPeriod: settings.emaPeriod,
    trendLineLookback: settings.trendLineLookback,
    candleCount: settings.candleCount,
  };

  const startedAt = new Date();
  const primary = await agentRegistry.runAgent(TREND_AGENT_KEY, {
    userId: user?.id || null,
    agent_id: agent.id,
    symbol,
    timeframe,
    config,
  });

  const primarySnapshot = buildTrendSnapshot(primary);
  const multiTimeframe = [];

  for (const tf of normalizedCompare) {
    try {
      const cmp = await agentRegistry.runAgent(TREND_AGENT_KEY, {
        userId: user?.id || null,
        agent_id: agent.id,
        symbol,
        timeframe: tf,
        config,
      });
      if (cmp?.error) {
        const cmpSnapshot = buildTrendSnapshot(cmp);
        multiTimeframe.push(
          buildMtfCompareEntry({
            timeframe: tf,
            status: 'failed',
            snapshot: cmpSnapshot.direction !== 'unavailable' ? cmpSnapshot : null,
            agreementDto: {
              agreement: 'unavailable',
              reasonKey: 'trend_mtf_agreement_reason_unavailable',
            },
            unavailableReasonKey: 'trend_mtf_compare_analysis_failed',
            errorMessage: cmp.error,
          }),
        );
        continue;
      }
      const cmpSnapshot = buildTrendSnapshot(cmp);
      const isUnavailable = cmpSnapshot.direction === 'unavailable';
      const agreementDto = computeMtfAgreement(primarySnapshot, cmpSnapshot);
      multiTimeframe.push(
        buildMtfCompareEntry({
          timeframe: tf,
          status: isUnavailable ? 'unavailable' : 'completed',
          snapshot: cmpSnapshot,
          agreementDto,
          unavailableReasonKey: isUnavailable ? 'trend_mtf_agreement_reason_unavailable' : null,
        }),
      );
    } catch (e) {
      logger.warn('Trend multi-timeframe compare failed', { tf, error: e.message });
      multiTimeframe.push(
        buildMtfCompareEntry({
          timeframe: tf,
          status: 'failed',
          snapshot: null,
          agreementDto: {
            agreement: 'unavailable',
            reasonKey: 'trend_mtf_agreement_reason_unavailable',
          },
          unavailableReasonKey: 'trend_mtf_compare_provider_error',
        }),
      );
    }
  }

  const mtfSummary = buildMtfSummary(normalizedCompare, multiTimeframe);

  const output = {
    ...primary,
    multiTimeframe,
    mtfSummary,
    compareTimeframes: normalizedCompare,
    trigger: 'manual',
    idempotencyKey,
  };

  const executionTimeMs = Date.now() - startedAt.getTime();
  const snapshot = buildTrendSnapshot(output);
  const confidence =
    typeof primary?.trend?.confidence === 'number'
      ? primary.trend.confidence / 100
      : typeof primary?._meta?.confidence === 'number'
        ? primary._meta.confidence
        : 0.5;

  const insert = await query(
    `INSERT INTO ai_decisions (
       agent_id, user_id, decision_type, confidence, input_data, output_data, execution_time_ms, was_successful, created_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, NOW())
     RETURNING id, created_at, execution_time_ms`,
    [
      agent.id,
      user?.id || null,
      TREND_DECISION_TYPE,
      confidence,
      JSON.stringify({ trigger: 'manual', symbol, timeframe, compareTimeframes: normalizedCompare, idempotencyKey }),
      JSON.stringify(output),
      executionTimeMs,
      !primary?.error,
    ],
  );

  const runId = insert.rows[0].id;
  await query(
    `UPDATE ai_agents
     SET last_active_at = NOW(), updated_at = NOW(),
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [
      agent.id,
      JSON.stringify({
        last_run_at: insert.rows[0].created_at,
        last_run_id: runId,
        last_snapshot: snapshot,
      }),
    ],
  );

  await writeExecutionAudit({
    userId: user?.id || null,
    agentId: agent.id,
    agentKey: TREND_AGENT_KEY,
    action: 'manual_trend_analysis',
    allowed: true,
    reasonCode: 'analytical_read_only',
    effectiveMode: 'demo',
    sideEffectsSuppressed: true,
    metadata: { runId, symbol, timeframe },
  });

  return {
    idempotent: false,
    run: mapDecisionRowToRun(
      {
        id: runId,
        created_at: insert.rows[0].created_at,
        execution_time_ms: executionTimeMs,
        output_data: output,
        input_data: { trigger: 'manual', symbol, timeframe, compareTimeframes: normalizedCompare },
        was_successful: !primary?.error,
      },
      agent.id,
    ),
    snapshot,
    multiTimeframe,
    mtfSummary,
    compareTimeframes: normalizedCompare,
  };
}

async function findPriorComparableRun(agentId, beforeCreatedAt, symbol, timeframe) {
  const result = await query(
    `SELECT id, created_at, execution_time_ms, output_data, input_data, was_successful
     FROM ai_decisions
     WHERE agent_id = $1
       AND decision_type = $2
       AND created_at < $3
       AND was_successful = true
       AND (output_data->>'error') IS NULL
       AND COALESCE(input_data->>'symbol', output_data->>'symbol') = $4
       AND COALESCE(input_data->>'timeframe', output_data->>'timeframe') = $5
     ORDER BY created_at DESC
     LIMIT 1`,
    [agentId, TREND_DECISION_TYPE, beforeCreatedAt, symbol, timeframe],
  );
  return result.rows[0] || null;
}

export async function getTrendRuns(agentId, { page = 1, pageSize = 20 } = {}) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safeSize;

  const [rows, count] = await Promise.all([
    query(
      `SELECT id, created_at, execution_time_ms, output_data, input_data, was_successful
       FROM ai_decisions WHERE agent_id = $1 AND decision_type = $2
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [agent.id, TREND_DECISION_TYPE, safeSize, offset],
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM ai_decisions WHERE agent_id = $1 AND decision_type = $2`,
      [agent.id, TREND_DECISION_TYPE],
    ),
  ]);

  const total = count.rows[0]?.c ?? 0;
  return {
    runs: rows.rows.map((r) =>
      mapDecisionRowToRun(
        {
          id: r.id,
          created_at: r.created_at,
          execution_time_ms: r.execution_time_ms,
          output_data: parseJson(r.output_data),
          input_data: parseJson(r.input_data),
          was_successful: r.was_successful,
        },
        agent.id,
      ),
    ),
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
    },
  };
}

export async function getTrendRunDetail(agentId, runId) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;
  const result = await query(
    `SELECT id, created_at, execution_time_ms, output_data, input_data, was_successful
     FROM ai_decisions WHERE id = $1 AND agent_id = $2 LIMIT 1`,
    [runId, agent.id],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const output = parseJson(row.output_data);
  const input = parseJson(row.input_data);
  const snapshot = buildTrendSnapshot(output);
  const { symbol, timeframe } = resolveRunSymbolTimeframe(input, output, snapshot);

  const priorRow =
    symbol && timeframe
      ? await findPriorComparableRun(agent.id, row.created_at, symbol, timeframe)
      : null;
  const priorOutput = priorRow ? parseJson(priorRow.output_data) : null;
  const priorSnapshot = priorOutput ? buildTrendSnapshot(priorOutput) : null;

  const primarySnapshot = snapshot;
  const multiTimeframeRaw = output.multiTimeframe || [];
  const multiTimeframe = multiTimeframeRaw.map((entry) => {
    if (entry.agreementReasonKey) return entry;
    const cmpSnapshot = entry.snapshot || (entry.timeframe ? buildTrendSnapshot(entry) : null);
    if (!cmpSnapshot) return entry;
    const agreementDto = computeMtfAgreement(primarySnapshot, cmpSnapshot);
    return {
      ...entry,
      snapshot: cmpSnapshot,
      agreement: agreementDto.agreement,
      agreementReasonKey: agreementDto.reasonKey,
      agreementFactors: agreementDto.factors,
    };
  });

  return {
    run: mapDecisionRowToRun(
      {
        id: row.id,
        created_at: row.created_at,
        execution_time_ms: row.execution_time_ms,
        output_data: output,
        input_data: input,
        was_successful: row.was_successful,
      },
      agent.id,
    ),
    snapshot,
    multiTimeframe,
    mtfSummary: output.mtfSummary || buildMtfSummary(
      normalizeCompareTimeframes(timeframe, input?.compareTimeframes || output?.compareTimeframes || []),
      multiTimeframe,
    ),
    comparison: compareSnapshots(snapshot, priorSnapshot, {
      currentSuccessful: row.was_successful !== false && !output.error,
      priorSuccessful: priorRow?.was_successful !== false && !priorOutput?.error,
      priorRunId: priorRow?.id || null,
    }),
  };
}

export async function updateTrendSettings(agentId, input, expectedVersion) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;

  const validation = validateSettingsInput(input);
  if (!validation.ok) {
    const err = new Error(validation.message);
    err.status = 400;
    err.code = validation.code;
    throw err;
  }

  const current = buildSettingsDto(agent.config || {}, trendDefaultConfig());
  if (expectedVersion != null && Number(expectedVersion) !== Number(current.version)) {
    const err = new Error('Settings version conflict');
    err.status = 409;
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const next = {
    ...current,
    ...validation.sanitized,
    version: Number(current.version || 1) + 1,
  };

  await query(`UPDATE ai_agents SET config = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    agent.id,
    JSON.stringify(next),
  ]);

  return buildSettingsDto(next, trendDefaultConfig());
}

export async function getTrendIntegrations(agentId) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;
  const [scheduler, runtime, redisOk] = await Promise.all([
    readAnalyticalSchedulerStatus(),
    getRuntimeExecutionState({ preferCache: true }),
    isRedisAvailable(),
  ]);
  return buildTrendIntegrationsDto({
    redisOk,
    scheduler,
    runtime,
    mexcPublicOk: true,
  });
}

export async function getTrendSettings(agentId) {
  const agent = await loadTrendAgent(agentId);
  if (!agent) return null;
  return buildSettingsDto(agent.config || {}, trendDefaultConfig());
}
