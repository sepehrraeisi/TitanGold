/**
 * TECP-DLP-011 adversarial + trust-boundary offline tests.
 * NON_OPERATIONAL disposable proof. No DB writes. No Worker execution.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';

import {
  DISPOSABLE_TRUST_INJECTION_TOKEN,
  GATE_AUTHORIZED_FILE_SCOPE,
  GATE_DECISIONS,
  GATE_OPERATION_CLASS,
  GATE_REPOSITORY_ID,
  GATE_SLICE_ID,
  __testOnlyEvaluationLockHooks,
  assertMutationFenceFresh,
  createCanonicalRule02Source,
  createDisposableEffectiveAuthorizationTrustRoot,
  createTestOnlyAttestedCanonicalRule02Source,
  createTrustedTipAttestation,
  evaluateEffectiveImplementationAuthorization,
  getTrustRootPublicView,
  isBrandedGateDecision,
  isTrustInstallerCapability,
  issueOwnerInstructionFromTrustRoot,
  replaceTrustRootProvenance,
  revokeTrustRootJti,
} from '../src/effectiveImplementationAuthorizationGate.js';
import {
  createOwnerImplementationInstructionVerifier,
  createOwnerInstructionClock,
  createOwnerInstructionKeyRegistry,
  createOwnerInstructionRevocationRegistry,
  getPrivilegedOwnerInstructionConstructors,
  withPrivilegedOwnerInstructionConstruction,
} from '../src/ownerImplementationInstruction.js';
import {
  CANONICAL_MAIN_SHA_PIN,
  DEFAULT_GOVERNANCE_REVISION,
  createDisposableMergeEffectivenessHarness,
  loadWorkspaceRule02Text,
  synthesizeClosedRule02Text,
  synthesizeUnmergedYesTokenRule02Text,
} from './disposableMergeEffectivenessHarness.js';

function assertNoSecrets(value) {
  const text = JSON.stringify(value);
  assert.equal(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(text), false);
  assert.equal(/privateKeyPem/i.test(text), false);
  assert.equal(/"privateKey"/i.test(text), false);
}

function assertDeny(result, decision) {
  assert.equal(result.ok, false);
  assert.equal(result.decision, decision);
  assert.equal(result.standingAuthority, false);
  assert.equal(result.operational, false);
  assert.equal(result.performsDatabaseWrite, false);
  assert.equal(result.executesWorker, false);
  assert.equal(isBrandedGateDecision(result), true);
  assertNoSecrets(result);
}

test('TB-01 public factory forgery is sealed (canonical source)', () => {
  assert.throws(
    () => createTestOnlyAttestedCanonicalRule02Source({
      repositoryId: GATE_REPOSITORY_ID,
      canonicalSha: CANONICAL_MAIN_SHA_PIN,
      rule02Text: loadWorkspaceRule02Text(),
      mergedProvenance: true,
      attestedByPrivilegedFactory: true,
    }),
    /PUBLIC_CANONICAL_RULE02_SOURCE_CONSTRUCTION_FORBIDDEN/,
  );
  assert.throws(
    () => createCanonicalRule02Source({
      attestedByPrivilegedFactory: true,
      repositoryId: GATE_REPOSITORY_ID,
      canonicalSha: CANONICAL_MAIN_SHA_PIN,
      rule02Text: 'x',
      sourceKind: 'TEST_ONLY_ATTESTED',
    }),
    /PUBLIC_CANONICAL_RULE02_SOURCE_CONSTRUCTION_FORBIDDEN/,
  );
});

test('TB-02 public tip / key registry / verifier factories sealed', () => {
  assert.throws(
    () => createTrustedTipAttestation({
      tipSha: CANONICAL_MAIN_SHA_PIN,
      tipDigest: 'a'.repeat(64),
      attestedByPrivilegedFactory: true,
    }),
    /PUBLIC_TIP_ATTESTATION_CONSTRUCTION_FORBIDDEN/,
  );
  assert.throws(() => createOwnerInstructionKeyRegistry([]), /FORBIDDEN/);
  assert.throws(() => createOwnerInstructionRevocationRegistry(), /FORBIDDEN/);
  assert.throws(() => createOwnerInstructionClock(), /FORBIDDEN/);
  assert.throws(() => createOwnerImplementationInstructionVerifier({}), /FORBIDDEN/);
});

test('TB-03 attacker-controlled evaluate without trust root → DENY_MISSING_TRUST_ROOT', () => {
  const result = evaluateEffectiveImplementationAuthorization({
    testOnlyEnvironment: true,
    expectedCanonicalSha: CANONICAL_MAIN_SHA_PIN,
    expectedRule02DigestSha256: '0'.repeat(64),
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: DEFAULT_GOVERNANCE_REVISION,
    authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
    ownerInstructionEncoded: 'aa.bb',
  });
  assertDeny(result, GATE_DECISIONS.DENY_MISSING_TRUST_ROOT);
});

test('TB-04 attacker-supplied branded-looking trust objects on evaluate → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'caller-trust-objects' },
    canonicalRule02Source: { kind: 'FORGED', mergedProvenance: true },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_OBJECTS);
});

test('TB-05 attacker key registry / verifier injection → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'attacker-registry' },
    keyRegistry: { lookup() { return { ok: true }; } },
    ownerInstructionVerifier: { consumeOnAllow: true, verify() { return { ok: true }; } },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_OBJECTS);
});

test('TB-06 trust root rejects caller-supplied keys/registries at construction', () => {
  assert.throws(() => createDisposableEffectiveAuthorizationTrustRoot({
    privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    mergedProvenance: true,
    activationPr: '#266',
    privateKeyPem: 'BEGIN PRIVATE KEY',
  }), /CALLER_SUPPLIED_TRUST_OBJECTS_FORBIDDEN/);
  assert.throws(() => createDisposableEffectiveAuthorizationTrustRoot({
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    mergedProvenance: true,
    activationPr: '#266',
  }), /DISPOSABLE_TRUST_INJECTION_TOKEN_REQUIRED/);
});

test('TB-07 end-to-end public-factory attack cannot ALLOW', () => {
  // Ordinary importer path: try every public factory then evaluate.
  let factoryThrew = 0;
  for (const fn of [
    () => createTestOnlyAttestedCanonicalRule02Source({
      attestedByPrivilegedFactory: true,
      repositoryId: GATE_REPOSITORY_ID,
      canonicalSha: CANONICAL_MAIN_SHA_PIN,
      rule02Text: loadWorkspaceRule02Text(),
      mergedProvenance: true,
    }),
    () => createTrustedTipAttestation({
      tipSha: CANONICAL_MAIN_SHA_PIN,
      tipDigest: 'b'.repeat(64),
      attestedByPrivilegedFactory: true,
    }),
    () => createOwnerInstructionKeyRegistry([{
      kid: 'atk',
      issuer: 'atk',
      publicKeyPem: 'x',
    }]),
    () => createOwnerImplementationInstructionVerifier({
      keyRegistry: {},
      revocationRegistry: {},
      clock: {},
      consumeOnAllow: true,
    }),
  ]) {
    try {
      fn();
    } catch {
      factoryThrew += 1;
    }
  }
  assert.equal(factoryThrew, 4);

  // Even with a self-made opaque-looking object, evaluate DENYs.
  const forgedRoot = Object.freeze({
    kind: 'TECP_DLP011_DISPOSABLE_EFFECTIVE_AUTHORIZATION_TRUST_ROOT',
    testOnly: true,
  });
  const result = evaluateEffectiveImplementationAuthorization({
    testOnlyEnvironment: true,
    trustRoot: forgedRoot,
    expectedCanonicalSha: CANONICAL_MAIN_SHA_PIN,
    expectedRule02DigestSha256: 'c'.repeat(64),
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: DEFAULT_GOVERNANCE_REVISION,
    authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
    ownerInstructionEncoded: 'dead.beef',
  });
  assertDeny(result, GATE_DECISIONS.DENY_MISSING_TRUST_ROOT);
});

test('A1 same-process public trust-root self-install → ALLOW (installer residual, NOT sealed)', () => {
  // Decisive reproduction: ordinary importer uses public installer APIs.
  // This ALLOW is OUTSIDE the proven untrusted-request boundary (Disposition A).
  const rule02Text = loadWorkspaceRule02Text();
  const installed = createDisposableEffectiveAuthorizationTrustRoot({
    privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    disposableRule02Override: rule02Text,
    mergedProvenance: true,
    activationPr: '#266',
  });
  assert.equal(isTrustInstallerCapability(installed.installerCapability), true);
  const view = getTrustRootPublicView(installed.trustRoot);
  const issued = issueOwnerInstructionFromTrustRoot(installed.installerCapability, {
    jti: 'self-install-allow',
    governanceRevision: DEFAULT_GOVERNANCE_REVISION,
  });
  assert.equal(issued.ok, true);
  const result = evaluateEffectiveImplementationAuthorization({
    testOnlyEnvironment: true,
    trustRoot: installed.trustRoot,
    expectedCanonicalSha: view.canonicalSha,
    expectedRule02DigestSha256: view.rule02DigestSha256,
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: DEFAULT_GOVERNANCE_REVISION,
    authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
    ownerInstructionEncoded: issued.instruction.encoded,
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision, GATE_DECISIONS.ALLOW);
  assert.equal(result.operational, false);
  assert.equal(installed.trustRoot.sameProcessTrustInstallerResidual, true);
});

test('A2 public construction latch opens branding but cannot satisfy evaluate alone', () => {
  let brandedRegistry = null;
  withPrivilegedOwnerInstructionConstruction(() => {
    const ctors = getPrivilegedOwnerInstructionConstructors();
    brandedRegistry = ctors.createOwnerInstructionKeyRegistry([]);
  });
  assert.ok(brandedRegistry);
  // Latch-minted registry cannot be injected into evaluate.
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'latch-inject' },
    keyRegistry: brandedRegistry,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_OBJECTS);
});

test('A3 opaque trustRoot alone cannot issue / mutate / revoke (installerCapability required)', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const rootOnly = h.trustRoot;
  assert.throws(
    () => issueOwnerInstructionFromTrustRoot(rootOnly, {
      governanceRevision: DEFAULT_GOVERNANCE_REVISION,
      jti: 'handle-only-issue',
    }),
    /TRUST_INSTALLER_CAPABILITY_REQUIRED/,
  );
  assert.throws(
    () => replaceTrustRootProvenance(rootOnly, {
      privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
      rule02Text: synthesizeClosedRule02Text(),
      mergedProvenance: true,
      activationPr: '#266',
    }),
    /TRUST_INSTALLER_CAPABILITY_REQUIRED/,
  );
  assert.throws(
    () => revokeTrustRootJti(rootOnly, 'any-jti'),
    /TRUST_INSTALLER_CAPABILITY_REQUIRED/,
  );
  // Read/evaluate still work with root alone.
  const view = getTrustRootPublicView(rootOnly);
  assert.equal(typeof view.rule02DigestSha256, 'string');
  const issued = h.issueExactSliceInstruction({ jti: 'root-only-eval' });
  const allow = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(allow.ok, true);
  // Fence recheck uses trustRoot (unprivileged).
  const fenceOk = assertMutationFenceFresh(allow.authorization.fence, rootOnly);
  assert.equal(fenceOk.ok, true);
});

test('A4 forged installerCapability cannot bind to a foreign trustRoot', () => {
  assert.throws(
    () => issueOwnerInstructionFromTrustRoot({
      kind: 'TECP_DLP011_TRUST_INSTALLER_CAPABILITY',
      testOnly: true,
    }, { governanceRevision: DEFAULT_GOVERNANCE_REVISION, jti: 'forged-cap' }),
    /TRUST_INSTALLER_CAPABILITY_REQUIRED/,
  );
});

test('01 canonical closed Rule02 → DENY_CANONICAL_CLOSED', () => {
  const h = createDisposableMergeEffectivenessHarness();
  h.useClosedProvenance();
  const v = h.view();
  const issued = h.issueExactSliceInstruction({
    jti: 'closed-jti',
    rule02DigestSha256: v.rule02DigestSha256,
    canonicalSha: v.canonicalSha,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CANONICAL_CLOSED);
});

test('02 unmerged YES-token proposal → DENY_UNMERGED_YES_TOKEN', () => {
  const h = createDisposableMergeEffectivenessHarness();
  h.useUnmergedYesProvenance();
  const v = h.view();
  const issued = h.issueExactSliceInstruction({
    jti: 'unmerged-jti',
    rule02DigestSha256: v.rule02DigestSha256,
    canonicalSha: v.canonicalSha,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_UNMERGED_YES_TOKEN);
});

test('03 forged Rule02 parse failure → DENY_FORGED_RULE02', () => {
  const h = createDisposableMergeEffectivenessHarness();
  h.useForgedRule02Provenance();
  const v = h.view();
  const issued = h.issueExactSliceInstruction({
    jti: 'forged-jti',
    rule02DigestSha256: v.rule02DigestSha256,
    canonicalSha: v.canonicalSha,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_FORGED_RULE02);
});

test('04 missing owner instruction → DENY_MISSING_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: '',
  }));
  assertDeny(result, GATE_DECISIONS.DENY_MISSING_OWNER_INSTRUCTION);
});

test('05 wrong canonical SHA → DENY_WRONG_CANONICAL_SHA', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    expectedCanonicalSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    instructionOverrides: { jti: 'wrong-sha' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_CANONICAL_SHA);
});

test('06 wrong Rule02 digest → DENY_WRONG_RULE02_DIGEST', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    expectedRule02DigestSha256: '0'.repeat(64),
    instructionOverrides: { jti: 'wrong-digest' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
});

test('07 fake merged/canonical caller flags → DENY_FAKE_MERGED_FLAG', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    merged: true,
    canonical: true,
    branchName: 'main',
    instructionOverrides: { jti: 'fake-merged' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_FAKE_MERGED_FLAG);
});

test('08 forged branded tip via drift before evaluate → DENY_STALE_TIP', () => {
  const h = createDisposableMergeEffectivenessHarness();
  h.driftTip({ tipDigest: '1'.repeat(64) });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'stale-tip' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_STALE_TIP);
});

test('10 invalid signature → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'badsig' });
  const bad = h.forgeInvalidSignatureInstruction(issued.instruction.encoded);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: bad,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('11 foreign-key signed instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'foreign-base' });
  const claims = { ...issued.instruction.claims, jti: 'foreign-jti-1', kid: 'unknown-kid' };
  const encoded = h.signClaimsWithForeignKey(claims);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('12 wrong scope or action → DENY_WRONG_SCOPE_OR_ACTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    operationClass: 'DEPLOY_PRODUCTION',
    instructionOverrides: { jti: 'wrong-op' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
});

test('12b wrong authorized paths → DENY_WRONG_SCOPE_OR_ACTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    authorizedFileScope: ['tecp/src/evil.js'],
    instructionOverrides: { jti: 'wrong-paths' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
});

test('13 wrong repository or slice → DENY_WRONG_REPOSITORY_OR_SLICE', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    sliceId: 'TECP-DLP-999-FAKE',
    instructionOverrides: { jti: 'wrong-slice' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('14 expired instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'exp-jti', ttlMs: 1_000 });
  h.advanceClock(5_000);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('15 revoked instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'revoked-jti-dlp011' });
  h.revokeJti('revoked-jti-dlp011');
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('16 consumed instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'consume-once-jti' });
  const first = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(first.ok, true);
  const second = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(second, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('17 replayed JTI (explicit consume) → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'replay-jti' });
  assert.equal(h.consumeJti('replay-jti'), true);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('18 unavailable clock → DENY_CLOCK_OR_REVOCATION_UNAVAILABLE', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'clock-jti' });
  h.installUnavailableClock();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CLOCK_OR_REVOCATION_UNAVAILABLE);
});

test('19 tip drift between evaluation and mutation fence → DENY_TIP_DRIFT', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'fence-jti' });
  const first = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(first.ok, true);
  h.driftTip({ tipDigest: '2'.repeat(64) });
  const fenceResult = assertMutationFenceFresh(first.authorization.fence, h.trustRoot);
  assertDeny(fenceResult, GATE_DECISIONS.DENY_TIP_DRIFT);
});

test('21 caller-provided AuthorizedInvocation → DENY_CALLER_AUTHORIZED_INVOCATION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    authorizedInvocation: { ok: true, decision: 'ALLOW' },
    instructionOverrides: { jti: 'authz-inv' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CALLER_AUTHORIZED_INVOCATION);
});

test('22 malformed / oversized instruction → DENY_MALFORMED_OR_OVERSIZED', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const oversized = `${'A'.repeat(33 * 1024)}.${'B'.repeat(64)}`;
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: oversized,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_MALFORMED_OR_OVERSIZED);
});

test('22b malformed encoding → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: 'not-a-valid-token',
  }));
  assert.equal(result.ok, false);
  assert.equal(
    result.decision === GATE_DECISIONS.DENY_OWNER_INSTRUCTION
      || result.decision === GATE_DECISIONS.DENY_MALFORMED_OR_OVERSIZED,
    true,
  );
  assertNoSecrets(result);
});

test('23 secret-containing error/result must not leak private keys', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'noleak' });
  const bad = h.forgeInvalidSignatureInstruction(issued.instruction.encoded);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: bad,
  }));
  assert.equal(result.ok, false);
  assertNoSecrets(result);
  assertNoSecrets(h.view());
});

test('24 concurrent conflicting authorization attempts → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const token = __testOnlyEvaluationLockHooks.hold();
  assert.ok(token);
  try {
    const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
      instructionOverrides: { jti: 'concurrent-jti' },
    }));
    assertDeny(result, GATE_DECISIONS.DENY_CONFLICTING_AUTHORIZATION);
  } finally {
    __testOnlyEvaluationLockHooks.release(token);
  }
});

test('25 valid TEST_ONLY merged provenance + exact-slice owner instruction → ALLOW', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'allow-jti-final' });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.decision, GATE_DECISIONS.ALLOW);
  assert.equal(result.standingAuthority, false);
  assert.equal(result.operational, false);
  assert.equal(result.performsDatabaseWrite, false);
  assert.equal(result.executesWorker, false);
  assert.equal(result.authorization.reusable, false);
  assert.equal(result.authorization.sliceId, GATE_SLICE_ID);
  assertNoSecrets(result);

  const fenceOk = assertMutationFenceFresh(result.authorization.fence, h.trustRoot);
  assert.equal(fenceOk.ok, true);

  const replay = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(replay, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('25b authorization check does not claim DB write or Worker execution', () => {
  const h = createDisposableMergeEffectivenessHarness();
  h.useClosedProvenance();
  const v = h.view();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: h.issueExactSliceInstruction({
      jti: 'closed-db',
      rule02DigestSha256: v.rule02DigestSha256,
      canonicalSha: v.canonicalSha,
    }).instruction.encoded,
  }));
  assert.equal(result.performsDatabaseWrite, false);
  assert.equal(result.executesWorker, false);
});

test('P1 governanceRevision mismatch → DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    governanceRevision: 'WRONG_REVISION_20261103',
    instructionOverrides: {
      jti: 'rev-mismatch-jti',
      governanceRevision: 'WRONG_REVISION_20261103',
    },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_GOVERNANCE_REVISION_MISMATCH);
});

test('P1 parsed authorizedFileScope mismatch → DENY_PARSED_SCOPE_MISMATCH', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const mutated = loadWorkspaceRule02Text().replace(
    'tecp/test/disposableMergeEffectivenessHarness.js',
    'tecp/test/evilExtraPath.js',
  );
  h.replaceProvenance({
    rule02Text: mutated,
    mergedProvenance: true,
    activationPr: '#266',
  });
  const v = h.view();
  const issued = h.issueExactSliceInstruction({
    jti: 'scope-mismatch-jti',
    rule02DigestSha256: v.rule02DigestSha256,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_PARSED_SCOPE_MISMATCH);
});

test('P1 parsed active slice mismatch → DENY_PARSED_SLICE_MISMATCH', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const mutated = loadWorkspaceRule02Text().replaceAll(
    'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE',
    'TECP-DLP-999-FAKE-SLICE',
  );
  h.replaceProvenance({
    rule02Text: mutated,
    mergedProvenance: true,
    activationPr: '#266',
  });
  const v = h.view();
  const issued = h.issueExactSliceInstruction({
    jti: 'slice-mismatch-jti',
    rule02DigestSha256: v.rule02DigestSha256,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_PARSED_SLICE_MISMATCH);
});

test('explicit testOnlyEnvironment required', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const input = h.buildGateInput({ instructionOverrides: { jti: 'env-jti' } });
  delete input.testOnlyEnvironment;
  const result = evaluateEffectiveImplementationAuthorization(input);
  assertDeny(result, GATE_DECISIONS.DENY_ENVIRONMENT_NOT_TEST_ONLY);
});

test('non-claims: closed/unmerged helpers still distinguish validator residual', () => {
  assert.equal(synthesizeUnmergedYesTokenRule02Text().includes('YES / EXACT_SLICE_ONLY'), true);
  assert.equal(synthesizeClosedRule02Text().includes('CONSUMED / NON-ACTIVE'), true);
});

test('cross-slice grant via foreign-signed instruction DENY', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'cross-base' });
  const claims = {
    ...issued.instruction.claims,
    jti: 'cross-slice-jti',
    sliceId: 'TECP-DLP-010-DISPOSABLE-LOCAL-WRITER-SIDECAR-ISOLATION-PROOF',
  };
  // Re-sign with harness foreign key (not trust-root key)
  const encoded = h.signClaimsWithForeignKey(claims);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('real canonical source mismatch: wrong expected digest vs trust root', () => {
  const h = createDisposableMergeEffectivenessHarness();
  // Trust root holds real workspace Rule02; caller lies about digest expectation.
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    expectedRule02DigestSha256: digestMismatch(),
    instructionOverrides: { jti: 'canon-mismatch' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
});

function digestMismatch() {
  return 'f'.repeat(64);
}
