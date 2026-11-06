import assert from 'node:assert/strict';
import { createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_ALG,
  CP1_OPERATION_CLASS,
  CP1_PATHS,
  CP1_PURPOSE,
  CP1_REPOSITORY_ID,
  b64urlEncode,
  canonicalJson,
} from '../src/config.js';
import {
  createTestOnlyAttestationVerifier,
  verifyOperationalPrincipal,
} from '../src/operationalWorkerIdentity.js';
import {
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryRevocationRegistry,
  createTestOnlyOwnerApprovalIssuer,
  generateEphemeralEd25519KeyPairForTests,
  issueOwnerApprovalArtifactForTests,
  verifyOwnerApprovalArtifact,
} from '../src/ownerApprovalArtifact.js';
import {
  CAPABILITY_DECISIONS,
  createInMemoryReplayRegistry,
  createTestOnlyCapabilityIssuer,
  generateEphemeralCapabilityIssuerKeyPairForTests,
  issueCapabilityForTests,
  verifyCapability,
} from '../src/operationalCapabilityIssuer.js';
import * as publicApi from '../src/index.js';

const BASELINE_SHA = '3ddbbcc519b1b9da785ba8bb661858be3ba3efa4';
const NOW = 1_700_000_000_000;
const WORKER_ID = 'worker-test-001';
const ISSUER = 'test-attestation-issuer';
const SECRET = 'test-attestation-hmac-secret-not-a-real-key';
const SCOPE = Object.freeze([
  'tecp-ops/src/config.js',
  'tecp-ops/src/operationalWorkerIdentity.js',
  'tecp-ops/src/ownerApprovalArtifact.js',
]);

function evidenceSignature(attestation) {
  const body = [
    attestation.attestationKind,
    attestation.principalId,
    String(attestation.principalGeneration),
    attestation.bootstrapIssuer,
    attestation.repositoryId,
    attestation.baselineSha,
    attestation.attestationId,
    String(attestation.attestedAt),
    String(attestation.nbf),
    String(attestation.exp),
    attestation.taskId || '',
  ].join('|');
  return createHmac('sha256', SECRET).update(body).digest('base64url');
}

function makeAttestation(overrides = {}) {
  const attestation = {
    attestationKind: 'TEST_ONLY',
    principalId: WORKER_ID,
    principalGeneration: 1,
    bootstrapIssuer: ISSUER,
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    attestationId: `att-${randomBytes(8).toString('hex')}`,
    attestedAt: NOW,
    nbf: NOW,
    exp: NOW + 120_000,
    taskId: 'task-cp1-1',
    evidenceSignature: 'pending',
    ...overrides,
  };
  if (!overrides.evidenceSignature || overrides.evidenceSignature === 'pending') {
    attestation.evidenceSignature = evidenceSignature(attestation);
  }
  return attestation;
}

function fullHarness() {
  const clock = createInjectedClock(NOW);
  const attestationVerifier = createTestOnlyAttestationVerifier({
    trustedIssuer: ISSUER,
    knownPrincipalIds: [WORKER_ID],
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    verifyEvidenceSignature: (att) => att.evidenceSignature === evidenceSignature(att),
  });
  const ownerKeys = generateEphemeralEd25519KeyPairForTests();
  const capKeys = generateEphemeralCapabilityIssuerKeyPairForTests();
  const keyRegistry = createInMemoryKeyRegistry();
  keyRegistry.registerPublicKey('owner-kid-1', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-1', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-1',
    iss: 'test-owner-issuer',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-1',
    iss: 'test-cap-issuer',
    aud: 'tecp-ops-cp1',
    privateKeyPem: capKeys.privateKeyPem,
    keyRegistry,
    replayRegistry,
    clock,
  });
  return {
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
    capKeys,
  };
}

function verifyDeps(h, { cap, id, approvalIssued }) {
  return {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
    replayRegistry: h.replayRegistry,
    approvalToken: approvalIssued.token,
    approvalDeps: {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    },
    principal: id.principal,
  };
}

