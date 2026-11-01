import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ATTESTATION_KINDS,
  createTestOnlyAttestationVerifier,
  verifyWorkerPrincipal,
} from '../src/workerIdentity.js';
import {
  BOOTSTRAP_ALLOWED_ACTIONS,
  CAPABILITY_ACTIONS,
  CAPABILITY_STAGES,
  LEASE_BOUND_ALLOWED_ACTIONS,
  createInMemoryIssuerKeyRegistry,
  createInMemoryRevocationRegistry,
  createInjectedClock,
  generateEphemeralEd25519KeyPair,
  issueCapability,
} from '../src/workerCapabilityToken.js';
import {
  createInMemoryTrustedLeaseSnapshotReader,
} from '../src/trustedLeaseSnapshot.js';
import {
  APPROVED_GOVERNANCE_REVISION,
  AUTHORIZATION_DECISIONS,
  assertBrandedAuthorizedInvocation,
  authorizeWorkerOperation,
  createTrustedAuthorizationPolicy,
  createTrustedAuthorizationPolicyProvider,
  deriveActorIdFromPrincipalId,
  isBrandedAuthorizedInvocation,
  isBrandedTrustedAuthorizationPolicy,
  rejectPriorAuthorizationReuse,
} from '../src/authorizedInvocation.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/authorizedInvocation.js');

const AUDIENCE = 'tecp-dlp006-authz-boundary';

function attestedPrincipal(principalId = 'worker-principal-a', generation = 1) {
  const attestation = {
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer',
    principalId,
    principalGeneration: generation,
    attestedAt: 1_700_000_000_000,
  };
  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(attestation);
  const result = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(result.allowed, true);
  return result.principal;
}

function capabilityHarness(options = {}) {
  const keys = options.keys || generateEphemeralEd25519KeyPair();
  const issuer = options.issuer || 'tecp-test-issuer';
  const kid = options.kid || 'kid-1';
  const keyRegistry = createInMemoryIssuerKeyRegistry([
    {
      issuer,
      kid,
      algorithm: 'Ed25519',
      publicKeyPem: keys.publicKeyPem,
      privateKeyPem: keys.privateKeyPem,
      status: options.keyStatus || 'ACTIVE',
    },
  ]);
  const revocationRegistry = createInMemoryRevocationRegistry();
  revocationRegistry.setCurrentRevocationGeneration(options.revocationGeneration ?? 0);
  const clock = createInjectedClock(options.nowMs ?? 1_700_000_000_000);
  return {
    keys,
    issuer,
    kid,
    keyRegistry,
    revocationRegistry,
    clock,
    deps: { keyRegistry, revocationRegistry, clock },
  };
}

function defaultPolicyInput(overrides = {}) {
  return {
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    audience: AUDIENCE,
    operations: [
      {
        operationKey: 'bootstrap-task-1',
        capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
        action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
      },
      {
        operationKey: 'lease-mutate-task-1',
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        action: CAPABILITY_ACTIONS.MUTATE_TASK,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
        leaseId: 'lease-1',
      },
      {
        operationKey: 'lease-evidence-task-1',
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        action: CAPABILITY_ACTIONS.SUBMIT_EVIDENCE,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
        leaseId: 'lease-1',
      },
      {
        operationKey: 'lease-release-task-1',
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        action: CAPABILITY_ACTIONS.RELEASE_TASK,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
        leaseId: 'lease-1',
      },
      {
        operationKey: 'lease-execute-task-1',
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        action: CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
        leaseId: 'lease-1',
      },
    ],
    ...overrides,
  };
}

function env(options = {}) {
  const h = capabilityHarness(options);
  const principal = options.principal || attestedPrincipal();
  const policy = createTrustedAuthorizationPolicy(defaultPolicyInput(options.policyOverrides));
  const policyProvider = createTrustedAuthorizationPolicyProvider(policy);
  const leaseReader = createInMemoryTrustedLeaseSnapshotReader();
  leaseReader.put({
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: principal.principalId,
    ownerActorId: deriveActorIdFromPrincipalId(principal.principalId),
    fencingEpoch: 7,
    status: 'ACTIVE',
    expiresAtMs: 1_700_000_360_000,
  });
  return { h, principal, policy, policyProvider, leaseReader };
}

