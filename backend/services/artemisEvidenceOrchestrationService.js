/**
 * Artemis Core Stage 6 — canonical evidence orchestration service.
 *
 * Input: Stage 4 ingestEvidenceBatch() only.
 * Output: EvidenceOrchestrationSet (deterministic, read-only).
 *
 * Does NOT:
 * - invoke the legacy LLM mixture-of-experts orchestrator or mock Agent coordination
 * - call LLM / providers
 * - majority or weighted vote
 * - average confidence into a decision
 * - produce Cognitive Decisions or financial recommendation synthesis
 * - write DB / Redis
 * - execute Agents or orders
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  CANONICAL_AGENT_IDS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  CORRELATION_FAMILY,
  DIRECTION,
  SCHEMA_VERSION as EVIDENCE_SCHEMA_VERSION,
} from '../contracts/artemisEvidenceContract.js';
import {
  INGESTION_CONTRACT_VERSION,
  INGESTION_DISPOSITION,
  MAX_INGEST_BATCH,
} from '../contracts/artemisEvidenceIngestionContract.js';
import {
  CONFIRMATION_SEMANTICS,
  CONFLICT_KIND,
  CONFLICT_SEVERITY,
  DIRECTIONAL_AUTHORITY_CLASSES,
  NON_VOTING_AUTHORITY_CLASSES,
  ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_LIMITATIONS,
  ORCHESTRATION_POLICY_VERSION,
  ORCHESTRATION_READINESS,
  ORCHESTRATION_SCHEMA_VERSION,
  ORCHESTRATION_STAGE,
  ORCHESTRATION_WRITER,
  ZERO_ORCHESTRATION_SIDE_EFFECTS,
} from '../contracts/artemisEvidenceOrchestrationContract.js';
import { ingestEvidenceBatch } from './artemisEvidenceIngestionService.js';

const DIRECTIONAL_AUTHORITY = new Set(DIRECTIONAL_AUTHORITY_CLASSES);
const NON_VOTING_AUTHORITY = new Set(NON_VOTING_AUTHORITY_CLASSES);
const DIRECTIONAL_SET = new Set([
  DIRECTION.BULLISH,
  DIRECTION.BEARISH,
  DIRECTION.SIDEWAYS,
  DIRECTION.NEUTRAL,
]);

function freezeDeep(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function nowIso(nowMs) {
  return new Date(nowMs).toISOString();
}

function stableString(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function normalizeContextField(value) {
  if (value == null || value === '') return null;
  return String(value).trim();
}

function authorityOf(item) {
  return (
    item?.authorityClass
    || item?.envelope?.authorityClass
    || AGENT_CONTRACT_ROLE[item?.agentId]?.authorityClass
    || null
  );
}

function correlationFamilyOf(item) {
  return (
    item?.envelope?.correlationFamily
    || item?.lineage?.correlationFamily
    || null
  );
}

function directionOf(item) {
  const signal = item?.envelope?.conclusion?.signal
    ?? item?.envelope?.direction
    ?? item?.product?.direction
    ?? null;
  if (signal == null) return null;
  const text = String(signal).trim().toLowerCase();
  if (DIRECTIONAL_SET.has(text)) return text;
  if (text === 'buy' || text === 'long') return DIRECTION.BULLISH;
  if (text === 'sell' || text === 'short') return DIRECTION.BEARISH;
  if (text === 'hold') return DIRECTION.NEUTRAL;
  return text;
}

function contextSlice(envelope = {}, decisionContext = null) {
  const ctx = decisionContext && typeof decisionContext === 'object' ? decisionContext : {};
  return {
    provider: normalizeContextField(envelope.provider ?? ctx.provider),
    venue: normalizeContextField(envelope.venue ?? ctx.venue ?? envelope.provider ?? ctx.provider),
    marketType: normalizeContextField(envelope.marketType ?? ctx.marketType),
    symbol: normalizeContextField(envelope.symbol ?? ctx.symbol),
    timeframe: normalizeContextField(envelope.timeframe ?? ctx.timeframe),
    analysisHorizon: normalizeContextField(envelope.analysisHorizon ?? ctx.analysisHorizon),
  };
}

function timestampMs(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function evidenceSortKey(item) {
  const env = item?.envelope || {};
  const analysis = timestampMs(env.analysisTimestamp || item?.lineage?.analysisTimestamp);
  const source = timestampMs(env.sourceTimestamp || item?.lineage?.sourceTimestamp);
  const candle = timestampMs(env.sourceCandleTimestamp || item?.lineage?.sourceCandleTimestamp);
  const runId = String(env.runId || item?.lineage?.runId || '');
  return { analysis, source, candle, runId };
}

/** Newer evidence first; ties broken by runId descending for determinism. */
function compareEvidenceNewestFirst(a, b) {
  const ka = evidenceSortKey(a);
  const kb = evidenceSortKey(b);
  if (ka.analysis !== kb.analysis) return kb.analysis - ka.analysis;
  if (ka.source !== kb.source) return kb.source - ka.source;
  if (ka.candle !== kb.candle) return kb.candle - ka.candle;
  if (ka.runId !== kb.runId) return ka.runId < kb.runId ? 1 : -1;
  return 0;
}

