/**
 * TECP-DLP-010 — Option C local writer sidecar IPC protocol (TEST_ONLY / NON_OPERATIONAL).
 *
 * Narrow Unix-domain framing only. No TCP. No credentials. No privileged object transfer.
 * Caller-supplied objects over IPC are never trusted process-local dependencies.
 */

export const IPC_PROTOCOL_VERSION = 1;

export const IPC_PROTOCOL_KIND = 'TECP_DLP010_LOCAL_WRITER_IPC';

/** Hard upper bound on a single framed message (bytes). */
export const IPC_MAX_FRAME_BYTES = 64 * 1024;

/** Bound on JSON nesting / string size checks during parse. */
export const IPC_MAX_JSON_CHARS = IPC_MAX_FRAME_BYTES;

export const IPC_OPS = Object.freeze({
  HELLO: 'HELLO',
  BIND: 'BIND',
  RELEASE: 'RELEASE',
  SHUTDOWN: 'SHUTDOWN',
  PING: 'PING',
  /** Adversarial / rejected if presented — never an allowed request op. */
  GET_WRITER_CREDENTIAL: 'GET_WRITER_CREDENTIAL',
  GET_WRITER_CLIENT: 'GET_WRITER_CLIENT',
  EXECUTE_SQL: 'EXECUTE_SQL',
  INSTALL_POLICY: 'INSTALL_POLICY',
  INJECT_DEPS: 'INJECT_DEPS',
});

export const IPC_ALLOWED_REQUEST_OPS = Object.freeze([
  IPC_OPS.HELLO,
  IPC_OPS.BIND,
  IPC_OPS.RELEASE,
  IPC_OPS.SHUTDOWN,
  IPC_OPS.PING,
]);

export const IPC_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_INVALID_FRAME: 'DENY_INVALID_FRAME',
  DENY_OVERSIZED_FRAME: 'DENY_OVERSIZED_FRAME',
  DENY_TRUNCATED_FRAME: 'DENY_TRUNCATED_FRAME',
  DENY_UNKNOWN_OP: 'DENY_UNKNOWN_OP',
  DENY_PROTOCOL_VERSION: 'DENY_PROTOCOL_VERSION',
  DENY_MALFORMED_MESSAGE: 'DENY_MALFORMED_MESSAGE',
  DENY_FORBIDDEN_FIELD: 'DENY_FORBIDDEN_FIELD',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_UNAUTHENTICATED_WRITE: 'DENY_UNAUTHENTICATED_WRITE',
  DENY_UNAUTHENTICATED_SHUTDOWN: 'DENY_UNAUTHENTICATED_SHUTDOWN',
  DENY_PRIVILEGED_OBJECT: 'DENY_PRIVILEGED_OBJECT',
  DENY_SERIALIZED_INVOCATION: 'DENY_SERIALIZED_INVOCATION',
  DENY_TIMEOUT: 'DENY_TIMEOUT',
  DENY_DISCONNECT: 'DENY_DISCONNECT',
  DENY_SIDECAR_UNAVAILABLE: 'DENY_SIDECAR_UNAVAILABLE',
  DENY_OPERATION: 'DENY_OPERATION',
  DENY_SOCKET_OWNERSHIP: 'DENY_SOCKET_OWNERSHIP',
  DENY_SOCKET_PERMISSIONS: 'DENY_SOCKET_PERMISSIONS',
  DENY_KEEPALIVE_REQUIRED: 'DENY_KEEPALIVE_REQUIRED',
});

/** Fields that must never appear on an untrusted IPC request body. */
export const IPC_FORBIDDEN_BODY_FIELDS = Object.freeze([
  'password',
  'writerPassword',
  'writerClient',
  'client',
  'connectionConfig',
  'connectionString',
  'sql',
  'rawSql',
  'query',
  'policy',
  'policyProvider',
  'capabilityDeps',
  'getVerifiedPrincipal',
  'principal',
  'leaseSnapshotReader',
  'leaseReader',
  'authorizedInvocation',
  'invocation',
  'priorInvocation',
  'deps',
  'privateKeyPem',
  'secret',
  'secrets',
  'bootstrap',
  'trustRoot',
  'adapter',
  'gateway',
  'transaction',
  'executeSql',
]);

