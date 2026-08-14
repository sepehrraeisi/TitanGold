/**
 * Artemis WP-C.2 — deterministic qualitative synthesis / conflict / correlation.
 * Pure library. No providers, persistence, runtime wiring, or execution authorization.
 */

import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  DIRECTION,
  isCanonicalUuid,
} from '../contracts/artemisEvidenceContract.js';
import {
  FAMILY_QUALITATIVE_STATE,
  MAX_SYNTHESIS_INPUT_ENVELOPES,
  MIN_INDEPENDENT_DIRECTIONAL_FAMILIES,
  SYNTHESIS_POLICY_VERSION,
  SYNTHESIS_SCHEMA_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
  buildUnavailableSynthesisConfidence,
  countDistinctQualifyingFamilies,
  validateArtemisSynthesisAssessment,
} from '../contracts/artemisSynthesisContract.js';
import {
  ALLOCATION_AVAILABILITY,
  CLASSIFICATION,
  CONFLICT_STATE,
  CONFIRMATION_SEMANTICS,
  DIRECTION_OR_ABSTAIN,
  EVIDENCE_ADMISSION_STATE,
  LIQUIDITY_STATUS,
  MATURITY_STAGE,
  RISK_STATUS,
  SYNTHESIS_OUTCOME,
  buildContractOnlyArtemisDecision,
  isDecisionSafeEvidenceRef,
  validateArtemisDecision,
} from '../contracts/artemisDecisionContract.js';
import { admitEvidenceSet } from './artemisEvidenceAdmissionService.js';

const ACTIONABLE = new Set([DIRECTION.BULLISH, DIRECTION.BEARISH]);
const NON_ACTIONING = new Set([DIRECTION.SIDEWAYS, DIRECTION.NEUTRAL]);

function cmpStr(a, b) {
  return String(a).localeCompare(String(b));
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v != null && v !== ''))].sort(cmpStr);
}

function inCorrelationFamily(value) {
  return Object.values(CORRELATION_FAMILY).includes(value);
}

function mapEvidenceDirection(direction) {
  if (direction == null) return null;
  if (Object.values(DIRECTION).includes(direction)) return direction;
  return null;
}

function toDecisionDirection(evidenceDirection) {
  if (evidenceDirection === DIRECTION.BULLISH) return DIRECTION_OR_ABSTAIN.BULLISH;
  if (evidenceDirection === DIRECTION.BEARISH) return DIRECTION_OR_ABSTAIN.BEARISH;
  if (evidenceDirection === DIRECTION.SIDEWAYS) return DIRECTION_OR_ABSTAIN.SIDEWAYS;
  if (evidenceDirection === DIRECTION.NEUTRAL) return DIRECTION_OR_ABSTAIN.NEUTRAL;
  if (evidenceDirection === DIRECTION.UNAVAILABLE) return DIRECTION_OR_ABSTAIN.UNAVAILABLE;
  if (evidenceDirection === DIRECTION.NOT_APPLICABLE) return DIRECTION_OR_ABSTAIN.NOT_APPLICABLE;
  return DIRECTION_OR_ABSTAIN.UNAVAILABLE;
}

function isDirectionalConfirmingAdmission(result) {
  return (
    (result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED
      || result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED)
    && result.confirmationSemantics === CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE
  );
}

function isOpportunityAdmission(result) {
  return (
    (result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED
      || result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED)
    && result.confirmationSemantics === CONFIRMATION_SEMANTICS.OPPORTUNITY_CONTEXT
  );
}

function identityKey(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  if (typeof envelope.agentId !== 'string' || !envelope.agentId) return null;
  if (!isCanonicalUuid(envelope.runId)) return null;
  return `${envelope.agentId}|${String(envelope.runId).trim().toLowerCase()}`;
}

/**
 * Any repeated canonical agentId+runId is ambiguous for C.2.
 * Fail-closed: all copies are non-confirming; no first/last/freshest winner.
 */
