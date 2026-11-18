/**
 * TECP-OPS S2 Effective Implementation Authorization Gate (OFFLINE_IMPLEMENTATION).
 *
 * Fail-closed integration of Rule02 parse/validate, independent Git merge provenance,
 * and S2 Owner Implementation Instruction verification.
 *
 * Not an operational authority. Without Owner-installed verify-only trust enrollment,
 * evaluation DENYs. Caller-supplied merged flags, SHAs, paths, validatorAllow, or
 * trust objects never independently establish authority.
 * DLP011 and live Tier-3 capabilities are not accepted as implementation authority.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join as pathJoin, resolve as pathResolve } from 'node:path';
import { execFileSync } from 'node:child_process';

import { parseRule02 } from './rule02Parser.js';
import { OPERATION_CLASSES, validateGovernance } from './governanceValidator.js';
import {
  S2_OWNER_INSTRUCTION_PURPOSE,
  S2_IMPL_TRUST_REGISTRY_RELATIVE_DIR,
  createOwnerInstalledS2ImplTrustDeps,
  createS2OfflineTestOnlyInstructionFixtures,
  isBrandedVerifiedS2OwnerInstruction,
  isOwnerInstalledS2ImplTrustDeps,
  isTestOnlyS2ImplTrustDeps,
  issueS2OwnerImplementationInstruction,
  safeEqualHex,
  sha256Hex,
} from './s2OwnerImplementationInstruction.js';

export const S2_GATE_KIND = 'TECP_OPS_S2_EFFECTIVE_IMPLEMENTATION_AUTHORIZATION_GATE_V1';
export const S2_GATE_PURPOSE = 'OFFLINE_IMPLEMENTATION';
export const S2_GATE_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const S2_GATE_SLICE_ID = 'TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR';
export const S2_GATE_OPERATION_CLASS = OPERATION_CLASSES.IMPLEMENT;
export const S2_GATE_GOVERNANCE_REVISION = 'OPS_PILOT_001_S2_EFF_AUTH_ARCHITECTURE_GOVERNANCE_20261118';
export const S2_GATE_AUTHORIZED_FILE_SCOPE = Object.freeze([
  'tecp/src/s2OwnerImplementationInstruction.js',
  'tecp/src/s2EffectiveImplementationAuthorizationGate.js',
  'tecp/test/s2OwnerImplementationInstruction.test.js',
  'tecp/test/s2EffectiveImplementationAuthorizationGate.test.js',
]);
export const S2_GATE_RULE02_RELATIVE_PATH = '.cursor/rules/titangold-current-active-work.mdc';
export const S2_IMPL_TRUST_REPO_PATH_FILENAME = 'trusted-repo-path.txt';

export const S2_GATE_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_INPUT: 'DENY_MISSING_INPUT',
  DENY_OWNER_TRUST_MISSING: 'DENY_OWNER_TRUST_MISSING',
  DENY_CALLER_SUPPLIED_TRUST: 'DENY_CALLER_SUPPLIED_TRUST',
  DENY_UNTRUSTED_REPOSITORY_BOUNDARY: 'DENY_UNTRUSTED_REPOSITORY_BOUNDARY',
  DENY_GIT_PROVENANCE_UNAVAILABLE: 'DENY_GIT_PROVENANCE_UNAVAILABLE',
  DENY_GIT_PROVENANCE_MISMATCH: 'DENY_GIT_PROVENANCE_MISMATCH',
  DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY: 'DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY',
  DENY_FAKE_MERGED_FLAG: 'DENY_FAKE_MERGED_FLAG',
  DENY_WRONG_REPOSITORY_OR_SLICE: 'DENY_WRONG_REPOSITORY_OR_SLICE',
  DENY_WRONG_CANONICAL_SHA: 'DENY_WRONG_CANONICAL_SHA',
  DENY_WRONG_RULE02_BLOB_OR_DIGEST: 'DENY_WRONG_RULE02_BLOB_OR_DIGEST',
  DENY_WRONG_GOVERNANCE_REVISION: 'DENY_WRONG_GOVERNANCE_REVISION',
  DENY_WRONG_SCOPE_OR_OPERATION: 'DENY_WRONG_SCOPE_OR_OPERATION',
  DENY_PROTECTED_OR_EXTRA_PATH: 'DENY_PROTECTED_OR_EXTRA_PATH',
  DENY_VALIDATOR_NOT_ALLOW: 'DENY_VALIDATOR_NOT_ALLOW',
  DENY_FORGED_RULE02: 'DENY_FORGED_RULE02',
  DENY_OWNER_INSTRUCTION: 'DENY_OWNER_INSTRUCTION',
  DENY_MISSING_OWNER_INSTRUCTION: 'DENY_MISSING_OWNER_INSTRUCTION',
  DENY_PRODUCTION_MUTATION: 'DENY_PRODUCTION_MUTATION',
  DENY_DEPLOYMENT: 'DENY_DEPLOYMENT',
  DENY_LIVE_SQL: 'DENY_LIVE_SQL',
  DENY_OPERATIONAL_DISPATCH: 'DENY_OPERATIONAL_DISPATCH',
  DENY_WORKER_OR_MCP_MUTATION: 'DENY_WORKER_OR_MCP_MUTATION',
  DENY_CAPABILITY_ISSUANCE: 'DENY_CAPABILITY_ISSUANCE',
  DENY_TIP_DRIFT: 'DENY_TIP_DRIFT',
  DENY_CONFLICTING_AUTHORIZATION: 'DENY_CONFLICTING_AUTHORIZATION',
  DENY_NON_ATOMIC_REPLAY: 'DENY_NON_ATOMIC_REPLAY',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_DLP011_OR_LIVE_SUBSTITUTION: 'DENY_DLP011_OR_LIVE_SUBSTITUTION',
  DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION: 'DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION',
  DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT: 'DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT',
  DENY_AUTHORIZATION_ALREADY_SPENT: 'DENY_AUTHORIZATION_ALREADY_SPENT',
  DENY_MISSING_EVALUATION_FENCE: 'DENY_MISSING_EVALUATION_FENCE',
  DENY_GIT_FRESHNESS: 'DENY_GIT_FRESHNESS',
  DENY_WORKTREE_RULE02_DRIFT: 'DENY_WORKTREE_RULE02_DRIFT',
  DENY_FAIL_CLOSED: 'DENY_FAIL_CLOSED',
});

const trustRootPrivate = new WeakMap();
const gateDecisionBrand = new WeakSet();
const evaluationFenceBrand = new WeakSet();
const harnessBrand = new WeakSet();
/** Only Owner-installed evaluation success is added here. TEST_ONLY ALLOW never is. */
const authenticOfflineMutationAuthorizationBrand = new WeakSet();
/** One-shot spend set: marked before freshness checks; never cleared. */
const spentAuthenticAuthorizationObjects = new WeakSet();
let evaluationLock = null;
/** Offline QA freshness probe only; never accepts caller-supplied trust on the public API. */
let authConsumptionFreshnessProbe = null;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }
function digestText(text) { return createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function scopesMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i += 1) if (sa[i] !== sb[i]) return false;
  return true;
}
function deny(decision, reasons = [decision], extras = {}) {
  const result = Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...(reasons || [decision])]),
    authorization: null,
    standingAuthority: false,
    operational: false,
    purpose: S2_GATE_PURPOSE,
    fullS2EffectiveAuthorization: false,
    performsDatabaseWrite: false,
    executesWorker: false,
    ...extras,
  });
  gateDecisionBrand.add(result);
  return result;
}
function sanitizeReasons(reasons) {
  return (reasons || []).map((r) => {
    const s = String(r);
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(s) || /privateKeyPem/i.test(s)) return 'REDACTED_SENSITIVE';
    if (s.length > 512) return `${s.slice(0, 512)}…`;
    return s;
  });
}

