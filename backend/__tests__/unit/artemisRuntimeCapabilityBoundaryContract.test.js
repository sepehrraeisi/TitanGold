/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.c.5 — Runtime Capability boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
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
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  REQUESTED_OPERATION_CLASS,
  RUNTIME_GATE_OUTCOME,
  buildContractOnlyControlChainArtifact,
} from '../../contracts/artemisControlChainContract.js';
import {
  CANONICAL_RUNTIME_SSOT_OWNER,
  REQUIRED_HARD_FLAGS,
  RUNTIME_CAPABILITY_CONTRACT_VERSION,
  RUNTIME_CAPABILITY_METHOD_KEY,
  RUNTIME_CAPABILITY_STAGE,
  RUNTIME_CAPABILITY_WRITER,
  RUNTIME_GATE_AUTHORITY,
  SLICE_AUTHORITY,
  ZERO_RUNTIME_CAPABILITY_SIDE_EFFECTS,
  previewRuntimeGate,
  projectRuntimeSnapshot,
  validateProjectedRuntimeSnapshot,
  validateRuntimeCapabilityInput,
} from '../../contracts/artemisRuntimeCapabilityBoundaryContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRuntimeCapabilityBoundaryContract.js'),
  'utf8',
);
const C2_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRiskControlRuntimeBoundaryContract.js'),
  'utf8',
);

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_ID = '11111111-1111-4111-8111-111111111111';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';
const SOURCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;

function clearEvidence(overrides = {}) {
  return {
    killSwitchActive: false,
    requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
    effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
    capabilityState: CAPABILITY_STATE.GRANTED,
    ssotAvailable: true,
    ssotOwner: CANONICAL_RUNTIME_SSOT_OWNER,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    runtimeEvidence: clearEvidence(),
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    runId: RUN_ID,
    recordedAt: RECORDED_AT,
    sourceContractVersion: SOURCE_CONTRACT_VERSION,
    orchestrationSetIds: [ORCH_ID],
    contributingAgentRunIds: [RUN_ID],
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      runId: RUN_ID,
      contributingAgentRunIds: [RUN_ID],
      orchestrationSetIds: [ORCH_ID],
      sourceContractVersion: SOURCE_CONTRACT_VERSION,
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      projectorContractVersion: RUNTIME_CAPABILITY_CONTRACT_VERSION,
    },
    provenance: {
      writer: 'runtime_adapter_test',
      methodKey: 'map_runtime_ssot_state',
      stage: 'test',
      recordedAt: RECORDED_AT,
    },
    ...overrides,
  };
}

function controlChainBaseDecision() {
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
    sourceWindow: { start: '2026-09-05T10:00:00.000Z', end: '2026-09-05T11:00:00.000Z' },
  });
}

function controlChainBaseContext() {
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
      since: '2026-09-05T10:00:00.000Z',
      until: '2026-09-05T11:00:00.000Z',
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
  };
}

