import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ATTESTATION_KINDS,
  TRUST_LEVELS,
  createTestOnlyAttestationVerifier,
  verifyWorkerPrincipal,
} from '../src/workerIdentity.js';
import {
  BOOTSTRAP_ALLOWED_ACTIONS,
  CAPABILITY_ACTIONS,
  CAPABILITY_DECISIONS,
  CAPABILITY_STAGES,
  LEASE_BOUND_ALLOWED_ACTIONS,
  MAX_CAPABILITY_TTL_MS,
  canonicalJson,
  createInMemoryIssuerKeyRegistry,
  createInMemoryRevocationRegistry,
  createInjectedClock,
  generateEphemeralEd25519KeyPair,
  issueCapability,
  verifyCapability,
  verifyCapabilityRetry,
} from '../src/workerCapabilityToken.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/workerCapabilityToken.js');

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

function harness(options = {}) {
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

function bootstrapRequest(h, principal, overrides = {}) {
  return {
    principal,
    issuer: h.issuer,
    kid: h.kid,
    algorithm: 'Ed25519',
    audience: 'tecp-task-control',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    allowedActions: [...BOOTSTRAP_ALLOWED_ACTIONS],
    capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
    ttlMs: 60_000,
    ...overrides,
  };
}

function leaseBoundRequest(h, principal, overrides = {}) {
  return {
    principal,
    issuer: h.issuer,
    kid: h.kid,
    algorithm: 'Ed25519',
    audience: 'tecp-task-control',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    allowedActions: [CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK],
    capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
    leaseContext: { leaseId: 'lease-1', fencingEpoch: 7 },
    ttlMs: 60_000,
    ...overrides,
  };
}

function completeBootstrapExpectation(principal, overrides = {}) {
  return {
    audience: 'tecp-task-control',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    principalId: principal.principalId,
    action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
    capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
    ...overrides,
  };
}

function completeLeaseExpectation(principal, overrides = {}) {
  return {
    audience: 'tecp-task-control',
    taskId: 'task-1',
    resourceType: 'TASK',
    resourceId: 'task-1',
    principalId: principal.principalId,
    action: CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
    capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
    leaseContext: { leaseId: 'lease-1', fencingEpoch: 7 },
    ...overrides,
  };
}

test('valid signed bootstrap capability ALLOW', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  assert.equal(typeof issued.token, 'string');

  const verified = verifyCapability(
    issued.token,
    completeBootstrapExpectation(principal),
    h.deps,
  );
  assert.equal(verified.allowed, true);
  assert.equal(verified.decision, CAPABILITY_DECISIONS.ALLOW);
});

test('valid lease-bound capability with proof-supplied fencing ALLOW', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(leaseBoundRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  const verified = verifyCapability(
    issued.token,
    completeLeaseExpectation(principal),
    h.deps,
  );
  assert.equal(verified.allowed, true);
});

test('LEASE_BOUND unknown / invented / bootstrap-only / mixed actions DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();

  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, { allowedActions: ['TOTALLY_MADE_UP_PRIVILEGE'] }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ACTION,
  );

  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, { allowedActions: ['APPROVE_MERGE_AND_DEPLOY'] }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ACTION,
  );

  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, {
        allowedActions: [CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE],
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ACTION,
  );

  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, {
        allowedActions: [
          CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
          CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
        ],
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ACTION,
  );

  // Duplicate actions rejected by normalizeActions
  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, {
        allowedActions: [
          CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
          CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
        ],
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_MISSING_OR_MALFORMED_CLAIMS,
  );

  // Each approved LEASE_BOUND action alone issues and verifies
  for (const action of LEASE_BOUND_ALLOWED_ACTIONS) {
    const issued = issueCapability(
      leaseBoundRequest(h, principal, { allowedActions: [action] }),
      h.deps,
    );
    assert.equal(issued.allowed, true, action);
    assert.equal(
      verifyCapability(
        issued.token,
        completeLeaseExpectation(principal, { action }),
        h.deps,
      ).allowed,
      true,
      action,
    );
  }
});

