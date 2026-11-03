/**
 * TECP-DLP-011 — Effective Implementation Authorization Gate
 * (TEST_ONLY / NON_OPERATIONAL / OPTION A additive).
 *
 * ACCEPTANCE DISPOSITION A — disposable limited proof:
 * - Proven only against a preinstalled privileged TEST_ONLY trust root.
 * - Untrusted *request* objects cannot replace that root or inject verification keys.
 * - Frozen validateGovernance() ALLOW is necessary but NEVER sufficient.
 * - Same-process callers of createDisposableEffectiveAuthorizationTrustRoot are the
 *   trust installer and are OUTSIDE the proven adversarial boundary.
 * - DISPOSABLE_TRUST_INJECTION_TOKEN is an explicit acknowledgment string, NOT a
 *   cryptographic or process-isolation security boundary.
 * - Opaque trustRoot alone is evaluation/read-only; privileged mutate/issue APIs
 *   require a separate installerCapability minted with the root.
 *
 * NOT PROVEN / NOT CLAIMED:
 * - Resistance to arbitrary same-process importers that can call the trust installer.
 * - Live GitHub provenance, real Owner key custody, OS Worker identity.
 * - MCP/persistence in-path enforcement, same-UID isolation, production R1/C24.
 */

import { createHash } from 'node:crypto';

import { parseRule02 } from './rule02Parser.js';
import {
  OPERATION_CLASSES,
  validateGovernance,
} from './governanceValidator.js';
import {
  OWNER_INSTRUCTION_PURPOSE,
  generateEphemeralOwnerInstructionKeyPair,
  getPrivilegedOwnerInstructionConstructors,
  isBrandedVerifiedOwnerInstruction,
  issueOwnerImplementationInstruction,
  safeEqualHex,
  withPrivilegedOwnerInstructionConstruction,
} from './ownerImplementationInstruction.js';

export const GATE_KIND = 'TECP_DLP011_EFFECTIVE_IMPLEMENTATION_AUTHORIZATION_GATE';
export const GATE_PURPOSE = 'TEST_ONLY';
export const GATE_SLICE_ID = 'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE';
export const GATE_OPERATION_CLASS = 'CREATE_AUTHORIZED_FOUR_PATH_DISPOSABLE_PROOF';
export const GATE_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const DISPOSABLE_TRUST_INJECTION_TOKEN = 'TECP_DLP011_DISPOSABLE_TRUST_INJECTION_V1';

export const GATE_AUTHORIZED_FILE_SCOPE = Object.freeze([
  'tecp/src/effectiveImplementationAuthorizationGate.js',
  'tecp/src/ownerImplementationInstruction.js',
  'tecp/test/disposableMergeEffectivenessHarness.js',
  'tecp/test/effectiveImplementationAuthorizationGate.test.js',
]);

export const GATE_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_INPUT: 'DENY_MISSING_INPUT',
  DENY_MISSING_TRUST_ROOT: 'DENY_MISSING_TRUST_ROOT',
  DENY_CALLER_SUPPLIED_TRUST_OBJECTS: 'DENY_CALLER_SUPPLIED_TRUST_OBJECTS',
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
  DENY_TRUST_INJECTION_REQUIRED: 'DENY_TRUST_INJECTION_REQUIRED',
});

const SOURCE_KINDS = Object.freeze({
  CANONICAL_MAIN: 'CANONICAL_MAIN',
  PINNED_MERGED_SHA_VERIFIED: 'PINNED_MERGED_SHA_VERIFIED',
  TEST_ONLY_ATTESTED: 'TEST_ONLY_ATTESTED',
});

const DEFAULT_ISSUER = 'tecp-dlp011-test-owner-issuer';
const DEFAULT_KID = 'dlp011-test-owner-ed25519-1';

const trustRootPrivate = new WeakMap();
/** installerCapability object → trustRoot */
const installerCapabilityToRoot = new WeakMap();
const installerCapabilityBrand = new WeakSet();
const gateDecisionBrand = new WeakSet();
const evaluationFenceBrand = new WeakSet();

