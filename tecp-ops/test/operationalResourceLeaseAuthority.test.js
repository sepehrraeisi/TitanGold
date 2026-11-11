import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  b64urlEncode,
  canonicalJson,
} from '../src/config.js';
import {
  TRUST_ROOT_AUDIENCE,
  createTestOnlyOwnerTrustRootInstaller,
  generateEphemeralTrustRootKeyPairForTests,
} from '../src/ownerInstalledTrustRoot.js';
import {
  ORLA_DECISIONS,
  S2_GOVERNANCE_REVISION,
  S2_KIND,
  S2_STAGES,
  assertNoOperationalDispatch,
  createInjectedClock,
  createInMemoryReplayRegistry,
  createInMemoryRevocationRegistry,
  createOperationalRlaSigner,
  createTestOnlyOperationalRlaIssuer,
  generateEphemeralOperationalRlaKeyPairForTests,
  isBrandedOperationalRlaArtifact,
  isPrivilegedTestOnlyOperationalRlaIssuer,
  registerDbIssuedLeaseContextBrand,
  verifyOperationalResourceLeaseAuthority,
} from '../src/operationalResourceLeaseAuthority.js';
import {
  S1_KIND,
  S1_STAGES,
  createInMemoryKeyRegistry,
  createOfflineTrustedLeaseFixtureForTests,
  createTestOnlyResourceLeaseAuthorityIssuer,
  generateEphemeralResourceLeaseAuthorityKeyPairForTests,
  verifyResourceLeaseAuthority,
} from '../src/resourceLeaseAuthority.js';

const NOW = 1_700_000_000_000;
const PRINCIPAL = 'principal-s2-001';
const TASK = 'task-s2-001';
const ACTION = 'REQUEST_ELIGIBLE_TASK_LEASE';
const RESOURCE_TYPE = 'WRITE_RESOURCE';
const RESOURCE_KEY = 'resource-s2-alpha';
const LEASE_KEY = 'lease-s2-001';
const FENCING = 11;

const dbBrand = new WeakSet();
registerDbIssuedLeaseContextBrand((value) => dbBrand.has(value));

function brandDbLease(input) {
  const ctx = Object.freeze({
    kind: 'DB_ISSUED_LEASE_CONTEXT_V1',
    proofClass: 'OFFLINE_INTERFACE_NOT_REAL_DB',
    leaseKey: input.leaseKey,
    fencingEpoch: input.fencingEpoch,
    txnBound: true,
  });
  dbBrand.add(ctx);
  return ctx;
}

function harness() {
  const keys = generateEphemeralOperationalRlaKeyPairForTests();
  const otherKeys = generateEphemeralOperationalRlaKeyPairForTests();
  const installer = createTestOnlyOwnerTrustRootInstaller();
  const installed = installer.install({
    issuerId: 'ops-rla-issuer',
    kid: 'ops-kid-1',
    audience: TRUST_ROOT_AUDIENCE,
    governanceRevision: S2_GOVERNANCE_REVISION,
    publicKeyPem: keys.publicKeyPem,
  });
  installed.trustRoot.rotatePublicKey({
    kid: 'ops-kid-other',
    publicKeyPem: otherKeys.publicKeyPem,
  });
  const clock = createInjectedClock(NOW);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const issuer = createTestOnlyOperationalRlaIssuer({
    kid: 'ops-kid-1',
    iss: 'ops-rla-issuer',
    privateKeyPem: keys.privateKeyPem,
    trustRoot: installed.trustRoot,
  });
  return {
    keys,
    otherKeys,
    trustRoot: installed.trustRoot,
    clock,
    revocationRegistry,
    replayRegistry,
    issuer,
  };
}