function gitCapture(repoPath, args, options = {}) {
  try {
    const out = execFileSync('git', ['-C', repoPath, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
      windowsHide: true,
    });
    const text = String(out);
    return { ok: true, text: options.exactBytes === true ? text : text.trim() };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function resolveOwnerTrustedRepoPath() {
  const pathFile = pathJoin(homedir(), S2_IMPL_TRUST_REGISTRY_RELATIVE_DIR, S2_IMPL_TRUST_REPO_PATH_FILENAME);
  if (!existsSync(pathFile)) return null;
  const raw = readFileSync(pathFile, 'utf8').trim();
  if (!isNonEmptyString(raw)) return null;
  try {
    return realpathSync(pathResolve(raw));
  } catch {
    return null;
  }
}

/**
 * Independent Git merge provenance from a trusted repository boundary.
 * Caller-supplied merged=true / fake PR objects are ignored/rejected elsewhere.
 */
export function inspectTrustedGitMergeProvenance(repoPath, expected) {
  if (!isNonEmptyString(repoPath)) {
    return Object.freeze({ ok: false, reason: 'REPO_PATH_REQUIRED' });
  }
  if (!isPlainObject(expected) || !isNonEmptyString(expected.canonicalSha)
    || !isNonEmptyString(expected.rule02RelativePath)
    || !isNonEmptyString(expected.rule02GitBlob)
    || !isNonEmptyString(expected.rule02DigestSha256)
    || !isNonEmptyString(expected.mergeParent1)
    || !isNonEmptyString(expected.mergeParent2)
    || !isNonEmptyString(expected.repositoryId)) {
    return Object.freeze({ ok: false, reason: 'EXPECTED_PROVENANCE_BINDINGS_REQUIRED' });
  }
  if (expected.repositoryId !== S2_GATE_REPOSITORY_ID) {
    return Object.freeze({ ok: false, reason: 'WRONG_REPOSITORY_ID' });
  }
  let resolved;
  try { resolved = realpathSync(pathResolve(repoPath)); }
  catch { return Object.freeze({ ok: false, reason: 'REPO_UNRESOLVABLE' }); }

  const remote = gitCapture(resolved, ['remote', 'get-url', 'origin']);
  if (!remote.ok) return Object.freeze({ ok: false, reason: 'ORIGIN_UNAVAILABLE', detail: remote.error });
  const remoteNorm = remote.text.replace(/\.git$/i, '').replace(/\\/g, '/').toLowerCase();
  if (!remoteNorm.endsWith('sepehrraeisi/titangold') && !remoteNorm.includes('github.com/sepehrraeisi/titangold')) {
    return Object.freeze({ ok: false, reason: 'ORIGIN_IDENTITY_MISMATCH', detail: remote.text });
  }

  const tip = gitCapture(resolved, ['rev-parse', 'origin/main']);
  if (!tip.ok || tip.text !== expected.canonicalSha) {
    return Object.freeze({ ok: false, reason: 'ORIGIN_MAIN_MISMATCH', detail: tip.text || tip.error });
  }
  // Worktree may be on an implementation branch; require canonical tip to be an ancestor of HEAD.
  const head = gitCapture(resolved, ['rev-parse', 'HEAD']);
  if (!head.ok) {
    return Object.freeze({ ok: false, reason: 'HEAD_UNAVAILABLE', detail: head.error });
  }
  if (head.text !== expected.canonicalSha) {
    const ancestor = gitCapture(resolved, ['merge-base', '--is-ancestor', expected.canonicalSha, 'HEAD']);
    if (!ancestor.ok) {
      return Object.freeze({
        ok: false,
        reason: 'CANONICAL_SHA_NOT_ANCESTOR_OF_HEAD',
        detail: `${head.text}|${ancestor.error || ''}`.trim(),
      });
    }
  }
  const parents = gitCapture(resolved, ['rev-list', '--parents', '-n', '1', expected.canonicalSha]);
  if (!parents.ok) return Object.freeze({ ok: false, reason: 'PARENTS_UNAVAILABLE', detail: parents.error });
  const parts = parents.text.split(/\s+/).filter(Boolean);
  if (parts.length !== 3 || parts[0] !== expected.canonicalSha
    || parts[1] !== expected.mergeParent1 || parts[2] !== expected.mergeParent2) {
    return Object.freeze({
      ok: false,
      reason: 'MERGE_PARENTS_MISMATCH',
      detail: parents.text,
    });
  }
  const isMerge = gitCapture(resolved, ['cat-file', '-p', expected.canonicalSha]);
  if (!isMerge.ok || !/^parent /m.test(isMerge.text) || (isMerge.text.match(/^parent /gm) || []).length < 2) {
    return Object.freeze({ ok: false, reason: 'NOT_MERGE_COMMIT' });
  }
  const blob = gitCapture(resolved, ['rev-parse', `${expected.canonicalSha}:${expected.rule02RelativePath}`]);
  if (!blob.ok || blob.text !== expected.rule02GitBlob) {
    return Object.freeze({ ok: false, reason: 'RULE02_BLOB_MISMATCH', detail: blob.text || blob.error });
  }
  const blobRaw = gitCapture(resolved, ['cat-file', 'blob', expected.rule02GitBlob], { exactBytes: true });
  if (!blobRaw.ok) return Object.freeze({ ok: false, reason: 'RULE02_BLOB_UNREADABLE', detail: blobRaw.error });
  const digest = digestText(blobRaw.text);
  if (!safeEqualHex(digest, expected.rule02DigestSha256)) {
    return Object.freeze({ ok: false, reason: 'RULE02_DIGEST_MISMATCH', detail: digest });
  }
  return Object.freeze({
    ok: true,
    repositoryId: S2_GATE_REPOSITORY_ID,
    repoPath: resolved,
    canonicalSha: expected.canonicalSha,
    mergeParent1: expected.mergeParent1,
    mergeParent2: expected.mergeParent2,
    rule02GitBlob: expected.rule02GitBlob,
    rule02DigestSha256: digest,
    rule02Text: blobRaw.text,
    tipSha: tip.text,
    inspectedAtMs: Date.now(),
  });
}

/**
 * TEST_ONLY offline harness. Not Owner enrollment. Not authentic mutation authority.
 * Callable by same-process importers; results cannot pass consumeAuthenticS2OfflineImplementationAuthorization.
 */
export function createTestOnlyS2EffectiveAuthHarness(config = {}) {
  if (!isPlainObject(config)) {
    throw new TypeError('TEST_HARNESS_CONFIG_REQUIRED');
  }
  for (const key of ['keyRegistry', 'ownerInstructionVerifier', 'publicKeyPem', 'privateKeyPem', 'validatorAllowed', 'merged']) {
    if (config[key] != null) throw new TypeError(`CALLER_SUPPLIED_TRUST_FORBIDDEN:${key}`);
  }
  if (!isNonEmptyString(config.canonicalSha) || !isNonEmptyString(config.rule02Text)
    || !isNonEmptyString(config.rule02GitBlob) || !isNonEmptyString(config.rule02DigestSha256)
    || !isNonEmptyString(config.mergeParent1) || !isNonEmptyString(config.mergeParent2)) {
    throw new TypeError('TEST_HARNESS_PROVENANCE_REQUIRED');
  }

  {
    const trustDeps = createS2OfflineTestOnlyInstructionFixtures({
      startMs: Number.isSafeInteger(config.startMs) ? config.startMs : 1_700_000_000_000,
      consumeOnAllow: config.consumeOnAllow !== false,
      unavailableClock: config.unavailableClock === true,
      ownerStyleWallClock: config.ownerStyleWallClock === true,
      kid: config.kid,
      issuer: config.issuer,
      keyPair: config.keyPair,
    });
    const mutable = {
      provenance: Object.freeze({
        repositoryId: S2_GATE_REPOSITORY_ID,
        canonicalSha: config.canonicalSha,
        rule02Text: config.rule02Text,
        rule02GitBlob: config.rule02GitBlob,
        rule02DigestSha256: config.rule02DigestSha256,
        mergeParent1: config.mergeParent1,
        mergeParent2: config.mergeParent2,
        tipSha: config.tipSha || config.canonicalSha,
        tipDigest: config.tipDigest || config.rule02DigestSha256,
        mergedProvenanceVerified: config.mergedProvenanceVerified === true,
        sourceKind: config.useLiveGit === true ? 'TRUSTED_GIT_OBJECTS' : 'TEST_ONLY_ATTESTED_GIT_FACTS',
        repoPath: isNonEmptyString(config.repoPath) ? config.repoPath : null,
        testOnly: true,
      }),
    };
    const root = Object.freeze({
      kind: 'TECP_OPS_S2_TEST_ONLY_EFF_AUTH_HARNESS',
      testOnly: true,
      productionTrustEstablished: false,
      fullS2EffectiveAuthorization: false,
    });
    trustRootPrivate.set(root, {
      trustDeps,
      getProvenance() { return mutable.provenance; },
      setProvenance(next) { mutable.provenance = next; },
    });
    harnessBrand.add(root);
    return Object.freeze({
      harness: root,
      trustDeps,
      testOnly: true,
      operational: false,
      fullS2EffectiveAuthorization: false,
      authenticMutationAuthority: false,
    });
  }
}

export function isTestOnlyS2EffectiveAuthHarness(value) { return harnessBrand.has(value); }
export function isBrandedS2GateDecision(value) { return gateDecisionBrand.has(value); }
export function isBrandedS2EvaluationFence(value) { return evaluationFenceBrand.has(value); }

export function issueS2OwnerInstructionFromTestHarness(harnessBundle, overrides = {}) {
  if (!isPlainObject(harnessBundle) || !isTestOnlyS2EffectiveAuthHarness(harnessBundle.harness)) {
    throw new TypeError('TEST_HARNESS_REQUIRED');
  }
  const priv = trustRootPrivate.get(harnessBundle.harness);
  const provenance = priv.getProvenance();
  const deps = priv.trustDeps;
  return issueS2OwnerImplementationInstruction({
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: overrides.canonicalSha || provenance.canonicalSha,
    rule02DigestSha256: overrides.rule02DigestSha256 || provenance.rule02DigestSha256,
    sliceId: overrides.sliceId || S2_GATE_SLICE_ID,
    authorizedFileScope: overrides.authorizedFileScope || [...S2_GATE_AUTHORIZED_FILE_SCOPE],
    operationClass: overrides.operationClass || S2_GATE_OPERATION_CLASS,
    governanceRevision: overrides.governanceRevision || S2_GATE_GOVERNANCE_REVISION,
    purpose: S2_OWNER_INSTRUCTION_PURPOSE,
    issuer: deps.issuer,
    kid: deps.installedKid,
    ttlMs: Number.isSafeInteger(overrides.ttlMs) ? overrides.ttlMs : 60_000,
    jti: overrides.jti,
    nbf: overrides.nbf,
  }, { keyRegistry: deps.keyRegistry, clock: deps.clock });
}

export function driftTestHarnessTip(harnessBundle, { tipSha, tipDigest }) {
  if (!isPlainObject(harnessBundle) || !isTestOnlyS2EffectiveAuthHarness(harnessBundle.harness)) {
    throw new TypeError('TEST_HARNESS_REQUIRED');
  }
  const priv = trustRootPrivate.get(harnessBundle.harness);
  const current = priv.getProvenance();
  priv.setProvenance(Object.freeze({
    ...current,
    tipSha: isNonEmptyString(tipSha) ? tipSha : current.tipSha,
    tipDigest: isNonEmptyString(tipDigest) ? tipDigest : current.tipDigest,
  }));
}

export function replaceTestHarnessProvenance(harnessBundle, nextFields) {
  if (!isPlainObject(harnessBundle) || !isTestOnlyS2EffectiveAuthHarness(harnessBundle.harness)) {
    throw new TypeError('TEST_HARNESS_REQUIRED');
  }
  if (!isPlainObject(nextFields)) throw new TypeError('PROVENANCE_FIELDS_REQUIRED');
  const priv = trustRootPrivate.get(harnessBundle.harness);
  const current = priv.getProvenance();
  const rule02Text = isNonEmptyString(nextFields.rule02Text) ? nextFields.rule02Text : current.rule02Text;
  const digest = digestText(rule02Text);
  priv.setProvenance(Object.freeze({
    ...current,
    ...nextFields,
    rule02Text,
    rule02DigestSha256: isNonEmptyString(nextFields.rule02DigestSha256)
      ? nextFields.rule02DigestSha256
      : digest,
    tipDigest: isNonEmptyString(nextFields.tipDigest)
      ? nextFields.tipDigest
      : (isNonEmptyString(nextFields.rule02DigestSha256) ? nextFields.rule02DigestSha256 : digest),
  }));
}

export function advanceTestHarnessClock(harnessBundle, ms) {
  if (!isPlainObject(harnessBundle) || !isTestOnlyS2EffectiveAuthHarness(harnessBundle.harness)) {
    throw new TypeError('TEST_HARNESS_REQUIRED');
  }
  trustRootPrivate.get(harnessBundle.harness).trustDeps.clock.advance(ms);
}

export function revokeTestHarnessJti(harnessBundle, jti) {
  if (!isPlainObject(harnessBundle) || !isTestOnlyS2EffectiveAuthHarness(harnessBundle.harness)) {
    throw new TypeError('TEST_HARNESS_REQUIRED');
  }
  trustRootPrivate.get(harnessBundle.harness).trustDeps.revocationRegistry.revokeJti(jti);
}

/**
 * Production-facing evaluation entry. Fail-closed without Owner-installed trust.
 * TEST_ONLY harness may be supplied explicitly as input.testOnlyHarness (offline tests).
 */
export function evaluateS2EffectiveImplementationAuthorization(input) {
  const lockToken = Object.create(null);
  if (evaluationLock !== null) {
    return deny(S2_GATE_DECISIONS.DENY_CONFLICTING_AUTHORIZATION, ['CONCURRENT_EVALUATION_IN_PROGRESS']);
  }
  evaluationLock = lockToken;
  try {
    return evaluateUnlocked(input);
  } finally {
    if (evaluationLock === lockToken) evaluationLock = null;
  }
}

function evaluateUnlocked(input) {
  if (!isPlainObject(input)) return deny(S2_GATE_DECISIONS.DENY_MISSING_INPUT, ['INPUT_REQUIRED']);

  for (const key of ['merged', 'canonical', 'branchName', 'validatorAllowed', 'prMerged', 'mergedProvenance']) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return deny(S2_GATE_DECISIONS.DENY_FAKE_MERGED_FLAG, [`CALLER_FLAG_REJECTED:${key}`]);
    }
  }
  for (const key of [
    'keyRegistry', 'revocationRegistry', 'clock', 'ownerInstructionVerifier', 'publicKeyPem', 'privateKeyPem',
    'verificationKey', 'trustDeps', 'canonicalRule02Source', 'gitProvenance', 'fakePr',
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] != null) {
      return deny(S2_GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, [`FORBIDDEN_TRUST_KEY:${key}`]);
    }
  }
  if (input.dlp011Instruction != null || input.liveTier3Capability != null || input.workerCapability != null) {
    return deny(S2_GATE_DECISIONS.DENY_DLP011_OR_LIVE_SUBSTITUTION, ['FOREIGN_AUTHORITY_REJECTED']);
  }
  if (input.requiresProductionMutation === true || input.productionMutation === true) {
    return deny(S2_GATE_DECISIONS.DENY_PRODUCTION_MUTATION);
  }
  if (input.requiresDeploy === true || input.deployment === true) {
    return deny(S2_GATE_DECISIONS.DENY_DEPLOYMENT);
  }
  if (input.liveSql === true || input.executeSql === true || input.postgres === true) {
    return deny(S2_GATE_DECISIONS.DENY_LIVE_SQL);
  }
  if (input.operationalDispatcher === true || input.operationalDispatch === true) {
    return deny(S2_GATE_DECISIONS.DENY_OPERATIONAL_DISPATCH);
  }
  if (input.workerMutation === true || input.mcpMutation === true) {
    return deny(S2_GATE_DECISIONS.DENY_WORKER_OR_MCP_MUTATION);
  }
  if (input.capabilityIssuance === true || input.issueCapability === true) {
    return deny(S2_GATE_DECISIONS.DENY_CAPABILITY_ISSUANCE);
  }

  let trustDeps = null;
  let provenance = null;
  let proofInspection = null;

  if (input.testOnlyHarness != null) {
    if (!isTestOnlyS2EffectiveAuthHarness(input.testOnlyHarness)) {
      return deny(S2_GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, ['UNBRANDED_TEST_HARNESS']);
    }
    const priv = trustRootPrivate.get(input.testOnlyHarness);
    trustDeps = priv.trustDeps;
    provenance = priv.getProvenance();
    if (!isTestOnlyS2ImplTrustDeps(trustDeps)) {
      return deny(S2_GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, ['TEST_TRUST_DEPS_UNBRANDED']);
    }
  } else {
    const installed = createOwnerInstalledS2ImplTrustDeps({});
    if (!isOwnerInstalledS2ImplTrustDeps(installed)) {
      const decision = installed && installed.decision
        ? installed.decision
        : S2_GATE_DECISIONS.DENY_OWNER_TRUST_MISSING;
      return deny(decision, sanitizeReasons((installed && installed.reasons) || ['OWNER_TRUST_MISSING']));
    }
    trustDeps = installed;
    const repoPath = resolveOwnerTrustedRepoPath();
    if (!isNonEmptyString(repoPath)) {
      return deny(S2_GATE_DECISIONS.DENY_UNTRUSTED_REPOSITORY_BOUNDARY, ['OWNER_TRUSTED_REPO_PATH_MISSING']);
    }
    if (!isNonEmptyString(input.expectedCanonicalSha)
      || !isNonEmptyString(input.expectedRule02GitBlob)
      || !isNonEmptyString(input.expectedRule02DigestSha256)
      || !isNonEmptyString(input.expectedMergeParent1)
      || !isNonEmptyString(input.expectedMergeParent2)) {
      return deny(S2_GATE_DECISIONS.DENY_MISSING_INPUT, ['CANONICAL_PROVENANCE_EXPECTATIONS_REQUIRED']);
    }
    proofInspection = inspectTrustedGitMergeProvenance(repoPath, {
      repositoryId: S2_GATE_REPOSITORY_ID,
      canonicalSha: input.expectedCanonicalSha,
      rule02RelativePath: S2_GATE_RULE02_RELATIVE_PATH,
      rule02GitBlob: input.expectedRule02GitBlob,
      rule02DigestSha256: input.expectedRule02DigestSha256,
      mergeParent1: input.expectedMergeParent1,
      mergeParent2: input.expectedMergeParent2,
    });
    if (!proofInspection.ok) {
      return deny(S2_GATE_DECISIONS.DENY_GIT_PROVENANCE_UNAVAILABLE, sanitizeReasons([
        proofInspection.reason, proofInspection.detail,
      ].filter(Boolean)));
    }
    provenance = Object.freeze({
      repositoryId: S2_GATE_REPOSITORY_ID,
      canonicalSha: proofInspection.canonicalSha,
      rule02Text: proofInspection.rule02Text,
      rule02GitBlob: proofInspection.rule02GitBlob,
      rule02DigestSha256: proofInspection.rule02DigestSha256,
      mergeParent1: proofInspection.mergeParent1,
      mergeParent2: proofInspection.mergeParent2,
      tipSha: proofInspection.tipSha,
      tipDigest: proofInspection.rule02DigestSha256,
      mergedProvenanceVerified: true,
      sourceKind: 'TRUSTED_GIT_OBJECTS',
      repoPath: proofInspection.repoPath,
      testOnly: false,
      inspectedAtMs: proofInspection.inspectedAtMs,
    });
  }

  if (!trustDeps || trustDeps.consumeOnAllow !== true) {
    return deny(S2_GATE_DECISIONS.DENY_NON_ATOMIC_REPLAY, ['CONSUME_ON_ALLOW_REQUIRED']);
  }
  if (trustDeps.revocationRegistry && trustDeps.revocationRegistry.atomicConsume !== true) {
    return deny(S2_GATE_DECISIONS.DENY_NON_ATOMIC_REPLAY, ['ATOMIC_CONSUME_REQUIRED']);
  }

  if (!isNonEmptyString(input.repositoryId) || !isNonEmptyString(input.sliceId)
    || !isNonEmptyString(input.operationClass) || !isNonEmptyString(input.governanceRevision)
    || !Array.isArray(input.authorizedFileScope) || !isNonEmptyString(input.expectedCanonicalSha)
    || !isNonEmptyString(input.expectedRule02DigestSha256)) {
    return deny(S2_GATE_DECISIONS.DENY_MISSING_INPUT, ['EXPECTED_BINDINGS_REQUIRED']);
  }
  if (input.repositoryId !== S2_GATE_REPOSITORY_ID || input.sliceId !== S2_GATE_SLICE_ID
    || provenance.repositoryId !== S2_GATE_REPOSITORY_ID) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE);
  }
  if (!scopesMatch(input.authorizedFileScope, S2_GATE_AUTHORIZED_FILE_SCOPE)
    || input.operationClass !== S2_GATE_OPERATION_CLASS) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_SCOPE_OR_OPERATION);
  }
  if (Array.isArray(input.requestedPaths)) {
    if (!scopesMatch(input.requestedPaths, S2_GATE_AUTHORIZED_FILE_SCOPE)) {
      return deny(S2_GATE_DECISIONS.DENY_PROTECTED_OR_EXTRA_PATH, ['REQUESTED_PATHS_MUST_EQUAL_AUTHORIZED_SET']);
    }
  }
  if (!safeEqualHex(provenance.tipSha, provenance.canonicalSha)
    || !safeEqualHex(provenance.tipDigest, provenance.rule02DigestSha256)) {
    return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['TIP_CHANGED_BEFORE_AUTHORIZATION']);
  }
  if (!safeEqualHex(provenance.canonicalSha, input.expectedCanonicalSha)) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_CANONICAL_SHA);
  }
  if (!safeEqualHex(provenance.rule02DigestSha256, input.expectedRule02DigestSha256)) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_RULE02_BLOB_OR_DIGEST, ['DIGEST_MISMATCH']);
  }
  if (isNonEmptyString(input.expectedRule02GitBlob)
    && provenance.rule02GitBlob !== input.expectedRule02GitBlob) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_RULE02_BLOB_OR_DIGEST, ['BLOB_MISMATCH']);
  }
  if (provenance.mergedProvenanceVerified !== true) {
    return deny(S2_GATE_DECISIONS.DENY_UNMERGED_OR_INCOMPLETE_ANCESTRY, [
      'MERGED_PROVENANCE_NOT_VERIFIED',
    ]);
  }

  let parsed;
  try { parsed = parseRule02(provenance.rule02Text); }
  catch (err) {
    return deny(S2_GATE_DECISIONS.DENY_FORGED_RULE02, sanitizeReasons([String(err && err.code || err.message || err)]));
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed.governanceFacts)) {
    return deny(S2_GATE_DECISIONS.DENY_FORGED_RULE02, ['RULE02_STRUCTURE_INVALID']);
  }
  const facts = parsed.governanceFacts;
  const parsedSliceId = parsed.authority?.activeWorkPackage?.sliceId;
  const tecpSliceId = parsed.tecp?.TECP_AUTHORIZED_SLICE;
  const parsedGovernanceRevision = parsed.authority?.governanceRevision;
  if (parsedSliceId !== S2_GATE_SLICE_ID || tecpSliceId !== S2_GATE_SLICE_ID) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE, [
      'PARSED_SLICE_MISMATCH', `PARSED_SLICE:${String(parsedSliceId)}`,
    ]);
  }
  if (!scopesMatch(facts.authorizedFileScope, S2_GATE_AUTHORIZED_FILE_SCOPE)) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_SCOPE_OR_OPERATION, ['PARSED_SCOPE_MISMATCH']);
  }
  if (!isNonEmptyString(parsedGovernanceRevision)
    || input.governanceRevision !== parsedGovernanceRevision
    || parsedGovernanceRevision !== S2_GATE_GOVERNANCE_REVISION) {
    return deny(S2_GATE_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION);
  }

  let validatorResult;
  try {
    validatorResult = validateGovernance(parsed, Object.freeze({
      sliceId: S2_GATE_SLICE_ID,
      authorityClass: facts.authorityClass,
      riskTier: facts.riskTier,
      requestedPaths: Object.freeze([...S2_GATE_AUTHORIZED_FILE_SCOPE]),
      operationClass: OPERATION_CLASSES.IMPLEMENT,
      requiresDeploy: false,
      requiresProductionMutation: false,
    }));
  } catch {
    return deny(S2_GATE_DECISIONS.DENY_FAIL_CLOSED, ['VALIDATOR_THREW']);
  }
  if (!validatorResult || validatorResult.allowed !== true) {
    return deny(S2_GATE_DECISIONS.DENY_VALIDATOR_NOT_ALLOW, sanitizeReasons([
      `VALIDATOR_${validatorResult && validatorResult.decision}`,
      ...((validatorResult && validatorResult.reasons) || []),
    ]));
  }

  if (!isNonEmptyString(input.ownerInstructionEncoded)) {
    return deny(S2_GATE_DECISIONS.DENY_MISSING_OWNER_INSTRUCTION);
  }

  const expectation = Object.freeze({
    repositoryId: S2_GATE_REPOSITORY_ID,
    sliceId: S2_GATE_SLICE_ID,
    canonicalSha: input.expectedCanonicalSha,
    rule02DigestSha256: input.expectedRule02DigestSha256,
    authorizedFileScope: S2_GATE_AUTHORIZED_FILE_SCOPE,
    operationClass: S2_GATE_OPERATION_CLASS,
    governanceRevision: parsedGovernanceRevision,
  });

  let instructionResult;
  try {
    instructionResult = trustDeps.verifier.verify(input.ownerInstructionEncoded, expectation);
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/REVOCATION|CLOCK|UNAVAILABLE/i.test(msg)) {
      return deny(S2_GATE_DECISIONS.DENY_REVOCATION_UNAVAILABLE, sanitizeReasons([msg]));
    }
    return deny(S2_GATE_DECISIONS.DENY_OWNER_INSTRUCTION, sanitizeReasons([msg]));
  }
  if (!instructionResult || instructionResult.ok !== true) {
    const d = String(instructionResult && instructionResult.decision || 'UNKNOWN');
    if (/REVOCATION|CLOCK|MISSING_DEPS/i.test(d)) {
      return deny(S2_GATE_DECISIONS.DENY_REVOCATION_UNAVAILABLE, sanitizeReasons((instructionResult && instructionResult.reasons) || [d]));
    }
    return deny(S2_GATE_DECISIONS.DENY_OWNER_INSTRUCTION, sanitizeReasons((instructionResult && instructionResult.reasons) || [d]));
  }
  if (!isBrandedVerifiedS2OwnerInstruction(instructionResult.instruction)) {
    return deny(S2_GATE_DECISIONS.DENY_OWNER_INSTRUCTION, ['VERIFIED_INSTRUCTION_NOT_BRANDED']);
  }

  const lateProvenance = input.testOnlyHarness != null
    ? trustRootPrivate.get(input.testOnlyHarness).getProvenance()
    : provenance;
  if (!safeEqualHex(lateProvenance.tipSha, provenance.canonicalSha)
    || !safeEqualHex(lateProvenance.tipDigest, provenance.rule02DigestSha256)
    || !safeEqualHex(lateProvenance.rule02DigestSha256, input.expectedRule02DigestSha256)) {
    return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['GIT_STATE_CHANGED_BETWEEN_PROOF_AND_AUTHORIZATION']);
  }
  if (proofInspection && isNonEmptyString(provenance.repoPath)) {
    const recheck = inspectTrustedGitMergeProvenance(provenance.repoPath, {
      repositoryId: S2_GATE_REPOSITORY_ID,
      canonicalSha: input.expectedCanonicalSha,
      rule02RelativePath: S2_GATE_RULE02_RELATIVE_PATH,
      rule02GitBlob: input.expectedRule02GitBlob,
      rule02DigestSha256: input.expectedRule02DigestSha256,
      mergeParent1: input.expectedMergeParent1,
      mergeParent2: input.expectedMergeParent2,
    });
    if (!recheck.ok || recheck.canonicalSha !== proofInspection.canonicalSha
      || !safeEqualHex(recheck.rule02DigestSha256, proofInspection.rule02DigestSha256)) {
      return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['GIT_STATE_CHANGED_BETWEEN_PROOF_AND_AUTHORIZATION']);
    }
  }

  const isAuthenticOwnerInstalledPath = input.testOnlyHarness == null
    && isOwnerInstalledS2ImplTrustDeps(trustDeps)
    && provenance.testOnly !== true
    && trustDeps.wallClock === true;

  const fence = Object.freeze({
    kind: 'TECP_OPS_S2_EVALUATION_FENCE',
    evaluationId: digestText(`${provenance.canonicalSha}|${provenance.rule02DigestSha256}|${instructionResult.instruction.jti}`),
    tipSha: lateProvenance.tipSha,
    tipDigest: lateProvenance.tipDigest,
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    jti: instructionResult.instruction.jti,
    standingAuthority: false,
    authenticMutationAuthority: isAuthenticOwnerInstalledPath,
  });
  evaluationFenceBrand.add(fence);

  const authorization = Object.freeze({
    kind: S2_GATE_KIND,
    decision: S2_GATE_DECISIONS.ALLOW,
    repositoryId: S2_GATE_REPOSITORY_ID,
    sliceId: S2_GATE_SLICE_ID,
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    rule02GitBlob: provenance.rule02GitBlob,
    mergeParent1: provenance.mergeParent1,
    mergeParent2: provenance.mergeParent2,
    authorizedFileScope: S2_GATE_AUTHORIZED_FILE_SCOPE,
    operationClass: S2_GATE_OPERATION_CLASS,
    governanceRevision: parsedGovernanceRevision,
    jti: instructionResult.instruction.jti,
    fence,
    standingAuthority: false,
    reusable: false,
    operational: false,
    fullS2EffectiveAuthorization: false,
    testOnly: provenance.testOnly === true,
    authenticMutationAuthority: isAuthenticOwnerInstalledPath,
  });
  const result = Object.freeze({
    ok: true,
    decision: S2_GATE_DECISIONS.ALLOW,
    reasons: Object.freeze([
      'VALIDATOR_ALLOW',
      'GIT_MERGE_PROVENANCE_VERIFIED',
      'S2_OWNER_INSTRUCTION_VERIFIED',
      isAuthenticOwnerInstalledPath
        ? 'OWNER_INSTALLED_AUTHENTIC_OFFLINE_MUTATION_CANDIDATE'
        : 'TEST_ONLY_NON_AUTHENTIC_FIXTURE',
      'NON_OPERATIONAL_OFFLINE_BOOTSTRAP',
    ]),
    authorization,
    standingAuthority: false,
    operational: false,
    purpose: S2_GATE_PURPOSE,
    fullS2EffectiveAuthorization: false,
    authenticMutationAuthority: isAuthenticOwnerInstalledPath,
    performsDatabaseWrite: false,
    executesWorker: false,
  });
  gateDecisionBrand.add(result);
  // Critical: TEST_ONLY evaluate ALLOW is never branded as authentic mutation authority.
  if (isAuthenticOwnerInstalledPath) {
    authenticOfflineMutationAuthorizationBrand.add(result);
  }
  return result;
}

