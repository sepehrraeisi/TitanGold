import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GOVERNANCE_DECISIONS,
  OPERATION_CLASSES,
  validateGovernance,
} from '../src/governanceValidator.js';
import { parseRule02 } from '../src/rule02Parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const validatorSourcePath = join(here, '../src/governanceValidator.js');
const rule02Path = join(here, '../../.cursor/rules/titangold-current-active-work.mdc');

const EFFECTIVE = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
const SLICE = 'TECP-006-GOVERNANCE-VALIDATOR';
const AUTHORITY = 'ENGINEERING_CONTROL_PLANE';
const RISK = 'Tier 2';
const VALIDATOR_PATH = 'tecp/src/governanceValidator.js';
const VALIDATOR_TEST_PATH = 'tecp/test/governanceValidator.test.js';

const AUTHORIZED = Object.freeze([VALIDATOR_PATH, VALIDATOR_TEST_PATH]);
const PROTECTED = Object.freeze([
  '.cursor/rules/titangold-current-active-work.mdc',
  'backend/**',
  'tecp/src/rule02Parser.js',
  'tecp/test/fixtures/',
  '/home/ubuntu/webapp/TitanGold',
]);
const STOPS = Object.freeze([
  'RAW_RULE02_PARSE',
  'PARSER_SOURCE_MUTATION',
  'PACKAGE_CHANGE',
  'DB',
  'NETWORK',
  'GITHUB',
  'LINEAR',
  'DEPLOY',
  'PRODUCTION_MUTATION',
]);

function baseParsed(overrides = {}) {
  const parsed = {
    tecp: {
      TECP_AUTHORIZED_SLICE: SLICE,
      TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
      implementationAuthorizationState: {
        activeWorkPackage: EFFECTIVE,
        TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
      },
    },
    authority: {
      activeWorkPackage: { sliceId: SLICE },
    },
    governanceFacts: {
      riskTier: RISK,
      authorityClass: AUTHORITY,
      authorizedFileScope: [...AUTHORIZED],
      protectedPaths: [...PROTECTED],
      stopConditions: [...STOPS],
    },
    lifecyclePrecedence: {
      rawImplementationAuthorization: EFFECTIVE,
      implementationAuthorizationEffective: 'CONSUMED / NON-ACTIVE',
    },
  };
  return { ...parsed, ...overrides };
}

function validRequest(overrides = {}) {
  return {
    sliceId: SLICE,
    authorityClass: AUTHORITY,
    riskTier: RISK,
    requestedPaths: [...AUTHORIZED],
    operationClass: OPERATION_CLASSES.IMPLEMENT,
    requiresDeploy: false,
    requiresProductionMutation: false,
    ...overrides,
  };
}

function setAuthorization(parsed, value) {
  parsed.tecp.implementationAuthorizationState.activeWorkPackage = value;
  parsed.lifecyclePrecedence.rawImplementationAuthorization = value;
  return parsed;
}

test('exact authorized TECP-006 request is ALLOW', () => {
  const result = validateGovernance(baseParsed(), validRequest());
  assert.equal(result.allowed, true);
  assert.equal(result.decision, GOVERNANCE_DECISIONS.ALLOW);
  assert.deepEqual(result.reasons, ['AUTHORIZED_EXACT_SLICE']);
});

test('missing governance facts deny', () => {
  const parsed = baseParsed();
  delete parsed.governanceFacts;
  const result = validateGovernance(parsed, validRequest());
  assert.equal(result.allowed, false);
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_MISSING_GOVERNANCE_FACT);
  assert.ok(result.reasons.includes('governanceFacts'));
});

test('active authorization NO denies', () => {
  const result = validateGovernance(setAuthorization(baseParsed(), 'NO'), validRequest());
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_NOT_AUTHORIZED);
  assert.equal(result.allowed, false);
});

test('consumed non-active authorization denies', () => {
  const result = validateGovernance(
    setAuthorization(baseParsed(), 'CONSUMED / NON-ACTIVE'),
    validRequest(),
  );
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_NOT_AUTHORIZED);
});

test('snapshot NO does not deny when active work package authorization is effective', () => {
  const parsed = baseParsed();
  assert.equal(
    parsed.lifecyclePrecedence.implementationAuthorizationEffective,
    'CONSUMED / NON-ACTIVE',
  );
  assert.equal(parsed.tecp.TECP_IMPLEMENTATION_AUTHORIZED, 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES');
  const result = validateGovernance(parsed, validRequest());
  assert.equal(result.decision, GOVERNANCE_DECISIONS.ALLOW);
});

test('wrong slice denies', () => {
  const result = validateGovernance(baseParsed(), validRequest({ sliceId: 'TECP-007' }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_SLICE_MISMATCH);
});

test('wrong authority class denies', () => {
  const result = validateGovernance(baseParsed(), validRequest({ authorityClass: 'OTHER' }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_AUTHORITY_CLASS_MISMATCH);
});

test('wrong risk tier denies', () => {
  const result = validateGovernance(baseParsed(), validRequest({ riskTier: 'Tier 3' }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_RISK_TIER_MISMATCH);
});

test('deploy request denies before protected path and stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requiresDeploy: true,
    requestedPaths: ['backend/services/foo.js'],
    operationClass: OPERATION_CLASSES.DEPLOY,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_DEPLOY);
});

test('production mutation denies before out-of-scope path', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requiresProductionMutation: true,
    requestedPaths: ['tecp/src/other.js'],
    operationClass: OPERATION_CLASSES.PRODUCTION_MUTATION,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_PRODUCTION_MUTATION);
});