function baseIssueInput(overrides = {}) {
  return {
    stage: S2_STAGES.BOOTSTRAP,
    principalId: PRINCIPAL,
    taskId: TASK,
    action: ACTION,
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: S2_GOVERNANCE_REVISION,
    issuedAt: NOW,
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function baseExpectation(overrides = {}) {
  return {
    stage: S2_STAGES.BOOTSTRAP,
    principalId: PRINCIPAL,
    taskId: TASK,
    action: ACTION,
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: S2_GOVERNANCE_REVISION,
    iss: 'ops-rla-issuer',
    kid: 'ops-kid-1',
    aud: TRUST_ROOT_AUDIENCE,
    ...overrides,
  };
}

function verifyDeps(h) {
  return {
    trustRoot: h.trustRoot,
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

describe('S2 operationalResourceLeaseAuthority offline contract', () => {
  it('1) valid BOOTSTRAP issue/verify with trusted root', () => {
    const h = harness();
    assert.equal(isPrivilegedTestOnlyOperationalRlaIssuer(h.issuer), true);
    const issued = h.issuer.issue(baseIssueInput());
    assert.equal(issued.ok, true);
    assert.equal(issued.claims.kind, S2_KIND);
    assert.equal(issued.operationalDispatchAuthorized, false);
    const verified = verifyOperationalResourceLeaseAuthority(
      issued.token,
      baseExpectation(),
      verifyDeps(h),
    );
    assert.equal(verified.ok, true);
    assert.equal(verified.signatureValid, true);
    assert.equal(verified.issuerAuthorized, true);
    assert.equal(verified.operationalDispatchAuthorized, false);
    assert.equal(isBrandedOperationalRlaArtifact(verified.artifact), true);
    assert.equal(assertNoOperationalDispatch(verified).operationalDispatchAuthorized, false);
  });

  it('2) rejects S1 TEST_ONLY credentials as operational authority', () => {
    const s1Keys = generateEphemeralResourceLeaseAuthorityKeyPairForTests();
    const s1Registry = createInMemoryKeyRegistry();
    s1Registry.registerPublicKey('s1-kid', s1Keys.publicKeyPem);
    const s1Issuer = createTestOnlyResourceLeaseAuthorityIssuer({
      kid: 's1-kid',
      iss: 's1-issuer',
      privateKeyPem: s1Keys.privateKeyPem,
      keyRegistry: s1Registry,
    });
    const s1Issued = s1Issuer.issue({
      stage: S1_STAGES.BOOTSTRAP,
      principalId: PRINCIPAL,
      taskId: TASK,
      action: ACTION,
      resourceType: RESOURCE_TYPE,
      resourceKey: RESOURCE_KEY,
      governanceRevision: 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110',
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
    });
    assert.equal(s1Issued.ok, true);
    assert.equal(s1Issued.claims.kind, S1_KIND);

    const h = harness();
    const denied = verifyOperationalResourceLeaseAuthority(
      s1Issued.token,
      baseExpectation({
        governanceRevision: 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110',
        iss: 's1-issuer',
        kid: 's1-kid',
      }),
      verifyDeps(h),
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, ORLA_DECISIONS.DENY_S1_TEST_ONLY_CREDENTIAL);
  });

  it('3) wrong issuer/audience/key/governance and signature tamper deny without jti consume', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    const before = h.replayRegistry.hasPresented(issued.claims.jti);

    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation({ iss: 'wrong-issuer' }),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_WRONG_ISSUER,
    );
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation({ aud: 'WRONG_AUD' }),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_WRONG_AUDIENCE,
    );
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation({ kid: 'ops-kid-other' }),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_WRONG_KEY,
    );
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation({ governanceRevision: 'WRONG' }),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION,
    );

    const tamperedClaims = { ...issued.claims, action: 'OTHER' };
    const tampered = resignWith(h.keys.privateKeyPem, tamperedClaims);
    // Action mismatch after valid signature for wrong claims vs expectation
    const tamperedResult = verifyOperationalResourceLeaseAuthority(
      tampered,
      baseExpectation(),
      verifyDeps(h),
    );
    assert.equal(tamperedResult.ok, false);
    assert.equal(tamperedResult.decision, ORLA_DECISIONS.DENY_WRONG_ACTION);
    assert.equal(h.replayRegistry.hasPresented(issued.claims.jti), before);
  });

  it('4) expired authority denies; invalid signature denies', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({ expiresAt: NOW + 1_000 }));
    h.clock.setNowMs(NOW + 2_000);
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation(),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_EXPIRED,
    );

    h.clock.setNowMs(NOW);
    const badSig = `${issued.token.split('.')[0]}.${b64urlEncode(Buffer.from('bad'))}`;
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        badSig,
        baseExpectation(),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_INVALID_SIGNATURE,
    );
  });

  it('5) LEASE_BOUND requires DB-issued branded context; S1 offline fixture denied', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput({
      stage: S2_STAGES.LEASE_BOUND,
      action: 'RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    }));
    const s1Fixture = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: LEASE_KEY,
      fencingEpoch: FENCING,
    });
    const denyFixture = verifyOperationalResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S2_STAGES.LEASE_BOUND,
        action: 'RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
        trustedLeaseContext: s1Fixture,
      }),
      verifyDeps(h),
    );
    assert.equal(denyFixture.decision, ORLA_DECISIONS.DENY_S1_OFFLINE_LEASE_FIXTURE);

    const unbranded = verifyOperationalResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S2_STAGES.LEASE_BOUND,
        action: 'RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
        dbIssuedLeaseContext: {
          leaseKey: LEASE_KEY,
          fencingEpoch: FENCING,
        },
      }),
      verifyDeps(h),
    );
    assert.equal(unbranded.decision, ORLA_DECISIONS.DENY_UNTRUSTED_LEASE_CONTEXT);

    const ok = verifyOperationalResourceLeaseAuthority(
      issued.token,
      baseExpectation({
        stage: S2_STAGES.LEASE_BOUND,
        action: 'RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT',
        dbIssuedLeaseContext: brandDbLease({ leaseKey: LEASE_KEY, fencingEpoch: FENCING }),
      }),
      verifyDeps(h),
    );
    assert.equal(ok.ok, true);
  });

  it('6) revocation and replay deny; failed verify does not consume jti', () => {
    const h = harness();
    const issued = h.issuer.issue(baseIssueInput());
    h.revocationRegistry.revoke(issued.claims.jti);
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued.token,
        baseExpectation(),
        verifyDeps(h),
      ).decision,
      ORLA_DECISIONS.DENY_REVOKED,
    );

    const h2 = harness();
    const issued2 = h2.issuer.issue(baseIssueInput());
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued2.token,
        baseExpectation(),
        verifyDeps(h2),
      ).ok,
      true,
    );
    assert.equal(
      verifyOperationalResourceLeaseAuthority(
        issued2.token,
        baseExpectation(),
        verifyDeps(h2),
      ).decision,
      ORLA_DECISIONS.DENY_REPLAY,
    );
  });

  it('7) BOOTSTRAP cannot carry lease fields; operational signer inactive', () => {
    const h = harness();
    const bad = h.issuer.issue(baseIssueInput({ leaseKey: LEASE_KEY, fencingEpoch: 1 }));
    assert.equal(bad.ok, false);
    const signer = createOperationalRlaSigner();
    assert.equal(signer.status, 'NOT_OPERATIONALLY_ACTIVATED');
    assert.equal(signer.issue().decision, ORLA_DECISIONS.DENY_OPERATIONAL_SIGNER_INACTIVE);
  });

  it('8) S1 verify path remains independent and frozen', () => {
    const s1Keys = generateEphemeralResourceLeaseAuthorityKeyPairForTests();
    const s1Registry = createInMemoryKeyRegistry();
    s1Registry.registerPublicKey('s1-kid', s1Keys.publicKeyPem);
    const s1Issuer = createTestOnlyResourceLeaseAuthorityIssuer({
      kid: 's1-kid',
      iss: 's1-issuer',
      privateKeyPem: s1Keys.privateKeyPem,
      keyRegistry: s1Registry,
    });
    const issued = s1Issuer.issue({
      stage: S1_STAGES.BOOTSTRAP,
      principalId: PRINCIPAL,
      taskId: TASK,
      action: ACTION,
      resourceType: RESOURCE_TYPE,
      resourceKey: RESOURCE_KEY,
      governanceRevision: 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110',
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
    });
    const verified = verifyResourceLeaseAuthority(
      issued.token,
      {
        stage: S1_STAGES.BOOTSTRAP,
        principalId: PRINCIPAL,
        taskId: TASK,
        action: ACTION,
        resourceType: RESOURCE_TYPE,
        resourceKey: RESOURCE_KEY,
        governanceRevision: 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110',
        iss: 's1-issuer',
        kid: 's1-kid',
      },
      {
        keyRegistry: s1Registry,
        clock: createInjectedClock(NOW),
        revocationRegistry: createInMemoryRevocationRegistry(),
        replayRegistry: createInMemoryReplayRegistry(),
      },
    );
    assert.equal(verified.ok, true);
  });
});
