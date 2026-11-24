/**
 * S2 Effective Implementation Authorization Gate — offline adversarial tests.
 * NON_OPERATIONAL / TEST_ONLY fixtures. No Owner enrollment. No live SQL.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

import {
  S2_GATE_AUTHORIZED_FILE_SCOPE,
  S2_GATE_DECISIONS as GD,
  S2_GATE_GOVERNANCE_REVISION,
  S2_GATE_OPERATION_CLASS,
  S2_GATE_REPOSITORY_ID,
  S2_GATE_SLICE_ID,
  __testOnlyS2EvaluationLockHooks,
  advanceTestHarnessClock,
  assertS2MutationFenceFresh,
  consumeAuthenticS2OfflineImplementationAuthorization,
  createTestOnlyS2EffectiveAuthHarness,
  driftTestHarnessTip,
  evaluateS2EffectiveImplementationAuthorization,
  inspectTrustedGitMergeProvenance,
  isAuthenticS2OfflineMutationAuthorization,
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
/** TEST_ONLY harness fixture identity pins (self-consistent; not live tip authority). */
const CANONICAL_SHA = 'b1027b749fe8286424fdedfa036384c8790bc830';
const RULE02_BLOB = 'e6b0a195b3ed2d145f61f45316423df2120c1354';
const MERGE_PARENT_1 = '93e06fedb93b64bac2c4051199254f75247a0b9d';
const MERGE_PARENT_2 = 'd4b9f68a91476d2180cb1f8e2508b785c83672e1';

/** Independently parsed current canonical Rule02 facts (worktree bytes). */
const PARSED_RULE02 = parseRule02(RULE02_TEXT);
const CURRENT_GOVERNANCE_REVISION = PARSED_RULE02.authority.governanceRevision;
const CURRENT_AUTHORIZED_FILE_SCOPE = Object.freeze([
  ...PARSED_RULE02.governanceFacts.authorizedFileScope,
]);
/**
 * Independently established expected facts. These literals are not derived from
 * RULE02_TEXT; the tests below require the loaded bytes to match them.
 */
const EXPECTED_RULE02_DIGEST_SHA256 = 'bc967b056b7029c3a2abd74c90ba02ed84a7e834967d89327d7936c8118aad9f';
const EXPECTED_GOVERNANCE_REVISION = 'OPS_PILOT_001_S2_SUITE_B_CONSOLIDATED_OFFLINE_REMEDIATION_GOVERNANCE_20261124';
const EXPECTED_AUTHORIZED_FILE_SCOPE = Object.freeze([
  'tecp-ops-persistence/scripts/ownerControlledTier3LocalRunner.js',
  'tecp-ops-persistence/test/cp2DbDispatcherIntegration.test.js',
  'tecp/test/s2EffectiveImplementationAuthorizationGate.test.js',
  'tecp/test/s2OwnerImplementationInstruction.test.js',
]);
/** Documentation / historical four-path Adapter constants retained for negative coverage. */
const HISTORICAL_FOUR_PATH_ADAPTER_SCOPE = Object.freeze([...S2_GATE_AUTHORIZED_FILE_SCOPE]);
const HISTORICAL_EFF_AUTH_GOVERNANCE_REVISION = S2_GATE_GOVERNANCE_REVISION;


