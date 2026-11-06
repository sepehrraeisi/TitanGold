import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_PATHS,
  CP1_REPOSITORY_ID,
  b64urlEncode,
  canonicalJson,
} from '../src/config.js';
import {
  APPROVAL_DECISIONS,
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryRevocationRegistry,
  createTestOnlyOwnerApprovalIssuer,
  generateEphemeralEd25519KeyPairForTests,
  isBrandedOwnerApprovalArtifact,
  issueOwnerApprovalArtifactForTests,
  verifyOwnerApprovalArtifact,
} from '../src/ownerApprovalArtifact.js';

const BASELINE_SHA = '3ddbbcc519b1b9da785ba8bb661858be3ba3efa4';
const NOW = 1_700_000_000_000;
const SCOPE = Object.freeze([
  'tecp-ops/src/config.js',
  'tecp-ops/src/operationalWorkerIdentity.js',
]);

function harness() {
  const keys = generateEphemeralEd25519KeyPairForTests();
  const keyRegistry = createInMemoryKeyRegistry();
  keyRegistry.registerPublicKey('owner-kid-1', keys.publicKeyPem, {
    domain: 'TECP_OPS_OWNER_APPROVAL',
  });
  const clock = createInjectedClock(NOW);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const issuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-1',
    iss: 'test-owner-issuer',
    privateKeyPem: keys.privateKeyPem,
    keyRegistry,
  });
  return { keys, keyRegistry, clock, revocationRegistry, issuer };
}

function issueValid(h, overrides = {}) {
  return issueOwnerApprovalArtifactForTests(h.issuer, {
    actorId: 'worker-test-001',
    taskId: 'task-cp1-1',
    baselineSha: BASELINE_SHA,
    authorizedFileScope: [...SCOPE],
    nbf: NOW,
    exp: NOW + 60_000,
    ...overrides,
  });
}

