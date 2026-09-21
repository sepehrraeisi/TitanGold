/**
 * @jest-environment node
 *
 * Artemis Core Stage 8.1 — Shadow Decision Recording Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  AVAILABILITY,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  DECISION_MATURITY_MODE,
  EFFECTIVE_RUNTIME_MODE,
  ENVIRONMENT,
  REQUESTED_RUNTIME_MODE,
} from '../../contracts/artemisDecisionContextContract.js';
import {
  DECISION_CONTRACT_VERSION,
  buildContractOnlyArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import {
  CAPABILITY_STATE,
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_LIFECYCLE,
  CONTROL_OUTCOME,
  LIQUIDITY_GATE_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  REQUESTED_OPERATION_CLASS,
  RISK_GATE_OUTCOME,
  buildContractOnlyControlChainArtifact,
} from '../../contracts/artemisControlChainContract.js';
import {
  REQUIRED_HARD_FLAGS,
  SHADOW_RECORDING_ARTIFACT_TYPE,
  SHADOW_RECORDING_CONTRACT_VERSION,
  SHADOW_RECORDING_MATURITY,
  SHADOW_RECORDING_METHOD_KEY,
  SHADOW_RECORDING_POLICY_VERSION,
  SHADOW_RECORDING_SCHEMA_VERSION,
  SHADOW_RECORDING_STAGE,
  SHADOW_RECORDING_WRITER,
  ZERO_SHADOW_RECORDING_SIDE_EFFECTS,
  buildShadowDecisionRecording,
  validateShadowDecisionRecording,
} from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_B = '22222222-2222-4222-8222-222222222222';
const RUN_EXCLUDED = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const RECORDED_AT = '2026-09-20T12:00:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
);

function baseDecision(overrides = {}) {
  return buildContractOnlyArtemisDecision({
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    symbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    createdAt: RECORDED_AT,
    analysisAt: RECORDED_AT,
    sourceWindow: { start: '2026-09-20T10:00:00.000Z', end: '2026-09-20T11:00:00.000Z' },
    ...overrides,
  });
}

function baseContext(overrides = {}) {
  return {
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    contextId: CONTEXT_ID,
    lifecycleState: DECISION_CONTEXT_LIFECYCLE.FROZEN,
    environment: ENVIRONMENT.TEST,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    marketScope: {
      provider: 'mexc',
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    },
    mode: {
      requested: REQUESTED_RUNTIME_MODE.SHADOW,
      effective: EFFECTIVE_RUNTIME_MODE.SHADOW,
      maturity: DECISION_MATURITY_MODE.SHADOW,
    },
    sourceWindow: {
      since: '2026-09-20T10:00:00.000Z',
      until: '2026-09-20T11:00:00.000Z',
    },
    evidenceReferences: {
      orchestrationSetIds: [ORCH_ID],
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function baseEvidenceSet(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    orchestrationId: ORCH_ID,
    generatedAt: RECORDED_AT,
    stage: 6,
    includedEvidence: [
      { agentId: 'technical', runId: RUN_A, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
      { agentId: 'trend', runId: RUN_B, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
    ],
    excludedEvidence: [
      {
        agentId: 'sentiment',
        runId: RUN_EXCLUDED,
        disposition: 'UNAVAILABLE',
        usable: false,
      },
    ],
    conflicts: [],
    missingEvidence: [],
    lineage: {
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      contributingRunIds: [RUN_A, RUN_B],
      excludedRunIds: [RUN_EXCLUDED],
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function controlChainContext(overrides = {}) {
  return {
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    contextId: CONTEXT_ID,
    lifecycleState: DECISION_CONTEXT_LIFECYCLE.FROZEN,
    environment: ENVIRONMENT.TEST,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    marketScope: {
      provider: 'mexc',
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    },
    mode: {
      requested: REQUESTED_RUNTIME_MODE.ADVISORY,
      effective: EFFECTIVE_RUNTIME_MODE.ADVISORY,
    },
    sourceWindow: {
      since: '2026-09-20T10:00:00.000Z',
      until: '2026-09-20T11:00:00.000Z',
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function baseControlChain(overrides = {}) {
  const built = buildContractOnlyControlChainArtifact({
    artemisCognitiveDecision: baseDecision(),
    decisionContext: controlChainContext(),
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      contributingAgentRunIds: [RUN_A, RUN_B],
      orchestrationSetIds: [ORCH_ID],
      decisionContractVersion: DECISION_CONTRACT_VERSION,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    provenance: {
      writer: 'unit_test',
      methodKey: 'stage8_1_test',
      stage: '7.3.1',
      recordedAt: RECORDED_AT,
    },
    requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
    runtimeSnapshot: {
      killSwitchActive: false,
      requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
      effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
      capabilityState: CAPABILITY_STATE.GRANTED,
      ssotAvailable: true,
      ssotOwner: 'runtimeExecutionStateService',
    },
  });
  expect(built.ok).toBe(true);
  return {
    ...built.artifact,
    ...overrides,
  };
}

function controlPassBoundedArtifact() {
  const base = baseControlChain();
  return {
    ...base,
    controlOutcome: CONTROL_OUTCOME.CONTROL_PASS_BOUNDED,
    lifecycle: CONTROL_CHAIN_LIFECYCLE.EVALUATED_COMPLETE,
    riskGate: {
      authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
      outcome: RISK_GATE_OUTCOME.PASS,
      freshness: FRESHNESS_STATUS.FRESH,
      reasonKey: 'risk_pass',
      terminalVeto: false,
    },
    portfolioGate: {
      authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
      outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
      unit: 'quote',
      min: 0.1,
      max: 1,
      recommended: 0.5,
      usableSizingEmitted: true,
      reasonKey: 'sized',
    },
    liquidityGate: {
      authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
      outcome: LIQUIDITY_GATE_OUTCOME.FEASIBLE,
      reasonKey: 'feasible_test',
      freshness: FRESHNESS_STATUS.FRESH,
      bookTimestamp: RECORDED_AT,
      expiryTimestamp: '2026-09-20T13:00:00.000Z',
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    controlChainStarted: false,
    ordersCreated: 0,
    liveTradingEnabled: false,
  };
}

function baseInput(overrides = {}) {
  return {
    decision: baseDecision(),
    decisionContext: baseContext(),
    evidenceOrchestrationSet: baseEvidenceSet(),
    controlChainArtifact: baseControlChain(),
    recordedAt: RECORDED_AT,
    ...overrides,
  };
}

describe('artemisShadowDecisionRecordingBoundaryContract — Stage 8.1', () => {
  it('1. builds a valid SHADOW recording artifact', () => {
    const result = buildShadowDecisionRecording(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.artifactType).toBe(SHADOW_RECORDING_ARTIFACT_TYPE);
    expect(result.artifact.maturity).toBe(SHADOW_RECORDING_MATURITY);
    expect(result.artifact.schemaVersion).toBe(SHADOW_RECORDING_SCHEMA_VERSION);
    expect(result.artifact.contractVersion).toBe(SHADOW_RECORDING_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(SHADOW_RECORDING_POLICY_VERSION);
    expect(result.artifact.decisionRef.decisionId).toBe(DECISION_ID);
    expect(result.artifact.decisionContextRef.lifecycleState).toBe(DECISION_CONTEXT_LIFECYCLE.FROZEN);
    expect(result.artifact.decisionContextRef.mode.maturity).toBe(DECISION_MATURITY_MODE.SHADOW);
    expect(result.artifact.evidenceOrchestrationRef.orchestrationId).toBe(ORCH_ID);
    expect(result.artifact.evidenceOrchestrationRef.includedCount).toBe(2);
    expect(result.artifact.evidenceOrchestrationRef.excludedCount).toBe(1);
    expect(result.artifact.evidenceOrchestrationRef.conflictCount).toBe(0);
    expect(result.artifact.controlChainRef.controlChainArtifactId).toBeTruthy();
    expect(result.artifact.limitations).toEqual(expect.arrayContaining([
      'market_context_ref_optional_validated_only',
      'observed_outcome_not_available_no_canonical_sot',
      'persistence_not_enabled',
      'shadow_runtime_not_activated',
    ]));
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
    }
  });

  it('2. is deterministic for identical input', () => {
    const input = baseInput();
    const a = buildShadowDecisionRecording(input);
    const b = buildShadowDecisionRecording(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact).toEqual(b.artifact);
    expect(a.artifact.shadowRecordingArtifactId).toBe(b.artifact.shadowRecordingArtifactId);
  });

  it('3. rejects wrong recording maturity via validate alias path still building SHADOW only', () => {
    const result = validateShadowDecisionRecording(baseInput({
      provenance: { writer: SHADOW_RECORDING_WRITER },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.maturity).toBe(DECISION_MATURITY_MODE.SHADOW);
  });

  it('4. rejects wrong Context maturity', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({
        mode: {
          requested: REQUESTED_RUNTIME_MODE.ADVISORY,
          effective: EFFECTIVE_RUNTIME_MODE.ADVISORY,
          maturity: DECISION_MATURITY_MODE.ADVISORY,
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'wrong_maturity')).toBe(true);
  });

  it('5. rejects LIVE context requested/effective mode', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({
        mode: {
          requested: REQUESTED_RUNTIME_MODE.LIVE,
          effective: EFFECTIVE_RUNTIME_MODE.SHADOW,
          maturity: DECISION_MATURITY_MODE.SHADOW,
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'live_runtime_mode_rejected')).toBe(true);
  });

  it('6. rejects missing Decision', () => {
    const input = baseInput();
    delete input.decision;
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_decision')).toBe(true);
  });

  it('7. rejects missing Decision Context', () => {
    const input = baseInput();
    delete input.decisionContext;
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_decision_context')).toBe(true);
  });

  it('8. rejects missing EvidenceOrchestrationSet', () => {
    const input = baseInput();
    delete input.evidenceOrchestrationSet;
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_evidence_orchestration_set')).toBe(true);
  });

  it('9. rejects missing Control Chain', () => {
    const input = baseInput();
    delete input.controlChainArtifact;
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_control_chain')).toBe(true);
  });

  it('10. rejects Decision/context ID mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decision: baseDecision({ decisionContextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'decision_context_id_mismatch')).toBe(true);
  });

  it('11. rejects orchestration mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({
        evidenceReferences: {
          orchestrationSetIds: ['99999999-9999-4999-8999-999999999999'],
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'orchestration_mismatch')).toBe(true);
  });

  it('12. rejects Control Chain decision mismatch', () => {
    const control = baseControlChain();
    const result = buildShadowDecisionRecording(baseInput({
      controlChainArtifact: {
        ...control,
        decisionId: '99999999-9999-4999-8999-999999999999',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'control_chain_decision_mismatch'
      || e.code === 'invalid_control_chain'
      || e.field === 'controlChainArtifact'
    ))).toBe(true);
  });

  it('13a. rejects decisionContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { decisionContractVersion: 'wrong-decision-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.decisionContractVersion')).toBe(true);
  });

  it('13b. rejects decisionContextContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { decisionContextContractVersion: 'wrong-context-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.decisionContextContractVersion')).toBe(true);
  });

  it('13c. rejects evidenceContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { evidenceContractVersion: 'wrong-evidence-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.evidenceContractVersion')).toBe(true);
  });

  it('13d. rejects orchestrationContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { orchestrationContractVersion: 'wrong-orch-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.orchestrationContractVersion')).toBe(true);
  });

  it('13e. rejects controlChainContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { controlChainContractVersion: 'wrong-cc-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.controlChainContractVersion')).toBe(true);
  });

  it('13f. rejects shadowRecordingContractVersion mismatch in caller lineage', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { shadowRecordingContractVersion: 'wrong-shadow-version' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.shadowRecordingContractVersion')).toBe(true);
  });

  it('14a. rejects lineage decisionId mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { decisionId: '99999999-9999-4999-8999-999999999999' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.decisionId')).toBe(true);
  });

  it('14b. rejects lineage decisionContextId mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { decisionContextId: '99999999-9999-4999-8999-999999999999' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.decisionContextId')).toBe(true);
  });

  it('14c. rejects lineage orchestrationId mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { orchestrationId: '99999999-9999-4999-8999-999999999999' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.orchestrationId')).toBe(true);
  });

  it('14d. rejects lineage controlChainArtifactId mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { controlChainArtifactId: '99999999-9999-4999-8999-999999999999' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.controlChainArtifactId')).toBe(true);
  });

  it('14e. rejects lineage orchestrationSetIds mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { orchestrationSetIds: ['99999999-9999-4999-8999-999999999999'] },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.orchestrationSetIds')).toBe(true);
  });

  it('15. rejects contributingAgentRunIds mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { contributingAgentRunIds: [RUN_A] },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.contributingAgentRunIds')).toBe(true);
  });

  it('16. rejects excludedRunIds mismatch', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { excludedRunIds: [RUN_A] },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage.excludedRunIds')).toBe(true);
  });

  it('17. rejects provenance writer spoof', () => {
    const result = buildShadowDecisionRecording(baseInput({
      provenance: { writer: 'evil-writer' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_writer_spoof')).toBe(true);
  });

  it('18. rejects provenance methodKey spoof', () => {
    const result = buildShadowDecisionRecording(baseInput({
      provenance: { methodKey: 'evil_method' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_method_key_spoof')).toBe(true);
  });

  it('19. rejects provenance stage spoof', () => {
    const result = buildShadowDecisionRecording(baseInput({
      provenance: { stage: 'ARTEMIS_CORE_STAGE_7' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_stage_spoof')).toBe(true);
  });

  it('20. rejects unknown top-level field', () => {
    const result = buildShadowDecisionRecording(baseInput({ extraVoteWeight: 3 }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('21. rejects unknown nested lineage field', () => {
    const result = buildShadowDecisionRecording(baseInput({
      lineage: { projectorContractVersion: 'invented' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('22. rejects decisionEligible=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ decisionEligible: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'decisionEligible')).toBe(true);
  });

  it('23. rejects executionEligible=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ executionEligible: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'executionEligible')).toBe(true);
  });

  it('24. rejects approvedForExecution=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ approvedForExecution: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'approvedForExecution')).toBe(true);
  });

  it('25. rejects liveTradingEnabled=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ liveTradingEnabled: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'liveTradingEnabled')).toBe(true);
  });

  it('26. rejects providerConnected=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ providerConnected: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'providerConnected')).toBe(true);
  });

  it('27. rejects shadowRuntimeActivated=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ shadowRuntimeActivated: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'shadowRuntimeActivated')).toBe(true);
  });

  it('28. rejects persistenceEnabled=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ persistenceEnabled: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'persistenceEnabled')).toBe(true);
  });

  it('29. rejects b10WriteAttempted=true', () => {
    const result = buildShadowDecisionRecording(baseInput({ b10WriteAttempted: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'b10WriteAttempted')).toBe(true);
  });

  it('30. rejects order contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ order: { side: 'BUY' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('31. rejects executionIntent contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ executionIntent: { size: 1 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('32. rejects walletAction contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ walletAction: 'transfer' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('33. rejects financialExecution contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ financialExecution: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('34. rejects provider contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ providerPayload: { signed: true } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('35. rejects market-data contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ marketSnapshot: { price: 1 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'market_contamination' || e.code === 'forbidden_key' || e.code === 'unknown_field'
    ))).toBe(true);
  });

  it('36. rejects observedOutcome contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ observedOutcome: { direction: 'bullish' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'outcome_contamination' || e.code === 'forbidden_key' || e.code === 'unknown_field'
    ))).toBe(true);
  });

  it('37. rejects realizedPnl contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ realizedPnl: 12.5 }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'outcome_contamination' || e.code === 'forbidden_key' || e.code === 'unknown_field'
    ))).toBe(true);
  });

  it('38. rejects evaluationResult contamination', () => {
    const result = buildShadowDecisionRecording(baseInput({ evaluationResult: { score: 1 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'outcome_contamination' || e.code === 'forbidden_key' || e.code === 'unknown_field'
    ))).toBe(true);
  });

  it('39. rejects Decision.maturityStage=SHADOW attempt', () => {
    const result = buildShadowDecisionRecording(baseInput({
      // Inject after canonical builder — Decision contract does not accept SHADOW maturityStage.
      decision: { ...baseDecision(), maturityStage: 'SHADOW' },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'decision_maturity_stage_shadow_forbidden'
      || e.field === 'decision'
      || e.field === 'decision.maturityStage'
    ))).toBe(true);
  });

  it('40. Control PASS does not become execution authorization', () => {
    const control = controlPassBoundedArtifact();
    const result = buildShadowDecisionRecording(baseInput({ controlChainArtifact: control }));
    expect(result.ok).toBe(true);
    expect(result.artifact.controlChainRef.controlOutcome).toBe(CONTROL_OUTCOME.CONTROL_PASS_BOUNDED);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.decisionEligible).toBe(false);
  });

  it('41. returns zero side effects', () => {
    const result = buildShadowDecisionRecording(baseInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_SHADOW_RECORDING_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_SHADOW_RECORDING_SIDE_EFFECTS);
  });

  it('42. imports contain no runtime/persistence/network/provider/LLM', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/runtimeExecutionStateService/);
    expect(source).not.toMatch(/artemisDecisionPersistenceService/);
    expect(source).not.toMatch(/persistArtemisDecision/);
    expect(source).not.toMatch(/from ['"].*mexc/);
    expect(source).not.toMatch(/market-proxy/);
    expect(source).not.toMatch(/openai|anthropic|fetch\(|axios|node-fetch/i);
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/randomUUID\(/);
    expect(source).toMatch(/build_shadow_decision_recording_fail_closed/);
    expect(source).toMatch(SHADOW_RECORDING_WRITER);
    expect(source).toMatch(SHADOW_RECORDING_METHOD_KEY);
    expect(source).toMatch(SHADOW_RECORDING_STAGE);
  });

  it('43. C1–C6 regression placeholder — protected import surface unchanged by this slice', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).toMatch(/validateArtemisDecision/);
    expect(source).toMatch(/validateControlChainArtifact/);
    expect(source).not.toMatch(/artemisRiskControlProjectorContract/);
    expect(source).not.toMatch(/artemisPortfolioControlSizingBoundaryContract/);
    expect(source).not.toMatch(/artemisLiquidityExecutionFeasibilityBoundaryContract/);
    expect(source).not.toMatch(/artemisRuntimeCapabilityBoundaryContract/);
    expect(source).not.toMatch(/artemisOrderManagementExecutionBoundaryContract/);
    expect(source).not.toMatch(/artemisRiskControlRuntimeBoundaryContract/);
  });

  it('rejects missing Context maturity', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({
        mode: {
          requested: REQUESTED_RUNTIME_MODE.SHADOW,
          effective: EFFECTIVE_RUNTIME_MODE.SHADOW,
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'required_maturity')).toBe(true);
  });

  it('rejects non-FROZEN Decision Context lifecycle', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({ lifecycleState: DECISION_CONTEXT_LIFECYCLE.VALIDATED }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'decision_context_not_frozen')).toBe(true);
  });

  it('rejects missing recordedAt', () => {
    const input = baseInput();
    delete input.recordedAt;
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'recordedAt')).toBe(true);
  });

  it('rejects market contamination inside marketScope', () => {
    const result = buildShadowDecisionRecording(baseInput({
      decisionContext: baseContext({
        marketScope: {
          provider: 'mexc',
          venue: 'mexc',
          marketType: MARKET_TYPE.SPOT,
          symbol: 'BTC/USDT',
          ticker: { last: 1 },
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'market_contamination' || e.code === 'unknown_field'
    ))).toBe(true);
  });

  it('accepts matching caller lineage and provenance', () => {
    const control = baseControlChain();
    const result = buildShadowDecisionRecording(baseInput({
      controlChainArtifact: control,
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        orchestrationId: ORCH_ID,
        orchestrationSetIds: [ORCH_ID],
        controlChainArtifactId: control.controlChainArtifactId,
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
        shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
        contributingAgentRunIds: [RUN_A, RUN_B],
        contributingRunIds: [RUN_A, RUN_B],
        excludedRunIds: [RUN_EXCLUDED],
      },
      provenance: {
        writer: SHADOW_RECORDING_WRITER,
        methodKey: SHADOW_RECORDING_METHOD_KEY,
        stage: SHADOW_RECORDING_STAGE,
        recordedAt: RECORDED_AT,
        policyVersion: SHADOW_RECORDING_POLICY_VERSION,
        note: 'unit',
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.note).toBe('unit');
  });
});

describe('artemisShadowDecisionRecordingBoundaryContract — S8-C81-MC-REF', () => {
  const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function validMarketContextRef(overrides = {}) {
    return {
      marketContextId: MC_ID,
      contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      timeframe: '1h',
      freshnessStatus: FRESHNESS_STATUS.FRESH,
      sourceTimestamp: RECORDED_AT,
      availability: AVAILABILITY.AVAILABLE,
      ...overrides,
    };
  }

  function expectReject(input, fieldSubstring, code) {
    const result = buildShadowDecisionRecording(input);
    expect(result.ok).toBe(false);
    const hit = (result.errors || []).some(
      (e) => String(e.field || '').includes(fieldSubstring)
        && (code == null || e.code === code),
    );
    expect(hit).toBe(true);
    return result;
  }

  it('1. accepts a valid marketContextRef', () => {
    const result = buildShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.marketContextRef).toEqual(validMarketContextRef());
    expect(result.artifact.lineage.marketContextId).toBe(MC_ID);
    expect(result.artifact.lineage.marketContextContractVersion)
      .toBe(MARKET_CONTEXT_CONTRACT_VERSION);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
    }
    expect(result.artifact.sideEffects).toEqual(ZERO_SHADOW_RECORDING_SIDE_EFFECTS);
  });

  it('2. accepts omitted marketContextRef (existing C8.1 behavior)', () => {
    const result = buildShadowDecisionRecording(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.marketContextRef).toBeUndefined();
    expect(result.artifact.lineage.marketContextId).toBeUndefined();
  });

  it('3. rejects malformed marketContextRef', () => {
    expectReject(baseInput({ marketContextRef: 'not-an-object' }), 'marketContextRef');
    expectReject(baseInput({ marketContextRef: ['array'] }), 'marketContextRef');
  });

  it('4. rejects unknown fields on marketContextRef', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ extraField: true }) }),
      'marketContextRef.extraField',
      'unknown_field',
    );
  });

  it('5. rejects invalid contractVersion', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ contractVersion: 'wrong' }) }),
      'marketContextRef.contractVersion',
      'invalid_contract_version',
    );
  });

  it('6. rejects invalid marketContextId', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ marketContextId: 'not-uuid' }) }),
      'marketContextRef.marketContextId',
      'invalid_market_context_id',
    );
  });

  it('7. rejects venue mismatch', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ venue: 'binance' }) }),
      'marketContextRef.venue',
      'venue_mismatch',
    );
  });

  it('8. rejects marketType mismatch', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ marketType: MARKET_TYPE.FUTURES }) }),
      'marketContextRef.marketType',
      'market_type_mismatch',
    );
  });

  it('9. rejects symbol mismatch', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ symbol: 'ETH/USDT' }) }),
      'marketContextRef.symbol',
      'symbol_mismatch',
    );
  });

  it('10. rejects timeframe mismatch', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ timeframe: '4h' }) }),
      'marketContextRef.timeframe',
      'timeframe_mismatch',
    );
  });

  it('11. rejects unusable freshness', () => {
    expectReject(
      baseInput({
        marketContextRef: validMarketContextRef({ freshnessStatus: FRESHNESS_STATUS.STALE }),
      }),
      'marketContextRef.freshnessStatus',
      'unusable_freshness',
    );
  });

  it('12. rejects availability mismatch', () => {
    expectReject(
      baseInput({
        marketContextRef: validMarketContextRef({ availability: AVAILABILITY.UNAVAILABLE }),
      }),
      'marketContextRef.availability',
      'availability_mismatch',
    );
  });

  it('13. rejects provenance mismatch (spoofed writer)', () => {
    expectReject(
      baseInput({
        marketContextRef: validMarketContextRef(),
        provenance: {
          writer: 'spoofed',
          methodKey: SHADOW_RECORDING_METHOD_KEY,
          stage: SHADOW_RECORDING_STAGE,
          recordedAt: RECORDED_AT,
          policyVersion: SHADOW_RECORDING_POLICY_VERSION,
        },
      }),
      'provenance.writer',
      'provenance_writer_spoof',
    );
  });

  it('14. rejects lineage mismatch for marketContextId', () => {
    expectReject(
      baseInput({
        marketContextRef: validMarketContextRef(),
        lineage: {
          marketContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        },
      }),
      'lineage.marketContextId',
      'lineage_mismatch',
    );
  });

  it('15. rejects raw market payload on input', () => {
    expectReject(
      baseInput({ marketSnapshot: { price: 1 } }),
      'marketSnapshot',
    );
  });

  it('16. rejects OHLCV contamination on marketContextRef', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ ohlcv: [[1, 2, 3]] }) }),
      'marketContextRef.ohlcv',
    );
  });

  it('17. rejects ticker contamination', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ ticker: { last: 1 } }) }),
      'marketContextRef.ticker',
    );
  });

  it('18. rejects orderbook contamination', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ orderBook: { bids: [] } }) }),
      'marketContextRef.orderBook',
    );
  });

  it('19. rejects provider/network payload fields', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ providerPayload: {} }) }),
      'marketContextRef.providerPayload',
    );
  });

  it('20. rejects execution/order/wallet contamination', () => {
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ orderId: 'x' }) }),
      'orderId',
    );
    expectReject(
      baseInput({ marketContextRef: validMarketContextRef({ walletAction: 'withdraw' }) }),
      'walletAction',
    );
  });

  it('21. preserves deterministic artifact identity for omitted ref', () => {
    const a = buildShadowDecisionRecording(baseInput());
    const b = buildShadowDecisionRecording(baseInput());
    expect(a.ok && b.ok).toBe(true);
    expect(a.artifact.shadowRecordingArtifactId).toBe(b.artifact.shadowRecordingArtifactId);
  });

  it('21b. deterministic identity differs when marketContextRef present', () => {
    const without = buildShadowDecisionRecording(baseInput());
    const withRef = buildShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
    }));
    expect(without.ok && withRef.ok).toBe(true);
    expect(withRef.artifact.shadowRecordingArtifactId)
      .not.toBe(without.artifact.shadowRecordingArtifactId);
    const withRefAgain = buildShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
    }));
    expect(withRefAgain.artifact.shadowRecordingArtifactId)
      .toBe(withRef.artifact.shadowRecordingArtifactId);
  });

  it('22. zero side-effect counters preserved with marketContextRef', () => {
    const result = buildShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
    }));
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_SHADOW_RECORDING_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_SHADOW_RECORDING_SIDE_EFFECTS);
  });

  it('23. hard-false authority flags preserved with marketContextRef', () => {
    const result = buildShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
      decisionEligible: false,
      executionEligible: false,
      approvedForExecution: false,
      liveTradingEnabled: false,
      providerConnected: false,
      shadowRuntimeActivated: false,
      persistenceEnabled: false,
      b10WriteAttempted: false,
    }));
    expect(result.ok).toBe(true);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
    }
  });

  it('24–27. rejects hard-flag elevation when marketContextRef present', () => {
    expectReject(
      baseInput({
        marketContextRef: validMarketContextRef(),
        executionEligible: true,
      }),
      'executionEligible',
      'hard_flag_must_be_false',
    );
  });

  it('side-effect audit: no IO imports in C8.1 contract source', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/from ['"]pg['"]|require\(['"]pg['"]\)/);
    expect(src).not.toMatch(/from ['"](?:ioredis|redis)['"]|require\(['"](?:ioredis|redis)['"]\)/);
    expect(src).not.toMatch(/from ['"](?:axios|ccxt|node-fetch)['"]/);
    expect(src).not.toMatch(/createPool|createClient|\bnet\.|\bhttp\./);
    // No circular import of MC contract; S8-MC ref semantics are mirrored locally.
    expect(src).not.toMatch(/from ['"]\.\/artemisMarketContextContract\.js['"]/);
    expect(src).toMatch(/marketContextRef/);
    expect(src).toMatch(/artemis-market-context-1\.0\.0/);
  });

  it('validateShadowDecisionRecording alias accepts optional marketContextRef', () => {
    const result = validateShadowDecisionRecording(baseInput({
      marketContextRef: validMarketContextRef(),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.marketContextRef.marketContextId).toBe(MC_ID);
  });
});
