/**
 * TECP-DLP-011 — Effective Implementation Authorization Gate
 * (TEST_ONLY / NON_OPERATIONAL / OPTION A additive).
 *
 * Frozen validateGovernance() is a NECESSARY input but NEVER sufficient to authorize
 * an execution. This gate independently requires trusted Rule02 provenance, merged
 * canonical SHA + digest binding, tip attestation, and a verified external signed
 * Owner implementation instruction. Never creates a reusable standing ALLOW token.
 *
 * NON-CLAIMS:
 * - Does not repair the frozen governance validator.
 * - Additive authorization-decision primitive only; not an operationally integrated path.
 * - Future Worker/MCP mutation entry points must be explicitly wired through this gate.
 * - Public persistence APIs may still bypass any future operational path.
 * - Live GitHub provenance verification is NOT implemented.
 * - Real Owner key custody is NOT implemented.
 * - Same-UID/ptrace separation remains unsealed.
 * - Real OS Worker identity is unproven.
 * - Production R1 / C24 real PostgreSQL deadlock are unproven.
 * - Real Cursor operation remains unauthorized.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

import { parseRule02 } from './rule02Parser.js';
import {
  OPERATION_CLASSES,
  validateGovernance,
} from './governanceValidator.js';
import {
  createOwnerImplementationInstructionVerifier,
  isBrandedOwnerImplementationInstructionVerifier,
  isBrandedVerifiedOwnerInstruction,
  safeEqualHex,
} from './ownerImplementationInstruction.js';

export const GATE_KIND = 'TECP_DLP011_EFFECTIVE_IMPLEMENTATION_AUTHORIZATION_GATE';
export const GATE_PURPOSE = 'TEST_ONLY';
export const GATE_SLICE_ID = 'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE';
export const GATE_OPERATION_CLASS = 'CREATE_AUTHORIZED_FOUR_PATH_DISPOSABLE_PROOF';
export const GATE_REPOSITORY_ID = 'sepehrraeisi/TitanGold';

export const GATE_AUTHORIZED_FILE_SCOPE = Object.freeze([
  'tecp/src/effectiveImplementationAuthorizationGate.js',
  'tecp/src/ownerImplementationInstruction.js',
  'tecp/test/disposableMergeEffectivenessHarness.js',
  'tecp/test/effectiveImplementationAuthorizationGate.test.js',
]);

export const GATE_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_INPUT: 'DENY_MISSING_INPUT',
  DENY_UNTRUSTED_CANONICAL_SOURCE: 'DENY_UNTRUSTED_CANONICAL_SOURCE',
  DENY_UNBRANDED_VERIFIER: 'DENY_UNBRANDED_VERIFIER',
  DENY_CANONICAL_CLOSED: 'DENY_CANONICAL_CLOSED',
  DENY_UNMERGED_YES_TOKEN: 'DENY_UNMERGED_YES_TOKEN',
  DENY_FORGED_RULE02: 'DENY_FORGED_RULE02',
  DENY_MISSING_OWNER_INSTRUCTION: 'DENY_MISSING_OWNER_INSTRUCTION',
  DENY_WRONG_CANONICAL_SHA: 'DENY_WRONG_CANONICAL_SHA',
  DENY_WRONG_RULE02_DIGEST: 'DENY_WRONG_RULE02_DIGEST',
  DENY_FAKE_MERGED_FLAG: 'DENY_FAKE_MERGED_FLAG',
  DENY_VALIDATOR_NOT_ALLOW: 'DENY_VALIDATOR_NOT_ALLOW',
  DENY_OWNER_INSTRUCTION: 'DENY_OWNER_INSTRUCTION',
  DENY_WRONG_SCOPE_OR_ACTION: 'DENY_WRONG_SCOPE_OR_ACTION',
  DENY_WRONG_REPOSITORY_OR_SLICE: 'DENY_WRONG_REPOSITORY_OR_SLICE',
  DENY_STALE_TIP: 'DENY_STALE_TIP',
  DENY_TIP_DRIFT: 'DENY_TIP_DRIFT',
  DENY_CALLER_AUTHORIZED_INVOCATION: 'DENY_CALLER_AUTHORIZED_INVOCATION',
  DENY_MALFORMED_OR_OVERSIZED: 'DENY_MALFORMED_OR_OVERSIZED',
  DENY_CLOCK_OR_REVOCATION_UNAVAILABLE: 'DENY_CLOCK_OR_REVOCATION_UNAVAILABLE',
  DENY_CONFLICTING_AUTHORIZATION: 'DENY_CONFLICTING_AUTHORIZATION',
  DENY_ENVIRONMENT_NOT_TEST_ONLY: 'DENY_ENVIRONMENT_NOT_TEST_ONLY',
  DENY_PROVENANCE_UNAVAILABLE: 'DENY_PROVENANCE_UNAVAILABLE',
  DENY_FAIL_CLOSED: 'DENY_FAIL_CLOSED',
  DENY_NON_CONSUMING_VERIFIER: 'DENY_NON_CONSUMING_VERIFIER',
  DENY_GOVERNANCE_REVISION_MISMATCH: 'DENY_GOVERNANCE_REVISION_MISMATCH',
  DENY_PARSED_SCOPE_MISMATCH: 'DENY_PARSED_SCOPE_MISMATCH',
  DENY_PARSED_SLICE_MISMATCH: 'DENY_PARSED_SLICE_MISMATCH',
});

const SOURCE_KINDS = Object.freeze({
  CANONICAL_MAIN: 'CANONICAL_MAIN',
  PINNED_MERGED_SHA_VERIFIED: 'PINNED_MERGED_SHA_VERIFIED',
  TEST_ONLY_ATTESTED: 'TEST_ONLY_ATTESTED',
});

const canonicalSourceBrand = new WeakSet();
const tipAttestationBrand = new WeakSet();
const gateDecisionBrand = new WeakSet();
const evaluationFenceBrand = new WeakSet();

/** In-process exclusive evaluation lock for concurrent conflicting attempts. */
let evaluationLock = null;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = [decision], extras = {}) {
  const result = Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...(reasons || [decision])]),
    authorization: null,
    standingAuthority: false,
    operational: false,
    purpose: GATE_PURPOSE,
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
    // Strip anything that looks like PEM / private key material.
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(s) || /privateKeyPem/i.test(s)) {
      return 'REDACTED_SENSITIVE';
    }
    if (s.length > 512) return `${s.slice(0, 512)}…`;
    return s;
  });
}