function readWorktreeRule02Digest(repoPath) {
  const filePath = pathJoin(repoPath, S2_GATE_RULE02_RELATIVE_PATH);
  if (!existsSync(filePath)) {
    return Object.freeze({ ok: false, reason: 'WORKTREE_RULE02_MISSING' });
  }
  try {
    const text = readFileSync(filePath, 'utf8');
    return Object.freeze({ ok: true, digest: digestText(text), text });
  } catch (err) {
    return Object.freeze({ ok: false, reason: 'WORKTREE_RULE02_UNREADABLE', detail: String(err && err.message || err) });
  }
}

/**
 * Consumption-time freshness: re-read Git objects + worktree Rule02.
 * Distinct from evaluate-time provenance snapshot.
 */
function reinspectCanonicalFreshnessAtConsumption(expected) {
  if (authConsumptionFreshnessProbe && typeof authConsumptionFreshnessProbe.inspect === 'function') {
    return authConsumptionFreshnessProbe.inspect(expected);
  }
  const repoPath = isNonEmptyString(expected.repoPathHint)
    ? expected.repoPathHint
    : resolveOwnerTrustedRepoPath();
  if (!isNonEmptyString(repoPath)) {
    return Object.freeze({ ok: false, reason: 'OWNER_TRUSTED_REPO_PATH_MISSING' });
  }
  // Strict: mutation consumption requires HEAD == pinned canonical SHA (not merely ancestor).
  const head = gitCapture(repoPath, ['rev-parse', 'HEAD']);
  if (!head.ok || head.text !== expected.canonicalSha) {
    return Object.freeze({ ok: false, reason: 'HEAD_NOT_PINNED_CANONICAL', detail: head.text || head.error });
  }
  const inspected = inspectTrustedGitMergeProvenance(repoPath, {
    repositoryId: S2_GATE_REPOSITORY_ID,
    canonicalSha: expected.canonicalSha,
    rule02RelativePath: S2_GATE_RULE02_RELATIVE_PATH,
    rule02GitBlob: expected.rule02GitBlob,
    rule02DigestSha256: expected.rule02DigestSha256,
    mergeParent1: expected.mergeParent1,
    mergeParent2: expected.mergeParent2,
  });
  if (!inspected.ok) {
    return Object.freeze({
      ok: false,
      reason: inspected.reason || 'PROVENANCE_RECHECK_FAILED',
      detail: inspected.detail,
    });
  }
  if (inspected.tipSha !== expected.canonicalSha
    || !safeEqualHex(inspected.rule02DigestSha256, expected.rule02DigestSha256)
    || inspected.rule02GitBlob !== expected.rule02GitBlob) {
    return Object.freeze({ ok: false, reason: 'PROVENANCE_PIN_MISMATCH' });
  }
  if (expected.fenceTipSha && !safeEqualHex(inspected.tipSha, expected.fenceTipSha)) {
    return Object.freeze({ ok: false, reason: 'FENCE_TIP_MISMATCH' });
  }
  if (expected.fenceTipDigest && !safeEqualHex(inspected.rule02DigestSha256, expected.fenceTipDigest)) {
    return Object.freeze({ ok: false, reason: 'FENCE_DIGEST_MISMATCH' });
  }
  const worktree = readWorktreeRule02Digest(repoPath);
  if (!worktree.ok) {
    return Object.freeze({ ok: false, reason: worktree.reason, detail: worktree.detail });
  }
  if (!safeEqualHex(worktree.digest, expected.rule02DigestSha256)) {
    return Object.freeze({
      ok: false,
      reason: 'WORKTREE_RULE02_DIGEST_DRIFT',
      detail: worktree.digest,
    });
  }
  return Object.freeze({
    ok: true,
    repoPath,
    canonicalSha: inspected.canonicalSha,
    rule02GitBlob: inspected.rule02GitBlob,
    rule02DigestSha256: inspected.rule02DigestSha256,
  });
}