function gitText(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function ensureDisposableLiveTipCheckout(preferredRoot) {
  // Inspect requires HEAD at origin/main tip AND GitHub origin identity.
  // Local shared clones often use a filesystem origin URL; always normalize via disposable mirror.
  let sourceRoot = preferredRoot;
  try {
    if (gitText(preferredRoot, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
      throw new Error('not-a-work-tree');
    }
  } catch {
    const override = process.env.S2_GATE_LIVE_GIT_ROOT;
    if (!override) throw new Error('LIVE_GIT_ROOT_UNAVAILABLE');
    sourceRoot = override;
  }
  const tip = gitText(sourceRoot, ['rev-parse', 'origin/main']);
  let originUrl = gitText(sourceRoot, ['remote', 'get-url', 'origin']);
  const originIsGithub = /sepehrraeisi\/TitanGold/i.test(originUrl);
  let headMatchesTip = false;
  try {
    headMatchesTip = gitText(sourceRoot, ['rev-parse', 'HEAD']) === tip;
  } catch {
    headMatchesTip = false;
  }
  if (headMatchesTip && originIsGithub) {
    return sourceRoot;
  }
  const mirror = join('/tmp', `s2-gate-livetip-${tip.slice(0, 12)}`);
  if (!existsSync(join(mirror, '.git'))) {
    execFileSync('git', ['clone', '--quiet', '--no-checkout', sourceRoot, mirror], { encoding: 'utf8' });
  }
  // Prefer object availability from shared source; force tip checkout and GitHub identity.
  execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: mirror, encoding: 'utf8' });
  try {
    execFileSync('git', ['fetch', '--quiet', sourceRoot, 'main'], { cwd: mirror, encoding: 'utf8' });
  } catch {
    // optional
  }
  execFileSync('git', ['checkout', '--quiet', '-f', tip], { cwd: mirror, encoding: 'utf8' });
  execFileSync('git', ['update-ref', 'refs/remotes/origin/main', tip], { cwd: mirror, encoding: 'utf8' });
  if (!originIsGithub) {
    originUrl = 'https://github.com/sepehrraeisi/TitanGold.git';
  }
  execFileSync('git', ['remote', 'set-url', 'origin', originUrl], { cwd: mirror, encoding: 'utf8' });
  return mirror;
}

/** Independently derive live origin/main provenance bindings (not from inspector output). */
function deriveLiveTipProvenanceBindings(preferredRoot) {
  const repoRoot = ensureDisposableLiveTipCheckout(preferredRoot);
  const canonicalSha = gitText(repoRoot, ['rev-parse', 'origin/main']);
  if (gitText(repoRoot, ['rev-parse', 'HEAD']) !== canonicalSha) {
    throw new Error('LIVE_TIP_HEAD_MISMATCH');
  }
  const parentsLine = gitText(repoRoot, ['rev-list', '--parents', '-n', '1', canonicalSha]);
  const parts = parentsLine.split(/\s+/).filter(Boolean);
  if (parts.length !== 3 || parts[0] !== canonicalSha) {
    throw new Error(`LIVE_TIP_NOT_TWO_PARENT_MERGE:${parentsLine}`);
  }
  const rule02RelativePath = '.cursor/rules/titangold-current-active-work.mdc';
  const rule02GitBlob = gitText(repoRoot, ['rev-parse', `${canonicalSha}:${rule02RelativePath}`]);
  const rule02Bytes = execFileSync('git', ['cat-file', 'blob', rule02GitBlob], { cwd: repoRoot });
  const rule02DigestSha256 = createHash('sha256').update(rule02Bytes).digest('hex');
  return Object.freeze({
    repoRoot,
    canonicalSha,
    mergeParent1: parts[1],
    mergeParent2: parts[2],
    rule02RelativePath,
    rule02GitBlob,
    rule02DigestSha256,
  });
}




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
    governanceRevision: CURRENT_GOVERNANCE_REVISION,
    authorizedFileScope: [...CURRENT_AUTHORIZED_FILE_SCOPE],
    requestedPaths: [...CURRENT_AUTHORIZED_FILE_SCOPE],
    expectedCanonicalSha: CANONICAL_SHA,
    expectedRule02DigestSha256: RULE02_DIGEST,
    expectedRule02GitBlob: RULE02_BLOB,
    expectedMergeParent1: MERGE_PARENT_1,
    expectedMergeParent2: MERGE_PARENT_2,
    ...overrides,
  };
}

/** Issue TEST_ONLY Owner instruction bound to current Rule02 scope/revision. */
function issueCurrentInstruction(harnessBundle, overrides = {}) {
  return issueS2OwnerInstructionFromTestHarness(harnessBundle, {
    authorizedFileScope: [...CURRENT_AUTHORIZED_FILE_SCOPE],
    governanceRevision: CURRENT_GOVERNANCE_REVISION,
    ...overrides,
  });
}