function digestText(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function scopesMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/**
 * Privileged factory for a branded CanonicalRule02Source.
 * Caller JSON / `merged:true` / `canonical:true` / branch name alone NEVER creates trust.
 */
export function createCanonicalRule02Source(spec) {
  if (!isPlainObject(spec)
    || !isNonEmptyString(spec.repositoryId)
    || !isNonEmptyString(spec.canonicalSha)
    || !isNonEmptyString(spec.rule02Text)
    || !isNonEmptyString(spec.sourceKind)
    || !Object.values(SOURCE_KINDS).includes(spec.sourceKind)) {
    throw new TypeError('INVALID_CANONICAL_RULE02_SOURCE_SPEC');
  }
  // Ambiguous caller flags alone must not establish trust — require privileged attestation.
  if (spec.attestedByPrivilegedFactory !== true) {
    throw new TypeError('PRIVILEGED_ATTESTATION_REQUIRED');
  }
  if (spec.sourceKind === SOURCE_KINDS.CANONICAL_MAIN
    || spec.sourceKind === SOURCE_KINDS.PINNED_MERGED_SHA_VERIFIED) {
    if (spec.mergedProvenance !== true || !isNonEmptyString(spec.activationPr)) {
      throw new TypeError('MERGED_PROVENANCE_REQUIRED');
    }
  }
  const rule02DigestSha256 = digestText(spec.rule02Text);
  if (isNonEmptyString(spec.expectedRule02DigestSha256)
    && !safeEqualHex(rule02DigestSha256, spec.expectedRule02DigestSha256)) {
    throw new TypeError('RULE02_DIGEST_MISMATCH');
  }

  const source = Object.freeze({
    kind: 'TECP_DLP011_CANONICAL_RULE02_SOURCE',
    repositoryId: spec.repositoryId,
    canonicalSha: spec.canonicalSha,
    rule02Text: spec.rule02Text,
    rule02DigestSha256,
    sourceKind: spec.sourceKind,
    mergedProvenance: spec.mergedProvenance === true,
    activationPr: spec.activationPr || null,
    tipDigest: isNonEmptyString(spec.tipDigest) ? spec.tipDigest : rule02DigestSha256,
    testOnly: spec.sourceKind === SOURCE_KINDS.TEST_ONLY_ATTESTED,
    // Explicit: WeakSet brand ≠ cryptographic authentication.
    cryptographicAuthentication: false,
  });
  canonicalSourceBrand.add(source);
  return source;
}

/**
 * TEST_ONLY attested canonical source factory for the disposable harness.
 * Does NOT establish production trust or live GitHub provenance.
 */
export function createTestOnlyAttestedCanonicalRule02Source(spec) {
  return createCanonicalRule02Source({
    ...spec,
    sourceKind: SOURCE_KINDS.TEST_ONLY_ATTESTED,
    attestedByPrivilegedFactory: true,
    mergedProvenance: spec.mergedProvenance === true,
  });
}

export function isBrandedCanonicalRule02Source(value) {
  return canonicalSourceBrand.has(value);
}

/**
 * Privileged tip/provenance attestation. Branch name `main` alone is insufficient.
 */
export function createTrustedTipAttestation(spec) {
  if (!isPlainObject(spec)
    || !isNonEmptyString(spec.tipSha)
    || !isNonEmptyString(spec.tipDigest)
    || spec.attestedByPrivilegedFactory !== true) {
    throw new TypeError('INVALID_TIP_ATTESTATION');
  }
  const tip = Object.freeze({
    kind: 'TECP_DLP011_TRUSTED_TIP_ATTESTATION',
    tipSha: spec.tipSha,
    tipDigest: spec.tipDigest,
    observedAtMs: Number.isSafeInteger(spec.observedAtMs) ? spec.observedAtMs : null,
    cryptographicAuthentication: false,
  });
  tipAttestationBrand.add(tip);
  return tip;
}

export function isBrandedTrustedTipAttestation(value) {
  return tipAttestationBrand.has(value);
}

export function isBrandedGateDecision(value) {
  return gateDecisionBrand.has(value);
}

export function isBrandedEvaluationFence(value) {
  return evaluationFenceBrand.has(value);
}

/**
 * Evaluate effective implementation authorization.
 * Never returns a reusable standing ALLOW token. Each ALLOW is single-use (jti consumed).
 */
export function evaluateEffectiveImplementationAuthorization(input) {
  // Exclusive serialization for concurrent conflicting attempts.
  const lockToken = Object.create(null);
  if (evaluationLock !== null) {
    return deny(GATE_DECISIONS.DENY_CONFLICTING_AUTHORIZATION, [
      'CONCURRENT_EVALUATION_IN_PROGRESS',
    ]);
  }
  evaluationLock = lockToken;

  try {
    return evaluateEffectiveImplementationAuthorizationUnlocked(input);
  } finally {
    if (evaluationLock === lockToken) {
      evaluationLock = null;
    }
  }
}

function evaluateEffectiveImplementationAuthorizationUnlocked(input) {
  if (!isPlainObject(input)) {
    return deny(GATE_DECISIONS.DENY_MISSING_INPUT, ['INPUT_REQUIRED']);
  }

  // Reject ambient / caller-manufactured authority objects.
  if (Object.prototype.hasOwnProperty.call(input, 'AuthorizedInvocation')
    || Object.prototype.hasOwnProperty.call(input, 'authorizedInvocation')
    || input.callerAuthorizedInvocation != null) {
    return deny(GATE_DECISIONS.DENY_CALLER_AUTHORIZED_INVOCATION, [
      'CALLER_AUTHORIZED_INVOCATION_REJECTED',
    ]);
  }

  // TEST_ONLY environment constraint — no ambient env authority; explicit flag required.
  if (input.testOnlyEnvironment !== true) {
    return deny(GATE_DECISIONS.DENY_ENVIRONMENT_NOT_TEST_ONLY, [
      'EXPLICIT_TEST_ONLY_ENVIRONMENT_REQUIRED',
    ]);
  }

  if (!isBrandedCanonicalRule02Source(input.canonicalRule02Source)) {
    return deny(GATE_DECISIONS.DENY_UNTRUSTED_CANONICAL_SOURCE, [
      'CANONICAL_SOURCE_NOT_BRANDED',
    ]);
  }
  if (!isBrandedOwnerImplementationInstructionVerifier(input.ownerInstructionVerifier)) {
    return deny(GATE_DECISIONS.DENY_UNBRANDED_VERIFIER, [
      'OWNER_INSTRUCTION_VERIFIER_NOT_BRANDED',
    ]);
  }
  // P1: reject non-consuming verifiers — no standing ALLOW / replayable jti.
  if (input.ownerInstructionVerifier.consumeOnAllow !== true) {
    return deny(GATE_DECISIONS.DENY_NON_CONSUMING_VERIFIER, [
      'CONSUME_ON_ALLOW_REQUIRED',
    ]);
  }
  if (!isBrandedTrustedTipAttestation(input.tipAttestation)) {
    return deny(GATE_DECISIONS.DENY_PROVENANCE_UNAVAILABLE, [
      'TIP_ATTESTATION_NOT_BRANDED',
    ]);
  }

  // Fake merged / canonical flags on the input object are ignored and treated as attack.
  if (Object.prototype.hasOwnProperty.call(input, 'merged')
    || Object.prototype.hasOwnProperty.call(input, 'canonical')
    || Object.prototype.hasOwnProperty.call(input, 'branchName')) {
    return deny(GATE_DECISIONS.DENY_FAKE_MERGED_FLAG, [
      'CALLER_MERGED_OR_CANONICAL_FLAG_REJECTED',
    ]);
  }

  const source = input.canonicalRule02Source;
  const tip = input.tipAttestation;

  if (!isNonEmptyString(input.expectedCanonicalSha)
    || !isNonEmptyString(input.expectedRule02DigestSha256)
    || !isNonEmptyString(input.repositoryId)
    || !isNonEmptyString(input.sliceId)
    || !isNonEmptyString(input.operationClass)
    || !isNonEmptyString(input.governanceRevision)
    || !Array.isArray(input.authorizedFileScope)) {
    return deny(GATE_DECISIONS.DENY_MISSING_INPUT, ['EXPECTED_BINDINGS_REQUIRED']);
  }

  if (input.repositoryId !== GATE_REPOSITORY_ID
    || input.sliceId !== GATE_SLICE_ID
    || source.repositoryId !== GATE_REPOSITORY_ID) {
    return deny(GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE);
  }

  if (!scopesMatch(input.authorizedFileScope, GATE_AUTHORIZED_FILE_SCOPE)
    || input.operationClass !== GATE_OPERATION_CLASS) {
    return deny(GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
  }

  // Tip / provenance freshness against branded source.
  if (!safeEqualHex(tip.tipSha, source.canonicalSha)
    || !safeEqualHex(tip.tipDigest, source.tipDigest)) {
    return deny(GATE_DECISIONS.DENY_STALE_TIP, ['TIP_DOES_NOT_MATCH_CANONICAL_SOURCE']);
  }

  // SHA + digest binding.
  if (!safeEqualHex(source.canonicalSha, input.expectedCanonicalSha)) {
    return deny(GATE_DECISIONS.DENY_WRONG_CANONICAL_SHA);
  }
  if (!safeEqualHex(source.rule02DigestSha256, input.expectedRule02DigestSha256)) {
    return deny(GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
  }

  // Parse Rule02 + frozen validator (necessary, not sufficient).
  let parsed;
  try {
    parsed = parseRule02(source.rule02Text);
  } catch (err) {
    const code = err && err.code ? String(err.code) : 'RULE02_PARSE_FAILED';
    return deny(GATE_DECISIONS.DENY_FORGED_RULE02, sanitizeReasons([code]));
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed.governanceFacts)) {
    return deny(GATE_DECISIONS.DENY_FORGED_RULE02, ['RULE02_STRUCTURE_INVALID']);
  }

  const facts = parsed.governanceFacts;
  const parsedSliceId = parsed.authority
    && parsed.authority.activeWorkPackage
    && parsed.authority.activeWorkPackage.sliceId;
  const tecpSliceId = parsed.tecp && parsed.tecp.TECP_AUTHORIZED_SLICE;
  const parsedGovernanceRevision = parsed.authority
    && parsed.authority.governanceRevision;

  // P1: bind parsed active slice to this exact DLP-011 gate slice.
  if (parsedSliceId !== GATE_SLICE_ID || tecpSliceId !== GATE_SLICE_ID) {
    return deny(GATE_DECISIONS.DENY_PARSED_SLICE_MISMATCH, [
      'PARSED_ACTIVE_SLICE_NOT_DLP011',
      `PARSED_SLICE:${String(parsedSliceId)}`,
      `TECP_SLICE:${String(tecpSliceId)}`,
    ]);
  }

  // P1: bind parsed authorized paths to the exact four-path gate scope.
  if (!scopesMatch(facts.authorizedFileScope, GATE_AUTHORIZED_FILE_SCOPE)) {
    return deny(GATE_DECISIONS.DENY_PARSED_SCOPE_MISMATCH, [
      'PARSED_AUTHORIZED_FILE_SCOPE_MISMATCH',
    ]);
  }

  // P1: governance revision must come from parsed Rule02 and match caller binding.
  if (!isNonEmptyString(parsedGovernanceRevision)) {
    return deny(GATE_DECISIONS.DENY_GOVERNANCE_REVISION_MISMATCH, [
      'PARSED_GOVERNANCE_REVISION_MISSING',
    ]);
  }
  if (input.governanceRevision !== parsedGovernanceRevision) {
    return deny(GATE_DECISIONS.DENY_GOVERNANCE_REVISION_MISMATCH, [
      'CALLER_GOVERNANCE_REVISION_MISMATCH',
    ]);
  }

  const validatorRequest = Object.freeze({
    sliceId: GATE_SLICE_ID,
    authorityClass: facts.authorityClass,
    riskTier: facts.riskTier,
    requestedPaths: Object.freeze([...GATE_AUTHORIZED_FILE_SCOPE]),
    operationClass: OPERATION_CLASSES.IMPLEMENT,
    requiresDeploy: false,
    requiresProductionMutation: false,
  });

  let validatorResult;
  try {
    validatorResult = validateGovernance(parsed, validatorRequest);
  } catch {
    return deny(GATE_DECISIONS.DENY_FAIL_CLOSED, ['VALIDATOR_THREW']);
  }

  // Canonical closed / not authorized: validator DENY_NOT_AUTHORIZED → closed taxonomy.
  if (!validatorResult || validatorResult.allowed !== true) {
    const vDecision = (validatorResult && validatorResult.decision) || 'UNKNOWN';
    if (vDecision === 'DENY_NOT_AUTHORIZED') {
      return deny(GATE_DECISIONS.DENY_CANONICAL_CLOSED, [
        'IMPLEMENTATION_AUTHORIZATION_NOT_EFFECTIVE',
        `VALIDATOR_${vDecision}`,
      ]);
    }
    return deny(GATE_DECISIONS.DENY_VALIDATOR_NOT_ALLOW, [
      `VALIDATOR_${vDecision}`,
      ...sanitizeReasons((validatorResult && validatorResult.reasons) || []),
    ]);
  }

  // Unmerged / non-provenance YES-token: validator ALLOW is NOT sufficient.
  if (source.mergedProvenance !== true) {
    return deny(GATE_DECISIONS.DENY_UNMERGED_YES_TOKEN, [
      'VALIDATOR_ALLOW_WITHOUT_TRUSTED_MERGED_PROVENANCE',
      `VALIDATOR_${validatorResult.decision}`,
    ]);
  }

  // Owner instruction required.
  if (!isNonEmptyString(input.ownerInstructionEncoded)) {
    return deny(GATE_DECISIONS.DENY_MISSING_OWNER_INSTRUCTION);
  }
  if (input.ownerInstructionEncoded.length > 32 * 1024) {
    return deny(GATE_DECISIONS.DENY_MALFORMED_OR_OVERSIZED, ['INSTRUCTION_OVERSIZED']);
  }

  const expectation = Object.freeze({
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    canonicalSha: input.expectedCanonicalSha,
    rule02DigestSha256: input.expectedRule02DigestSha256,
    authorizedFileScope: GATE_AUTHORIZED_FILE_SCOPE,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: parsedGovernanceRevision,
    workerId: isNonEmptyString(input.workerId) ? input.workerId : undefined,
    taskId: isNonEmptyString(input.taskId) ? input.taskId : undefined,
  });

  let instructionResult;
  try {
    instructionResult = input.ownerInstructionVerifier.verify(
      input.ownerInstructionEncoded,
      expectation,
    );
  } catch (err) {
    const msg = err && err.message ? String(err.message) : 'VERIFIER_THREW';
    if (/UNAVAILABLE|CLOCK|REVOCATION/i.test(msg)) {
      return deny(GATE_DECISIONS.DENY_CLOCK_OR_REVOCATION_UNAVAILABLE, sanitizeReasons([msg]));
    }
    return deny(GATE_DECISIONS.DENY_OWNER_INSTRUCTION, sanitizeReasons([msg]));
  }

  if (!instructionResult || instructionResult.ok !== true) {
    const d = instructionResult && instructionResult.decision
      ? String(instructionResult.decision)
      : 'UNKNOWN';
    if (/CLOCK|REVOCATION|MISSING_DEPS/i.test(d)) {
      return deny(GATE_DECISIONS.DENY_CLOCK_OR_REVOCATION_UNAVAILABLE, sanitizeReasons(
        (instructionResult && instructionResult.reasons) || [d],
      ));
    }
    if (/MALFORMED|OVERSIZED|NONCANONICAL/i.test(d)) {
      return deny(GATE_DECISIONS.DENY_MALFORMED_OR_OVERSIZED, sanitizeReasons(
        (instructionResult && instructionResult.reasons) || [d],
      ));
    }
    return deny(GATE_DECISIONS.DENY_OWNER_INSTRUCTION, sanitizeReasons(
      (instructionResult && instructionResult.reasons) || [d],
    ));
  }

  if (!isBrandedVerifiedOwnerInstruction(instructionResult.instruction)) {
    return deny(GATE_DECISIONS.DENY_OWNER_INSTRUCTION, [
      'VERIFIED_INSTRUCTION_NOT_BRANDED',
    ]);
  }

  // Fresh provenance fence token — caller must re-check tip before mutation.
  const fence = Object.freeze({
    kind: 'TECP_DLP011_EVALUATION_FENCE',
    evaluationId: digestText(
      `${source.canonicalSha}|${source.rule02DigestSha256}|${instructionResult.instruction.jti}|${Date.now()}`,
    ),
    tipSha: tip.tipSha,
    tipDigest: tip.tipDigest,
    canonicalSha: source.canonicalSha,
    rule02DigestSha256: source.rule02DigestSha256,
    jti: instructionResult.instruction.jti,
    // Not standing authority.
    standingAuthority: false,
  });
  evaluationFenceBrand.add(fence);

  const authorization = Object.freeze({
    kind: GATE_KIND,
    decision: GATE_DECISIONS.ALLOW,
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    canonicalSha: source.canonicalSha,
    rule02DigestSha256: source.rule02DigestSha256,
    authorizedFileScope: GATE_AUTHORIZED_FILE_SCOPE,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: parsedGovernanceRevision,
    jti: instructionResult.instruction.jti,
    fence,
    // Explicit non-standing.
    standingAuthority: false,
    reusable: false,
    cryptographicAuthentication: false,
  });

  const result = Object.freeze({
    ok: true,
    decision: GATE_DECISIONS.ALLOW,
    reasons: Object.freeze(['VALIDATOR_ALLOW', 'MERGED_PROVENANCE', 'OWNER_INSTRUCTION_VERIFIED']),
    authorization,
    standingAuthority: false,
    operational: false,
    purpose: GATE_PURPOSE,
    performsDatabaseWrite: false,
    executesWorker: false,
  });
  gateDecisionBrand.add(result);
  return result;
}

/**
 * Mutation-fence recheck: tip must still match the evaluation fence.
 * A prior ALLOW does NOT authorize mutation if tip drifted.
 */
export function assertMutationFenceFresh(fence, currentTipAttestation) {
  if (!isBrandedEvaluationFence(fence)) {
    return deny(GATE_DECISIONS.DENY_TIP_DRIFT, ['FENCE_NOT_BRANDED']);
  }
  if (!isBrandedTrustedTipAttestation(currentTipAttestation)) {
    return deny(GATE_DECISIONS.DENY_PROVENANCE_UNAVAILABLE, [
      'CURRENT_TIP_NOT_BRANDED',
    ]);
  }
  if (!safeEqualHex(fence.tipSha, currentTipAttestation.tipSha)
    || !safeEqualHex(fence.tipDigest, currentTipAttestation.tipDigest)) {
    return deny(GATE_DECISIONS.DENY_TIP_DRIFT, ['TIP_CHANGED_SINCE_EVALUATION']);
  }
  const ok = Object.freeze({
    ok: true,
    decision: GATE_DECISIONS.ALLOW,
    reasons: Object.freeze(['FENCE_FRESH']),
    authorization: null,
    standingAuthority: false,
    operational: false,
    purpose: GATE_PURPOSE,
    performsDatabaseWrite: false,
    executesWorker: false,
  });
  gateDecisionBrand.add(ok);
  return ok;
}

/**
 * TEST_ONLY contention hooks — prove concurrent conflicting attempts DENY.
 * Not operational API surface.
 */
export const __testOnlyEvaluationLockHooks = Object.freeze({
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

export {
  createOwnerImplementationInstructionVerifier,
  SOURCE_KINDS,
  digestText as gateDigestText,
};