test('empty or incomplete expectation DENY — never wildcard', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);

  assert.equal(
    verifyCapability(issued.token, {}, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION,
  );

  const required = [
    'audience',
    'taskId',
    'resourceType',
    'resourceId',
    'principalId',
    'action',
    'capabilityStage',
  ];
  for (const field of required) {
    const incomplete = completeBootstrapExpectation(principal);
    delete incomplete[field];
    assert.equal(
      verifyCapability(issued.token, incomplete, h.deps).decision,
      CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION,
      `missing ${field}`,
    );
  }

  for (const field of required) {
    assert.equal(
      verifyCapability(
        issued.token,
        completeBootstrapExpectation(principal, { [field]: '' }),
        h.deps,
      ).decision,
      CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION,
      `empty ${field}`,
    );
    assert.equal(
      verifyCapability(
        issued.token,
        completeBootstrapExpectation(principal, { [field]: null }),
        h.deps,
      ).decision,
      CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION,
      `null ${field}`,
    );
    assert.equal(
      verifyCapability(
        issued.token,
        completeBootstrapExpectation(principal, { [field]: 123 }),
        h.deps,
      ).decision,
      CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION,
      `wrong-type ${field}`,
    );
  }

  // LEASE_BOUND missing fencing
  const leaseIssued = issueCapability(leaseBoundRequest(h, principal), h.deps);
  assert.equal(leaseIssued.allowed, true);
  const noFence = completeLeaseExpectation(principal);
  delete noFence.leaseContext;
  assert.equal(
    verifyCapability(leaseIssued.token, noFence, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING,
  );
});

test('tampered payload / signature DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  const [payloadB64, sigB64] = issued.token.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  payload.taskId = 'task-hijacked';
  const tampered = `${Buffer.from(canonicalJson(payload), 'utf8').toString('base64url')}.${sigB64}`;
  const result = verifyCapability(
    tampered,
    completeBootstrapExpectation(principal, { taskId: 'task-hijacked' }),
    h.deps,
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE);
});

test('unknown issuer / kid DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  const other = harness({ kid: 'kid-other' });
  // Use token from h but verify against empty/other registry without matching kid.
  const result = verifyCapability(
    issued.token,
    completeBootstrapExpectation(principal),
    other.deps,
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID);
});

test('unsupported algorithm DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const denied = issueCapability(
    bootstrapRequest(h, principal, { algorithm: 'HS256' }),
    h.deps,
  );
  assert.equal(denied.decision, CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM);
});

test('wrong audience / task / resource / action / stage DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);

  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, { audience: 'other-audience' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_AUDIENCE,
  );
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, { taskId: 'task-other' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_TASK,
  );
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, { resourceId: 'task-other' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_RESOURCE,
  );
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, { action: CAPABILITY_ACTIONS.MUTATE_TASK }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_ACTION,
  );
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, {
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        leaseContext: { leaseId: 'lease-1', fencingEpoch: 7 },
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_STAGE_VIOLATION,
  );
});

test('wrong Worker principal DENY', () => {
  const h = harness();
  const principal = attestedPrincipal('worker-a');
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, { principalId: 'worker-b' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_PRINCIPAL,
  );
});

test('expired and not-yet-valid token DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal, { ttlMs: 1_000 }), h.deps);
  assert.equal(issued.allowed, true);

  h.clock.advance(2_000);
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_EXPIRED,
  );

  const h2 = harness();
  const issuedFuture = issueCapability(
    bootstrapRequest(h2, principal, { nbf: h2.clock.now().nowMs + 10_000, ttlMs: 60_000 }),
    h2.deps,
  );
  assert.equal(issuedFuture.allowed, true);
  assert.equal(
    verifyCapability(
      issuedFuture.token,
      completeBootstrapExpectation(principal),
      h2.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_NOT_YET_VALID,
  );
});

test('excessive TTL DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const result = issueCapability(
    bootstrapRequest(h, principal, { ttlMs: MAX_CAPABILITY_TTL_MS + 1 }),
    h.deps,
  );
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL);
});

