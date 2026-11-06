/**
 * TECP-OPS-PILOT-001 CP1 offline configuration and shared encoding helpers.
 * TEST_ONLY / NON_OPERATIONAL. Zero import-time side effects.
 */

export const CP1_MODE = Object.freeze({
  TEST_ONLY: 'TEST_ONLY',
});

export const CP1_PURPOSE = 'TEST_ONLY';

export const CP1_ALG = 'Ed25519';

export const CP1_SLICE_ID = 'TECP-OPS-PILOT-001-CONTROLLED-ONE-TO-FIVE-CURSOR';

export const CP1_CHECKPOINT = 'CP1_WORKER_IDENTITY_CAPABILITY_OWNER_APPROVAL';

export const CP1_REPOSITORY_ID = 'sepehrraeisi/TitanGold';

/** Exact eleven CP1 candidate paths from Rule02 TECP_OPS_PILOT_001_CP1_FILE_SCOPE. */
export const CP1_PATHS = Object.freeze([
  'tecp-ops/package.json',
  'tecp-ops/package-lock.json',
  'tecp-ops/README.md',
  'tecp-ops/src/config.js',
  'tecp-ops/src/operationalWorkerIdentity.js',
  'tecp-ops/src/operationalCapabilityIssuer.js',
  'tecp-ops/src/ownerApprovalArtifact.js',
  'tecp-ops/src/index.js',
  'tecp-ops/test/operationalWorkerIdentity.test.js',
  'tecp-ops/test/operationalCapabilityIssuer.test.js',
  'tecp-ops/test/ownerApprovalArtifact.test.js',
]);

export const CP1_OPERATION_CLASS = Object.freeze({
  CP1_OFFLINE_SECURITY_CONTRACT: 'CP1_OFFLINE_SECURITY_CONTRACT',
});

/** Maximum credential / approval lifetime for CP1 offline proofs (5 minutes). */
export const CP1_MAX_TTL_MS = 5 * 60 * 1000;

export const CP1_CONFIG = Object.freeze({
  mode: CP1_MODE.TEST_ONLY,
  purpose: CP1_PURPOSE,
  alg: CP1_ALG,
  sliceId: CP1_SLICE_ID,
  checkpoint: CP1_CHECKPOINT,
  repositoryId: CP1_REPOSITORY_ID,
  paths: CP1_PATHS,
  maxTtlMs: CP1_MAX_TTL_MS,
  proofClass: 'OFFLINE_NON_OPERATIONAL',
  sameUidSealed: false,
  realOwnerKeyCustody: false,
  liveGithubProvenance: false,
  operationalMcpAuthorized: false,
  productionAuthorized: false,
});

export const CONFIG_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_MODE: 'DENY_MISSING_MODE',
  DENY_UNSUPPORTED_MODE: 'DENY_UNSUPPORTED_MODE',
  DENY_RUNTIME_OR_PRODUCTION_MODE: 'DENY_RUNTIME_OR_PRODUCTION_MODE',
  DENY_MALFORMED_CONFIG: 'DENY_MALFORMED_CONFIG',
  DENY_MISSING_TRUST_CONFIG: 'DENY_MISSING_TRUST_CONFIG',
  DENY_SCOPE_EXPANSION: 'DENY_SCOPE_EXPANSION',
  DENY_PATH_TRAVERSAL: 'DENY_PATH_TRAVERSAL',
  DENY_WILDCARD_SCOPE: 'DENY_WILDCARD_SCOPE',
  DENY_WRONG_RESOURCE: 'DENY_WRONG_RESOURCE',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Fail-closed offline mode gate. Rejects runtime/production/missing modes.
 */
export function validateOfflineTestOnlyConfig(config) {
  if (config == null) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_MISSING_MODE,
      reasons: Object.freeze(['CONFIG_REQUIRED']),
    });
  }
  if (!isPlainObject(config)) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_MALFORMED_CONFIG,
      reasons: Object.freeze(['CONFIG_MUST_BE_OBJECT']),
    });
  }
  if (!Object.prototype.hasOwnProperty.call(config, 'mode')) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_MISSING_MODE,
      reasons: Object.freeze(['MODE_REQUIRED']),
    });
  }
  const mode = config.mode;
  if (mode === 'RUNTIME' || mode === 'PRODUCTION' || mode === 'OPERATIONAL') {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_RUNTIME_OR_PRODUCTION_MODE,
      reasons: Object.freeze([`FORBIDDEN_MODE:${mode}`]),
    });
  }
  if (mode !== CP1_MODE.TEST_ONLY) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_UNSUPPORTED_MODE,
      reasons: Object.freeze([`UNSUPPORTED_MODE:${String(mode)}`]),
    });
  }
  if (config.trustConfig == null || !isPlainObject(config.trustConfig)) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_MISSING_TRUST_CONFIG,
      reasons: Object.freeze(['TRUST_CONFIG_REQUIRED']),
    });
  }
  if (!isNonEmptyString(config.trustConfig.issuerId) || !isNonEmptyString(config.trustConfig.kid)) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_MISSING_TRUST_CONFIG,
      reasons: Object.freeze(['ISSUER_OR_KID_REQUIRED']),
    });
  }
  return Object.freeze({
    ok: true,
    decision: CONFIG_DECISIONS.ALLOW,
    reasons: Object.freeze(['TEST_ONLY_CONFIG_OK']),
  });
}

