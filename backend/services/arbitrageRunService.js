/**
 * ARBITRAGE-CORE — Unified manual/scheduled analytical scan orchestration.
 */

import { query } from '../database/db.js';
import agentRegistry from './agents/registry.js';
import { normalizeArbitrageConfig } from './normalizeArbitrageConfig.js';
import {
  ARBITRAGE_DECISION_TYPE,
  buildScanRunDto,
  buildArbitrageOverviewSnapshot,
  buildSettingsDto,
  buildCandidateAvailableFilters,
  buildCandidateFunnelFromItems,
  buildHistorySummary,
  compareScanRuns,
  deriveInterpretation,
  getProductIdentity,
  mapDecisionRowToScanRun,
  mapRawCandidateToDto,
  MONITORING_STATE,
  SCAN_RUN_STATUS,
  sanitizeConfigForWrite as sanitizeDomainConfig,
  validateHistoryQuery,
  validatePagination,
  validateSettingsInput,
} from './arbitrageDomain.js';
import { readAnalyticalSchedulerStatus } from './analyticalSchedulerStatus.js';
import { isRedisAvailable } from '../utils/redis.js';
import { withScanLock } from './arbitrageScanLock.js';
import {
  fetchArbitrageHistoricalSummary,
  fetchArbitrageScanHistory,
  fetchLatestArbitrageScanRow,
  fetchRecentArbitrageScanRows,
} from './arbitrageScanContract.js';
import {
  buildProfitRiskAnalytics,
  enrichTrendRunFromOutput,
  mapCandidatesFromRunOutput,
} from './arbitrageProfitRiskDomain.js';
import { writeExecutionAudit } from './agentExecutionService.js';
import { logger } from './logger.js';

export async function loadArbitrageAgent(agentId) {
  const result = await query(
    `SELECT id, agent_key, name, type, status, config, metadata, is_enabled, updated_at
     FROM ai_agents WHERE id = $1 LIMIT 1`,
    [agentId],
  );
  if (result.rows.length === 0) return null;
  const agent = result.rows[0];
  if (agent.agent_key !== 'arbitrage') return null;
  return agent;
}