function groupKeyParts(item, decisionContext) {
  const family = correlationFamilyOf(item) || CORRELATION_FAMILY.OHLCV_CANDLE;
  const slice = contextSlice(item?.envelope || {}, decisionContext);
  return {
    correlationFamily: family,
    venue: slice.venue || 'unavailable',
    marketType: slice.marketType || 'unavailable',
    symbol: slice.symbol || 'unavailable',
    timeframe: slice.timeframe || 'unavailable',
    analysisHorizon: slice.analysisHorizon || 'unavailable',
  };
}

function buildGroupId(parts) {
  return [
    'grp',
    stableString(parts.correlationFamily),
    stableString(parts.venue),
    stableString(parts.marketType),
    stableString(parts.symbol),
    stableString(parts.timeframe),
    stableString(parts.analysisHorizon),
  ].join('|');
}

function evidenceRef(item, extra = {}) {
  const env = item?.envelope || {};
  return freezeDeep({
    agentId: item?.agentId ?? null,
    runId: env.runId ?? item?.lineage?.runId ?? null,
    agentRecordId: env.agentRecordId ?? item?.lineage?.agentRecordId ?? null,
    correlationId: env.correlationId ?? item?.lineage?.correlationId ?? null,
    disposition: item?.disposition ?? null,
    reasonKey: item?.reasonKey ?? null,
    authorityClass: authorityOf(item),
    correlationFamily: correlationFamilyOf(item),
    direction: directionOf(item),
    analysisTimestamp: env.analysisTimestamp ?? item?.lineage?.analysisTimestamp ?? null,
    sourceTimestamp: env.sourceTimestamp ?? item?.lineage?.sourceTimestamp ?? null,
    sourceCandleTimestamp: env.sourceCandleTimestamp ?? item?.lineage?.sourceCandleTimestamp ?? null,
    ...extra,
  });
}

