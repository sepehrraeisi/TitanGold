/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.b — Fail-closed Risk evaluation unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  AVAILABILITY,
  FRESHNESS_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import {
  CONTROL_OUTCOME,
  RISK_GATE_OUTCOME,
} from '../../contracts/artemisControlChainContract.js';
import {
  CANONICAL_OVERALL_RISK_LEVEL,
  RISK_ASSESSMENT_STATUS,
  RISK_EVALUATION_CONTRACT_VERSION,
  RISK_EVALUATION_METHOD_KEY,
  RISK_EVALUATION_POLICY_VERSION,
  RISK_EVALUATION_STAGE,
  RISK_EVALUATION_WRITER,
  ZERO_RISK_EVALUATION_SIDE_EFFECTS,
  evaluateArtemisRiskControl,
  validateRiskEvaluationInput,
} from '../../contracts/artemisRiskControlEvaluationContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRiskControlEvaluationContract.js'),
  'utf8',
);

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';
const SOURCE_EVIDENCE_ID = 'risk-eval-source-1';

function baseInput(overrides = {}) {
  return {
    assessmentStatus: RISK_ASSESSMENT_STATUS.OK,
    overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    accountStateAvailable: true,
    runId: RUN_ID,
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    recordedAt: RECORDED_AT,
    sourceEvidenceId: SOURCE_EVIDENCE_ID,
    sourceContractVersion: 'artemis-evidence-1.0.0',
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      agentId: 'risk',
      runId: RUN_ID,
      sourceEvidenceId: SOURCE_EVIDENCE_ID,
      sourceContractVersion: 'artemis-evidence-1.0.0',
    },
    provenance: {
      writer: 'risk_truthful_source_test',
      methodKey: 'map_risk_persisted_run',
      stage: '3',
      recordedAt: RECORDED_AT,
    },
    ...overrides,
  };
}