export async function executeArbitrageAnalyticalScan({
  agentId,
  trigger = 'manual',
  user = null,
  configOverride = {},
  runtimeMode = 'demo',
  schedulerOwner = 'titan-engine-worker',
}) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) {
    const err = new Error('Arbitrage agent not found');
    err.status = 404;
    throw err;
  }

  const settings = buildSettingsDto(normalizeArbitrageConfig(agent.config || {}));
  if (settings.monitoringState === MONITORING_STATE.PAUSED && trigger === 'scheduled') {
    return { skipped: true, reason: 'monitoring_paused' };
  }

  const mergedConfig = sanitizeDomainConfig(
    normalizeArbitrageConfig({ ...(agent.config || {}), ...(configOverride || {}) }),
  );
  const symbols = mergedConfig.symbols || [];
  const startedAt = new Date();

  return withScanLock(agentId, trigger === 'scheduled' ? schedulerOwner : `user:${user?.id || 'system'}`, trigger, async () => {
    const result = await agentRegistry.runAgent('arbitrage', {
      userId: user?.id || null,
      agent_id: agent.id,
      config: mergedConfig,
      input: {
        trigger,
        dry_run: true,
        effective_mode: runtimeMode,
        schedulerOwner,
      },
    });

    const executionTimeMs = Date.now() - startedAt.getTime();
    const output = {
      ...result,
      trigger,
      schedulerOwner,
      runtimeMode,
    };

    const insert = await query(
      `INSERT INTO ai_decisions (
         agent_id, user_id, decision_type, confidence, input_data, output_data, execution_time_ms, was_successful, created_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, NOW())
       RETURNING id, created_at, execution_time_ms`,
      [
        agent.id,
        user?.id || null,
        result?.decision_type || ARBITRAGE_DECISION_TYPE,
        typeof result?.confidence === 'number' ? result.confidence : 0.5,
        JSON.stringify({ trigger, config: mergedConfig, symbols, input: { effective_mode: runtimeMode } }),
        JSON.stringify(output),
        executionTimeMs,
        !output.error,
      ],
    );

    const runId = insert.rows[0].id;
    const scanRun = buildScanRunDto({
      runId,
      agentId: agent.id,
      trigger,
      startedAt,
      completedAt: insert.rows[0].created_at,
      durationMs: executionTimeMs,
      status: output.error ? 'failed' : 'completed',
      dryRun: true,
      runtimeMode,
      schedulerOwner,
      symbolsRequested: symbols,
      symbolsEvaluated: symbols,
      rawOutput: output,
      failureReason: output.errorMessage || null,
    });

    await query(
      `UPDATE ai_agents
       SET last_active_at = NOW(), updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [agent.id, JSON.stringify({ last_result: output, last_run_at: new Date().toISOString(), last_run_id: runId })],
    );

    await writeExecutionAudit({
      userId: user?.id || null,
      agentId: agent.id,
      agentKey: 'arbitrage',
      action: trigger === 'manual' ? 'manual_scan' : 'scheduled_scan',
      allowed: true,
      reasonCode: 'analytical_read_only',
      effectiveMode: runtimeMode,
      sideEffectsSuppressed: true,
      metadata: { runId, trigger },
    });

    const candidates = [
      ...(output.candidates || []).map((c) => mapRawCandidateToDto(c, { runId })),
      ...(output.rejectedCandidates || []).map((c) => mapRawCandidateToDto(c, { runId })),
    ];

    return { scanRun, candidates, raw: output };
  });
}

function parseJsonField(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mapRecentRunSummary(row, agentId) {
  const scanRun = mapDecisionRowToScanRun(
    {
      id: row.id,
      created_at: row.created_at,
      execution_time_ms: row.execution_time_ms,
      output_data: parseJsonField(row.output_data),
      input_data: parseJsonField(row.input_data),
      was_successful: row.was_successful,
    },
    agentId,
  );
  return {
    runId: scanRun.runId,
    startedAt: scanRun.startedAt,
    completedAt: scanRun.completedAt,
    status: scanRun.status,
    trigger: scanRun.trigger,
    durationMs: scanRun.durationMs,
    durationAvailability: scanRun.durationAvailability,
    durationReason: scanRun.durationReason,
    durationState: scanRun.durationState,
    dataFreshnessState: scanRun.dataFreshnessState,
    dataFreshnessMs: scanRun.dataFreshnessMs,
    dataFreshnessReason: scanRun.dataFreshnessReason,
    sourceFreshnessMs: scanRun.sourceFreshnessMs,
    dryRun: scanRun.dryRun,
    runtimeMode: scanRun.runtimeMode,
    funnel: scanRun.funnel,
    rejectionSummary: scanRun.rejectionSummary,
    primaryRejectionReasons: scanRun.primaryRejectionReasons,
    evaluatedSymbols: scanRun.evaluatedSymbols,
    rejectedCount: scanRun.rejectedCount,
    qualifiedCount: scanRun.qualifiedCount,
    failureReason: scanRun.failureReason,
    sideEffectsSuppressed: scanRun.sideEffectsSuppressed,
  };
}

export async function getArbitrageOverview(agentId, { scheduler = {}, runtime = {} } = {}) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const settings = buildSettingsDto(normalizeArbitrageConfig(agent.config || {}), {
    updatedAt: agent.updated_at,
  });

  const [historicalSummary, latestRow, recentRows] = await Promise.all([
    fetchArbitrageHistoricalSummary(agent.id),
    fetchLatestArbitrageScanRow(agent.id),
    fetchRecentArbitrageScanRows(agent.id, 10),
  ]);

  const latestRun = latestRow
    ? mapDecisionRowToScanRun(
        {
          id: latestRow.id,
          created_at: latestRow.created_at,
          execution_time_ms: latestRow.execution_time_ms,
          output_data: parseJsonField(latestRow.output_data),
          input_data: parseJsonField(latestRow.input_data),
          was_successful: latestRow.was_successful,
        },
        agent.id,
      )
    : null;

  const recentRuns = recentRows.map((row) => mapRecentRunSummary(row, agent.id));

  return buildArbitrageOverviewSnapshot({
    agent,
    settings,
    latestRun,
    historicalSummary,
    recentRuns,
    schedulerState: scheduler,
    runtimeState: runtime,
    generatedAt: new Date().toISOString(),
  });
}

export async function updateMonitoringState({ agentId, monitoringState, user }) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) {
    const err = new Error('Arbitrage agent not found');
    err.status = 404;
    throw err;
  }
  if (![MONITORING_STATE.ACTIVE, MONITORING_STATE.PAUSED].includes(monitoringState)) {
    const err = new Error('Invalid monitoring state');
    err.status = 400;
    throw err;
  }

  const rawConfig = typeof agent.config === 'object' ? agent.config : {};
  const config = {
    ...normalizeArbitrageConfig(rawConfig),
    settingsVersion: rawConfig.settingsVersion,
    settingsUpdatedAt: rawConfig.settingsUpdatedAt,
    monitoringState: rawConfig.monitoringState,
  };
  config.monitoringState = monitoringState;
  config.enabled = monitoringState === MONITORING_STATE.ACTIVE;
  config.settingsVersion = (config.settingsVersion || 1) + 1;
  config.settingsUpdatedAt = new Date().toISOString();

  const status = monitoringState === MONITORING_STATE.ACTIVE ? 'active' : 'inactive';
  await query(
    `UPDATE ai_agents SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb, status = $3, updated_at = NOW() WHERE id = $1`,
    [agent.id, JSON.stringify(config), status],
  );

  await writeExecutionAudit({
    userId: user?.id || null,
    agentId: agent.id,
    agentKey: 'arbitrage',
    action: monitoringState === MONITORING_STATE.PAUSED ? 'pause_monitoring' : 'resume_monitoring',
    allowed: true,
    reasonCode: 'monitoring_state_change',
    effectiveMode: 'demo',
    sideEffectsSuppressed: true,
    metadata: { monitoringState },
  });

  return buildSettingsDto(config, { updatedAt: config.settingsUpdatedAt, updatedBy: user?.id || null });
}

function applySettingsInputToConfig(currentConfig, input = {}) {
  const next = { ...currentConfig };

  if (input.monitoredSymbols || input.symbols) {
    next.symbols = (input.monitoredSymbols || input.symbols).map((s) => String(s).toUpperCase());
  }
  if (input.minimumGrossSpreadBps != null) {
    next.minSpreadPct = Number(input.minimumGrossSpreadBps) / 100;
  }
  if (input.minimumNetSpreadBps != null) {
    next.opportunityThresholdBps = Number(input.minimumNetSpreadBps);
    next.strategies = (next.strategies || []).map((s) => {
      if (!s) return s;
      if (s.type === 'spot' || s.type === 'mexc_spot_spread_monitor') {
        return { ...s, minProfitBps: Number(input.minimumNetSpreadBps) };
      }
      return s;
    });
  }
  if (input.assumedFeesBps != null) next.feeBps = Number(input.assumedFeesBps);
  if (input.assumedSlippageBps != null) next.slippageBps = Number(input.assumedSlippageBps);
  if (input.minimumLiquidity != null) next.minVolumeUSDT = Number(input.minimumLiquidity);
  if (input.maximumDataAgeMs != null) next.maximumDataAgeMs = Number(input.maximumDataAgeMs);
  if (input.scanIntervalSeconds != null) next.scanIntervalSec = Number(input.scanIntervalSeconds);
  if (input.monitoringState) {
    next.monitoringState = input.monitoringState;
    next.enabled = input.monitoringState === MONITORING_STATE.ACTIVE;
  }
  if (input.notificationPreference != null) {
    next.autoActions = {
      ...(next.autoActions || {}),
      notifyOnOpportunity: Boolean(input.notificationPreference),
    };
  }

  return next;
}

function sortCandidates(items, sort = 'observedAt:desc') {
  const [field, direction = 'desc'] = String(sort || 'observedAt:desc').split(':');
  const dir = direction === 'asc' ? 1 : -1;
  const sorted = [...items];
  sorted.sort((a, b) => {
    let av;
    let bv;
    switch (field) {
      case 'symbol':
        av = a.symbol || '';
        bv = b.symbol || '';
        return av.localeCompare(bv) * dir;
      case 'netSpreadBps':
        av = a.netSpreadBps ?? Number.NEGATIVE_INFINITY;
        bv = b.netSpreadBps ?? Number.NEGATIVE_INFINITY;
        break;
      case 'grossSpreadBps':
        av = a.grossSpreadBps ?? Number.NEGATIVE_INFINITY;
        bv = b.grossSpreadBps ?? Number.NEGATIVE_INFINITY;
        break;
      default:
        av = Date.parse(a.observedAt || a.sourceTimestamp || '') || 0;
        bv = Date.parse(b.observedAt || b.sourceTimestamp || '') || 0;
        break;
    }
    if (av === bv) return 0;
    return av > bv ? dir : -dir;
  });
  return sorted;
}

export async function getArbitrageCandidates(agentId, filters = {}) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const {
    runId,
    symbol,
    lifecycle,
    rejectionReason,
    freshness,
    search,
    sort,
    page,
    pageSize,
  } = filters;

  const pagination = validatePagination({ page, pageSize });
  let effectiveRunId = runId || null;

  if (!effectiveRunId) {
    const latest = await fetchLatestArbitrageScanRow(agent.id);
    effectiveRunId = latest?.id || null;
  }

  const params = [agent.id, ARBITRAGE_DECISION_TYPE];
  let sql = `
    SELECT id, output_data, input_data, created_at, execution_time_ms, was_successful
    FROM ai_decisions
    WHERE agent_id = $1 AND decision_type = $2
  `;

  if (effectiveRunId) {
    params.push(effectiveRunId);
    sql += ` AND id = $${params.length}`;
  } else {
    return {
      items: [],
      allItems: [],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: 0,
        totalPages: 1,
        hasMore: false,
      },
      selectedRun: null,
      funnel: buildCandidateFunnelFromItems([]),
      availableFilters: buildCandidateAvailableFilters([]),
      generatedAt: new Date().toISOString(),
    };
  }

  sql += ' ORDER BY created_at DESC, id DESC LIMIT 1';

  const rows = await query(sql, params);
  let allCandidates = [];
  let selectedRun = null;

  for (const row of rows.rows) {
    const output = parseJsonField(row.output_data);
    allCandidates = [
      ...(output.candidates || []).map((c) => mapRawCandidateToDto(c, { runId: row.id })),
      ...(output.rejectedCandidates || []).map((c) => mapRawCandidateToDto(c, { runId: row.id })),
      ...(output.qualifiedOpportunities || []).map((c) =>
        mapRawCandidateToDto({ ...c, lifecycle: 'qualified' }, { runId: row.id }),
      ),
    ];
    selectedRun = mapRecentRunSummary(row, agent.id);
    if (!selectedRun.funnel || Object.keys(selectedRun.funnel).length === 0) {
      selectedRun.funnel = buildCandidateFunnelFromItems(allCandidates);
    }
  }

  const availableFilters = buildCandidateAvailableFilters(allCandidates);
  const funnel = buildCandidateFunnelFromItems(allCandidates);

  let candidates = [...allCandidates];

  if (symbol) {
    const sym = String(symbol).toUpperCase().slice(0, 32);
    candidates = candidates.filter((c) => c.symbol === sym);
  }
  if (lifecycle) {
    candidates = candidates.filter((c) => c.lifecycleState === lifecycle);
  }
  if (rejectionReason) {
    candidates = candidates.filter((c) => c.rejectionReasons?.includes(rejectionReason));
  }
  if (freshness) {
    candidates = candidates.filter((c) => c.freshnessState === freshness);
  }
  if (search) {
    const q = String(search).toUpperCase().slice(0, 64);
    candidates = candidates.filter(
      (c) => c.symbol?.includes(q) || c.baseAsset?.includes(q) || c.quoteAsset?.includes(q),
    );
  }

  candidates = sortCandidates(candidates, sort);
  const total = candidates.length;
  const items = candidates.slice(pagination.offset, pagination.offset + pagination.pageSize);

  return {
    items,
    allItems: allCandidates,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
      hasMore: pagination.offset + items.length < total,
    },
    selectedRun: selectedRun
      ? {
          ...selectedRun,
          runId: selectedRun.runId || effectiveRunId,
        }
      : null,
    funnel,
    availableFilters,
    generatedAt: new Date().toISOString(),
  };
}

export async function getArbitrageRuns(agentId, filters = {}) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const queryOpts = validateHistoryQuery(filters);
  const { page, pageSize, offset, trigger, status, dateFrom, dateTo, search, sort } = queryOpts;

  const params = [agent.id, ARBITRAGE_DECISION_TYPE];
  let where = 'agent_id = $1 AND decision_type = $2';

  if (trigger) {
    params.push(trigger);
    where += ` AND COALESCE(input_data->>'trigger', output_data->>'trigger', 'scheduled') = $${params.length}`;
  }
  if (dateFrom) {
    params.push(dateFrom);
    where += ` AND created_at >= $${params.length}::timestamptz`;
  }
  if (dateTo) {
    params.push(dateTo);
    where += ` AND created_at <= $${params.length}::timestamptz`;
  }
  if (status === SCAN_RUN_STATUS.FAILED) {
    where += ' AND was_successful = false';
  } else if (status === SCAN_RUN_STATUS.COMPLETED) {
    where += ' AND was_successful = true';
  }
  if (search && /^[a-f0-9-]{8,36}$/i.test(search)) {
    params.push(`${search}%`);
    where += ` AND id::text ILIKE $${params.length}`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM ai_decisions WHERE ${where}`,
    params,
  );
  const total = countResult.rows[0]?.total || 0;

  const orderDir = sort.endsWith(':asc') ? 'ASC' : 'DESC';
  const [rows, historicalSummary] = await Promise.all([
    query(
      `SELECT id, input_data, output_data, created_at, execution_time_ms, was_successful
       FROM ai_decisions
       WHERE ${where}
       ORDER BY created_at ${orderDir}, id ${orderDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    ),
    fetchArbitrageHistoricalSummary(agent.id),
  ]);

  const items = rows.rows.map((row) =>
    mapRecentRunSummary(row, agent.id),
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    summary: buildHistorySummary(historicalSummary),
    availableFilters: {
      triggers: ['manual', 'scheduled'],
      statuses: [
        SCAN_RUN_STATUS.COMPLETED,
        SCAN_RUN_STATUS.FAILED,
        SCAN_RUN_STATUS.RUNNING,
        SCAN_RUN_STATUS.CANCELLED,
        SCAN_RUN_STATUS.BLOCKED,
      ],
    },
    generatedAt: new Date().toISOString(),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: offset + items.length < total,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

export async function getArbitrageRunComparison(agentId, runId) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const detail = await getArbitrageRunDetail(agentId, runId);
  if (!detail) return null;

  const current = detail.scanRun;
  const prevResult = await query(
    `SELECT id, input_data, output_data, created_at, execution_time_ms, was_successful
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2 AND created_at < $3::timestamptz
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [agent.id, ARBITRAGE_DECISION_TYPE, current.startedAt || current.createdAt],
  );

  const previous =
    prevResult.rows.length > 0
      ? mapDecisionRowToScanRun(
          {
            id: prevResult.rows[0].id,
            created_at: prevResult.rows[0].created_at,
            execution_time_ms: prevResult.rows[0].execution_time_ms,
            output_data: parseJsonField(prevResult.rows[0].output_data),
            input_data: parseJsonField(prevResult.rows[0].input_data),
            was_successful: prevResult.rows[0].was_successful,
          },
          agent.id,
        )
      : null;

  return {
    current,
    previous,
    comparison: compareScanRuns(current, previous),
  };
}

export async function getArbitrageRunDetail(agentId, runId) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const result = await query(
    `SELECT id, input_data, output_data, created_at, execution_time_ms, was_successful
     FROM ai_decisions
     WHERE id = $1 AND agent_id = $2 AND decision_type = $3
     LIMIT 1`,
    [runId, agent.id, ARBITRAGE_DECISION_TYPE],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const output = parseJsonField(row.output_data);
  const scanRun = mapDecisionRowToScanRun(
    {
      id: row.id,
      created_at: row.created_at,
      execution_time_ms: row.execution_time_ms,
      output_data: output,
      input_data: parseJsonField(row.input_data),
      was_successful: row.was_successful,
    },
    agent.id,
  );

  const candidates = [
    ...(output.candidates || []).map((c) => mapRawCandidateToDto(c, { runId: row.id })),
    ...(output.rejectedCandidates || []).map((c) => mapRawCandidateToDto(c, { runId: row.id })),
  ];

  return { scanRun, candidates, raw: output, malformed: !output || typeof output !== 'object' };
}

export async function getArbitrageIntegrations(agentId) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const scheduler = await readAnalyticalSchedulerStatus();
  const config = normalizeArbitrageConfig(agent.config || {});
  const mexcExchange = (config.exchanges || []).find(
    (ex) => (typeof ex === 'string' ? ex : ex?.id)?.toLowerCase?.() === 'mexc',
  );

  return {
    mexcPublicMarketData: {
      status: 'available',
      credentialRequired: false,
      exchangeId: 'mexc',
      enabled: typeof mexcExchange === 'object' ? mexcExchange.enabled !== false : true,
    },
    marketProxy: {
      status: 'operational',
      basePath: '/api/market/mexc',
      readOnly: true,
    },
    scheduler: {
      owner: scheduler.status?.owner || 'titan-engine-worker',
      isRunning: scheduler.status?.isRunning === true,
      allowlist: scheduler.status?.allowlist || ['arbitrage'],
      stale: scheduler.stale,
      source: scheduler.source,
      lastTickAt: scheduler.status?.lastTickAt || null,
    },
    redisScanLock: {
      available: isRedisAvailable(),
      keyPrefix: 'titan:arbitrage:scan_lock:',
      ttlSec: 120,
      fallback: 'memory',
    },
    database: {
      status: 'connected',
      scanHistorySource: 'ai_decisions',
      decisionType: ARBITRAGE_DECISION_TYPE,
    },
    notifications: {
      preferenceSupported: true,
      deliveryAvailable: false,
      channels: ['dashboard'],
      note: 'Notification delivery is not enabled for analytical scans.',
    },
    execution: {
      supported: false,
      eligible: false,
    },
  };
}

export async function getArbitrageProfitRisk(agentId, { runId } = {}) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) return null;

  const settings = buildSettingsDto(normalizeArbitrageConfig(agent.config || {}), {
    updatedAt: agent.updated_at,
  });

  let effectiveRunId = runId || null;
  if (!effectiveRunId) {
    const latest = await fetchLatestArbitrageScanRow(agent.id);
    effectiveRunId = latest?.id || null;
  }
  if (!effectiveRunId) {
    return {
      analytics: buildProfitRiskAnalytics({
        scanRun: null,
        candidates: [],
        settings,
        rawOutput: {},
        trendRuns: [],
      }),
      selectedRun: null,
      availableRuns: [],
    };
  }

  const [detail, recentRows] = await Promise.all([
    getArbitrageRunDetail(agent.id, effectiveRunId),
    fetchRecentArbitrageScanRows(agent.id, 10),
  ]);

  if (!detail) return null;

  const trendRuns = recentRows.map((row) =>
    enrichTrendRunFromOutput(row, agent.id, mapDecisionRowToScanRun),
  );

  const analytics = buildProfitRiskAnalytics({
    scanRun: detail.scanRun,
    candidates: detail.candidates || mapCandidatesFromRunOutput(detail.raw, effectiveRunId),
    settings,
    rawOutput: detail.raw || {},
    trendRuns,
  });

  const availableRuns = trendRuns.map(r => ({
    runId: r.runId,
    completedAt: r.completedAt,
    trigger: r.trigger,
    status: r.status,
  }));

  return {
    analytics,
    selectedRun: detail.scanRun,
    availableRuns,
    generatedAt: new Date().toISOString(),
  };
}