test('POS-G01 TEST_ONLY harness + instruction + validator ALLOW (NON_OPERATIONAL fixture)', () => {
  // Digest independently from Rule02 bytes (not Gate decision echo; not a self-pin).
  const independentDigest = createHash('sha256').update(RULE02_TEXT, 'utf8').digest('hex');
  assert.equal(RULE02_DIGEST, independentDigest);
  assert.equal(independentDigest, EXPECTED_RULE02_DIGEST_SHA256);
  const alteredText = RULE02_TEXT.endsWith('\n')
    ? `${RULE02_TEXT.slice(0, -1)} `
    : `${RULE02_TEXT}\n`;
  const alteredDigest = createHash('sha256').update(alteredText, 'utf8').digest('hex');
  assert.notEqual(alteredDigest, EXPECTED_RULE02_DIGEST_SHA256);
  assert.notEqual(alteredDigest, independentDigest);
  // Current revision/scope from independently parsed Rule02, bound to established constants.
  assert.equal(CURRENT_GOVERNANCE_REVISION, PARSED_RULE02.authority.governanceRevision);
  assert.equal(CURRENT_GOVERNANCE_REVISION, EXPECTED_GOVERNANCE_REVISION);
  assert.deepEqual(
    [...CURRENT_AUTHORIZED_FILE_SCOPE].sort(),
    [...PARSED_RULE02.governanceFacts.authorizedFileScope].sort(),
  );
  assert.deepEqual([...EXPECTED_AUTHORIZED_FILE_SCOPE], [...EXPECTED_AUTHORIZED_FILE_SCOPE].sort());
  assert.deepEqual([...CURRENT_AUTHORIZED_FILE_SCOPE].sort(), [...EXPECTED_AUTHORIZED_FILE_SCOPE]);
  // Historical adapter scope remains documentation-only and is not current authority.
  assert.equal(
    JSON.stringify([...CURRENT_AUTHORIZED_FILE_SCOPE].sort())
      === JSON.stringify([...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE].sort()),
    false,
  );
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'posg01jti0001' });
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
  // Gate decision must not be the source of expected digest/scope facts.
  assert.notEqual(result.authorization?.rule02DigestSha256, undefined);
  assert.equal(result.authorization.rule02DigestSha256, independentDigest);
  assertNoSecrets(result);
});

test('POS-G02 merge provenance inspect against live worktree Git objects', () => {
  const expected = deriveLiveTipProvenanceBindings(REPO_ROOT);
  const inspected = inspectTrustedGitMergeProvenance(expected.repoRoot, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: expected.canonicalSha,
    rule02RelativePath: expected.rule02RelativePath,
    rule02GitBlob: expected.rule02GitBlob,
    rule02DigestSha256: expected.rule02DigestSha256,
    mergeParent1: expected.mergeParent1,
    mergeParent2: expected.mergeParent2,
  });
  assert.equal(inspected.ok, true);
  // Compare inspector result to independently derived Git facts (not to itself-only).
  assert.equal(inspected.canonicalSha, expected.canonicalSha);
  assert.equal(inspected.rule02GitBlob, expected.rule02GitBlob);
  assert.equal(inspected.rule02DigestSha256, expected.rule02DigestSha256);
  assert.equal(inspected.mergeParent1, expected.mergeParent1);
  assert.equal(inspected.mergeParent2, expected.mergeParent2);
  assert.equal(inspected.tipSha, expected.canonicalSha);
});

test('POS-G03 canonical Validator ALLOW for exact current authorized paths', () => {
  const parsed = parseRule02(RULE02_TEXT);
  // Expected facts from independently parsed Rule02, bound to established constants.
  assert.equal(parsed.authority.governanceRevision, CURRENT_GOVERNANCE_REVISION);
  assert.equal(parsed.authority.governanceRevision, EXPECTED_GOVERNANCE_REVISION);
  assert.deepEqual(
    [...parsed.governanceFacts.authorizedFileScope].sort(),
    [...EXPECTED_AUTHORIZED_FILE_SCOPE],
  );
  assert.deepEqual([...CURRENT_AUTHORIZED_FILE_SCOPE].sort(), [...EXPECTED_AUTHORIZED_FILE_SCOPE]);
  const v = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: [...CURRENT_AUTHORIZED_FILE_SCOPE],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(v.allowed, true);
  // Completed initdb paths remain outside the current authorized scope.
  const initdb = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: [
      'tecp-ops-persistence/src/disposableOpsPilotDbHarness.js',
      'tecp-ops-persistence/test/disposableOpsPilotDbHarness.test.js',
    ],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(initdb.allowed, false);
  // Former Adapter paths rejected (historical four-path is not current authority).
  const stale = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(stale.allowed, false);
  const adapterSrc = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: ['tecp/src/s2EffectiveImplementationAuthorizationGate.js'],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(adapterSrc.allowed, false);
  // Extra path rejected.
  const extra = validateGovernance(parsed, {
    sliceId: S2_GATE_SLICE_ID,
    authorityClass: parsed.governanceFacts.authorityClass,
    riskTier: parsed.governanceFacts.riskTier,
    requestedPaths: [...CURRENT_AUTHORIZED_FILE_SCOPE, 'tecp/src/extra.js'],
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
  assert.equal(extra.allowed, false);
  // Wrong governance revision is rejected by the effective authorization boundary.
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'posg03rev0001' });
  assert.equal(issued.ok, true);
  const wrongRevision = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    governanceRevision: 'OPS_PILOT_001_S2_GATE_TEST_DEBT_SINGLE_PATH_GOVERNANCE_20261121',
  }));
  assert.equal(wrongRevision.ok, false);
  assert.equal(wrongRevision.decision, GD.DENY_WRONG_GOVERNANCE_REVISION);
  assert.notEqual(wrongRevision.decision, GD.ALLOW);
});