function issueBootstrap(h, principal, overrides = {}) {
  return issueCapability(
    {
      principal,
      issuer: h.issuer,
      kid: h.kid,
      algorithm: 'Ed25519',
      audience: AUDIENCE,
      taskId: 'task-1',
      resourceType: 'TASK',
      resourceId: 'task-1',
      allowedActions: [...BOOTSTRAP_ALLOWED_ACTIONS],
      capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
      ttlMs: 60_000,
      ...overrides,
    },
    h.deps,
  );
}

function issueLeaseBound(h, principal, action, overrides = {}) {
  return issueCapability(
    {
      principal,
      issuer: h.issuer,
      kid: h.kid,
      algorithm: 'Ed25519',
      audience: AUDIENCE,
      taskId: 'task-1',
      resourceType: 'TASK',
      resourceId: 'task-1',
      allowedActions: [action],
      capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
      leaseContext: { leaseId: 'lease-1', fencingEpoch: 7 },
      ttlMs: 60_000,
      ...overrides,
    },
    h.deps,
  );
}

function authDeps(e) {
  return {
    policyProvider: e.policyProvider,
    capabilityDeps: e.h.deps,
    leaseSnapshotReader: e.leaseReader,
  };
}

test('deriveActorId equals principalId', () => {
  assert.equal(deriveActorIdFromPrincipalId('worker-x'), 'worker-x');
});

test('valid trusted BOOTSTRAP_REQUEST ALLOW with derived actorId', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  assert.equal(issued.allowed, true);

  const result = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  assert.equal(result.allowed, true);
  assert.equal(result.decision, AUTHORIZATION_DECISIONS.ALLOW);
  assert.equal(isBrandedAuthorizedInvocation(result.invocation), true);
  assert.equal(result.invocation.actorId, e.principal.principalId);
  assert.equal(result.invocation.principalId, e.principal.principalId);
  assert.equal(result.invocation.action, CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE);
  assert.equal(result.invocation.capabilityStage, CAPABILITY_STAGES.BOOTSTRAP_REQUEST);
  assert.equal(result.invocation.governanceRevision, APPROVED_GOVERNANCE_REVISION);
  assert.equal(result.invocation.jti, issued.claims.jti);
  assert.equal(result.invocation.leaseId, null);
  assert.equal(result.invocation.fencingEpoch, null);
  assert.equal(result.invocation.operationalExecutionAuthority, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.invocation, 'token'), false);
  assert.equal(JSON.stringify(result).includes('BEGIN PRIVATE KEY'), false);
  assert.equal(JSON.stringify(result).includes(e.h.keys.privateKeyPem), false);
});

test('valid LEASE_BOUND authorization for each approved action', () => {
  const e = env();
  const keys = [
    ['lease-mutate-task-1', CAPABILITY_ACTIONS.MUTATE_TASK],
    ['lease-evidence-task-1', CAPABILITY_ACTIONS.SUBMIT_EVIDENCE],
    ['lease-release-task-1', CAPABILITY_ACTIONS.RELEASE_TASK],
    ['lease-execute-task-1', CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK],
  ];
  assert.equal(LEASE_BOUND_ALLOWED_ACTIONS.length, 4);
  for (const [operationKey, action] of keys) {
    const issued = issueLeaseBound(e.h, e.principal, action);
    assert.equal(issued.allowed, true, action);
    const result = authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey,
        principal: e.principal,
      },
      authDeps(e),
    );
    assert.equal(result.allowed, true, action);
    assert.equal(result.invocation.action, action);
    assert.equal(result.invocation.leaseId, 'lease-1');
    assert.equal(result.invocation.fencingEpoch, 7);
  }
});

test('legitimate same-scope retry ALLOW', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const first = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  const second = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(first.invocation.jti, second.invocation.jti);
  assert.notEqual(first.invocation, second.invocation);
});

