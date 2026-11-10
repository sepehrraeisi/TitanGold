import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  b64urlEncode,
  canonicalJson,
} from '../src/config.js';
import {
  RLA_DECISIONS,
  S1_ALG,
  S1_KIND,
  S1_STAGES,
  assertNoOperationalDispatch,
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryReplayRegistry,
  createInMemoryRevocationRegistry,
  createOfflineTrustedLeaseFixtureForTests,
  createTestOnlyResourceLeaseAuthorityIssuer,
  generateEphemeralResourceLeaseAuthorityKeyPairForTests,
  isBrandedResourceLeaseAuthorityArtifact,
  isPrivilegedTestOnlyResourceLeaseAuthorityIssuer,
  verifyResourceLeaseAuthority,
} from '../src/resourceLeaseAuthority.js';

const NOW = 1_700_000_000_000;
const GOV_REV = 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110';
const PRINCIPAL = 'principal-s1-001';
const TASK = 'task-s1-001';
const ACTION = 'REQUEST_ELIGIBLE_TASK_LEASE';
const RESOURCE_TYPE = 'WRITE_RESOURCE';
const RESOURCE_KEY = 'resource-s1-alpha';
const OTHER_RESOURCE_KEY = 'resource-s1-beta';
const LEASE_KEY = 'lease-s1-001';
const FENCING = 7;

function harness() {
  const keys = generateEphemeralResourceLeaseAuthorityKeyPairForTests();
  const otherKeys = generateEphemeralResourceLeaseAuthorityKeyPairForTests();
  const keyRegistry = createInMemoryKeyRegistry();
  keyRegistry.registerPublicKey('rla-kid-1', keys.publicKeyPem);
  keyRegistry.registerPublicKey('rla-kid-other', otherKeys.publicKeyPem);
  const clock = createInjectedClock(NOW);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const issuer = createTestOnlyResourceLeaseAuthorityIssuer({
    kid: 'rla-kid-1',
    iss: 'test-rla-issuer',
    privateKeyPem: keys.privateKeyPem,
    keyRegistry,
  });
  return {
    keys,
    otherKeys,
    keyRegistry,
    clock,
    revocationRegistry,
    replayRegistry,
    issuer,
  };
}

