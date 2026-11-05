/**
 * TECP-DLP-012 — Privileged disposable harness (TEST_ONLY / NON_OPERATIONAL).
 *
 * Owns ephemeral keys, tip/revocation authority, three-process spawn, cleanup.
 * Not real Owner custody. Same-UID residuals remain NOT_SEALED.
 *
 * DLP-012F H4: historical disposable positive-path proofs pin the activation-era
 * Rule02 fixture (git blob 94a617e0… / SHA256 b056644f…). Live workspace Rule02
 * is never a silent historical fallback. Optional git-blob secondary source is
 * opt-in only (allowGitBlobFallback / TECP_DLP012_ALLOW_GIT_BLOB_FALLBACK=1).
 */

import {
  createServer,
  createConnection,
} from 'node:net';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  openSync,
  closeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import {
  DLP012_AUTHORIZED_FILE_SCOPE,
  DLP012_NATIVE_OPERATION,
  DLP012_REPOSITORY_ID,
  DLP012_SLICE_ID,
  FENCE_STATES,
  MSG,
  PROTOCOL_KIND,
  PROTOCOL_VERSION,
  canonicalJson,
  encodeFrame,
  generateEd25519KeyPair,
  orderedTicketClaims,
  randomId,
  sha256Hex,
  signEd25519,
  ticketSigningPayload,
  tryDecodeFrames,
} from '../src/brokerIpcProtocol.js';
import {
  DISPOSABLE_BROKER_TRUST_TOKEN,
  createDisposableBrokerTrust,
  createDisposableMergedProvenanceAttestation,
  mintWriterTicket,
} from '../src/isolatedAuthorizationBroker.js';
import {
  DISPOSABLE_WRITER_PIN_TOKEN,
  advanceWriterClock,
  applyAuthenticatedTipUpdate,
  createWriterTrustPin,
  configureWriterCrashHooks,
  executeAuthorizedWrite,
  tipAssertionPayload,
  tipUpdatePayload,
} from '../src/isolatedWriteExecutor.js';

function fenceGrantPayload(claims) {
  return `TECP_DLP012_FENCE_GRANT_V1\n${canonicalJson(claims)}`;
}
import {
  OWNER_INSTRUCTION_PURPOSE,
  generateEphemeralOwnerInstructionKeyPair,
  getPrivilegedOwnerInstructionConstructors,
  issueOwnerImplementationInstruction,
  withPrivilegedOwnerInstructionConstruction,
} from '../src/ownerImplementationInstruction.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const BROKER_SRC = join(HERE, '../src/isolatedAuthorizationBroker.js');
const WRITER_SRC = join(HERE, '../src/isolatedWriteExecutor.js');
const HARNESS_SRC = fileURLToPath(import.meta.url);
const LIVE_RULE02_PATH = join(ROOT, '.cursor/rules/titangold-current-active-work.mdc');
const HISTORICAL_FIXTURE_PATH = join(HERE, 'fixtures/dlp012ActivationEraRule02.mdc');

export const CANONICAL_BASE_SHA = '0a909515cbffc4e75ae685e2416a9dcdae8f2817';
export const GOVERNANCE_REVISION = 'DLP012_CONDITIONAL_ACTIVATION_20261105';
export const HISTORICAL_GOVERNANCE_REVISION = GOVERNANCE_REVISION;
/** Immutable Git blob of Rule02 at DLP-012 activation-era baseline (pre-012F). */
export const HISTORICAL_RULE02_GIT_BLOB_SHA = '94a617e07b55d513d3b87a575c8bae2f34b68600';
/** SHA256 of that blob's UTF-8 bytes (must match checked-in fixture). */
export const HISTORICAL_RULE02_SHA256 =
  'b056644fab49c48247f86741b0a326dcb291827126b286c71fdde3df51561fe8';
/** Historical Rule02 GOVERNANCE_BASE_MAIN_SHA recorded in the activation-era text. */
export const HISTORICAL_GOVERNANCE_BASE_MAIN_SHA =
  '6b682c282ae4fba28579a6a144a0617a8ca9a5bd';
export const YES_TOKEN = 'YES / EXACT_SLICE_ONLY / EFFECTIVE_AFTER_THIS_GOVERNANCE_PR_MERGES';
export const CONSUMED_TOKEN = 'CONSUMED / NON-ACTIVE';
export const GOVERNANCE_PR = '#273';
export const HARNESS_MARKER = 'TECP_DLP012_HARNESS_OWNED';
export { HISTORICAL_FIXTURE_PATH, LIVE_RULE02_PATH };

/**
 * Explicit latch for TEST_ONLY harness Rule02 text overrides.
 * Untrusted callers cannot treat options.rule02Text as production authority.
 * Does NOT grant operational mint authority; Broker + Owner instruction still apply.
 */
export const PRIVILEGED_HARNESS_RULE02_OVERRIDE = Symbol.for(
  'TECP_DLP012_PRIVILEGED_HARNESS_RULE02_OVERRIDE',
);