test('forged operation intent DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const result = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
      operationIntent: {
        operationKey: 'bootstrap-task-1',
        capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
        action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
        taskId: 'forged-task',
        resourceType: 'TASK',
        resourceId: 'forged-task',
      },
    },
    authDeps(e),
  );
  assert.equal(result.decision, AUTHORIZATION_DECISIONS.DENY_FORGED_OPERATION_INTENT);
});

test('caller-created expectation DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const result = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
      expectation: {
        audience: AUDIENCE,
        taskId: 'task-1',
        resourceType: 'TASK',
        resourceId: 'task-1',
        principalId: e.principal.principalId,
        action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
        capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
      },
    },
    authDeps(e),
  );
  assert.equal(result.decision, AUTHORIZATION_DECISIONS.DENY_CALLER_EXPECTATION);
});

test('spoofed actorId / workerId DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
        actorId: 'intruder',
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_SPOOFED_ACTOR,
  );
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
        workerId: 'intruder',
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_SPOOFED_ACTOR,
  );
});

test('unverified / cross-worker principal DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const forgedPrincipal = {
    principalId: e.principal.principalId,
    trustLevel: e.principal.trustLevel,
    attestationKind: e.principal.attestationKind,
    bootstrapIssuer: e.principal.bootstrapIssuer,
    principalGeneration: e.principal.principalGeneration,
    attestedAt: e.principal.attestedAt,
    osPrincipalAuthenticated: false,
    realWorkerAuthenticated: false,
  };
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: forgedPrincipal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_INVALID_PRINCIPAL,
  );

  const other = attestedPrincipal('worker-principal-b');
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: other,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('forged / copied / serialized AuthorizedInvocation DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const ok = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  assert.equal(ok.allowed, true);

  const copy = { ...ok.invocation };
  assert.equal(isBrandedAuthorizedInvocation(copy), false);
  assert.equal(
    assertBrandedAuthorizedInvocation(copy).decision,
    AUTHORIZATION_DECISIONS.DENY_UNBRANDED_INVOCATION,
  );
  assert.equal(assertBrandedAuthorizedInvocation(copy).authentic, false);
  assert.equal(assertBrandedAuthorizedInvocation(copy).allowed, false);
  assert.equal(assertBrandedAuthorizedInvocation(copy).authorizationGranted, false);

  const roundTrip = JSON.parse(JSON.stringify(ok.invocation));
  assert.equal(
    assertBrandedAuthorizedInvocation(roundTrip).decision,
    AUTHORIZATION_DECISIONS.DENY_UNBRANDED_INVOCATION,
  );

  // F3: branded artifact is authentic but NEVER an authorization ALLOW.
  const authenticity = assertBrandedAuthorizedInvocation(ok.invocation);
  assert.equal(authenticity.authentic, true);
  assert.equal(authenticity.decision, AUTHORIZATION_DECISIONS.ARTIFACT_AUTHENTIC);
  assert.equal(authenticity.allowed, false);
  assert.equal(authenticity.authorizationGranted, false);
});

test('F3: authenticity is not standing authority after capability expiry', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal, { ttlMs: 1_000 });
  const ok = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  assert.equal(ok.allowed, true);
  e.h.clock.advance(2_000);
  const authenticity = assertBrandedAuthorizedInvocation(ok.invocation);
  assert.equal(authenticity.authentic, true);
  assert.equal(authenticity.allowed, false);
  assert.equal(authenticity.authorizationGranted, false);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('F4: clock exception before and after verify FAIL CLOSED DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);

  const throwingClock = {
    now() {
      throw new Error('CLOCK_BOOM');
    },
  };
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      {
        policyProvider: e.policyProvider,
        capabilityDeps: {
          keyRegistry: e.h.keyRegistry,
          revocationRegistry: e.h.revocationRegistry,
          clock: throwingClock,
        },
        leaseSnapshotReader: e.leaseReader,
      },
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION,
  );

  // Post-verify throw: verifyCapability calls now() once; issuance recheck is the next call.
  const issued3 = issueBootstrap(e.h, e.principal);
  let readCount = 0;
  const base = 1_700_000_000_000;
  const postVerifyThrowClock = {
    now() {
      readCount += 1;
      if (readCount === 1) {
        return Object.freeze({ available: true, nowMs: base });
      }
      throw new Error('CLOCK_BOOM_ISSUANCE');
    },
  };
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued3.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      {
        policyProvider: e.policyProvider,
        capabilityDeps: {
          keyRegistry: e.h.keyRegistry,
          revocationRegistry: e.h.revocationRegistry,
          clock: postVerifyThrowClock,
        },
        leaseSnapshotReader: e.leaseReader,
      },
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_DEPENDENCY_EXCEPTION,
  );
});