function hashToUuid(seed) {
  const digest = createHash('sha256').update(String(seed)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5-like
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function conflictId(kind, refs) {
  const payload = [
    kind,
    ...refs
      .map((r) => `${r.agentId || ''}:${r.runId || ''}:${r.direction || ''}`)
      .sort(),
  ].join('|');
  return `cfl-${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`;
}

function isDirectionalAuthority(authorityClass) {
  return DIRECTIONAL_AUTHORITY.has(authorityClass);
}

function isNonVotingAuthority(authorityClass) {
  return NON_VOTING_AUTHORITY.has(authorityClass);
}

/**
 * Select newest ACCEPTED directional evidence per agentId.
 * Older same-agent ACCEPTED records become SAME_AGENT_SUPERSEDED exclusions
 * and emit SAME_AGENT_MULTIPLE_RECORDS conflicts.
 */
function selectNewestPerAgent(acceptedDirectional) {
  const byAgent = new Map();
  for (const item of acceptedDirectional) {
    const agentId = item.agentId;
    if (!agentId) continue;
    if (!byAgent.has(agentId)) byAgent.set(agentId, []);
    byAgent.get(agentId).push(item);
  }

  const selected = [];
  const superseded = [];
  const sameAgentConflicts = [];

  for (const [agentId, list] of [...byAgent.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...list].sort(compareEvidenceNewestFirst);
    selected.push(sorted[0]);
    if (sorted.length > 1) {
      for (const older of sorted.slice(1)) {
        superseded.push({
          ...older,
          disposition: INGESTION_DISPOSITION.REJECTED_CONTEXT,
          reasonKey: 'same_agent_superseded_by_newer',
          _orchestrationExclusion: true,
        });
      }
      const refs = sorted.map((item) => evidenceRef(item));
      sameAgentConflicts.push({
        conflictId: conflictId(CONFLICT_KIND.SAME_AGENT_MULTIPLE_RECORDS, refs),
        kind: CONFLICT_KIND.SAME_AGENT_MULTIPLE_RECORDS,
        severity: CONFLICT_SEVERITY.INFORMATIONAL,
        agentId,
        memberRefs: refs,
        descriptionKey: 'same_agent_multiple_accepted_records_newest_selected',
        resolvedIntoDecision: false,
      });
    }
  }

  return { selected, superseded, sameAgentConflicts };
}

function buildGroups(selectedDirectional, decisionContext) {
  const groupsMap = new Map();

  for (const item of selectedDirectional) {
    const parts = groupKeyParts(item, decisionContext);
    const groupId = buildGroupId(parts);
    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        groupId,
        correlationFamily: parts.correlationFamily,
        contextKey: {
          venue: parts.venue,
          marketType: parts.marketType,
          symbol: parts.symbol,
          timeframe: parts.timeframe,
          analysisHorizon: parts.analysisHorizon,
        },
        members: [],
      });
    }
    groupsMap.get(groupId).members.push(item);
  }

  const groups = [];
  for (const group of [...groupsMap.values()].sort((a, b) => a.groupId.localeCompare(b.groupId))) {
    const members = [...group.members].sort((a, b) => {
      const agentCmp = String(a.agentId).localeCompare(String(b.agentId));
      if (agentCmp !== 0) return agentCmp;
      return compareEvidenceNewestFirst(a, b);
    });
    const memberAgentIds = members.map((m) => m.agentId);
    const directions = members.map((m) => directionOf(m)).filter((d) => DIRECTIONAL_SET.has(d));
    const uniqueDirections = [...new Set(directions)];

    groups.push(freezeDeep({
      groupId: group.groupId,
      correlationFamily: group.correlationFamily,
      contextKey: group.contextKey,
      memberAgentIds,
      includedEvidenceRefs: members.map((m) => evidenceRef(m)),
      evidenceCount: members.length,
      /**
       * Correlated family contributes at most 1 independent confirmation unit.
       * Never equal to memberAgentIds.length for multi-member OHLCV families.
       */
      independentConfirmationCount: members.length > 0 ? 1 : 0,
      confirmationSemantics: CONFIRMATION_SEMANTICS.CORRELATED_NOT_INDEPENDENT,
      observedDirections: uniqueDirections,
      directionCountsAreNotConfidence: true,
    }));
  }

  return groups;
}

