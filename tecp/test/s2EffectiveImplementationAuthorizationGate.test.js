/**
 * S2 Effective Implementation Authorization Gate — offline adversarial tests.
 * NON_OPERATIONAL / TEST_ONLY fixtures. No Owner enrollment. No live SQL.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';

import {
  S2_GATE_AUTHORIZED_FILE_SCOPE,
  S2_GATE_DECISIONS as GD,
  S2_GATE_GOVERNANCE_REVISION,
  S2_GATE_OPERATION_CLASS,
  S2_GATE_REPOSITORY_ID,
  S2_GATE_SLICE_ID,
  S2_TEST_ONLY_GATE_HARNESS_TOKEN,
  __testOnlyS2EvaluationLockHooks,
  advanceTestHarnessClock,
  assertS2MutationFenceFresh,
  createTestOnlyS2EffectiveAuthHarness,
  driftTestHarnessTip,
  evaluateS2EffectiveImplementationAuthorization,
  inspectTrustedGitMergeProvenance,
  isBrandedS2GateDecision,
  issueS2OwnerInstructionFromTestHarness,
  replaceTestHarnessProvenance,
  revokeTestHarnessJti,
  s2GateDigestText,
} from '../src/s2EffectiveImplementationAuthorizationGate.js';
import {
  S2_OWNER_INSTRUCTION_DECISIONS,
  createOwnerInstalledS2ImplTrustDeps,
} from '../src/s2OwnerImplementationInstruction.js';
import { parseRule02 } from '../src/rule02Parser.js';
import { validateGovernance } from '../src/governanceValidator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const RULE02_PATH = join(REPO_ROOT, '.cursor/rules/titangold-current-active-work.mdc');
const RULE02_TEXT = readFileSync(RULE02_PATH, 'utf8');
const RULE02_DIGEST = createHash('sha256').update(RULE02_TEXT, 'utf8').digest('hex');
const CANONICAL_SHA = 'b1027b749fe8286424fdedfa036384c8790bc830';
const RULE02_BLOB = 'e6b0a195b3ed2d145f61f45316423df2120c1354';
const MERGE_PARENT_1 = '93e06fedb93b64bac2c4051199254f75247a0b9d';
const MERGE_PARENT_2 = 'd4b9f68a91476d2180cb1f8e2508b785c83672e1';

function assertNoSecrets(value) {
  const text = JSON.stringify(value);
  assert.equal(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(text), false);
  assert.equal(/privateKeyPem/i.test(text), false);
}

function assertDeny(result, decision) {
  assert.equal(result.ok, false);
  assert.equal(result.decision, decision);
  assert.equal(result.standingAuthority, false);
  assert.equal(result.operational, false);
  assert.equal(result.fullS2EffectiveAuthorization, false);
  assert.equal(isBrandedS2GateDecision(result), true);
  assertNoSecrets(result);
}

function makeHarness(overrides = {}) {
  return createTestOnlyS2EffectiveAuthHarness({
    testOnlyHarnessToken: S2_TEST_ONLY_GATE_HARNESS_TOKEN,
    canonicalSha: CANONICAL_SHA,
    rule02Text: RULE02_TEXT,
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: MERGE_PARENT_1,
    mergeParent2: MERGE_PARENT_2,
    mergedProvenanceVerified: true,
    ...overrides,
  });
}

function baseInput(harnessBundle, overrides = {}) {
  return {
    testOnlyHarness: harnessBundle.harness,
    repositoryId: S2_GATE_REPOSITORY_ID,
    sliceId: S2_GATE_SLICE_ID,
    operationClass: S2_GATE_OPERATION_CLASS,
    governanceRevision: S2_GATE_GOVERNANCE_REVISION,
    authorizedFileScope: [...S2_GATE_AUTHORIZED_FILE_SCOPE],
    requestedPaths: [...S2_GATE_AUTHORIZED_FILE_SCOPE],
    expectedCanonicalSha: CANONICAL_SHA,
    expectedRule02DigestSha256: RULE02_DIGEST,
    expectedRule02GitBlob: RULE02_BLOB,
    expectedMergeParent1: MERGE_PARENT_1,
    expectedMergeParent2: MERGE_PARENT_2,
    ...overrides,
  };
}

test('POS-G01 TEST_ONLY harness + instruction + validator ALLOW (NON_OPERATIONAL fixture)', () => {
  assert.equal(RULE02_DIGEST, 'f7310f6f41e8a312ec0181fd73d9b70c9a897f95f17c630eb7488f43afe3b277');
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'posg01jti0001' });
  assert.equal(issued.ok, true);
  assert.equal(issued.testOnly, true);
  const result = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.decision, GD.ALLOW);
  assert.equal(result.operational, false);
  assert.equal(result.fullS2EffectiveAuthorization, false);
  assert.equal(result.authorization.testOnly, true);
  assert.equal(result.authorization.standingAuthority, false);
  assertNoSecrets(result);
});

test('POS-G02 merge provenance inspect against live worktree Git objects', () => {
  const inspected = inspectTrustedGitMergeProvenance(REPO_ROOT, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_SHA,
    rule02RelativePath: '.cursor/rules/titangold-current-active-work.mdc',
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: MERGE_PARENT_1,
    mergeParent2: MERGE_PARENT_2,
  });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.canonicalSha, CANONICAL_SHA);
  assert.equal(inspected.rule02GitBlob, RULE02_BLOB);
  assert.equal(inspected.rule02DigestSha256, RULE02_DIGEST);
});

test('POS-G03 canonical Validator ALLOW for exact four paths', () => {
  const parsed = parseRule02(RULE02_TEXT);
  const v = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: [...S2_GATE_AUTHORIZED_FILE_SCOPE],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(v.allowed, true);
});

test('NEG-G01 missing Owner trust DENYs on production path', () => {
  const installed = createOwnerInstalledS2ImplTrustDeps({});
  assert.equal(installed.ok, false);
  assert.equal(installed.decision, S2_OWNER_INSTRUCTION_DECISIONS.DENY_OWNER_TRUST_MISSING);
  const result = evaluateS2EffectiveImplementationAuthorization({
    repositoryId: S2_GATE_REPOSITORY_ID,
    sliceId: S2_GATE_SLICE_ID,
    operationClass: S2_GATE_OPERATION_CLASS,
    governanceRevision: S2_GATE_GOVERNANCE_REVISION,
    authorizedFileScope: [...S2_GATE_AUTHORIZED_FILE_SCOPE],
    expectedCanonicalSha: CANONICAL_SHA,
    expectedRule02DigestSha256: RULE02_DIGEST,
    expectedRule02GitBlob: RULE02_BLOB,
    expectedMergeParent1: MERGE_PARENT_1,
    expectedMergeParent2: MERGE_PARENT_2,
    ownerInstructionEncoded: 'a.b',
  });
  assertDeny(result, GD.DENY_OWNER_TRUST_MISSING);
});

test('NEG-G02 caller-injected trust objects rejected', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    publicKeyPem: 'x',
  })), GD.DENY_CALLER_SUPPLIED_TRUST);
});

test('NEG-G03 fake merged provenance flag rejected', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    merged: true,
  })), GD.DENY_FAKE_MERGED_FLAG);
});

test('NEG-G04 unmerged / unverified provenance DENYs', () => {
  const harness = makeHarness({ mergedProvenanceVerified: false });
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY);
});

test('NEG-G05 forged/incomplete git ancestry inspect DENYs', () => {
  const bad = inspectTrustedGitMergeProvenance(REPO_ROOT, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_SHA,
    rule02RelativePath: '.cursor/rules/titangold-current-active-work.mdc',
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: '0'.repeat(40),
    mergeParent2: MERGE_PARENT_2,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'MERGE_PARENTS_MISMATCH');
});

test('NEG-G06 wrong repository DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    repositoryId: 'other/repo',
  })), GD.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('NEG-G07 wrong active AWP DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    sliceId: 'WRONG-SLICE',
  })), GD.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('NEG-G08 wrong canonical SHA DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    expectedCanonicalSha: '0'.repeat(40),
  })), GD.DENY_WRONG_CANONICAL_SHA);
});

test('NEG-G09 wrong Rule02 digest DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    expectedRule02DigestSha256: 'a'.repeat(64),
  })), GD.DENY_WRONG_RULE02_BLOB_OR_DIGEST);
});

test('NEG-G10 wrong governance revision DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    governanceRevision: 'WRONG_REV',
  })), GD.DENY_WRONG_GOVERNANCE_REVISION);
});

test('NEG-G11 wrong operation class DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    operationClass: 'DEPLOY',
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});

test('NEG-G12 one extra requested path DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    requestedPaths: [...S2_GATE_AUTHORIZED_FILE_SCOPE, 'tecp/src/extra.js'],
  })), GD.DENY_PROTECTED_OR_EXTRA_PATH);
});

test('NEG-G13 unauthorized protected path DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: ['.cursor/rules/titangold-current-active-work.mdc'],
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});

test('NEG-G14 missing authorized path DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    requestedPaths: S2_GATE_AUTHORIZED_FILE_SCOPE.slice(0, 3),
  })), GD.DENY_PROTECTED_OR_EXTRA_PATH);
});

test('NEG-G15 DLP011 / live Tier-3 substitution rejected', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    dlp011Instruction: { kind: 'TECP_DLP011_OWNER_IMPLEMENTATION_INSTRUCTION' },
  })), GD.DENY_DLP011_OR_LIVE_SUBSTITUTION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    liveTier3Capability: { kind: 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1' },
  })), GD.DENY_DLP011_OR_LIVE_SUBSTITUTION);
});

test('NEG-G16 production mutation / deploy / live SQL / dispatcher / worker / capability DENY', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  const enc = issued.instruction.encoded;
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, productionMutation: true,
  })), GD.DENY_PRODUCTION_MUTATION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, deployment: true,
  })), GD.DENY_DEPLOYMENT);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, liveSql: true,
  })), GD.DENY_LIVE_SQL);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, operationalDispatcher: true,
  })), GD.DENY_OPERATIONAL_DISPATCH);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, mcpMutation: true,
  })), GD.DENY_WORKER_OR_MCP_MUTATION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: enc, capabilityIssuance: true,
  })), GD.DENY_CAPABILITY_ISSUANCE);
});

test('NEG-G17 expired instruction DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { ttlMs: 1_000, jti: 'expg17jti0001' });
  advanceTestHarnessClock(harness, 2_000);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_OWNER_INSTRUCTION);
});

test('NEG-G18 revoked JTI DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'revg18jti0001' });
  revokeTestHarnessJti(harness, 'revg18jti0001');
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_OWNER_INSTRUCTION);
});

test('NEG-G19 replayed JTI DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'repg19jti0001' });
  const first = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(first.ok, true);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_OWNER_INSTRUCTION);
});

test('NEG-G20 tip drift between proof and authorization DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'drift20jti001' });
  // Drift tip after instruction issuance, before evaluate — should DENY at tip check.
  driftTestHarnessTip(harness, { tipSha: '1'.repeat(40) });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_TIP_DRIFT);
});

test('NEG-G21 fence detects tip change after ALLOW', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'fence21jti001' });
  const result = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(result.ok, true);
  driftTestHarnessTip(harness, { tipSha: '2'.repeat(40) });
  assertDeny(assertS2MutationFenceFresh(result.authorization.fence, harness.harness), GD.DENY_TIP_DRIFT);
});

test('NEG-G22 concurrent evaluation lock DENYs', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'lock22jti0001' });
  const token = __testOnlyS2EvaluationLockHooks.hold();
  assert.ok(token);
  try {
    assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
      ownerInstructionEncoded: issued.instruction.encoded,
    })), GD.DENY_CONFLICTING_AUTHORIZATION);
  } finally {
    __testOnlyS2EvaluationLockHooks.release(token);
  }
});

test('NEG-G23 missing owner instruction DENYs', () => {
  const harness = makeHarness();
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: '',
  })), GD.DENY_MISSING_OWNER_INSTRUCTION);
});

test('NEG-G24 forged Rule02 text DENYs', () => {
  const harness = makeHarness();
  replaceTestHarnessProvenance(harness, {
    rule02Text: '# forged\n**IMPLEMENTATION_AUTHORIZED = NO**\n',
    rule02DigestSha256: s2GateDigestText('# forged\n**IMPLEMENTATION_AUTHORIZED = NO**\n'),
    tipDigest: s2GateDigestText('# forged\n**IMPLEMENTATION_AUTHORIZED = NO**\n'),
  });
  const issued = issueS2OwnerInstructionFromTestHarness(harness, { jti: 'forge24jti001' });
  // Digest binding in input still expects real digest → wrong digest, or forged structure.
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_WRONG_RULE02_BLOB_OR_DIGEST);
});

test('NEG-G25 public harness construction without token forbidden', () => {
  assert.throws(() => createTestOnlyS2EffectiveAuthHarness({
    canonicalSha: CANONICAL_SHA,
    rule02Text: RULE02_TEXT,
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: MERGE_PARENT_1,
    mergeParent2: MERGE_PARENT_2,
  }), /S2_TEST_ONLY_GATE_HARNESS_TOKEN_REQUIRED/);
});

test('NEG-G26 validatorAllowed flag rejected', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    validatorAllowed: true,
  })), GD.DENY_FAKE_MERGED_FLAG);
});