test('path outside scope denies', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requestedPaths: ['tecp/src/other.js'],
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_PATH_OUT_OF_SCOPE);
});

test('protected exact path denies before scope', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requestedPaths: ['.cursor/rules/titangold-current-active-work.mdc'],
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_PROTECTED_PATH);
});

test('protected backend/** descendant denies', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requestedPaths: ['backend/services/foo.js'],
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_PROTECTED_PATH);
});

test('suspicious dotdot path fails closed without expanding authority', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    requestedPaths: ['tecp/src/../src/governanceValidator.js'],
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_PATH_OUT_OF_SCOPE);
});

test('raw Rule02 parse operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.RAW_RULE02_PARSE,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
  assert.deepEqual(result.reasons, ['STOP_CONDITION:RAW_RULE02_PARSE']);
});

test('parser source mutation operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.PARSER_SOURCE_MUTATION,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('package change operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.PACKAGE_CHANGE,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('DB operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.DB,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('network operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.NETWORK,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('GitHub operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.GITHUB,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('Linear operation denies by stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: OPERATION_CLASSES.LINEAR,
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
});

test('unknown operation class fails closed as stop condition', () => {
  const result = validateGovernance(baseParsed(), validRequest({
    operationClass: 'NOT_A_REAL_OPERATION',
  }));
  assert.equal(result.decision, GOVERNANCE_DECISIONS.DENY_STOP_CONDITION);
  assert.equal(result.reasons[0].startsWith('UNSUPPORTED_OPERATION_CLASS:'), true);
});

test('non-triggered stop conditions do not deny', () => {
  const parsed = baseParsed();
  parsed.governanceFacts.stopConditions = ['RAW_RULE02_PARSE', 'DB', 'GITHUB'];
  const result = validateGovernance(parsed, validRequest());
  assert.equal(result.decision, GOVERNANCE_DECISIONS.ALLOW);
});

test('repeated evaluation is deterministic', () => {
  const parsed = baseParsed();
  const request = validRequest();
  const first = validateGovernance(parsed, request);
  const second = validateGovernance(parsed, request);
  assert.deepEqual(first, second);
});

test('parsedRule02 is not mutated', () => {
  const parsed = baseParsed();
  const before = structuredClone(parsed);
  validateGovernance(parsed, validRequest());
  assert.deepEqual(parsed, before);
});

test('request is not mutated', () => {
  const request = validRequest();
  const before = structuredClone(request);
  const result = validateGovernance(baseParsed(), request);
  assert.deepEqual(request, before);
  result.request.requestedPaths.push('tecp/src/other.js');
  assert.deepEqual(request.requestedPaths, [...AUTHORIZED]);
});

test('result structure is stable', () => {
  const result = validateGovernance(baseParsed(), validRequest());
  assert.deepEqual(Object.keys(result), [
    'allowed',
    'decision',
    'reasons',
    'matchedFacts',
    'request',
  ]);
  assert.equal(typeof result.allowed, 'boolean');
  assert.equal(Array.isArray(result.reasons), true);
  assert.deepEqual(result.matchedFacts.authorizedFileScope, AUTHORIZED);
});

test('validator source has no side-effect authority', () => {
  const source = readFileSync(validatorSourcePath, 'utf8');
  const forbidden = [
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:child_process',
    'process.env',
    'child_process',
    'fetch(',
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token);
  }
});

test('evaluation does not change environment keys', () => {
  const before = Object.keys(process.env).sort();
  validateGovernance(baseParsed(), validRequest());
  assert.deepEqual(Object.keys(process.env).sort(), before);
});

test('canonical Rule02 parser output allows the exact TECP-006 implementation request', () => {
  const text = readFileSync(rule02Path, 'utf8');
  const parsed = parseRule02(text, { sourceSha: 'f00cc9b203ff3e809a708e65cbff2004b3259ac7' });
  const before = structuredClone(parsed);
  const request = validRequest();
  const result = validateGovernance(parsed, request);
  assert.equal(result.decision, GOVERNANCE_DECISIONS.ALLOW);
  assert.equal(result.allowed, true);
  assert.equal(result.matchedFacts.sliceId, SLICE);
  assert.equal(result.matchedFacts.authorityClass, AUTHORITY);
  assert.equal(result.matchedFacts.riskTier, RISK);
  assert.equal(result.matchedFacts.implementationAuthorization, EFFECTIVE);
  assert.deepEqual(parsed, before);
});