let evaluationLock = null;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function digestText(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
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
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(s) || /privateKeyPem/i.test(s)) {
      return 'REDACTED_SENSITIVE';
    }
    if (s.length > 512) return `${s.slice(0, 512)}…`;
    return s;
  });
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

function buildProvenanceState({
  rule02Text,
  canonicalSha,
  mergedProvenance,
  activationPr,
  tipSha,
  tipDigest,
}) {
  const digest = digestText(rule02Text);
  return Object.freeze({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha,
    rule02Text,
    rule02DigestSha256: digest,
    sourceKind: SOURCE_KINDS.TEST_ONLY_ATTESTED,
    mergedProvenance: mergedProvenance === true,
    activationPr: activationPr || null,
    tipSha: tipSha || canonicalSha,
    tipDigest: tipDigest || digest,
    cryptographicAuthentication: false,
  });
}

/**
 * Privileged disposable trust-root injector (TRUST INSTALLER API).
 *
 * Returns { trustRoot, installerCapability }:
 * - trustRoot: opaque evaluation/read handle (safe for evaluate / fence / public view).
 * - installerCapability: required for issue/mutate/revoke/clock/tip APIs.
 *
 * RESIDUAL (Option A): any same-process caller that can invoke this function is a
 * disposable trust installer and can self-approve TEST_ONLY ALLOW. That class is
 * outside the proven untrusted-request boundary. Same-UID isolation is NOT sealed.
 */
export function createDisposableEffectiveAuthorizationTrustRoot(config = {}) {
  if (!isPlainObject(config)) {
    throw new TypeError('TRUST_ROOT_CONFIG_REQUIRED');
  }
  if (config.privilegedTrustInjection !== DISPOSABLE_TRUST_INJECTION_TOKEN) {
    throw new TypeError('DISPOSABLE_TRUST_INJECTION_TOKEN_REQUIRED');
  }
  // Reject attacker-supplied verification material / registries.
  if (config.keyRegistry != null
    || config.ownerInstructionVerifier != null
    || config.privateKeyPem != null
    || config.publicKeyPem != null
    || config.canonicalRule02Source != null
    || config.tipAttestation != null) {
    throw new TypeError('CALLER_SUPPLIED_TRUST_OBJECTS_FORBIDDEN');
  }

  const canonicalSha = isNonEmptyString(config.canonicalSha)
    ? config.canonicalSha
    : null;
  if (!canonicalSha) {
    throw new TypeError('CANONICAL_SHA_REQUIRED');
  }

  // Rule02 text must be injected by the disposable trust installer / harness.
  // No filesystem read in this module (frozen TECP service-skeleton invariant).
  if (!isNonEmptyString(config.disposableRule02Override)) {
    throw new TypeError('DISPOSABLE_RULE02_OVERRIDE_REQUIRED');
  }
  const rule02Text = config.disposableRule02Override;
  const mergedProvenance = config.mergedProvenance === true;
  const activationPr = isNonEmptyString(config.activationPr) ? config.activationPr : null;
  if (mergedProvenance && !activationPr) {
    throw new TypeError('ACTIVATION_PR_REQUIRED_WHEN_MERGED');
  }

  const startMs = Number.isSafeInteger(config.startMs) ? config.startMs : 1_700_000_000_000;
  const issuer = DEFAULT_ISSUER;
  const kid = DEFAULT_KID;

  const material = withPrivilegedOwnerInstructionConstruction(() => {
    const ctors = getPrivilegedOwnerInstructionConstructors();
    const keys = generateEphemeralOwnerInstructionKeyPair();
    const clock = ctors.createOwnerInstructionClock(startMs);
    const revocationRegistry = ctors.createOwnerInstructionRevocationRegistry();
    const keyRegistry = ctors.createOwnerInstructionKeyRegistry([
      {
        kid,
        issuer,
        publicKeyPem: keys.publicKeyPem,
        privateKeyPem: keys.privateKeyPem,
        algorithm: 'Ed25519',
        status: 'ACTIVE',
      },
    ]);
    const ownerInstructionVerifier = ctors.createOwnerImplementationInstructionVerifier({
      keyRegistry,
      revocationRegistry,
      clock,
      consumeOnAllow: true,
    });
    return {
      keys,
      clock,
      revocationRegistry,
      keyRegistry,
      ownerInstructionVerifier,
      issuer,
      kid,
    };
  });

  let provenance = buildProvenanceState({
    rule02Text,
    canonicalSha,
    mergedProvenance,
    activationPr,
  });

  const root = Object.freeze({
    kind: 'TECP_DLP011_DISPOSABLE_EFFECTIVE_AUTHORIZATION_TRUST_ROOT',
    testOnly: true,
    cryptographicAuthentication: false,
    sameProcessTrustInstallerResidual: true,
    productionTrustEstablished: false,
    /** Evaluation/read handle only — not sufficient for issue/mutate APIs. */
    handleClass: 'EVALUATION_READ',
  });

  const installerCapability = Object.freeze({
    kind: 'TECP_DLP011_TRUST_INSTALLER_CAPABILITY',
    testOnly: true,
    cryptographicAuthentication: false,
    handleClass: 'PRIVILEGED_INSTALLER',
  });

  trustRootPrivate.set(root, {
    material,
    getProvenance() { return provenance; },
    setProvenance(next) { provenance = next; },
  });
  installerCapabilityBrand.add(installerCapability);
  installerCapabilityToRoot.set(installerCapability, root);

  return Object.freeze({
    trustRoot: root,
    installerCapability,
  });
}