test('NEG-G01 missing Owner trust DENYs on production path', () => {
  const prevHome = process.env.HOME;
  const iso = join('/tmp', `s2-gate-notrust-${process.pid}`);
  mkdirSync(iso, { recursive: true });
  process.env.HOME = iso;
  try {
    assertDeny(evaluateS2EffectiveImplementationAuthorization({
      repositoryId: S2_GATE_REPOSITORY_ID,
      sliceId: S2_GATE_SLICE_ID,
      operationClass: S2_GATE_OPERATION_CLASS,
      governanceRevision: CURRENT_GOVERNANCE_REVISION,
      authorizedFileScope: [...CURRENT_AUTHORIZED_FILE_SCOPE],
      expectedCanonicalSha: CANONICAL_SHA,
      expectedRule02DigestSha256: RULE02_DIGEST,
      expectedRule02GitBlob: RULE02_BLOB,
      expectedMergeParent1: MERGE_PARENT_1,
      expectedMergeParent2: MERGE_PARENT_2,
      ownerInstructionEncoded: 'a.b',
    }), GD.DENY_OWNER_TRUST_MISSING);
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  }
});

test('NEG-G02 caller-injected trust objects rejected', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    publicKeyPem: 'x',
  })), GD.DENY_CALLER_SUPPLIED_TRUST);
});

test('NEG-G03 fake merged provenance flag rejected', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    merged: true,
  })), GD.DENY_FAKE_MERGED_FLAG);
});

test('NEG-G04 unmerged / unverified provenance DENYs', () => {
  const harness = makeHarness({ mergedProvenanceVerified: false });
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY);
});

test('NEG-G05 forged/incomplete git ancestry inspect DENYs', () => {
  const expected = deriveLiveTipProvenanceBindings(REPO_ROOT);
  const forgedParent1 = expected.mergeParent1 === '0'.repeat(40) ? '1'.repeat(40) : '0'.repeat(40);
  assert.notEqual(forgedParent1, expected.mergeParent1);
  const bad = inspectTrustedGitMergeProvenance(expected.repoRoot, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: expected.canonicalSha,
    rule02RelativePath: expected.rule02RelativePath,
    rule02GitBlob: expected.rule02GitBlob,
    rule02DigestSha256: expected.rule02DigestSha256,
    mergeParent1: forgedParent1,
    mergeParent2: expected.mergeParent2,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'MERGE_PARENTS_MISMATCH');
});

test('NEG-G06 wrong repository DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    repositoryId: 'other/repo',
  })), GD.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('NEG-G07 wrong active AWP DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    sliceId: 'WRONG-SLICE',
  })), GD.DENY_WRONG_REPOSITORY_OR_SLICE);
});

test('NEG-G08 wrong canonical SHA DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    expectedCanonicalSha: '0'.repeat(40),
  })), GD.DENY_WRONG_CANONICAL_SHA);
});

test('NEG-G09 wrong Rule02 digest DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    expectedRule02DigestSha256: 'a'.repeat(64),
  })), GD.DENY_WRONG_RULE02_BLOB_OR_DIGEST);
});

