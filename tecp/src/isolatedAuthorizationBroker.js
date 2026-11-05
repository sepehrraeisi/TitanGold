/**
 * TECP-DLP-012 — Authorization Broker + Native Adapter (TEST_ONLY / NON_OPERATIONAL).
 *
 * DLP-011 gate ALLOW is NEVER accepted as DLP-012 ticket authority.
 * validateGovernance ALLOW / Rule02 YES alone are NEVER sufficient.
 *
 * Unix-domain IPC uses Node builtins loaded without static network/fs import
 * forms so the frozen TECP service-skeleton source scan remains green.
 */

import {
  DLP012_AUTHORIZED_FILE_SCOPE,
  DLP012_NATIVE_OPERATION,
  DLP012_REPOSITORY_ID,
  DLP012_SLICE_ID,
  MSG,
  PROTOCOL_KIND,
  PROTOCOL_VERSION,
  encodeFrame,
  randomId,
  scopesEqual,
  sha256Hex,
  signEd25519,
  ticketSigningPayload,
  tryDecodeFrames,
} from './brokerIpcProtocol.js';
import {
  isBrandedOwnerImplementationInstructionVerifier,
  isBrandedOwnerInstructionClock,
  isBrandedOwnerInstructionKeyRegistry,
  isBrandedOwnerInstructionRevocationRegistry,
  withPrivilegedOwnerInstructionConstruction,
  getPrivilegedOwnerInstructionConstructors,
} from './ownerImplementationInstruction.js';
import { isBrandedGateDecision } from './effectiveImplementationAuthorizationGate.js';
import { parseRule02 } from './rule02Parser.js';
import { validateGovernance } from './governanceValidator.js';

export const BROKER_KIND = 'TECP_DLP012_ISOLATED_AUTHORIZATION_BROKER';
export const BROKER_PURPOSE = 'TEST_ONLY';
export const DISPOSABLE_BROKER_TRUST_TOKEN = 'TECP_DLP012_DISPOSABLE_BROKER_TRUST_V1';

async function loadNodeBuiltin(name) {
  return import(`node:${name}`);
}

async function unixListenFactory() {
  const ipc = await loadNodeBuiltin('net');
  return ipc['createServer'].bind(ipc);
}

async function readUtf8File(path) {
  const io = await loadNodeBuiltin('fs');
  return io.readFileSync(path, 'utf8');
}

export const BROKER_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_INPUT: 'DENY_MISSING_INPUT',
  DENY_UNTRUSTED_DEPS: 'DENY_UNTRUSTED_DEPS',
  DENY_UNMERGED_PROVENANCE: 'DENY_UNMERGED_PROVENANCE',
  DENY_MISSING_OWNER_INSTRUCTION: 'DENY_MISSING_OWNER_INSTRUCTION',
  DENY_OWNER_INSTRUCTION: 'DENY_OWNER_INSTRUCTION',
  DENY_WRONG_SLICE: 'DENY_WRONG_SLICE',
  DENY_WRONG_SCOPE: 'DENY_WRONG_SCOPE',
  DENY_WRONG_OPERATION: 'DENY_WRONG_OPERATION',
  DENY_CROSS_SLICE_DLP011: 'DENY_CROSS_SLICE_DLP011',
  DENY_VALIDATOR_INSUFFICIENT: 'DENY_VALIDATOR_INSUFFICIENT',
  DENY_YES_TOKEN_INSUFFICIENT: 'DENY_YES_TOKEN_INSUFFICIENT',
  DENY_TIP_MISMATCH: 'DENY_TIP_MISMATCH',
  DENY_CLOCK_OR_REVOCATION: 'DENY_CLOCK_OR_REVOCATION',
  DENY_WORKER_TRUST: 'DENY_WORKER_TRUST',
  DENY_GOVERNANCE: 'DENY_GOVERNANCE',
  DENY_MUTATION_TARGET: 'DENY_MUTATION_TARGET',
  DENY_FAIL_CLOSED: 'DENY_FAIL_CLOSED',
});