export function isDisposableEffectiveAuthorizationTrustRoot(value) {
  return trustRootPrivate.has(value);
}

export function isTrustInstallerCapability(value) {
  return installerCapabilityBrand.has(value);
}

function requirePrivate(root) {
  const priv = trustRootPrivate.get(root);
  if (!priv) {
    throw new TypeError('UNKNOWN_OR_FORGED_TRUST_ROOT');
  }
  return priv;
}

function requireInstaller(installerCapability) {
  if (!installerCapabilityBrand.has(installerCapability)) {
    throw new TypeError('TRUST_INSTALLER_CAPABILITY_REQUIRED');
  }
  const root = installerCapabilityToRoot.get(installerCapability);
  if (!root || !trustRootPrivate.has(root)) {
    throw new TypeError('INSTALLER_CAPABILITY_UNBOUND');
  }
  return { root, priv: trustRootPrivate.get(root) };
}

/**
 * Privileged: issue Owner instruction. Requires installerCapability (not trustRoot alone).
 */
export function issueOwnerInstructionFromTrustRoot(installerCapability, overrides = {}) {
  const { priv } = requireInstaller(installerCapability);
  const provenance = priv.getProvenance();
  const { material } = priv;
  return issueOwnerImplementationInstruction({
    repositoryId: GATE_REPOSITORY_ID,
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    sliceId: GATE_SLICE_ID,
    authorizedFileScope: [...GATE_AUTHORIZED_FILE_SCOPE],
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: overrides.governanceRevision,
    purpose: OWNER_INSTRUCTION_PURPOSE,
    issuer: material.issuer,
    kid: material.kid,
    ttlMs: 60_000,
    ...overrides,
    canonicalSha: overrides.canonicalSha || provenance.canonicalSha,
    rule02DigestSha256: overrides.rule02DigestSha256 || provenance.rule02DigestSha256,
  }, { keyRegistry: material.keyRegistry, clock: material.clock });
}

/**
 * Privileged: replace Rule02 provenance. Requires installerCapability.
 */