test('NEG-G10 wrong governance revision DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    governanceRevision: 'WRONG_REV',
  })), GD.DENY_WRONG_GOVERNANCE_REVISION);
});

test('NEG-G11 wrong operation class DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    operationClass: 'DEPLOY',
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});

test('NEG-G12 one extra requested path DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    requestedPaths: [...CURRENT_AUTHORIZED_FILE_SCOPE, 'tecp/src/extra.js'],
  })), GD.DENY_PROTECTED_OR_EXTRA_PATH);
});

test('NEG-G13 unauthorized protected path DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: ['.cursor/rules/titangold-current-active-work.mdc'],
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});

test('NEG-G14 missing authorized path DENYs', () => {
  const full = [...CURRENT_AUTHORIZED_FILE_SCOPE];
  assert.ok(full.length >= 2);
  const subset = full.slice(0, -1);
  assert.ok(subset.length > 0 && subset.length < full.length);
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assert.equal(issued.ok, true);
  const encoded = issued.instruction.encoded;

  const empty = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: encoded,
    requestedPaths: [],
  }));
  assertDeny(empty, GD.DENY_PROTECTED_OR_EXTRA_PATH);
  assert.equal(
    (empty.reasons || []).includes('REQUESTED_PATHS_MUST_EQUAL_EFFECTIVE_AUTHORIZED_SET'),
    true,
  );

  const properSubset = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: encoded,
    requestedPaths: subset,
  }));
  assertDeny(properSubset, GD.DENY_PROTECTED_OR_EXTRA_PATH);
  assert.equal(
    (properSubset.reasons || []).includes('REQUESTED_PATHS_MUST_EQUAL_EFFECTIVE_AUTHORIZED_SET'),
    true,
  );

  const extra = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: encoded,
    requestedPaths: [...full, 'tecp/src/extra.js'],
  }));
  assertDeny(extra, GD.DENY_PROTECTED_OR_EXTRA_PATH);
  assert.equal(
    (extra.reasons || []).includes('REQUESTED_PATHS_MUST_EQUAL_EFFECTIVE_AUTHORIZED_SET'),
    true,
  );

  const protectedPath = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: encoded,
    requestedPaths: ['.cursor/rules/titangold-current-active-work.mdc'],
  }));
  assertDeny(protectedPath, GD.DENY_PROTECTED_OR_EXTRA_PATH);
  assert.equal(
    (protectedPath.reasons || []).includes('REQUESTED_PATHS_MUST_EQUAL_EFFECTIVE_AUTHORIZED_SET'),
    true,
  );
});

test('NEG-G15 DLP011 / live Tier-3 substitution rejected', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
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
  const issued = issueCurrentInstruction(harness);
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
  const issued = issueCurrentInstruction(harness, { ttlMs: 1_000, jti: 'expg17jti0001' });
  advanceTestHarnessClock(harness, 2_000);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_OWNER_INSTRUCTION);
});

test('NEG-G18 revoked JTI DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'revg18jti0001' });
  revokeTestHarnessJti(harness, 'revg18jti0001');
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_OWNER_INSTRUCTION);
});

test('NEG-G19 replayed JTI DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'repg19jti0001' });
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
  const issued = issueCurrentInstruction(harness, { jti: 'drift20jti001' });
  // Drift tip after instruction issuance, before evaluate — should DENY at tip check.
  driftTestHarnessTip(harness, { tipSha: '1'.repeat(40) });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_TIP_DRIFT);
});

test('NEG-G21 fence detects tip change after ALLOW', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'fence21jti001' });
  const result = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(result.ok, true);
  driftTestHarnessTip(harness, { tipSha: '2'.repeat(40) });
  assertDeny(assertS2MutationFenceFresh(result.authorization.fence, harness.harness), GD.DENY_TIP_DRIFT);
});

test('NEG-G22 concurrent evaluation lock DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'lock22jti0001' });
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
  const issued = issueCurrentInstruction(harness, { jti: 'forge24jti001' });
  // Digest binding in input still expects real digest → wrong digest, or forged structure.
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  })), GD.DENY_WRONG_RULE02_BLOB_OR_DIGEST);
});

