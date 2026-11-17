/**
 * TECP-OPS-PILOT-001 S2 Tier-3 Owner capability verifier (verify-only).
 *
 * Ed25519 public-key verification only. No private keys, signing, or issuance.
 * OPERATIONAL_ISSUANCE_ENABLED=false — never mints independentOwnerCapabilityLatch.
 */

import { createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync as readFsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join as pathJoin, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA,
  OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
  OPS_PILOT_LIVE_VENUE,
  OPS_PILOT_MAX_ONESHOT_TTL_MS,
  OPS_PILOT_OWNER_TRUST_KID_FILENAME,
  OPS_PILOT_OWNER_TRUST_PUBKEY_FILENAME,
  OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_TIER3_AUTHORIZED,
  normalizeApprovedSuitePath,
} from '../src/disposableOpsPilotDbHarness.js';

export const OPERATIONAL_ISSUANCE_ENABLED = false;
export const S2_OWNER_CAPABILITY_KIND = 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1';
export const S2_OWNER_CAPABILITY_PURPOSE = 'S2_WSL_LAB_OWNER_CAPABILITY_V1';
export const S2_OWNER_CAPABILITY_PURPOSE_WSL_LEGACY = S2_OWNER_CAPABILITY_PURPOSE;
export const S2_OWNER_CAPABILITY_PURPOSE_SIMIN = 'S2_SIMIN_HYPERV_LAB_OWNER_CAPABILITY_V1';
export const S2_OWNER_CAPABILITY_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const S2_OWNER_CAPABILITY_ALG = 'Ed25519';
export const S2_OWNER_CAPABILITY_ISSUER = 'titangold-owner-s2-wsl-lab';
export const S2_OWNER_CAPABILITY_ISSUER_SIMIN = 'titangold-owner-s2-simin-hyperv-lab';
export const S2_OWNER_CAPABILITY_VENUE_SIMIN = 'SIMIN_HYPERV_UBUNTU_VM_TITANGOLD_S2_LAB_ONLY';
export const S2_OWNER_INSTALLED_TRUST_DEPS_PROOF_CLASS = 'OWNER_INSTALLED_FIXED_TRUST_VERIFIER_DEPS_V1';

export const S2_TIER3_OWNER_CAPABILITY_DECISIONS = Object.freeze({
  ALLOW_VERIFY_ONLY: 'ALLOW_VERIFY_ONLY',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_UNKNOWN_KID: 'DENY_UNKNOWN_KID',
  DENY_WRONG_REPOSITORY: 'DENY_WRONG_REPOSITORY',
  DENY_WRONG_SHA: 'DENY_WRONG_SHA',
  DENY_WRONG_SUITE: 'DENY_WRONG_SUITE',
  DENY_WRONG_PURPOSE: 'DENY_WRONG_PURPOSE',
  DENY_WRONG_KIND: 'DENY_WRONG_KIND',
  DENY_WRONG_CAPABILITY_ID: 'DENY_WRONG_CAPABILITY_ID',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NBF_VIOLATION: 'DENY_NBF_VIOLATION',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_WORKER_SUPPLIED_TRUST_ANCHOR: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR',
  DENY_OPERATIONAL_ISSUANCE_DISABLED: 'DENY_OPERATIONAL_ISSUANCE_DISABLED',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_LIVE_SPAWN_INELIGIBLE: 'DENY_LIVE_SPAWN_INELIGIBLE',
  DENY_MISSING_TRUSTED_VERIFIER_DEPS: 'DENY_MISSING_TRUSTED_VERIFIER_DEPS',
  DENY_CALLER_SUPPLIED_TRUST_ANCHOR: 'DENY_CALLER_SUPPLIED_TRUST_ANCHOR',
  DENY_WRONG_VENUE: 'DENY_WRONG_VENUE',
  DENY_LEGACY_WSL_PURPOSE_FOR_SIMIN: 'DENY_LEGACY_WSL_PURPOSE_FOR_SIMIN',
  DENY_OWNER_TRUST_REGISTRY_MISSING: 'DENY_OWNER_TRUST_REGISTRY_MISSING',
  ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB: 'ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB',
});