/**
 * Real offline mutation authorization boundary.
 * One-shot authentic Gate result consumption with mandatory Git/Rule02 freshness recheck.
 * Spends the original object before freshness verification (failed freshness cannot revive it).
 */
export function consumeAuthenticS2OfflineImplementationAuthorization(gateResult) {
  try {
    // 1) Validate genuine authentic Gate result identity (no spend yet).
    if (!isBrandedS2GateDecision(gateResult)) {
      return deny(S2_GATE_DECISIONS.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT, ['GATE_DECISION_NOT_BRANDED']);
    }
    if (spentAuthenticAuthorizationObjects.has(gateResult)) {
      return deny(S2_GATE_DECISIONS.DENY_AUTHORIZATION_ALREADY_SPENT, ['AUTHORIZATION_OBJECT_ALREADY_SPENT']);
    }
    if (!authenticOfflineMutationAuthorizationBrand.has(gateResult)) {
      return deny(S2_GATE_DECISIONS.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION, [
        'AUTHENTIC_OWNER_INSTALLED_BRAND_REQUIRED',
        'TEST_ONLY_OR_FORGED_ALLOW_CANNOT_AUTHORIZE_MUTATION',
      ]);
    }
    if (gateResult.ok !== true || gateResult.decision !== S2_GATE_DECISIONS.ALLOW) {
      return deny(S2_GATE_DECISIONS.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT, ['ALLOW_REQUIRED']);
    }
    if (gateResult.authenticMutationAuthority !== true
      || !isPlainObject(gateResult.authorization)
      || gateResult.authorization.authenticMutationAuthority !== true
      || gateResult.authorization.testOnly === true
      || gateResult.operational === true) {
      return deny(S2_GATE_DECISIONS.DENY_TEST_ONLY_NOT_AUTHENTIC_MUTATION, ['AUTHENTIC_MUTATION_FLAGS_INVALID']);
    }

    // 2) Atomically claim one-shot state BEFORE freshness (sync; same-process only).
    spentAuthenticAuthorizationObjects.add(gateResult);
    authenticOfflineMutationAuthorizationBrand.delete(gateResult);

    // 3) Validate embedded authorization + fence after spend.
    const authorization = gateResult.authorization;
    const fence = authorization.fence;
    if (!isBrandedS2EvaluationFence(fence)) {
      return deny(S2_GATE_DECISIONS.DENY_MISSING_EVALUATION_FENCE, ['EVALUATION_FENCE_REQUIRED']);
    }
    if (!isNonEmptyString(authorization.canonicalSha)
      || !isNonEmptyString(authorization.rule02DigestSha256)
      || !isNonEmptyString(authorization.rule02GitBlob)
      || !isNonEmptyString(authorization.mergeParent1)
      || !isNonEmptyString(authorization.mergeParent2)
      || !isNonEmptyString(fence.tipSha)
      || !isNonEmptyString(fence.tipDigest)) {
      return deny(S2_GATE_DECISIONS.DENY_UNAUTHENTIC_AUTHORIZATION_OBJECT, ['AUTHORIZATION_BINDINGS_INCOMPLETE']);
    }
    if (!safeEqualHex(authorization.canonicalSha, fence.tipSha)
      || !safeEqualHex(authorization.rule02DigestSha256, fence.tipDigest)) {
      return deny(S2_GATE_DECISIONS.DENY_GIT_FRESHNESS, ['FENCE_AUTHORIZATION_PIN_MISMATCH']);
    }

    // 4–6) Trusted repo boundary + independent Git/Rule02 freshness re-read.
    let repoPath = null;
    if (authConsumptionFreshnessProbe && typeof authConsumptionFreshnessProbe.resolveRepoPath === 'function') {
      repoPath = authConsumptionFreshnessProbe.resolveRepoPath();
    } else {
      repoPath = resolveOwnerTrustedRepoPath();
    }
    if (!isNonEmptyString(repoPath)) {
      return deny(S2_GATE_DECISIONS.DENY_UNTRUSTED_REPOSITORY_BOUNDARY, ['OWNER_TRUSTED_REPO_PATH_MISSING']);
    }
    // Reject caller-controlled repoPath on the public call surface (none accepted).
    const freshness = reinspectCanonicalFreshnessAtConsumption({
      canonicalSha: authorization.canonicalSha,
      rule02GitBlob: authorization.rule02GitBlob,
      rule02DigestSha256: authorization.rule02DigestSha256,
      mergeParent1: authorization.mergeParent1,
      mergeParent2: authorization.mergeParent2,
      fenceTipSha: fence.tipSha,
      fenceTipDigest: fence.tipDigest,
      repoPathHint: repoPath,
    });
    if (!freshness.ok) {
      if (freshness.reason === 'WORKTREE_RULE02_DIGEST_DRIFT') {
        return deny(S2_GATE_DECISIONS.DENY_WORKTREE_RULE02_DRIFT, sanitizeReasons([
          freshness.reason, freshness.detail,
        ].filter(Boolean)));
      }
      return deny(S2_GATE_DECISIONS.DENY_GIT_FRESHNESS, sanitizeReasons([
        freshness.reason, freshness.detail,
      ].filter(Boolean)));
    }

    // 7) Single authenticated, non-reusable consumption result.
    const consumed = Object.freeze({
      ok: true,
      decision: S2_GATE_DECISIONS.ALLOW,
      reasons: Object.freeze([
        'AUTHENTIC_OWNER_INSTALLED_OFFLINE_MUTATION_AUTHORIZATION_CONSUMED',
        'ONE_SHOT_SPENT',
        'GIT_RULE02_FRESHNESS_RECHECKED',
      ]),
      authorization,
      standingAuthority: false,
      operational: false,
      purpose: S2_GATE_PURPOSE,
      fullS2EffectiveAuthorization: false,
      authenticMutationAuthority: false,
      authorizationConsumed: true,
      reusable: false,
      performsDatabaseWrite: false,
      executesWorker: false,
    });
    gateDecisionBrand.add(consumed);
    // Deliberately NOT added to authenticOfflineMutationAuthorizationBrand.
    return consumed;
  } catch (err) {
    return deny(S2_GATE_DECISIONS.DENY_FAIL_CLOSED, sanitizeReasons([
      'CONSUME_THREW', String(err && err.message || err),
    ]));
  }
}