function mintChain(h, opts = {}) {
  const id = verifyOperationalPrincipal({
    attestation: makeAttestation(),
    taskId: 'task-cp1-1',
    actorId: WORKER_ID,
  }, {
    clock: h.clock,
    attestationVerifier: h.attestationVerifier,
  });
  assert.equal(id.ok, true);
  const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
    actorId: WORKER_ID,
    taskId: 'task-cp1-1',
    baselineSha: BASELINE_SHA,
    authorizedFileScope: [...SCOPE],
    nbf: NOW,
    exp: opts.approvalExp ?? NOW + 240_000,
  });
  assert.equal(approvalIssued.ok, true);
  const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {
    actorId: WORKER_ID,
    taskId: 'task-cp1-1',
  }, {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
  });
  assert.equal(approvalVerified.ok, true);
  const cap = issueCapabilityForTests(h.capIssuer, {
    principal: id.principal,
    approvalArtifact: approvalVerified.artifact,
    action: 'CP1_OFFLINE_VERIFY',
    resourcePaths: opts.resourcePaths || [...SCOPE],
    nbf: NOW,
    exp: opts.capabilityExp ?? NOW + 60_000,
    taskId: 'task-cp1-1',
    jti: opts.jti,
  });
  return { id, approvalIssued, approvalVerified, cap };
}

