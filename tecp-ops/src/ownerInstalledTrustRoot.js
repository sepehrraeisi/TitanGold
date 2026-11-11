/**
 * TECP-OPS-PILOT-001 S2 — Owner-installed trust-root boundary.
 *
 * Gate B: OFFLINE / TEST_ONLY / NON_OPERATIONAL.
 * Process-local installation does NOT prove Owner identity or OS key custody.
 * Real operational Owner trust-root installation is NOT_OPERATIONALLY_ACTIVATED.
 */

import { createPublicKey, generateKeyPairSync } from 'node:crypto';

export const TRUST_ROOT_PROOF_CLASS = 'OFFLINE_NON_OPERATIONAL_OWNER_TRUST_ROOT';
export const TRUST_ROOT_KIND = 'TECP_OPS_OWNER_INSTALLED_TRUST_ROOT_V1';
export const TRUST_ROOT_AUDIENCE = 'TECP_OPS_OPERATIONAL_RLA';

export const TRUST_ROOT_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_MISSING_FIELDS: 'DENY_MISSING_FIELDS',
  DENY_INVALID_PUBLIC_KEY: 'DENY_INVALID_PUBLIC_KEY',
  DENY_WORKER_SUPPLIED_REGISTRY: 'DENY_WORKER_SUPPLIED_REGISTRY',
  DENY_UNPRIVILEGED_INSTALLER: 'DENY_UNPRIVILEGED_INSTALLER',
  DENY_REVOKED_KID: 'DENY_REVOKED_KID',
  DENY_UNKNOWN_KID: 'DENY_UNKNOWN_KID',
  DENY_WRONG_ISSUER: 'DENY_WRONG_ISSUER',
  DENY_WRONG_AUDIENCE: 'DENY_WRONG_AUDIENCE',
  DENY_WRONG_GOVERNANCE_REVISION: 'DENY_WRONG_GOVERNANCE_REVISION',
  DENY_PRIVATE_KEY_EMBEDDED: 'DENY_PRIVATE_KEY_EMBEDDED',
  DENY_ENV_OR_FS_SECRET_LOAD: 'DENY_ENV_OR_FS_SECRET_LOAD',
  DENY_OPERATIONAL_INSTALLER_INACTIVE: 'DENY_OPERATIONAL_INSTALLER_INACTIVE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

const privilegedTestInstallerLatch = new WeakSet();
const brandedTrustRootLatch = new WeakSet();
const brandedLookupHandleLatch = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = []) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    trustRoot: null,
    classification: TRUST_ROOT_PROOF_CLASS,
    operationalOwnerCustodyProven: false,
  });
}

function allow(extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: TRUST_ROOT_DECISIONS.ALLOW,
    reasons: Object.freeze([...(extra.reasons || ['TRUST_ROOT_INSTALLED_TEST_ONLY'])]),
    classification: TRUST_ROOT_PROOF_CLASS,
    operationalOwnerCustodyProven: false,
    ...extra,
  });
}

function rejectSecretSmuggling(bag, label) {
  if (!isPlainObject(bag)) return null;
  for (const key of [
    'privateKey',
    'privateKeyPem',
    'secret',
    'DATABASE_URL',
    'env',
    'fsPath',
    'filePath',
    'credentialPath',
  ]) {
    if (Object.prototype.hasOwnProperty.call(bag, key)) {
      return `${label}:${key}`;
    }
  }
  return null;
}

export function generateEphemeralTrustRootKeyPairForTests() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
}

/**
 * Privileged offline TEST_ONLY installer. Import alone is not installation authority.
 * Does NOT prove real Owner key custody.
 */
export function createTestOnlyOwnerTrustRootInstaller() {
  const installer = Object.freeze({
    kind: 'TEST_ONLY_OWNER_TRUST_ROOT_INSTALLER',
    proofClass: TRUST_ROOT_PROOF_CLASS,
    operationalOwnerCustodyProven: false,
    install(input = {}) {
      return installFromPrivilegedContext(input, 'TEST_ONLY');
    },
  });
  privilegedTestInstallerLatch.add(installer);
  return installer;
}

export function isPrivilegedTestOnlyOwnerTrustRootInstaller(value) {
  return value !== null && typeof value === 'object' && privilegedTestInstallerLatch.has(value);
}