export function replaceTrustRootProvenance(installerCapability, spec) {
  const { priv } = requireInstaller(installerCapability);
  if (!isPlainObject(spec) || !isNonEmptyString(spec.rule02Text)) {
    throw new TypeError('PROVENANCE_SPEC_REQUIRED');
  }
  if (spec.privilegedTrustInjection !== DISPOSABLE_TRUST_INJECTION_TOKEN) {
    throw new TypeError('DISPOSABLE_TRUST_INJECTION_TOKEN_REQUIRED');
  }
  const current = priv.getProvenance();
  const next = buildProvenanceState({
    rule02Text: spec.rule02Text,
    canonicalSha: isNonEmptyString(spec.canonicalSha) ? spec.canonicalSha : current.canonicalSha,
    mergedProvenance: spec.mergedProvenance === true,
    activationPr: isNonEmptyString(spec.activationPr) ? spec.activationPr : current.activationPr,
    tipSha: isNonEmptyString(spec.tipSha) ? spec.tipSha : undefined,
    tipDigest: isNonEmptyString(spec.tipDigest) ? spec.tipDigest : undefined,
  });
  priv.setProvenance(next);
  return next;
}

/** Unprivileged read: public view of a trust root (no private key). */
export function getTrustRootPublicView(trustRoot) {
  const priv = requirePrivate(trustRoot);
  const provenance = priv.getProvenance();
  return Object.freeze({
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    mergedProvenance: provenance.mergedProvenance,
    tipSha: provenance.tipSha,
    tipDigest: provenance.tipDigest,
    publicKeyPem: priv.material.keys.publicKeyPem,
  });
}

/** Privileged: advance clock. */
export function advanceTrustRootClock(installerCapability, ms) {
  requireInstaller(installerCapability).priv.material.clock.advance(ms);
}

/** Privileged: revoke jti. */
export function revokeTrustRootJti(installerCapability, jti) {
  requireInstaller(installerCapability).priv.material.revocationRegistry.revokeJti(jti);
}

/** Privileged: consume jti. */
export function consumeTrustRootJti(installerCapability, jti) {
  return requireInstaller(installerCapability).priv.material.revocationRegistry.consumeJti(jti);
}

/** Privileged: install unavailable clock (fail-closed test helper). */
export function installUnavailableClockOnTrustRoot(installerCapability) {
  const { priv } = requireInstaller(installerCapability);
  withPrivilegedOwnerInstructionConstruction(() => {
    const ctors = getPrivilegedOwnerInstructionConstructors();
    const badClock = ctors.createUnavailableOwnerInstructionClock();
    const verifier = ctors.createOwnerImplementationInstructionVerifier({
      keyRegistry: priv.material.keyRegistry,
      revocationRegistry: priv.material.revocationRegistry,
      clock: badClock,
      consumeOnAllow: true,
    });
    priv.material.clock = badClock;
    priv.material.ownerInstructionVerifier = verifier;
  });
}

/** Privileged: drift tip for fence tests. */
export function driftTrustRootTip(installerCapability, { tipSha, tipDigest }) {
  const { priv } = requireInstaller(installerCapability);
  const current = priv.getProvenance();
  priv.setProvenance(Object.freeze({
    ...current,
    tipSha: isNonEmptyString(tipSha) ? tipSha : current.tipSha,
    tipDigest: isNonEmptyString(tipDigest) ? tipDigest : current.tipDigest,
  }));
}

/**
 * Sealed public factories — untrusted importers cannot brand provenance.
 */
export function createCanonicalRule02Source() {
  throw new TypeError('PUBLIC_CANONICAL_RULE02_SOURCE_CONSTRUCTION_FORBIDDEN');
}

export function createTestOnlyAttestedCanonicalRule02Source() {
  throw new TypeError('PUBLIC_CANONICAL_RULE02_SOURCE_CONSTRUCTION_FORBIDDEN');
}

export function createTrustedTipAttestation() {
  throw new TypeError('PUBLIC_TIP_ATTESTATION_CONSTRUCTION_FORBIDDEN');
}

export function isBrandedGateDecision(value) {
  return gateDecisionBrand.has(value);
}

export function isBrandedEvaluationFence(value) {
  return evaluationFenceBrand.has(value);
}