describe('CP1 operationalCapabilityIssuer', () => {
  it('CP1-P01 valid exact-scope capability chain ALLOW', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    assert.equal(cap.ok, true);
    assert.match(cap.classification, /NOT_EXECUTION_AUTHORITY/);
    const verified = verifyCapability(cap.token, {
      taskId: 'task-cp1-1',
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.decision, CAPABILITY_DECISIONS.ALLOW);
    assert.match(verified.classification, /OFFLINE_TEST_ONLY_CAPABILITY/);
  });

  it('CP1-N04 missing Owner approval DENY', () => {
    const h = fullHarness();
    const { cap, id } = mintChain(h);
    const verified = verifyCapability(cap.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: null,
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_MISSING_OWNER_APPROVAL);
  });

  it('CP1-N11 wrong operation / action DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    const verified = verifyCapability(cap.token, { action: 'OTHER_ACTION' }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_WRONG_OPERATION);
  });

  it('CP1-N10/N12 wrong resource / scope expansion DENY', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation(),
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 90_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const expanded = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE, 'tecp/src/rule02Parser.js'],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(expanded.ok, false);

    const wildcard = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: ['tecp-ops/src/*'],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(wildcard.ok, false);

    const traversal = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: ['tecp-ops/../tecp/src/rule02Parser.js'],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(traversal.ok, false);
  });

  it('CP1-N09 Task A approval cannot authorize Task B', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    const verified = verifyCapability(cap.token, { taskId: 'task-B' }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_WRONG_TASK);
  });

  it('CP1-N14 expired capability DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h, {
      capabilityExp: NOW + 60_000,
      approvalExp: NOW + 240_000,
    });
    h.clock.setNowMs(NOW + 120_000);
    const verified = verifyCapability(cap.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_EXPIRED);
  });

  it('CP1-N17 revoked capability DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    h.revocationRegistry.revoke(cap.claims.jti);
    const verified = verifyCapability(cap.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_REVOKED);
  });

  it('CP1-N18 replay of presented capability DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    const deps = {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    };
    const first = verifyCapability(cap.token, {}, deps);
    assert.equal(first.ok, true);
    const second = verifyCapability(cap.token, {}, deps);
    assert.equal(second.decision, CAPABILITY_DECISIONS.DENY_REPLAY);
  });

  it('CP1-N18 duplicate jti at issue DENY', () => {
    const h = fullHarness();
    const first = mintChain(h, { jti: 'fixed-jti-1' });
    assert.equal(first.cap.ok, true);
    const second = mintChain(h, { jti: 'fixed-jti-1' });
    assert.equal(second.cap.decision, CAPABILITY_DECISIONS.DENY_DUPLICATE_JTI);
  });

  it('CP1-N03 caller trust anchor DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    const verified = verifyCapability({
      token: cap.token,
      trustAnchor: 'evil',
    }, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR);
  });

  it('copied object / Rule02 YES insufficient DENY', () => {
    const h = fullHarness();
    assert.equal(
      verifyCapability(true, {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: 'x',
        principal: { principalId: WORKER_ID },
      }).decision,
      CAPABILITY_DECISIONS.DENY_RULE02_YES_INSUFFICIENT,
    );
    assert.equal(
      verifyCapability({ rule02Yes: true }, {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: 'x',
        principal: { principalId: WORKER_ID },
      }).decision,
      CAPABILITY_DECISIONS.DENY_RULE02_YES_INSUFFICIENT,
    );
  });

  it('unbranded principal DENY', () => {
    const h = fullHarness();
    const { cap, approvalIssued } = mintChain(h);
    const verified = verifyCapability(cap.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: {
        principalId: WORKER_ID,
        trustLevel: 'TEST_ATTESTED',
        repositoryId: CP1_REPOSITORY_ID,
        baselineSha: BASELINE_SHA,
      },
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY);
  });

  it('CP1-N20/N21 missing clock/revocation DENY', () => {
    const h = fullHarness();
    const { cap, id, approvalIssued } = mintChain(h);
    assert.equal(
      verifyCapability(cap.token, {}, {
        keyRegistry: h.keyRegistry,
        clock: null,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: approvalIssued.token,
        principal: id.principal,
      }).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_CLOCK,
    );
    assert.equal(
      verifyCapability(cap.token, {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: null,
        replayRegistry: h.replayRegistry,
        approvalToken: approvalIssued.token,
        principal: id.principal,
      }).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION,
    );
  });

  it('ambiguous consume fail-closed', () => {
    const h = fullHarness();
    h.replayRegistry.setForceAmbiguous(true);
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation(),
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 90_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(cap.decision, CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME);
  });

  it('CP1-N24/N25 DLP reuse and MCP/DB/Worker permission DENY', () => {
    const h = fullHarness();
    const { id, approvalIssued } = mintChain(h);
    assert.equal(
      verifyCapability('header.TECP_WORKER_CAPABILITY_V1.payload', {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: approvalIssued.token,
        principal: id.principal,
      }).ok,
      false,
    );
    const { cap } = mintChain(h);
    assert.equal(
      verifyCapability({
        token: cap.token,
        requestMcpPermission: true,
      }, {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: approvalIssued.token,
        approvalDeps: {
          keyRegistry: h.keyRegistry,
          clock: h.clock,
          revocationRegistry: h.revocationRegistry,
        },
        principal: id.principal,
      }).decision,
      CAPABILITY_DECISIONS.DENY_MCP_OR_DB_OR_WORKER_PERMISSION,
    );
  });

  it('safe import: public API exports without side-effect ops', () => {
    assert.equal(typeof publicApi.verifyOperationalPrincipal, 'function');
    assert.equal(typeof publicApi.verifyOwnerApprovalArtifact, 'function');
    assert.equal(typeof publicApi.verifyCapability, 'function');
    assert.equal(publicApi.CP1_PATHS.length, 11);
    assert.equal(publicApi.CP1_CONFIG.productionAuthorized, false);
  });

  it('CP1-N23 default fail-closed', () => {
    const result = verifyCapability(null, {}, {});
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED);
  });

  // --- Finding A: atomic replay enforcement ---
  it('A1/A2/A10 valid registry first ALLOW second DENY_REPLAY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    const first = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(first.ok, true);
    assert.equal(first.decision, CAPABILITY_DECISIONS.ALLOW);
    const second = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(second.ok, false);
    assert.equal(second.decision, CAPABILITY_DECISIONS.DENY_REPLAY);
  });

  it('A3 has()-only registry consumeOnVerify absent DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = { has: () => false };
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY);
  });

  it('A4 has()-only registry consumeOnVerify false DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = { has: () => false, consume: () => true };
    const result = verifyCapability(chain.cap.token, { consumeOnVerify: false }, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY);
  });

  it('A5 markPresented returns undefined DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = { has: () => false, markPresented: () => undefined };
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME);
  });

  it('A6 markPresented ambiguous throw DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = {
      has: () => false,
      markPresented() {
        const err = new Error('AMBIGUOUS_CONSUME');
        err.code = 'AMBIGUOUS_CONSUME';
        throw err;
      },
    };
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME);
  });

  it('A7 markPresented throws DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = {
      has: () => false,
      markPresented() {
        throw new Error('boom');
      },
    };
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY);
  });

  it('A8 registry unavailable DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    h.replayRegistry.setAvailable(false);
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.decision, CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY);
  });

  it('A9 duplicate issue-time jti DENY', () => {
    const h = fullHarness();
    assert.equal(mintChain(h, { jti: 'dup-a9' }).cap.ok, true);
    assert.equal(mintChain(h, { jti: 'dup-a9' }).cap.decision, CAPABILITY_DECISIONS.DENY_DUPLICATE_JTI);
  });

  it('A11 ambiguous presentation never yields ALLOW', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.replayRegistry = { has: () => false, markPresented: () => 'maybe' };
    const result = verifyCapability(chain.cap.token, {}, deps);
    assert.equal(result.ok, false);
    assert.notEqual(result.decision, CAPABILITY_DECISIONS.ALLOW);
  });

  // --- Finding B: revocation fail-closed (capability path) ---
  it('B5/B6 capability revoked=false ALLOW revoked=true DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const ok = verifyCapability(chain.cap.token, {}, verifyDeps(h, chain));
    assert.equal(ok.ok, true);
    const h2 = fullHarness();
    const chain2 = mintChain(h2);
    h2.revocationRegistry.revoke(chain2.cap.claims.jti);
    const denied = verifyCapability(chain2.cap.token, {}, verifyDeps(h2, chain2));
    assert.equal(denied.decision, CAPABILITY_DECISIONS.DENY_REVOKED);
  });

  it('B7 capability undefined/null/non-boolean revocation DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    for (const value of [undefined, null, 'no', 0, 1, {}]) {
      const deps = verifyDeps(h, chain);
      deps.revocationRegistry = { isRevoked: () => value };
      // Fresh replay registry so prior loop iterations do not DENY_REPLAY
      deps.replayRegistry = createInMemoryReplayRegistry();
      deps.replayRegistry.reserveJti(chain.cap.claims.jti);
      const result = verifyCapability(chain.cap.token, {}, deps);
      assert.equal(result.ok, false, `expected DENY for ${String(value)}`);
      assert.notEqual(result.decision, CAPABILITY_DECISIONS.ALLOW);
    }
  });

  it('B8 capability revocation throws DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.revocationRegistry = {
      isRevoked() {
        throw Object.assign(new Error('x'), { code: 'REVOCATION_UNAVAILABLE' });
      },
    };
    assert.equal(
      verifyCapability(chain.cap.token, {}, deps).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION,
    );
  });

  it('B9 capability Promise revocation result DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    deps.revocationRegistry = { isRevoked: () => Promise.resolve(false) };
    assert.equal(
      verifyCapability(chain.cap.token, {}, deps).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION,
    );
  });

  // --- Finding C: task binding + principal expiry ---
  it('C1 matching Task A chain ALLOW', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(verifyCapability(chain.cap.token, {}, verifyDeps(h, chain)).ok, true);
  });

  it('C2 Principal Task A + approval Task B DENY at issuance', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation({ taskId: 'task-A' }),
      taskId: 'task-A',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    assert.equal(id.ok, true);
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-B',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 90_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-B',
    });
    assert.equal(cap.decision, CAPABILITY_DECISIONS.DENY_WRONG_TASK);
  });

  it('C3 Principal Task A cannot verify Task B capability', () => {
    const h = fullHarness();
    // Mint a Task-B capability with a Task-B principal, then swap verify principal to Task-A.
    const idB = verifyOperationalPrincipal({
      attestation: makeAttestation({ taskId: 'task-B' }),
      taskId: 'task-B',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-B',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 90_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: idB.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-B',
    });
    assert.equal(cap.ok, true);
    const idA = verifyOperationalPrincipal({
      attestation: makeAttestation({ taskId: 'task-A' }),
      taskId: 'task-A',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const deps = verifyDeps(h, { cap, id: idA, approvalIssued });
    assert.equal(
      verifyCapability(cap.token, {}, deps).decision,
      CAPABILITY_DECISIONS.DENY_WRONG_TASK,
    );
  });

  it('C4 expired principal DENY at issuance', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation({ exp: NOW + 30_000 }),
      taskId: 'task-cp1-1',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    assert.equal(id.ok, true);
    h.clock.setNowMs(NOW + 40_000);
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 240_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW + 40_000,
      exp: NOW + 90_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(cap.decision, CAPABILITY_DECISIONS.DENY_EXPIRED);
  });

  it('C5 branded principal past exp DENY at verification', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation({ exp: NOW + 30_000 }),
      taskId: 'task-cp1-1',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 240_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 180_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(cap.ok, true);
    h.clock.setNowMs(NOW + 60_000);
    assert.equal(
      verifyCapability(cap.token, {}, verifyDeps(h, { cap, id, approvalIssued })).decision,
      CAPABILITY_DECISIONS.DENY_EXPIRED,
    );
  });

  it('C6 principal before nbf DENY', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation({ nbf: NOW + 10_000, exp: NOW + 120_000 }),
      taskId: 'task-cp1-1',
    }, {
      clock: createInjectedClock(NOW + 10_000),
      attestationVerifier: h.attestationVerifier,
    });
    // Re-brand at nbf, then rewind issuer/verify clock before nbf.
    assert.equal(id.ok, true);
    h.clock.setNowMs(NOW);
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 240_000,
    });
    // Approval verify needs clock >= approval.nbf; use future clock for approval only.
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: createInjectedClock(NOW + 10_000),
      revocationRegistry: h.revocationRegistry,
    });
    // Issue with principal that is not yet valid on issuer clock (NOW).
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW + 10_000,
      exp: NOW + 90_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(cap.decision, CAPABILITY_DECISIONS.DENY_NBF_VIOLATION);
  });

  it('C7 missing trusted clock at issuer construction DENY/throws', () => {
    assert.throws(() => createTestOnlyCapabilityIssuer({
      kid: 'cap-kid-1',
      iss: 'test-cap-issuer',
      aud: 'tecp-ops-cp1',
      privateKeyPem: generateEphemeralCapabilityIssuerKeyPairForTests().privateKeyPem,
      keyRegistry: createInMemoryKeyRegistry(),
      replayRegistry: createInMemoryReplayRegistry(),
      clock: null,
    }), /CLOCK_REQUIRED/);
  });

  it('C8/C9 matching task but different baseline DENY at issue', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      taskId: 'task-cp1-1',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 90_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(approvalVerified.ok, true);
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 60_000,
      taskId: 'task-cp1-1',
    });
    assert.equal(cap.decision, CAPABILITY_DECISIONS.DENY_WRONG_SHA);
  });

  it('C10 copied non-branded principal DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const copy = { ...chain.id.principal };
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        principal: copy,
      }).decision,
      CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY,
    );
  });

  it('C11 valid principal remains TEST_ATTESTED only', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(chain.id.principal.trustLevel, 'TEST_ATTESTED');
    assert.equal(chain.id.principal.osPrincipalAuthenticated, false);
    assert.equal(chain.id.principal.realWorkerAuthenticated, false);
    assert.match(chain.cap.classification, /NOT_EXECUTION_AUTHORITY/);
  });

  // --- Finding D: Owner scope at verify ---
  it('D1 capability subset of Owner approval ALLOW', () => {
    const h = fullHarness();
    const chain = mintChain(h, {
      resourcePaths: [SCOPE[0], SCOPE[1]],
    });
    assert.equal(verifyCapability(chain.cap.token, {}, verifyDeps(h, chain)).ok, true);
  });

  it('D2/D3/D4 signed over-scope still inside CP1 allowlist DENY at verify', () => {
    const h = fullHarness();
    const narrow = [SCOPE[0], SCOPE[1]];
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      taskId: 'task-cp1-1',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: narrow,
      nbf: NOW,
      exp: NOW + 240_000,
    });
    assert.equal(approvalIssued.ok, true);
    // Privileged ephemeral issuer key crafts an over-scope capability (issue() would DENY).
    const overScopePaths = [...SCOPE]; // includes SCOPE[2] outside narrow approval
    const claims = {
      action: 'CP1_OFFLINE_VERIFY',
      alg: CP1_ALG,
      aud: 'tecp-ops-cp1',
      baselineSha: BASELINE_SHA,
      exp: NOW + 60_000,
      iss: 'test-cap-issuer',
      jti: `overscope-${randomBytes(6).toString('hex')}`,
      kid: 'cap-kid-1',
      nbf: NOW,
      operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
      ownerApprovalJti: approvalIssued.claims.jti,
      purpose: CP1_PURPOSE,
      repositoryId: CP1_REPOSITORY_ID,
      resourcePaths: overScopePaths,
      sub: WORKER_ID,
      taskId: 'task-cp1-1',
      tokenType: 'TECP_OPS_CAPABILITY_V1',
    };
    const payload = canonicalJson(claims);
    const privateKey = createPrivateKey(h.capKeys.privateKeyPem);
    const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${b64urlEncode(sign(null, Buffer.from(payload, 'utf8'), privateKey))}`;
    h.replayRegistry.reserveJti(claims.jti);
    const verified = verifyCapability(token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: h.replayRegistry,
      approvalToken: approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: id.principal,
    });
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_SCOPE_EXPANSION);
  });

  it('D5 forged or missing Owner approval DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        approvalToken: null,
      }).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_OWNER_APPROVAL,
    );
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        approvalToken: 'not.a.valid.token',
      }).decision,
      CAPABILITY_DECISIONS.DENY_INVALID_OWNER_APPROVAL,
    );
  });

  it('D6 exact valid subset remains compatible', () => {
    const h = fullHarness();
    const chain = mintChain(h, { resourcePaths: [...SCOPE] });
    const verified = verifyCapability(chain.cap.token, {
      resourcePaths: [...SCOPE],
    }, verifyDeps(h, chain));
    assert.equal(verified.ok, true);
  });

  // --- Cross-finding composition ---
  it('X1 full chain ALLOW once then replay DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const deps = verifyDeps(h, chain);
    assert.equal(verifyCapability(chain.cap.token, {}, deps).ok, true);
    assert.equal(verifyCapability(chain.cap.token, {}, deps).decision, CAPABILITY_DECISIONS.DENY_REPLAY);
  });

  it('X2 invalid Owner approval DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        approvalToken: 'aa.bb',
      }).ok,
      false,
    );
  });

  it('X3 revoked Owner approval DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    h.revocationRegistry.revoke(chain.approvalIssued.claims.jti);
    assert.equal(
      verifyCapability(chain.cap.token, {}, verifyDeps(h, chain)).decision,
      CAPABILITY_DECISIONS.DENY_INVALID_OWNER_APPROVAL,
    );
  });

  it('X4 revoked capability DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    h.revocationRegistry.revoke(chain.cap.claims.jti);
    assert.equal(
      verifyCapability(chain.cap.token, {}, verifyDeps(h, chain)).decision,
      CAPABILITY_DECISIONS.DENY_REVOKED,
    );
  });

  it('X5 wrong task DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(
      verifyCapability(chain.cap.token, { taskId: 'task-other' }, verifyDeps(h, chain)).decision,
      CAPABILITY_DECISIONS.DENY_WRONG_TASK,
    );
  });

  it('X6 expired principal DENY', () => {
    const h = fullHarness();
    const id = verifyOperationalPrincipal({
      attestation: makeAttestation({ exp: NOW + 20_000 }),
      taskId: 'task-cp1-1',
    }, { clock: h.clock, attestationVerifier: h.attestationVerifier });
    const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
      actorId: WORKER_ID,
      taskId: 'task-cp1-1',
      baselineSha: BASELINE_SHA,
      authorizedFileScope: [...SCOPE],
      nbf: NOW,
      exp: NOW + 240_000,
    });
    const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    const cap = issueCapabilityForTests(h.capIssuer, {
      principal: id.principal,
      approvalArtifact: approvalVerified.artifact,
      action: 'CP1_OFFLINE_VERIFY',
      resourcePaths: [...SCOPE],
      nbf: NOW,
      exp: NOW + 180_000,
      taskId: 'task-cp1-1',
    });
    h.clock.setNowMs(NOW + 30_000);
    assert.equal(
      verifyCapability(cap.token, {}, verifyDeps(h, { cap, id, approvalIssued })).decision,
      CAPABILITY_DECISIONS.DENY_EXPIRED,
    );
  });

  it('X7 missing revocation DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        revocationRegistry: null,
      }).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION,
    );
  });

  it('X8 non-atomic replay provider DENY', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    assert.equal(
      verifyCapability(chain.cap.token, {}, {
        ...verifyDeps(h, chain),
        replayRegistry: { has: () => false },
      }).decision,
      CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY,
    );
  });

  it('X9 positive ALLOW never claims execution authority', () => {
    const h = fullHarness();
    const chain = mintChain(h);
    const verified = verifyCapability(chain.cap.token, {}, verifyDeps(h, chain));
    assert.equal(verified.ok, true);
    assert.match(verified.classification, /NOT_EXECUTION_AUTHORITY/);
  });
});