export function findDuplicateIdentityKeys(envelopes = []) {
  const counts = new Map();
  for (const envelope of envelopes) {
    const key = identityKey(envelope);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicates = new Set();
  for (const [key, count] of counts.entries()) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
}

/** @deprecated use findDuplicateIdentityKeys — retained name for call-site clarity in older tests */
export function findConflictingDuplicateIdentityKeys(envelopes = []) {
  return findDuplicateIdentityKeys(envelopes);
}

/**
 * Assess one correlation family from member direction observations.
 */
export function assessDirectionalFamily(input) {
  const correlationFamily = input.correlationFamily;
  const members = Array.isArray(input.members) ? [...input.members] : [];
  members.sort((a, b) => cmpStr(a.agentId, b.agentId) || cmpStr(a.direction || '', b.direction || ''));

  const confirming = members.filter((m) => m.direction && !m.nonConfirming);
  // Counts are distinct agentIds so they never exceed memberAgentIds.length.
  const confirmingAgentIds = uniqueSorted(confirming.map((m) => m.agentId));
  const degradedMemberCount = uniqueSorted(members.filter((m) => m.degraded).map((m) => m.agentId)).length;
  const nonConfirmingMemberCount = uniqueSorted(
    members.filter((m) => m.nonConfirming).map((m) => m.agentId),
  ).length;
  const memberAgentIds = uniqueSorted(members.map((m) => m.agentId));
  const admittedDirectionalMemberCount = confirmingAgentIds.length;
  const limitations = [];

  if (degradedMemberCount > 0) limitations.push('family_contains_degraded_members');
  if (nonConfirmingMemberCount > 0) limitations.push('family_contains_non_confirming_members');

  if (confirming.length === 0) {
    return {
      correlationFamily,
      memberAgentIds,
      admittedDirectionalMemberCount: 0,
      degradedMemberCount,
      nonConfirmingMemberCount,
      qualitativeState: nonConfirmingMemberCount > 0
        ? FAMILY_QUALITATIVE_STATE.NON_CONFIRMING
        : FAMILY_QUALITATIVE_STATE.UNAVAILABLE,
      familyDirection: DIRECTION_OR_ABSTAIN.UNAVAILABLE,
      conflictState: CONFLICT_STATE.NONE,
      limitations: uniqueSorted(limitations),
    };
  }

  const dirs = uniqueSorted(confirming.map((m) => m.direction));
  const actionable = dirs.filter((d) => ACTIONABLE.has(d));
  const nonActioning = dirs.filter((d) => NON_ACTIONING.has(d));

  // MIXED requires >=2 distinct directional agents. Same-agent multi-run
  // conflicts are fail-closed as non-confirming (no approved precedence).
  const ambiguousSameAgentConflict = () => ({
    correlationFamily,
    memberAgentIds,
    admittedDirectionalMemberCount: 0,
    degradedMemberCount,
    nonConfirmingMemberCount,
    qualitativeState: FAMILY_QUALITATIVE_STATE.NON_CONFIRMING,
    familyDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
    conflictState: CONFLICT_STATE.NONE,
    limitations: uniqueSorted([...limitations, 'ambiguous_same_agent_multi_run_conflict']),
  });

  if (actionable.includes(DIRECTION.BULLISH) && actionable.includes(DIRECTION.BEARISH)) {
    if (admittedDirectionalMemberCount < 2) return ambiguousSameAgentConflict();
    return {
      correlationFamily,
      memberAgentIds,
      admittedDirectionalMemberCount,
      degradedMemberCount,
      nonConfirmingMemberCount,
      qualitativeState: FAMILY_QUALITATIVE_STATE.MIXED,
      familyDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.MATERIAL,
      limitations: uniqueSorted([...limitations, 'same_family_bullish_bearish_conflict']),
    };
  }

  if (actionable.length === 1 && nonActioning.length > 0) {
    if (admittedDirectionalMemberCount < 2) return ambiguousSameAgentConflict();
    return {
      correlationFamily,
      memberAgentIds,
      admittedDirectionalMemberCount,
      degradedMemberCount,
      nonConfirmingMemberCount,
      qualitativeState: FAMILY_QUALITATIVE_STATE.MIXED,
      familyDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.MATERIAL,
      limitations: uniqueSorted([...limitations, 'same_family_actionable_vs_neutral_conflict']),
    };
  }

  if (actionable.length === 1) {
    const d = actionable[0];
    return {
      correlationFamily,
      memberAgentIds,
      admittedDirectionalMemberCount,
      degradedMemberCount,
      nonConfirmingMemberCount,
      qualitativeState: d === DIRECTION.BULLISH
        ? FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH
        : FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH,
      familyDirection: toDecisionDirection(d),
      conflictState: CONFLICT_STATE.NONE,
      limitations: uniqueSorted(limitations),
    };
  }

  if (nonActioning.length > 0 && actionable.length === 0) {
    return {
      correlationFamily,
      memberAgentIds,
      admittedDirectionalMemberCount,
      degradedMemberCount,
      nonConfirmingMemberCount,
      qualitativeState: FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL,
      familyDirection: toDecisionDirection(nonActioning[0]),
      conflictState: CONFLICT_STATE.NONE,
      limitations: uniqueSorted(limitations),
    };
  }

  return {
    correlationFamily,
    memberAgentIds,
    admittedDirectionalMemberCount: 0,
    degradedMemberCount,
    nonConfirmingMemberCount,
    qualitativeState: FAMILY_QUALITATIVE_STATE.UNAVAILABLE,
    familyDirection: DIRECTION_OR_ABSTAIN.UNAVAILABLE,
    conflictState: CONFLICT_STATE.NONE,
    limitations: uniqueSorted([...limitations, 'family_direction_unavailable']),
  };
}

/**
 * Pure cross-family policy over already-built family assessments.
 * Rejects missing/duplicate correlationFamily identities fail-closed.
 */
export function resolveCrossFamilySynthesis(familyAssessments, extra = {}) {
  const families = Array.isArray(familyAssessments)
    ? [...familyAssessments].sort((a, b) => cmpStr(a.correlationFamily, b.correlationFamily))
    : [];
  const baseLimitations = uniqueSorted([
    ...(Array.isArray(extra.limitations) ? extra.limitations : []),
    'wp_c2_qualitative_only',
    'no_numeric_synthesis_confidence',
    'decision_eligible_false',
    'execution_eligible_false',
    'artemis_consumable_false',
  ]);

  const seen = new Set();
  for (const fam of families) {
    if (!fam || !inCorrelationFamily(fam.correlationFamily)) {
      return {
        ok: false,
        code: 'invalid_or_missing_correlation_family',
        message: 'Every family assessment requires a distinct canonical correlationFamily',
      };
    }
    if (seen.has(fam.correlationFamily)) {
      return {
        ok: false,
        code: 'duplicate_correlation_family',
        message: 'Duplicate correlationFamily identities are forbidden in cross-family synthesis',
      };
    }
    seen.add(fam.correlationFamily);
  }

  const mixed = families.filter((f) => f.qualitativeState === FAMILY_QUALITATIVE_STATE.MIXED);
  const coherentBullish = families.filter((f) => f.qualitativeState === FAMILY_QUALITATIVE_STATE.COHERENT_BULLISH);
  const coherentBearish = families.filter((f) => f.qualitativeState === FAMILY_QUALITATIVE_STATE.COHERENT_BEARISH);
  const coherentNeutral = families.filter((f) => f.qualitativeState === FAMILY_QUALITATIVE_STATE.COHERENT_NEUTRAL);

  const independentDirectionalFamilyCount = countDistinctQualifyingFamilies(families);

  // Precedence 2: blocking independent cross-family bullish vs bearish
  if (coherentBullish.length > 0 && coherentBearish.length > 0) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.ABSTAIN,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.BLOCKING,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: false,
      limitations: uniqueSorted([...baseLimitations, 'blocking_cross_family_conflict']),
    };
  }

  // Precedence 3: material unresolved same-family conflict
  if (mixed.length > 0) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.ABSTAIN,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.MATERIAL,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: false,
      limitations: uniqueSorted([...baseLimitations, 'material_family_conflict']),
    };
  }

  // Precedence 4: actionable vs independent neutral/sideways
  if (
    (coherentBullish.length > 0 || coherentBearish.length > 0)
    && coherentNeutral.length > 0
  ) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.ABSTAIN,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.MATERIAL,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: false,
      limitations: uniqueSorted([...baseLimitations, 'actionable_vs_neutral_cross_family']),
    };
  }

  // Precedence 5: fewer than min independent directional families
  if (independentDirectionalFamilyCount < MIN_INDEPENDENT_DIRECTIONAL_FAMILIES) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.NONE,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: false,
      limitations: uniqueSorted([
        ...baseLimitations,
        'min_independent_directional_families_not_met',
        `required_${MIN_INDEPENDENT_DIRECTIONAL_FAMILIES}`,
      ]),
    };
  }

  // Precedence 6: aligned actionable multi-family
  if (coherentBullish.length >= MIN_INDEPENDENT_DIRECTIONAL_FAMILIES) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.PROPOSED,
      observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      conflictState: CONFLICT_STATE.NONE,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: true,
      limitations: uniqueSorted([...baseLimitations, 'multi_family_directional_alignment']),
    };
  }
  if (coherentBearish.length >= MIN_INDEPENDENT_DIRECTIONAL_FAMILIES) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.PROPOSED,
      observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
      conflictState: CONFLICT_STATE.NONE,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: true,
      limitations: uniqueSorted([...baseLimitations, 'multi_family_directional_alignment']),
    };
  }

  // Precedence 7: independent non-actioning families
  if (coherentNeutral.length >= MIN_INDEPENDENT_DIRECTIONAL_FAMILIES) {
    return {
      ok: true,
      synthesisOutcome: SYNTHESIS_OUTCOME.HOLD,
      observedDirection: DIRECTION_OR_ABSTAIN.NEUTRAL,
      conflictState: CONFLICT_STATE.NONE,
      independentDirectionalFamilyCount,
      multiFamilyConfirmation: false,
      limitations: uniqueSorted([...baseLimitations, 'independent_non_actioning_families']),
    };
  }

  return {
    ok: true,
    synthesisOutcome: SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE,
    observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
    conflictState: CONFLICT_STATE.NONE,
    independentDirectionalFamilyCount,
    multiFamilyConfirmation: false,
    limitations: uniqueSorted([...baseLimitations, 'no_qualifying_multi_family_alignment']),
  };
}