function detectConflicts({
  groups,
  selectedDirectional,
  authorityAccepted,
  excluded,
  decisionContext,
  sameAgentConflicts,
}) {
  const conflicts = [...sameAgentConflicts];

  for (const group of groups) {
    const directional = (group.observedDirections || []).filter((d) => (
      d === DIRECTION.BULLISH || d === DIRECTION.BEARISH
    ));
    if (new Set(directional).size >= 2) {
      conflicts.push({
        conflictId: conflictId(CONFLICT_KIND.CORRELATED_FAMILY_DISAGREEMENT, group.includedEvidenceRefs),
        kind: CONFLICT_KIND.CORRELATED_FAMILY_DISAGREEMENT,
        severity: CONFLICT_SEVERITY.MATERIAL,
        groupId: group.groupId,
        correlationFamily: group.correlationFamily,
        memberRefs: group.includedEvidenceRefs,
        observedDirections: group.observedDirections,
        descriptionKey: 'correlated_family_directional_disagreement_not_resolved',
        resolvedIntoDecision: false,
        majorityVoteApplied: false,
        weightedVoteApplied: false,
        confidenceAveraged: false,
      });
    }
  }

  // Cross-family directional disagreement among independent confirmation units
  const familyDirections = [];
  for (const group of groups) {
    const dirs = (group.observedDirections || []).filter((d) => (
      d === DIRECTION.BULLISH || d === DIRECTION.BEARISH
    ));
    const unique = [...new Set(dirs)];
    if (unique.length === 1) {
      familyDirections.push({
        groupId: group.groupId,
        correlationFamily: group.correlationFamily,
        direction: unique[0],
        refs: group.includedEvidenceRefs,
      });
    }
  }
  const bullishFamilies = familyDirections.filter((f) => f.direction === DIRECTION.BULLISH);
  const bearishFamilies = familyDirections.filter((f) => f.direction === DIRECTION.BEARISH);
  if (bullishFamilies.length > 0 && bearishFamilies.length > 0) {
    const refs = [...bullishFamilies, ...bearishFamilies].flatMap((f) => f.refs);
    conflicts.push({
      conflictId: conflictId(CONFLICT_KIND.DIRECTIONAL_DISAGREEMENT, refs),
      kind: CONFLICT_KIND.DIRECTIONAL_DISAGREEMENT,
      severity: CONFLICT_SEVERITY.MATERIAL,
      memberRefs: refs,
      bullishFamilyIds: bullishFamilies.map((f) => f.groupId),
      bearishFamilyIds: bearishFamilies.map((f) => f.groupId),
      descriptionKey: 'independent_family_directional_disagreement_not_resolved',
      resolvedIntoDecision: false,
      majorityVoteApplied: false,
      weightedVoteApplied: false,
      confidenceAveraged: false,
    });
  }

  // Context / timeframe / horizon mismatches from exclusions
  for (const item of excluded) {
    if (item.disposition === INGESTION_DISPOSITION.REJECTED_CONTEXT) {
      const mismatches = item.contextCompatibility?.mismatches || [];
      const kinds = new Set();
      if (mismatches.some((m) => String(m).includes('timeframe') || m?.field === 'timeframe')) {
        kinds.add(CONFLICT_KIND.TIMEFRAME_MISMATCH);
      }
      if (mismatches.some((m) => String(m).includes('horizon') || m?.field === 'analysisHorizon')) {
        kinds.add(CONFLICT_KIND.HORIZON_MISMATCH);
      }
      if (kinds.size === 0) kinds.add(CONFLICT_KIND.CONTEXT_MISMATCH);
      for (const kind of kinds) {
        const ref = evidenceRef(item);
        conflicts.push({
          conflictId: conflictId(kind, [ref]),
          kind,
          severity: CONFLICT_SEVERITY.MATERIAL,
          memberRefs: [ref],
          mismatches,
          descriptionKey: `${kind}_represented_not_coerced`,
          resolvedIntoDecision: false,
        });
      }
    }
    if (
      item.disposition === INGESTION_DISPOSITION.REJECTED_STALE
      || item.disposition === INGESTION_DISPOSITION.REJECTED_EXPIRED
    ) {
      const ref = evidenceRef(item);
      conflicts.push({
        conflictId: conflictId(CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY, [ref]),
        kind: CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY,
        severity: CONFLICT_SEVERITY.BLOCKING,
        memberRefs: [ref],
        disposition: item.disposition,
        descriptionKey: 'freshness_incompatibility_excluded_not_current',
        resolvedIntoDecision: false,
      });
    }
  }

  // Authority-role incompatibility: control/execution must not be treated as directional votes
  for (const item of authorityAccepted) {
    const dir = directionOf(item);
    if (dir && DIRECTIONAL_SET.has(dir) && dir !== DIRECTION.NOT_APPLICABLE) {
      const ref = evidenceRef(item);
      conflicts.push({
        conflictId: conflictId(CONFLICT_KIND.AUTHORITY_ROLE_INCOMPATIBILITY, [ref]),
        kind: CONFLICT_KIND.AUTHORITY_ROLE_INCOMPATIBILITY,
        severity: CONFLICT_SEVERITY.INFORMATIONAL,
        memberRefs: [ref],
        authorityClass: authorityOf(item),
        descriptionKey: 'non_voting_authority_not_converted_to_directional_vote',
        convertedToVote: false,
        resolvedIntoDecision: false,
      });
    }
  }

  // Request context vs included directional timeframe/horizon diversity
  if (decisionContext && typeof decisionContext === 'object') {
    const reqTf = normalizeContextField(decisionContext.timeframe);
    const reqHorizon = normalizeContextField(decisionContext.analysisHorizon);
    if (reqTf) {
      const mismatched = selectedDirectional.filter((item) => {
        const tf = normalizeContextField(item?.envelope?.timeframe);
        return tf && stableString(tf) !== stableString(reqTf);
      });
      if (mismatched.length > 0) {
        const refs = mismatched.map((item) => evidenceRef(item));
        conflicts.push({
          conflictId: conflictId(CONFLICT_KIND.TIMEFRAME_MISMATCH, refs),
          kind: CONFLICT_KIND.TIMEFRAME_MISMATCH,
          severity: CONFLICT_SEVERITY.MATERIAL,
          memberRefs: refs,
          requestedTimeframe: reqTf,
          descriptionKey: 'included_evidence_timeframe_mismatch_with_request_context',
          resolvedIntoDecision: false,
        });
      }
    }
    if (reqHorizon) {
      const mismatched = selectedDirectional.filter((item) => {
        const h = normalizeContextField(item?.envelope?.analysisHorizon);
        return h && stableString(h) !== stableString(reqHorizon);
      });
      if (mismatched.length > 0) {
        const refs = mismatched.map((item) => evidenceRef(item));
        conflicts.push({
          conflictId: conflictId(CONFLICT_KIND.HORIZON_MISMATCH, refs),
          kind: CONFLICT_KIND.HORIZON_MISMATCH,
          severity: CONFLICT_SEVERITY.MATERIAL,
          memberRefs: refs,
          requestedAnalysisHorizon: reqHorizon,
          descriptionKey: 'included_evidence_horizon_mismatch_with_request_context',
          resolvedIntoDecision: false,
        });
      }
    }
  }

  conflicts.sort((a, b) => String(a.conflictId).localeCompare(String(b.conflictId)));
  return conflicts.map((c) => freezeDeep(c));
}

