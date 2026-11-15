/**
 * TECP-OPS-PILOT-001 S2 Tier-3 Owner capability verifier (verify-only).
 *
 * Ed25519 public-key verification only. No private keys, signing, or issuance.
 * OPERATIONAL_ISSUANCE_ENABLED=false — never mints independentOwnerCapabilityLatch.
 */

import { createPublicKey, verify } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA,
  OPS_PILOT_MAX_ONESHOT_TTL_MS,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_TIER3_AUTHORIZED,
  normalizeApprovedSuitePath,
} from '../src/disposableOpsPilotDbHarness.js';

export const OPERATIONAL_ISSUANCE_ENABLED = false;
export const S2_OWNER_CAPABILITY_KIND = 'TECP_OPS_S2_TIER3_OWNER_CAPABILITY_V1';
export const S2_OWNER_CAPABILITY_PURPOSE = 'S2_WSL_LAB_OWNER_CAPABILITY_V1';
export const S2_OWNER_CAPABILITY_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const S2_OWNER_CAPABILITY_ALG = 'Ed25519';
export const S2_OWNER_CAPABILITY_ISSUER = 'titangold-owner-s2-wsl-lab';

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
});

const CLAIM_KEY_ORDER = Object.freeze([
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

const __testKeyRegistry = new Map();
const __testReplayRegistry = new Set();
const __testRevokedRegistry = new Set();
let __testRevocationAvailable = true;
/** Brands TEST_ONLY verifier deps objects. Never operational trust. */
const testOnlyVerifierDepsLatch = new WeakSet();

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

function allow(claims, reasons = []) {
  return Object.freeze({
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
  });
}

function b64urlDecode(text) {
  try {
    return Buffer.from(String(text), 'base64url');
  } catch {
    return null;
  }
}

function canonicalJson(value) {
  const parts = [];
  for (const key of CLAIM_KEY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(`MISSING_CLAIM:${key}`);
    }
    const v = value[key];
    if (typeof v === 'string') {
      parts.push(`"${key}":"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } else if (typeof v === 'number') {
      parts.push(`"${key}":${v}`);
    } else {
      throw new TypeError(`UNSUPPORTED_CLAIM_TYPE:${key}`);
    }
  }
  return `{${parts.join(',')}}`;
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
  if (!isExplicitTestOnlyVerifierDeps(deps)) {
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
  if (!isExplicitTestOnlyVerifierDeps(deps)) {
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
  if (!isExplicitTestOnlyVerifierDeps(deps)) {
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
  if (!isExplicitTestOnlyVerifierDeps(deps)) {
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
  if (claims.pinnedMainSha !== OPS_PILOT_PINNED_MAIN_SHA) return 'WRONG_SHA';
  if (claims.purpose !== S2_OWNER_CAPABILITY_PURPOSE) return 'WRONG_PURPOSE';
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
  if (claims.iss !== S2_OWNER_CAPABILITY_ISSUER) return 'MALFORMED';
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

  // Only explicitly branded TEST_ONLY verifier deps may proceed in this offline slice.
  // Missing trusted configuration fails closed (no implicit __testMode).
  if (!isExplicitTestOnlyVerifierDeps(deps)) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_MISSING_TRUSTED_VERIFIER_DEPS, [
      'TRUSTED_OR_TEST_ONLY_VERIFIER_DEPS_REQUIRED',
      'NO_IMPLICIT_TEST_MODE',
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
  let canonical;
  try {
    canonical = canonicalJson(claims);
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

  return allow({
    ...claims,
    suitePath: normalizeApprovedSuitePath(claims.suitePath),
  }, ['SIGNATURE_VALID', 'CLAIMS_VALID']);
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
  if (context.ownerCustodyProven !== true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'OWNER_CUSTODY_NOT_PROVEN',
    ], { liveSpawnEligible: false, ownerCustodyProven: false });
  }
  if (context.recoveryAdminProven !== true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'RECOVERY_ADMIN_NOT_PROVEN',
    ], { liveSpawnEligible: false, recoveryAdminProven: false });
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true || OPS_PILOT_TIER3_AUTHORIZED === true) {
    return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
      'DB_OR_TIER3_GATE_CLOSED',
      'OFFLINE_IMPLEMENTATION',
    ], { liveSpawnEligible: false });
  }
  return deny(S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_LIVE_SPAWN_INELIGIBLE, [
    'LIVE_SPAWN_NOT_AUTHORIZED_IN_OFFLINE_SLICE',
  ], { liveSpawnEligible: false });
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