function buildAssessmentShell(decisionContext, partial) {
  return {
    schemaVersion: SYNTHESIS_SCHEMA_VERSION,
    contractVersion: SYNTHESIS_CONTRACT_VERSION,
    policyVersion: SYNTHESIS_POLICY_VERSION,
    implementationVersion: SYNTHESIS_POLICY_VERSION,
    decisionContext: {
      symbol: decisionContext?.symbol ?? null,
      venue: decisionContext?.venue ?? null,
      marketType: decisionContext?.marketType ?? null,
      timeframe: decisionContext?.timeframe ?? null,
      analysisHorizon: decisionContext?.analysisHorizon ?? null,
    },
    synthesisOutcome: partial.synthesisOutcome,
    observedDirection: partial.observedDirection,
    conflictState: partial.conflictState,
    independentDirectionalFamilyCount: partial.independentDirectionalFamilyCount,
    multiFamilyConfirmation: partial.multiFamilyConfirmation,
    familyAssessments: partial.familyAssessments || [],
    opportunityContext: partial.opportunityContext || [],
    excludedNonConfirmingSummary: partial.excludedNonConfirmingSummary || {
      excludedCount: 0,
      rejectedCount: 0,
      nonConfirmingCount: 0,
      degradedCount: 0,
      reasons: [],
    },
    limitations: uniqueSorted(partial.limitations || []),
    confidence: buildUnavailableSynthesisConfidence(),
    decisionEligible: false,
    executionEligible: false,
    artemisConsumable: false,
  };
}