/**
 * Operational Owner installer surface — intentionally inactive in Gate B.
 */
export function createOperationalOwnerTrustRootInstaller() {
  return Object.freeze({
    kind: 'OPERATIONAL_OWNER_TRUST_ROOT_INSTALLER',
    status: 'NOT_OPERATIONALLY_ACTIVATED',
    proofClass: TRUST_ROOT_PROOF_CLASS,
    operationalOwnerCustodyProven: false,
    install(_input = {}) {
      return deny(TRUST_ROOT_DECISIONS.DENY_OPERATIONAL_INSTALLER_INACTIVE, [
        'NOT_OPERATIONALLY_ACTIVATED',
        'GATE_B_FORBIDS_REAL_OWNER_TRUST_ROOT_INSTALL',
      ]);
    },
  });
}

function installFromPrivilegedContext(input, mode) {
  if (!isPlainObject(input)) {
    return deny(TRUST_ROOT_DECISIONS.DENY_MALFORMED, ['INPUT_OBJECT_REQUIRED']);
  }
  const smuggled = rejectSecretSmuggling(input, 'INSTALL_INPUT');
  if (smuggled) {
    if (String(smuggled).includes('privateKey') || String(smuggled).includes('secret')) {
      return deny(TRUST_ROOT_DECISIONS.DENY_PRIVATE_KEY_EMBEDDED, [smuggled]);
    }
    return deny(TRUST_ROOT_DECISIONS.DENY_ENV_OR_FS_SECRET_LOAD, [smuggled]);
  }
  if (input.workerSuppliedRegistry != null || input.callerRegistry != null) {
    return deny(TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY, [
      'WORKER_OR_CALLER_REGISTRY_FORBIDDEN',
    ]);
  }

  const {
    issuerId,
    kid,
    audience = TRUST_ROOT_AUDIENCE,
    governanceRevision,
    publicKeyPem,
  } = input;

  if (!isNonEmptyString(issuerId)
    || !isNonEmptyString(kid)
    || !isNonEmptyString(audience)
    || !isNonEmptyString(governanceRevision)
    || !isNonEmptyString(publicKeyPem)) {
    return deny(TRUST_ROOT_DECISIONS.DENY_MISSING_FIELDS, [
      'ISSUER_KID_AUDIENCE_GOVERNANCE_PUBLICKEY_REQUIRED',
    ]);
  }

  let publicKey;
  try {
    publicKey = createPublicKey(publicKeyPem);
  } catch {
    return deny(TRUST_ROOT_DECISIONS.DENY_INVALID_PUBLIC_KEY, ['PUBLIC_KEY_PARSE_FAILED']);
  }

  const entries = new Map();
  const revokedKids = new Set();
  entries.set(kid, Object.freeze({
    issuerId,
    kid,
    audience,
    governanceRevision,
    publicKey,
    publicKeyPem,
  }));

  const trustRoot = {
    kind: TRUST_ROOT_KIND,
    mode,
    proofClass: TRUST_ROOT_PROOF_CLASS,
    operationalOwnerCustodyProven: false,
    issuerId,
    audience,
    governanceRevision,
    lookup(query = {}) {
      if (!isPlainObject(query)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_MALFORMED, ['LOOKUP_OBJECT_REQUIRED']);
      }
      if (query.workerSuppliedRegistry != null || query.callerRegistry != null) {
        return deny(TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY, [
          'LOOKUP_WORKER_REGISTRY_FORBIDDEN',
        ]);
      }
      const qKid = query.kid;
      if (!isNonEmptyString(qKid)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_MISSING_FIELDS, ['KID_REQUIRED']);
      }
      if (revokedKids.has(qKid)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_REVOKED_KID, [`REVOKED_KID:${qKid}`]);
      }
      const entry = entries.get(qKid);
      if (!entry) {
        return deny(TRUST_ROOT_DECISIONS.DENY_UNKNOWN_KID, [`UNKNOWN_KID:${qKid}`]);
      }
      if (isNonEmptyString(query.issuerId) && query.issuerId !== entry.issuerId) {
        return deny(TRUST_ROOT_DECISIONS.DENY_WRONG_ISSUER, ['ISSUER_MISMATCH']);
      }
      if (isNonEmptyString(query.audience) && query.audience !== entry.audience) {
        return deny(TRUST_ROOT_DECISIONS.DENY_WRONG_AUDIENCE, ['AUDIENCE_MISMATCH']);
      }
      if (
        isNonEmptyString(query.governanceRevision)
        && query.governanceRevision !== entry.governanceRevision
      ) {
        return deny(TRUST_ROOT_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION, [
          'GOVERNANCE_REVISION_MISMATCH',
        ]);
      }
      return allow({
        reasons: ['TRUST_ROOT_LOOKUP_ALLOW'],
        entry: Object.freeze({ ...entry }),
        trustRoot: null,
      });
    },
    revokeKid(targetKid) {
      if (!isNonEmptyString(targetKid)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_MISSING_FIELDS, ['KID_REQUIRED']);
      }
      revokedKids.add(targetKid);
      return allow({ reasons: ['KID_REVOKED'], trustRoot: null });
    },
    rotatePublicKey(next = {}) {
      if (!isPlainObject(next)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_MALFORMED, ['ROTATION_OBJECT_REQUIRED']);
      }
      const smuggledRotation = rejectSecretSmuggling(next, 'ROTATION');
      if (smuggledRotation) {
        return deny(TRUST_ROOT_DECISIONS.DENY_PRIVATE_KEY_EMBEDDED, [smuggledRotation]);
      }
      if (!isNonEmptyString(next.kid) || !isNonEmptyString(next.publicKeyPem)) {
        return deny(TRUST_ROOT_DECISIONS.DENY_MISSING_FIELDS, ['ROTATION_KID_PUBLICKEY_REQUIRED']);
      }
      let nextKey;
      try {
        nextKey = createPublicKey(next.publicKeyPem);
      } catch {
        return deny(TRUST_ROOT_DECISIONS.DENY_INVALID_PUBLIC_KEY, ['ROTATION_PUBLIC_KEY_PARSE']);
      }
      if (isNonEmptyString(next.retireKid)) {
        revokedKids.add(next.retireKid);
      }
      entries.set(next.kid, Object.freeze({
        issuerId: next.issuerId || issuerId,
        kid: next.kid,
        audience: next.audience || audience,
        governanceRevision: next.governanceRevision || governanceRevision,
        publicKey: nextKey,
        publicKeyPem: next.publicKeyPem,
      }));
      return allow({ reasons: ['TRUST_ROOT_ROTATED'], trustRoot: null });
    },
  };

  Object.freeze(trustRoot);
  brandedTrustRootLatch.add(trustRoot);

  const handle = Object.freeze({
    kind: 'TRUST_ROOT_LOOKUP_HANDLE',
    proofClass: TRUST_ROOT_PROOF_CLASS,
    trustRoot,
  });
  brandedLookupHandleLatch.add(handle);

  return allow({
    trustRoot,
    handle,
    reasons: mode === 'TEST_ONLY'
      ? ['TEST_ONLY_TRUST_ROOT_INSTALLED', 'NOT_OWNER_CUSTODY_PROOF']
      : ['TRUST_ROOT_INSTALLED'],
  });
}

export function isBrandedOwnerInstalledTrustRoot(value) {
  return value !== null && typeof value === 'object' && brandedTrustRootLatch.has(value);
}

/**
 * Reject arbitrary registries supplied inside Worker/dispatcher requests.
 */
export function rejectCallerSuppliedTrustRegistry(request = {}) {
  if (!isPlainObject(request)) {
    return deny(TRUST_ROOT_DECISIONS.DENY_MALFORMED, ['REQUEST_OBJECT_REQUIRED']);
  }
  if (
    request.trustRoot != null
    && !isBrandedOwnerInstalledTrustRoot(request.trustRoot)
  ) {
    return deny(TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY, [
      'UNBRANDED_OR_CALLER_TRUST_ROOT',
    ]);
  }
  if (
    request.keyRegistry != null
    || request.workerSuppliedRegistry != null
    || request.callerRegistry != null
    || request.publicKeyPem != null
  ) {
    return deny(TRUST_ROOT_DECISIONS.DENY_WORKER_SUPPLIED_REGISTRY, [
      'CALLER_REGISTRY_OR_KEY_FORBIDDEN',
    ]);
  }
  return allow({ reasons: ['NO_CALLER_TRUST_REGISTRY'], trustRoot: null });
}