export async function updateArbitrageSettings(agentId, settingsInput, user, expectedVersion) {
  const agent = await loadArbitrageAgent(agentId);
  if (!agent) {
    const err = new Error('Arbitrage agent not found');
    err.status = 404;
    throw err;
  }

  const validation = validateSettingsInput(settingsInput || {});
  if (!validation.ok) {
    const err = new Error(validation.errors.join('; '));
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.details = validation.errors;
    throw err;
  }

  const rawConfig = typeof agent.config === 'object' ? agent.config : {};
  const currentConfig = {
    ...normalizeArbitrageConfig(rawConfig),
    settingsVersion: rawConfig.settingsVersion ?? 1,
    settingsUpdatedAt: rawConfig.settingsUpdatedAt,
    monitoringState: rawConfig.monitoringState,
    maximumDataAgeMs: rawConfig.maximumDataAgeMs,
  };
  const currentVersion = currentConfig.settingsVersion ?? 1;

  if (expectedVersion != null && Number(expectedVersion) !== Number(currentVersion)) {
    const err = new Error('Settings version conflict');
    err.status = 409;
    err.code = 'VERSION_CONFLICT';
    err.details = { expectedVersion: Number(expectedVersion), currentVersion: Number(currentVersion) };
    throw err;
  }

  const merged = applySettingsInputToConfig(currentConfig, settingsInput);
  merged.settingsVersion = Number(currentVersion) + 1;
  merged.settingsUpdatedAt = new Date().toISOString();
  const sanitized = sanitizeDomainConfig(merged);

  const monitoringState = sanitized.monitoringState
    || (sanitized.enabled === false ? MONITORING_STATE.PAUSED : MONITORING_STATE.ACTIVE);
  sanitized.monitoringState = monitoringState;
  sanitized.enabled = monitoringState === MONITORING_STATE.ACTIVE;

  const status = monitoringState === MONITORING_STATE.ACTIVE ? 'active' : 'inactive';

  await query(
    `UPDATE ai_agents
     SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
         status = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [agent.id, JSON.stringify(sanitized), status],
  );

  await writeExecutionAudit({
    userId: user?.id || null,
    agentId: agent.id,
    agentKey: 'arbitrage',
    action: 'update_settings',
    allowed: true,
    reasonCode: 'settings_update',
    effectiveMode: 'demo',
    sideEffectsSuppressed: true,
    metadata: { settingsVersion: sanitized.settingsVersion },
  });

  return buildSettingsDto(sanitized, {
    version: sanitized.settingsVersion,
    updatedAt: sanitized.settingsUpdatedAt,
    updatedBy: user?.id || null,
  });
}