test('missing / malformed claims DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  assert.equal(
    issueCapability({
      principal,
      issuer: h.issuer,
      kid: h.kid,
      algorithm: 'Ed25519',
      capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
      // missing audience/task/resource/actions
    }, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_MISSING_OR_MALFORMED_CLAIMS,
  );
  assert.equal(
    verifyCapability('not-a-token', {
      audience: 'tecp-task-control',
    }, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_MALFORMED_TOKEN,
  );
});

test('noncanonical or ambiguous encoding DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  const [payloadB64, sigB64] = issued.token.split('.');
  const payloadObj = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  // Ambiguous: extra whitespace / key order change via JSON.stringify insertion order
  const ambiguous = JSON.stringify(payloadObj, null, 2);
  const ambiguousToken = `${Buffer.from(ambiguous, 'utf8').toString('base64url')}.${sigB64}`;
  // Signature also fails, but noncanonical should be detected first after parse
  const result = verifyCapability(
    ambiguousToken,
    completeBootstrapExpectation(principal),
    h.deps,
  );
  assert.ok([
    CAPABILITY_DECISIONS.DENY_NONCANONICAL_ENCODING,
    CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE,
  ].includes(result.decision));
  assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_NONCANONICAL_ENCODING);
});

test('revoked jti DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal, { jti: 'jti-1' }), h.deps);
  assert.equal(issued.allowed, true);
  h.revocationRegistry.revokeJti('jti-1');
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_REVOKED_JTI,
  );
});

test('stale principal generation DENY', () => {
  const h = harness();
  const principal = attestedPrincipal('worker-a', 1);
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  h.revocationRegistry.invalidatePrincipalBelowGeneration('worker-a', 2);
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_STALE_PRINCIPAL_GENERATION,
  );
});

test('unavailable revocation registry FAIL CLOSED', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  h.revocationRegistry.setUnavailable(true);
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE,
  );
});

test('disabled or compromised issuer key DENY', () => {
  const keys = generateEphemeralEd25519KeyPair();
  const h = harness({ keys, keyStatus: 'COMPROMISED' });
  const principal = attestedPrincipal();
  assert.equal(
    issueCapability(bootstrapRequest(h, principal), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY,
  );

  // Issue with active key, then disable for verify.
  const h2 = harness();
  const issued = issueCapability(bootstrapRequest(h2, principal), h2.deps);
  assert.equal(issued.allowed, true);
  h2.keyRegistry.put({
    issuer: h2.issuer,
    kid: h2.kid,
    algorithm: 'Ed25519',
    publicKeyPem: h2.keys.publicKeyPem,
    privateKeyPem: h2.keys.privateKeyPem,
    status: 'DISABLED',
  });
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal),
      h2.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY,
  );
});