/**
 * Evaluate effective implementation authorization against an opaque trust root.
 * Caller-supplied sources/verifiers/tips/key registries are rejected.
 */
export function evaluateEffectiveImplementationAuthorization(input) {
  const lockToken = Object.create(null);
  if (evaluationLock !== null) {
    return deny(GATE_DECISIONS.DENY_CONFLICTING_AUTHORIZATION, [
      'CONCURRENT_EVALUATION_IN_PROGRESS',
    ]);
  }
  evaluationLock = lockToken;
  try {
    return evaluateUnlocked(input);
  } finally {
    if (evaluationLock === lockToken) {
      evaluationLock = null;
    }
  }
}

function evaluateUnlocked(input) {
  if (!isPlainObject(input)) {
    return deny(GATE_DECISIONS.DENY_MISSING_INPUT, ['INPUT_REQUIRED']);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'AuthorizedInvocation')
    || Object.prototype.hasOwnProperty.call(input, 'authorizedInvocation')
    || input.callerAuthorizedInvocation != null) {
    return deny(GATE_DECISIONS.DENY_CALLER_AUTHORIZED_INVOCATION, [
      'CALLER_AUTHORIZED_INVOCATION_REJECTED',
    ]);
  }

  if (input.testOnlyEnvironment !== true) {
    return deny(GATE_DECISIONS.DENY_ENVIRONMENT_NOT_TEST_ONLY, [
      'EXPLICIT_TEST_ONLY_ENVIRONMENT_REQUIRED',
    ]);
  }

  // Reject any attempt to inject trust objects beside the opaque root.
  const forbiddenTrustKeys = [
    'canonicalRule02Source',
    'ownerInstructionVerifier',
    'tipAttestation',
    'keyRegistry',
    'revocationRegistry',
    'clock',
    'privateKeyPem',
    'publicKeyPem',
    'verificationKey',
  ];
  for (const key of forbiddenTrustKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] != null) {
      return deny(GATE_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_OBJECTS, [
        `FORBIDDEN_TRUST_KEY:${key}`,
      ]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'merged')
    || Object.prototype.hasOwnProperty.call(input, 'canonical')
    || Object.prototype.hasOwnProperty.call(input, 'branchName')) {
    return deny(GATE_DECISIONS.DENY_FAKE_MERGED_FLAG, [
      'CALLER_MERGED_OR_CANONICAL_FLAG_REJECTED',
    ]);
  }

  if (!isDisposableEffectiveAuthorizationTrustRoot(input.trustRoot)) {
    return deny(GATE_DECISIONS.DENY_MISSING_TRUST_ROOT, [
      'OPAQUE_TRUST_ROOT_REQUIRED',
    ]);
  }

  const priv = trustRootPrivate.get(input.trustRoot);
  const provenance = priv.getProvenance();
  const { material } = priv;
  const verifier = material.ownerInstructionVerifier;

  if (verifier.consumeOnAllow !== true) {
    return deny(GATE_DECISIONS.DENY_NON_CONSUMING_VERIFIER, ['CONSUME_ON_ALLOW_REQUIRED']);
  }

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
    || provenance.repositoryId !== GATE_REPOSITORY_ID) {
    return deny(GATE_DECISIONS.DENY_WRONG_REPOSITORY_OR_SLICE);
  }

  if (!scopesMatch(input.authorizedFileScope, GATE_AUTHORIZED_FILE_SCOPE)
    || input.operationClass !== GATE_OPERATION_CLASS) {
    return deny(GATE_DECISIONS.DENY_WRONG_SCOPE_OR_ACTION);
  }

  // Tip freshness against private provenance (fence tests drift tip AFTER ALLOW).
  if (!safeEqualHex(provenance.tipSha, provenance.canonicalSha)) {
    return deny(GATE_DECISIONS.DENY_STALE_TIP, ['TIP_SHA_MISMATCH']);
  }
  if (!safeEqualHex(provenance.tipDigest, provenance.rule02DigestSha256)) {
    return deny(GATE_DECISIONS.DENY_STALE_TIP, ['TIP_DIGEST_MISMATCH']);
  }

  if (!safeEqualHex(provenance.canonicalSha, input.expectedCanonicalSha)) {
    return deny(GATE_DECISIONS.DENY_WRONG_CANONICAL_SHA);
  }
  if (!safeEqualHex(provenance.rule02DigestSha256, input.expectedRule02DigestSha256)) {
    return deny(GATE_DECISIONS.DENY_WRONG_RULE02_DIGEST);
  }

  let parsed;
  try {
    parsed = parseRule02(provenance.rule02Text);
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

  if (parsedSliceId !== GATE_SLICE_ID || tecpSliceId !== GATE_SLICE_ID) {
    return deny(GATE_DECISIONS.DENY_PARSED_SLICE_MISMATCH, [
      'PARSED_ACTIVE_SLICE_NOT_DLP011',
      `PARSED_SLICE:${String(parsedSliceId)}`,
      `TECP_SLICE:${String(tecpSliceId)}`,
    ]);
  }

  if (!scopesMatch(facts.authorizedFileScope, GATE_AUTHORIZED_FILE_SCOPE)) {
    return deny(GATE_DECISIONS.DENY_PARSED_SCOPE_MISMATCH, [
      'PARSED_AUTHORIZED_FILE_SCOPE_MISMATCH',
    ]);
  }

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

  if (provenance.mergedProvenance !== true) {
    return deny(GATE_DECISIONS.DENY_UNMERGED_YES_TOKEN, [
      'VALIDATOR_ALLOW_WITHOUT_TRUSTED_MERGED_PROVENANCE',
      `VALIDATOR_${validatorResult.decision}`,
    ]);
  }

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
    instructionResult = verifier.verify(input.ownerInstructionEncoded, expectation);
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

  const tip = Object.freeze({
    tipSha: provenance.tipSha,
    tipDigest: provenance.tipDigest,
  });

  const fence = Object.freeze({
    kind: 'TECP_DLP011_EVALUATION_FENCE',
    evaluationId: digestText(
      `${provenance.canonicalSha}|${provenance.rule02DigestSha256}|${instructionResult.instruction.jti}|${Date.now()}`,
    ),
    tipSha: tip.tipSha,
    tipDigest: tip.tipDigest,
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    jti: instructionResult.instruction.jti,
    standingAuthority: false,
  });
  evaluationFenceBrand.add(fence);

  const authorization = Object.freeze({
    kind: GATE_KIND,
    decision: GATE_DECISIONS.ALLOW,
    repositoryId: GATE_REPOSITORY_ID,
    sliceId: GATE_SLICE_ID,
    canonicalSha: provenance.canonicalSha,
    rule02DigestSha256: provenance.rule02DigestSha256,
    authorizedFileScope: GATE_AUTHORIZED_FILE_SCOPE,
    operationClass: GATE_OPERATION_CLASS,
    governanceRevision: parsedGovernanceRevision,
    jti: instructionResult.instruction.jti,
    fence,
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
 * Mutation-fence recheck against the trust root's current tip.
 */
export function assertMutationFenceFresh(fence, trustRoot) {
  if (!isBrandedEvaluationFence(fence)) {
    return deny(GATE_DECISIONS.DENY_TIP_DRIFT, ['FENCE_NOT_BRANDED']);
  }
  if (!isDisposableEffectiveAuthorizationTrustRoot(trustRoot)) {
    return deny(GATE_DECISIONS.DENY_PROVENANCE_UNAVAILABLE, [
      'TRUST_ROOT_REQUIRED_FOR_FENCE',
    ]);
  }
  const provenance = trustRootPrivate.get(trustRoot).getProvenance();
  if (!safeEqualHex(fence.tipSha, provenance.tipSha)
    || !safeEqualHex(fence.tipDigest, provenance.tipDigest)) {
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
  SOURCE_KINDS,
  digestText as gateDigestText,
};