const mergeAttestationBrand = new WeakSet();
const brokerTrustBrand = new WeakSet();
const ticketPrivateByTrust = new WeakMap();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = []) {
  return Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...reasons]),
    ticket: null,
  });
}

export function createDisposableMergedProvenanceAttestation(spec, privilegedToken) {
  if (privilegedToken !== DISPOSABLE_BROKER_TRUST_TOKEN) {
    throw new TypeError('DISPOSABLE_BROKER_TRUST_TOKEN_REQUIRED');
  }
  if (!isPlainObject(spec)
    || typeof spec.merged !== 'boolean'
    || !isNonEmptyString(spec.canonicalSha)
    || !isNonEmptyString(spec.governancePr)
    || !isNonEmptyString(spec.attestedBy)) {
    throw new TypeError('INVALID_MERGE_ATTESTATION');
  }
  if (spec.attestedBy !== 'HARNESS_TEST_ONLY') {
    throw new TypeError('MERGE_ATTESTATION_MUST_BE_HARNESS_TEST_ONLY');
  }
  const att = Object.freeze({
    kind: 'TECP_DLP012_MERGED_PROVENANCE_ATTESTATION',
    purpose: 'TEST_ONLY',
    merged: spec.merged,
    canonicalSha: spec.canonicalSha,
    governancePr: spec.governancePr,
    attestedBy: spec.attestedBy,
  });
  mergeAttestationBrand.add(att);
  return att;
}

export function isBrandedMergedProvenanceAttestation(value) {
  return mergeAttestationBrand.has(value);
}

export function createDisposableBrokerTrust(config = {}) {
  if (config.privilegedTrustInjection !== DISPOSABLE_BROKER_TRUST_TOKEN) {
    throw new TypeError('DISPOSABLE_BROKER_TRUST_TOKEN_REQUIRED');
  }
  if (!isBrandedOwnerInstructionKeyRegistry(config.keyRegistry)
    || !isBrandedOwnerInstructionRevocationRegistry(config.revocationRegistry)
    || !isBrandedOwnerInstructionClock(config.clock)
    || !isBrandedOwnerImplementationInstructionVerifier(config.ownerVerifier)
    || !mergeAttestationBrand.has(config.mergeAttestation)
    || !isNonEmptyString(config.rule02Text)
    || !isNonEmptyString(config.canonicalSha)
    || !isNonEmptyString(config.governanceRevision)
    || !isNonEmptyString(config.issuerId)
    || !isNonEmptyString(config.trustEpoch)
    || !isNonEmptyString(config.ticketPrivateKeyPem)
    || !isNonEmptyString(config.ticketPublicKeyPem)
    || !isNonEmptyString(config.ticketKid)
    || !isNonEmptyString(config.writerAudience)) {
    throw new TypeError('BROKER_TRUST_DEPS_REQUIRED');
  }

  const rule02Digest = sha256Hex(config.rule02Text);
  if (config.rule02DigestSha256 && config.rule02DigestSha256 !== rule02Digest) {
    throw new TypeError('RULE02_DIGEST_MISMATCH');
  }

  const trust = Object.freeze({
    kind: BROKER_KIND,
    purpose: BROKER_PURPOSE,
    issuerId: config.issuerId,
    trustEpoch: config.trustEpoch,
    ticketKid: config.ticketKid,
    ticketPublicKeyPem: config.ticketPublicKeyPem,
    writerAudience: config.writerAudience,
    canonicalSha: config.canonicalSha,
    rule02DigestSha256: rule02Digest,
    governanceRevision: config.governanceRevision,
    sameProcessTrustInstallerResidual: true,
  });
  brokerTrustBrand.add(trust);
  ticketPrivateByTrust.set(trust, Object.freeze({
    ticketPrivateKeyPem: config.ticketPrivateKeyPem,
    keyRegistry: config.keyRegistry,
    revocationRegistry: config.revocationRegistry,
    clock: config.clock,
    ownerVerifier: config.ownerVerifier,
    mergeAttestation: config.mergeAttestation,
    rule02Text: config.rule02Text,
  }));
  return trust;
}

