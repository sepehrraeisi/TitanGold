/**
 * WP-B.1 on-read Artemis evidence projection.
 * Reads ai_decisions + ai_agents. No writes, no migration, no provider calls, no Agent execution.
 */

import { query } from '../database/db.js';
import {
  ADAPTER_VERSIONS,
  CANONICAL_AGENT_IDS,
  validateEvidenceEnvelope,
} from '../contracts/artemisEvidenceContract.js';
import { resolveArtemisAgentIdentity } from './artemisAgentIdentity.js';
import { projectEvidenceForProduct } from './artemisEvidenceProductProjection.js';
import {
  mapArbitragePersistedRun,
  mapFundamentalPersistedRun,
  mapLiquidityPersistedRun,
  mapMarketIntelligencePersistedRun,
  mapOptimizationPersistedRun,
  mapOrderPersistedRun,
  mapPatternPersistedRun,
  mapPortfolioPersistedRun,
  mapPricePredictionPersistedRun,
  mapRiskPersistedRun,
  mapSentimentPersistedRun,
  mapTechnicalPersistedRun,
  mapTimingPersistedRun,
  mapTrendPersistedRun,
  mapVolumePersistedRun,
} from './artemisEvidenceAdapters/index.js';
import { parseJsonObject } from './artemisEvidenceAdapters/support.js';

export const COMPATIBLE_ADAPTER_IDS = CANONICAL_AGENT_IDS;

const ADAPTERS = Object.freeze({
  technical: mapTechnicalPersistedRun,
  trend: mapTrendPersistedRun,
  pattern: mapPatternPersistedRun,
  volume: mapVolumePersistedRun,
  sentiment: mapSentimentPersistedRun,
  fundamental: mapFundamentalPersistedRun,
  market_intelligence: mapMarketIntelligencePersistedRun,
  price_prediction: mapPricePredictionPersistedRun,
  timing: mapTimingPersistedRun,
  arbitrage: mapArbitragePersistedRun,
  risk: mapRiskPersistedRun,
  portfolio: mapPortfolioPersistedRun,
  optimization: mapOptimizationPersistedRun,
  liquidity: mapLiquidityPersistedRun,
  order: mapOrderPersistedRun,
});

export const AI_DECISIONS_EVIDENCE_READ_SQL = `
SELECT d.id, d.agent_id, d.user_id, d.decision_type, d.confidence,
       d.input_data AS input, d.output_data AS output,
       d.was_successful, d.created_at, d.metadata,
       a.agent_key, a.name AS agent_name
  FROM ai_decisions d
  LEFT JOIN ai_agents a ON a.id = d.agent_id
 ORDER BY d.created_at DESC
 LIMIT $1
`;

let lastProjectionMetrics = {
  queryCount: 0,
  rowsLoaded: 0,
  elapsedMs: 0,
  serializedBytes: 0,
};

export function getLastProjectionMetrics() {
  return { ...lastProjectionMetrics };
}

export function isAdapterCompatible(agentId) {
  return COMPATIBLE_ADAPTER_IDS.includes(agentId);
}

export function projectDecisionRow(row = {}, { nowMs, includeInternalEnvelope = false } = {}) {
  const started = Date.now();
  const identity = resolveArtemisAgentIdentity(row.agent_key || row.agentKey || row.agentId);
  if (identity.status !== 'ok') {
    return {
      ok: false,
      reason: identity.reason || identity.status,
      identity,
      evidenceCompatible: false,
      evidenceAvailable: false,
      elapsedMs: Date.now() - started,
    };
  }

  const adapter = ADAPTERS[identity.agentId];
  if (!adapter) {
    return {
      ok: false,
      reason: 'no_stage3_adapter',
      agentId: identity.agentId,
      evidenceCompatible: false,
      evidenceAvailable: false,
      elapsedMs: Date.now() - started,
    };
  }

  const output = parseJsonObject(row.output ?? row.output_data);
  const input = parseJsonObject(row.input ?? row.input_data);
  const mapped = adapter({
    row,
    output,
    input,
    persistedConfidence: row.confidence,
    nowMs,
  });
  if (!mapped?.ok || !mapped.envelope) {
    return {
      ok: false,
      reason: mapped?.reason || 'adapter_failed',
      agentId: identity.agentId,
      evidenceCompatible: true,
      evidenceAvailable: false,
      elapsedMs: Date.now() - started,
    };
  }

  const validation = validateEvidenceEnvelope(mapped.envelope, { nowMs });
  if (!validation.ok) {
    return {
      ok: false,
      reason: 'envelope_validation_failed',
      validation,
      agentId: identity.agentId,
      evidenceCompatible: true,
      evidenceAvailable: false,
      elapsedMs: Date.now() - started,
    };
  }

  const product = projectEvidenceForProduct(mapped.envelope);
  return {
    ok: true,
    agentId: identity.agentId,
    evidenceCompatible: true,
    evidenceAvailable: mapped.envelope.availability === 'available',
    validation,
    product,
    envelope: includeInternalEnvelope ? mapped.envelope : undefined,
    elapsedMs: Date.now() - started,
  };
}

export async function projectRecentEvidence({ limit = 50, includeInternalEnvelope = false, nowMs } = {}) {
  const bounded = Math.min(Math.max(Number(limit) || 50, 1), 50);
  const started = Date.now();
  const result = await query(AI_DECISIONS_EVIDENCE_READ_SQL, [bounded]);
  const rows = result.rows || [];
  const projections = rows.map((row) => projectDecisionRow(row, { nowMs, includeInternalEnvelope }));
  lastProjectionMetrics = {
    queryCount: 1,
    rowsLoaded: rows.length,
    elapsedMs: Date.now() - started,
    serializedBytes: projections.reduce((sum, item) => sum + (item.validation?.bytes || 0), 0),
  };
  return {
    rows: projections,
    metrics: getLastProjectionMetrics(),
    adapterVersions: ADAPTER_VERSIONS,
  };
}

export function summarizeCompatibleAvailability(projections = []) {
  const summary = {};
  for (const agentId of COMPATIBLE_ADAPTER_IDS) {
    summary[agentId] = { evidenceCompatible: true, evidenceAvailable: false };
  }
  for (const item of projections) {
    if (!item?.agentId || !summary[item.agentId]) continue;
    if (item.evidenceAvailable) summary[item.agentId].evidenceAvailable = true;
  }
  return summary;
}

export default {
  COMPATIBLE_ADAPTER_IDS,
  AI_DECISIONS_EVIDENCE_READ_SQL,
  projectDecisionRow,
  projectRecentEvidence,
  summarizeCompatibleAvailability,
  getLastProjectionMetrics,
  isAdapterCompatible,
};
