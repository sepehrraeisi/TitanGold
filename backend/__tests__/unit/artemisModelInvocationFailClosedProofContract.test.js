/**
 * @jest-environment node
 */
/**
 * Stage 7.2.b.3.c.4 — Fail-closed validation proofs for model invocation chain.
 * Proof-only tests: no provider, no LLM SDK, no network, no credentials.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FAIL_CLOSED_PROOF_STAGE,
  FAIL_CLOSED_PROOF_SCHEMA_VERSION,
  FAIL_CLOSED_PROOF_CONTRACT_VERSION,
  FAIL_CLOSED_PROOF_POLICY_VERSION,
  FAIL_CLOSED_PROOF_WRITER,
  FAIL_CLOSED_SCENARIO,
  FAIL_CLOSED_PROOF_LIMITATIONS,
  ZERO_FAIL_CLOSED_SIDE_EFFECTS,
  REQUIRED_AUTHORITY_FLAGS,
  assertAuthorityInvariants,
  validateInvocationChainLayers,
  normalizeFailClosedScenarioFailure,
  runFailClosedProofScenario,
  runAllFailClosedProofScenarios,
  validateFailClosedProofResult,
} from '../../contracts/artemisModelInvocationFailClosedProofContract.js';

import {
  MODEL_INVOCATION_STATUS,
  buildContractOnlyModelInvocationRequest,
  buildContractOnlyModelInvocationResponse,
} from '../../contracts/artemisModelInvocationContract.js';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_UNCERTAINTY_STATE,
} from '../../contracts/artemisCognitiveEngineInterfaceContract.js';
import { planContractOnlyGatewayInvocation } from '../../contracts/artemisModelInvocationGatewayContract.js';
import {
  buildContractOnlyProviderAdapterResponse,
  mapContractOnlyProviderAdapterRequest,
} from '../../contracts/artemisProviderAdapterBoundaryContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(
  __dirname,
  '../../contracts/artemisModelInvocationFailClosedProofContract.js',
);

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const GATEWAY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ADAPTER_REQUEST_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = '2026-09-04T02:00:00.000Z';

const REQUIRED_SCENARIOS = Object.freeze([
  FAIL_CLOSED_SCENARIO.PROVIDER_UNAVAILABLE,
  FAIL_CLOSED_SCENARIO.TIMEOUT,
  FAIL_CLOSED_SCENARIO.INVALID_PROVIDER_RESPONSE,
  FAIL_CLOSED_SCENARIO.SCHEMA_MISMATCH,
  FAIL_CLOSED_SCENARIO.SECRET_LEAKAGE_ATTEMPT,
  FAIL_CLOSED_SCENARIO.PROMPT_INJECTION_ATTEMPT,
  FAIL_CLOSED_SCENARIO.AUTHORITY_ESCALATION_ATTEMPT,
]);

function analysisReference() {
  return {
    decisionContextId: CONTEXT_ID,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    analysisGeneratedAt: NOW,
  };
}

function validGatewayPlan() {
  const planned = planContractOnlyGatewayInvocation({
    gatewayId: GATEWAY_ID,
    invocationRequest: buildContractOnlyModelInvocationRequest({
      invocationId: INVOCATION_ID,
      decisionContextId: CONTEXT_ID,
      cognitiveAnalysisReference: analysisReference(),
      generatedAt: NOW,
    }),
    timeoutPolicy: {
      timeoutMs: 15000,
      softTimeoutMs: 10000,
      hardFailOnTimeout: true,
      note: 'test_timeout',
    },
    budgetPolicy: {
      maxUtf8Bytes: 24 * 1024,
      maxTokens: 4096,
      maxCostUnits: 0,
      hardFailOnExhaustion: true,
      note: 'test_budget',
    },
    retryPolicy: {
      maxAttempts: 0,
      backoffMs: 0,
      retryOnTimeout: false,
      retryOnUnavailable: false,
      retryOnInvalidSchema: false,
      note: 'test_retry',
    },
    generatedAt: NOW,
  });
  return planned.plan;
}

describe('artemisModelInvocationFailClosedProofContract — Stage 7.2.b.3.c.4', () => {
  describe('contract identity', () => {
    it('uses frozen Stage 7.2.b.3.c.4 identity constants', () => {
      expect(FAIL_CLOSED_PROOF_STAGE).toBe('7.2.b.3.c.4');
      expect(FAIL_CLOSED_PROOF_SCHEMA_VERSION).toBe('1.0.0');
      expect(FAIL_CLOSED_PROOF_CONTRACT_VERSION).toBe(
        'artemis-model-invocation-fail-closed-proof-1.0.0',
      );
      expect(FAIL_CLOSED_PROOF_POLICY_VERSION).toBe('stage7-2b3c4-fail-closed-validation-1.0.0');
      expect(FAIL_CLOSED_PROOF_WRITER).toBe('artemisModelInvocationFailClosedProofContract');
      expect(Object.isFrozen(REQUIRED_AUTHORITY_FLAGS)).toBe(true);
      expect(REQUIRED_AUTHORITY_FLAGS).toEqual({
        advisoryOnly: true,
        authoritative: false,
        decisionEligible: false,
        executionEligible: false,
        approvedForExecution: false,
      });
      expect(FAIL_CLOSED_PROOF_LIMITATIONS).toContain('validation_hardening_only');
      expect(FAIL_CLOSED_PROOF_LIMITATIONS).toContain('cannot_approve_execution');
    });

    it('enumerates exactly the seven required fail-closed scenarios', () => {
      expect(Object.values(FAIL_CLOSED_SCENARIO)).toEqual([
        'provider_unavailable',
        'timeout',
        'invalid_provider_response',
        'schema_mismatch',
        'secret_leakage_attempt',
        'prompt_injection_attempt',
        'authority_escalation_attempt',
      ]);
      expect(REQUIRED_SCENARIOS).toHaveLength(7);
    });
  });

  describe('assertAuthorityInvariants', () => {
    it('passes for hard-false authority flags', () => {
      const result = assertAuthorityInvariants({
        advisoryOnly: true,
        authoritative: false,
        decisionEligible: false,
        executionEligible: false,
        approvedForExecution: false,
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('fails closed when executionEligible is true', () => {
      const result = assertAuthorityInvariants({
        advisoryOnly: true,
        authoritative: false,
        decisionEligible: false,
        executionEligible: true,
        approvedForExecution: false,
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('authority_invariant_violation');
      expect(result.errors.some((e) => e.field.includes('executionEligible'))).toBe(true);
    });

    it('fails closed when advisoryOnly is false', () => {
      const result = assertAuthorityInvariants({
        advisoryOnly: false,
        authoritative: false,
        decisionEligible: false,
        executionEligible: false,
        approvedForExecution: false,
      });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field.includes('advisoryOnly'))).toBe(true);
    });

    it('rejects forbidden execution keys', () => {
      const result = assertAuthorityInvariants({
        advisoryOnly: true,
        authoritative: false,
        decisionEligible: false,
        executionEligible: false,
        approvedForExecution: false,
        executionIntent: { side: 'buy' },
      });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'forbidden_key')).toBe(true);
    });
  });

  describe('validateInvocationChainLayers', () => {
    it('accepts valid contract-only chain layers and preserves authority', () => {
      const plan = validGatewayPlan();
      const mapped = mapContractOnlyProviderAdapterRequest({
        adapterRequestId: ADAPTER_REQUEST_ID,
        gatewayPlan: plan,
        generatedAt: NOW,
      });
      expect(mapped.ok).toBe(true);

      const response = buildContractOnlyModelInvocationResponse({
        invocationId: INVOCATION_ID,
        status: MODEL_INVOCATION_STATUS.UNAVAILABLE,
        generatedAt: NOW,
      });

      const result = validateInvocationChainLayers({
        invocationRequest: buildContractOnlyModelInvocationRequest({
          invocationId: INVOCATION_ID,
          decisionContextId: CONTEXT_ID,
          cognitiveAnalysisReference: analysisReference(),
          generatedAt: NOW,
        }),
        gatewayPlan: plan,
        adapterRequest: mapped.request,
        adapterResponse: mapped.response,
        invocationResponse: response,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.layers.length).toBeGreaterThan(0);
      expect(result.layers.every((layer) => layer.ok === true
        || layer.layer === 'invocation_request_authority')).toBe(true);
    });

    it('fails closed on authority escalation in adapter response', () => {
      const base = buildContractOnlyProviderAdapterResponse({
        adapterRequestId: ADAPTER_REQUEST_ID,
        gatewayId: GATEWAY_ID,
        invocationId: INVOCATION_ID,
        decisionContextId: CONTEXT_ID,
        generatedAt: NOW,
      });
      const escalated = {
        ...base,
        authoritative: true,
        decisionEligible: true,
        executionEligible: true,
        approvedForExecution: true,
        advisoryOnly: false,
      };
      const result = validateInvocationChainLayers({ adapterResponse: escalated });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('normalizeFailClosedScenarioFailure', () => {
    it('normalizes each scenario with hard-false authority', () => {
      for (const scenario of REQUIRED_SCENARIOS) {
        const normalized = normalizeFailClosedScenarioFailure(scenario);
        expect(normalized.ok).toBe(true);
        expect(normalized.scenario).toBe(scenario);
        expect(normalized.advisoryOnly).toBe(true);
        expect(normalized.authoritative).toBe(false);
        expect(normalized.decisionEligible).toBe(false);
        expect(normalized.executionEligible).toBe(false);
        expect(normalized.approvedForExecution).toBe(false);
        expect(Object.values(MODEL_INVOCATION_STATUS)).toContain(normalized.normalizedStatus);
      }
    });

    it('maps timeout to TIMEOUT and schema mismatch to INVALID_SCHEMA', () => {
      const timeout = normalizeFailClosedScenarioFailure(FAIL_CLOSED_SCENARIO.TIMEOUT);
      expect(timeout.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.TIMEOUT);

      const schema = normalizeFailClosedScenarioFailure(FAIL_CLOSED_SCENARIO.SCHEMA_MISMATCH);
      expect(schema.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.INVALID_SCHEMA);

      const injection = normalizeFailClosedScenarioFailure(
        FAIL_CLOSED_SCENARIO.PROMPT_INJECTION_ATTEMPT,
      );
      expect(injection.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.REFUSAL);
    });

    it('rejects unknown scenario codes', () => {
      const normalized = normalizeFailClosedScenarioFailure('not_a_scenario');
      expect(normalized.ok).toBe(false);
      expect(normalized.code).toBe('invalid_scenario');
    });
  });

  describe('runFailClosedProofScenario — seven required proofs', () => {
    it('1. provider_unavailable fails closed with UNAVAILABLE status', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.PROVIDER_UNAVAILABLE);
      expect(run.ok).toBe(true);
      expect(run.code).toBe('FAIL_CLOSED_PROOF_PASSED');
      expect(run.proof.scenario).toBe('provider_unavailable');
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.UNAVAILABLE);
      expect(run.proof.advisoryOnly).toBe(true);
      expect(run.proof.executionEligible).toBe(false);
      expect(run.proof.approvedForExecution).toBe(false);
      expect(run.proof.decisionEligible).toBe(false);
      expect(run.proof.authoritative).toBe(false);
      expect(run.proof.providerConnected).toBe(false);
      expect(run.proof.transportArmed).toBe(false);
      expect(run.proof.sideEffects).toEqual(ZERO_FAIL_CLOSED_SIDE_EFFECTS);
      expect(validateFailClosedProofResult(run.proof).ok).toBe(true);
    });

    it('2. timeout fails closed with TIMEOUT status', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.TIMEOUT);
      expect(run.proof.sideEffects.llmCallCount).toBe(0);
      expect(run.proof.sideEffects.networkRequestCount).toBe(0);
      expect(run.proof.executionEligible).toBe(false);
      expect(run.proof.approvedForExecution).toBe(false);
    });

    it('3. invalid_provider_response rejects invalid response and fails closed', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.INVALID_PROVIDER_RESPONSE);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.findings.some((f) => f.id === 'invalid_provider_response_rejected')).toBe(true);
      expect(run.proof.executionEligible).toBe(false);
      expect(run.proof.sideEffects).toEqual(ZERO_FAIL_CLOSED_SIDE_EFFECTS);
    });

    it('4. schema_mismatch fails closed with INVALID_SCHEMA status', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.SCHEMA_MISMATCH);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.INVALID_SCHEMA);
      expect(run.proof.findings.some((f) => f.id === 'schema_mismatch_rejected')).toBe(true);
      expect(run.proof).toMatchObject(REQUIRED_AUTHORITY_FLAGS);
    });

    it('5. secret_leakage_attempt rejects secrets and fails closed', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.SECRET_LEAKAGE_ATTEMPT);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.findings.some((f) => f.id === 'secret_leakage_rejected')).toBe(true);
      expect(run.proof.approvedForExecution).toBe(false);
      expect(run.proof.sideEffects.providerRequestCount).toBe(0);
      expect(run.proof.sideEffects.llmCallCount).toBe(0);
    });

    it('6. prompt_injection_attempt rejects injection and fails closed', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.PROMPT_INJECTION_ATTEMPT);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.REFUSAL);
      expect(run.proof.findings.some((f) => f.id === 'prompt_injection_contained')).toBe(true);
      expect(run.proof.decisionEligible).toBe(false);
      expect(run.proof.sideEffects).toEqual(ZERO_FAIL_CLOSED_SIDE_EFFECTS);
    });

    it('7. authority_escalation_attempt preserves authority and fails closed', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.AUTHORITY_ESCALATION_ATTEMPT);
      expect(run.ok).toBe(true);
      expect(run.proof.scenarioPassed).toBe(true);
      expect(run.proof.failClosed).toBe(true);
      expect(run.proof.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.REFUSAL);
      expect(run.proof).toMatchObject(REQUIRED_AUTHORITY_FLAGS);
      expect(run.proof.findings.some((f) => f.id === 'authority_escalation_rejected')).toBe(true);
      expect(run.proof.sideEffects).toEqual(ZERO_FAIL_CLOSED_SIDE_EFFECTS);
    });
  });

  describe('runAllFailClosedProofScenarios', () => {
    it('runs all seven scenarios with all proofs passed and zero side effects', () => {
      const suite = runAllFailClosedProofScenarios();
      expect(suite.ok).toBe(true);
      expect(suite.code).toBe('ALL_FAIL_CLOSED_PROOFS_PASSED');
      expect(suite.contractVersion).toBe(FAIL_CLOSED_PROOF_CONTRACT_VERSION);
      expect(Object.keys(suite.scenarios)).toHaveLength(7);

      for (const scenario of REQUIRED_SCENARIOS) {
        const entry = suite.scenarios[scenario];
        expect(entry.ok).toBe(true);
        expect(entry.scenarioPassed).toBe(true);
        expect(entry.failClosed).toBe(true);
      }

      expect(suite).toMatchObject(REQUIRED_AUTHORITY_FLAGS);
      expect(suite.transportArmed).toBe(false);
      expect(suite.providerConnected).toBe(false);
      expect(suite.sideEffects).toEqual(ZERO_FAIL_CLOSED_SIDE_EFFECTS);
      expect(suite.sideEffects.llmCallCount).toBe(0);
      expect(suite.sideEffects.networkRequestCount).toBe(0);
      expect(suite.sideEffects.providerRequestCount).toBe(0);
      expect(suite.sideEffects.orderOperationCount).toBe(0);
      expect(suite.sideEffects.financialExecutionCount).toBe(0);
      expect(suite.sideEffects.dbWriteCount).toBe(0);
      expect(suite.sideEffects.redisWriteCount).toBe(0);
      expect(suite.sideEffects.agentExecutionCount).toBe(0);
    });

    it('is deterministic across repeated runs', () => {
      const fixtures = {
        generatedAt: NOW,
        decisionContextId: CONTEXT_ID,
        invocationId: INVOCATION_ID,
        gatewayId: GATEWAY_ID,
        adapterRequestId: ADAPTER_REQUEST_ID,
        proofId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      };
      const a = runAllFailClosedProofScenarios(fixtures);
      const b = runAllFailClosedProofScenarios(fixtures);
      expect(a.ok).toBe(b.ok);
      expect(Object.keys(a.scenarios).sort()).toEqual(Object.keys(b.scenarios).sort());
      for (const scenario of REQUIRED_SCENARIOS) {
        expect(a.scenarios[scenario].scenarioPassed).toBe(b.scenarios[scenario].scenarioPassed);
        expect(a.scenarios[scenario].failClosed).toBe(b.scenarios[scenario].failClosed);
        expect(a.scenarios[scenario].normalizedStatus).toBe(b.scenarios[scenario].normalizedStatus);
      }
      expect(JSON.stringify(a.sideEffects)).toBe(JSON.stringify(b.sideEffects));
    });
  });

  describe('validateFailClosedProofResult', () => {
    it('accepts a valid scenario proof result', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      const validated = validateFailClosedProofResult(run.proof);
      expect(validated.ok).toBe(true);
      expect(validated.errors).toEqual([]);
      expect(validated.code).toBe('FAIL_CLOSED_PROOF_VALID');
    });

    it('rejects authority escalation in proof results', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      const forged = {
        ...run.proof,
        executionEligible: true,
      };
      const validated = validateFailClosedProofResult(forged);
      expect(validated.ok).toBe(false);
      expect(validated.errors.some((e) => e.field === 'executionEligible')).toBe(true);
    });

    it('rejects non-zero side effects in proof results', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      const forged = {
        ...run.proof,
        sideEffects: {
          ...run.proof.sideEffects,
          networkRequestCount: 1,
        },
      };
      const validated = validateFailClosedProofResult(forged);
      expect(validated.ok).toBe(false);
      expect(validated.errors.some((e) => e.code === 'must_be_zero')).toBe(true);
    });

    it('rejects unknown / forbidden top-level fields', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      const forged = {
        ...run.proof,
        orderIntent: { side: 'buy' },
      };
      const validated = validateFailClosedProofResult(forged);
      expect(validated.ok).toBe(false);
      expect(validated.errors.some((e) => e.code === 'unknown_field')).toBe(true);
    });

    it('rejects secret-bearing fields in proof payload', () => {
      const run = runFailClosedProofScenario(FAIL_CLOSED_SCENARIO.TIMEOUT);
      const forged = {
        ...run.proof,
        apiKey: 'sk-must-reject',
      };
      const validated = validateFailClosedProofResult(forged);
      expect(validated.ok).toBe(false);
    });
  });

  describe('security invariants — provider output cannot escalate', () => {
    it('never marks provider/model output as execution-authorizing', () => {
      const suite = runAllFailClosedProofScenarios();
      expect(suite.advisoryOnly).toBe(true);
      expect(suite.authoritative).toBe(false);
      expect(suite.executionEligible).toBe(false);
      expect(suite.approvedForExecution).toBe(false);
      expect(suite.decisionEligible).toBe(false);
      for (const scenario of REQUIRED_SCENARIOS) {
        const run = runFailClosedProofScenario(scenario);
        expect(run.proof.advisoryOnly).toBe(true);
        expect(run.proof.authoritative).toBe(false);
        expect(run.proof.executionEligible).toBe(false);
        expect(run.proof.approvedForExecution).toBe(false);
        expect(run.proof.decisionEligible).toBe(false);
        expect(run.proof.cognitiveEngineStarted).toBe(false);
        expect(run.proof.transportArmed).toBe(false);
        expect(run.proof.providerConnected).toBe(false);
      }
    });
  });

  describe('source hygiene — no provider/network/SDK wiring', () => {
    it('contract source does not import LLM SDKs or enable transport', () => {
      const source = fs.readFileSync(CONTRACT_PATH, 'utf8');
      expect(source).not.toMatch(/openai|anthropic|@google\/generative-ai|ollama|langchain/i);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toMatch(/createTransport|enableTransport|connectProvider/i);
      expect(source).toMatch(/ZERO_FAIL_CLOSED_SIDE_EFFECTS/);
      expect(source).toMatch(/failClosed/);
      expect(source).toMatch(/no_llm_provider_calls/);
    });
  });
});
