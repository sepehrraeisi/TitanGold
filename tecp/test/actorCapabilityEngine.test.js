import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CAPABILITY_DECISIONS,
  DECISION_PRECEDENCE,
  TECP_ACTOR_TYPES,
  TECP_CAPABILITIES,
  TECP_CAPABILITY_POLICY,
  evaluateCapability,
} from '../src/actorCapabilityEngine.js';
import {
  GOVERNANCE_DECISIONS,
  OPERATION_CLASSES,
  validateGovernance,
} from '../src/governanceValidator.js';
import { parseRule02 } from '../src/rule02Parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const engineSourcePath = join(here, '../src/actorCapabilityEngine.js');
const rule02Path = join(here, '../../.cursor/rules/titangold-current-active-work.mdc');

function allowGovernance() {
  return {
    allowed: true,
    decision: 'ALLOW',
  };
}

function actor(actorType, actorId = actorType.toLowerCase()) {
  return { actorId, actorType };
}

function context(governanceDecision = allowGovernance(), extra = {}) {
  return {
    governanceDecision,
    ...extra,
  };
}

function evaluate(actorType, capability, extra = {}) {
  return evaluateCapability(actor(actorType), capability, context(allowGovernance(), extra));
}

test('decision precedence is documented and stable', () => {
  assert.deepEqual(DECISION_PRECEDENCE, [
    'MISSING_OR_INVALID_CONTEXT',
    'INVALID_ACTOR_OBJECT',
    'UNKNOWN_ACTOR_TYPE',
    'UNKNOWN_CAPABILITY',
    'GOVERNANCE_DENY',
    'AUTHORITY_BOUNDARY',
    'CAPABILITY_NOT_GRANTED',
    'ALLOW',
  ]);
});

test('OWNER + READ_GOVERNANCE + governance allow => ALLOW', () => {
  const result = evaluate('OWNER', 'READ_GOVERNANCE');
  assert.equal(result.allowed, true);
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
  assert.deepEqual(result.matchedPolicy, { actorType: 'OWNER', capability: 'READ_GOVERNANCE' });
});