test('key rotation with explicitly trusted keys', () => {
  const oldKeys = generateEphemeralEd25519KeyPair();
  const newKeys = generateEphemeralEd25519KeyPair();
  const h = harness({ keys: oldKeys, kid: 'kid-old' });
  h.keyRegistry.put({
    issuer: h.issuer,
    kid: 'kid-new',
    algorithm: 'Ed25519',
    publicKeyPem: newKeys.publicKeyPem,
    privateKeyPem: newKeys.privateKeyPem,
    status: 'ACTIVE',
  });
  const principal = attestedPrincipal();

  const oldIssued = issueCapability(bootstrapRequest(h, principal, { kid: 'kid-old' }), h.deps);
  assert.equal(oldIssued.allowed, true);
  // Rotate: disable old, keep new trusted.
  h.keyRegistry.put({
    issuer: h.issuer,
    kid: 'kid-old',
    algorithm: 'Ed25519',
    publicKeyPem: oldKeys.publicKeyPem,
    privateKeyPem: oldKeys.privateKeyPem,
    status: 'RETIRED',
  });
  assert.equal(
    verifyCapability(
      oldIssued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY,
  );

  const newIssued = issueCapability(bootstrapRequest(h, principal, { kid: 'kid-new' }), h.deps);
  assert.equal(newIssued.allowed, true);
  assert.equal(
    verifyCapability(
      newIssued.token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).allowed,
    true,
  );
});

test('bootstrap stage cannot authorize mutation / Evidence', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const deniedIssue = issueCapability(
    bootstrapRequest(h, principal, {
      allowedActions: [CAPABILITY_ACTIONS.MUTATE_TASK],
    }),
    h.deps,
  );
  assert.equal(deniedIssue.decision, CAPABILITY_DECISIONS.DENY_BOOTSTRAP_MUTATION);

  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(
    verifyCapability(
      issued.token,
      completeBootstrapExpectation(principal, {
        action: CAPABILITY_ACTIONS.SUBMIT_EVIDENCE,
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_ACTION,
  );
});

test('lease-bound stage requires proof-supplied fencing context', () => {
  const h = harness();
  const principal = attestedPrincipal();
  assert.equal(
    issueCapability(
      leaseBoundRequest(h, principal, { leaseContext: undefined }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING,
  );

  const issued = issueCapability(leaseBoundRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  const missingFence = completeLeaseExpectation(principal);
  delete missingFence.leaseContext;
  assert.equal(
    verifyCapability(issued.token, missingFence, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING,
  );
});

test('wrong / stale fencing epoch DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(leaseBoundRequest(h, principal), h.deps);
  assert.equal(
    verifyCapability(
      issued.token,
      completeLeaseExpectation(principal, {
        leaseContext: { leaseId: 'lease-1', fencingEpoch: 6 },
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_FENCING_EPOCH,
  );
  assert.equal(
    verifyCapability(
      issued.token,
      completeLeaseExpectation(principal, {
        leaseContext: { leaseId: 'lease-other', fencingEpoch: 7 },
      }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_LEASE,
  );
});

test('two distinct Workers cannot substitute principals via tokens', () => {
  const h = harness();
  const a = attestedPrincipal('worker-a');
  const b = attestedPrincipal('worker-b');
  const tokenA = issueCapability(bootstrapRequest(h, a), h.deps);
  const tokenB = issueCapability(bootstrapRequest(h, b), h.deps);
  assert.equal(tokenA.allowed, true);
  assert.equal(tokenB.allowed, true);

  assert.equal(
    verifyCapability(
      tokenA.token,
      completeBootstrapExpectation(a, { principalId: 'worker-b' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_PRINCIPAL,
  );
  assert.equal(
    verifyCapability(
      tokenB.token,
      completeBootstrapExpectation(b, { principalId: 'worker-a' }),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_PRINCIPAL,
  );
});

test('retry semantics remain within the same scope (not single-use; not exactly-once)', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  const expectation = completeBootstrapExpectation(principal);
  const first = verifyCapability(issued.token, expectation, h.deps);
  const retry = verifyCapabilityRetry(issued.token, expectation, h.deps);
  assert.equal(first.allowed, true);
  assert.equal(retry.allowed, true);

  // Cross-task retry DENY
  assert.equal(
    verifyCapabilityRetry(issued.token, { ...expectation, taskId: 'task-2' }, h.deps).decision,
    CAPABILITY_DECISIONS.DENY_WRONG_TASK,
  );
});

test('no credential / private-key disclosure in errors', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  const bad = verifyCapability('totally-invalid', { audience: 'x' }, h.deps);
  const blob = JSON.stringify(bad);
  assert.equal(blob.includes('BEGIN PRIVATE KEY'), false);
  assert.equal(blob.includes(h.keys.privateKeyPem), false);
  assert.equal(blob.includes('privateKeyPem'), false);

  // Forged signature path
  const forgedSig = `${issued.token.split('.')[0]}.${Buffer.from('x').toString('base64url')}`;
  const forged = verifyCapability(
    forgedSig,
    completeBootstrapExpectation(principal),
    h.deps,
  );
  const forgedBlob = JSON.stringify(forged);
  assert.equal(forgedBlob.includes('BEGIN PRIVATE KEY'), false);
  assert.equal(forgedBlob.includes(h.keys.privateKeyPem.split('\n')[1] || 'PRIVATE'), false);
});

test('R3 forged principal object resembling TEST_ATTESTED DENY', () => {
  const h = harness();
  const forged = {
    principalId: 'worker-a',
    trustLevel: TRUST_LEVELS.TEST_ATTESTED,
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer',
    principalGeneration: 1,
    attestedAt: 1_700_000_000_000,
    osPrincipalAuthenticated: false,
    realWorkerAuthenticated: false,
  };
  const denied = issueCapability(bootstrapRequest(h, forged), h.deps);
  assert.equal(denied.decision, CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL);
  assert.ok(denied.reasons.includes('UNBRANDED_OR_FORGED_PRINCIPAL'));
});

test('R3 spread / structuredClone / prototype / JSON principal forgery DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();

  const spread = { ...principal };
  assert.equal(
    issueCapability(bootstrapRequest(h, spread), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );

  const cloned = structuredClone(principal);
  assert.equal(
    issueCapability(bootstrapRequest(h, cloned), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );

  const protoSub = Object.create(principal);
  assert.equal(
    issueCapability(bootstrapRequest(h, protoSub), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );

  const jsonRoundTrip = JSON.parse(JSON.stringify(principal));
  assert.equal(
    issueCapability(bootstrapRequest(h, jsonRoundTrip), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );
});

test('R3 cross-Worker principal substitution cannot issue for other principalId', () => {
  const h = harness();
  const a = attestedPrincipal('worker-a');
  const b = attestedPrincipal('worker-b');
  // Branded A is immutable; attempting issue for B requires forged object with B's id.
  const forgedAsB = {
    ...a,
    principalId: 'worker-b',
    bootstrapIssuer: b.bootstrapIssuer,
  };
  assert.equal(
    issueCapability(bootstrapRequest(h, forgedAsB), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );
  // Legitimate branded principals still issue.
  assert.equal(issueCapability(bootstrapRequest(h, a), h.deps).allowed, true);
  assert.equal(issueCapability(bootstrapRequest(h, b), h.deps).allowed, true);
});

test('R5 capability issuer comes from trusted registry kid; unknown issuer DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  // Caller cannot force an unregistered issuer label through issue.
  assert.equal(
    issueCapability(bootstrapRequest(h, principal, { issuer: 'attacker-issuer' }), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID,
  );
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  assert.equal(issued.allowed, true);
  assert.equal(issued.claims.iss, h.issuer);
  assert.equal(issued.claims.kid, h.kid);
  // bootstrapIssuer remains on branded principal provenance; not a caller-substitutable
  // signing trust root. Signing trust is registry(iss,kid) only.
  assert.equal(principal.bootstrapIssuer, 'test-bootstrap-issuer');
});

test('invalid principal with OS auth claim flags DENY', () => {
  const h = harness();
  const claimedOnly = {
    principalId: 'worker-a',
    trustLevel: TRUST_LEVELS.TEST_ATTESTED,
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'x',
    principalGeneration: 1,
    osPrincipalAuthenticated: true,
    realWorkerAuthenticated: false,
  };
  assert.equal(
    issueCapability(bootstrapRequest(h, claimedOnly), h.deps).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL,
  );
});

test('source uses only built-in crypto and documents offline / non-exactly-once bounds', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.equal(source.includes("from 'node:crypto'"), true);
  assert.equal(source.includes('NON_OPERATIONAL'), true);
  assert.equal(source.includes('exactly-once'), true);
  assert.equal(source.includes('node:net'), false);
  assert.equal(source.includes('node:http'), false);
  assert.equal(source.includes('process.env'), false);
  assert.equal(/from ['"]pg['"]/.test(source), false);
  assert.equal(/require\(['"]pg['"]\)/.test(source), false);
});

test('foreign signature over valid claims DENY', () => {
  const h = harness();
  const principal = attestedPrincipal();
  const issued = issueCapability(bootstrapRequest(h, principal), h.deps);
  const payloadB64 = issued.token.split('.')[0];
  const foreign = generateEphemeralEd25519KeyPair();
  const sig = sign(
    null,
    Buffer.from(payloadB64, 'base64url'),
    createPrivateKey(foreign.privateKeyPem),
  );
  // Wrong: signing the raw b64 bytes instead of payload — still DENY
  const token = `${payloadB64}.${Buffer.from(sig).toString('base64url')}`;
  assert.equal(
    verifyCapability(
      token,
      completeBootstrapExpectation(principal),
      h.deps,
    ).decision,
    CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE,
  );
});