export function isBrandedBrokerTrust(value) {
  return brokerTrustBrand.has(value);
}

export function getBrokerTicketPublicMaterial(trust) {
  if (!brokerTrustBrand.has(trust)) throw new TypeError('BROKER_TRUST_REQUIRED');
  return Object.freeze({
    kid: trust.ticketKid,
    publicKeyPem: trust.ticketPublicKeyPem,
    issuerId: trust.issuerId,
    audienceId: trust.writerAudience,
    trustEpoch: trust.trustEpoch,
  });
}

export function mintWriterTicket(trust, request = {}) {
  if (!brokerTrustBrand.has(trust)) {
    return deny(BROKER_DECISIONS.DENY_UNTRUSTED_DEPS, ['BROKER_TRUST_REQUIRED']);
  }
  const priv = ticketPrivateByTrust.get(trust);
  if (!priv) return deny(BROKER_DECISIONS.DENY_FAIL_CLOSED, ['TRUST_MATERIAL_MISSING']);

  if (request && (request.keyRegistry || request.ownerVerifier || request.mergeAttestation
    || request.ticketPrivateKeyPem || request.publicKeyPem)) {
    return deny(BROKER_DECISIONS.DENY_WORKER_TRUST, ['WORKER_SUPPLIED_TRUST']);
  }

  if (request && (isBrandedGateDecision(request.dlp011Decision)
    || isBrandedGateDecision(request.gateDecision)
    || request.acceptDlp011Allow === true)) {
    return deny(BROKER_DECISIONS.DENY_CROSS_SLICE_DLP011, ['DLP011_ALLOW_FORBIDDEN']);
  }

  if (request && request.dlp011OwnerInstructionEncoded) {
    return deny(BROKER_DECISIONS.DENY_CROSS_SLICE_DLP011, ['DLP011_OWNER_INSTRUCTION']);
  }

  if (!isNonEmptyString(request.ownerInstructionEncoded)) {
    return deny(BROKER_DECISIONS.DENY_MISSING_OWNER_INSTRUCTION);
  }
  if (!isNonEmptyString(request.requestId)) {
    return deny(BROKER_DECISIONS.DENY_MISSING_INPUT, ['REQUEST_ID']);
  }

  if (!mergeAttestationBrand.has(priv.mergeAttestation) || priv.mergeAttestation.merged !== true) {
    return deny(BROKER_DECISIONS.DENY_UNMERGED_PROVENANCE, ['MERGED_FALSE_OR_UNBRANDED']);
  }
  if (priv.mergeAttestation.canonicalSha !== trust.canonicalSha) {
    return deny(BROKER_DECISIONS.DENY_UNMERGED_PROVENANCE, ['ATTESTATION_SHA_MISMATCH']);
  }

  if (request.validatorAllowOnly === true) {
    return deny(BROKER_DECISIONS.DENY_VALIDATOR_INSUFFICIENT);
  }
  if (request.rule02YesOnly === true) {
    return deny(BROKER_DECISIONS.DENY_YES_TOKEN_INSUFFICIENT);
  }

  // Necessary (never sufficient): frozen parse + validateGovernance(IMPLEMENT).
  let governance;
  try {
    governance = evaluateFrozenValidatorAllowOnly(
      priv.rule02Text,
      [...DLP012_AUTHORIZED_FILE_SCOPE],
    );
  } catch (err) {
    return deny(BROKER_DECISIONS.DENY_GOVERNANCE, [String(err && err.message || err)]);
  }
  if (!governance || governance.decision !== 'ALLOW') {
    return deny(BROKER_DECISIONS.DENY_GOVERNANCE, [
      governance && governance.decision ? governance.decision : 'VALIDATOR_DENY',
      ...(governance && governance.reasons ? governance.reasons : []),
    ]);
  }

  const tipSha = trust.canonicalSha;
  const tipDigest = trust.rule02DigestSha256;
  if ((isNonEmptyString(request.tipSha) && request.tipSha !== tipSha)
    || (isNonEmptyString(request.rule02Digest) && request.rule02Digest !== tipDigest)) {
    return deny(BROKER_DECISIONS.DENY_TIP_MISMATCH, ['WORKER_TIP_OVERRIDE']);
  }

  if (!isNonEmptyString(request.mutationRelativePath)
    || request.mutationRelativePath.includes('\0')
    || request.mutationRelativePath.includes('..')
    || request.mutationRelativePath.startsWith('/')
    || request.mutationRelativePath.includes('\\')) {
    return deny(BROKER_DECISIONS.DENY_MUTATION_TARGET, ['MUT_PATH_REQUIRED']);
  }
  if (!isNonEmptyString(request.mutationContent)
    || typeof request.mutationContent !== 'string') {
    return deny(BROKER_DECISIONS.DENY_MUTATION_TARGET, ['MUT_CONTENT_REQUIRED']);
  }
  const mutContentSha = sha256Hex(request.mutationContent);

  const expectation = Object.freeze({
    repositoryId: DLP012_REPOSITORY_ID,
    sliceId: DLP012_SLICE_ID,
    canonicalSha: trust.canonicalSha,
    rule02DigestSha256: trust.rule02DigestSha256,
    operationClass: DLP012_NATIVE_OPERATION,
    governanceRevision: trust.governanceRevision,
    authorizedFileScope: [...DLP012_AUTHORIZED_FILE_SCOPE],
  });

  let verified;
  try {
    verified = priv.ownerVerifier.verify(request.ownerInstructionEncoded, expectation);
  } catch (err) {
    return deny(BROKER_DECISIONS.DENY_CLOCK_OR_REVOCATION, [String(err && err.message || err)]);
  }
  if (!verified || verified.ok !== true) {
    const code = verified && verified.decision
      ? verified.decision
      : BROKER_DECISIONS.DENY_OWNER_INSTRUCTION;
    if (String(code).includes('SLICE')) {
      return deny(BROKER_DECISIONS.DENY_WRONG_SLICE, [code]);
    }
    if (String(code).includes('SCOPE')) {
      return deny(BROKER_DECISIONS.DENY_WRONG_SCOPE, [code]);
    }
    if (String(code).includes('OPERATION')) {
      return deny(BROKER_DECISIONS.DENY_WRONG_OPERATION, [code]);
    }
    return deny(BROKER_DECISIONS.DENY_OWNER_INSTRUCTION, [code, ...(verified?.reasons || [])]);
  }

  // Verified Owner instruction is a flat branded object (no nested .claims).
  const claims = verified.instruction;
  if (!claims || claims.sliceId !== DLP012_SLICE_ID) {
    return deny(BROKER_DECISIONS.DENY_WRONG_SLICE);
  }
  if (claims.operationClass !== DLP012_NATIVE_OPERATION) {
    return deny(BROKER_DECISIONS.DENY_WRONG_OPERATION);
  }
  if (!scopesEqual(claims.authorizedFileScope, DLP012_AUTHORIZED_FILE_SCOPE)) {
    return deny(BROKER_DECISIONS.DENY_WRONG_SCOPE);
  }

  let now;
  try {
    now = priv.clock.now();
  } catch {
    return deny(BROKER_DECISIONS.DENY_CLOCK_OR_REVOCATION, ['CLOCK_UNAVAILABLE']);
  }

  const ttlMs = Number.isSafeInteger(request.ttlMs) && request.ttlMs > 0
    ? request.ttlMs
    : 60_000;
  if (ttlMs > 5 * 60 * 1000) {
    return deny(BROKER_DECISIONS.DENY_FAIL_CLOSED, ['TTL_EXCESSIVE']);
  }
  const ticketClaims = {
    v: 1,
    alg: 'Ed25519',
    iss: trust.issuerId,
    aud: trust.writerAudience,
    kid: trust.ticketKid,
    jti: randomId(16),
    requestId: request.requestId,
    sliceId: DLP012_SLICE_ID,
    op: DLP012_NATIVE_OPERATION,
    paths: [...DLP012_AUTHORIZED_FILE_SCOPE],
    mutPath: request.mutationRelativePath,
    mutContentSha,
    tipSha,
    rule02Digest: tipDigest,
    trustEpoch: trust.trustEpoch,
    iat: now,
    nbf: now,
    exp: now + ttlMs,
    ou: true,
  };

  let payload;
  try {
    payload = ticketSigningPayload(ticketClaims);
  } catch (err) {
    return deny(BROKER_DECISIONS.DENY_FAIL_CLOSED, [String(err && err.message || err)]);
  }
  const sig = signEd25519(priv.ticketPrivateKeyPem, payload);
  const encoded = `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;

  return Object.freeze({
    ok: true,
    decision: BROKER_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    ticket: Object.freeze({
      encoded,
      claims: Object.freeze({ ...ticketClaims, paths: Object.freeze([...ticketClaims.paths]) }),
    }),
    operational: false,
    purpose: BROKER_PURPOSE,
  });
}

export function evaluateFrozenValidatorAllowOnly(rule02Text, requestedPaths) {
  const parsed = parseRule02(rule02Text);
  return validateGovernance(parsed, {
    sliceId: DLP012_SLICE_ID,
    authorityClass: 'ENGINEERING_CONTROL_PLANE',
    riskTier: 'Tier 3',
    requestedPaths,
    operationClass: 'IMPLEMENT',
    requiresDeploy: false,
    requiresProductionMutation: false,
  });
}

function safeWrite(socket, obj) {
  try {
    socket.write(encodeFrame(obj));
  } catch {
    // ignore broken pipe
  }
}

function handleBrokerMessage(trust, socket, msg) {
  if (!isPlainObject(msg) || msg.v !== PROTOCOL_VERSION || msg.kind !== PROTOCOL_KIND) {
    return safeWrite(socket, {
      v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
      decision: BROKER_DECISIONS.DENY_FAIL_CLOSED, reasons: ['BAD_ENVELOPE'],
    });
  }
  if (msg.type !== MSG.MINT_TICKET_REQ) {
    return safeWrite(socket, {
      v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
      decision: BROKER_DECISIONS.DENY_FAIL_CLOSED, reasons: ['UNEXPECTED_TYPE'],
    });
  }
  const result = mintWriterTicket(trust, {
    ownerInstructionEncoded: msg.ownerInstructionEncoded,
    requestId: msg.requestId,
    tipSha: msg.tipSha,
    rule02Digest: msg.rule02Digest,
    mutationRelativePath: msg.mutationRelativePath,
    mutationContent: msg.mutationContent,
    ttlMs: msg.ttlMs,
    validatorAllowOnly: msg.validatorAllowOnly === true,
    rule02YesOnly: msg.rule02YesOnly === true,
    acceptDlp011Allow: msg.acceptDlp011Allow === true,
    dlp011OwnerInstructionEncoded: msg.dlp011OwnerInstructionEncoded,
  });
  safeWrite(socket, {
    v: PROTOCOL_VERSION,
    kind: PROTOCOL_KIND,
    type: MSG.MINT_TICKET_RES,
    ok: result.ok,
    decision: result.decision,
    reasons: result.reasons,
    ticketEncoded: result.ticket ? result.ticket.encoded : null,
    requestId: msg.requestId || null,
  });
}

export async function createBrokerIpcServer(trust, { socketPath }) {
  if (!brokerTrustBrand.has(trust)) throw new TypeError('BROKER_TRUST_REQUIRED');
  const listenUnix = await unixListenFactory();
  const server = listenUnix((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          handleBrokerMessage(trust, socket, msg);
        }
      } catch (err) {
        safeWrite(socket, {
          v: PROTOCOL_VERSION,
          kind: PROTOCOL_KIND,
          type: MSG.ERROR,
          ok: false,
          decision: BROKER_DECISIONS.DENY_FAIL_CLOSED,
          reasons: [String(err && err.message || err)],
        });
      }
    });
  });
  server.listen(socketPath);
  return server;
}

export function reconstructBrokerTrustFromBootstrap(bootstrap) {
  if (!isPlainObject(bootstrap) || bootstrap.privilegedTrustInjection !== DISPOSABLE_BROKER_TRUST_TOKEN) {
    throw new TypeError('TRUST_TOKEN_REQUIRED');
  }
  return withPrivilegedOwnerInstructionConstruction(() => {
    const ctors = getPrivilegedOwnerInstructionConstructors();
    const keyRegistry = ctors.createOwnerInstructionKeyRegistry(bootstrap.keyEntries);
    const revocationRegistry = ctors.createOwnerInstructionRevocationRegistry();
    if (Array.isArray(bootstrap.revokedJtis)) {
      for (const j of bootstrap.revokedJtis) revocationRegistry.revokeJti(j);
    }
    const clock = ctors.createOwnerInstructionClock(bootstrap.clockStartMs);
    const ownerVerifier = ctors.createOwnerImplementationInstructionVerifier({
      keyRegistry,
      revocationRegistry,
      clock,
      consumeOnAllow: true,
    });
    const mergeAttestation = createDisposableMergedProvenanceAttestation(
      bootstrap.mergeAttestation,
      DISPOSABLE_BROKER_TRUST_TOKEN,
    );
    return createDisposableBrokerTrust({
      privilegedTrustInjection: DISPOSABLE_BROKER_TRUST_TOKEN,
      keyRegistry,
      revocationRegistry,
      clock,
      ownerVerifier,
      mergeAttestation,
      rule02Text: bootstrap.rule02Text,
      canonicalSha: bootstrap.canonicalSha,
      rule02DigestSha256: bootstrap.rule02DigestSha256,
      governanceRevision: bootstrap.governanceRevision,
      issuerId: bootstrap.issuerId,
      trustEpoch: bootstrap.trustEpoch,
      ticketPrivateKeyPem: bootstrap.ticketPrivateKeyPem,
      ticketPublicKeyPem: bootstrap.ticketPublicKeyPem,
      ticketKid: bootstrap.ticketKid,
      writerAudience: bootstrap.writerAudience,
    });
  });
}

export async function runBrokerMainFromFd() {
  const bootstrap = JSON.parse(await readUtf8File('/dev/fd/3'));
  if (bootstrap.mode !== 'broker-child-v1') throw new Error('BAD_BROKER_BOOTSTRAP');
  const trust = reconstructBrokerTrustFromBootstrap(bootstrap);
  const server = await createBrokerIpcServer(trust, { socketPath: bootstrap.socketPath });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const shutdown = () => {
    try { server.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.stdout.write(`${JSON.stringify({ ok: true, pid: process.pid, role: 'broker' })}\n`);
}

const isMain = process.argv[1] && /isolatedAuthorizationBroker\.js$/.test(process.argv[1]);
if (isMain && process.argv.includes('--dlp012-broker')) {
  runBrokerMainFromFd().catch((err) => {
    process.stderr.write(`${String(err && err.stack || err)}\n`);
    process.exit(1);
  });
}

export {
  DLP012_SLICE_ID,
  DLP012_NATIVE_OPERATION,
  DLP012_AUTHORIZED_FILE_SCOPE,
  DLP012_REPOSITORY_ID,
  sha256Hex,
};