const BIND_RELEASE_BODY_FIELDS = Object.freeze([
  'capabilityToken',
  'operationKey',
  'idempotency',
]);

const SHUTDOWN_BODY_FIELDS = Object.freeze([
  'shutdownToken',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = [decision]) {
  return Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...reasons]),
  });
}

/**
 * Encode one IPC message as a length-prefixed UTF-8 JSON frame.
 * @param {object} message
 * @returns {Buffer}
 */
export function encodeIpcFrame(message) {
  if (!isPlainObject(message)) {
    throw new TypeError('IPC message must be a plain object');
  }
  const json = JSON.stringify(message);
  if (typeof json !== 'string' || json.length > IPC_MAX_JSON_CHARS) {
    const err = new Error(IPC_DECISIONS.DENY_OVERSIZED_FRAME);
    err.code = IPC_DECISIONS.DENY_OVERSIZED_FRAME;
    throw err;
  }
  const payload = Buffer.from(json, 'utf8');
  if (payload.length > IPC_MAX_FRAME_BYTES) {
    const err = new Error(IPC_DECISIONS.DENY_OVERSIZED_FRAME);
    err.code = IPC_DECISIONS.DENY_OVERSIZED_FRAME;
    throw err;
  }
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

/**
 * Incremental length-prefixed frame reader.
 */
export function createIpcFrameReader(options = {}) {
  const maxFrameBytes = options.maxFrameBytes || IPC_MAX_FRAME_BYTES;
  let buffer = Buffer.alloc(0);
  let closed = false;

  function push(chunk) {
    if (closed) {
      return { frames: [], error: deny(IPC_DECISIONS.DENY_DISCONNECT) };
    }
    if (!Buffer.isBuffer(chunk)) {
      closed = true;
      return { frames: [], error: deny(IPC_DECISIONS.DENY_INVALID_FRAME, ['CHUNK_NOT_BUFFER']) };
    }
    if (chunk.length === 0) {
      return { frames: [], error: null };
    }
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > maxFrameBytes + 4) {
      closed = true;
      buffer = Buffer.alloc(0);
      return {
        frames: [],
        error: deny(IPC_DECISIONS.DENY_OVERSIZED_FRAME, ['READER_BUFFER_EXCEEDED']),
      };
    }
    const frames = [];
    while (buffer.length >= 4) {
      const size = buffer.readUInt32BE(0);
      if (!Number.isSafeInteger(size) || size < 2 || size > maxFrameBytes) {
        closed = true;
        buffer = Buffer.alloc(0);
        return {
          frames: [],
          error: deny(IPC_DECISIONS.DENY_OVERSIZED_FRAME, ['INVALID_FRAME_LENGTH']),
        };
      }
      if (buffer.length < 4 + size) {
        break;
      }
      const payload = buffer.subarray(4, 4 + size);
      buffer = buffer.subarray(4 + size);
      let parsed;
      try {
        const text = payload.toString('utf8');
        if (text.length > IPC_MAX_JSON_CHARS) {
          closed = true;
          return {
            frames: [],
            error: deny(IPC_DECISIONS.DENY_OVERSIZED_FRAME, ['JSON_TOO_LARGE']),
          };
        }
        parsed = JSON.parse(text);
      } catch {
        closed = true;
        return {
          frames: [],
          error: deny(IPC_DECISIONS.DENY_INVALID_FRAME, ['JSON_PARSE_FAILED']),
        };
      }
      frames.push(parsed);
    }
    return { frames, error: null };
  }

  function markTruncated() {
    if (closed) return deny(IPC_DECISIONS.DENY_DISCONNECT);
    if (buffer.length > 0) {
      closed = true;
      buffer = Buffer.alloc(0);
      return deny(IPC_DECISIONS.DENY_TRUNCATED_FRAME, ['CONNECTION_CLOSED_MID_FRAME']);
    }
    closed = true;
    return null;
  }

  function reset() {
    buffer = Buffer.alloc(0);
    closed = false;
  }

  return Object.freeze({ push, markTruncated, reset });
}