describe('Stage 7.3.2.c.5 Runtime Capability boundary', () => {
  it('projects valid CLEAR runtimeSnapshot', () => {
    const result = projectRuntimeSnapshot(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeSnapshot).toEqual(clearEvidence());
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.CLEAR);
    expect(result.artifact.runtimeGatePreview.authorityClass).toBe(RUNTIME_GATE_AUTHORITY);
    expect(result.artifact.sliceAuthority).toBe(SLICE_AUTHORITY);
    expect(result.artifact.provenance.writer).toBe(RUNTIME_CAPABILITY_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(RUNTIME_CAPABILITY_METHOD_KEY);
    expect(result.artifact.provenance.stage).toBe(RUNTIME_CAPABILITY_STAGE);
    expect(Object.prototype.hasOwnProperty.call(result.artifact.runtimeSnapshot, 'workerAcknowledgement'))
      .toBe(false);
  });

  it('rejects missing runtimeEvidence', () => {
    const { runtimeEvidence, ...rest } = baseInput();
    const result = projectRuntimeSnapshot(rest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_runtime_evidence')).toBe(true);
  });

  it('rejects missing fields in runtimeEvidence', () => {
    const evidence = clearEvidence();
    delete evidence.capabilityState;
    const result = projectRuntimeSnapshot(baseInput({ runtimeEvidence: evidence }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'runtimeEvidence.capabilityState'
      && e.code === 'missing_field')).toBe(true);
  });

  it('rejects malformed killSwitchActive', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ killSwitchActive: 'yes' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_kill_switch')).toBe(true);
  });

  it('blocks when ssot unavailable (projectable BLOCKED)', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ ssotAvailable: false }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(result.artifact.runtimeGatePreview.reasonKey).toBe('runtime_ssot_unavailable');
  });

  it('rejects invalid ssotOwner', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ ssotOwner: 'fakeOwner' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_ssot_owner')).toBe(true);
  });

  it('blocks when kill switch active', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ killSwitchActive: true }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(result.artifact.runtimeGatePreview.reasonKey).toBe('kill_switch_active');
  });

  it('blocks when kill switch unknown', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ killSwitchActive: 'unknown' }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(result.artifact.runtimeGatePreview.reasonKey).toBe('kill_switch_unknown');
  });

  it('blocks when capability unknown', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ capabilityState: CAPABILITY_STATE.UNKNOWN }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(result.artifact.runtimeGatePreview.reasonKey).toBe('capability_unknown');
  });

  it('blocks when capability denied', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ capabilityState: CAPABILITY_STATE.DENIED }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(result.artifact.runtimeGatePreview.reasonKey).toBe('capability_denied');
  });

  it('rejects LIVE requestedRuntimeMode', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ requestedRuntimeMode: REQUESTED_RUNTIME_MODE.LIVE }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'live_runtime_mode_rejected')).toBe(true);
  });

  it('rejects LIVE effectiveRuntimeMode', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ effectiveRuntimeMode: 'live' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'live_runtime_mode_rejected')).toBe(true);
  });

  it('rejects decisionId mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      decisionId: DECISION_ID,
      lineage: {
        ...baseInput().lineage,
        decisionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_decision_mismatch')).toBe(true);
  });

  it('rejects decisionContextId mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      decisionContextId: CONTEXT_ID,
      lineage: {
        ...baseInput().lineage,
        decisionContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_context_mismatch')).toBe(true);
  });

  it('rejects lineage runId mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runId: RUN_ID,
      lineage: {
        ...baseInput().lineage,
        runId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_run_mismatch')).toBe(true);
  });

  it('rejects lineage controlChainContractVersion mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      lineage: {
        ...baseInput().lineage,
        controlChainContractVersion: 'artemis-control-chain-0.0.0',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_control_chain_contract_version_mismatch'))
      .toBe(true);
  });

  it('rejects lineage contributingAgentRunIds mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      contributingAgentRunIds: [RUN_ID],
      lineage: {
        ...baseInput().lineage,
        contributingAgentRunIds: ['22222222-2222-4222-8222-222222222222'],
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'lineage_contributing_agent_run_mismatch')).toBe(true);
    expect(result.errors.every((e) => e.code !== 'fabricated_clear')).toBe(true);
    expect(REQUIRED_HARD_FLAGS.executionEligible).toBe(false);
    expect(ZERO_RUNTIME_CAPABILITY_SIDE_EFFECTS.dbWriteCount).toBe(0);
  });

  it('rejects lineage orchestrationSetIds mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      orchestrationSetIds: [ORCH_ID],
      lineage: {
        ...baseInput().lineage,
        orchestrationSetIds: ['44444444-4444-4444-8444-444444444444'],
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'lineage_orchestration_set_mismatch')).toBe(true);
  });

  it('rejects lineage sourceContractVersion mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      sourceContractVersion: SOURCE_CONTRACT_VERSION,
      lineage: {
        ...baseInput().lineage,
        sourceContractVersion: 'artemis-evidence-spoofed-0.0.0',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'lineage_source_contract_version_mismatch')).toBe(true);
  });

  it('rejects lineage evidenceContractVersion mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      lineage: {
        ...baseInput().lineage,
        evidenceContractVersion: 'artemis-evidence-spoofed-0.0.0',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'lineage_evidence_contract_version_mismatch')).toBe(true);
  });

  it('rejects lineage projectorContractVersion mismatch', () => {
    const result = projectRuntimeSnapshot(baseInput({
      lineage: {
        ...baseInput().lineage,
        projectorContractVersion: 'artemis-runtime-capability-spoofed-0.0.0',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'lineage_projector_contract_version_mismatch')).toBe(true);
  });

  it('rejects fabricated CLEAR without attested required SoT evidence', () => {
    const missingEvidence = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: {},
    }));
    expect(missingEvidence.ok).toBe(false);
    expect(missingEvidence.artifact).toBeUndefined();
    expect(missingEvidence.errors.some((e) => e.code === 'missing_field')).toBe(true);
    expect(JSON.stringify(missingEvidence)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);

    const unattestedSsot = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: {
        killSwitchActive: false,
        requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
        effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
        capabilityState: CAPABILITY_STATE.GRANTED,
      },
    }));
    expect(unattestedSsot.ok).toBe(false);
    expect(unattestedSsot.artifact).toBeUndefined();
    expect(unattestedSsot.errors.some((e) => e.code === 'missing_field'
      || e.code === 'invalid_ssot_owner')).toBe(true);
    expect(JSON.stringify(unattestedSsot)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);

    const injectedClearPreview = projectRuntimeSnapshot({
      ...baseInput(),
      runtimeGatePreview: { outcome: RUNTIME_GATE_OUTCOME.CLEAR },
    });
    expect(injectedClearPreview.ok).toBe(false);
    expect(injectedClearPreview.artifact).toBeUndefined();
    expect(injectedClearPreview.errors.some((e) => e.code === 'unknown_field'
      && String(e.field).includes('runtimeGatePreview'))).toBe(true);
    expect(JSON.stringify(injectedClearPreview)).not.toMatch(
      /"runtimeSnapshot"\s*:\s*\{[^}]*"ssotAvailable"\s*:\s*true/,
    );
  });

  it('rejects provenance spoof (writer/method mismatch)', () => {
    const result = projectRuntimeSnapshot(baseInput({
      provenance: {
        writer: RUNTIME_CAPABILITY_WRITER,
        methodKey: 'spoofed_method',
        stage: RUNTIME_CAPABILITY_STAGE,
        recordedAt: RECORDED_AT,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_mismatch')).toBe(true);
  });

  it('rejects unknown top-level field', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      extraTop: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field'
      && String(e.field).includes('extraTop'))).toBe(true);
  });

  it('rejects unknown nested runtimeEvidence field', () => {
    const result = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: {
        ...clearEvidence(),
        workerAcknowledgement: true,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field'
      && String(e.field).includes('workerAcknowledgement'))).toBe(true);
  });

  it('rejects BUY/SELL/LONG/SHORT/direction contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      direction: 'BUY',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'direction_forbidden'
      || e.code === 'execution_authority_forbidden')).toBe(true);
  });

  it('rejects order/execution/wallet contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      executionIntent: { side: 'BUY' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'execution_contamination'
      || e.code === 'forbidden_key')).toBe(true);
  });

  it('rejects votes/majority/weightedVote/consensus', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      majority: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'vote_contamination'
      || e.code === 'forbidden_key')).toBe(true);
  });

  it('rejects orderId contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      orderId: 'ord-fabricated-1',
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'execution_contamination'
      || e.code === 'forbidden_key'
      || e.code === 'unknown_field')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
    expect(REQUIRED_HARD_FLAGS.approvedForExecution).toBe(false);
  });

  it('rejects action contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      action: 'BUY',
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'execution_contamination'
      || e.code === 'execution_authority_forbidden'
      || e.code === 'forbidden_key'
      || e.code === 'unknown_field')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects side contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      side: 'BUY',
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'execution_authority_forbidden'
      || e.code === 'unknown_field'
      || e.code === 'forbidden_key')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects votes contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      votes: 5,
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'vote_contamination'
      || e.code === 'forbidden_key')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects majority contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      majority: true,
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'vote_contamination'
      || e.code === 'forbidden_key')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects weightedVote contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      weightedVote: { agentA: 0.6, agentB: 0.4 },
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'vote_contamination'
      || e.code === 'forbidden_key')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects consensus contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      consensus: true,
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'vote_contamination'
      || e.code === 'forbidden_key')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"outcome"\s*:\s*"CLEAR"/);
  });

  it('rejects MoE / ModelAssistedContribution', () => {
    const moe = projectRuntimeSnapshot({
      ...baseInput(),
      MoE: { votes: 3 },
    });
    expect(moe.ok).toBe(false);
    expect(moe.errors.some((e) => e.code === 'legacy_moe_forbidden'
      || e.code === 'forbidden_key')).toBe(true);

    const mac = projectRuntimeSnapshot({
      ...baseInput(),
      ModelAssistedContribution: { text: 'x' },
    });
    expect(mac.ok).toBe(false);
    expect(mac.errors.some((e) => e.code === 'model_assisted_forbidden'
      || e.code === 'forbidden_key')).toBe(true);
  });

  it('rejects providerPayload/credentials/apiKey/prompt/modelResponse', () => {
    for (const key of ['providerPayload', 'credentials', 'apiKey', 'prompt', 'modelResponse']) {
      const result = projectRuntimeSnapshot({
        ...baseInput(),
        [key]: 'secret-or-payload',
      });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'forbidden_key'
        || e.code === 'execution_contamination'
        || e.code === 'forbidden_secret_key')).toBe(true);
    }
  });

  it('does not require workerAcknowledgement for CLEAR', () => {
    const input = baseInput();
    expect(input.runtimeEvidence.workerAcknowledgement).toBeUndefined();
    const result = projectRuntimeSnapshot(input);
    expect(result.ok).toBe(true);
    expect(result.artifact.runtimeGatePreview.outcome).toBe(RUNTIME_GATE_OUTCOME.CLEAR);
  });

  it('rejects Redis/cache contamination', () => {
    const result = projectRuntimeSnapshot({
      ...baseInput(),
      redis: { key: 'x' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'redis_contamination'
      || e.code === 'forbidden_key')).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const input = baseInput();
    const a = projectRuntimeSnapshot(input);
    const b = projectRuntimeSnapshot(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact).toEqual(b.artifact);
  });

  it('keeps zero side effects', () => {
    const result = projectRuntimeSnapshot(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects).toEqual(ZERO_RUNTIME_CAPABILITY_SIDE_EFFECTS);
    for (const [key, value] of Object.entries(result.artifact.sideEffects)) {
      expect(value).toBe(0);
    }
  });

  it('keeps hard execution flags false/zero', () => {
    const result = projectRuntimeSnapshot(baseInput());
    expect(result.ok).toBe(true);
    for (const [key, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(expected);
    }
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.liveTradingEnabled).toBe(false);
    expect(result.artifact.providerConnected).toBe(false);
  });

  it('validateProjectedRuntimeSnapshot accepts CLEAR snapshot and rejects workerAck', () => {
    const projected = projectRuntimeSnapshot(baseInput());
    expect(validateProjectedRuntimeSnapshot(projected.artifact.runtimeSnapshot).ok).toBe(true);
    expect(validateProjectedRuntimeSnapshot({
      ...projected.artifact.runtimeSnapshot,
      workerAcknowledgement: true,
    }).ok).toBe(false);
  });

  it('previewRuntimeGate mirrors CLEAR / BLOCKED matrix', () => {
    expect(previewRuntimeGate(clearEvidence()).outcome).toBe(RUNTIME_GATE_OUTCOME.CLEAR);
    expect(previewRuntimeGate(clearEvidence({ killSwitchActive: true })).outcome)
      .toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(previewRuntimeGate(clearEvidence({ capabilityState: CAPABILITY_STATE.DENIED })).outcome)
      .toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
  });

  it('is compatible with Control Chain buildContractOnlyControlChainArtifact / runtimeGate', () => {
    const projected = projectRuntimeSnapshot(baseInput());
    expect(projected.ok).toBe(true);
    const built = buildContractOnlyControlChainArtifact({
      artemisCognitiveDecision: controlChainBaseDecision(),
      decisionContext: controlChainBaseContext(),
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        contributingAgentRunIds: [RUN_ID],
        orchestrationSetIds: [ORCH_ID],
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      },
      provenance: {
        writer: 'unit_test',
        methodKey: 'stage7_3_2_c5_compat',
        stage: CONTROL_CHAIN_STAGE,
        recordedAt: RECORDED_AT,
        note: 'c5',
      },
      requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
      runtimeSnapshot: projected.artifact.runtimeSnapshot,
      riskEvidenceRef: {
        agentId: 'risk',
        runId: RUN_ID,
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: 'PASS',
        freshness: FRESHNESS_STATUS.FRESH,
        reasonKey: 'risk_pass',
      },
    });
    expect(built.ok).toBe(true);
    expect(built.artifact.runtimeGate.outcome).toBe(RUNTIME_GATE_OUTCOME.CLEAR);
    expect(built.artifact.runtimeGate.authorityClass).toBe(RUNTIME_GATE_AUTHORITY);
    expect(built.artifact.runtimeGate.ssotOwner).toBe(CANONICAL_RUNTIME_SSOT_OWNER);
    expect(built.artifact.controlOutcome).not.toBe(CONTROL_OUTCOME.RUNTIME_BLOCKED);
  });

  it('Control Chain blocks when projected kill-active snapshot is consumed', () => {
    const projected = projectRuntimeSnapshot(baseInput({
      runtimeEvidence: clearEvidence({ killSwitchActive: true }),
    }));
    const built = buildContractOnlyControlChainArtifact({
      artemisCognitiveDecision: controlChainBaseDecision(),
      decisionContext: controlChainBaseContext(),
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        contributingAgentRunIds: [RUN_ID],
        orchestrationSetIds: [ORCH_ID],
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      },
      provenance: {
        writer: 'unit_test',
        methodKey: 'stage7_3_2_c5_compat',
        stage: CONTROL_CHAIN_STAGE,
        recordedAt: RECORDED_AT,
      },
      requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
      runtimeSnapshot: projected.artifact.runtimeSnapshot,
    });
    expect(built.ok).toBe(true);
    expect(built.artifact.runtimeGate.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.RUNTIME_BLOCKED);
  });

  it('C.2 Risk Control Runtime Boundary source remains untouched (import hygiene sibling)', () => {
    expect(C2_SOURCE.includes('7.3.2.c.2')).toBe(true);
    expect(C2_SOURCE.includes('artemisRiskControlRuntimeBoundaryContract')).toBe(true);
  });

  it('import hygiene: no runtimeExecutionStateService I/O and no mutation helpers', () => {
    expect(CONTRACT_SOURCE).not.toMatch(/from ['"].*runtimeExecutionStateService/);
    expect(CONTRACT_SOURCE).not.toMatch(/import\s*\(.*runtimeExecutionStateService/);
    expect(CONTRACT_SOURCE).not.toMatch(/require\(['"].*runtimeExecutionStateService/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bsetGlobalRuntimeMode\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bactivateKillSwitch\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bclearKillSwitch\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/\backnowledgeWorkerState\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/from ['"].*redis/i);
    expect(CONTRACT_SOURCE).not.toMatch(/createPool|node-fetch|axios|openai/i);
    // Identity string is allowed; module I/O import is not.
    expect(CONTRACT_SOURCE).toMatch(/CANONICAL_RUNTIME_SSOT_OWNER = 'runtimeExecutionStateService'/);
  });

  it('validateRuntimeCapabilityInput passes for CLEAR and fails for unknown nested', () => {
    expect(validateRuntimeCapabilityInput(baseInput()).ok).toBe(true);
    expect(validateRuntimeCapabilityInput(baseInput({
      runtimeEvidence: { ...clearEvidence(), extra: 1 },
    })).ok).toBe(false);
  });

  it('allows non-LIVE modes advisory/demo/dry_run/shadow/paper', () => {
    for (const mode of [
      REQUESTED_RUNTIME_MODE.ADVISORY,
      REQUESTED_RUNTIME_MODE.DEMO,
      REQUESTED_RUNTIME_MODE.DRY_RUN,
      REQUESTED_RUNTIME_MODE.SHADOW,
      REQUESTED_RUNTIME_MODE.PAPER,
    ]) {
      const result = projectRuntimeSnapshot(baseInput({
        runtimeEvidence: clearEvidence({
          requestedRuntimeMode: mode,
          effectiveRuntimeMode: mode === REQUESTED_RUNTIME_MODE.LIVE
            ? EFFECTIVE_RUNTIME_MODE.ADVISORY
            : mode,
        }),
      }));
      expect(result.ok).toBe(true);
    }
  });
});
