/**
 * Read-only Arbitrage → Artemis evidence adapter.
 * Opportunity ≠ directional market vote. Heuristic confidence is not P(profit).
 */

import {
  ADAPTER_VERSIONS,
  AVAILABILITY,
  CONFIDENCE_SCALE,
  CORRELATION_FAMILY,
  DIRECTION,
  DIRECTIONAL_CONTRIBUTION,
  EVIDENCE_TYPE,
  EXECUTION_CLASS,
  LIFECYCLE_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import {
  asFiniteNumber,
  asIsoOrNull,
  heuristicConfidence,
  resolveConfidenceFromProvenance,
  resolveDataQuality,
  resolveFreshness,
} from '../artemisEvidenceTruth.js';
import { buildBaseEnvelope, parseJsonObject, scalarEvidenceValue } from './support.js';

function buildArbitrageEvidence(output) {
  const items = [];
  const candidates = Array.isArray(output.candidates) ? output.candidates : [];
  for (const [index, candidate] of candidates.slice(0, 8).entries()) {
    items.push({
      evidenceId: `arb-candidate-${index + 1}`,
      evidenceType: EVIDENCE_TYPE.SPREAD,
      canonicalSource: 'arbitrage.candidates',
      value: scalarEvidenceValue(candidate.symbol),
      unit: candidate.netSpreadPct != null ? 'netSpreadPct' : undefined,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    });
    const spread = asFiniteNumber(candidate.spreadPct ?? candidate.netSpreadPct);
    if (spread != null) {
      items.push({
        evidenceId: `arb-spread-${index + 1}`,
        evidenceType: EVIDENCE_TYPE.METRIC,
        canonicalSource: 'arbitrage.candidates.spreadPct',
        value: spread,
        unit: 'percent',
        directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
      });
    }
  }
  const summaryCount = asFiniteNumber(output.summary?.spreadCandidates ?? output.candidateStats?.spreadCandidates);
  if (summaryCount != null) {
    items.push({
      evidenceId: 'arb-spread-count',
      evidenceType: EVIDENCE_TYPE.METRIC,
      canonicalSource: 'arbitrage.summary.spreadCandidates',
      value: summaryCount,
      directionalContribution: DIRECTIONAL_CONTRIBUTION.NOT_APPLICABLE,
    });
  }
  return { items: items.slice(0, 32) };
}

export function mapArbitragePersistedRun({ row = {}, output: rawOutput, input: rawInput, persistedConfidence, nowMs } = {}) {
  const output = parseJsonObject(rawOutput ?? row.output ?? row.output_data);
  const input = parseJsonObject(rawInput ?? row.input ?? row.input_data);
  const analysisTimestamp = asIsoOrNull(output.timestamp) || asIsoOrNull(row.created_at);
  const quoteTimestamp = asIsoOrNull(output.quoteTimestamp || output.sourceTimestamp || output.candidates?.[0]?.quoteTimestamp);
  const freshness = resolveFreshness({
    analysisTimestamp,
    sourceTimestamp: quoteTimestamp,
    timeframe: null,
    policyId: 'arbitrage-scan-no-quote-ttl',
    nowMs,
  });

  const resolved = resolveConfidenceFromProvenance({
    agentOutput: output,
    persistedConfidence: persistedConfidence ?? row.confidence,
    explicitPaths: ['confidence'],
  });
  const confidence = resolved.availability === 'available'
    ? heuristicConfidence({
        value: resolved.value,
        scale: CONFIDENCE_SCALE.UNIT_INTERVAL,
        path: resolved.provenance?.path,
      })
    : { ...resolved, scale: CONFIDENCE_SCALE.UNKNOWN };

  const failed = output.error === true || Boolean(output.errorMessage);
  const limitations = [
    'advisory_only',
    'not_executable_multi_leg',
    'arbitrage_confidence_is_heuristic_not_profit_probability',
  ];
  if (freshness.status === 'unknown') limitations.push(freshness.reasonKey || 'missing_quote_timestamp');

  return {
    ok: true,
    envelope: buildBaseEnvelope({
      agentId: 'arbitrage',
      adapterVersion: ADAPTER_VERSIONS.arbitrage,
      runId: row.id || null,
      agentRecordId: row.agent_id || row.agentId || null,
      analysisTimestamp: analysisTimestamp || new Date().toISOString(),
      createdAt: row.created_at,
      symbol: output.candidates?.[0]?.symbol || input.symbol || input.symbols?.[0] || null,
      timeframe: null,
      provider: output._meta?.dataProvider || 'mexc',
      venue: 'mexc',
      correlationFamily: CORRELATION_FAMILY.SPREAD_MONITOR,
      availability: failed ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.AVAILABLE,
      unavailableReason: failed ? 'arbitrage_scan_failed' : null,
      lifecycleStatus: failed ? LIFECYCLE_STATUS.FAILED : LIFECYCLE_STATUS.COMPLETED,
      limitations,
      executionClass: EXECUTION_CLASS.ADVISORY_ONLY,
      freshness,
      dataQuality: resolveDataQuality({
        sourceAvailability: failed ? 'unavailable' : 'available',
        sampleAdequacy: Array.isArray(output.candidates) || Array.isArray(output.rejectedCandidates) ? 'ok' : 'insufficient',
        mockOrPlaceholder: String(output._meta?.source || '').toLowerCase() === 'mock',
        freshnessStatus: freshness.status,
        knownLimitationKeys: limitations,
      }),
      confidence,
      conclusion: {
        direction: DIRECTION.NOT_APPLICABLE,
        signal: 'observe',
      },
      evidence: buildArbitrageEvidence(output),
      provenance: {
        writer: 'arbitrageEvidenceAdapter',
        source: 'ai_decisions.output_data',
        adapterVersion: ADAPTER_VERSIONS.arbitrage,
        analyticalMode: output.analyticalMode || null,
      },
    }),
  };
}

export default { mapArbitragePersistedRun };