/**
 * Validate a decoded request envelope. Does not authorize the operation.
 */
export function validateIpcRequest(message) {
  if (!isPlainObject(message)) {
    return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['REQUEST_NOT_OBJECT']);
  }
  if (message.v !== IPC_PROTOCOL_VERSION) {
    return deny(IPC_DECISIONS.DENY_PROTOCOL_VERSION, ['UNSUPPORTED_PROTOCOL_VERSION']);
  }
  if (message.kind !== IPC_PROTOCOL_KIND) {
    return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['KIND_MISMATCH']);
  }
  if (!isNonEmptyString(message.op)) {
    return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['OP_REQUIRED']);
  }
  if (!IPC_ALLOWED_REQUEST_OPS.includes(message.op)) {
    return deny(IPC_DECISIONS.DENY_UNKNOWN_OP, [`UNKNOWN_OR_FORBIDDEN_OP:${message.op}`]);
  }
  if (!isNonEmptyString(message.requestId) || message.requestId.length > 128) {
    return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['REQUEST_ID_REQUIRED']);
  }
  if (!isPlainObject(message.body)) {
    return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['BODY_REQUIRED']);
  }

  for (const key of Object.keys(message.body)) {
    if (IPC_FORBIDDEN_BODY_FIELDS.includes(key)) {
      return deny(IPC_DECISIONS.DENY_FORBIDDEN_FIELD, [`FORBIDDEN_FIELD:${key}`]);
    }
  }

  // Reject serialized AuthorizedInvocation / branded-lookalike authority envelopes.
  if (Object.prototype.hasOwnProperty.call(message, 'authorizedInvocation')
    || Object.prototype.hasOwnProperty.call(message, 'invocation')
    || Object.prototype.hasOwnProperty.call(message, 'principal')
    || Object.prototype.hasOwnProperty.call(message, 'policyProvider')
    || Object.prototype.hasOwnProperty.call(message, 'capabilityDeps')
    || Object.prototype.hasOwnProperty.call(message, 'deps')) {
    return deny(IPC_DECISIONS.DENY_SERIALIZED_INVOCATION, ['ENVELOPE_AUTHORITY_FORBIDDEN']);
  }

  if (message.op === IPC_OPS.BIND || message.op === IPC_OPS.RELEASE) {
    for (const key of Object.keys(message.body)) {
      if (!BIND_RELEASE_BODY_FIELDS.includes(key)) {
        return deny(IPC_DECISIONS.DENY_FORBIDDEN_FIELD, [`UNKNOWN_BODY_FIELD:${key}`]);
      }
    }
    if (!isNonEmptyString(message.body.capabilityToken)) {
      return deny(IPC_DECISIONS.DENY_UNAUTHENTICATED_WRITE, ['CAPABILITY_TOKEN_REQUIRED']);
    }
    if (!isNonEmptyString(message.body.operationKey)) {
      return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['OPERATION_KEY_REQUIRED']);
    }
    if (message.body.idempotency !== undefined && !isPlainObject(message.body.idempotency)) {
      return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['IDEMPOTENCY_NOT_OBJECT']);
    }
  } else if (message.op === IPC_OPS.SHUTDOWN) {
    for (const key of Object.keys(message.body)) {
      if (!SHUTDOWN_BODY_FIELDS.includes(key)) {
        return deny(IPC_DECISIONS.DENY_FORBIDDEN_FIELD, [`UNKNOWN_BODY_FIELD:${key}`]);
      }
    }
    // Presence-shaped only here; authentic token match is enforced inside the sidecar.
    if (!isNonEmptyString(message.body.shutdownToken) || message.body.shutdownToken.length < 32) {
      return deny(IPC_DECISIONS.DENY_UNAUTHENTICATED_SHUTDOWN, ['SHUTDOWN_TOKEN_REQUIRED']);
    }
  } else if (message.op === IPC_OPS.HELLO || message.op === IPC_OPS.PING) {
    if (Object.keys(message.body).length > 0) {
      return deny(IPC_DECISIONS.DENY_FORBIDDEN_FIELD, ['EMPTY_BODY_REQUIRED']);
    }
  }

  return Object.freeze({
    ok: true,
    decision: IPC_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    request: Object.freeze({
      v: message.v,
      kind: message.kind,
      op: message.op,
      requestId: message.requestId,
      body: Object.freeze({ ...message.body }),
    }),
  });
}