export function digestRule02(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function verifyHistoricalRule02Text(text, sourceLabel = 'CALLER') {
  if (typeof text !== 'string' || text.length < 100) {
    throw new Error(`HISTORICAL_RULE02_MISSING_OR_EMPTY:${sourceLabel}`);
  }
  const digest = digestRule02(text);
  if (digest !== HISTORICAL_RULE02_SHA256) {
    throw new Error(
      `HISTORICAL_RULE02_DIGEST_MISMATCH:${sourceLabel}:expected=${HISTORICAL_RULE02_SHA256}:actual=${digest}`,
    );
  }
  if (!text.includes(`**GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}**`)
    && !text.includes(`GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}`)) {
    throw new Error(`HISTORICAL_RULE02_REVISION_MISSING:${sourceLabel}`);
  }
  if (!text.includes(`**IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`)) {
    throw new Error(`HISTORICAL_RULE02_YES_TOKEN_MISSING:${sourceLabel}`);
  }
  if (!text.includes(DLP012_SLICE_ID)) {
    throw new Error(`HISTORICAL_RULE02_SLICE_MISSING:${sourceLabel}`);
  }
  for (const path of DLP012_AUTHORIZED_FILE_SCOPE) {
    if (!text.includes(path)) {
      throw new Error(`HISTORICAL_RULE02_SCOPE_PATH_MISSING:${sourceLabel}:${path}`);
    }
  }
  if (!text.includes(HISTORICAL_GOVERNANCE_BASE_MAIN_SHA)
    && !text.includes(CANONICAL_BASE_SHA)) {
    throw new Error(`HISTORICAL_RULE02_CANONICAL_SHA_MISSING:${sourceLabel}`);
  }
  return text;
}

function resolveHistoricalFixturePath(options = {}) {
  if (options.fixturePath == null || options.fixturePath === '') {
    return HISTORICAL_FIXTURE_PATH;
  }
  if (typeof options.fixturePath !== 'string') {
    throw new Error('HISTORICAL_FIXTURE_PATH_INVALID:non_string');
  }
  return options.fixturePath;
}

function tryReadHistoricalFixtureFile(fixturePath) {
  if (!existsSync(fixturePath)) {
    return null;
  }
  return verifyHistoricalRule02Text(
    readFileSync(fixturePath, 'utf8'),
    'FIXTURE_FILE',
  );
}

function gitBlobFallbackEnabled(options = {}) {
  if (options.allowGitBlobFallback === true) {
    return true;
  }
  if (options.allowGitBlobFallback === false) {
    return false;
  }
  return process.env.TECP_DLP012_ALLOW_GIT_BLOB_FALLBACK === '1';
}

function tryReadHistoricalGitBlob(options = {}) {
  if (!gitBlobFallbackEnabled(options)) {
    return null;
  }
  const gitDir = options.gitDir
    || process.env.TECP_GIT_DIR
    || ROOT;
  try {
    const text = execFileSync(
      'git',
      ['cat-file', '-p', HISTORICAL_RULE02_GIT_BLOB_SHA],
      {
        cwd: gitDir,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return verifyHistoricalRule02Text(text, 'GIT_BLOB');
  } catch (err) {
    if (err && String(err.message || err).startsWith('HISTORICAL_RULE02_')) {
      throw err;
    }
    return null;
  }
}

/**
 * Immutable activation-era Rule02 for historical DLP-012 disposable proof.
 * Primary: checked-in fixture. Optional secondary: git blob (explicit opt-in).
 * Fail closed: never silently falls back to live workspace Rule02.
 */
export function loadHistoricalActivationRule02Text(options = {}) {
  const fixturePath = resolveHistoricalFixturePath(options);
  const fromFixture = tryReadHistoricalFixtureFile(fixturePath);
  if (fromFixture != null) {
    return fromFixture;
  }
  const fromGit = tryReadHistoricalGitBlob(options);
  if (fromGit != null) {
    return fromGit;
  }
  throw new Error(
    'HISTORICAL_RULE02_UNAVAILABLE:missing_fixture;git_fallback_disabled_or_failed;no_live_fallback',
  );
}

/**
 * Current workspace Rule02 (live post-012F governance).
 * Used only for current-live governance separation tests — never for historical proof defaults.
 */
export function loadLiveWorkspaceRule02Text() {
  return readFileSync(LIVE_RULE02_PATH, 'utf8');
}

/** @deprecated Prefer loadLiveWorkspaceRule02Text — kept for explicit live reads. */
export function readLiveRule02() {
  return loadLiveWorkspaceRule02Text();
}

/**
 * Build a deliberately closed activation-era Rule02 for DENY_GOVERNANCE negative tests.
 * Source must be verified historical text (or an already-verified caller-supplied string).
 */
export function synthesizeClosedHistoricalRule02Text(
  sourceText = loadHistoricalActivationRule02Text(),
) {
  const closed = String(sourceText)
    .replaceAll(
      `**IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    )
    .replaceAll(
      `**TECP005_IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**TECP005_IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    )
    .replaceAll(
      `**TECP_DLP012_IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`,
      `**TECP_DLP012_IMPLEMENTATION_AUTHORIZED = ${CONSUMED_TOKEN}**`,
    );
  if (closed === sourceText || closed.includes(`**IMPLEMENTATION_AUTHORIZED = ${YES_TOKEN}**`)) {
    throw new Error('HISTORICAL_CLOSED_RULE02_TRANSFORM_INEFFECTIVE');
  }
  if (digestRule02(closed) === HISTORICAL_RULE02_SHA256) {
    throw new Error('HISTORICAL_CLOSED_RULE02_DIGEST_UNCHANGED');
  }
  return closed;
}

/**
 * Build a wrong-slice negative Rule02 from verified historical activation-era text.
 */
export function synthesizeWrongSliceHistoricalRule02Text(
  sourceText = loadHistoricalActivationRule02Text(),
  wrongSliceId = 'TECP-DLP-999-WRONG-SLICE-FOR-NEGATIVE-TEST',
) {
  if (!String(sourceText).includes(DLP012_SLICE_ID)) {
    throw new Error('HISTORICAL_WRONG_SLICE_SOURCE_MISSING_DLP012_SLICE');
  }
  const wrong = String(sourceText).replaceAll(DLP012_SLICE_ID, wrongSliceId);
  if (wrong === sourceText || wrong.includes(DLP012_SLICE_ID)) {
    throw new Error('HISTORICAL_WRONG_SLICE_TRANSFORM_INEFFECTIVE');
  }
  return wrong;
}

function waitForListening(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('CHILD_START_TIMEOUT')), timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString('utf8');
      const line = buf.split('\n').find((l) => l.trim().startsWith('{'));
      if (line) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        try {
          resolve(JSON.parse(line));
        } catch (err) {
          reject(err);
        }
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`CHILD_EXIT_BEFORE_READY:${code}`));
    });
    child.stderr.on('data', () => { /* absorb */ });
  });
}

