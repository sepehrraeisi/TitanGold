/**
 * @jest-environment node
 *
 * Artemis Core Stage 6 — EvidenceOrchestrationSet service tests.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mockIngestEvidenceBatch = jest.fn();

jest.unstable_mockModule('../../services/artemisEvidenceIngestionService.js', () => ({
  ingestEvidenceBatch: mockIngestEvidenceBatch,
  ingestEvidence: jest.fn(),
  getValidatedEvidence: jest.fn(),
  applyIngestionDisposition: jest.fn(),
  assertReadOnlySql: jest.fn(),
  getLastIngestionMetrics: jest.fn(),
  resolveStage4AgentFilter: jest.fn(),
  AI_DECISIONS_INGEST_READ_SQL: 'SELECT 1',
  default: { ingestEvidenceBatch: mockIngestEvidenceBatch },
}));

const {
  CANONICAL_AGENT_IDS,
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  CORRELATION_FAMILY,
  DIRECTION,
} = await import('../../contracts/artemisEvidenceContract.js');
const {
  INGESTION_DISPOSITION,
  MAX_INGEST_BATCH,
  AGENT_FILTER_STATE,
} = await import('../../contracts/artemisEvidenceIngestionContract.js');
const {
  ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_SCHEMA_VERSION,
  ORCHESTRATION_WRITER,
  CONFLICT_KIND,
  CONFIRMATION_SEMANTICS,
  ZERO_ORCHESTRATION_SIDE_EFFECTS,
} = await import('../../contracts/artemisEvidenceOrchestrationContract.js');
const {
  orchestrateEvidence,
  buildEvidenceOrchestrationSet,
} = await import('../../services/artemisEvidenceOrchestrationService.js');

const NOW = Date.parse('2026-09-02T12:10:00.000Z');
const TS = '2026-09-02T12:00:00.000Z';
const TS_OLD = '2026-09-02T11:00:00.000Z';
const CANDLE = '2026-09-02T11:00:00.000Z';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000a1';

function baseEnvelope(agentId, overrides = {}) {
  const role = AGENT_CONTRACT_ROLE[agentId];
  return {
    schemaVersion: '1.0.0',
    contractVersion: 'artemis-evidence-1.0.0',
    agentId,
    agentRole: role.agentRole,
    authorityClass: role.authorityClass,
    runId: overrides.runId || `00000000-0000-4000-8000-${agentId.padEnd(12, '0').slice(0, 12)}`,
    correlationId: overrides.correlationId || '11111111-1111-4111-8111-111111111111',
    provider: 'mexc',
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysisHorizon: 'intraday',
    analysisTimestamp: TS,
    sourceTimestamp: TS,
    sourceCandleTimestamp: CANDLE,
    availability: 'available',
    freshness: { status: 'fresh' },
    correlationFamily: overrides.correlationFamily || CORRELATION_FAMILY.OHLCV_CANDLE,
    conclusion: { signal: overrides.direction || DIRECTION.BULLISH },
    provenance: { writer: 'agent_adapter', source: 'mexc' },
    ...overrides.envelope,
  };
}

function acceptedItem(agentId, overrides = {}) {
  const envelope = baseEnvelope(agentId, overrides);
  return {
    disposition: INGESTION_DISPOSITION.ACCEPTED,
    reasonKey: 'valid_current_evidence',
    agentId,
    authorityClass: AGENT_CONTRACT_ROLE[agentId].authorityClass,
    envelope,
    lineage: {
      runId: envelope.runId,
      correlationFamily: envelope.correlationFamily,
      analysisTimestamp: envelope.analysisTimestamp,
      sourceTimestamp: envelope.sourceTimestamp,
      sourceCandleTimestamp: envelope.sourceCandleTimestamp,
    },
    sideEffects: { ...ZERO_ORCHESTRATION_SIDE_EFFECTS },
    executionEligible: false,
    decisionEligible: false,
  };
}

function excludedItem(agentId, disposition, reasonKey, overrides = {}) {
  const envelope = overrides.envelope === null
    ? null
    : baseEnvelope(agentId, overrides);
  return {
    disposition,
    reasonKey,
    agentId,
    authorityClass: AGENT_CONTRACT_ROLE[agentId]?.authorityClass ?? null,
    envelope,
    lineage: envelope ? {
      runId: envelope.runId,
      correlationFamily: envelope.correlationFamily,
      analysisTimestamp: envelope.analysisTimestamp,
    } : { runId: null },
    contextCompatibility: overrides.contextCompatibility,
    sideEffects: { ...ZERO_ORCHESTRATION_SIDE_EFFECTS },
    executionEligible: false,
    decisionEligible: false,
  };
}

function batchOf(items, queryOverrides = {}) {
  return {
    items,
    counts: { accepted: items.filter((i) => i.disposition === 'ACCEPTED').length, total: items.length },
    query: {
      bounded: true,
      executed: true,
      limit: 50,
      maxLimit: MAX_INGEST_BATCH,
      nPlusOne: false,
      ownerScoped: true,
      agentFilterState: AGENT_FILTER_STATE.NONE,
      ...queryOverrides,
    },
    filter: {
      policy: 'STRICT',
      state: queryOverrides.agentFilterState || AGENT_FILTER_STATE.NONE,
      requested: false,
      queried: queryOverrides.executed !== false,
      canonicalIds: [],
      rejectedIds: [],
      reasonKey: null,
    },
    canonicalAgentCount: 15,
    sideEffects: { ...ZERO_ORCHESTRATION_SIDE_EFFECTS },
    metrics: { queryCount: 1, nPlusOne: false, bounded: true, limit: 50 },
    ingestion: {
      stage: 4,
      writer: 'artemisEvidenceIngestionService',
      contractVersion: 'artemis-evidence-ingestion-1.0.0',
      ingestedAt: '2026-09-02T12:10:00.000Z',
    },
    executionEligible: false,
    decisionEligible: false,
  };
}

beforeEach(() => {
  mockIngestEvidenceBatch.mockReset();
});

describe('artemisEvidenceOrchestrationService — Stage 6', () => {
  it('1. consumes Stage 4 batch shape only via buildEvidenceOrchestrationSet', () => {
    const set = buildEvidenceOrchestrationSet(
      batchOf([acceptedItem('technical')]),
      { nowMs: NOW, ownerUserId: OWNER },
    );
    expect(set.provenance.inputOwner).toBe('artemisEvidenceIngestionService');
    expect(set.provenance.inputMethod).toBe('ingestEvidenceBatch');
    expect(set.contractVersion).toBe(ORCHESTRATION_CONTRACT_VERSION);
    expect(set.schemaVersion).toBe(ORCHESTRATION_SCHEMA_VERSION);
  });

  it('2. covers all 15 canonical Agent identities in missing/coverage model', () => {
    const set = buildEvidenceOrchestrationSet(batchOf([]), { nowMs: NOW });
    expect(set.coverage.canonicalAgentCount).toBe(15);
    expect(CANONICAL_AGENT_IDS).toHaveLength(15);
    expect(set.missingEvidence).toHaveLength(15);
    expect(set.missingEvidence.map((m) => m.agentId).sort()).toEqual([...CANONICAL_AGENT_IDS].sort());
  });

  it('3–4. deterministic grouping and orchestrationId for same input+nowMs', () => {
    const items = [
      acceptedItem('technical', { direction: DIRECTION.BULLISH, runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' }),
      acceptedItem('trend', { direction: DIRECTION.BULLISH, runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002' }),
    ];
    const a = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW, ownerUserId: OWNER });
    const b = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW, ownerUserId: OWNER });
    expect(a.orchestrationId).toBe(b.orchestrationId);
    expect(a.groups.map((g) => g.groupId)).toEqual(b.groups.map((g) => g.groupId));
    expect(a.conflicts.map((c) => c.conflictId)).toEqual(b.conflicts.map((c) => c.conflictId));
  });

  it('5–6. correlated OHLCV Agents group as one family, not independent confirmations', () => {
    const ohlcvAgents = ['technical', 'trend', 'pattern', 'volume', 'price_prediction'];
    const items = ohlcvAgents.map((id, i) => acceptedItem(id, {
      direction: DIRECTION.BULLISH,
      runId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
      correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    }));
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    expect(set.groups).toHaveLength(1);
    expect(set.groups[0].correlationFamily).toBe(CORRELATION_FAMILY.OHLCV_CANDLE);
    expect(set.groups[0].memberAgentIds).toHaveLength(5);
    expect(set.groups[0].evidenceCount).toBe(5);
    expect(set.groups[0].independentConfirmationCount).toBe(1);
    expect(set.groups[0].independentConfirmationCount).not.toBe(5);
    expect(set.groups[0].confirmationSemantics).toBe(CONFIRMATION_SEMANTICS.CORRELATED_NOT_INDEPENDENT);
    expect(set.coverage.independentDirectionalFamilyCount).toBe(1);
    expect(set.coverage.correlatedMemberCountIsNotIndependentConfirmation).toBe(true);
  });

  it('7. conflicting directions represented, not resolved by majority/weight/average', () => {
    const items = [
      acceptedItem('technical', { direction: DIRECTION.BULLISH, runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' }),
      acceptedItem('trend', { direction: DIRECTION.BEARISH, runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002' }),
    ];
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    const familyConflict = set.conflicts.find((c) => c.kind === CONFLICT_KIND.CORRELATED_FAMILY_DISAGREEMENT);
    expect(familyConflict).toBeTruthy();
    expect(familyConflict.resolvedIntoDecision).toBe(false);
    expect(familyConflict.majorityVoteApplied).toBe(false);
    expect(familyConflict.weightedVoteApplied).toBe(false);
    expect(familyConflict.confidenceAveraged).toBe(false);
    expect(set.synthesizedDirection).toBeNull();
    expect(set.financialRecommendation).toBeNull();
    expect(set.coverage.majorityVotingApplied).toBe(false);
    expect(set.coverage.weightedVotingApplied).toBe(false);
    expect(set.coverage.confidenceAveragingApplied).toBe(false);
  });

  it('8–9. timeframe and horizon mismatches represented', () => {
    const items = [
      acceptedItem('technical', {
        direction: DIRECTION.BULLISH,
        runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        envelope: { timeframe: '4h', analysisHorizon: 'swing' },
      }),
    ];
    const set = buildEvidenceOrchestrationSet(batchOf(items), {
      nowMs: NOW,
      decisionContext: { timeframe: '1h', analysisHorizon: 'intraday', symbol: 'BTC/USDT' },
    });
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.TIMEFRAME_MISMATCH)).toBe(true);
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.HORIZON_MISMATCH)).toBe(true);
  });

  it('10–11. same-Agent multi-run keeps newest deterministically', () => {
    const older = acceptedItem('technical', {
      direction: DIRECTION.BEARISH,
      runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
      envelope: { analysisTimestamp: TS_OLD, sourceTimestamp: TS_OLD },
    });
    const newer = acceptedItem('technical', {
      direction: DIRECTION.BULLISH,
      runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
      envelope: { analysisTimestamp: TS, sourceTimestamp: TS },
    });
    const set = buildEvidenceOrchestrationSet(batchOf([older, newer]), { nowMs: NOW });
    expect(set.includedEvidence).toHaveLength(1);
    expect(set.includedEvidence[0].runId).toBe(newer.envelope.runId);
    expect(set.includedEvidence[0].direction).toBe(DIRECTION.BULLISH);
    expect(set.excludedEvidence.some((e) => e.runId === older.envelope.runId)).toBe(true);
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.SAME_AGENT_MULTIPLE_RECORDS)).toBe(true);
  });

  it('12–16. stale/expired/invalid/identity/context exclusions reported, not usable', () => {
    const items = [
      excludedItem('technical', INGESTION_DISPOSITION.REJECTED_STALE, 'stale_not_current'),
      excludedItem('trend', INGESTION_DISPOSITION.REJECTED_EXPIRED, 'expired_not_current'),
      excludedItem('pattern', INGESTION_DISPOSITION.REJECTED_INVALID, 'invalid_schema'),
      excludedItem('volume', INGESTION_DISPOSITION.REJECTED_IDENTITY, 'unknown_agent'),
      excludedItem('sentiment', INGESTION_DISPOSITION.REJECTED_CONTEXT, 'context_incompatible', {
        contextCompatibility: {
          compatible: false,
          mismatches: [{ field: 'timeframe' }, { field: 'analysisHorizon' }],
        },
      }),
    ];
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    expect(set.includedEvidence).toHaveLength(0);
    expect(set.excludedEvidence).toHaveLength(5);
    expect(set.excludedEvidence.every((e) => e.usable === false)).toBe(true);
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY)).toBe(true);
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.CONTEXT_MISMATCH
      || c.kind === CONFLICT_KIND.TIMEFRAME_MISMATCH
      || c.kind === CONFLICT_KIND.HORIZON_MISMATCH)).toBe(true);
  });

  it('17–20. unavailable/blocked/not_applicable/missing are not neutral or negative', () => {
    const items = [
      excludedItem('technical', INGESTION_DISPOSITION.UNAVAILABLE, 'unavailable'),
      excludedItem('liquidity', INGESTION_DISPOSITION.BLOCKED, 'blocked'),
      excludedItem('optimization', INGESTION_DISPOSITION.NOT_APPLICABLE, 'not_applicable'),
    ];
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    const unavailable = set.excludedEvidence.find((e) => e.disposition === 'UNAVAILABLE');
    const blocked = set.excludedEvidence.find((e) => e.disposition === 'BLOCKED');
    const nap = set.excludedEvidence.find((e) => e.disposition === 'NOT_APPLICABLE');
    expect(unavailable.semantics).toBe('unavailable_not_neutral');
    expect(unavailable.neutralVote).toBe(false);
    expect(blocked.semantics).toBe('blocked_not_neutral');
    expect(blocked.neutralVote).toBe(false);
    expect(nap.semantics).toBe('not_applicable_not_neutral');
    expect(nap.neutralVote).toBe(false);
    expect(set.missingEvidence.every((m) => m.semantics === 'missing_not_negative')).toBe(true);
    expect(set.missingEvidence.every((m) => m.negativeVote === false)).toBe(true);
    expect(set.coverage.missingSemantics).toBe('missing_not_negative');
  });

  it('21–25. role authority preserved and not converted to votes', () => {
    const items = [
      acceptedItem('risk', {
        correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
        envelope: { conclusion: { signal: DIRECTION.NOT_APPLICABLE } },
      }),
      acceptedItem('portfolio', {
        correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
        envelope: { conclusion: { signal: DIRECTION.NOT_APPLICABLE } },
      }),
      acceptedItem('liquidity', {
        correlationFamily: CORRELATION_FAMILY.MICROSTRUCTURE,
        envelope: { conclusion: { signal: DIRECTION.NOT_APPLICABLE } },
      }),
      acceptedItem('order', {
        correlationFamily: CORRELATION_FAMILY.EXECUTION_PATH,
        envelope: { conclusion: { signal: DIRECTION.NOT_APPLICABLE } },
      }),
      acceptedItem('optimization', {
        correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
        envelope: { conclusion: { signal: DIRECTION.NOT_APPLICABLE } },
      }),
    ];
    // Force authority classes via AGENT_CONTRACT_ROLE (already set by agentId)
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    expect(set.authority.risk.authorityClass).toBe(AUTHORITY_CLASS.CONTROL_VETO);
    expect(set.authority.portfolio.authorityClass).toBe(AUTHORITY_CLASS.CONTROL_SIZING);
    expect(set.authority.liquidity.authorityClass).toBe(AUTHORITY_CLASS.EXECUTION_FEASIBILITY);
    expect(set.authority.order.authorityClass).toBe(AUTHORITY_CLASS.EXECUTION);
    expect(set.authority.optimization.authorityClass).toBe(AUTHORITY_CLASS.NOT_APPLICABLE);
    expect(set.authority.risk.treatedAsVote).toBe(false);
    expect(set.authority.portfolio.treatedAsVote).toBe(false);
    expect(set.authority.liquidity.treatedAsVote).toBe(false);
    expect(set.authority.order.treatedAsVote).toBe(false);
    expect(set.authority.order.executionPerformed).toBe(false);
    expect(set.includedEvidence).toHaveLength(0);
  });

  it('26–28. no majority/weighted/confidence averaging fields set true', () => {
    const items = [
      acceptedItem('technical', { direction: DIRECTION.BULLISH }),
      acceptedItem('sentiment', {
        direction: DIRECTION.BEARISH,
        correlationFamily: CORRELATION_FAMILY.EXTERNAL_NARRATIVE,
      }),
    ];
    const set = buildEvidenceOrchestrationSet(batchOf(items), { nowMs: NOW });
    expect(set.coverage.majorityVotingApplied).toBe(false);
    expect(set.coverage.weightedVotingApplied).toBe(false);
    expect(set.coverage.confidenceAveragingApplied).toBe(false);
    const cross = set.conflicts.find((c) => c.kind === CONFLICT_KIND.DIRECTIONAL_DISAGREEMENT);
    expect(cross).toBeTruthy();
    expect(cross.majorityVoteApplied).toBe(false);
  });

  it('29–33. side-effect ledger remains zero; readiness not cognitive/execution', () => {
    const set = buildEvidenceOrchestrationSet(batchOf([acceptedItem('technical')]), { nowMs: NOW });
    expect(set.sideEffects).toEqual(ZERO_ORCHESTRATION_SIDE_EFFECTS);
    expect(set.executionEligible).toBe(false);
    expect(set.decisionEligible).toBe(false);
    expect(set.approvedForExecution).toBe(false);
    expect(set.readiness.cognitiveDecision).toBe('NOT_IMPLEMENTED');
    expect(set.readiness.canonicalEvidenceOrchestration).toBe('AVAILABLE');
    expect(set.provenance.writer).toBe(ORCHESTRATION_WRITER);
  });

  it('34–37. orchestrateEvidence preserves Stage 4 fail-closed filter + bound + owner scope', async () => {
    mockIngestEvidenceBatch.mockResolvedValue(batchOf([], {
      executed: false,
      agentFilterState: AGENT_FILTER_STATE.INVALID,
      ownerScoped: true,
    }));
    const set = await orchestrateEvidence({
      ownerUserId: OWNER,
      agentIds: ['not-an-agent'],
      limit: 99,
      nowMs: NOW,
    });
    expect(mockIngestEvidenceBatch).toHaveBeenCalledTimes(1);
    const call = mockIngestEvidenceBatch.mock.calls[0][0];
    expect(call.limit).toBe(MAX_INGEST_BATCH);
    expect(call.ownerUserId).toBe(OWNER);
    expect(call.agentIds).toEqual(['not-an-agent']);
    expect(set.query.maxLimit).toBeLessThanOrEqual(50);
    expect(set.query.invalidFilterBroadensQuery).toBe(false);
    expect(set.query.ownerScoped).toBe(true);
  });

  it('36–38. no-filter request remains bounded; nPlusOne false', async () => {
    mockIngestEvidenceBatch.mockResolvedValue(batchOf([acceptedItem('technical')], {
      nPlusOne: false,
      limit: 20,
      executed: true,
      agentFilterState: AGENT_FILTER_STATE.NONE,
    }));
    const set = await orchestrateEvidence({ ownerUserId: OWNER, limit: 20, nowMs: NOW });
    expect(set.query.bounded).toBe(true);
    expect(set.query.nPlusOne).toBe(false);
    expect(set.query.maxLimit).toBeLessThanOrEqual(50);
    expect(mockIngestEvidenceBatch.mock.calls[0][0].limit).toBe(20);
  });

  it('39–40. lineage and provenance preserved', () => {
    const item = acceptedItem('technical', { runId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000099' });
    const set = buildEvidenceOrchestrationSet(batchOf([item]), { nowMs: NOW, ownerUserId: OWNER });
    expect(set.lineage.contributingRunIds).toContain('aaaaaaaa-aaaa-4aaa-8aaa-000000000099');
    expect(set.lineage.ingestionContractVersion).toBe('artemis-evidence-ingestion-1.0.0');
    expect(set.lineage.evidenceContractVersion).toBe('artemis-evidence-1.0.0');
    expect(set.provenance.stage).toBe('ARTEMIS_CORE_STAGE_6');
    expect(set.provenance.note).toBe('evidence_orchestration_set_not_artemis_decision');
  });

  it('authority-role incompatibility when control carries directional signal', () => {
    const risk = acceptedItem('risk', {
      correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
      direction: DIRECTION.BULLISH,
    });
    const set = buildEvidenceOrchestrationSet(batchOf([risk]), { nowMs: NOW });
    expect(set.conflicts.some((c) => c.kind === CONFLICT_KIND.AUTHORITY_ROLE_INCOMPATIBILITY)).toBe(true);
    expect(set.includedEvidence).toHaveLength(0);
  });
});

describe('Stage 6 static safety — production source', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const serviceSrc = readFileSync(
    path.join(root, 'services/artemisEvidenceOrchestrationService.js'),
    'utf8',
  );
  const contractSrc = readFileSync(
    path.join(root, 'contracts/artemisEvidenceOrchestrationContract.js'),
    'utf8',
  );

  it('does not import legacy orchestrator / mock Agent / provider clients', () => {
    expect(serviceSrc).not.toMatch(/from ['"].*artemisOrchestrator/);
    expect(serviceSrc).not.toMatch(/import\(.*artemisOrchestrator/);
    expect(serviceSrc).not.toMatch(/\bcoordinateAgents\s*\(/);
    expect(serviceSrc).not.toMatch(/\bcallAgentAPI\s*\(/);
    expect(serviceSrc).not.toMatch(/@google\/generative-ai|\bfrom ['"]openai['"]/);
    expect(serviceSrc).not.toMatch(/\bplaceOrder\s*\(|\bexecuteOrder\s*\(|\btradingEngine\b/);
    expect(serviceSrc).toMatch(/ingestEvidenceBatch/);
  });

  it('does not synthesize decision/execution semantics in contract', () => {
    expect(contractSrc).toMatch(/no_majority_voting/);
    expect(contractSrc).toMatch(/no_financial_recommendation_synthesis/);
    expect(contractSrc).not.toMatch(/weighted_vote/);
  });

  it('production service does not call majority/weighted vote helpers', () => {
    expect(serviceSrc).not.toMatch(/majorityVote\s*\(/);
    expect(serviceSrc).not.toMatch(/weightedVote\s*\(/);
    expect(serviceSrc).not.toMatch(/averageConfidence\s*\(/);
    expect(serviceSrc).toMatch(/majorityVotingApplied:\s*false/);
  });
});