test('F4: expired capability cannot receive artifact at issuance recheck', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal, { ttlMs: 5_000 });
  assert.equal(issued.allowed, true);
  let reads = 0;
  const base = 1_700_000_000_000;
  const splitClock = {
    now() {
      reads += 1;
      if (reads === 1) {
        return Object.freeze({ available: true, nowMs: base });
      }
      return Object.freeze({ available: true, nowMs: base + 10_000 });
    },
  };
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      {
        policyProvider: e.policyProvider,
        capabilityDeps: {
          keyRegistry: e.h.keyRegistry,
          revocationRegistry: e.h.revocationRegistry,
          clock: splitClock,
        },
        leaseSnapshotReader: e.leaseReader,
      },
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_EXPIRED_AT_ARTIFACT_ISSUANCE,
  );
});

test('wrong audience / task / resource / action DENY', () => {
  const e = env();
  const wrongAudience = issueBootstrap(e.h, e.principal, { audience: 'other-audience' });
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: wrongAudience.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );

  const wrongTask = issueBootstrap(e.h, e.principal, {
    taskId: 'task-other',
    resourceId: 'task-other',
  });
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: wrongTask.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('invalid governance revision DENY at policy construction', () => {
  assert.throws(
    () => createTrustedAuthorizationPolicy({
      ...defaultPolicyInput(),
      governanceRevision: 'WRONG_REVISION',
    }),
    /invalid governance revision/,
  );
  assert.equal(isBrandedTrustedAuthorizationPolicy({ governanceRevision: APPROVED_GOVERNANCE_REVISION }), false);
});

test('unknown operation key DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'not-in-policy',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_UNKNOWN_OPERATION,
  );
});

test('bootstrap mutation attempt DENY via capability mismatch', () => {
  const e = env();
  // Lease-bound mutate token cannot authorize bootstrap operationKey.
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.MUTATE_TASK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('stage escalation DENY — bootstrap token cannot LEASE_BOUND', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-execute-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('expired credential DENY', () => {
  const e = env({ nowMs: 1_700_000_000_000 });
  const issued = issueBootstrap(e.h, e.principal, { ttlMs: 1_000 });
  e.h.clock.advance(2_000);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('revoked jti DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  e.h.revocationRegistry.revokeJti(issued.claims.jti);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('stale principal generation DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  e.h.revocationRegistry.invalidatePrincipalBelowGeneration(e.principal.principalId, 99);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('foreign lease ownership DENY', () => {
  const e = env();
  const foreign = attestedPrincipal('foreign-worker');
  e.leaseReader.clear();
  e.leaseReader.put({
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: foreign.principalId,
    ownerActorId: foreign.principalId,
    fencingEpoch: 7,
    status: 'ACTIVE',
    expiresAtMs: 1_700_000_360_000,
  });
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-execute-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
  );
});

test('stale fencing epoch DENY', () => {
  const e = env();
  e.leaseReader.clear();
  e.leaseReader.put({
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: e.principal.principalId,
    ownerActorId: e.principal.principalId,
    fencingEpoch: 8,
    status: 'ACTIVE',
    expiresAtMs: 1_700_000_360_000,
  });
  // Token still carries fencing 7; trusted snapshot is 8 → capability verify DENY.
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-execute-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('missing / expired lease DENY', () => {
  const e = env();
  e.leaseReader.clear();
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.RELEASE_TASK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-release-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
  );

  e.leaseReader.put({
    leaseId: 'lease-1',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    ownerPrincipalId: e.principal.principalId,
    ownerActorId: e.principal.principalId,
    fencingEpoch: 7,
    status: 'ACTIVE',
    expiresAtMs: 1_700_000_000_000,
  });
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-release-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
  );
});

test('forged lease snapshot / missing reader DENY', () => {
  const e = env();
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.MUTATE_TASK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-mutate-task-1',
        principal: e.principal,
      },
      {
        policyProvider: e.policyProvider,
        capabilityDeps: e.h.deps,
        leaseSnapshotReader: { read: () => ({ allowed: true, snapshot: {} }) },
      },
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
  );
});

test('trusted lease reader outage FAIL CLOSED', () => {
  const e = env();
  e.leaseReader.setUnavailable(true);
  const issued = issueLeaseBound(e.h, e.principal, CAPABILITY_ACTIONS.MUTATE_TASK);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'lease-mutate-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_LEASE_SNAPSHOT,
  );
});

test('revocation / clock / key registry unavailable FAIL CLOSED', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);

  e.h.revocationRegistry.setUnavailable(true);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
  e.h.revocationRegistry.setUnavailable(false);

  e.h.clock.setUnavailable(true);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
  e.h.clock.setUnavailable(false);

  e.h.keyRegistry.setUnavailable(true);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
  e.h.keyRegistry.setUnavailable(false);
});