function ipcRequest(socketPath, message, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => {
      try { sock.destroy(); } catch { /* ignore */ }
      reject(new Error('IPC_TIMEOUT'));
    }, timeoutMs);
    sock.on('connect', () => {
      try {
        sock.write(encodeFrame(message));
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        if (decoded.frames.length > 0) {
          clearTimeout(timer);
          sock.end();
          resolve(decoded.frames[0]);
        }
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
    sock.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Create privileged harness session with tip authority + optional three-process topology.
 */
export async function createDisposableIsolatedBrokerHarness(options = {}) {
  const owned = [];
  const children = [];
  let cleaned = false;

  const tempRoot = mkdtempSync(join(tmpdir(), 'tecp-dlp012-'));
  owned.push(tempRoot);
  writeFileSync(join(tempRoot, HARNESS_MARKER), '1', 'utf8');

  const mutationRoot = join(tempRoot, 'mutations');
  mkdirSync(mutationRoot, { recursive: true });
  const socketDir = join(tempRoot, 'sockets');
  mkdirSync(socketDir, { recursive: true });

  const brokerSocket = join(socketDir, 'broker.sock');
  const writerSocket = join(socketDir, 'writer.sock');
  const tipSocket = join(socketDir, 'tip.sock');

  const ownerKeys = generateEphemeralOwnerInstructionKeyPair();
  const ticketKeys = generateEd25519KeyPair();
  const tipKeys = generateEd25519KeyPair();

  const ownerKid = 'owner-dlp012-test-1';
  const ownerIssuer = 'TECP_DLP012_TEST_OWNER';
  const ticketKid = 'broker-ticket-1';
  const brokerIssuer = 'TECP_DLP012_BROKER';
  const writerAudience = 'TECP_DLP012_WRITER';
  const tipAuthorityId = 'TECP_DLP012_TIP_AUTHORITY';
  const trustEpoch = `epoch-${randomId(8)}`;
  const clockStartMs = 1_700_000_100_000;
  const wallOriginMs = Date.now();
  let assertionServeCount = 0;

  // Historical default: pinned activation-era fixture (H4). Explicit options.rule02Text
  // remains the TEST_ONLY negative-input override (malformed / closed / wrong-slice).
  // Never silently substitute live workspace Rule02 for the historical default.
  const rule02Text = Object.prototype.hasOwnProperty.call(options, 'rule02Text')
    ? options.rule02Text
    : loadHistoricalActivationRule02Text({
      fixturePath: options.fixturePath,
      allowGitBlobFallback: options.allowGitBlobFallback,
      gitDir: options.gitDir,
    });
  if (typeof rule02Text !== 'string' || rule02Text.length < 1) {
    throw new Error('HARNESS_RULE02_TEXT_REQUIRED');
  }
  const rule02Digest = sha256Hex(rule02Text);
  const canonicalSha = options.canonicalSha || CANONICAL_BASE_SHA;
  const merged = options.merged !== false;
  const defaultMutPath = options.defaultMutPath || 'authorized-mut.txt';
  const defaultMutContent = options.defaultMutContent || 'DLP012_MUTATION_OK';
  const postSecondAssertionRaceMode = options.postSecondAssertionRaceMode === true
    || options.fenceDriftMode === true;
  const fenceTtlMs = Number.isSafeInteger(options.fenceTtlMs) ? options.fenceTtlMs : 5_000;
  const delayedGrantDeliveryMs = Number.isSafeInteger(options.delayedGrantDeliveryMs)
    ? options.delayedGrantDeliveryMs
    : 0;
  const delayedConfirmAckMs = Number.isSafeInteger(options.delayedConfirmAckMs)
    ? options.delayedConfirmAckMs
    : 0;
  const delayedExecuteAckMs = Number.isSafeInteger(options.delayedExecuteAckMs)
    ? options.delayedExecuteAckMs
    : 0;
  // Delay only the final pre-mutation TIP_ASSERTION (3rd challenge: fresh1, fresh2, preMut).
  // Signs with Authority time at decision; delivery may land after ticket.exp (RED-01).
  const delayedPreMutationAssertionMs = Number.isSafeInteger(options.delayedPreMutationAssertionMs)
    ? options.delayedPreMutationAssertionMs
    : 0;
  const postGrantAdvanceOnTimeout = options.postGrantAdvanceOnTimeout !== false;
  // TEST_ONLY: intentionally reproduce the unsafe post-confirm tip-flush defect.
  // GREEN path never enables this; RED documentation may set it to prove EXECUTE DENY.
  const forceUnsafeReleaseAfterConfirmMs = Number.isSafeInteger(
    options.forceUnsafeReleaseAfterConfirmMs,
  ) ? options.forceUnsafeReleaseAfterConfirmMs : 0;

  const mergeAttestationSpec = {
    merged,
    canonicalSha,
    governancePr: GOVERNANCE_PR,
    attestedBy: 'HARNESS_TEST_ONLY',
  };

  // Tip authority state (parent) — wall-synced disposable monotonic clock.
  const tipState = {
    seq: 0,
    tipSha: canonicalSha,
    rule02Digest,
    revocationEpoch: 0,
    revokedJtis: [],
    clockMs: clockStartMs,
    manualOffsetMs: 0,
  };

  // Authority-enforced mutation fence.
  // LINEARIZATION for side-effect = FENCE_EXECUTE_ACK while CONFIRMED/MUTATION_POSSIBLE.
  // Post-CONFIRM: tip/revocation MUST NOT flush on timer alone while Writer may mutate.
  let activeFence = null;
  const pendingTipExtras = [];
  const completedGrantIds = new Set();
  const abandonedGrantIds = new Set();
  const poisonedGrantIds = new Set();
  let fenceTimeoutHandle = null;
  let writerExitEvidence = null;
  let confirmSoftTimeoutHandle = null;

  function authorityNowMs() {
    // Trusted tip-authority time: bootstrap + real elapsed + manual advances.
    return clockStartMs + (Date.now() - wallOriginMs) + tipState.manualOffsetMs;
  }

  function syncAuthorityClock() {
    tipState.clockMs = authorityNowMs();
    return tipState.clockMs;
  }

  function applyTipExtraToState(extra = {}, { allowReplaceRevoked = false } = {}) {
    tipState.seq += 1;
    if (extra.tipSha) tipState.tipSha = extra.tipSha;
    if (extra.rule02Digest) tipState.rule02Digest = extra.rule02Digest;
    if (Number.isSafeInteger(extra.revocationEpoch)) tipState.revocationEpoch = extra.revocationEpoch;
    if (Array.isArray(extra.revokedJtis)) {
      if (allowReplaceRevoked || extra.replaceRevokedJtis === true) {
        // Adversarial authority transition for Writer sticky-revocation tests.
        tipState.revokedJtis = [...extra.revokedJtis].sort();
      } else {
        tipState.revokedJtis = [...new Set([...tipState.revokedJtis, ...extra.revokedJtis])].sort();
      }
    }
  }

  function signTipUpdate(extra = {}) {
    if (activeFence) {
      // Tip/revocation must not become effective during an acquired mutation fence.
      pendingTipExtras.push({ ...extra });
      const ts = syncAuthorityClock();
      return Object.freeze({
        deferred: true,
        authorityId: tipAuthorityId,
        revocationEpoch: tipState.revocationEpoch,
        revokedJtis: [...tipState.revokedJtis],
        rule02Digest: tipState.rule02Digest,
        seq: tipState.seq,
        tipSha: tipState.tipSha,
        ts,
        v: 1,
        sig: 'DEFERRED_DURING_FENCE',
      });
    }
    applyTipExtraToState(extra);
    const ts = syncAuthorityClock();
    const claims = {
      authorityId: tipAuthorityId,
      revocationEpoch: tipState.revocationEpoch,
      revokedJtis: [...tipState.revokedJtis],
      rule02Digest: tipState.rule02Digest,
      seq: tipState.seq,
      tipSha: tipState.tipSha,
      ts,
      v: 1,
    };
    const payload = tipUpdatePayload(claims);
    const sig = signEd25519(tipKeys.privateKeyPem, payload);
    return { ...claims, sig };
  }

  function flushPendingTipExtras() {
    while (pendingTipExtras.length > 0) {
      const extra = pendingTipExtras.shift();
      applyTipExtraToState(extra);
    }
  }

  function clearFenceTimers() {
    if (fenceTimeoutHandle) {
      try { clearTimeout(fenceTimeoutHandle); } catch { /* ignore */ }
      fenceTimeoutHandle = null;
    }
    if (confirmSoftTimeoutHandle) {
      try { clearTimeout(confirmSoftTimeoutHandle); } catch { /* ignore */ }
      confirmSoftTimeoutHandle = null;
    }
  }

  /**
   * Poison confirmed fence without releasing tip lock.
   * Authority must NOT infer mutation capability is gone merely because a timer fired.
   */
  function poisonConfirmedFence(reason) {
    if (!activeFence) return;
    const holdStates = new Set([
      FENCE_STATES.CONFIRMED,
      FENCE_STATES.MUTATION_POSSIBLE,
      FENCE_STATES.UNKNOWN_POISONED,
    ]);
    if (!holdStates.has(activeFence.state)) return;
    clearFenceTimers();
    activeFence.state = FENCE_STATES.UNKNOWN_POISONED;
    activeFence.poisonReason = reason;
    abandonedGrantIds.add(activeFence.grantId);
    poisonedGrantIds.add(activeFence.grantId);
    // Tip/revocation remain frozen — Writer may still hold a prior CONFIRM_ACK.
  }

  /**
   * Release fence and flush tip only when mutation authority is conclusively terminated.
   * Timeout after CONFIRM must call poisonConfirmedFence, never this path.
   */
  function clearActiveFence(reason, { advanceTip = false, writerExitRequired = false } = {}) {
    if (writerExitRequired && !writerExitEvidence) {
      // Fail closed: retain fence / tip freeze until positive exit/reap evidence.
      if (activeFence) poisonConfirmedFence('WRITER_EXIT_EVIDENCE_ABSENT');
      return;
    }
    clearFenceTimers();
    if (activeFence) {
      if (reason === 'TIMEOUT' || reason === 'EXPIRED') {
        abandonedGrantIds.add(activeFence.grantId);
      }
      if (reason === 'COMPLETE' && activeFence.state !== FENCE_STATES.UNKNOWN_POISONED) {
        activeFence.state = FENCE_STATES.COMPLETED;
      }
      if (reason === 'WRITER_TERMINATED') {
        activeFence.state = FENCE_STATES.WRITER_TERMINATED;
        abandonedGrantIds.add(activeFence.grantId);
        poisonedGrantIds.add(activeFence.grantId);
      }
      activeFence = null;
    }
    flushPendingTipExtras();
    if (advanceTip || (reason === 'TIMEOUT' && postGrantAdvanceOnTimeout)
      || (reason === 'WRITER_TERMINATED' && postGrantAdvanceOnTimeout)) {
      tipState.seq += 1;
      tipState.tipSha = `grant-expired-drift-${randomId(8)}`;
      tipState.revocationEpoch += 1;
    }
  }

  function onWriterProcessExit(code, signal) {
    writerExitEvidence = Object.freeze({
      pid: writerChild ? writerChild.pid : null,
      code,
      signal,
      reapedAtMs: Date.now(),
      positive: true,
    });
    if (!activeFence) return;
    const state = activeFence.state;
    // Incomplete / unknown Writer progress → permanently poison then release ONLY with exit evidence.
    if (state === FENCE_STATES.GRANT_ISSUED) {
      clearActiveFence('TIMEOUT', { advanceTip: postGrantAdvanceOnTimeout });
      return;
    }
    if (state === FENCE_STATES.CONFIRMED
      || state === FENCE_STATES.MUTATION_POSSIBLE
      || state === FENCE_STATES.UNKNOWN_POISONED) {
      poisonConfirmedFence('WRITER_EXIT_BEFORE_COMPLETE');
      clearActiveFence('WRITER_TERMINATED', {
        advanceTip: postGrantAdvanceOnTimeout,
        writerExitRequired: true,
      });
    }
  }

  function signTipAssertion(nonce) {
    const ts = syncAuthorityClock();
    const claims = {
      authorityId: tipAuthorityId,
      nonce,
      revocationEpoch: tipState.revocationEpoch,
      revokedJtis: [...tipState.revokedJtis].sort(),
      rule02Digest: tipState.rule02Digest,
      seq: tipState.seq,
      tipSha: tipState.tipSha,
      ts,
      v: 1,
    };
    const payload = tipAssertionPayload(claims);
    const sig = signEd25519(tipKeys.privateKeyPem, payload);
    return {
      v: PROTOCOL_VERSION,
      kind: PROTOCOL_KIND,
      type: MSG.TIP_ASSERTION,
      ok: true,
      ...claims,
      sig,
    };
  }

  function signFenceGrant(req) {
    const ts = syncAuthorityClock();
    const grantId = `grant-${randomId(12)}`;
    const claims = {
      authorityId: tipAuthorityId,
      exp: ts + fenceTtlMs,
      fenceNonce: req.fenceNonce,
      grantId,
      jti: req.jti,
      revocationEpoch: tipState.revocationEpoch,
      revokedJtis: [...tipState.revokedJtis].sort(),
      rule02Digest: tipState.rule02Digest,
      seq: tipState.seq,
      tipSha: tipState.tipSha,
      trustEpoch: req.trustEpoch,
      ts,
      v: 1,
      writerAudience: req.writerAudience,
    };
    const payload = fenceGrantPayload(claims);
    const sig = signEd25519(tipKeys.privateKeyPem, payload);
    return {
      v: PROTOCOL_VERSION,
      kind: PROTOCOL_KIND,
      type: MSG.FENCE_GRANT,
      ok: true,
      ...claims,
      sig,
    };
  }

  // Initial tip update for bootstrap
  const initialTipUpdate = signTipUpdate();

  const tipServer = createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          if (msg.type === MSG.TIP_CHALLENGE) {
            if (!msg.nonce) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
                decision: 'DENY_FRESHNESS', reasons: ['NONCE'],
              }));
              continue;
            }
            assertionServeCount += 1;
            let frame;
            if (options.forgeAssertionSig === true) {
              frame = signTipAssertion(msg.nonce);
              frame.sig = Buffer.from('forged-nonce-bound-assertion').toString('base64url');
            } else {
              frame = signTipAssertion(msg.nonce);
            }
            // 3rd assertion = pre-mutation tip challenge (after fresh1 + fresh2).
            if (delayedPreMutationAssertionMs > 0 && assertionServeCount >= 3) {
              const delay = delayedPreMutationAssertionMs;
              setTimeout(() => {
                try { socket.write(encodeFrame(frame)); } catch { /* ignore */ }
              }, delay);
            } else {
              socket.write(encodeFrame(frame));
            }
            // P1-01 / F07 final-fence boundary: after the second signed assertion is sent,
            // immediately advance authoritative tip+revocation before Writer can acquire fence.
            if (postSecondAssertionRaceMode && assertionServeCount >= 2 && !activeFence) {
              tipState.seq += 1;
              tipState.tipSha = `post-assert-drift-${randomId(8)}`;
              tipState.revocationEpoch += 1;
            }
          } else if (msg.type === MSG.FENCE_ACQUIRE_REQ) {
            if (!msg.fenceNonce || !msg.jti || !msg.writerAudience || !msg.trustEpoch) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_ACQUIRE_MALFORMED'],
              }));
              continue;
            }
            if (activeFence) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_BUSY'],
              }));
              continue;
            }
            // Snapshot must match frozen tip at acquire time (post-assertion races fail here).
            if (msg.tipSha !== tipState.tipSha
              || msg.seq !== tipState.seq
              || msg.rule02Digest !== tipState.rule02Digest
              || msg.revocationEpoch !== tipState.revocationEpoch) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_TIP_MISMATCH', 'POST_ASSERTION_DRIFT'],
              }));
              continue;
            }
            const grant = signFenceGrant(msg);
            activeFence = {
              grantId: grant.grantId,
              jti: grant.jti,
              writerAudience: grant.writerAudience,
              trustEpoch: grant.trustEpoch,
              tipSha: grant.tipSha,
              seq: grant.seq,
              rule02Digest: grant.rule02Digest,
              revocationEpoch: grant.revocationEpoch,
              exp: grant.exp,
              confirmed: false,
              executedOnce: false,
              state: FENCE_STATES.GRANT_ISSUED,
            };
            clearFenceTimers();
            // Pre-CONFIRM only: missing acquire acknowledgement may abandon GRANT_ISSUED.
            // Never treat this timer as proof that a CONFIRMED Writer cannot still mutate.
            fenceTimeoutHandle = setTimeout(() => {
              if (!activeFence || activeFence.grantId !== grant.grantId) return;
              if (activeFence.state === FENCE_STATES.GRANT_ISSUED) {
                clearActiveFence('TIMEOUT', { advanceTip: true });
              }
            }, fenceTtlMs);
            if (delayedGrantDeliveryMs > 0) {
              // RED/adversarial: deliver a previously signed grant after TTL expiry + tip advance.
              const delay = delayedGrantDeliveryMs;
              setTimeout(() => {
                try { socket.write(encodeFrame(grant)); } catch { /* ignore */ }
              }, delay);
            } else {
              socket.write(encodeFrame(grant));
            }
          } else if (msg.type === MSG.FENCE_CONFIRM_REQ) {
            const now = syncAuthorityClock();
            if (!activeFence || msg.grantId !== activeFence.grantId
              || activeFence.state === FENCE_STATES.UNKNOWN_POISONED
              || activeFence.state === FENCE_STATES.ABORTED
              || activeFence.state === FENCE_STATES.COMPLETED
              || activeFence.state === FENCE_STATES.WRITER_TERMINATED) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_CONFIRM_INACTIVE', 'GRANT_EXPIRED_OR_UNKNOWN'],
              }));
              continue;
            }
            if (msg.writerAudience !== activeFence.writerAudience
              || msg.trustEpoch !== activeFence.trustEpoch
              || (msg.jti && msg.jti !== activeFence.jti)) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_CONFIRM_AUDIENCE'],
              }));
              continue;
            }
            if (now > activeFence.exp && activeFence.state === FENCE_STATES.GRANT_ISSUED) {
              clearActiveFence('EXPIRED', { advanceTip: true });
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_GRANT_EXPIRED', 'AUTHORITY_NOW_PAST_EXP'],
              }));
              continue;
            }
            // Tip/revocation must still match the grant snapshot while held.
            if (tipState.tipSha !== activeFence.tipSha
              || tipState.seq !== activeFence.seq
              || tipState.rule02Digest !== activeFence.rule02Digest
              || tipState.revocationEpoch !== activeFence.revocationEpoch) {
              poisonConfirmedFence('CONFIRM_TIP_DRIFT');
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_CONFIRM_TIP_DRIFT'],
              }));
              continue;
            }
            activeFence.confirmed = true;
            activeFence.state = FENCE_STATES.CONFIRMED;
            // Cancel GRANT_ISSUED timer. After CONFIRM, tip flush is NOT timer-driven.
            clearFenceTimers();
            const confirmExp = now + fenceTtlMs;
            activeFence.exp = confirmExp;
            const confirmedGrantId = activeFence.grantId;
            // Soft timeout only while CONFIRMED (pre-EXECUTE). Marks UNKNOWN_POISONED and
            // keeps tip frozen — never releases mutation capability on timer alone.
            // Once EXECUTE_ACK is issued, timer is cancelled; hold until COMPLETE or Writer exit.
            confirmSoftTimeoutHandle = setTimeout(() => {
              if (!activeFence || activeFence.grantId !== confirmedGrantId) return;
              if (activeFence.state !== FENCE_STATES.CONFIRMED) return;
              poisonConfirmedFence('CONFIRM_SOFT_TIMEOUT');
            }, fenceTtlMs);
            if (forceUnsafeReleaseAfterConfirmMs > 0) {
              setTimeout(() => {
                // RED documentation only: emulate the prior defect (release after CONFIRM timeout).
                if (!activeFence) return;
                poisonConfirmedFence('FORCE_UNSAFE_RELEASE');
                // Force-clear tip lock WITHOUT writer exit — proves EXECUTE must still DENY.
                const gid = activeFence.grantId;
                clearFenceTimers();
                abandonedGrantIds.add(gid);
                poisonedGrantIds.add(gid);
                activeFence = null;
                flushPendingTipExtras();
                tipState.seq += 1;
                tipState.tipSha = `unsafe-confirm-release-${randomId(8)}`;
                tipState.revocationEpoch += 1;
              }, forceUnsafeReleaseAfterConfirmMs);
            }
            const confirmAck = {
              v: PROTOCOL_VERSION,
              kind: PROTOCOL_KIND,
              type: MSG.FENCE_CONFIRM_ACK,
              ok: true,
              grantId: activeFence.grantId,
              tipSha: activeFence.tipSha,
              seq: activeFence.seq,
              rule02Digest: activeFence.rule02Digest,
              revocationEpoch: activeFence.revocationEpoch,
              ts: now,
              exp: confirmExp,
              authorityId: tipAuthorityId,
              state: FENCE_STATES.CONFIRMED,
            };
            if (delayedConfirmAckMs > 0) {
              const delay = delayedConfirmAckMs;
              setTimeout(() => {
                try { socket.write(encodeFrame(confirmAck)); } catch { /* ignore */ }
              }, delay);
            } else {
              socket.write(encodeFrame(confirmAck));
            }
          } else if (msg.type === MSG.FENCE_EXECUTE_REQ) {
            const now = syncAuthorityClock();
            if (!activeFence || msg.grantId !== activeFence.grantId) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: [
                  'FENCE_EXECUTE_INACTIVE',
                  'GRANT_EXPIRED_OR_UNKNOWN',
                  'CONFIRM_ACK_NOT_STANDING_AUTHORITY',
                ],
              }));
              continue;
            }
            if (activeFence.state === FENCE_STATES.UNKNOWN_POISONED
              || activeFence.state === FENCE_STATES.ABORTED
              || activeFence.state === FENCE_STATES.WRITER_TERMINATED
              || activeFence.state === FENCE_STATES.COMPLETED) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: [
                  'FENCE_UNKNOWN_POISONED',
                  'NO_MUTATION_UNDER_OBSOLETE_FENCE',
                ],
              }));
              continue;
            }
            if (activeFence.state !== FENCE_STATES.CONFIRMED
              && activeFence.state !== FENCE_STATES.MUTATION_POSSIBLE) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_EXECUTE_REQUIRES_CONFIRMED'],
              }));
              continue;
            }
            if (activeFence.executedOnce === true) {
              poisonConfirmedFence('SECOND_EXECUTE_ATTEMPT');
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['NO_SECOND_MUTATION', 'EXECUTE_ALREADY_CONSUMED'],
              }));
              continue;
            }
            if (msg.writerAudience !== activeFence.writerAudience
              || msg.trustEpoch !== activeFence.trustEpoch
              || (msg.jti && msg.jti !== activeFence.jti)) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_EXECUTE_IDENTITY'],
              }));
              continue;
            }
            if (msg.tipSha !== activeFence.tipSha
              || msg.seq !== activeFence.seq
              || msg.rule02Digest !== activeFence.rule02Digest
              || msg.revocationEpoch !== activeFence.revocationEpoch
              || tipState.tipSha !== activeFence.tipSha
              || tipState.seq !== activeFence.seq
              || tipState.revocationEpoch !== activeFence.revocationEpoch) {
              poisonConfirmedFence('EXECUTE_TIP_DRIFT');
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_EXECUTE_TIP_DRIFT'],
              }));
              continue;
            }
            activeFence.executedOnce = true;
            activeFence.state = FENCE_STATES.MUTATION_POSSIBLE;
            // Mutation in flight: cancel soft timeout; tip stays frozen until COMPLETE / Writer exit.
            clearFenceTimers();
            // Stamp authorization-time NOW; delayed delivery must not rewrite ts (RED-02).
            const executeAck = {
              v: PROTOCOL_VERSION,
              kind: PROTOCOL_KIND,
              type: MSG.FENCE_EXECUTE_ACK,
              ok: true,
              grantId: activeFence.grantId,
              tipSha: activeFence.tipSha,
              seq: activeFence.seq,
              rule02Digest: activeFence.rule02Digest,
              revocationEpoch: activeFence.revocationEpoch,
              ts: now,
              state: FENCE_STATES.MUTATION_POSSIBLE,
              authorityId: tipAuthorityId,
            };
            if (delayedExecuteAckMs > 0) {
              const delay = delayedExecuteAckMs;
              setTimeout(() => {
                try { socket.write(encodeFrame(executeAck)); } catch { /* ignore */ }
              }, delay);
            } else {
              socket.write(encodeFrame(executeAck));
            }
          } else if (msg.type === MSG.FENCE_COMPLETE_REQ) {
            if (!activeFence || msg.grantId !== activeFence.grantId) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_STALE_OR_UNKNOWN_GRANT'],
              }));
              continue;
            }
            if (msg.writerAudience !== activeFence.writerAudience
              || msg.trustEpoch !== activeFence.trustEpoch) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_COMPLETE_AUDIENCE'],
              }));
              continue;
            }
            const outcome = msg.outcome;
            if (!['COMMITTED', 'ABORTED', 'POISONED', 'UNKNOWN'].includes(outcome)) {
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.FENCE_DENY, ok: false,
                decision: 'DENY_FENCE', reasons: ['FENCE_OUTCOME_INVALID'],
              }));
              continue;
            }
            // UNKNOWN / POISONED outcomes permanently poison; tip flush only after conclusive termination.
            if (outcome === 'UNKNOWN' || outcome === 'POISONED') {
              poisonConfirmedFence(`COMPLETE_${outcome}`);
              completedGrantIds.add(activeFence.grantId);
              const grantId = activeFence.grantId;
              // Keep tip frozen until Writer exit evidence for UNKNOWN; ABORT/POISONED may release.
              if (outcome === 'POISONED') {
                clearActiveFence('COMPLETE', { advanceTip: false });
              }
              socket.write(encodeFrame({
                v: PROTOCOL_VERSION,
                kind: PROTOCOL_KIND,
                type: MSG.FENCE_COMPLETE_ACK,
                ok: true,
                grantId,
                outcome,
                state: FENCE_STATES.UNKNOWN_POISONED,
              }));
              continue;
            }
            completedGrantIds.add(activeFence.grantId);
            const grantId = activeFence.grantId;
            if (outcome === 'ABORTED') {
              activeFence.state = FENCE_STATES.ABORTED;
            } else {
              activeFence.state = FENCE_STATES.COMPLETED;
            }
            clearActiveFence('COMPLETE');
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION,
              kind: PROTOCOL_KIND,
              type: MSG.FENCE_COMPLETE_ACK,
              ok: true,
              grantId,
              outcome,
            }));
          } else {
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
              decision: 'DENY_FRESHNESS', reasons: ['UNEXPECTED'],
            }));
          }
        }
      } catch {
        try { socket.destroy(); } catch { /* ignore */ }
      }
    });
  });
  await new Promise((resolve, reject) => {
    tipServer.once('error', reject);
    tipServer.listen(tipSocket, resolve);
  });

  // In-process branded trust for unit-level helpers
  const inProcess = withPrivilegedOwnerInstructionConstruction(() => {
    const ctors = getPrivilegedOwnerInstructionConstructors();
    const keyRegistry = ctors.createOwnerInstructionKeyRegistry([{
      kid: ownerKid,
      issuer: ownerIssuer,
      publicKeyPem: ownerKeys.publicKeyPem,
      privateKeyPem: ownerKeys.privateKeyPem,
      algorithm: 'Ed25519',
      status: 'ACTIVE',
    }]);
    const revocationRegistry = ctors.createOwnerInstructionRevocationRegistry();
    const clock = ctors.createOwnerInstructionClock(clockStartMs);
    const ownerVerifier = ctors.createOwnerImplementationInstructionVerifier({
      keyRegistry,
      revocationRegistry,
      clock,
      consumeOnAllow: true,
    });
    const mergeAttestation = createDisposableMergedProvenanceAttestation(
      mergeAttestationSpec,
      DISPOSABLE_BROKER_TRUST_TOKEN,
    );
    const brokerTrust = createDisposableBrokerTrust({
      privilegedTrustInjection: DISPOSABLE_BROKER_TRUST_TOKEN,
      keyRegistry,
      revocationRegistry,
      clock,
      ownerVerifier,
      mergeAttestation,
      rule02Text,
      canonicalSha,
      rule02DigestSha256: rule02Digest,
      governanceRevision: GOVERNANCE_REVISION,
      issuerId: brokerIssuer,
      trustEpoch,
      ticketPrivateKeyPem: ticketKeys.privateKeyPem,
      ticketPublicKeyPem: ticketKeys.publicKeyPem,
      ticketKid,
      writerAudience,
    });
    return {
      keyRegistry, revocationRegistry, clock, ownerVerifier, mergeAttestation, brokerTrust,
    };
  });

  function issueDlp012OwnerInstruction(overrides = {}) {
    return issueOwnerImplementationInstruction({
      purpose: OWNER_INSTRUCTION_PURPOSE,
      repositoryId: DLP012_REPOSITORY_ID,
      sliceId: overrides.sliceId || DLP012_SLICE_ID,
      canonicalSha: overrides.canonicalSha || canonicalSha,
      rule02DigestSha256: overrides.rule02DigestSha256 || rule02Digest,
      operationClass: overrides.operationClass || DLP012_NATIVE_OPERATION,
      governanceRevision: overrides.governanceRevision || GOVERNANCE_REVISION,
      authorizedFileScope: overrides.authorizedFileScope || [...DLP012_AUTHORIZED_FILE_SCOPE],
      issuer: ownerIssuer,
      kid: ownerKid,
      ttlMs: overrides.ttlMs || 120_000,
      jti: overrides.jti || randomId(16),
    }, {
      keyRegistry: inProcess.keyRegistry,
      clock: inProcess.clock,
    });
  }

  function issueDlp011StyleOwnerInstruction() {
    return issueOwnerImplementationInstruction({
      purpose: OWNER_INSTRUCTION_PURPOSE,
      repositoryId: DLP012_REPOSITORY_ID,
      sliceId: 'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE',
      canonicalSha,
      rule02DigestSha256: rule02Digest,
      operationClass: 'CREATE_AUTHORIZED_FOUR_PATH_DISPOSABLE_PROOF',
      governanceRevision: 'DLP011_IMPLEMENTATION_ACTIVATION_20261103',
      authorizedFileScope: [
        'tecp/src/effectiveImplementationAuthorizationGate.js',
        'tecp/src/ownerImplementationInstruction.js',
        'tecp/test/effectiveImplementationAuthorizationGate.test.js',
        'tecp/test/disposableMergeEffectivenessHarness.js',
      ],
      issuer: ownerIssuer,
      kid: ownerKid,
      ttlMs: 120_000,
      jti: randomId(16),
    }, {
      keyRegistry: inProcess.keyRegistry,
      clock: inProcess.clock,
    });
  }

  const writerPin = createWriterTrustPin({
    brokerKid: ticketKid,
    brokerPublicKeyPem: ticketKeys.publicKeyPem,
    brokerIssuerId: brokerIssuer,
    writerAudienceId: writerAudience,
    trustEpoch,
    mutationRoot,
    tipAuthorityPublicKeyPem: tipKeys.publicKeyPem,
    tipAuthorityId,
    tipSocketPath: tipSocket,
    clockStartMs,
  }, DISPOSABLE_WRITER_PIN_TOKEN);
  applyAuthenticatedTipUpdate(writerPin, initialTipUpdate);
  if (Number.isSafeInteger(options.pauseAfterFenceMs) && options.pauseAfterFenceMs > 0) {
    configureWriterCrashHooks(writerPin, { pauseAfterFenceMs: options.pauseAfterFenceMs });
  }
  if (Number.isSafeInteger(options.pauseAfterConfirmMs) && options.pauseAfterConfirmMs > 0) {
    configureWriterCrashHooks(writerPin, { pauseAfterConfirmMs: options.pauseAfterConfirmMs });
  }
  if (Number.isSafeInteger(options.pauseAfterExecuteMs) && options.pauseAfterExecuteMs > 0) {
    configureWriterCrashHooks(writerPin, { pauseAfterExecuteMs: options.pauseAfterExecuteMs });
  }
  if (Number.isSafeInteger(options.pauseAfterPreMutationAssertionMs)
    && options.pauseAfterPreMutationAssertionMs > 0) {
    configureWriterCrashHooks(writerPin, {
      pauseAfterPreMutationAssertionMs: options.pauseAfterPreMutationAssertionMs,
    });
  }

  const brokerBootstrap = {
    mode: 'broker-child-v1',
    privilegedTrustInjection: DISPOSABLE_BROKER_TRUST_TOKEN,
    socketPath: brokerSocket,
    keyEntries: [{
      kid: ownerKid,
      issuer: ownerIssuer,
      publicKeyPem: ownerKeys.publicKeyPem,
      // Broker verifies only — no Owner private key in Broker.
      algorithm: 'Ed25519',
      status: 'ACTIVE',
    }],
    revokedJtis: [],
    clockStartMs,
    mergeAttestation: mergeAttestationSpec,
    rule02Text,
    canonicalSha,
    rule02DigestSha256: rule02Digest,
    governanceRevision: GOVERNANCE_REVISION,
    issuerId: brokerIssuer,
    trustEpoch,
    ticketPrivateKeyPem: ticketKeys.privateKeyPem,
    ticketPublicKeyPem: ticketKeys.publicKeyPem,
    ticketKid,
    writerAudience,
  };

  const writerBootstrap = {
    mode: 'writer-child-v1',
    privilegedPinInjection: DISPOSABLE_WRITER_PIN_TOKEN,
    socketPath: writerSocket,
    brokerKid: ticketKid,
    brokerPublicKeyPem: ticketKeys.publicKeyPem,
    brokerIssuerId: brokerIssuer,
    writerAudienceId: writerAudience,
    trustEpoch,
    mutationRoot,
    tipAuthorityPublicKeyPem: tipKeys.publicKeyPem,
    tipAuthorityId,
    tipSocketPath: tipSocket,
    clockStartMs,
    initialTipUpdate,
    crashAfterMutate: options.writerCrashAfterMutate === true,
    crashBeforeMutate: options.writerCrashBeforeMutate === true,
    forceAmbiguous: options.writerForceAmbiguous === true,
    pauseAfterFenceMs: Number.isSafeInteger(options.pauseAfterFenceMs)
      ? options.pauseAfterFenceMs
      : 0,
    pauseAfterConfirmMs: Number.isSafeInteger(options.pauseAfterConfirmMs)
      ? options.pauseAfterConfirmMs
      : 0,
    pauseAfterExecuteMs: Number.isSafeInteger(options.pauseAfterExecuteMs)
      ? options.pauseAfterExecuteMs
      : 0,
    pauseAfterPreMutationAssertionMs: Number.isSafeInteger(options.pauseAfterPreMutationAssertionMs)
      ? options.pauseAfterPreMutationAssertionMs
      : 0,
  };

  function spawnWithFd(scriptPath, args, bootstrapObj) {
    const bootstrapPath = join(tempRoot, `boot-${randomId(4)}.json`);
    writeFileSync(bootstrapPath, JSON.stringify(bootstrapObj), { mode: 0o600 });
    const fd = openSync(bootstrapPath, 'r');
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe', fd],
      cwd: ROOT,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        // No secrets in env.
      },
    });
    try { closeSync(fd); } catch { /* ignore */ }
    children.push(child);
    return child;
  }

  let brokerChild = null;
  let writerChild = null;
  let workerChild = null;
  let topology = null;

  if (options.spawnProcesses !== false) {
    brokerChild = spawnWithFd(BROKER_SRC, ['--dlp012-broker'], brokerBootstrap);
    writerChild = spawnWithFd(WRITER_SRC, ['--dlp012-writer'], writerBootstrap);
    writerChild.on('exit', (code, signal) => {
      onWriterProcessExit(code, signal);
    });

    const brokerReady = await waitForListening(brokerChild);
    const writerReady = await waitForListening(writerChild);

    // Worker child: untrusted client process — no private keys.
    const workerBootstrap = {
      mode: 'worker-child-v1',
      brokerSocket,
      writerSocket,
      // Only encoded instruction if provided later via IPC control — worker starts idle.
    };
    workerChild = spawnWithFd(HARNESS_SRC, ['--dlp012-worker'], workerBootstrap);
    const workerReady = await waitForListening(workerChild);

    topology = Object.freeze({
      brokerPid: brokerReady.pid,
      writerPid: writerReady.pid,
      workerPid: workerReady.pid,
      parentPid: process.pid,
      distinct: new Set([brokerReady.pid, writerReady.pid, workerReady.pid]).size === 3,
    });
  }

  async function mintViaBrokerIpc(ownerInstructionEncoded, extras = {}) {
    return ipcRequest(brokerSocket, {
      v: PROTOCOL_VERSION,
      kind: PROTOCOL_KIND,
      type: MSG.MINT_TICKET_REQ,
      requestId: extras.requestId || randomId(8),
      ownerInstructionEncoded,
      tipSha: extras.tipSha,
      rule02Digest: extras.rule02Digest,
      mutationRelativePath: extras.mutationRelativePath || defaultMutPath,
      mutationContent: extras.mutationContent || defaultMutContent,
      ttlMs: extras.ttlMs,
      validatorAllowOnly: extras.validatorAllowOnly === true,
      rule02YesOnly: extras.rule02YesOnly === true,
      acceptDlp011Allow: extras.acceptDlp011Allow === true,
      dlp011OwnerInstructionEncoded: extras.dlp011OwnerInstructionEncoded,
    });
  }

  async function writeViaWriterIpc(ticketEncoded, mutationRelativePath, extras = {}) {
    // Adversarial pauses / delayed EXECUTE_ACK can exceed the default 3s IPC budget.
    const timeoutMs = Number.isSafeInteger(extras.timeoutMs) && extras.timeoutMs > 0
      ? extras.timeoutMs
      : 60_000;
    return ipcRequest(writerSocket, {
      v: PROTOCOL_VERSION,
      kind: PROTOCOL_KIND,
      type: MSG.WRITE_REQ,
      requestId: extras.requestId || randomId(8),
      ticketEncoded,
      mutationRelativePath: mutationRelativePath || defaultMutPath,
      mutationAbsolutePath: extras.mutationAbsolutePath,
      content: Object.prototype.hasOwnProperty.call(extras, 'content')
        ? extras.content
        : defaultMutContent,
    }, timeoutMs);
  }

  async function workerRequest(action, payload = {}) {
    if (!workerChild) throw new Error('NO_WORKER');
    // Worker listens on a control socket path derived from bootstrap.
    const controlSock = join(socketDir, 'worker-control.sock');
    // Worker child creates control socket — wait briefly if needed.
    for (let i = 0; i < 20 && !existsSync(controlSock); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return ipcRequest(controlSock, {
      v: PROTOCOL_VERSION,
      kind: PROTOCOL_KIND,
      type: 'WORKER_CTRL',
      action,
      ...payload,
    });
  }

  function listMutationFiles() {
    if (!existsSync(mutationRoot)) return [];
    return readdirSync(mutationRoot).filter((n) => !n.endsWith('.tmp'));
  }

  function childExited(c) {
    return c.exitCode !== null || c.signalCode !== null;
  }

  async function waitForChildExits(ms) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (children.every(childExited)) return true;
      // Yield so Node can deliver 'exit' and update exitCode/signalCode.
      await new Promise((r) => setTimeout(r, 25));
    }
    return children.every(childExited);
  }

  async function killOwnedChildren() {
    for (const child of children) {
      if (!childExited(child)) {
        try { child.kill('SIGTERM'); } catch { /* ignore */ }
      }
    }
    await waitForChildExits(2000);
    for (const child of children) {
      if (!childExited(child)) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }
    // Final SIGKILL must be observed before orphan accounting (I03).
    await waitForChildExits(2000);
  }

  async function cleanup() {
    if (cleaned) return { ok: true, already: true };
    cleaned = true;
    await killOwnedChildren();
    try { tipServer.close(); } catch { /* ignore */ }
    // Only remove harness-owned temp root with marker.
    if (existsSync(join(tempRoot, HARNESS_MARKER))) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    return {
      ok: true,
      orphans: children.filter((c) => !childExited(c)).length,
      tempExists: existsSync(tempRoot),
    };
  }

  return {
    tempRoot,
    mutationRoot,
    brokerSocket,
    writerSocket,
    tipSocket,
    topology,
    children: { brokerChild, writerChild, workerChild },
    keys: Object.freeze({
      // Public materials only on the returned handle.
      ownerPublicKeyPem: ownerKeys.publicKeyPem,
      ticketPublicKeyPem: ticketKeys.publicKeyPem,
      tipPublicKeyPem: tipKeys.publicKeyPem,
      ownerKid,
      ticketKid,
      // Private keys intentionally NOT exported.
      workerHasOwnerPrivate: false,
      workerHasTicketPrivate: false,
      writerHasOwnerPrivate: false,
      writerHasTicketPrivate: false,
    }),
    // Privileged in-process APIs for focused unit tests:
    inProcess,
    writerPin,
    issueDlp012OwnerInstruction,
    issueDlp011StyleOwnerInstruction,
    mintInProcess: (encoded, extras = {}) => mintWriterTicket(inProcess.brokerTrust, {
      ownerInstructionEncoded: encoded,
      requestId: extras.requestId || randomId(8),
      mutationRelativePath: extras.mutationRelativePath || defaultMutPath,
      mutationContent: extras.mutationContent || defaultMutContent,
      ...extras,
    }),
    mintViaBrokerIpc,
    writeViaWriterIpc,
    workerRequest,
    defaultMutPath,
    defaultMutContent,
    executeInProcessWrite: (ticketEncoded, path, extras = {}) => executeAuthorizedWrite(writerPin, {
      ticketEncoded,
      mutationRelativePath: path || defaultMutPath,
      content: Object.prototype.hasOwnProperty.call(extras, 'content')
        ? extras.content
        : defaultMutContent,
      ...extras,
    }),
    publishTipUpdate: (extra) => {
      const update = signTipUpdate(extra);
      // Push to in-process writer pin (child Writers learn via tip assertions).
      if (!update.deferred) {
        applyAuthenticatedTipUpdate(writerPin, update);
      }
      return update;
    },
    /**
     * Adversarial tip authority transition: may decrease revocationEpoch and
     * replace revokedJtis list. Used to prove Writer sticky/monotonic rejection.
     */
    adversarialTipTransition: (extra = {}) => {
      if (activeFence) {
        throw new Error('ADVERSARIAL_TIP_DURING_FENCE');
      }
      applyTipExtraToState(extra, { allowReplaceRevoked: true });
      const ts = syncAuthorityClock();
      const claims = {
        authorityId: tipAuthorityId,
        revocationEpoch: tipState.revocationEpoch,
        revokedJtis: [...tipState.revokedJtis],
        rule02Digest: tipState.rule02Digest,
        seq: tipState.seq,
        tipSha: tipState.tipSha,
        ts,
        v: 1,
      };
      const payload = tipUpdatePayload(claims);
      const sig = signEd25519(tipKeys.privateKeyPem, payload);
      const update = { ...claims, sig };
      applyAuthenticatedTipUpdate(writerPin, update);
      return update;
    },
    tipState,
    getActiveFence: () => (activeFence ? { ...activeFence } : null),
    getAbandonedGrantIds: () => [...abandonedGrantIds],
    getPoisonedGrantIds: () => [...poisonedGrantIds],
    getWriterExitEvidence: () => writerExitEvidence,
    getPendingTipExtraCount: () => pendingTipExtras.length,
    signTipAssertionForTest: (nonce) => signTipAssertion(nonce),
    advanceClock: (ms) => {
      tipState.manualOffsetMs += ms;
      tipState.clockMs = authorityNowMs();
      inProcess.clock.advance(ms);
      advanceWriterClock(writerPin, ms);
    },
    /**
     * Align frozen in-process mint clock to current wall-synced Tip Authority time.
     * Required for short-TTL disposable expiry races: Broker mint clock is otherwise
     * frozen at bootstrap while Tip Authority advances with wall time.
     */
    syncMintClockToAuthority: () => {
      tipState.clockMs = authorityNowMs();
      inProcess.clock.set(tipState.clockMs);
      return tipState.clockMs;
    },
    resetAssertionServeCount: () => { assertionServeCount = 0; },
    listMutationFiles,
    revokeOwnerJti: (jti) => inProcess.revocationRegistry.revokeJti(jti),
    forgeTicket: ({ claims, privateKeyPem, includeUnknownFields = false }) => {
      // Adversarial helper: optionally retain unknown fields so Writer can DENY_EXTRA_FIELD.
      const p = includeUnknownFields
        ? `TECP_DLP012_TICKET_V1\n${canonicalJson(claims)}`
        : ticketSigningPayload(orderedTicketClaims(claims));
      const sig = signEd25519(privateKeyPem || ticketKeys.privateKeyPem, p);
      return `${Buffer.from(p, 'utf8').toString('base64url')}.${sig}`;
    },
    // Expose ticket private only inside harness for forgery tests (never to worker).
    _testOnlyTicketPrivateKeyPem: ticketKeys.privateKeyPem,
    _testOnlyOwnerPrivateKeyPem: ownerKeys.privateKeyPem,
    _testOnlyTipPrivateKeyPem: tipKeys.privateKeyPem,
    _testOnlyWrongKeys: generateEd25519KeyPair(),
    spawnWriterRestart: async (extraBoot = {}) => {
      if (writerChild && writerChild.exitCode === null) {
        try { writerChild.kill('SIGTERM'); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 100));
      }
      const newEpoch = `epoch-${randomId(8)}`;
      const boot = {
        ...writerBootstrap,
        trustEpoch: newEpoch,
        ...extraBoot,
        initialTipUpdate: signTipUpdate(),
      };
      writerChild = spawnWithFd(WRITER_SRC, ['--dlp012-writer'], boot);
      writerChild.on('exit', (code, signal) => {
        onWriterProcessExit(code, signal);
      });
      children.push(writerChild);
      const ready = await waitForListening(writerChild);
      return { pid: ready.pid, trustEpoch: newEpoch };
    },
    killBroker: () => {
      if (brokerChild) brokerChild.kill('SIGKILL');
    },
    killWriter: () => {
      if (writerChild) writerChild.kill('SIGKILL');
    },
    cleanup,
    constants: Object.freeze({
      DLP012_SLICE_ID,
      DLP012_NATIVE_OPERATION,
      DLP012_AUTHORIZED_FILE_SCOPE,
      DLP012_REPOSITORY_ID,
      CANONICAL_BASE_SHA,
      GOVERNANCE_REVISION,
      rule02Digest,
      canonicalSha,
      trustEpoch,
    }),
  };
}

