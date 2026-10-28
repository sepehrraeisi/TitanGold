import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectGovernanceReadModel } from '../src/governanceReadModel.js';

const SLICE = 'TECP-019-LOCAL-GOVERNANCE-READ-MODEL';
const RAW = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
const KEYS = [
  'tecpSliceId',
  'nextOwnerGate',
  'activeWorkPackageImplementationAuthorization',
  'completionGate',
  'completionGateStatus',
  'effectivePermissionIndicator',
];
function fixture() {
  return {
    tecp: {
      TECP_AUTHORIZED_SLICE: SLICE,
      TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
      TECP_NEXT_GATE: SLICE,
      implementationAuthorizationState: {
        TECP_IMPLEMENTATION_AUTHORIZED: 'NO / UNTIL_THIS_GOVERNANCE_PR_MERGES',
        TECP005_IMPLEMENTATION_AUTHORIZED: RAW,
        activeWorkPackage: RAW,
      },
    },
    authority: {
      activeSliceIdentifiers: [SLICE],
      activeWorkPackage: { sliceId: SLICE, officialName: SLICE, domain: 'tecp' },
    },
    governanceFacts: {
      authorityClass: 'ENGINEERING_CONTROL_PLANE',
      riskTier: 'Tier 2',
      authorizedFileScope: ['tecp/src/governanceReadModel.js', 'tecp/test/governanceReadModel.test.js'],
      protectedPaths: ['tecp/src/mcpServer.js'],
      stopConditions: ['OUT_OF_SCOPE_WRITE'],
      implementationStartConditions: 'THIS_GOVERNANCE_PR_MERGED / EXACT_TWO_NEW_FILES_ONLY / NO_RUNTIME_OR_MCP_SURFACE_CHANGE',
      completionGate: 'TECP019_LOCAL_GOVERNANCE_READ_MODEL_COMPLETE',
      completionGateStatus: 'NOT_REACHED',
    },
    lifecyclePrecedence: {
      consumedSlice: 'TECP-018-SINGLE-CURSOR',
      status: 'CLOSED / FROZEN / VERIFIED',
      rule: 'CLOSED_FROZEN_VERIFIED_CONSUMES_PRIOR_IMPLEMENTATION_AUTHORIZATION',
      rawImplementationAuthorization: RAW,
      implementationAuthorizationEffective: 'CONSUMED / NON-ACTIVE',
    },
    artemis: { secret: 'PRIVATE_SHOULD_NOT_LEAK' },
    secret: 'PRIVATE_SHOULD_NOT_LEAK',
  };
}
function clone(x) { return structuredClone(x); }
function unknown(output) {
  assert.deepEqual(output, {
    tecpSliceId: 'UNKNOWN',
    nextOwnerGate: 'UNKNOWN',
    activeWorkPackageImplementationAuthorization: 'UNKNOWN',
    completionGate: 'UNKNOWN',
    completionGateStatus: 'UNKNOWN',
    effectivePermissionIndicator: 'NO_AUTHORITY',
  });
}

test('projects only six allowlisted keys, including current slice and gate', () => {
  const output = projectGovernanceReadModel(fixture());
  assert.deepEqual(Object.keys(output), KEYS);
  assert.equal(output.tecpSliceId, SLICE);
  assert.equal(output.nextOwnerGate, SLICE);
  assert.equal(output.activeWorkPackageImplementationAuthorization, RAW);
  assert.equal(output.completionGate, 'TECP019_LOCAL_GOVERNANCE_READ_MODEL_COMPLETE');
  assert.equal(output.completionGateStatus, 'NOT_REACHED');
  assert.equal(output.effectivePermissionIndicator, 'NO_AUTHORITY');
});

test('unknown input shapes are fail-closed', () => {
  for (const value of [undefined, null, 0, '', [], {}, { tecp: {} }]) unknown(projectGovernanceReadModel(value));
});