/**
 * Exact-path allowlist check against CP1_PATHS. No wildcards, no traversal, no broadening.
 */
export function validateExactCp1Scope(resourcePaths) {
  if (!Array.isArray(resourcePaths) || resourcePaths.length === 0) {
    return Object.freeze({
      ok: false,
      decision: CONFIG_DECISIONS.DENY_WRONG_RESOURCE,
      reasons: Object.freeze(['RESOURCE_PATHS_REQUIRED']),
    });
  }
  const seen = new Set();
  for (const path of resourcePaths) {
    if (!isNonEmptyString(path)) {
      return Object.freeze({
        ok: false,
        decision: CONFIG_DECISIONS.DENY_WRONG_RESOURCE,
        reasons: Object.freeze(['PATH_MUST_BE_NONEMPTY_STRING']),
      });
    }
    if (path.includes('*') || path.includes('?')) {
      return Object.freeze({
        ok: false,
        decision: CONFIG_DECISIONS.DENY_WILDCARD_SCOPE,
        reasons: Object.freeze([`WILDCARD_FORBIDDEN:${path}`]),
      });
    }
    if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
      return Object.freeze({
        ok: false,
        decision: CONFIG_DECISIONS.DENY_PATH_TRAVERSAL,
        reasons: Object.freeze([`TRAVERSAL_FORBIDDEN:${path}`]),
      });
    }
    if (!CP1_PATHS.includes(path)) {
      return Object.freeze({
        ok: false,
        decision: CONFIG_DECISIONS.DENY_SCOPE_EXPANSION,
        reasons: Object.freeze([`PATH_NOT_IN_CP1_ALLOWLIST:${path}`]),
      });
    }
    if (seen.has(path)) {
      return Object.freeze({
        ok: false,
        decision: CONFIG_DECISIONS.DENY_WRONG_RESOURCE,
        reasons: Object.freeze([`DUPLICATE_PATH:${path}`]),
      });
    }
    seen.add(path);
  }
  return Object.freeze({
    ok: true,
    decision: CONFIG_DECISIONS.ALLOW,
    reasons: Object.freeze(['SCOPE_EXACT']),
    paths: Object.freeze([...resourcePaths]),
  });
}

/** Deterministic canonical JSON (sorted keys, no whitespace). */
export function canonicalJson(value) {
  return canonicalize(value);
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError('NONCANONICAL_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new TypeError('FORBIDDEN_KEY');
      }
    }
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${parts.join(',')}}`;
  }
  throw new TypeError('UNSUPPORTED_JSON_TYPE');
}

export function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function b64urlDecode(text) {
  if (!isNonEmptyString(text) || text.includes('=') || text.includes('+') || text.includes('/')) {
    return null;
  }
  try {
    return Buffer.from(text, 'base64url');
  } catch {
    return null;
  }
}

/**
 * Parse JSON object text rejecting duplicate keys (JSON.parse last-wins is forbidden).
 */
export function parseJsonObjectRejectDuplicates(text) {
  if (!isNonEmptyString(text)) {
    return { ok: false, reason: 'EMPTY_JSON' };
  }
  // Fast structural reject for non-objects.
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return { ok: false, reason: 'NOT_OBJECT' };
  }
  const keys = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let expectingKey = false;
  let keyStart = -1;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        if (expectingKey && depth === 1 && keyStart >= 0) {
          const raw = trimmed.slice(keyStart, i);
          try {
            keys.push(JSON.parse(`"${raw}"`));
          } catch {
            return { ok: false, reason: 'BAD_KEY_ESCAPE' };
          }
          expectingKey = false;
          keyStart = -1;
        }
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      if (depth === 1 && (expectingKey || trimmed[i - 1] === '{' || trimmed[i - 1] === ',')) {
        // Detect key position: after { or , at depth 1, next string is a key.
        let j = i - 1;
        while (j >= 0 && /\s/.test(trimmed[j])) j -= 1;
        if (trimmed[j] === '{' || trimmed[j] === ',') {
          expectingKey = true;
          keyStart = i + 1;
        }
      }
      continue;
    }
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;
  }
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) {
      return { ok: false, reason: `DUPLICATE_KEY:${key}` };
    }
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return { ok: false, reason: `FORBIDDEN_KEY:${key}` };
    }
    seen.add(key);
  }
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: 'JSON_PARSE_ERROR' };
  }
  if (!isPlainObject(value)) {
    return { ok: false, reason: 'NOT_OBJECT' };
  }
  return { ok: true, value };
}

export function isPlainObjectExport(value) {
  return isPlainObject(value);
}

export function isNonEmptyStringExport(value) {
  return isNonEmptyString(value);
}
