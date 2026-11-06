import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_PATHS,
  CP1_REPOSITORY_ID,
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
  });
  return {
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
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
});