function buildAuthorityBuckets(authorityAccepted) {
  const buckets = {
    [AUTHORITY_CLASS.CONTROL_VETO]: [],
    [AUTHORITY_CLASS.CONTROL_SIZING]: [],
    [AUTHORITY_CLASS.EXECUTION_FEASIBILITY]: [],
    [AUTHORITY_CLASS.EXECUTION]: [],
    [AUTHORITY_CLASS.NOT_APPLICABLE]: [],
  };
  for (const item of authorityAccepted) {
    const authority = authorityOf(item);
    if (buckets[authority]) {
      buckets[authority].push(evidenceRef(item, { votingEligible: false }));
    }
  }
  return freezeDeep({
    risk: {
      authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
      agentId: 'risk',
      refs: buckets[AUTHORITY_CLASS.CONTROL_VETO],
      treatedAsVote: false,
    },
    portfolio: {
      authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
      agentId: 'portfolio',
      refs: buckets[AUTHORITY_CLASS.CONTROL_SIZING],
      treatedAsVote: false,
    },
    liquidity: {
      authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
      agentId: 'liquidity',
      refs: buckets[AUTHORITY_CLASS.EXECUTION_FEASIBILITY],
      treatedAsVote: false,
    },
    order: {
      authorityClass: AUTHORITY_CLASS.EXECUTION,
      agentId: 'order',
      refs: buckets[AUTHORITY_CLASS.EXECUTION],
      treatedAsVote: false,
      executionPerformed: false,
    },
    optimization: {
      authorityClass: AUTHORITY_CLASS.NOT_APPLICABLE,
      agentId: 'optimization',
      refs: buckets[AUTHORITY_CLASS.NOT_APPLICABLE],
      treatedAsVote: false,
    },
  });
}

function dispositionCounts(items) {
  const counts = {
    ACCEPTED: 0,
    REJECTED_INVALID: 0,
    REJECTED_IDENTITY: 0,
    REJECTED_STALE: 0,
    REJECTED_EXPIRED: 0,
    REJECTED_CONTEXT: 0,
    UNAVAILABLE: 0,
    BLOCKED: 0,
    NOT_APPLICABLE: 0,
    total: items.length,
  };
  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(counts, item.disposition)) {
      counts[item.disposition] += 1;
    }
  }
  return counts;
}

/**
 * Pure builder: Stage 4 batch → EvidenceOrchestrationSet.
 * Same batch + same options.nowMs → semantically equivalent grouping/conflicts.
 */