/**
 * Algorithm-only helper: synthesize from qualitative family assessments (no Agent fabrication).
 */
export function synthesizeFromFamilyAssessments(decisionContext, familyAssessments, options = {}) {
  const resolved = resolveCrossFamilySynthesis(familyAssessments, {
    limitations: options.limitations,
  });
  if (!resolved.ok) {
    return {
      assessment: null,
      validation: {
        ok: false,
        code: resolved.code,
        message: resolved.message,
      },
      admissionSet: null,
    };
  }

  const assessment = buildAssessmentShell(decisionContext, {
    ...resolved,
    familyAssessments: [...familyAssessments].sort((a, b) => cmpStr(a.correlationFamily, b.correlationFamily)),
    opportunityContext: Array.isArray(options.opportunityContext) ? options.opportunityContext : [],
    excludedNonConfirmingSummary: options.excludedNonConfirmingSummary || {
      excludedCount: 0,
      rejectedCount: 0,
      nonConfirmingCount: 0,
      degradedCount: 0,
      reasons: [],
    },
  });
  const validation = validateArtemisSynthesisAssessment(assessment);
  return { assessment, validation, admissionSet: null };
}

/**
 * Main C.2 entry: admit envelopes via frozen C.1, then qualitatively synthesize.
 */
export function synthesizeDeterministicAssessment(decisionContext, envelopes = []) {
  const list = Array.isArray(envelopes) ? envelopes : [];
  if (list.length > MAX_SYNTHESIS_INPUT_ENVELOPES) {
    return {
      assessment: null,
      validation: {
        ok: false,
        code: 'input_envelope_limit_exceeded',
        message: `C.2 accepts at most ${MAX_SYNTHESIS_INPUT_ENVELOPES} envelopes; no truncation`,
        limit: MAX_SYNTHESIS_INPUT_ENVELOPES,
        received: list.length,
      },
      admissionSet: null,
    };
  }

  const admissionSet = admitEvidenceSet(decisionContext, list);
  const results = admissionSet.results || [];
  const duplicateIdentities = findDuplicateIdentityKeys(list);

  const summary = {
    excludedCount: 0,
    rejectedCount: 0,
    nonConfirmingCount: 0,
    degradedCount: 0,
    reasons: [],
  };

  const familyMembers = new Map();
  const opportunityContext = [];
  const extraLimitations = [];
  let contextIncompatibleOnly = list.length > 0;
  let anyUsableDirectional = false;

  function pushFamilyMember(family, member) {
    if (!inCorrelationFamily(family)) return false;
    if (!familyMembers.has(family)) familyMembers.set(family, []);
    familyMembers.get(family).push(member);
    return true;
  }

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const envelope = list[i] && typeof list[i] === 'object' ? list[i] : null;
    const reason = result.admissionReason || 'unknown';
    const key = identityKey(envelope);

    if (key && duplicateIdentities.has(key)) {
      summary.nonConfirmingCount += 1;
      summary.reasons.push('DUPLICATE_IDENTITY_AMBIGUOUS');
      extraLimitations.push('duplicate_identity_ambiguous');
      contextIncompatibleOnly = false;
      continue;
    }

    if (result.admissionState === EVIDENCE_ADMISSION_STATE.REJECTED) {
      summary.rejectedCount += 1;
      summary.reasons.push(reason);
      contextIncompatibleOnly = false;
      continue;
    }
    if (result.admissionState === EVIDENCE_ADMISSION_STATE.EXCLUDED) {
      summary.excludedCount += 1;
      summary.reasons.push(reason);
      if (reason !== 'CONTEXT_INCOMPATIBLE') contextIncompatibleOnly = false;
      continue;
    }
    if (result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING) {
      summary.nonConfirmingCount += 1;
      summary.reasons.push(reason);
      contextIncompatibleOnly = false;
      const family = envelope?.correlationFamily || result.preserved?.correlationFamily || null;
      if (!inCorrelationFamily(family)) {
        extraLimitations.push('non_confirming_correlation_family_unavailable');
        continue;
      }
      pushFamilyMember(family, {
        agentId: envelope?.agentId || result.evidenceRef?.agentId || 'unknown',
        direction: mapEvidenceDirection(envelope?.conclusion?.direction),
        degraded: false,
        nonConfirming: true,
      });
      continue;
    }
    if (result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED) {
      summary.degradedCount += 1;
      summary.reasons.push(reason);
      extraLimitations.push('contains_admitted_degraded');
    }

    contextIncompatibleOnly = false;

    if (isOpportunityAdmission(result)) {
      const provenOpportunityAvailability = envelope?.opportunity?.availability;
      opportunityContext.push({
        agentId: envelope?.agentId || result.evidenceRef?.agentId || null,
        runId: envelope?.runId ?? result.evidenceRef?.runId ?? null,
        correlationFamily: inCorrelationFamily(envelope?.correlationFamily)
          ? envelope.correlationFamily
          : (inCorrelationFamily(result.preserved?.correlationFamily)
            ? result.preserved.correlationFamily
            : null),
        admissionState: result.admissionState,
        admissionReason: result.admissionReason || null,
        availability: Object.values(AVAILABILITY).includes(provenOpportunityAvailability)
          ? provenOpportunityAvailability
          : AVAILABILITY.UNAVAILABLE,
      });
      continue;
    }

    if (!isDirectionalConfirmingAdmission(result)) {
      continue;
    }

    const mapped = mapEvidenceDirection(envelope?.conclusion?.direction);
    if (!mapped || mapped === DIRECTION.UNAVAILABLE || mapped === DIRECTION.NOT_APPLICABLE) {
      extraLimitations.push('directional_candidate_missing_direction');
      continue;
    }

    const family = envelope?.correlationFamily || result.preserved?.correlationFamily;
    if (!inCorrelationFamily(family)) {
      extraLimitations.push('missing_correlation_family');
      continue;
    }

    anyUsableDirectional = true;
    pushFamilyMember(family, {
      agentId: envelope.agentId,
      direction: mapped,
      degraded: result.admissionState === EVIDENCE_ADMISSION_STATE.ADMITTED_DEGRADED,
      nonConfirming: false,
    });
  }

  summary.reasons = uniqueSorted(summary.reasons);
  opportunityContext.sort((a, b) => cmpStr(a.agentId, b.agentId) || cmpStr(a.runId || '', b.runId || ''));

  const familyAssessments = [...familyMembers.entries()]
    .sort((a, b) => cmpStr(a[0], b[0]))
    .map(([correlationFamily, members]) => assessDirectionalFamily({ correlationFamily, members }));

  // Precedence 1: structural / usable evidence failure
  if (
    list.length === 0
    || (!anyUsableDirectional
      && opportunityContext.length === 0
      && familyAssessments.every((f) => f.admittedDirectionalMemberCount === 0))
  ) {
    const outcome = contextIncompatibleOnly && summary.excludedCount > 0 && summary.rejectedCount === 0
      ? SYNTHESIS_OUTCOME.INCOMPATIBLE_EVIDENCE
      : SYNTHESIS_OUTCOME.INSUFFICIENT_EVIDENCE;
    const assessment = buildAssessmentShell(decisionContext, {
      synthesisOutcome: outcome,
      observedDirection: DIRECTION_OR_ABSTAIN.ABSTAIN,
      conflictState: CONFLICT_STATE.NONE,
      independentDirectionalFamilyCount: 0,
      multiFamilyConfirmation: false,
      familyAssessments,
      opportunityContext,
      excludedNonConfirmingSummary: summary,
      limitations: [
        ...extraLimitations,
        outcome === SYNTHESIS_OUTCOME.INCOMPATIBLE_EVIDENCE
          ? 'context_incompatible_only'
          : 'no_usable_directional_evidence',
        'wp_c2_qualitative_only',
        'no_numeric_synthesis_confidence',
        'decision_eligible_false',
        'execution_eligible_false',
        'artemis_consumable_false',
      ],
    });
    return {
      assessment,
      validation: validateArtemisSynthesisAssessment(assessment),
      admissionSet,
    };
  }

  const resolved = resolveCrossFamilySynthesis(familyAssessments, { limitations: extraLimitations });
  if (!resolved.ok) {
    return {
      assessment: null,
      validation: {
        ok: false,
        code: resolved.code,
        message: resolved.message,
      },
      admissionSet,
    };
  }

  if (opportunityContext.length > 0) {
    resolved.limitations = uniqueSorted([
      ...resolved.limitations,
      'opportunity_context_non_directional',
    ]);
  }

  const assessment = buildAssessmentShell(decisionContext, {
    ...resolved,
    familyAssessments,
    opportunityContext,
    excludedNonConfirmingSummary: summary,
  });

  return {
    assessment,
    validation: validateArtemisSynthesisAssessment(assessment),
    admissionSet,
  };
}