/** Worker child entry — untrusted simulated client. */
export async function runWorkerMainFromFd() {
  const bootstrap = JSON.parse(readFileSync('/dev/fd/3', 'utf8'));
  if (bootstrap.mode !== 'worker-child-v1') throw new Error('BAD_WORKER_BOOTSTRAP');
  const controlSock = join(dirname(bootstrap.brokerSocket), 'worker-control.sock');
  const server = createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', async (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          if (msg.action === 'MINT') {
            const res = await ipcRequest(bootstrap.brokerSocket, {
              v: PROTOCOL_VERSION,
              kind: PROTOCOL_KIND,
              type: MSG.MINT_TICKET_REQ,
              requestId: msg.requestId || randomId(8),
              ownerInstructionEncoded: msg.ownerInstructionEncoded,
              tipSha: msg.tipSha,
              rule02Digest: msg.rule02Digest,
              mutationRelativePath: msg.mutationRelativePath,
              mutationContent: msg.mutationContent,
              ttlMs: msg.ttlMs,
              acceptDlp011Allow: msg.acceptDlp011Allow === true,
              validatorAllowOnly: msg.validatorAllowOnly === true,
              rule02YesOnly: msg.rule02YesOnly === true,
              dlp011OwnerInstructionEncoded: msg.dlp011OwnerInstructionEncoded,
            });
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: 'WORKER_CTRL_RES',
              ok: res.ok, decision: res.decision, ticketEncoded: res.ticketEncoded, reasons: res.reasons,
            }));
          } else if (msg.action === 'WRITE') {
            const res = await ipcRequest(bootstrap.writerSocket, {
              v: PROTOCOL_VERSION,
              kind: PROTOCOL_KIND,
              type: MSG.WRITE_REQ,
              requestId: msg.requestId || randomId(8),
              ticketEncoded: msg.ticketEncoded,
              mutationRelativePath: msg.mutationRelativePath,
              mutationAbsolutePath: msg.mutationAbsolutePath,
              content: msg.content,
            });
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: 'WORKER_CTRL_RES',
              ok: res.ok, decision: res.decision, mutated: res.mutated, state: res.state, reasons: res.reasons,
            }));
          } else if (msg.action === 'PROBE_KEYS') {
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: 'WORKER_CTRL_RES',
              ok: true,
              hasOwnerPrivate: false,
              hasTicketPrivate: false,
              envSecretKeys: Object.keys(process.env).filter((k) => /KEY|SECRET|TOKEN|PASSWORD/i.test(k)),
            }));
          } else {
            socket.write(encodeFrame({
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: 'WORKER_CTRL_RES',
              ok: false, decision: 'UNKNOWN_ACTION',
            }));
          }
        }
      } catch (err) {
        try {
          socket.write(encodeFrame({
            v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: 'WORKER_CTRL_RES',
            ok: false, decision: 'WORKER_ERROR', reasons: [String(err && err.message || err)],
          }));
        } catch { /* ignore */ }
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(controlSock, resolve);
  });
  process.on('SIGTERM', () => {
    try { server.close(); } catch { /* ignore */ }
    process.exit(0);
  });
  process.stdout.write(`${JSON.stringify({ ok: true, pid: process.pid, role: 'worker' })}\n`);
}

const isMain = process.argv[1] && /disposableIsolatedBrokerHarness\.js$/.test(process.argv[1]);
if (isMain && process.argv.includes('--dlp012-worker')) {
  runWorkerMainFromFd().catch((err) => {
    process.stderr.write(`${String(err && err.stack || err)}\n`);
    process.exit(1);
  });
}

export {
  DLP012_SLICE_ID,
  DLP012_NATIVE_OPERATION,
  DLP012_AUTHORIZED_FILE_SCOPE,
  sha256Hex,
};
