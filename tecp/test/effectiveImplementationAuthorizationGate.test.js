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
import { parseRule02 } from '../src/rule02Parser.js';
import { validateGovernance } from '../src/governanceValidator.js';
import {
  CANONICAL_MAIN_SHA_PIN,
  DEFAULT_GOVERNANCE_REVISION,
  HISTORICAL_GOVERNANCE_REVISION,
  HISTORICAL_RULE02_GIT_BLOB_SHA,
  HISTORICAL_RULE02_SHA256,
  PRIVILEGED_HARNESS_RULE02_OVERRIDE,
  createDisposableMergeEffectivenessHarness,
  digestRule02,
  loadHistoricalActivationRule02Text,
  loadLiveWorkspaceRule02Text,
  loadWorkspaceRule02Text,
  synthesizeClosedRule02Text,
  synthesizeUnmergedYesTokenRule02Text,
  verifyHistoricalRule02Text,
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
      rule02Text: loadHistoricalActivationRule02Text(),
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
      rule02Text: loadHistoricalActivationRule02Text(),
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
  const rule02Text = loadHistoricalActivationRule02Text();
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
  const mutated = loadHistoricalActivationRule02Text().replace(
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
  const mutated = loadHistoricalActivationRule02Text().replaceAll(
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
  // Trust root holds pinned historical activation Rule02; caller lies about digest expectation.
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    expectedRule02DigestSha256: digestMismatch(),
    instructionOverrides: { jti: 'canon-mismatch' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
});

function digestMismatch() {
  return 'f'.repeat(64);
}


test('HIST-01 historical fixture digest matches approved source', () => {
  const text = loadHistoricalActivationRule02Text();
  assert.equal(digestRule02(text), HISTORICAL_RULE02_SHA256);
  assert.equal(HISTORICAL_RULE02_GIT_BLOB_SHA, 'fa8c90186e155f2d3386e4065a44f1dc5762cc1c');
  assert.match(text, new RegExp(`GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}`));
  const h = createDisposableMergeEffectivenessHarness();
  assert.equal(h.historicalRule02Pinned, true);
  assert.equal(h.historicalRule02Sha256, HISTORICAL_RULE02_SHA256);
  assert.equal(h.view().rule02DigestSha256, HISTORICAL_RULE02_SHA256);
});

test('HIST-02 live closeout revision differs from historical pin without breaking historical proof', () => {
  const live = loadLiveWorkspaceRule02Text();
  const hist = loadHistoricalActivationRule02Text();
  assert.notEqual(digestRule02(live), digestRule02(hist));
  assert.match(live, /DLP011_CLOSEOUT_20261103/);
  assert.doesNotMatch(hist, /DLP011_CLOSEOUT_20261103/);
  const h = createDisposableMergeEffectivenessHarness();
  const allow = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'hist-02-allow' },
  }));
  assert.equal(allow.ok, true);
  assert.equal(allow.decision, GATE_DECISIONS.ALLOW);
  assert.equal(allow.operational, false);
});