test('NEG-G25 TEST_ONLY harness ALLOW cannot pass authentic mutation boundary', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'authbound25jti' });
  const result = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.authorization.testOnly, true);
  assert.equal(result.authenticMutationAuthority, false);
  assert.equal(isAuthenticS2OfflineMutationAuthorization(result), false);
  assertDeny(
    consumeAuthenticS2OfflineImplementationAuthorization(result),
    GD.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION,
  );
});

test('NEG-G26 validatorAllowed flag rejected', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    validatorAllowed: true,
  })), GD.DENY_FAKE_MERGED_FLAG);
});


test('SEC-B02 forged plain ALLOW object cannot authorize mutation', () => {
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization({
    ok: true,
    decision: GD.ALLOW,
    authenticMutationAuthority: true,
    authorization: { testOnly: false, authenticMutationAuthority: true },
  }), GD.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT);
});

test('SEC-B03 public test-harness abuse yields only non-authentic ALLOW', () => {
  const harness = createTestOnlyS2EffectiveAuthHarness({
    canonicalSha: CANONICAL_SHA,
    rule02Text: RULE02_TEXT,
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: MERGE_PARENT_1,
    mergeParent2: MERGE_PARENT_2,
    mergedProvenanceVerified: true,
  });
  assert.equal(harness.testOnly, true);
  assert.equal(harness.authenticMutationAuthority, false);
  const issued = issueCurrentInstruction(harness, { jti: 'abuseharness01' });
  const allow = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(allow.ok, true);
  assertDeny(
    consumeAuthenticS2OfflineImplementationAuthorization(allow),
    GD.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION,
  );
});

test('SEC-B04 no exported harness token / privileged latch on gate module', async () => {
  const mod = await import('../src/s2EffectiveImplementationAuthorizationGate.js');
  assert.equal('S2_TEST_ONLY_GATE_HARNESS_TOKEN' in mod, false);
  const instr = await import('../src/s2OwnerImplementationInstruction.js');
  assert.equal('withPrivilegedS2InstructionConstruction' in instr, false);
  assert.equal('getPrivilegedS2InstructionConstructors' in instr, false);
});

test('SEC-B05 missing Owner enrollment cannot produce authentic mutation brand', () => {
  const denyProd = evaluateS2EffectiveImplementationAuthorization({
    repositoryId: S2_GATE_REPOSITORY_ID,
    sliceId: S2_GATE_SLICE_ID,
    operationClass: S2_GATE_OPERATION_CLASS,
    governanceRevision: CURRENT_GOVERNANCE_REVISION,
    authorizedFileScope: [...CURRENT_AUTHORIZED_FILE_SCOPE],
    expectedCanonicalSha: CANONICAL_SHA,
    expectedRule02DigestSha256: RULE02_DIGEST,
    expectedRule02GitBlob: RULE02_BLOB,
    expectedMergeParent1: MERGE_PARENT_1,
    expectedMergeParent2: MERGE_PARENT_2,
    ownerInstructionEncoded: 'a.b',
  });
  assert.equal(denyProd.ok, false);
  assert.equal(isAuthenticS2OfflineMutationAuthorization(denyProd), false);
  assertDeny(
    consumeAuthenticS2OfflineImplementationAuthorization(denyProd),
    GD.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION,
  );
});



test('SEC-X01 public exports must not include authentic mint or freshness override hooks', async () => {
  const gate = await import('../src/s2EffectiveImplementationAuthorizationGate.js');
  const instr = await import('../src/s2OwnerImplementationInstruction.js');
  assert.equal('__testOnlyS2AuthConsumptionHooks' in gate, false);
  assert.equal('mintAuthenticEvaluateResultForConsumptionQa' in gate, false);
  assert.equal('installFreshnessProbe' in gate, false);
  assert.equal('withPrivilegedS2InstructionConstruction' in instr, false);
  assert.equal('getPrivilegedS2InstructionConstructors' in instr, false);
  assert.equal('createTestOnlyS2ImplTrustDeps' in instr, false);
  assert.equal('S2_TEST_ONLY_GATE_HARNESS_TOKEN' in gate, false);
});

test('SEC-X02 TEST_ONLY factories cannot mint authentic authorization brand', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'secx02jti0001' });
  const allow = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(allow.ok, true);
  assert.equal(allow.authenticMutationAuthority, false);
  assert.equal(isAuthenticS2OfflineMutationAuthorization(allow), false);
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization(allow), GD.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION);
});