export function buildEvidenceOrchestrationSet(batch, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const decisionContext = options.decisionContext && typeof options.decisionContext === 'object'
    ? options.decisionContext
    : null;
  const items = Array.isArray(batch?.items) ? batch.items : [];

  const accepted = items.filter((i) => i.disposition === INGESTION_DISPOSITION.ACCEPTED);
  const excludedFromBatch = items.filter((i) => i.disposition !== INGESTION_DISPOSITION.ACCEPTED);

  const acceptedDirectional = [];
  const authorityAccepted = [];
  for (const item of accepted) {
    const authority = authorityOf(item);
    if (isDirectionalAuthority(authority)) acceptedDirectional.push(item);
    else if (isNonVotingAuthority(authority)) authorityAccepted.push(item);
    else acceptedDirectional.push(item);
  }

  const { selected, superseded, sameAgentConflicts } = selectNewestPerAgent(acceptedDirectional);
  const excluded = [
    ...excludedFromBatch,
    ...superseded,
  ].map((item) => evidenceRef(item, {
    neutralVote: false,
    negativeVote: false,
    usable: false,
    semantics: item.disposition === INGESTION_DISPOSITION.UNAVAILABLE
      ? 'unavailable_not_neutral'
      : item.disposition === INGESTION_DISPOSITION.BLOCKED
        ? 'blocked_not_neutral'
        : item.disposition === INGESTION_DISPOSITION.NOT_APPLICABLE
          ? 'not_applicable_not_neutral'
          : item.disposition === INGESTION_DISPOSITION.REJECTED_STALE
            || item.disposition === INGESTION_DISPOSITION.REJECTED_EXPIRED
            ? 'stale_or_expired_not_current'
            : 'excluded_not_usable',
  }));

  const groups = buildGroups(selected, decisionContext);
  const conflicts = detectConflicts({
    groups,
    selectedDirectional: selected,
    authorityAccepted,
    excluded: [...excludedFromBatch, ...superseded],
    decisionContext,
    sameAgentConflicts,
  });

  const includedEvidence = selected
    .slice()
    .sort((a, b) => String(a.agentId).localeCompare(String(b.agentId)))
    .map((item) => evidenceRef(item, {
      usable: true,
      independentConfirmation: false,
      confirmationUnit: 'correlation_family',
    }));

  const agentsWithAccepted = [...new Set(selected.map((i) => i.agentId).filter(Boolean))].sort();
  const agentsMissing = CANONICAL_AGENT_IDS.filter((id) => !agentsWithAccepted.includes(id));
  // Missing is absence of ACCEPTED usable evidence — NOT a negative vote
  const missingEvidence = agentsMissing.map((agentId) => freezeDeep({
    agentId,
    status: 'MISSING',
    semantics: 'missing_not_negative',
    neutralVote: false,
    negativeVote: false,
    authorityClass: AGENT_CONTRACT_ROLE[agentId]?.authorityClass ?? null,
  }));

  const independentDirectionalFamilyCount = groups.filter((g) => (
    (g.observedDirections || []).some((d) => d === DIRECTION.BULLISH || d === DIRECTION.BEARISH)
    && g.independentConfirmationCount === 1
  )).length;

  const seedParts = [
    ORCHESTRATION_CONTRACT_VERSION,
    String(nowMs),
    JSON.stringify(decisionContext || {}),
    ...includedEvidence.map((r) => `${r.agentId}:${r.runId}`).sort(),
    ...excluded.map((r) => `${r.agentId}:${r.runId}:${r.disposition}`).sort(),
  ];
  const orchestrationId = options.orchestrationId
    || (options.deterministicId === false ? randomUUID() : hashToUuid(seedParts.join('|')));

  const query = batch?.query || {};
  const filter = batch?.filter || {};

  const artifact = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    policyVersion: ORCHESTRATION_POLICY_VERSION,
    orchestrationId,
    generatedAt: nowIso(nowMs),
    stage: ORCHESTRATION_STAGE,
    context: freezeDeep({
      decisionContextId: decisionContext?.decisionContextId ?? null,
      provider: decisionContext?.provider ?? null,
      venue: decisionContext?.venue ?? null,
      marketType: decisionContext?.marketType ?? null,
      symbol: decisionContext?.symbol ?? null,
      timeframe: decisionContext?.timeframe ?? null,
      analysisHorizon: decisionContext?.analysisHorizon ?? null,
      ownershipScope: query.ownerScoped ? 'user' : (options.ownerUserId ? 'user' : 'unscoped'),
      ownerUserId: options.ownerUserId ?? null,
    }),
    evidenceWindow: freezeDeep({
      since: options.since ?? options.sinceAt ?? null,
      until: options.until ?? options.untilAt ?? null,
      limit: query.limit ?? options.limit ?? null,
      maxLimit: query.maxLimit ?? MAX_INGEST_BATCH,
      queriedAt: batch?.ingestion?.ingestedAt ?? nowIso(nowMs),
    }),
    groups,
    includedEvidence,
    excludedEvidence: excluded.sort((a, b) => {
      const aKey = `${a.agentId || ''}:${a.runId || ''}:${a.disposition || ''}`;
      const bKey = `${b.agentId || ''}:${b.runId || ''}:${b.disposition || ''}`;
      return aKey.localeCompare(bKey);
    }),
    missingEvidence,
    conflicts,
    authority: buildAuthorityBuckets(authorityAccepted),
    coverage: freezeDeep({
      canonicalAgentCount: CANONICAL_AGENT_IDS.length,
      agentsWithAccepted,
      agentsMissing,
      missingSemantics: 'missing_not_negative',
      dispositionCounts: dispositionCounts(items),
      independentDirectionalFamilyCount,
      confirmationSemantics: CONFIRMATION_SEMANTICS.CORRELATED_NOT_INDEPENDENT,
      correlatedMemberCountIsNotIndependentConfirmation: true,
      majorityVotingApplied: false,
      weightedVotingApplied: false,
      confidenceAveragingApplied: false,
    }),
    limitations: [...ORCHESTRATION_LIMITATIONS],
    lineage: freezeDeep({
      ingestionContractVersion: INGESTION_CONTRACT_VERSION,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      contributingRunIds: includedEvidence.map((r) => r.runId).filter(Boolean),
      excludedRunIds: excluded.map((r) => r.runId).filter(Boolean),
      batchIngestedAt: batch?.ingestion?.ingestedAt ?? null,
      filter: filter || null,
    }),
    provenance: freezeDeep({
      writer: ORCHESTRATION_WRITER,
      stage: 'ARTEMIS_CORE_STAGE_6',
      inputOwner: 'artemisEvidenceIngestionService',
      inputMethod: 'ingestEvidenceBatch',
      note: 'evidence_orchestration_set_not_artemis_decision',
    }),
    readiness: freezeDeep({
      canonicalEvidenceOrchestration: ORCHESTRATION_READINESS.AVAILABLE,
      cognitiveDecision: ORCHESTRATION_READINESS.NOT_IMPLEMENTED,
      executionEligible: false,
      approvedForExecution: false,
      decisionEligible: false,
    }),
    query: freezeDeep({
      bounded: query.bounded !== false,
      maxLimit: query.maxLimit ?? MAX_INGEST_BATCH,
      limit: query.limit ?? null,
      nPlusOne: query.nPlusOne === true ? true : false,
      ownerScoped: Boolean(query.ownerScoped),
      agentFilterState: query.agentFilterState ?? filter.state ?? null,
      executed: query.executed === true,
      invalidFilterBroadensQuery: false,
    }),
    sideEffects: { ...ZERO_ORCHESTRATION_SIDE_EFFECTS },
    metrics: freezeDeep({
      inputItemCount: items.length,
      includedCount: includedEvidence.length,
      excludedCount: excluded.length,
      missingCount: missingEvidence.length,
      groupCount: groups.length,
      conflictCount: conflicts.length,
      ingestionMetrics: batch?.metrics ?? null,
    }),
    executionEligible: false,
    decisionEligible: false,
    approvedForExecution: false,
    financialRecommendation: null,
    synthesizedDirection: null,
  };

  return freezeDeep(artifact);
}

/**
 * Canonical Stage 6 entry: bounded Stage 4 ingestion → EvidenceOrchestrationSet.
 */
export async function orchestrateEvidence(options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit) || MAX_INGEST_BATCH, 1),
    MAX_INGEST_BATCH,
  );

  const batch = await ingestEvidenceBatch({
    ownerUserId: options.ownerUserId,
    agentIds: options.agentIds,
    agents: options.agents,
    agentId: options.agentId,
    limit,
    since: options.since ?? options.sinceAt,
    until: options.until ?? options.untilAt,
    decisionContext: options.decisionContext || null,
    nowMs: options.nowMs,
  });

  return buildEvidenceOrchestrationSet(batch, {
    ...options,
    limit,
  });
}

export default {
  orchestrateEvidence,
  buildEvidenceOrchestrationSet,
};
