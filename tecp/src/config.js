export const TECP_SLICE_ID = 'TECP-003-SERVICE-SKELETON';
export const TECP_SERVICE_NAME = 'tecp';
export const TECP_CONTRACT_VERSION = 'tecp-service-skeleton-1.0.0';

export const CANONICAL_CONFIG_KEYS = Object.freeze([
  'serviceName',
  'sliceId',
  'environment',
  'persistence',
  'outboundNetwork',
]);

const SECRET_KEY = /token|secret|password|credential|authorization|apikey|api_key|privatekey|private_key/i;
const NETWORK_KEY = /url|host|endpoint|webhook|proxy|socket/i;

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(code, message) {
  const error = new Error(message);
  error.name = 'TecpConfigError';
  error.code = code;
  return error;
}

export function createCanonicalConfig() {
  return Object.freeze({
    serviceName: TECP_SERVICE_NAME,
    sliceId: TECP_SLICE_ID,
    environment: 'local',
    persistence: 'none',
    outboundNetwork: false,
  });
}

export function validateConfig(input) {
  if (!isPlainObject(input)) {
    throw fail('CONFIG_NOT_OBJECT', 'TECP config must be a plain object');
  }

  const keys = Object.keys(input);
  for (const key of keys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw fail('CONFIG_FORBIDDEN_KEY', `TECP config rejects key ${key}`);
    }
    if (SECRET_KEY.test(key)) {
      throw fail('CONFIG_SECRET_FORBIDDEN', `TECP config rejects secret-bearing key ${key}`);
    }
    if (NETWORK_KEY.test(key)) {
      throw fail('CONFIG_NETWORK_FORBIDDEN', `TECP config rejects network key ${key}`);
    }
  }

  const unknown = keys.filter((key) => !CANONICAL_CONFIG_KEYS.includes(key));
  if (unknown.length > 0) {
    throw fail('CONFIG_UNKNOWN_FIELD', `TECP config rejects unknown fields: ${unknown.join(',')}`);
  }

  const missing = CANONICAL_CONFIG_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(input, key));
  if (missing.length > 0) {
    throw fail('CONFIG_MISSING_FIELD', `TECP config missing fields: ${missing.join(',')}`);
  }

  if (input.serviceName !== TECP_SERVICE_NAME) {
    throw fail('CONFIG_SERVICE_NAME', 'TECP serviceName must be tecp');
  }
  if (input.sliceId !== TECP_SLICE_ID) {
    throw fail('CONFIG_SLICE_ID', 'TECP sliceId must be TECP-003-SERVICE-SKELETON');
  }
  if (input.environment !== 'local') {
    throw fail('CONFIG_ENVIRONMENT', 'TECP environment must be local');
  }
  if (input.persistence !== 'none') {
    throw fail('CONFIG_PERSISTENCE', 'TECP persistence must be none');
  }
  if (input.outboundNetwork !== false) {
    throw fail('CONFIG_OUTBOUND_NETWORK', 'TECP outboundNetwork must be false');
  }

  return Object.freeze({
    serviceName: input.serviceName,
    sliceId: input.sliceId,
    environment: input.environment,
    persistence: input.persistence,
    outboundNetwork: input.outboundNetwork,
  });
}