const CLAIM_KEY_ORDER_LEGACY_WSL = Object.freeze([
  'alg',
  'capabilityId',
  'exp',
  'iss',
  'jti',
  'kid',
  'kind',
  'nbf',
  'pinnedMainSha',
  'purpose',
  'repositoryId',
  'suitePath',
]);
const CLAIM_KEY_ORDER_SIMIN = Object.freeze([
  'alg',
  'capabilityId',
  'exp',
  'iss',
  'jti',
  'kid',
  'kind',
  'nbf',
  'pinnedMainSha',
  'purpose',
  'repositoryId',
  'suitePath',
  'venue',
]);
const CLAIM_KEY_ORDER = CLAIM_KEY_ORDER_LEGACY_WSL;

const __testKeyRegistry = new Map();
const __testReplayRegistry = new Set();
const __testRevokedRegistry = new Set();
let __testRevocationAvailable = true;
/** Brands TEST_ONLY verifier deps objects. Never operational trust. */
const testOnlyVerifierDepsLatch = new WeakSet();
/** Brands Owner-installed fixed-path trust deps. Not request-supplied. */
const ownerInstalledTrustDepsLatch = new WeakSet();
/**
 * Module-private provenance for crypto-verified capability result objects.
 * Only successful verifyS2Tier3OwnerCapabilityArtifact may add entries.
 * Plain/frozen/copied caller objects cannot forge membership.
 */
const verifierIssuedProvenanceLatch = new WeakSet();
const verifierIssuedProvenanceMeta = new WeakMap();

export const S2_OWNER_CAPABILITY_TEST_ONLY_DEPS_PROOF_CLASS =
  'TEST_ONLY_S2_OWNER_CAPABILITY_VERIFIER_DEPS';

const VERIFIER_MODULE_PATH = fileURLToPath(import.meta.url);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    claims: null,
    operationalIssuanceEnabled: OPERATIONAL_ISSUANCE_ENABLED,
    governanceMergeBaseSha: OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA,
    ...extra,
  });
}

function allow(claims, reasons = [], trustMeta = {}) {
  const trustClass = trustMeta.trustClass === 'OWNER_INSTALLED'
    ? 'OWNER_INSTALLED'
    : (trustMeta.trustClass === 'TEST_ONLY' ? 'TEST_ONLY' : null);
  if (trustClass == null) {
    throw new TypeError('VERIFIER_TRUST_CLASS_REQUIRED_FOR_PROVENANCE');
  }
  const result = Object.freeze({
    ok: true,
    allowed: true,
    decision: S2_TIER3_OWNER_CAPABILITY_DECISIONS.ALLOW_VERIFY_ONLY,
    reasons: Object.freeze([...reasons, 'VERIFY_ONLY_NOT_LIVE_AUTHORITY']),
    claims: Object.freeze({ ...claims }),
    operationalIssuanceEnabled: OPERATIONAL_ISSUANCE_ENABLED,
    governanceMergeBaseSha: OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA,
    liveSpawnEligible: false,
    ownerCustodyProven: false,
    recoveryAdminProven: false,
    // Public marker is non-authoritative; WeakSet membership is authoritative.
    provenanceProofClass: 'VERIFIER_ISSUED_CAPABILITY_PROVENANCE_V1',
  });
  verifierIssuedProvenanceLatch.add(result);
  verifierIssuedProvenanceMeta.set(result, Object.freeze({
    trustClass,
    authorizesLiveSubprocess: trustClass === 'OWNER_INSTALLED',
  }));
  return result;
}

export function isVerifierIssuedCapabilityProvenance(value) {
  return value != null
    && typeof value === 'object'
    && verifierIssuedProvenanceLatch.has(value);
}