describe('artemisRiskControlEvaluationContract — Stage 7.3.2.b', () => {
  it('1 valid PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.controlOutcome).toBeNull();
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
  });

  it('2 valid LIMIT with canonical numeric riskLimit', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
      riskLimit: 2.5,
      unit: 'pct',
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.riskEvidenceRef.limit).toBe(2.5);
    expect(result.artifact.riskGate.limit).toBe(2.5);
  });

  it('3 valid REJECT', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.CRITICAL,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
    expect(result.artifact.riskGate.terminalVeto).toBe(true);
  });

  it('4 missing Risk → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.MISSING,
      overallRiskLevel: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('5 malformed Risk → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.MALFORMED,
      overallRiskLevel: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('6 timeout → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.TIMEOUT,
      overallRiskLevel: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.evaluationNotes).toContain('assessment_timeout');
  });

  it('7 exception → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.EXCEPTION,
      overallRiskLevel: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('8 error assessment → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.ERROR,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('9 stale → cannot PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      freshness: FRESHNESS_STATUS.STALE,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).not.toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('10 expired → cannot PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      freshness: FRESHNESS_STATUS.EXPIRED,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('11 unknown freshness → cannot PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      freshness: FRESHNESS_STATUS.UNKNOWN,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('12 unavailable freshness → cannot PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      freshness: FRESHNESS_STATUS.UNAVAILABLE,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('13 invalid negative LIMIT → fail closed', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
      riskLimit: -1,
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_limit')).toBe(true);
  });

  it('14 non-finite LIMIT → fail closed', () => {
    for (const riskLimit of [NaN, Infinity, -Infinity]) {
      const result = evaluateArtemisRiskControl(baseInput({
        overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
        riskLimit,
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'invalid_limit')).toBe(true);
    }
  });

  it('15 no fabricated LIMIT from min/max/recommended', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
      min: 1,
      max: 10,
      recommended: 5,
      // riskLimit intentionally omitted
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.riskEvidenceRef.limit).toBeUndefined();
    expect(result.artifact.evaluationNotes).toContain('limit_without_canonical_numeric_bound');
  });

  it('16 direction invention rejected', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      direction: 'BUY',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'direction_forbidden' || e.code === 'unknown_field')).toBe(true);
  });

  it('17 execution authority rejected', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      reasonKey: 'BUY',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'execution_authority_forbidden')).toBe(true);
  });

  it('18 Legacy MoE injection rejected', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      legacyMoe: { votes: [{ agent: 'technical', vote: 'buy' }] },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'legacy_moe_forbidden')).toBe(true);
  });

  it('19 risk-gate fail-open leakage rejected', () => {
    const a = evaluateArtemisRiskControl(baseInput({
      riskGateFailOpen: true,
      assessmentStatus: RISK_ASSESSMENT_STATUS.EXCEPTION,
      overallRiskLevel: undefined,
    }));
    expect(a.ok).toBe(false);
    expect(a.errors.some((e) => e.code === 'risk_gate_fail_open_forbidden')).toBe(true);

    const b = evaluateArtemisRiskControl(baseInput({
      riskGateErrorCode: 'RISK_GATE_ERROR_FAIL_OPEN',
      assessmentStatus: RISK_ASSESSMENT_STATUS.ERROR,
      overallRiskLevel: undefined,
    }));
    expect(b.ok).toBe(false);
    expect(b.errors.some((e) => e.code === 'risk_gate_fail_open_forbidden')).toBe(true);
  });

  it('20 risk-agent heuristic fallback cannot become Artemis PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      heuristicFallback: true,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'risk_agent_heuristic_forbidden')).toBe(true);

    const viaSource = evaluateArtemisRiskControl(baseInput({
      riskAgentSource: 'heuristic',
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.VERY_LOW,
    }));
    expect(viaSource.ok).toBe(false);
    expect(viaSource.errors.some((e) => e.code === 'risk_agent_heuristic_forbidden')).toBe(true);
  });

  it('21 kill-switch interaction remains fail-closed', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      killSwitchActive: true,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
    expect(result.artifact.evaluationNotes).toContain('kill_switch_blocks_positive_risk_outcome');
  });

  it('22 lineage preservation', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.lineage.decisionId).toBe(DECISION_ID);
    expect(result.artifact.lineage.decisionContextId).toBe(CONTEXT_ID);
    expect(result.artifact.lineage.evaluationContractVersion).toBe(RISK_EVALUATION_CONTRACT_VERSION);
  });

  it('23 provenance preservation', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.writer).toBe(RISK_EVALUATION_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(RISK_EVALUATION_METHOD_KEY);
    expect(result.artifact.provenance.stage).toBe(RISK_EVALUATION_STAGE);
    expect(result.artifact.provenance.sourceWriter).toBe('risk_truthful_source_test');
    expect(result.artifact.provenance.recordedAt).toBe(RECORDED_AT);
  });

  it('24 deterministic same-input → same-output', () => {
    const input = baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
      riskLimit: 3,
    });
    const a = evaluateArtemisRiskControl(input);
    const b = evaluateArtemisRiskControl(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
  });

  it('25 zero side effects', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects).toEqual(ZERO_RISK_EVALUATION_SIDE_EFFECTS);
    for (const [key, value] of Object.entries(ZERO_RISK_EVALUATION_SIDE_EFFECTS)) {
      expect(result.artifact.sideEffects[key]).toBe(0);
      expect(value).toBe(0);
    }
  });

  it('26 HIGH → REJECT via overallRiskLevel', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.HIGH,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
  });

  it('27 controlOutcome alias PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: undefined,
      controlOutcome: 'pass',
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.PASS);
  });

  it('28 freshness object form accepted', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      freshness: { status: FRESHNESS_STATUS.FRESH },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.freshness).toBe(FRESHNESS_STATUS.FRESH);
  });

  it('29 unavailable data availability cannot PASS', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      availability: AVAILABILITY.UNAVAILABLE,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('30 no risk signal without level/outcome → UNAVAILABLE', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      overallRiskLevel: undefined,
      controlOutcome: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('31 validateRiskEvaluationInput happy path', () => {
    expect(validateRiskEvaluationInput(baseInput()).ok).toBe(true);
  });

  it('32 uses Stage 7.3.2.a projector (no duplicated projection logic)', () => {
    expect(EVAL_SOURCE).toMatch(/projectRiskEvidenceRef/);
    expect(EVAL_SOURCE).toMatch(/from '\.\/artemisRiskControlProjectorContract\.js'/);
    expect(EVAL_SOURCE).not.toMatch(/from ['"].*risk-gate/);
    expect(EVAL_SOURCE).not.toMatch(/from ['"].*risk-agent/);
    expect(EVAL_SOURCE).not.toMatch(/from ['"].*artemisOrchestrator/);
    expect(EVAL_SOURCE).not.toMatch(/from ['"].*orderExecutor/);
    expect(EVAL_SOURCE).not.toMatch(/from ['"].*tradingEngine/);
    expect(EVAL_SOURCE).not.toMatch(/require\(['"].*risk-gate/);
  });

  it('33 authorityClass CONTROL_VETO preserved', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.authorityClass).toBe(AUTHORITY_CLASS.CONTROL_VETO);
    expect(result.artifact.riskGate.authorityClass).toBe(AUTHORITY_CLASS.CONTROL_VETO);
  });

  it('34 policy/version identity frozen', () => {
    const result = evaluateArtemisRiskControl(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.contractVersion).toBe(RISK_EVALUATION_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(RISK_EVALUATION_POLICY_VERSION);
    expect(result.artifact.stage).toBe(RISK_EVALUATION_STAGE);
  });

  it('35 timeout with LOW level still UNAVAILABLE (never PASS)', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      assessmentStatus: RISK_ASSESSMENT_STATUS.TIMEOUT,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('36 kill-switch blocks LIMIT as well', () => {
    const result = evaluateArtemisRiskControl(baseInput({
      killSwitchActive: true,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.MODERATE,
      riskLimit: 1,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
  });
});
