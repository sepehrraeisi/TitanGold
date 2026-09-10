/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.a — Risk control projector unit tests.
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
  RISK_PROJECTOR_CONTRACT_VERSION,
  RISK_PROJECTOR_METHOD_KEY,
  RISK_PROJECTOR_POLICY_VERSION,
  RISK_PROJECTOR_STAGE,
  RISK_PROJECTOR_WRITER,
  ZERO_RISK_PROJECTOR_SIDE_EFFECTS,
  projectRiskEvidenceRef,
  validateProjectedRiskEvidenceRef,
  validateRiskProjectorInput,
} from '../../contracts/artemisRiskControlProjectorContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTOR_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRiskControlProjectorContract.js'),
  'utf8',
);

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';
const SOURCE_EVIDENCE_ID = 'risk-evidence-source-1';

function baseEvidence(overrides = {}) {
  return {
    agentId: 'risk',
    runId: RUN_ID,
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome: 'pass',
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'risk_level_pass',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    riskEvidence: baseEvidence(),
    recordedAt: RECORDED_AT,
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
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
      writer: 'risk_adapter_test',
      methodKey: 'map_risk_persisted_run',
      stage: '3',
      recordedAt: RECORDED_AT,
    },
    ...overrides,
  };
}

describe('artemisRiskControlProjectorContract — Stage 7.3.2.a', () => {
  it('1 PASS → PASS', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ outcome: 'PASS' }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.controlOutcome).toBeNull();
  });

  it('2 LIMIT → LIMIT', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'LIMIT',
        limit: 2.5,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.riskEvidenceRef.limit).toBe(2.5);
  });

  it('3 REJECT → REJECT', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'REJECT',
        reasonKey: 'risk_level_blocks',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
  });

  it('4 UNAVAILABLE → UNAVAILABLE', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'UNAVAILABLE',
        freshness: FRESHNESS_STATUS.UNKNOWN,
        availability: AVAILABILITY.UNAVAILABLE,
        reasonKey: 'risk_control_unavailable',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('5 NOT_APPLICABLE', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'NOT_APPLICABLE',
        availability: AVAILABILITY.NOT_APPLICABLE,
        reasonKey: 'risk_not_applicable',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.NOT_APPLICABLE);
  });

  it('6 lowercase normalization', () => {
    for (const [raw, expected] of [
      ['pass', RISK_GATE_OUTCOME.PASS],
      ['limit', RISK_GATE_OUTCOME.LIMIT],
      ['reject', RISK_GATE_OUTCOME.REJECT],
      ['unavailable', RISK_GATE_OUTCOME.UNAVAILABLE],
      ['not_applicable', RISK_GATE_OUTCOME.NOT_APPLICABLE],
    ]) {
      const result = projectRiskEvidenceRef(baseInput({
        riskEvidence: baseEvidence({
          outcome: raw,
          ...(raw === 'limit' ? { limit: 1 } : {}),
          ...(raw === 'unavailable'
            ? { freshness: FRESHNESS_STATUS.UNKNOWN, availability: AVAILABILITY.UNAVAILABLE }
            : {}),
        }),
      }));
      expect(result.ok).toBe(true);
      expect(result.artifact.riskEvidenceRef.outcome).toBe(expected);
    }
  });

  it('7 unknown outcome rejection', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ outcome: 'maybe' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_outcome')).toBe(true);
  });

  it('8 stale PASS cannot pass', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'pass',
        freshness: FRESHNESS_STATUS.STALE,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.riskEvidenceRef.reasonKey).toBe('stale_risk_cannot_pass');
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('9 expired PASS cannot pass', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'PASS',
        freshness: FRESHNESS_STATUS.EXPIRED,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('10 unknown freshness cannot pass', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'pass',
        freshness: FRESHNESS_STATUS.UNKNOWN,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
  });

  it('11 malformed Risk envelope', () => {
    const missingFreshness = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ freshness: undefined }),
    }));
    // Spreading undefined still leaves key absent when we delete it:
    const withoutFreshness = baseEvidence();
    delete withoutFreshness.freshness;
    const result = projectRiskEvidenceRef(baseInput({ riskEvidence: withoutFreshness }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_freshness')).toBe(true);

    const malformed = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ freshness: { status: 'fresh', ageMs: 1 } }),
    }));
    expect(malformed.ok).toBe(false);
    expect(malformed.errors.some((e) => e.code === 'malformed_freshness')).toBe(true);

    expect(missingFreshness.ok).toBe(false);
  });

  it('12 LIMIT with valid numeric limit', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'limit',
        limit: 0,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.limit).toBe(0);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
  });

  it('13 LIMIT without numeric limit', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'limit',
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.riskEvidenceRef.limit).toBeUndefined();
    expect(result.artifact.riskEvidenceRef.reasonKey).toBe('risk_limit_without_numeric_bound');
    expect(result.artifact.projectionNotes).toContain('limit_without_numeric_bound');
  });

  it('14 no fabricated limit', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'limit',
        max: 9,
        recommended: 3,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.limit).toBeUndefined();
    expect(result.artifact.riskEvidenceRef.max).toBe(9);
    expect(result.artifact.riskEvidenceRef.recommended).toBe(3);
  });

  it('15 forbidden direction key', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: {
        ...baseEvidence(),
        direction: 'LONG',
      },
    }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'direction_forbidden' || e.code === 'unknown_field'),
    ).toBe(true);
  });

  it('16 BUY/SELL/EXECUTE rejection', () => {
    const asOutcome = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ outcome: 'BUY' }),
    }));
    expect(asOutcome.ok).toBe(false);

    const asValue = validateRiskProjectorInput(baseInput({
      riskEvidence: baseEvidence({ reasonKey: 'BUY' }),
    }));
    expect(asValue.ok).toBe(false);
    expect(asValue.errors.some((e) => e.code === 'execution_authority_forbidden')).toBe(true);

    const sellField = validateRiskProjectorInput({
      ...baseInput(),
      riskEvidence: baseEvidence(),
      // inject forbidden key at top via spread after allowlist — use nested note? 
    });
    // Explicit forbidden key on input top:
    const withExecute = validateRiskProjectorInput({
      riskEvidence: baseEvidence(),
      recordedAt: RECORDED_AT,
      executionIntent: { side: 'SELL' },
    });
    expect(withExecute.ok).toBe(false);
    expect(
      withExecute.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field'),
    ).toBe(true);
    expect(sellField.ok).toBe(true);
  });

  it('17 execution authority rejection', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ reasonKey: 'EXECUTE' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'execution_authority_forbidden')).toBe(true);
  });

  it('18 legacy MoE input rejection', () => {
    const result = validateRiskProjectorInput({
      riskEvidence: baseEvidence(),
      recordedAt: RECORDED_AT,
      votes: [{ agent: 'technical', vote: 'BUY' }],
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'legacy_moe_forbidden' || e.code === 'unknown_field'),
    ).toBe(true);
  });

  it('19 lineage preservation', () => {
    const result = projectRiskEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.lineage.decisionId).toBe(DECISION_ID);
    expect(result.artifact.lineage.decisionContextId).toBe(CONTEXT_ID);
    expect(result.artifact.lineage.agentId).toBe('risk');
    expect(result.artifact.lineage.runId).toBe(RUN_ID);
    expect(result.artifact.lineage.sourceEvidenceId).toBe(SOURCE_EVIDENCE_ID);
    expect(result.artifact.lineage.sourceContractVersion).toBe('artemis-evidence-1.0.0');
    expect(result.artifact.lineage.projectorContractVersion).toBe(RISK_PROJECTOR_CONTRACT_VERSION);
    expect(result.artifact.lineage.policyVersion).toBe(RISK_PROJECTOR_POLICY_VERSION);
  });

  it('20 provenance preservation', () => {
    const result = projectRiskEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.writer).toBe(RISK_PROJECTOR_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(RISK_PROJECTOR_METHOD_KEY);
    expect(result.artifact.provenance.stage).toBe(RISK_PROJECTOR_STAGE);
    expect(result.artifact.provenance.recordedAt).toBe(RECORDED_AT);
    expect(result.artifact.provenance.sourceWriter).toBe('risk_adapter_test');
    expect(result.artifact.provenance.sourceMethodKey).toBe('map_risk_persisted_run');
  });

  it('21 deterministic identical input/output', () => {
    const input = baseInput({
      riskEvidence: baseEvidence({ outcome: 'reject', reasonKey: 'risk_level_blocks' }),
    });
    const a = projectRiskEvidenceRef(input);
    const b = projectRiskEvidenceRef(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('22 side-effect ledger remains zero', () => {
    const result = projectRiskEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects).toEqual(ZERO_RISK_PROJECTOR_SIDE_EFFECTS);
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    for (const value of Object.values(result.artifact.sideEffects)) {
      expect(value).toBe(0);
    }
  });

  it('adapter-shaped freshness { status } normalizes', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'pass',
        freshness: { status: FRESHNESS_STATUS.FRESH },
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.freshness).toBe(FRESHNESS_STATUS.FRESH);
  });

  it('availability fail-closed blocks PASS', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({
        outcome: 'pass',
        availability: AVAILABILITY.UNAVAILABLE,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskEvidenceRef.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('projected ref validates against projector validator', () => {
    const result = projectRiskEvidenceRef(baseInput({
      riskEvidence: baseEvidence({ outcome: 'reject', reasonKey: 'risk_level_blocks' }),
    }));
    expect(result.ok).toBe(true);
    expect(validateProjectedRiskEvidenceRef(result.artifact.riskEvidenceRef).ok).toBe(true);
  });

  it('static dependency: no forbidden imports', () => {
    const fromSpecs = [...PROJECTOR_SOURCE.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
      .map((match) => match[1]);
    const forbiddenSubstrings = [
      'risk-gate',
      'risk-agent',
      'agents/risk',
      'artemisOrchestrator',
      'routes/artemis',
      'tradingEngine',
      'orderExecutor',
      'node-fetch',
      'openai',
      'axios',
      'ioredis',
      'node:http',
      'node:https',
      'node:net',
      'node:dns',
    ];
    for (const spec of fromSpecs) {
      expect(['pg', 'redis', 'http', 'https', 'net', 'dns'].includes(spec)).toBe(false);
      for (const token of forbiddenSubstrings) {
        expect(spec.includes(token)).toBe(false);
      }
    }
    expect(fromSpecs).toContain('./artemisControlChainContract.js');
    expect(fromSpecs).toContain('./artemisEvidenceContract.js');
    expect(fromSpecs).toHaveLength(2);
  });
});