test('HIST-03 missing immutable historical fixture fails closed (no live fallback)', async () => {
  assert.throws(
    () => verifyHistoricalRule02Text(''),
    /HISTORICAL_RULE02_MISSING_OR_EMPTY/,
  );
  assert.throws(
    () => verifyHistoricalRule02Text('too-short'),
    /HISTORICAL_RULE02_MISSING_OR_EMPTY/,
  );

  const { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { randomBytes } = await import('node:crypto');
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const {
    HISTORICAL_FIXTURE_PATH,
  } = await import('./disposableMergeEffectivenessHarness.js');

  // Checked-in fixture must remain present and untouched throughout this test.
  assert.equal(existsSync(HISTORICAL_FIXTURE_PATH), true);
  const beforeDigest = digestRule02(readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8'));
  assert.equal(beforeDigest, HISTORICAL_RULE02_SHA256);

  const isolRoot = mkdtempSync(join(tmpdir(), `tecp-dlp011f-hist03-${process.pid}-`));
  const missingPath = join(
    isolRoot,
    `absent-${randomBytes(8).toString('hex')}.mdc`,
  );
  const corruptedPath = join(isolRoot, `corrupted-${randomBytes(8).toString('hex')}.mdc`);
  const wrongRevPath = join(isolRoot, `wrongrev-${randomBytes(8).toString('hex')}.mdc`);

  try {
    // Missing fixture path: exercise real loader + verify path; never touch checked-in file.
    assert.throws(
      () => loadHistoricalActivationRule02Text({
        fixturePath: missingPath,
        allowGitBlobFallback: false,
      }),
      /HISTORICAL_RULE02_UNAVAILABLE/,
    );

    // Corrupted fixture content at isolated path → digest mismatch (same verify path).
    writeFileSync(corruptedPath, '# not-the-pinned-historical-rule02\n', 'utf8');
    assert.throws(
      () => loadHistoricalActivationRule02Text({
        fixturePath: corruptedPath,
        allowGitBlobFallback: false,
      }),
      /HISTORICAL_RULE02_MISSING_OR_EMPTY|HISTORICAL_RULE02_DIGEST_MISMATCH/,
    );

    // Wrong revision at isolated path → digest/revision reject (still no live fallback).
    const good = loadHistoricalActivationRule02Text();
    const wrongRev = good.replaceAll(
      `**GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}**`,
      '**GOVERNANCE_REVISION = DLP011_CLOSEOUT_20261103**',
    );
    writeFileSync(wrongRevPath, wrongRev, 'utf8');
    assert.throws(
      () => loadHistoricalActivationRule02Text({
        fixturePath: wrongRevPath,
        allowGitBlobFallback: false,
      }),
      /HISTORICAL_RULE02_DIGEST_MISMATCH|HISTORICAL_RULE02_REVISION_MISSING/,
    );

    // Live Rule02 is available but must never substitute for a missing historical fixture.
    const live = loadLiveWorkspaceRule02Text();
    assert.match(live, /DLP011_CLOSEOUT_20261103/);
    assert.notEqual(digestRule02(live), HISTORICAL_RULE02_SHA256);

    // Concurrent child processes: each uses its own missing path; parent still loads pin.
    const harnessUrl = new URL('./disposableMergeEffectivenessHarness.js', import.meta.url).href;
    const childScript = `
      import { loadHistoricalActivationRule02Text } from ${JSON.stringify(harnessUrl)};
      const missing = process.env.TECP_HIST03_MISSING_PATH;
      try {
        loadHistoricalActivationRule02Text({ fixturePath: missing, allowGitBlobFallback: false });
        console.log('UNEXPECTED_ALLOW');
        process.exit(2);
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (!/HISTORICAL_RULE02_UNAVAILABLE/.test(msg)) {
          console.error(msg);
          process.exit(3);
        }
        process.exit(0);
      }
    `;
    const children = [];
    for (let i = 0; i < 4; i += 1) {
      const childMissing = join(
        isolRoot,
        `child-missing-${i}-${randomBytes(4).toString('hex')}.mdc`,
      );
      children.push(spawnSync(
        process.execPath,
        ['--input-type=module', '-e', childScript],
        {
          env: {
            ...process.env,
            TECP_HIST03_MISSING_PATH: childMissing,
            TECP_DLP011_ALLOW_GIT_BLOB_FALLBACK: '',
          },
          encoding: 'utf8',
          timeout: 15_000,
          cwd: fileURLToPath(new URL('.', import.meta.url)),
        },
      ));
    }
    for (const child of children) {
      assert.equal(child.status, 0, `child stderr=${child.stderr || ''}`);
    }
    assert.equal(
      digestRule02(loadHistoricalActivationRule02Text()),
      HISTORICAL_RULE02_SHA256,
    );
  } finally {
    rmSync(isolRoot, { recursive: true, force: true });
  }

  // Checked-in fixture still present and byte-identical after failure injection.
  assert.equal(existsSync(HISTORICAL_FIXTURE_PATH), true);
  const afterDigest = digestRule02(readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8'));
  assert.equal(afterDigest, HISTORICAL_RULE02_SHA256);
  assert.equal(afterDigest, beforeDigest);
  assert.equal(digestRule02(loadHistoricalActivationRule02Text()), HISTORICAL_RULE02_SHA256);
});

test('HIST-04 tampered historical fixture fails closed', () => {
  const good = loadHistoricalActivationRule02Text();
  const tampered = `${good}\n**TAMPERED_FOR_TEST = true**\n`;
  assert.throws(
    () => verifyHistoricalRule02Text(tampered),
    /HISTORICAL_RULE02_DIGEST_MISMATCH/,
  );
  const wrongRev = good.replaceAll(
    `**GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}**`,
    '**GOVERNANCE_REVISION = DLP011_CLOSEOUT_20261103**',
  );
  assert.throws(
    () => verifyHistoricalRule02Text(wrongRev),
    /HISTORICAL_RULE02_DIGEST_MISMATCH|HISTORICAL_RULE02_REVISION_MISSING/,
  );
});

test('HIST-05 historical fixture cannot authorize current live DLP-011 re-execution', () => {
  const live = loadLiveWorkspaceRule02Text();
  const hist = loadHistoricalActivationRule02Text();
  assert.notEqual(digestRule02(live), digestRule02(hist));
  const parsed = parseRule02(live);
  // Closed DLP-011 slice id must not validate as the active work package.
  const decision = validateGovernance(parsed, {
    sliceId: GATE_SLICE_ID,
    authorityClass: 'ENGINEERING_CONTROL_PLANE',
    riskTier: 'Tier 3',
    requestedPaths: [...GATE_AUTHORIZED_FILE_SCOPE],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.decision, /^DENY_/);
  assert.equal(
    parsed.lifecyclePrecedence.implementationAuthorizationEffective,
    'CONSUMED / NON-ACTIVE',
  );
  // Live closeout provenance through the disposable gate still DENY for historical DLP-011 ALLOW path.
  const closedHarness = createDisposableMergeEffectivenessHarness({
    privilegedRule02Override: true,
    mergedRule02Text: synthesizeClosedRule02Text(hist),
  });
  const gateDeny = evaluateEffectiveImplementationAuthorization(closedHarness.buildGateInput({
    instructionOverrides: { jti: 'hist-05-closed-live-deny' },
  }));
  assertDeny(gateDeny, GATE_DECISIONS.DENY_CANONICAL_CLOSED);
});

test('HIST-06 live Rule02 keeps DLP-011 closed; Snapshot TECP_IMPLEMENTATION_AUTHORIZED remains NO*', () => {
  const live = loadLiveWorkspaceRule02Text();
  assert.match(live, /TECP_DLP011_STATUS = CLOSED \/ FROZEN \/ VERIFIED/);
  assert.match(live, /TECP_DLP011_IMPLEMENTATION_AUTHORIZED = CONSUMED \/ NON-ACTIVE/);
  assert.match(live, /\*\*IMPLEMENTATION_AUTHORIZED = CONSUMED \/ NON-ACTIVE\*\*/);
  const parsed = parseRule02(live);
  assert.match(String(parsed.tecp.TECP_IMPLEMENTATION_AUTHORIZED), /^NO\b/);
  // Historical fixture must not equal live text and must not flip Snapshot to operational YES.
  assert.notEqual(digestRule02(live), HISTORICAL_RULE02_SHA256);
  assert.equal(parsed.tecp.TECP_IMPLEMENTATION_AUTHORIZED.includes('YES'), false);
  // Compatibility alias still resolves to historical pin, never live closeout.
  assert.equal(digestRule02(loadWorkspaceRule02Text()), HISTORICAL_RULE02_SHA256);
  assert.notEqual(digestRule02(loadWorkspaceRule02Text()), digestRule02(live));
});

test('HIST-07 foreign historical governance revision cannot silently substitute', () => {
  const hist = loadHistoricalActivationRule02Text();
  const substituted = hist.replaceAll(
    `**GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}**`,
    '**GOVERNANCE_REVISION = DLP010_CLOSEOUT_20261103**',
  );
  assert.throws(
    () => verifyHistoricalRule02Text(substituted),
    /HISTORICAL_RULE02_DIGEST_MISMATCH|HISTORICAL_RULE02_REVISION_MISSING/,
  );
  assert.throws(
    () => createDisposableMergeEffectivenessHarness({
      mergedRule02Text: substituted,
    }),
    /PRIVILEGED_HARNESS_RULE02_OVERRIDE_REQUIRED/,
  );
  const h = createDisposableMergeEffectivenessHarness({
    privilegedRule02Override: true,
    mergedRule02Text: substituted,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    instructionOverrides: { jti: 'hist-07-wrong-rev' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_GOVERNANCE_REVISION_MISMATCH);
  // Symbol latch also accepted; still TEST_ONLY / disposable-only.
  const h2 = createDisposableMergeEffectivenessHarness({
    privilegedRule02Override: PRIVILEGED_HARNESS_RULE02_OVERRIDE,
    mergedRule02Text: substituted,
  });
  assert.equal(h2.privilegedRule02OverrideUsed, true);
  assertDeny(
    evaluateEffectiveImplementationAuthorization(h2.buildGateInput({
      instructionOverrides: { jti: 'hist-07-symbol-override' },
    })),
    GATE_DECISIONS.DENY_GOVERNANCE_REVISION_MISMATCH,
  );
});

test('HIST-08 approved A1 residual remains truthfully reported', () => {
  const installed = createDisposableEffectiveAuthorizationTrustRoot({
    privilegedTrustInjection: DISPOSABLE_TRUST_INJECTION_TOKEN,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    disposableRule02Override: loadHistoricalActivationRule02Text(),
    mergedProvenance: true,
    activationPr: '#266',
  });
  assert.equal(installed.trustRoot.sameProcessTrustInstallerResidual, true);
  const view = getTrustRootPublicView(installed.trustRoot);
  const issued = issueOwnerInstructionFromTrustRoot(installed.installerCapability, {
    jti: 'hist-08-a1',
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
  const live = loadLiveWorkspaceRule02Text();
  assert.match(live, /SAME_PROCESS_INSTALLER_RESIDUAL = NOT_SEALED/);
  assert.match(live, /A1_SELF_ALLOW_PROVEN/);
});