test('missing essential fields fail closed', () => {
  const paths = [
    ['tecp', 'TECP_NEXT_GATE'],
    ['tecp', 'implementationAuthorizationState'],
    ['authority', 'activeWorkPackage'],
    ['governanceFacts', 'completionGate'],
    ['governanceFacts', 'completionGateStatus'],
    ['lifecyclePrecedence', 'rawImplementationAuthorization'],
  ];
  for (const [parent, name] of paths) {
    const copy = fixture();
    delete copy[parent][name];
    unknown(projectGovernanceReadModel(copy));
  }
});

test('contradictory slice authority and work package are rejected', () => {
  const paths = [
    (x) => { x.tecp.TECP_AUTHORIZED_SLICE = 'TECP-020-UNAUTHORIZED'; },
    (x) => { x.authority.activeWorkPackage.sliceId = 'TECP-018'; },
    (x) => { x.authority.activeWorkPackage.officialName = 'TECP-005'; },
    (x) => { x.authority.activeWorkPackage.domain = 'artemis'; },
    (x) => { x.authority.activeSliceIdentifiers = ['TECP-018']; },
    (x) => { x.authority.activeSliceIdentifiers.push('TECP-020'); },
    (x) => { x.tecp.implementationAuthorizationState.TECP_IMPLEMENTATION_AUTHORIZED = 'YES'; },
    (x) => { x.lifecyclePrecedence.rawImplementationAuthorization = 'NO'; },
    (x) => { x.lifecyclePrecedence.implementationAuthorizationEffective = 'ACTIVE'; },
    (x) => { x.lifecyclePrecedence.status = 'OPEN'; },
    (x) => { x.lifecyclePrecedence.consumedSlice = SLICE; },
  ];
  for (const mutate of paths) {
    const copy = fixture();
    mutate(copy);
    unknown(projectGovernanceReadModel(copy));
  }
});

test('unknown authorization and incorrect risk/file scope fail closed', () => {
  for (const mutate of [
    (x) => { x.tecp.implementationAuthorizationState.activeWorkPackage = 'MAYBE'; },
    (x) => { x.governanceFacts.riskTier = 'Tier 4'; },
    (x) => { x.governanceFacts.authorityClass = 'ARTEMIS'; },
    (x) => { x.governanceFacts.authorizedFileScope.push('tecp/src/mcpServer.js'); },
    (x) => { x.governanceFacts.authorizedFileScope[0] = 'tecp/src/other.js'; },
  ]) {
    const copy = fixture();
    mutate(copy);
    unknown(projectGovernanceReadModel(copy));
  }
});

test('is deterministic, JSON-safe, frozen and does not mutate input', () => {
  const input = fixture();
  const initial = clone(input);
  const first = projectGovernanceReadModel(input);
  const second = projectGovernanceReadModel(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(input, initial);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.throws(() => { first.tecpSliceId = 'TECP-020'; }, TypeError);
});

test('does not leak unrelated secrets or Artemis data', () => {
  const data = fixture();
  const output = JSON.stringify(projectGovernanceReadModel(data));
  assert.doesNotMatch(output, /PRIVATE_SHOULD_NOT_LEAK|artemis|secret/i);
  data.tecp.TECP_NEXT_GATE = 'PASSWORD_PRIVATE';
  unknown(projectGovernanceReadModel(data));
});

test('does not read filesystem, environment, network or import execution modules', () => {
  const source = readFileSync(new URL('../src/governanceReadModel.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(fetch|readFileSync|writeFileSync|process\.env|child_process|http|https|redis|postgres|spawn|execSync)\b/);
  assert.equal(projectGovernanceReadModel(fixture()).effectivePermissionIndicator, 'NO_AUTHORITY');
});

test('exact single public export', async () => {
  const module = await import('../src/governanceReadModel.js');
  assert.deepEqual(Object.keys(module), ['projectGovernanceReadModel']);
});