test('SEC-X03 forged authentic-looking objects cannot consume', () => {
  const forged = {
    ok: true,
    decision: GD.ALLOW,
    authenticMutationAuthority: true,
    operational: false,
    authorization: {
      authenticMutationAuthority: true,
      testOnly: false,
      canonicalSha: CANONICAL_SHA,
      rule02DigestSha256: RULE02_DIGEST,
      rule02GitBlob: RULE02_BLOB,
      mergeParent1: MERGE_PARENT_1,
      mergeParent2: MERGE_PARENT_2,
      fence: {
        tipSha: CANONICAL_SHA,
        tipDigest: RULE02_DIGEST,
        authenticMutationAuthority: true,
      },
    },
  };
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization(forged), GD.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT);
});

test('SEC-X04 authentic consumer DENYs without Owner trust / authentic brand (NOT_TESTED_REAL_OWNER_PATH positive)', () => {
  // Positive authentic consume ALLOW requires real Owner enrollment + pinned HEAD; not manufactured here.
  const denyProd = evaluateS2EffectiveImplementationAuthorization({
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
  assert.equal(denyProd.ok, false);
  assert.equal(isAuthenticS2OfflineMutationAuthorization(denyProd), false);
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization(denyProd), GD.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION);
});

test('SEC-X05 caller cannot inject trustDeps/keyRegistry/freshness/repo overrides into evaluate', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'secx05jti0001' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    trustDeps: { wallClock: true },
    keyRegistry: {},
    publicKeyPem: 'x',
    gitProvenance: { ok: true },
  })), GD.DENY_CALLER_SUPPLIED_TRUST);
});

test('SEC-X06 inspectTrustedGitMergeProvenance is inspection-only and does not mint authentic brand', () => {
  const inspected = inspectTrustedGitMergeProvenance(REPO_ROOT, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: CANONICAL_SHA,
    rule02RelativePath: '.cursor/rules/titangold-current-active-work.mdc',
    rule02GitBlob: RULE02_BLOB,
    rule02DigestSha256: RULE02_DIGEST,
    mergeParent1: MERGE_PARENT_1,
    mergeParent2: MERGE_PARENT_2,
  });
  // On feature-branch worktree this may be ok via ancestor check; either way no authentic brand exists.
  assert.equal(typeof inspected.ok, 'boolean');
  assert.equal(isAuthenticS2OfflineMutationAuthorization(inspected), false);
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization(inspected), GD.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT);
});

test('SEC-X07 DLP011 / live Tier-3 / worker capability substitution still DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'secx07jti0001' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    dlp011Instruction: { kind: 'TECP_DLP011_OWNER_IMPLEMENTATION_INSTRUCTION' },
  })), GD.DENY_DLP011_OR_LIVE_SUBSTITUTION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    liveTier3Capability: { kind: 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1' },
  })), GD.DENY_DLP011_OR_LIVE_SUBSTITUTION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    workerCapability: { kind: 'WORKER' },
  })), GD.DENY_DLP011_OR_LIVE_SUBSTITUTION);
});

test('SEC-X08 extra path / wrong scope / unmerged provenance still DENY', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'secx08jti0001' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    requestedPaths: [...CURRENT_AUTHORIZED_FILE_SCOPE, 'tecp/src/extra.js'],
  })), GD.DENY_PROTECTED_OR_EXTRA_PATH);
  const unmerged = makeHarness({ mergedProvenanceVerified: false });
  const issued2 = issueS2OwnerInstructionFromTestHarness(unmerged, { jti: 'secx08jti0002' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(unmerged, {
    ownerInstructionEncoded: issued2.instruction.encoded,
  })), GD.DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY);
});

test('SEC-X09 tip drift fence DENYs when explicitly checked; TEST_ONLY allow remains non-authentic', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'secx09jti0001' });
  const allow = evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
  }));
  assert.equal(allow.ok, true);
  driftTestHarnessTip(harness, { tipSha: '9'.repeat(40) });
  assertDeny(assertS2MutationFenceFresh(allow.authorization.fence, harness.harness), GD.DENY_TIP_DRIFT);
  assert.equal(isAuthenticS2OfflineMutationAuthorization(allow), false);
});

