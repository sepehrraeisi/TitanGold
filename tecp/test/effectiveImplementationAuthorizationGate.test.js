/**
 * TECP-DLP-011 adversarial + positive offline tests.
 * NON_OPERATIONAL disposable proof. No DB writes. No Worker execution.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GATE_AUTHORIZED_FILE_SCOPE,
  GATE_DECISIONS,
  GATE_OPERATION_CLASS,
  GATE_REPOSITORY_ID,
  GATE_SLICE_ID,
  __testOnlyEvaluationLockHooks,
  assertMutationFenceFresh,
  createCanonicalRule02Source,
  createTestOnlyAttestedCanonicalRule02Source,
  createTrustedTipAttestation,
  evaluateEffectiveImplementationAuthorization,
  isBrandedGateDecision,
} from '../src/effectiveImplementationAuthorizationGate.js';
import {
  OWNER_INSTRUCTION_DECISIONS,
  createOwnerImplementationInstructionVerifier,
  createUnavailableOwnerInstructionClock,
  issueOwnerImplementationInstruction,
} from '../src/ownerImplementationInstruction.js';
import {
  CANONICAL_MAIN_SHA_PIN,
  DEFAULT_GOVERNANCE_REVISION,
  DEFAULT_ISSUER,
  DEFAULT_KID,
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

test('01 canonical closed Rule02 → DENY_CANONICAL_CLOSED', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const closed = h.createClosedSource();
  const tip = h.tipFor(closed);
  const input = h.buildGateInput({
    canonicalRule02Source: closed,
    tipAttestation: tip,
    expectedCanonicalSha: closed.canonicalSha,
    expectedRule02DigestSha256: closed.rule02DigestSha256,
    instructionOverrides: {
      rule02DigestSha256: closed.rule02DigestSha256,
      canonicalSha: closed.canonicalSha,
    },
  });
  // Rebuild instruction binding to closed digest
  const issued = h.issueExactSliceInstruction({
    rule02DigestSha256: closed.rule02DigestSha256,
    canonicalSha: closed.canonicalSha,
  });
  input.ownerInstructionEncoded = issued.instruction.encoded;
  const result = evaluateEffectiveImplementationAuthorization(input);
  assertDeny(result, GATE_DECISIONS.DENY_CANONICAL_CLOSED);
});

test('02 unmerged YES-token proposal → DENY_UNMERGED_YES_TOKEN', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const unmerged = h.createUnmergedYesSource();
  const tip = h.tipFor(unmerged);
  const issued = h.issueExactSliceInstruction({
    rule02DigestSha256: unmerged.rule02DigestSha256,
    canonicalSha: unmerged.canonicalSha,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: unmerged,
    tipAttestation: tip,
    expectedCanonicalSha: unmerged.canonicalSha,
    expectedRule02DigestSha256: unmerged.rule02DigestSha256,
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_UNMERGED_YES_TOKEN);
});

test('03 forged YES-token Rule02 parse failure → DENY_FORGED_RULE02', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const forged = h.createForgedRule02Source();
  const tip = h.tipFor(forged);
  const issued = h.issueExactSliceInstruction({
    rule02DigestSha256: forged.rule02DigestSha256,
    canonicalSha: forged.canonicalSha,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: forged,
    tipAttestation: tip,
    expectedCanonicalSha: forged.canonicalSha,
    expectedRule02DigestSha256: forged.rule02DigestSha256,
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_FORGED_RULE02);
});

test('04 validator ALLOW path missing owner instruction → DENY_MISSING_OWNER_INSTRUCTION', () => {
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
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_CANONICAL_SHA);
});

test('06 wrong Rule02 digest → DENY_WRONG_RULE02_DIGEST', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    expectedRule02DigestSha256: '0'.repeat(64),
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
});

test('07 fake merged/canonical caller flags → DENY_FAKE_MERGED_FLAG', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    merged: true,
    canonical: true,
    branchName: 'main',
  }));
  assertDeny(result, GATE_DECISIONS.DENY_FAKE_MERGED_FLAG);
});

test('08 untrusted canonical source (plain object) → DENY_UNTRUSTED_CANONICAL_SOURCE', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: {
      kind: 'TECP_DLP011_CANONICAL_RULE02_SOURCE',
      repositoryId: GATE_REPOSITORY_ID,
      canonicalSha: CANONICAL_MAIN_SHA_PIN,
      rule02Text: loadWorkspaceRule02Text(),
      rule02DigestSha256: h.mergedDigest,
      sourceKind: 'TEST_ONLY_ATTESTED',
      mergedProvenance: true,
      tipDigest: h.mergedDigest,
    },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_UNTRUSTED_CANONICAL_SOURCE);
});

test('08b privileged factory rejects unattested spec', () => {
  assert.throws(() => createCanonicalRule02Source({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    rule02Text: 'x',
    sourceKind: 'TEST_ONLY_ATTESTED',
    merged: true,
  }), /PRIVILEGED_ATTESTATION_REQUIRED/);
});

test('09 unbranded / serialized verifier → DENY_UNBRANDED_VERIFIER', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionVerifier: {
      kind: 'TECP_DLP011_OWNER_INSTRUCTION_VERIFIER',
      verify() { return { ok: true }; },
    },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_UNBRANDED_VERIFIER);
});

test('10 invalid signature → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction();
  const bad = h.forgeInvalidSignatureInstruction(issued.instruction.encoded);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: bad,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
  assert.equal(result.reasons.some((r) => /INVALID_SIGNATURE|DENY_INVALID/.test(String(r))
    || r === OWNER_INSTRUCTION_DECISIONS.DENY_INVALID_SIGNATURE), true);
});

test('11 unknown key ID → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  // Issue under harness, then verify expectation uses unknown kid by crafting foreign-signed payload
  const issued = h.issueExactSliceInstruction();
  const claims = { ...issued.instruction.claims, kid: 'unknown-kid', jti: 'foreign-jti-1' };
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
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
});

test('12b wrong authorized paths → DENY_WRONG_SCOPE_OR_ACTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    authorizedFileScope: ['tecp/src/evil.js'],
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
});

test('13 wrong repository or slice → DENY_WRONG_REPOSITORY_OR_SLICE', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    sliceId: 'TECP-DLP-999-FAKE',
  }));
  assertDeny(result, GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('14 expired instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ ttlMs: 1_000 });
  h.clock.advance(5_000);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('15 revoked instruction → DENY_OWNER_INSTRUCTION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'revoked-jti-dlp011' });
  h.revocationRegistry.revokeJti('revoked-jti-dlp011');
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
  assert.equal(h.revocationRegistry.consumeJti('replay-jti'), true);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('18 missing clock / revocation via unbranded deps denied at verifier construction', () => {
  assert.throws(() => createOwnerImplementationInstructionVerifier({
    keyRegistry: {},
    revocationRegistry: {},
    clock: {},
  }), /TRUSTED_OWNER_INSTRUCTION_VERIFIER_DEPS_REQUIRED/);

  const h = createDisposableMergeEffectivenessHarness();
  const unavailableClock = createUnavailableOwnerInstructionClock();
  const verifier = createOwnerImplementationInstructionVerifier({
    keyRegistry: h.keyRegistry,
    revocationRegistry: h.revocationRegistry,
    clock: unavailableClock,
    consumeOnAllow: true,
  });
  const issued = h.issueExactSliceInstruction();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionVerifier: verifier,
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_CLOCK_OR_REVOCATION_UNAVAILABLE);
});

test('19 stale tip → DENY_STALE_TIP', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const staleTip = createTrustedTipAttestation({
    tipSha: CANONICAL_MAIN_SHA_PIN,
    tipDigest: '1'.repeat(64),
    attestedByPrivilegedFactory: true,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    tipAttestation: staleTip,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_STALE_TIP);
});

test('20 tip drift between evaluation and mutation fence → DENY_TIP_DRIFT', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction({ jti: 'fence-jti' });
  const first = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(first.ok, true);
  const drifted = createTrustedTipAttestation({
    tipSha: CANONICAL_MAIN_SHA_PIN,
    tipDigest: '2'.repeat(64),
    attestedByPrivilegedFactory: true,
  });
  const fenceResult = assertMutationFenceFresh(first.authorization.fence, drifted);
  assertDeny(fenceResult, GATE_DECISIONS.DENY_TIP_DRIFT);
});

test('21 caller-provided AuthorizedInvocation → DENY_CALLER_AUTHORIZED_INVOCATION', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    authorizedInvocation: { ok: true, decision: 'ALLOW' },
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

test('22b malformed encoding → DENY_OWNER_INSTRUCTION or MALFORMED', () => {
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

test('23 secret-containing error/result must fail closed without leakage', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const issued = h.issueExactSliceInstruction();
  const bad = h.forgeInvalidSignatureInstruction(issued.instruction.encoded);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: bad,
  }));
  assert.equal(result.ok, false);
  assertNoSecrets(result);
  assertNoSecrets(h.mergedSource);
  // Harness holds private key locally; gate outputs must not echo it
  assert.equal(JSON.stringify(result).includes(h.keys.privateKeyPem), false);
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

test('25 valid TEST_ONLY merged provenance + exact-slice owner instruction → ALLOW (bounded)', () => {
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
  assert.equal(result.authorization.standingAuthority, false);
  assert.equal(result.authorization.sliceId, GATE_SLICE_ID);
  assert.equal(result.authorization.repositoryId, GATE_REPOSITORY_ID);
  assert.equal(result.authorization.operationClass, GATE_OPERATION_CLASS);
  assert.deepEqual([...result.authorization.authorizedFileScope], [...GATE_AUTHORIZED_FILE_SCOPE]);
  assert.equal(result.authorization.canonicalSha, CANONICAL_MAIN_SHA_PIN);
  assertNoSecrets(result);

  // Fresh fence OK with matching tip
  const fenceOk = assertMutationFenceFresh(result.authorization.fence, h.tipAttestation);
  assert.equal(fenceOk.ok, true);
  assert.equal(fenceOk.standingAuthority, false);

  // Prior ALLOW is not standing — replay DENY
  const replay = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(replay, GATE_DECISIONS.DENY_OWNER_INSTRUCTION);
});

test('25b authorization check does not claim DB write or Worker execution', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const closed = h.createClosedSource();
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: closed,
    tipAttestation: h.tipFor(closed),
    expectedCanonicalSha: closed.canonicalSha,
    expectedRule02DigestSha256: closed.rule02DigestSha256,
    ownerInstructionEncoded: h.issueExactSliceInstruction({
      rule02DigestSha256: closed.rule02DigestSha256,
      canonicalSha: closed.canonicalSha,
    }).instruction.encoded,
  }));
  assert.equal(result.performsDatabaseWrite, false);
  assert.equal(result.executesWorker, false);
});

test('non-claims: frozen validator alone remains insufficient (harness documents gap)', () => {
  // Unmerged YES text would ALLOW under frozen validator; gate still DENY without provenance.
  const text = synthesizeUnmergedYesTokenRule02Text();
  assert.equal(typeof text, 'string');
  assert.equal(text.includes('YES / EXACT_SLICE_ONLY'), true);
  const closed = synthesizeClosedRule02Text();
  assert.equal(closed.includes(`IMPLEMENTATION_AUTHORIZED = ${'CONSUMED / NON-ACTIVE'}`), true);
});

test('TEST_ONLY purpose required on instructions', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const bad = issueOwnerImplementationInstruction({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    rule02DigestSha256: h.mergedDigest,
    sliceId: GATE_SLICE_ID,
    authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: DEFAULT_GOVERNANCE_REVISION,
    purpose: 'PRODUCTION',
    issuer: DEFAULT_ISSUER,
    kid: DEFAULT_KID,
  }, { keyRegistry: h.keyRegistry, clock: h.clock });
  assert.equal(bad.ok, false);
  assert.equal(bad.decision, OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_PURPOSE);
});

test('explicit testOnlyEnvironment required (no ambient env authority)', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const input = h.buildGateInput({ instructionOverrides: { jti: 'env-jti' } });
  delete input.testOnlyEnvironment;
  const result = evaluateEffectiveImplementationAuthorization(input);
  assertDeny(result, GATE_DECISIONS.DENY_ENVIRONMENT_NOT_TEST_ONLY);
});

test('P1 non-consuming verifier → DENY_NON_CONSUMING_VERIFIER', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const nonConsuming = createOwnerImplementationInstructionVerifier({
    keyRegistry: h.keyRegistry,
    revocationRegistry: h.revocationRegistry,
    clock: h.clock,
    consumeOnAllow: false,
  });
  assert.equal(nonConsuming.consumeOnAllow, false);
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    ownerInstructionVerifier: nonConsuming,
    instructionOverrides: { jti: 'non-consume-jti' },
  }));
  assertDeny(result, GATE_DECISIONS.DENY_NON_CONSUMING_VERIFIER);
});

test('P1 caller governanceRevision mismatch vs parsed Rule02 → DENY', () => {
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
  const digest = h.digestRule02(mutated);
  const source = createTestOnlyAttestedCanonicalRule02Source({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    rule02Text: mutated,
    expectedRule02DigestSha256: digest,
    mergedProvenance: true,
    activationPr: '#266',
    tipDigest: digest,
  });
  const tip = createTrustedTipAttestation({
    tipSha: CANONICAL_MAIN_SHA_PIN,
    tipDigest: digest,
    attestedByPrivilegedFactory: true,
  });
  const issued = h.issueExactSliceInstruction({
    jti: 'scope-mismatch-jti',
    rule02DigestSha256: digest,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: source,
    tipAttestation: tip,
    expectedRule02DigestSha256: digest,
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_PARSED_SCOPE_MISMATCH);
});

test('P1 parsed active slice mismatch → DENY_PARSED_SLICE_MISMATCH', () => {
  const h = createDisposableMergeEffectivenessHarness();
  const mutated = loadWorkspaceRule02Text()
    .replaceAll(
      'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE',
      'TECP-DLP-999-FAKE-SLICE',
    );
  // Keep gate constants; Rule02 now names a different slice.
  const digest = h.digestRule02(mutated);
  const source = createTestOnlyAttestedCanonicalRule02Source({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_MAIN_SHA_PIN,
    rule02Text: mutated,
    expectedRule02DigestSha256: digest,
    mergedProvenance: true,
    activationPr: '#266',
    tipDigest: digest,
  });
  const tip = createTrustedTipAttestation({
    tipSha: CANONICAL_MAIN_SHA_PIN,
    tipDigest: digest,
    attestedByPrivilegedFactory: true,
  });
  const issued = h.issueExactSliceInstruction({
    jti: 'slice-mismatch-jti',
    rule02DigestSha256: digest,
  });
  const result = evaluateEffectiveImplementationAuthorization(h.buildGateInput({
    canonicalRule02Source: source,
    tipAttestation: tip,
    expectedRule02DigestSha256: digest,
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assertDeny(result, GATE_DECISIONS.DENY_PARSED_SLICE_MISMATCH);
});