export function isAuthenticS2OfflineMutationAuthorization(value) {
  return authenticOfflineMutationAuthorizationBrand.has(value)
    && !spentAuthenticAuthorizationObjects.has(value);
}

/**
 * Offline QA hooks for consumption/replay/freshness tests.
 * Not Owner enrollment. TEST_ONLY evaluate path still cannot mint authentic brand.
 */
export const __testOnlyS2AuthConsumptionHooks = Object.freeze({
  mintAuthenticEvaluateResultForConsumptionQa(spec = {}) {
    if (!isPlainObject(spec)) throw new TypeError('QA_SPEC_REQUIRED');
    const canonicalSha = spec.canonicalSha;
    const rule02DigestSha256 = spec.rule02DigestSha256;
    const rule02GitBlob = spec.rule02GitBlob;
    const mergeParent1 = spec.mergeParent1;
    const mergeParent2 = spec.mergeParent2;
    if (!isNonEmptyString(canonicalSha) || !isNonEmptyString(rule02DigestSha256)
      || !isNonEmptyString(rule02GitBlob) || !isNonEmptyString(mergeParent1)
      || !isNonEmptyString(mergeParent2)) {
      throw new TypeError('QA_AUTHENTIC_BINDINGS_REQUIRED');
    }
    const fence = Object.freeze({
      kind: 'TECP_OPS_S2_EVALUATION_FENCE',
      evaluationId: digestText(`${canonicalSha}|${rule02DigestSha256}|qa`),
      tipSha: canonicalSha,
      tipDigest: rule02DigestSha256,
      canonicalSha,
      rule02DigestSha256,
      jti: isNonEmptyString(spec.jti) ? spec.jti : 'qa-auth-consume-jti',
      standingAuthority: false,
      authenticMutationAuthority: true,
    });
    evaluationFenceBrand.add(fence);
    const authorization = Object.freeze({
      kind: S2_GATE_KIND,
      decision: S2_GATE_DECISIONS.ALLOW,
      repositoryId: S2_GATE_REPOSITORY_ID,
      sliceId: S2_GATE_SLICE_ID,
      canonicalSha,
      rule02DigestSha256,
      rule02GitBlob,
      mergeParent1,
      mergeParent2,
      authorizedFileScope: S2_GATE_AUTHORIZED_FILE_SCOPE,
      operationClass: S2_GATE_OPERATION_CLASS,
      governanceRevision: S2_GATE_GOVERNANCE_REVISION,
      jti: fence.jti,
      fence,
      standingAuthority: false,
      reusable: false,
      operational: false,
      fullS2EffectiveAuthorization: false,
      testOnly: false,
      authenticMutationAuthority: true,
    });
    const result = Object.freeze({
      ok: true,
      decision: S2_GATE_DECISIONS.ALLOW,
      reasons: Object.freeze(['QA_AUTHENTIC_EVALUATE_RESULT']),
      authorization,
      standingAuthority: false,
      operational: false,
      purpose: S2_GATE_PURPOSE,
      fullS2EffectiveAuthorization: false,
      authenticMutationAuthority: true,
      performsDatabaseWrite: false,
      executesWorker: false,
    });
    gateDecisionBrand.add(result);
    authenticOfflineMutationAuthorizationBrand.add(result);
    return result;
  },
  installFreshnessProbe(probe) {
    if (probe != null && !isPlainObject(probe)) throw new TypeError('QA_PROBE_OBJECT_REQUIRED');
    authConsumptionFreshnessProbe = probe;
    return () => { authConsumptionFreshnessProbe = null; };
  },
  isSpent(value) {
    return spentAuthenticAuthorizationObjects.has(value);
  },
});