export function getVerifierIssuedCapabilityTrustClass(value) {
  if (!isVerifierIssuedCapabilityProvenance(value)) return null;
  return verifierIssuedProvenanceMeta.get(value)?.trustClass || null;
}

export function verifierIssuedCapabilityAuthorizesLiveSubprocess(value) {
  if (!isVerifierIssuedCapabilityProvenance(value)) return false;
  return verifierIssuedProvenanceMeta.get(value)?.authorizesLiveSubprocess === true;
}

function b64urlDecode(text) {
  try {
    return Buffer.from(String(text), 'base64url');
  } catch {
    return null;
  }
}

function canonicalJson(value, keyOrder = CLAIM_KEY_ORDER_LEGACY_WSL) {
  const parts = [];
  for (const key of keyOrder) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(`MISSING_CLAIM:${key}`);
    }
    const claimVal = value[key];
    if (typeof claimVal === 'string') {
      parts.push(`"${key}":"${claimVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } else if (typeof claimVal === 'number') {
      parts.push(`"${key}":${claimVal}`);
    } else {
      throw new TypeError(`UNSUPPORTED_CLAIM_TYPE:${key}`);
    }
  }
  return `{${parts.join(',')}}`;
}

function claimKeyOrderForPurpose(purpose) {
  if (purpose === S2_OWNER_CAPABILITY_PURPOSE_SIMIN) return CLAIM_KEY_ORDER_SIMIN;
  return CLAIM_KEY_ORDER_LEGACY_WSL;
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    if (!isPlainObject(value)) return { ok: false, reason: 'NOT_OBJECT' };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: String(err.message || err) };
  }
}

function isExplicitTestOnlyVerifierDeps(deps = {}) {
  return deps != null
    && typeof deps === 'object'
    && deps.proofClass === S2_OWNER_CAPABILITY_TEST_ONLY_DEPS_PROOF_CLASS
    && deps.__testMode === true
    && testOnlyVerifierDepsLatch.has(deps);
}

function isOwnerInstalledTrustVerifierDeps(deps = {}) {
  return deps != null
    && typeof deps === 'object'
    && deps.proofClass === S2_OWNER_INSTALLED_TRUST_DEPS_PROOF_CLASS
    && deps.__ownerInstalledTrust === true
    && ownerInstalledTrustDepsLatch.has(deps);
}

function isTrustedVerifierDeps(deps = {}) {
  return isExplicitTestOnlyVerifierDeps(deps) || isOwnerInstalledTrustVerifierDeps(deps);
}

function rejectCallerTrustAnchorsInDeps(deps = {}) {
  if (!isPlainObject(deps)) return null;
  if (deps.trustAnchor || deps.publicKey || deps.verifier || deps.verifyKey
    || deps.ownerPublicKeyPem || deps.callerPublicKey) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_ANCHOR, [
      'CALLER_TRUST_ANCHOR_IN_DEPS_FORBIDDEN',
    ]);
  }
  return null;
}

function resolveKeyRegistry(deps = {}) {
  if (!isTrustedVerifierDeps(deps)) {
    return null;
  }
  if (deps.keyRegistry && typeof deps.keyRegistry.get === 'function') {
    return deps.keyRegistry;
  }
  return {
    get(kid) {
      return __testKeyRegistry.get(kid) || null;
    },
  };
}

function resolveClock(deps = {}) {
  if (!isTrustedVerifierDeps(deps)) {
    return null;
  }
  if (deps.clock && typeof deps.clock.nowMs === 'function') {
    return deps.clock;
  }
  if (isSafeInteger(deps.nowMs)) {
    return { nowMs: () => deps.nowMs };
  }
  return { nowMs: () => Date.now() };
}

function resolveRevocation(deps = {}) {
  if (!isTrustedVerifierDeps(deps)) {
    return null;
  }
  if (deps.revocationRegistry) {
    return deps.revocationRegistry;
  }
  return {
    isRevoked(jti) {
      if (!__testRevocationAvailable) {
        return { ok: false, unavailable: true };
      }
      return { ok: true, revoked: __testRevokedRegistry.has(jti) };
    },
  };
}

function resolveReplay(deps = {}) {
  if (!isTrustedVerifierDeps(deps)) {
    return null;
  }
  if (deps.replayRegistry) {
    return deps.replayRegistry;
  }
  return {
    has(jti) {
      return __testReplayRegistry.has(jti);
    },
    record(jti) {
      __testReplayRegistry.add(jti);
    },
  };
}

function validateClaimShape(claims, expectation = {}) {
  if (claims.alg !== S2_OWNER_CAPABILITY_ALG) return 'UNSUPPORTED_ALGORITHM';
  if (claims.kind !== S2_OWNER_CAPABILITY_KIND) return 'WRONG_KIND';
  if (claims.repositoryId !== S2_OWNER_CAPABILITY_REPOSITORY_ID) return 'WRONG_REPOSITORY';
  const expectPurpose = expectation.purpose || null;
  if (expectPurpose === S2_OWNER_CAPABILITY_PURPOSE_SIMIN) {
    if (claims.purpose === S2_OWNER_CAPABILITY_PURPOSE_WSL_LEGACY) {
      return 'LEGACY_WSL_PURPOSE_FOR_SIMIN';
    }
    if (claims.purpose !== S2_OWNER_CAPABILITY_PURPOSE_SIMIN) return 'WRONG_PURPOSE';
    if (claims.iss !== S2_OWNER_CAPABILITY_ISSUER_SIMIN) return 'MALFORMED';
    if (claims.venue !== S2_OWNER_CAPABILITY_VENUE_SIMIN) return 'WRONG_VENUE';
    if (expectation.venue && expectation.venue !== claims.venue) return 'WRONG_VENUE';
    if (!/^[0-9a-f]{40}$/.test(String(claims.pinnedMainSha || ''))) return 'WRONG_SHA';
    if (expectation.pinnedMainSha && claims.pinnedMainSha !== expectation.pinnedMainSha) {
      return 'WRONG_SHA';
    }
    if (expectation.forbidOfflinePinAsLiveSha === true
      && claims.pinnedMainSha === OPS_PILOT_PINNED_MAIN_SHA) {
      return 'WRONG_SHA';
    }
  } else {
    if (claims.pinnedMainSha !== OPS_PILOT_PINNED_MAIN_SHA) return 'WRONG_SHA';
    if (claims.purpose !== S2_OWNER_CAPABILITY_PURPOSE) return 'WRONG_PURPOSE';
    if (claims.iss !== S2_OWNER_CAPABILITY_ISSUER) return 'MALFORMED';
  }
  const suite = normalizeApprovedSuitePath(claims.suitePath);
  if (!suite) return 'WRONG_SUITE';
  if (expectation.suitePath && expectation.suitePath !== suite) return 'WRONG_SUITE';
  if (!isNonEmptyString(claims.capabilityId)) return 'WRONG_CAPABILITY_ID';
  if (!isNonEmptyString(claims.kid) || !isNonEmptyString(claims.jti) || !isNonEmptyString(claims.iss)) {
    return 'MALFORMED';
  }
  if (!isSafeInteger(claims.nbf) || !isSafeInteger(claims.exp)) return 'MALFORMED';
  if (claims.exp <= claims.nbf) return 'MALFORMED';
  if (claims.exp - claims.nbf > OPS_PILOT_MAX_ONESHOT_TTL_MS) return 'EXCESSIVE_TTL';
  if (expectation.capabilityId && expectation.capabilityId !== claims.capabilityId) {
    return 'WRONG_CAPABILITY_ID';
  }
  return null;
}

/**
 * Verify-only Ed25519 Owner capability artifact (payloadB64.sigB64).
 */
export function verifyS2Tier3OwnerCapabilityArtifact(token, expectation = {}, deps = {}) {
  if (token == null) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['TOKEN_REQUIRED']);
  }
  if (isPlainObject(token)
    && (token.trustAnchor || token.publicKey || token.verifier || token.verifyKey)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'TRUST_ANCHOR_IN_PAYLOAD_FORBIDDEN',
    ]);
  }
  if (isPlainObject(expectation)
    && (expectation.trustAnchor || expectation.publicKey || expectation.verifier)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'TRUST_ANCHOR_IN_EXPECTATION_FORBIDDEN',
    ]);
  }

  const depsTrustDeny = rejectCallerTrustAnchorsInDeps(deps);
  if (depsTrustDeny) return depsTrustDeny;

  // Branded TEST_ONLY or Owner-installed fixed-trust deps only. Fail closed otherwise.
  if (!isTrustedVerifierDeps(deps)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MISSING_TRUSTED_VERIFIER_DEPS, [
      'TRUSTED_OR_TEST_ONLY_VERIFIER_DEPS_REQUIRED',
      'NO_IMPLICIT_TEST_MODE',
      'NO_REQUEST_SUPPLIED_TRUST_ANCHOR',
    ]);
  }

  if (!isNonEmptyString(token) || !token.includes('.')) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, ['TOKEN_FORMAT']);
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, ['TOKEN_PARTS']);
  }
  const [payloadB64, sigB64] = parts;
  const payloadBuf = b64urlDecode(payloadB64);
  const sigBuf = b64urlDecode(sigB64);
  if (!payloadBuf || !sigBuf) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  }
  const payloadText = payloadBuf.toString('utf8');
  const parsed = parseJsonObject(payloadText);
  if (!parsed.ok) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, [parsed.reason]);
  }
  const claims = parsed.value;
  const keyOrder = claimKeyOrderForPurpose(claims.purpose);
  let canonical;
  try {
    canonical = canonicalJson(claims, keyOrder);
  } catch (err) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, [String(err.message || err)]);
  }
  if (canonical !== payloadText) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED, ['PAYLOAD_NOT_CANONICAL']);
  }

  const shapeErr = validateClaimShape(claims, expectation);
  if (shapeErr) {
    const map = {
      UNSUPPORTED_ALGORITHM: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM,
      WRONG_REPOSITORY: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_REPOSITORY,
      WRONG_SHA: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_SHA,
      WRONG_SUITE: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_SUITE,
      WRONG_PURPOSE: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_PURPOSE,
      WRONG_KIND: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_KIND,
      WRONG_CAPABILITY_ID: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_CAPABILITY_ID,
      EXCESSIVE_TTL: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL,
      WRONG_VENUE: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_VENUE,
      LEGACY_WSL_PURPOSE_FOR_SIMIN: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LEGACY_WSL_PURPOSE_FOR_SIMIN,
    };
    const decision = map[shapeErr] || S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MALFORMED;
    return deny(decision, [shapeErr]);
  }

  const keyRegistry = resolveKeyRegistry(deps);
  if (!keyRegistry) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_UNKNOWN_KID, ['KEY_REGISTRY_REQUIRED']);
  }
  const pub = keyRegistry.get(claims.kid);
  if (!pub) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_UNKNOWN_KID, [`KID:${claims.kid}`]);
  }

  const clock = resolveClock(deps);
  if (!clock || typeof clock.nowMs !== 'function') {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MISSING_TRUSTED_VERIFIER_DEPS, [
      'CLOCK_REQUIRED',
    ]);
  }
  const nowMs = clock.nowMs();
  if (nowMs < claims.nbf) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_NBF_VIOLATION, ['NOT_YET_VALID']);
  }
  if (nowMs >= claims.exp) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_EXPIRED, ['EXPIRED']);
  }

  const revocation = resolveRevocation(deps);
  if (!revocation) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, [
      'REVOCATION_REGISTRY_REQUIRED',
    ]);
  }
  const rev = typeof revocation.isRevoked === 'function'
    ? revocation.isRevoked(claims.jti)
    : { ok: false, unavailable: true };
  if (rev.unavailable === true || rev.ok === false) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, [
      'REVOCATION_EVIDENCE_UNAVAILABLE',
    ]);
  }
  if (rev.revoked === true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REVOKED, [`JTI:${claims.jti}`]);
  }

  const replay = resolveReplay(deps);
  if (!replay || typeof replay.has !== 'function') {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, [
      'REPLAY_REGISTRY_REQUIRED',
    ]);
  }
  if (replay.has(claims.jti)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY, [`JTI:${claims.jti}`]);
  }

  let publicKey;
  try {
    publicKey = createPublicKey(pub);
  } catch (err) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_UNKNOWN_KID, [
      String(err.message || err),
    ]);
  }

  const valid = verify(null, Buffer.from(canonical, 'utf8'), publicKey, sigBuf);
  if (!valid) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE, ['SIG_VERIFY_FAILED']);
  }

  if (OPERATIONAL_ISSUANCE_ENABLED !== false) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_OPERATIONAL_ISSUANCE_DISABLED, [
      'ISSUANCE_DISABLED',
    ]);
  }

  if (replay && typeof replay.record === 'function') {
    replay.record(claims.jti);
  }

  const trustClass = isOwnerInstalledTrustVerifierDeps(deps)
    ? 'OWNER_INSTALLED'
    : (isExplicitTestOnlyVerifierDeps(deps) ? 'TEST_ONLY' : null);
  if (trustClass == null) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MISSING_TRUSTED_VERIFIER_DEPS, [
      'TRUST_CLASS_UNRESOLVED',
    ]);
  }
  return allow({
    ...claims,
    suitePath: normalizeApprovedSuitePath(claims.suitePath),
  }, ['SIGNATURE_VALID', 'CLAIMS_VALID'], { trustClass });
}

/**
 * Live spawn eligibility from verified capability only (always DENY in offline slice).
 */
export function evaluateVerifiedCapabilityLiveSpawnEligibility(verified = {}, context = {}) {
  if (!verified || verified.ok !== true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'VERIFIED_CAPABILITY_REQUIRED',
    ], { liveSpawnEligible: false });
  }
  if (context.ohsaCustodyClaimed === true || context.claimOhsaIndependentCustody === true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'OHSA_INDEPENDENT_CUSTODY_NOT_AUTHORIZED',
    ], { liveSpawnEligible: false, ohsaClaim: 'NOT_PROVEN' });
  }
  if (context.ownerCustodyProven === true || context.recoveryAdminProven === true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'CALLER_CUSTODY_OR_RECOVERY_BOOLEAN_FORBIDDEN',
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
    });
  }
  if (context.custodyClass !== OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'FUNCTIONAL_LAB_CUSTODY_CLASS_REQUIRED',
      'OWNER_CUSTODY_NOT_PROVEN',
      'RECOVERY_ADMIN_NOT_PROVEN',
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
    });
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== false || OPS_PILOT_TIER3_AUTHORIZED !== false) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
    ], { liveSpawnEligible: false });
  }
  if (verified.claims?.purpose !== S2_OWNER_CAPABILITY_PURPOSE_SIMIN) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'SIMIN_PURPOSE_REQUIRED_FOR_LIVE_ELIGIBILITY',
    ], { liveSpawnEligible: false });
  }
  if (verified.claims?.venue !== S2_OWNER_CAPABILITY_VENUE_SIMIN) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_VENUE, [
      'SIMIN_VENUE_REQUIRED',
    ], { liveSpawnEligible: false });
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: S2_TIER3_OWNER_CAPABILITY_DECISIONS.ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB,
    reasons: Object.freeze([
      'VERIFIED_SIMIN_CAPABILITY',
      'FUNCTIONAL_LAB_CUSTODY_CLASS_ACCEPTED',
      'MODULE_CONSTS_REMAIN_FALSE',
      'OHSA_NOT_PROVEN',
      'RECOVERY_ADMIN_NOT_PROVEN',
      'VERIFY_ONLY_PLUS_LAB_POLICY_NOT_STANDING_AUTHORITY',
    ]),
    liveSpawnEligible: true,
    ownerCustodyProven: false,
    recoveryAdminProven: false,
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    claims: verified.claims,
  });
}

export function resolveOwnerInstalledFixedTrustRegistryPath(home = undefined) {
  // Caller-supplied home is ignored for trust resolution authority. Always use OS homedir().
  if (home != null && home !== homedir()) {
    // Non-authoritative path preview only — createOwnerInstalled rejects overrides before latch.
  }
  const trustedHome = homedir();
  const dir = pathJoin(trustedHome, OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR);
  return Object.freeze({
    dir,
    pubkeyPath: pathJoin(dir, OPS_PILOT_OWNER_TRUST_PUBKEY_FILENAME),
    kidPath: pathJoin(dir, OPS_PILOT_OWNER_TRUST_KID_FILENAME),
  });
}

export function createOwnerInstalledFixedTrustVerifierDeps(options = {}) {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_ANCHOR, [
      'OWNER_INSTALLED_DEPS_OPTIONS_OBJECT_REQUIRED',
    ]);
  }
  const forbiddenOverrides = [
    'home',
    'trustHome',
    'publicKey',
    'pubkeyPem',
    'kid',
    'keyRegistry',
    'pubkeyPath',
    'kidPath',
    'dir',
    'trustRegistryPaths',
  ];
  for (const key of forbiddenOverrides) {
    if (options[key] != null) {
      return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_CALLER_SUPPLIED_TRUST_ANCHOR, [
        'CALLER_TRUST_HOME_OR_KEY_OVERRIDE_FORBIDDEN',
        `FORBIDDEN_OPTION=${key}`,
      ]);
    }
  }
  // Runtime trust directory is always the Owner-local homedir registry — never request-driven.
  const paths = resolveOwnerInstalledFixedTrustRegistryPath();
  if (!existsSync(paths.pubkeyPath) || !existsSync(paths.kidPath)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_OWNER_TRUST_REGISTRY_MISSING, [
      'OWNER_INSTALLED_PUBKEY_OR_KID_MISSING',
      `PUBKEY=${paths.pubkeyPath}`,
      `KID=${paths.kidPath}`,
    ], {
      liveSpawnEligible: false,
      paths,
    });
  }
  let pubkeyPem;
  let kid;
  try {
    pubkeyPem = readFsSync(paths.pubkeyPath, 'utf8');
    kid = readFsSync(paths.kidPath, 'utf8').trim();
  } catch (err) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_OWNER_TRUST_REGISTRY_MISSING, [
      'OWNER_TRUST_REGISTRY_UNREADABLE',
      String(err.message || err),
    ], { paths });
  }
  if (!isNonEmptyString(pubkeyPem) || !isNonEmptyString(kid)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_OWNER_TRUST_REGISTRY_MISSING, [
      'OWNER_TRUST_REGISTRY_EMPTY',
    ], { paths });
  }
  if (/BEGIN .*PRIVATE KEY/i.test(pubkeyPem)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_OWNER_TRUST_REGISTRY_MISSING, [
      'PRIVATE_KEY_MATERIAL_FORBIDDEN_IN_TRUST_REGISTRY',
    ], { paths });
  }
  const keyRegistry = {
    get(queryKid) {
      return queryKid === kid ? pubkeyPem : null;
    },
  };
  const replay = new Set();
  const revoked = new Set();
  const deps = {
    proofClass: S2_OWNER_INSTALLED_TRUST_DEPS_PROOF_CLASS,
    __ownerInstalledTrust: true,
    nowMs: options.nowMs,
    clock: options.clock || { nowMs: () => Date.now() },
    keyRegistry,
    revocationRegistry: {
      isRevoked(jti) {
        return { ok: true, revoked: revoked.has(jti) };
      },
    },
    replayRegistry: {
      has(jti) { return replay.has(jti); },
      record(jti) { replay.add(jti); },
    },
    trustRegistryPaths: paths,
    installedKid: kid,
  };
  ownerInstalledTrustDepsLatch.add(deps);
  return deps;
}

export function isOwnerInstalledFixedTrustVerifierDeps(deps) {
  return isOwnerInstalledTrustVerifierDeps(deps);
}

export function getVerifierImportSideEffectsReport() {
  // Static import-time attestation only — NOT measured runtime telemetry.
  return Object.freeze({
    kind: 'IMPORT_TIME_STATIC_ATTESTATION_NOT_MEASURED_RUNTIME_EVIDENCE',
    filesystemActions: 0,
    processSpawnActions: 0,
    databaseActions: 0,
    networkActions: 0,
    postgresActions: 0,
  });
}

/** TEST_ONLY registry helpers — no signing exports. Not operational trust. */
export function __testOnlyResetS2Tier3OwnerCapabilityRegistries() {
  __testKeyRegistry.clear();
  __testReplayRegistry.clear();
  __testRevokedRegistry.clear();
  __testRevocationAvailable = true;
}

export function __testOnlyRegisterOwnerPublicKeyForVerification(kid, publicKeyPem) {
  __testKeyRegistry.set(String(kid), publicKeyPem);
}

export function __testOnlyRegisterReplayJti(jti) {
  __testReplayRegistry.add(String(jti));
}

export function __testOnlyRegisterRevokedJti(jti) {
  __testRevokedRegistry.add(String(jti));
}

export function __testOnlySetRevocationRegistryUnavailable(unavailable = true) {
  __testRevocationAvailable = unavailable !== true;
}

/**
 * Create branded TEST_ONLY verifier deps for isolated test invocation.
 * Plain {__testMode:true} objects are NOT accepted.
 */
export function __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps(options = {}) {
  const deps = {
    proofClass: S2_OWNER_CAPABILITY_TEST_ONLY_DEPS_PROOF_CLASS,
    __testMode: true,
    nowMs: options.nowMs,
    clock: options.clock,
    keyRegistry: options.keyRegistry,
    revocationRegistry: options.revocationRegistry,
    replayRegistry: options.replayRegistry,
  };
  testOnlyVerifierDepsLatch.add(deps);
  return deps;
}

export function isTestOnlyS2Tier3OwnerCapabilityVerifierDeps(deps) {
  return isExplicitTestOnlyVerifierDeps(deps);
}


export function isDirectVerifierCliEntrypoint(argv = process.argv, metaUrl = import.meta.url) {
  if (!Array.isArray(argv) || argv.length < 2) return false;
  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(String(argv[1]));
  } catch {
    return false;
  }
}

export function runS2Tier3OwnerCapabilityVerifierCli(argv = process.argv, deps = {}) {
  const token = argv[2] || '';
  // CLI never enables test mode implicitly. Absent trusted deps => fail closed.
  return verifyS2Tier3OwnerCapabilityArtifact(token, {}, deps || {});
}

if (isDirectVerifierCliEntrypoint()) {
  const result = runS2Tier3OwnerCapabilityVerifierCli(process.argv, {});
  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    decision: result.decision,
    reasons: result.reasons,
    operationalIssuanceEnabled: OPERATIONAL_ISSUANCE_ENABLED,
    approvedSuites: OPS_PILOT_APPROVED_TEST_ACTIONS,
    testModeEnabled: false,
  })}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

void basename;