function baseIssueInput(overrides = {}) {
  return {
    stage: S1_STAGES.BOOTSTRAP,
    principalId: PRINCIPAL,
    taskId: TASK,
    action: ACTION,
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: GOV_REV,
    issuedAt: NOW,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function baseExpectation(overrides = {}) {
  return {
    stage: S1_STAGES.BOOTSTRAP,
    principalId: PRINCIPAL,
    taskId: TASK,
    action: ACTION,
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: GOV_REV,
    iss: 'test-rla-issuer',
    kid: 'rla-kid-1',
    ...overrides,
  };
}

function verifyDeps(h) {
  return {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
    replayRegistry: h.replayRegistry,
  };
}

function resignWith(privateKeyPem, claims) {
  const payload = canonicalJson(claims);
  const signature = b64urlEncode(sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(privateKeyPem)));
  return `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${signature}`;
}

describe('S1 ResourceLeaseAuthority offline contract', () => {
  it('1) valid BOOTSTRAP issue/verify', () => {
    const h = harness();
    assert.equal(isPrivilegedTestOnlyResourceLeaseAuthorityIssuer(h.issuer), true);
    const issued = h.issuer.issue(baseIssueInput());
    assert.equal(issued.ok, true);
    assert.equal(issued.decision, RLA_DECISIONS.ALLOW);
    assert.equal(issued.operationalDispatchAuthorized, false);
    assert.equal(issued.claims.stage, S1_STAGES.BOOTSTRAP);
    assert.equal(Object.prototype.hasOwnProperty.call(issued.claims, 'leaseKey'), false);
    assert.equal(isBrandedResourceLeaseAuthorityArtifact(issued.artifact), true);

    const verified = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation(),
      verifyDeps(h),
    );
    assert.equal(verified.ok, true);
    assert.equal(verified.decision, RLA_DECISIONS.ALLOW);
    assert.equal(verified.claims.kind, S1_KIND);
    assert.equal(verified.claims.alg, S1_ALG);
    assert.equal(verified.operationalDispatchAuthorized, false);
    const guard = assertNoOperationalDispatch(verified);
    assert.equal(guard.ok, true);
    assert.equal(guard.operationalDispatchAuthorized, false);
  });

  it('2) valid LEASE_BOUND with offline trusted fixture', () => {
    const h = harness();
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    });
    const issued = h.issuer.issue(baseIssueInput({
      stage: S1_STAGES.LEASE_BOUND,
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
      action: 'RELEASE_OWNED_LEASE',
    }));
    assert.equal(issued.ok, true);
    const verified = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(verified.ok, true);
    assert.equal(verified.claims.leaseKey, LEASE_KEY);
    assert.equal(verified.claims.fencingEpoch, FENCING);
    assert.equal(verified.operationalDispatchAuthorized, false);
    assert.equal(trusted.proofClass, 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY');
  });

  it('3) missing signature DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const payloadOnly = issued.token.split('.')[0];
    const result = verifyResourceLeaseAuthority(
      `${payloadOnly}.`,
      baseExpectation(),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.decision === RLA_DECISIONS.DENY_MISSING_SIGNATURE
        || result.decision === RLA_DECISIONS.DENY_MALFORMED,
      true,
    );
  });

  it('4) forged/modified signature DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const [payloadB64] = issued.token.split('.');
    const forged = `${payloadB64}.${b64urlEncode(Buffer.from('forged-signature-bytes-xxxx'))}`;
    const result = verifyResourceLeaseAuthority(forged, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_INVALID_SIGNATURE);
  });

  it('5) wrong signing key DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const claims = { ...issued.claims };
    const wrongToken = resignWith(h.otherKeys.privateKeyPem, claims);
    const result = verifyResourceLeaseAuthority(wrongToken, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_INVALID_SIGNATURE);
  });

  it('6) expired artifact DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      issuedAt: NOW - 120_000,
      expiresAt: NOW - 60_000,
    }));
    const result = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_EXPIRED);
  });

  it('7) future-issued artifact DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      issuedAt: NOW + 60_000,
      expiresAt: NOW + 120_000,
    }));
    const result = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_NOT_YET_VALID);
  });

  it('8) wrong principal DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ principalId: 'other-principal' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_PRINCIPAL);
  });

  it('9) wrong task DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ taskId: 'other-task' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_TASK);
  });

  it('10) wrong action DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ action: 'OTHER_ACTION' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_ACTION);
  });

  it('11) wrong resourceType DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ resourceType: 'OTHER_TYPE' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_RESOURCE_TYPE);
  });

  it('12) wrong resourceKey DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ resourceKey: OTHER_RESOURCE_KEY }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_RESOURCE_KEY);
  });

  it('13) cross-resource reuse DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        forbidResource: {
          resourceType: RESOURCE_TYPE,
          resourceKey: RESOURCE_KEY,
        },
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_CROSS_RESOURCE_REUSE);
  });

  it('14) wrong governance revision DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ governanceRevision: 'WRONG_REVISION' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION);
  });

  it('15) missing mandatory claim DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const claims = { ...issued.claims };
    delete claims.jti;
    const token = resignWith(h.keys.privateKeyPem, claims);
    const result = verifyResourceLeaseAuthority(token, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_MISSING_CLAIM);
  });

  it('16) unsupported stage DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({ stage: 'OPERATIONAL' }));
    assert.equal(issued.ok, false);
    assert.equal(issued.decision, RLA_DECISIONS.DENY_UNSUPPORTED_STAGE);

    const claims = {
      ...baseIssueInput(),
      stage: 'OPERATIONAL',
      alg: S1_ALG,
      iss: 'test-rla-issuer',
      kid: 'rla-kid-1',
      kind: S1_KIND,
      jti: 'jti-bad-stage',
    };
    // Force unsupported stage token by signing incomplete/invalid shape bypassing issuer.
    const token = resignWith(h.keys.privateKeyPem, {
      action: ACTION,
      alg: S1_ALG,
      expiresAt: NOW + 60_000,
      governanceRevision: GOV_REV,
      iss: 'test-rla-issuer',
      issuedAt: NOW,
      jti: 'jti-bad-stage',
      kid: 'rla-kid-1',
      kind: S1_KIND,
      principalId: PRINCIPAL,
      resourceKey: RESOURCE_KEY,
      resourceType: RESOURCE_TYPE,
      stage: 'OPERATIONAL',
      taskId: TASK,
    });
    const result = verifyResourceLeaseAuthority(
      token,
      baseExpectation({ stage: 'OPERATIONAL' }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_UNSUPPORTED_STAGE);
  });

  it('17) BOOTSTRAP/LEASE_BOUND substitution DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    });
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_STAGE_SUBSTITUTION);
  });

  it('18) missing leaseKey DENY', () => {
    const h = harness();
    const claims = {
      action: 'RELEASE_OWNED_LEASE',
      alg: S1_ALG,
      expiresAt: NOW + 60_000,
      fencingEpoch: FENCING,
      governanceRevision: GOV_REV,
      iss: 'test-rla-issuer',
      issuedAt: NOW,
      jti: 'jti-missing-lease',
      kid: 'rla-kid-1',
      kind: S1_KIND,
      principalId: PRINCIPAL,
      resourceKey: RESOURCE_KEY,
      resourceType: RESOURCE_TYPE,
      stage: S1_STAGES.LEASE_BOUND,
      taskId: TASK,
    };
    // Omit leaseKey intentionally.
    const token = resignWith(h.keys.privateKeyPem, claims);
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    });
    const result = verifyResourceLeaseAuthority(
      token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.decision === RLA_DECISIONS.DENY_MISSING_CLAIM
        || result.decision === RLA_DECISIONS.DENY_MISSING_LEASE_KEY,
      true,
    );
  });

  it('19) mismatched leaseKey DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      stage: S1_STAGES.LEASE_BOUND,
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
      action: 'RELEASE_OWNED_LEASE',
    }));
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: 'lease-other',
      fencingEpoch: FENCING,
    });
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_MISMATCHED_LEASE_KEY);
  });

  it('20) missing fencingEpoch DENY', () => {
    const h = harness();
    const claims = {
      action: 'RELEASE_OWNED_LEASE',
      alg: S1_ALG,
      expiresAt: NOW + 60_000,
      governanceRevision: GOV_REV,
      iss: 'test-rla-issuer',
      issuedAt: NOW,
      jti: 'jti-missing-fence',
      kid: 'rla-kid-1',
      kind: S1_KIND,
      leaseKey: LEASE_KEY,
      principalId: PRINCIPAL,
      resourceKey: RESOURCE_KEY,
      resourceType: RESOURCE_TYPE,
      stage: S1_STAGES.LEASE_BOUND,
      taskId: TASK,
    };
    const token = resignWith(h.keys.privateKeyPem, claims);
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    });
    const result = verifyResourceLeaseAuthority(
      token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.decision === RLA_DECISIONS.DENY_MISSING_CLAIM
        || result.decision === RLA_DECISIONS.DENY_MISSING_FENCING_EPOCH,
      true,
    );
  });

  it('21) invalid fencingEpoch DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      stage: S1_STAGES.LEASE_BOUND,
      leaseKey: LEASE_KEY,
      fencingEpoch: -1,
      action: 'RELEASE_OWNED_LEASE',
    }));
    assert.equal(issued.ok, false);
    assert.equal(issued.decision, RLA_DECISIONS.DENY_MALFORMED);
  });

  it('22) mismatched fencingEpoch DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      stage: S1_STAGES.LEASE_BOUND,
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
      action: 'RELEASE_OWNED_LEASE',
    }));
    const trusted = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING + 1,
    });
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: trusted,
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_MISMATCHED_FENCING_EPOCH);
  });

  it('23) wrong issuer/key identifier DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const wrongIss = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ iss: 'other-issuer' }),
      verifyDeps(h),
    );
    assert.equal(wrongIss.ok, false);
    assert.equal(wrongIss.decision, RLA_DECISIONS.DENY_WRONG_ISSUER);

    const wrongKid = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({ kid: 'rla-kid-other' }),
      verifyDeps(h),
    );
    assert.equal(wrongKid.ok, false);
    assert.equal(wrongKid.decision, RLA_DECISIONS.DENY_WRONG_KEY);
  });

  it('24) malformed/unknown security-significant claim DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const claims = { ...issued.claims, extraAuthority: 'smuggle' };
    const token = resignWith(h.keys.privateKeyPem, claims);
    const result = verifyResourceLeaseAuthority(token, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_UNKNOWN_CLAIM);
  });

  it('25) revoked jti DENY when trusted revocation fixture supplied', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    h.revocationRegistry.revoke(issued.claims.jti);
    const result = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_REVOKED);
  });

  it('26) missing required revocation service DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const deps = verifyDeps(h);
    delete deps.revocationRegistry;
    const result = verifyResourceLeaseAuthority(issued.token, baseExpectation(), deps);
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_MISSING_REVOCATION);
  });

  it('27) replayed jti DENY when trusted consumption fixture supplied', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const first = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(first.ok, true);
    const second = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(second.ok, false);
    assert.equal(second.decision, RLA_DECISIONS.DENY_REPLAY);
  });

  it('28) missing required replay service DENY', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const deps = verifyDeps(h);
    delete deps.replayRegistry;
    const result = verifyResourceLeaseAuthority(issued.token, baseExpectation(), deps);
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_MISSING_REPLAY);
  });

  it('29) no persistence mutation side effects from verify', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const before = JSON.stringify({
      claims: issued.claims,
      token: issued.token,
    });
    const verified = verifyResourceLeaseAuthority(issued.token, baseExpectation(), verifyDeps(h));
    assert.equal(verified.ok, true);
    assert.equal(verified.operationalDispatchAuthorized, false);
    assert.equal(JSON.stringify({ claims: issued.claims, token: issued.token }), before);
    // Module must not export DB/dispatch helpers.
    assert.equal(typeof verifyResourceLeaseAuthority.bindTaskClaimLease, 'undefined');
    assert.equal(typeof verifyResourceLeaseAuthority.releaseTaskClaimLease, 'undefined');
  });

  it('30) no Worker/MCP/dispatch invocation from verify', () => {
    const h = harness();
    let workerCalls = 0;
    let mcpCalls = 0;
    let dispatchCalls = 0;
    const issued = h.issuer.issue(baseIssueInput());
    const verified = verifyResourceLeaseAuthority(issued.token, baseExpectation(), {
      ...verifyDeps(h),
      // Smuggled operational hooks must not be invoked and trust-anchor smuggling is denied.
      // Here we only assert that a clean verify path never increments counters.
      _worker: () => {
        workerCalls += 1;
      },
      _mcp: () => {
        mcpCalls += 1;
      },
      _dispatch: () => {
        dispatchCalls += 1;
      },
    });
    assert.equal(verified.ok, true);
    assert.equal(workerCalls, 0);
    assert.equal(mcpCalls, 0);
    assert.equal(dispatchCalls, 0);
    assert.equal(verified.reasons.includes('NOT_WORKER_OR_MCP_AUTHORITY'), true);
    assert.equal(assertNoOperationalDispatch(verified).operationalDispatchAuthorized, false);
  });

  it('CP1 resourcePaths must not substitute for DLP resource identity', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      resourcePaths: ['tecp-ops/src/config.js'],
    }));
    assert.equal(issued.ok, false);
    assert.equal(issued.decision, RLA_DECISIONS.DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY);

    const good = h.issuer.issue(baseIssueInput());
    const result = verifyResourceLeaseAuthority(
      good.token,
      baseExpectation({ resourcePaths: ['tecp-ops/src/config.js'] }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY);
  });

  it('unbranded lease context is not trusted DB authority', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      stage: S1_STAGES.LEASE_BOUND,
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
      action: 'RELEASE_OWNED_LEASE',
    }));
    const result = verifyResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S1_STAGES.LEASE_BOUND,
        action: 'RELEASE_OWNED_LEASE',
        trustedLeaseContext: {
          leaseKey: LEASE_KEY,
          fencingEpoch: FENCING,
        },
      }),
      verifyDeps(h),
    );
    assert.equal(result.ok, false);
    assert.equal(result.decision, RLA_DECISIONS.DENY_UNTRUSTED_LEASE_CONTEXT);
  });

  it('import alone does not create privileged issuer', () => {
    assert.equal(
      isPrivilegedTestOnlyResourceLeaseAuthorityIssuer({
        kind: 'TEST_ONLY_RESOURCE_LEASE_AUTHORITY_ISSUER',
      }),
      false,
    );
  });
});