export function assertS2MutationFenceFresh(fence, harnessOrNull, liveRepoPath = null) {
  if (!isBrandedS2EvaluationFence(fence)) {
    return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['FENCE_NOT_BRANDED']);
  }
  if (harnessOrNull != null) {
    if (!isTestOnlyS2EffectiveAuthHarness(harnessOrNull)) {
      return deny(S2_GATE_DECISIONS.DENY_GIT_PROVENANCE_UNAVAILABLE, ['HARNESS_REQUIRED']);
    }
    const provenance = trustRootPrivate.get(harnessOrNull).getProvenance();
    if (!safeEqualHex(fence.tipSha, provenance.tipSha)
      || !safeEqualHex(fence.tipDigest, provenance.tipDigest)) {
      return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['TIP_CHANGED_SINCE_EVALUATION']);
    }
  } else if (isNonEmptyString(liveRepoPath)) {
    const head = gitCapture(liveRepoPath, ['rev-parse', 'HEAD']);
    if (!head.ok || head.text !== fence.tipSha) {
      return deny(S2_GATE_DECISIONS.DENY_TIP_DRIFT, ['LIVE_HEAD_CHANGED']);
    }
  } else {
    return deny(S2_GATE_DECISIONS.DENY_GIT_PROVENANCE_UNAVAILABLE, ['NO_FENCE_CONTEXT']);
  }
  const ok = Object.freeze({
    ok: true,
    decision: S2_GATE_DECISIONS.ALLOW,
    reasons: Object.freeze(['FENCE_FRESH']),
    authorization: null,
    standingAuthority: false,
    operational: false,
    purpose: S2_GATE_PURPOSE,
    fullS2EffectiveAuthorization: false,
    performsDatabaseWrite: false,
    executesWorker: false,
  });
  gateDecisionBrand.add(ok);
  return ok;
}

export const __testOnlyS2EvaluationLockHooks = Object.freeze({
  hold() {
    if (evaluationLock !== null) return false;
    const token = Object.create(null);
    evaluationLock = token;
    return token;
  },
  release(token) {
    if (evaluationLock === token) evaluationLock = null;
  },
});

export { digestText as s2GateDigestText, sha256Hex };