test('OWNER + APPROVE_MERGE => ALLOW', () => {
  const result = evaluate('OWNER', 'APPROVE_MERGE');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('OWNER + REQUEST_DEPLOY => ALLOW', () => {
  const result = evaluate('OWNER', 'REQUEST_DEPLOY');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('CHATGPT_INTEGRATOR + REQUEST_IMPLEMENTATION => ALLOW', () => {
  const result = evaluate('CHATGPT_INTEGRATOR', 'REQUEST_IMPLEMENTATION');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('CHATGPT_INTEGRATOR + REQUEST_SCOPE_EXPANSION => ALLOW', () => {
  const result = evaluate('CHATGPT_INTEGRATOR', 'REQUEST_SCOPE_EXPANSION');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('CURSOR_WORKER + CLAIM_TASK => ALLOW', () => {
  const result = evaluate('CURSOR_WORKER', 'CLAIM_TASK');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('CURSOR_WORKER + APPROVE_MERGE => DENY_CAPABILITY_NOT_GRANTED', () => {
  const result = evaluate('CURSOR_WORKER', 'APPROVE_MERGE');
  assert.equal(result.allowed, false);
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_CAPABILITY_NOT_GRANTED);
  assert.equal(result.matchedPolicy, null);
});

test('CURSOR_WORKER + REQUEST_DEPLOY => DENY_CAPABILITY_NOT_GRANTED', () => {
  const result = evaluate('CURSOR_WORKER', 'REQUEST_DEPLOY');
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_CAPABILITY_NOT_GRANTED);
});

test('HUMAN_QA + APPROVE_HUMAN_QA => ALLOW', () => {
  const result = evaluate('HUMAN_QA', 'APPROVE_HUMAN_QA');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('HUMAN_QA + APPROVE_MERGE => DENY_CAPABILITY_NOT_GRANTED', () => {
  const result = evaluate('HUMAN_QA', 'APPROVE_MERGE');
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_CAPABILITY_NOT_GRANTED);
});

test('WALRUS + READ_GOVERNANCE => ALLOW', () => {
  const result = evaluate('WALRUS', 'READ_GOVERNANCE');
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('WALRUS + REQUEST_IMPLEMENTATION => DENY_CAPABILITY_NOT_GRANTED', () => {
  const result = evaluate('WALRUS', 'REQUEST_IMPLEMENTATION');
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_CAPABILITY_NOT_GRANTED);
});

test('unknown actor => DENY_UNKNOWN_ACTOR', () => {
  const result = evaluateCapability(
    actor('APPLICATION_ADMIN'),
    'READ_GOVERNANCE',
    context(),
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_UNKNOWN_ACTOR);
  assert.equal(result.allowed, false);
});

test('unknown capability => DENY_UNKNOWN_CAPABILITY', () => {
  const result = evaluate('OWNER', 'APPLICATION_LOGIN');
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_UNKNOWN_CAPABILITY);
});

test('missing governance context => DENY_MISSING_CONTEXT', () => {
  const result = evaluateCapability(actor('OWNER'), 'READ_GOVERNANCE', {});
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT);
});

test('invalid actor object => DENY_MISSING_CONTEXT before unknown actor', () => {
  const result = evaluateCapability(
    { actorType: 'OWNER' },
    'APPROVE_MERGE',
    context(),
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_CONTEXT);
});

test('governance deny => DENY_GOVERNANCE', () => {
  const result = evaluateCapability(
    actor('OWNER'),
    'READ_GOVERNANCE',
    context({ allowed: false, decision: 'DENY_NOT_AUTHORIZED' }),
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_GOVERNANCE);
  assert.equal(result.allowed, false);
});

test('governance deny overrides OWNER capability', () => {
  const result = evaluateCapability(
    actor('OWNER'),
    'APPROVE_MERGE',
    context({ allowed: false, decision: 'DENY_NOT_AUTHORIZED' }),
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_GOVERNANCE);
  assert.equal(result.matchedPolicy, null);
});

test('wrong authority boundary => DENY_AUTHORITY_BOUNDARY', () => {
  const result = evaluate('OWNER', 'READ_GOVERNANCE', {
    authorityBoundary: 'APPLICATION_RBAC',
  });
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_AUTHORITY_BOUNDARY);
});

test('application-auth boundary attempt => DENY_AUTHORITY_BOUNDARY', () => {
  const result = evaluate('OWNER', 'READ_GOVERNANCE', {
    authorityBoundary: 'APPLICATION_AUTH',
  });
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_AUTHORITY_BOUNDARY);
});

test('explicit TECP control-plane boundary allows a granted capability', () => {
  const result = evaluate('OWNER', 'READ_GOVERNANCE', {
    authorityBoundary: 'TECP_CONTROL_PLANE',
  });
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('deterministic repeated evaluation', () => {
  const actorInput = actor('CHATGPT_INTEGRATOR', 'integrator-1');
  const governanceDecision = allowGovernance();
  const input = context(governanceDecision);
  const first = evaluateCapability(actorInput, 'REQUEST_IMPLEMENTATION', input);
  const second = evaluateCapability(actorInput, 'REQUEST_IMPLEMENTATION', input);
  assert.deepEqual(first, second);
});

test('actor not mutated', () => {
  const actorInput = actor('OWNER', 'owner-1');
  const before = structuredClone(actorInput);
  evaluateCapability(actorInput, 'APPROVE_MERGE', context());
  assert.deepEqual(actorInput, before);
});

test('context not mutated', () => {
  const input = context();
  const before = structuredClone(input);
  evaluateCapability(actor('OWNER'), 'READ_GOVERNANCE', input);
  assert.deepEqual(input, before);
});

test('governanceDecision not mutated', () => {
  const governanceDecision = allowGovernance();
  const before = structuredClone(governanceDecision);
  evaluateCapability(actor('OWNER'), 'READ_GOVERNANCE', context(governanceDecision));
  assert.deepEqual(governanceDecision, before);
});

test('policy frozen / not mutable externally', () => {
  assert.equal(Object.isFrozen(TECP_CAPABILITY_POLICY), true);
  assert.equal(Object.isFrozen(TECP_CAPABILITY_POLICY.OWNER), true);
  assert.equal(Object.isFrozen(TECP_ACTOR_TYPES), true);
  assert.equal(Object.isFrozen(TECP_CAPABILITIES), true);
  assert.throws(() => {
    TECP_CAPABILITY_POLICY.OWNER.push('APPLICATION_LOGIN');
  }, TypeError);
  assert.equal(TECP_CAPABILITY_POLICY.CURSOR_WORKER.includes('APPROVE_MERGE'), false);
  assert.equal(TECP_CAPABILITY_POLICY.WALRUS.length, 1);
  assert.equal(TECP_CAPABILITY_POLICY.WALRUS[0], 'READ_GOVERNANCE');
});

test('result structure stable', () => {
  const result = evaluate('OWNER', 'OBSERVE_RUNTIME');
  assert.deepEqual(Object.keys(result), [
    'allowed',
    'decision',
    'reasons',
    'actor',
    'capability',
    'matchedPolicy',
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reasons), true);
  assert.equal(Object.isFrozen(result.actor), true);
  assert.throws(() => {
    result.allowed = false;
  }, TypeError);
});

test('zero side effects', () => {
  const source = readFileSync(engineSourcePath, 'utf8');
  const forbidden = [
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:child_process',
    'process.env',
    'child_process',
    'fetch(',
    'governanceValidator',
    'rule02Parser',
    'backend/',
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token);
  }
  const before = Object.keys(process.env).sort();
  evaluate('CI', 'SUBMIT_EVIDENCE');
  assert.deepEqual(Object.keys(process.env).sort(), before);
});

test('canonical vocabulary is exact', () => {
  assert.deepEqual([...TECP_ACTOR_TYPES], [
    'OWNER',
    'CHATGPT_INTEGRATOR',
    'CURSOR_WORKER',
    'DISCOVERY_WORKER',
    'CI',
    'GITHUB',
    'DEPLOY',
    'RUNTIME_PROBE',
    'HUMAN_QA',
    'CONTROL_PLANE',
    'WALRUS',
  ]);
  assert.deepEqual([...TECP_CAPABILITIES], [
    'READ_GOVERNANCE',
    'REQUEST_IMPLEMENTATION',
    'SUBMIT_EVIDENCE',
    'CLAIM_TASK',
    'RELEASE_TASK',
    'REQUEST_SCOPE_EXPANSION',
    'REQUEST_DEPLOY',
    'APPROVE_HUMAN_QA',
    'APPROVE_MERGE',
    'OBSERVE_RUNTIME',
  ]);
  assert.equal(TECP_CAPABILITY_POLICY.OWNER.includes('APPROVE_MERGE'), true);
  assert.equal(TECP_CAPABILITY_POLICY.OWNER.includes('REQUEST_DEPLOY'), true);
  assert.equal(TECP_CAPABILITY_POLICY.CHATGPT_INTEGRATOR.includes('REQUEST_SCOPE_EXPANSION'), true);
  assert.equal(TECP_CAPABILITY_POLICY.CURSOR_WORKER.includes('REQUEST_SCOPE_EXPANSION'), false);
  assert.equal(TECP_CAPABILITY_POLICY.HUMAN_QA.includes('APPROVE_HUMAN_QA'), true);
  assert.equal(TECP_CAPABILITY_POLICY.GITHUB.includes('OBSERVE_RUNTIME'), false);
});

test('canonical Rule02 allow flows through governance into REQUEST_IMPLEMENTATION', () => {
  const text = readFileSync(rule02Path, 'utf8');
  const parsed = parseRule02(text);
  const sliceFromTecp = parsed.tecp?.TECP_AUTHORIZED_SLICE;
  const facts = parsed.governanceFacts;
  const request = {
    sliceId: sliceFromTecp,
    authorityClass: facts.authorityClass,
    riskTier: facts.riskTier,
    requestedPaths: [...facts.authorizedFileScope],
    operationClass: OPERATION_CLASSES.IMPLEMENT,
    requiresDeploy: false,
    requiresProductionMutation: false,
  };
  const governance = validateGovernance(parsed, request);
  assert.equal(governance.allowed, true);
  assert.equal(governance.decision, GOVERNANCE_DECISIONS.ALLOW);
  assert.equal(sliceFromTecp, 'TECP-007-ACTOR-CAPABILITY-ENGINE');

  const actorInput = actor('CHATGPT_INTEGRATOR', 'chatgpt-integrator');
  const capabilityContext = context(governance, { authorityBoundary: 'TECP_CONTROL_PLANE' });
  const actorBefore = structuredClone(actorInput);
  const governanceBefore = structuredClone(governance);
  const contextBefore = structuredClone(capabilityContext);

  const result = evaluateCapability(actorInput, 'REQUEST_IMPLEMENTATION', capabilityContext);
  assert.equal(result.allowed, true);
  assert.equal(result.decision, CAPABILITY_DECISIONS.ALLOW);
  assert.equal(result.capability, 'REQUEST_IMPLEMENTATION');
  assert.deepEqual(result.actor, { actorId: 'chatgpt-integrator', actorType: 'CHATGPT_INTEGRATOR' });
  assert.deepEqual(actorInput, actorBefore);
  assert.deepEqual(governance, governanceBefore);
  assert.deepEqual(capabilityContext, contextBefore);
});

test('canonical governance deny remains DENY_GOVERNANCE for a capable actor', () => {
  const text = readFileSync(rule02Path, 'utf8');
  const parsed = parseRule02(text);
  const facts = parsed.governanceFacts;
  const request = {
    sliceId: parsed.tecp.TECP_AUTHORIZED_SLICE,
    authorityClass: facts.authorityClass,
    riskTier: facts.riskTier,
    requestedPaths: [...facts.authorizedFileScope],
    operationClass: OPERATION_CLASSES.IMPLEMENT,
    requiresDeploy: true,
    requiresProductionMutation: false,
  };
  const governance = validateGovernance(parsed, request);
  assert.equal(governance.allowed, false);
  assert.notEqual(governance.decision, GOVERNANCE_DECISIONS.ALLOW);

  const result = evaluateCapability(
    actor('OWNER', 'owner-1'),
    'APPROVE_MERGE',
    context(governance),
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_GOVERNANCE);
  assert.equal(result.allowed, false);
});