/**
 * Project a C.2 assessment into a frozen ArtemisDecision without mutating C.1 contract code.
 * Caller must supply identity/timestamps. Uses C.1 Decision-safe evidenceRefs.
 */
export function projectSynthesisToArtemisDecision(assessment, {
  decisionId,
  decisionContextId,
  createdAt,
  analysisAt,
  evidenceRefs,
  symbol,
  venue,
  marketType,
  timeframe,
  analysisHorizon,
  expiresAt,
} = {}) {
  const synthesisValidation = validateArtemisSynthesisAssessment(assessment);
  if (!synthesisValidation.ok) {
    return {
      decision: null,
      validation: synthesisValidation,
    };
  }

  const refs = Array.isArray(evidenceRefs) ? evidenceRefs : null;
  if (refs == null) {
    return {
      decision: null,
      validation: {
        ok: false,
        code: 'evidence_refs_required_array',
        message: 'evidenceRefs must be an array',
      },
    };
  }

  const contributingAgentIds = new Set();
  for (const fam of assessment.familyAssessments || []) {
    for (const agentId of fam.memberAgentIds || []) contributingAgentIds.add(agentId);
  }
  for (const row of assessment.opportunityContext || []) {
    if (row?.agentId) contributingAgentIds.add(row.agentId);
  }

  const claimsEvidence = (
    (Array.isArray(assessment.familyAssessments) && assessment.familyAssessments.length > 0)
    || (Array.isArray(assessment.opportunityContext) && assessment.opportunityContext.length > 0)
  );

  if (claimsEvidence && refs.length === 0) {
    return {
      decision: null,
      validation: {
        ok: false,
        code: 'evidence_refs_required_for_contributors',
        message: 'Non-empty family/opportunity synthesis requires Decision-safe evidenceRefs',
      },
    };
  }

  for (let i = 0; i < refs.length; i += 1) {
    if (!isDecisionSafeEvidenceRef(refs[i])) {
      return {
        decision: null,
        validation: {
          ok: false,
          code: 'evidence_ref_not_decision_safe',
          message: `evidenceRefs[${i}] failed Decision-safe validation`,
          index: i,
        },
      };
    }
  }

  for (const agentId of contributingAgentIds) {
    if (!refs.some((ref) => ref && ref.agentId === agentId)) {
      return {
        decision: null,
        validation: {
          ok: false,
          code: 'missing_contributor_evidence_ref',
          message: `Missing Decision-safe evidenceRef for contributing agentId=${agentId}`,
          agentId,
        },
      };
    }
  }

  const decision = buildContractOnlyArtemisDecision({
    decisionId,
    decisionContextId,
    createdAt,
    analysisAt,
    expiresAt: expiresAt ?? null,
    symbol: symbol ?? assessment?.decisionContext?.symbol ?? null,
    venue: venue ?? assessment?.decisionContext?.venue ?? null,
    marketType: marketType ?? assessment?.decisionContext?.marketType ?? undefined,
    timeframe: timeframe ?? assessment?.decisionContext?.timeframe ?? null,
    analysisHorizon: analysisHorizon ?? assessment?.decisionContext?.analysisHorizon ?? null,
    evidenceRefs: refs,
    synthesisOutcome: assessment?.synthesisOutcome,
    direction: assessment?.observedDirection,
    conflictState: assessment?.conflictState,
    limitations: Array.isArray(assessment?.limitations) ? assessment.limitations : [],
    confidence: assessment?.confidence || buildUnavailableSynthesisConfidence(),
    policyVersion: assessment?.policyVersion || SYNTHESIS_POLICY_VERSION,
    implementationVersion: assessment?.implementationVersion || SYNTHESIS_POLICY_VERSION,
    riskStatus: RISK_STATUS.UNAVAILABLE,
    allocationProposal: {
      availability: ALLOCATION_AVAILABILITY.UNAVAILABLE,
      reasonKey: 'wp_c2_portfolio_not_integrated',
    },
    liquidityStatus: LIQUIDITY_STATUS.UNAVAILABLE,
    runtimeStatus: {
      availability: AVAILABILITY.UNAVAILABLE,
      reasonKey: 'wp_c2_runtime_not_integrated',
    },
  });

  decision.classification = CLASSIFICATION.ADVISORY_ONLY;
  decision.maturityStage = MATURITY_STAGE.ADVISORY_ONLY;
  decision.decisionEligible = false;
  decision.executionEligible = false;

  const validation = validateArtemisDecision(decision);
  return { decision, validation };
}

export default {
  synthesizeDeterministicAssessment,
  synthesizeFromFamilyAssessments,
  assessDirectionalFamily,
  resolveCrossFamilySynthesis,
  projectSynthesisToArtemisDecision,
  findDuplicateIdentityKeys,
  findConflictingDuplicateIdentityKeys,
  MAX_SYNTHESIS_INPUT_ENVELOPES,
};