/**
 * Build a canonical request envelope.
 */
export function buildIpcRequest(op, requestId, body = {}) {
  return Object.freeze({
    v: IPC_PROTOCOL_VERSION,
    kind: IPC_PROTOCOL_KIND,
    op,
    requestId,
    body: isPlainObject(body) ? { ...body } : {},
  });
}

/**
 * Build a response envelope. Never includes secrets.
 */
export function buildIpcResponse(requestId, result) {
  const safe = sanitizeIpcResult(result);
  return Object.freeze({
    v: IPC_PROTOCOL_VERSION,
    kind: IPC_PROTOCOL_KIND,
    type: 'RESPONSE',
    requestId,
    result: safe,
  });
}

const SENSITIVE_KEY_RE = /password|secret|private|credential|writerClient|connectionString|pem|tokenRaw|bootstrap/i;

/**
 * Strip privileged / sensitive material from results before IPC return.
 */
export function sanitizeIpcResult(value, depth = 0) {
  if (depth > 12) return '[TRUNCATED]';
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (typeof value.query === 'function' || typeof value.connect === 'function') {
    return '[REDACTED_CLIENT]';
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sanitizeIpcResult(entry, depth + 1)));
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizeIpcResult(child, depth + 1);
  }
  return Object.freeze(out);
}

/**
 * Process-local replay tracker for requestId values.
 */
export function createRequestReplayGuard(options = {}) {
  const maxEntries = options.maxEntries || 4096;
  const seen = new Set();

  function observe(requestId) {
    if (!isNonEmptyString(requestId)) {
      return deny(IPC_DECISIONS.DENY_MALFORMED_MESSAGE, ['REQUEST_ID_REQUIRED']);
    }
    if (seen.has(requestId)) {
      return deny(IPC_DECISIONS.DENY_REPLAY, ['REQUEST_ID_REPLAY']);
    }
    if (seen.size >= maxEntries) {
      // Fail closed rather than silently forgetting history.
      return deny(IPC_DECISIONS.DENY_REPLAY, ['REPLAY_GUARD_CAPACITY']);
    }
    seen.add(requestId);
    return Object.freeze({ ok: true, decision: IPC_DECISIONS.ALLOW, reasons: Object.freeze([]) });
  }

  function clear() {
    seen.clear();
  }

  return Object.freeze({ observe, clear, size: () => seen.size });
}

export const IPC_PUBLIC_API = Object.freeze([
  'IPC_PROTOCOL_VERSION',
  'IPC_PROTOCOL_KIND',
  'IPC_MAX_FRAME_BYTES',
  'IPC_OPS',
  'IPC_ALLOWED_REQUEST_OPS',
  'IPC_DECISIONS',
  'IPC_FORBIDDEN_BODY_FIELDS',
  'encodeIpcFrame',
  'createIpcFrameReader',
  'validateIpcRequest',
  'buildIpcRequest',
  'buildIpcResponse',
  'sanitizeIpcResult',
  'createRequestReplayGuard',
  'IPC_PUBLIC_API',
]);