test('SEC-X10 public export adversarial: every gate export is enumerable and dangerous mint hooks absent', async () => {
  const gate = await import('../src/s2EffectiveImplementationAuthorizationGate.js');
  const names = Object.keys(gate).sort();
  assert.equal(names.includes('__testOnlyS2AuthConsumptionHooks'), false);
  assert.equal(names.includes('consumeAuthenticS2OfflineImplementationAuthorization'), true);
  assert.equal(names.includes('evaluateS2EffectiveImplementationAuthorization'), true);
  // Lock hooks may exist for concurrency tests but must not mint authentic brand.
  if ('__testOnlyS2EvaluationLockHooks' in gate) {
    assert.equal(typeof gate.__testOnlyS2EvaluationLockHooks.hold, 'function');
    assert.equal('mintAuthenticEvaluateResultForConsumptionQa' in gate.__testOnlyS2EvaluationLockHooks, false);
  }
});

test('SEC-X11 consumed-looking forged output cannot authorize mutation', () => {
  assertDeny(consumeAuthenticS2OfflineImplementationAuthorization({
    ok: true,
    decision: GD.ALLOW,
    authorizationConsumed: true,
    authenticMutationAuthority: false,
    authorization: { authenticMutationAuthority: true, testOnly: false },
  }), GD.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT);
});

test('SEC-X12 NOT_TESTED_REAL_OWNER_PATH note: authentic one-shot/freshness positive ALLOW requires Owner enrollment', () => {
  // This test documents intentional non-coverage without manufacturing Owner trust.
  assert.equal(true, true);
});


test('SEC-PKG1-01 caller scope/revision that disagrees with Rule02 facts DENYs', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'pkg1scope01jti01' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: [...CURRENT_AUTHORIZED_FILE_SCOPE, 'tecp/src/extra.js'],
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    governanceRevision: 'NOT_THE_ACTIVE_GOVERNANCE_REVISION',
  })), GD.DENY_WRONG_GOVERNANCE_REVISION);
});

test('SEC-PKG1-02 former four-path Adapter scope is rejected under current two-path Rule02', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'pkg1initdb01jti1' });
  // Current governance authorizes initdb two-path only; historical Adapter four-path must DENY.
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    requestedPaths: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    governanceRevision: HISTORICAL_EFF_AUTH_GOVERNANCE_REVISION,
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
  // Protected Gate/Adapter paths remain outside the current authorized set.
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: [
      'tecp/src/s2EffectiveImplementationAuthorizationGate.js',
      'tecp/test/s2EffectiveImplementationAuthorizationGate.test.js',
    ],
    requestedPaths: [
      'tecp/src/s2EffectiveImplementationAuthorizationGate.js',
      'tecp/test/s2EffectiveImplementationAuthorizationGate.test.js',
    ],
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});


test('SEC-DEBT-01 stale four-path instruction scope cannot ALLOW under current Rule02', () => {
  const harness = makeHarness();
  const issued = issueS2OwnerInstructionFromTestHarness(harness, {
    jti: 'debt01stale4path01',
    authorizedFileScope: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    governanceRevision: HISTORICAL_EFF_AUTH_GOVERNANCE_REVISION,
  });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    authorizedFileScope: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    requestedPaths: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
    governanceRevision: HISTORICAL_EFF_AUTH_GOVERNANCE_REVISION,
  })), GD.DENY_WRONG_SCOPE_OR_OPERATION);
});

test('SEC-DEBT-02 stale governance revision with matching current scope DENYs revision', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'debt02stalerev001' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    governanceRevision: HISTORICAL_EFF_AUTH_GOVERNANCE_REVISION,
  })), GD.DENY_WRONG_GOVERNANCE_REVISION);
});

test('SEC-DEBT-03 caller cannot inject alternate Rule02 scope via requestedPaths alone', () => {
  const harness = makeHarness();
  const issued = issueCurrentInstruction(harness, { jti: 'debt03injectscope1' });
  assertDeny(evaluateS2EffectiveImplementationAuthorization(baseInput(harness, {
    ownerInstructionEncoded: issued.instruction.encoded,
    requestedPaths: [...HISTORICAL_FOUR_PATH_ADAPTER_SCOPE],
  })), GD.DENY_PROTECTED_OR_EXTRA_PATH);
});