test('policy provider unavailable FAIL CLOSED', () => {
  const e = env();
  e.policyProvider.setUnavailable(true);
  const issued = issueBootstrap(e.h, e.principal);
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: e.principal,
      },
      authDeps(e),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_POLICY_UNAVAILABLE,
  );
});

test('disabled issuer key DENY', () => {
  const active = env();
  const issued = issueBootstrap(active.h, active.principal);
  assert.equal(issued.allowed, true);
  const entry = active.h.keyRegistry.lookup(active.h.issuer, active.h.kid).entry;
  assert.ok(entry);
  // Replace registry entry with DISABLED status via put (supported by DLP-005 registry).
  active.h.keyRegistry.put({
    issuer: entry.issuer,
    kid: entry.kid,
    algorithm: entry.algorithm,
    publicKeyPem: entry.publicKeyPem,
    privateKeyPem: null,
    status: 'DISABLED',
  });
  assert.equal(
    authorizeWorkerOperation(
      {
        capabilityToken: issued.token,
        operationKey: 'bootstrap-task-1',
        principal: active.principal,
      },
      authDeps(active),
    ).decision,
    AUTHORIZATION_DECISIONS.DENY_CAPABILITY,
  );
});

test('cross-phase reuse of prior AuthorizedInvocation DENY', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const bootstrapAuth = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
    },
    authDeps(e),
  );
  assert.equal(bootstrapAuth.allowed, true);

  assert.equal(
    rejectPriorAuthorizationReuse(bootstrapAuth.invocation, 'lease-execute-task-1').decision,
    AUTHORIZATION_DECISIONS.DENY_CROSS_PHASE_REUSE,
  );
  assert.equal(
    rejectPriorAuthorizationReuse(bootstrapAuth.invocation, 'bootstrap-task-1').decision,
    AUTHORIZATION_DECISIONS.DENY_CROSS_PHASE_REUSE,
  );
});

test('matching actorId on request still ALLOW when equal to derived', () => {
  const e = env();
  const issued = issueBootstrap(e.h, e.principal);
  const result = authorizeWorkerOperation(
    {
      capabilityToken: issued.token,
      operationKey: 'bootstrap-task-1',
      principal: e.principal,
      actorId: e.principal.principalId,
    },
    authDeps(e),
  );
  assert.equal(result.allowed, true);
});

test('source non-operational markers and no secret/persistence coupling', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(source, /NON_OPERATIONAL/);
  assert.match(source, /NOT operational execution authority/);
  assert.match(source, /verifyCapability/);
  assert.equal(source.includes('bindTaskClaimLease'), false);
  assert.equal(source.includes('taskClaimLeaseAuditRepository'), false);
  assert.equal(source.includes('createTitanMcpServer'), false);
  assert.equal(source.includes('DATABASE_URL'), false);
  assert.equal(source.includes('parseRule02'), false);
});