describe('CP1 ownerApprovalArtifact', () => {
  it('CP1-P01 valid ephemeral Owner approval ALLOW', () => {
    const h = harness();
    const issued = issueValid(h);
    assert.equal(issued.ok, true);
    const verified = verifyOwnerApprovalArtifact(issued.token, {
      actorId: 'worker-test-001',
      taskId: 'task-cp1-1',
      repositoryId: CP1_REPOSITORY_ID,
      baselineSha: BASELINE_SHA,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.decision, APPROVAL_DECISIONS.ALLOW);
    assert.equal(isBrandedOwnerApprovalArtifact(verified.artifact), true);
    assert.match(verified.artifact.classification, /NOT_EXECUTION_AUTHORITY/);
  });

  it('non-privileged issue DENY', () => {
    const result = issueOwnerApprovalArtifactForTests({ fake: true }, {});
    assert.equal(result.ok, false);
  });

  it('CP1-N05 invalid Owner signature DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const [payload] = issued.token.split('.');
    const bad = `${payload}.${b64urlEncode(Buffer.alloc(64, 7))}`;
    const verified = verifyOwnerApprovalArtifact(bad, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_INVALID_SIGNATURE);
  });

  it('CP1-N03 trust anchor in payload DENY', () => {
    const h = harness();
    const verified = verifyOwnerApprovalArtifact({
      token: 'x.y',
      trustAnchor: 'evil',
    }, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR);
  });

  it('unknown kid DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const emptyRegistry = createInMemoryKeyRegistry();
    const verified = verifyOwnerApprovalArtifact(issued.token, {}, {
      keyRegistry: emptyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_UNKNOWN_KID);
  });

  it('CP1-N06/N07 wrong repository/SHA expectation DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const deps = {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    };
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, { repositoryId: 'other/repo' }, deps).decision,
      APPROVAL_DECISIONS.DENY_WRONG_REPOSITORY,
    );
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, {
        baselineSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }, deps).decision,
      APPROVAL_DECISIONS.DENY_WRONG_SHA,
    );
  });

  it('CP1-N08/N09 wrong actor/task DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const deps = {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    };
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, { actorId: 'other' }, deps).decision,
      APPROVAL_DECISIONS.DENY_WRONG_ACTOR,
    );
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, { taskId: 'other-task' }, deps).decision,
      APPROVAL_DECISIONS.DENY_WRONG_TASK,
    );
  });

  it('CP1-N12 scope expansion beyond CP1 DENY at issue', () => {
    const h = harness();
    const issued = issueValid(h, {
      authorizedFileScope: [...CP1_PATHS, 'tecp/src/rule02Parser.js'],
    });
    assert.equal(issued.ok, false);
  });

  it('CP1-N13 expired approval DENY', () => {
    const h = harness();
    const issued = issueValid(h, { exp: NOW + 10_000 });
    h.clock.setNowMs(NOW + 20_000);
    const verified = verifyOwnerApprovalArtifact(issued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_EXPIRED);
  });

  it('CP1-N15 nbf violation DENY', () => {
    const h = harness();
    const issued = issueValid(h, { nbf: NOW + 30_000, exp: NOW + 60_000 });
    const verified = verifyOwnerApprovalArtifact(issued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_NBF_VIOLATION);
  });

  it('CP1-N16 revoked approval DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    h.revocationRegistry.revoke(issued.claims.jti);
    const verified = verifyOwnerApprovalArtifact(issued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_REVOKED);
  });

  it('CP1-N19 duplicate serialized authority fields DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const payload = Buffer.from(issued.token.split('.')[0], 'base64url').toString('utf8');
    // Inject duplicate key by string surgery after first key.
    const dup = payload.replace('{', '{"kid":"evil","kid":"owner-kid-1",');
    // Actually ensure duplicate kid appears: rebuild manually
    const objText = `{"actorId":"worker-test-001","alg":"Ed25519","authorizedFileScope":${JSON.stringify(SCOPE)},"baselineSha":"${BASELINE_SHA}","checkpoint":"CP1_WORKER_IDENTITY_CAPABILITY_OWNER_APPROVAL","domain":"TECP_OPS_OWNER_APPROVAL","exp":${NOW + 60000},"iss":"test-owner-issuer","jti":"jti-dup","kid":"owner-kid-1","kid":"evil","kind":"TECP_OPS_OWNER_APPROVAL_V1","nbf":${NOW},"operationClass":"CP1_OFFLINE_SECURITY_CONTRACT","purpose":"TEST_ONLY","repositoryId":"${CP1_REPOSITORY_ID}","sliceId":"TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR","taskId":"task-cp1-1"}`;
    const token = `${b64urlEncode(Buffer.from(objText, 'utf8'))}.aaaa`;
    const verified = verifyOwnerApprovalArtifact(token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_DUPLICATE_FIELDS);
  });

  it('CP1-N20/N21/N22 missing deps DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, {}, {
        keyRegistry: h.keyRegistry,
        clock: null,
        revocationRegistry: h.revocationRegistry,
      }).decision,
      APPROVAL_DECISIONS.DENY_MISSING_CLOCK,
    );
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, {}, {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: null,
      }).decision,
      APPROVAL_DECISIONS.DENY_MISSING_REVOCATION,
    );
    assert.equal(
      verifyOwnerApprovalArtifact(issued.token, {}, {
        keyRegistry: null,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      }).decision,
      APPROVAL_DECISIONS.DENY_MISSING_KEY_REGISTRY,
    );
  });

  it('revocation unavailable fail-closed', () => {
    const h = harness();
    const issued = issueValid(h);
    h.revocationRegistry.setAvailable(false);
    const verified = verifyOwnerApprovalArtifact(issued.token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_MISSING_REVOCATION);
  });

  it('CP1-N24 cross-slice DLP reuse DENY', () => {
    const h = harness();
    const verified = verifyOwnerApprovalArtifact({
      kind: 'DLP011_OWNER_INSTRUCTION',
      sliceId: 'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE',
    }, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_CROSS_SLICE_DLP_REUSE);
  });

  it('unsupported algorithm DENY', () => {
    const h = harness();
    // Sign a claims object with wrong alg field using a different key still Ed25519 but alg claim RSA
    const claims = {
      actorId: 'worker-test-001',
      alg: 'RS256',
      authorizedFileScope: [...SCOPE],
      baselineSha: BASELINE_SHA,
      checkpoint: 'CP1_WORKER_IDENTITY_CAPABILITY_OWNER_APPROVAL',
      domain: 'TECP_OPS_OWNER_APPROVAL',
      exp: NOW + 60_000,
      iss: 'test-owner-issuer',
      jti: 'jti-alg',
      kid: 'owner-kid-1',
      kind: 'TECP_OPS_OWNER_APPROVAL_V1',
      nbf: NOW,
      operationClass: 'CP1_OFFLINE_SECURITY_CONTRACT',
      purpose: 'TEST_ONLY',
      repositoryId: CP1_REPOSITORY_ID,
      sliceId: 'TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR',
      taskId: 'task-cp1-1',
    };
    const payload = canonicalJson(claims);
    const { privateKey } = generateKeyPairSync('ed25519');
    const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${b64urlEncode(sign(null, Buffer.from(payload), privateKey))}`;
    const verified = verifyOwnerApprovalArtifact(token, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_UNSUPPORTED_ALGORITHM);
  });

  it('runtime mode DENY', () => {
    const h = harness();
    const issued = issueValid(h);
    const verified = verifyOwnerApprovalArtifact(issued.token, { mode: 'RUNTIME' }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_RUNTIME_MODE);
  });

  it('CP1-N23 empty token DENY', () => {
    const h = harness();
    const verified = verifyOwnerApprovalArtifact(null, {}, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(verified.decision, APPROVAL_DECISIONS.DENY_DEFAULT_FAIL_CLOSED);
  });
});
