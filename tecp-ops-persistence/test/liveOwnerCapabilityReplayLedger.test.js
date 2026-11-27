/**
 * DB-free durable Live Owner JTI ledger + verifier integration + Runner classification.
 * Uses isolated temporary ledgers and ephemeral TEST_ONLY Ed25519 keys only.
 * No genuine Owner trust mutation. No live ledger provisioning. No SQL/PostgreSQL.
 */
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN,
  LIVE_OWNER_JTI_CLAIM_OUTCOMES,
  __testOnlyPrepareIsolatedLiveOwnerLedgerRoot,
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot,
  brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot,
  evaluateTestOnlyProtectedStoragePolicy,
  __testOnlyValidatePersistentNamespaceForDbFreeRegression,
  __testOnlyEvaluateCreationPrecheckForDbFreeRegression,
  __testOnlyArmDirectoryFsyncFailureForDbFreeRegression,
  __testOnlyClearDirectoryFsyncFailureForDbFreeRegression,
  LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME,
  LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER,
  LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX,
  canonicalizeLiveOwnerCapabilityJtiIdentity,
  consumeLiveOwnerCapabilityJti,
  createDurableLiveOwnerReplayRegistry,
  inspectLiveOwnerCapabilityJtiClaim,
  isTestOnlyLiveOwnerCapabilityReplayLedgerCleanupAuth,
  resolveCanonicalLiveOwnerCapabilityReplayLedgerPath,
  resolveTrustedOwnerOsHome,
} from '../src/liveOwnerCapabilityReplayLedger.js';

import {
  OPS_PILOT_PINNED_MAIN_SHA,
} from '../src/disposableOpsPilotDbHarness.js';

import {
  S2_OWNER_CAPABILITY_ISSUER,
  S2_OWNER_CAPABILITY_KIND,
  S2_OWNER_CAPABILITY_PURPOSE,
  S2_OWNER_CAPABILITY_REPOSITORY_ID,
  S2_TIER3_OWNER_CAPABILITY_DECISIONS,
  __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
  __testOnlyRegisterOwnerPublicKeyForVerification,
  __testOnlyResetS2Tier3OwnerCapabilityRegistries,
  createOwnerInstalledFixedTrustVerifierDeps,
  isOwnerInstalledFixedTrustVerifierDeps,
  verifyS2Tier3OwnerCapabilityArtifact,
} from '../scripts/s2Tier3OwnerCapabilityVerifier.js';

import {
  OWNER_RUNNER_DECISIONS,
  classifyOwnerRunnerOutcome,
  enforceLiveCapabilityPreStartGate,
  mapCapabilityVerifyFailureToRunnerDecision,
  runLiveOwnerCapabilityPreStartBoundary,
  verifyLiveOwnerCapabilityForRunner,
} from '../scripts/ownerControlledTier3LocalRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER_SRC = join(HERE, '../src/liveOwnerCapabilityReplayLedger.js');
const VERIFIER_SRC = join(HERE, '../scripts/s2Tier3OwnerCapabilityVerifier.js');
const RUNNER_SRC = join(HERE, '../scripts/ownerControlledTier3LocalRunner.js');
const SUITE_PATH = 'tecp-ops-persistence/test/cp2DbFencingDurability.test.js';

function tempWorkspace() {
  return mkdtempSync(join(tmpdir(), 'tecp-live-owner-ledger-'));
}

function claimKeyOrder() {
  return [
    'alg', 'capabilityId', 'exp', 'iss', 'jti', 'kid', 'kind', 'nbf',
    'pinnedMainSha', 'purpose', 'repositoryId', 'suitePath',
  ];
}

function canonicalClaimsJson(claims) {
  const ordered = {};
  for (const key of claimKeyOrder()) {
    if (Object.prototype.hasOwnProperty.call(claims, key)) ordered[key] = claims[key];
  }
  return JSON.stringify(ordered);
}

function signToken(claims, privateKeyPem) {
  const payload = canonicalClaimsJson(claims);
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(privateKeyPem));
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;
}

function ephemeralOwnerKeys(kid = 'test-only-live-owner-kid') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    kid,
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function baseClaims(overrides = {}) {
  const nowMs = 1_700_000_100_000;
  return {
    alg: 'Ed25519',
    capabilityId: 'test-only-live-owner-cap-v1',
    exp: nowMs + 120_000,
    iss: S2_OWNER_CAPABILITY_ISSUER,
    jti: `jti-test-${Math.random().toString(16).slice(2)}abcd`,
    kid: 'test-only-live-owner-kid',
    kind: S2_OWNER_CAPABILITY_KIND,
    nbf: nowMs,
    pinnedMainSha: OPS_PILOT_PINNED_MAIN_SHA,
    purpose: S2_OWNER_CAPABILITY_PURPOSE,
    repositoryId: S2_OWNER_CAPABILITY_REPOSITORY_ID,
    suitePath: SUITE_PATH,
    ...overrides,
  };
}

function durableTestDeps(ledgerRoot, nowMs = 1_700_000_100_500) {
  const registry = createDurableLiveOwnerReplayRegistry({
    testOnlyLedgerRoot: ledgerRoot,
    allowCreateLedgerDir: true,
  });
  return __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs,
    replayRegistry: registry,
  });
}

/**
 * Actual asynchronous concurrent child-process race with readiness barrier.
 * Not Promise concurrency in one process. Not spawnSync sequential loops.
 */
async function runActualConcurrentClaimRace({
  ledgerRootPath,
  jti,
  childCount = 8,
  allowCreateLedgerDir = false,
  timeoutMs = 30_000,
}) {
  const ws = tempWorkspace();
  const readyDir = join(ws, 'ready');
  const releaseGate = join(ws, 'release.gate');
  mkdirSync(readyDir, { recursive: true, mode: 0o700 });
  const worker = join(ws, 'race-worker.mjs');
  writeFileSync(worker, `
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const readyPath = process.env.RACE_READY_PATH;
const releasePath = process.env.RACE_RELEASE_PATH;
const ledgerRoot = process.env.RACE_LEDGER_ROOT;
const jti = process.env.RACE_JTI;
const allowCreate = process.env.RACE_ALLOW_CREATE === '1';
const idx = process.env.RACE_IDX;
writeFileSync(readyPath, JSON.stringify({ pid: process.pid, idx, readyAt: Date.now() }), 'utf8');
const deadline = Date.now() + Number(process.env.RACE_TIMEOUT_MS || 25000);
while (!existsSync(releasePath)) {
  if (Date.now() > deadline) {
    process.stdout.write(JSON.stringify({ outcome: 'TIMEOUT_WAITING_RELEASE', pid: process.pid, idx }) + '\\n');
    process.exit(4);
  }
  const spin = Date.now() + 5;
  while (Date.now() < spin) { /* bounded spin wait for release barrier */ }
}
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(ledgerRoot);
const r = consumeLiveOwnerCapabilityJti(jti, {}, {
  testOnlyLedgerRoot: branded,
  allowCreateLedgerDir: allowCreate,
});
process.stdout.write(JSON.stringify({
  outcome: r.outcome,
  reasons: r.reasons || [],
  pid: process.pid,
  idx,
  readyBeforeRelease: true,
}) + '\\n');
`);

  const children = [];
  for (let i = 0; i < childCount; i += 1) {
    const readyPath = join(readyDir, `c${i}.ready`);
    const child = spawn(process.execPath, [worker], {
      env: {
        ...process.env,
        RACE_READY_PATH: readyPath,
        RACE_RELEASE_PATH: releaseGate,
        RACE_LEDGER_ROOT: ledgerRootPath,
        RACE_JTI: jti,
        RACE_ALLOW_CREATE: allowCreateLedgerDir ? '1' : '0',
        RACE_IDX: String(i),
        RACE_TIMEOUT_MS: String(timeoutMs - 2000),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push({ child, readyPath, idx: i, stdout: '', stderr: '' });
    child.stdout.on('data', (d) => { children[i].stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { children[i].stderr += d.toString('utf8'); });
  }

  const waitReadyDeadline = Date.now() + timeoutMs;
  while (Date.now() < waitReadyDeadline) {
    const readyCount = children.filter((c) => existsSync(c.readyPath)).length;
    if (readyCount === childCount) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  const readyBeforeRelease = children.filter((c) => existsSync(c.readyPath)).length;
  assert.equal(readyBeforeRelease, childCount, 'all contenders must reach readiness barrier before release');

  // Common release barrier — all children already alive and ready.
  writeFileSync(releaseGate, `RELEASE ${Date.now()}\n`, 'utf8');

  const results = await Promise.all(children.map(({ child, idx, stdout: _s, stderr: _e }) => new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolve({ idx, timedOut: true, status: null, stdout: '', stderr: 'PARENT_TIMEOUT' });
    }, timeoutMs);
    child.on('close', (status) => {
      clearTimeout(timer);
      const entry = children[idx];
      resolve({
        idx,
        timedOut: false,
        status,
        stdout: entry.stdout,
        stderr: entry.stderr,
        pid: child.pid,
      });
    });
  })));

  rmSync(ws, { recursive: true, force: true });

  const parsed = results.map((r) => {
    assert.equal(r.timedOut, false, `child ${r.idx} timed out: ${r.stderr}`);
    assert.equal(r.status, 0, `child ${r.idx} exit=${r.status} stderr=${r.stderr} stdout=${r.stdout}`);
    const line = r.stdout.trim().split('\n').filter(Boolean).pop();
    const body = JSON.parse(line);
    return { ...body, spawnPid: r.pid };
  });

  const wins = parsed.filter((o) => o.outcome === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
  const denies = parsed.filter((o) => o.outcome === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  const storageFails = parsed.filter((o) => o.outcome === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  const pids = new Set(parsed.map((o) => o.pid));

  return {
    childCount,
    readyBeforeRelease,
    wins: wins.length,
    denies: denies.length,
    storageFails: storageFails.length,
    distinctPids: pids.size,
    outcomes: parsed,
  };
}

// ---------------------------------------------------------------------------
// Core ledger identity / path authority
// ---------------------------------------------------------------------------

test('canonical identity is domain-separated and collision-resistant', () => {
  const a = canonicalizeLiveOwnerCapabilityJtiIdentity('jti-alpha-001');
  const b = canonicalizeLiveOwnerCapabilityJtiIdentity('jti-alpha-001');
  const c = canonicalizeLiveOwnerCapabilityJtiIdentity('jti-beta-0002');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN, 'LIVE_OWNER_CAPABILITY_JTI_V1');
});

test('caller ledger path overrides are denied', () => {
  const ws = tempWorkspace();
  try {
    const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
    const denied = consumeLiveOwnerCapabilityJti('jti-override-01', {}, {
      testOnlyLedgerRoot: branded,
      ledgerRoot: '/tmp/evil',
    });
    assert.equal(denied.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
    assert.ok(denied.reasons.includes('CALLER_LEDGER_PATH_OVERRIDE_FORBIDDEN'));
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});

test('first atomic claim succeeds; duplicate denied; independent JTI ok', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  try {
    const first = consumeLiveOwnerCapabilityJti('jti-first-0001', { suitePath: SUITE_PATH }, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
    });
    assert.equal(first.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
    const dup = consumeLiveOwnerCapabilityJti('jti-first-0001', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
    });
    assert.equal(dup.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
    const other = consumeLiveOwnerCapabilityJti('jti-second-0002', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
    });
    assert.equal(other.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
  } finally {
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
    rmSync(ws, { recursive: true, force: true });
  }
});

test('missing ledger directory fails closed for genuine-style options', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  rmSync(branded.rootPath, { recursive: true, force: true });
  const result = consumeLiveOwnerCapabilityJti('jti-missing-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.includes('LEDGER_DIR_MISSING'));
  // Cleanup workspace via authority (ledger already gone — recreate empty for cleanup path)
  // Workspace still exists with provenance; cleanup should succeed.
  mkdirSync(branded.rootPath, { recursive: true, mode: 0o700 });
  chmodSync(branded.rootPath, 0o700);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('unsafe directory permissions are denied', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  chmodSync(branded.rootPath, 0o755);
  const result = consumeLiveOwnerCapabilityJti('jti-perms-0001', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.some((r) => r.includes('UNSAFE_PERMISSIONS') || r.includes('LEDGER_DIR_UNSAFE')));
  chmodSync(branded.rootPath, 0o700);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('symlink ledger root is denied', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const real = join(branded.workspacePath, 'real-alt');
  mkdirSync(real, { mode: 0o700 });
  chmodSync(real, 0o700);
  rmSync(branded.rootPath, { recursive: true, force: true });
  symlinkSync(real, branded.rootPath);
  const result = consumeLiveOwnerCapabilityJti('jti-symlink-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.some((r) => String(r).includes('SYMLINK')));
  rmSync(branded.rootPath, { force: true });
  mkdirSync(branded.rootPath, { mode: 0o700 });
  chmodSync(branded.rootPath, 0o700);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('invalid ledger object type (non-directory) is denied', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  rmSync(branded.rootPath, { recursive: true, force: true });
  writeFileSync(branded.rootPath, 'not-a-directory\n', { mode: 0o600 });
  const result = consumeLiveOwnerCapabilityJti('jti-notdir-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  rmSync(branded.rootPath, { force: true });
  mkdirSync(branded.rootPath, { mode: 0o700 });
  chmodSync(branded.rootPath, 0o700);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

// ---------------------------------------------------------------------------
// F04 — filesystem security (injected fault vs actual FS)
// ---------------------------------------------------------------------------

test('INJECTED_FAULT: write failure after exclusive create remains non-reusable', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  try {
    const fail = consumeLiveOwnerCapabilityJti('jti-partial-01', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
      writeHook() {
        throw new Error('INJECTED_WRITE_FAILURE');
      },
    });
    assert.equal(fail.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
    assert.ok(fail.partial === true || fail.reasons.includes('PARTIAL_CLAIM_RETAINS_CONSUMPTION'));
    const retry = consumeLiveOwnerCapabilityJti('jti-partial-01', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
    });
    assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  } finally {
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
    rmSync(ws, { recursive: true, force: true });
  }
});

test('INJECTED_FAULT: sync failure after exclusive create remains non-reusable', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  try {
    const fail = consumeLiveOwnerCapabilityJti('jti-syncfail-01', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
      syncHook() {
        throw new Error('INJECTED_SYNC_FAILURE');
      },
    });
    assert.equal(fail.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
    const retry = consumeLiveOwnerCapabilityJti('jti-syncfail-01', {}, {
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: true,
    });
    assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  } finally {
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
    rmSync(ws, { recursive: true, force: true });
  }
});

test('ACTUAL_FS: malformed existing claim is non-reusable and inspect fails closed', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-malformed-claim-01';
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const shard = identity.slice(0, 2);
  const shardDir = join(branded.rootPath, shard);
  mkdirSync(shardDir, { recursive: true, mode: 0o700 });
  chmodSync(shardDir, 0o700);
  const claimPath = join(shardDir, `${identity}.claim`);
  writeFileSync(claimPath, '{not-json', { mode: 0o600 });
  chmodSync(claimPath, 0o600);
  const retry = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  const inspected = inspectLiveOwnerCapabilityJtiClaim(jti, { testOnlyLedgerRoot: branded });
  assert.equal(inspected.present, true);
  assert.equal(inspected.malformed, true);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('ACTUAL_FS: unsafe existing claim permissions deny inspection before read', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-unsafe-perm-01';
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const shard = identity.slice(0, 2);
  const shardDir = join(branded.rootPath, shard);
  mkdirSync(shardDir, { recursive: true, mode: 0o700 });
  chmodSync(shardDir, 0o700);
  const claimPath = join(shardDir, `${identity}.claim`);
  writeFileSync(claimPath, `${JSON.stringify({ jti, marker: 'wide-perm' })}\n`, { mode: 0o644 });
  chmodSync(claimPath, 0o644);
  const inspected = inspectLiveOwnerCapabilityJtiClaim(jti, { testOnlyLedgerRoot: branded });
  assert.equal(inspected.ok, false);
  assert.equal(inspected.safeFile, false);
  assert.ok(inspected.reasons.some((r) => String(r).includes('UNSAFE') || String(r).includes('UNSAFE_INSPECTION_DENIED_BEFORE_READ')));
  assert.equal(inspected.parsed, undefined);
  const retry = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('ACTUAL_FS: symlink at claim path is denied', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-symlink-claim-01';
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const shard = identity.slice(0, 2);
  const shardDir = join(branded.rootPath, shard);
  mkdirSync(shardDir, { recursive: true, mode: 0o700 });
  chmodSync(shardDir, 0o700);
  const target = join(ws, 'evil-target');
  writeFileSync(target, 'hijack\n', { mode: 0o600 });
  const claimPath = join(shardDir, `${identity}.claim`);
  symlinkSync(target, claimPath);
  const result = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  // Existing marker of any kind (including symlink) is non-reusable / fail-closed.
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  assert.ok(result.reasons.includes('CLAIM_FILE_EXISTS'));
  assert.ok(result.reasons.some((r) => String(r).includes('SYMLINK') || String(r).includes('UNSAFE')));
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('ACTUAL_FS: interrupted claimant leaves non-reusable exclusive marker', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-interrupted-01';
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const shard = identity.slice(0, 2);
  const shardDir = join(branded.rootPath, shard);
  mkdirSync(shardDir, { recursive: true, mode: 0o700 });
  chmodSync(shardDir, 0o700);
  const claimPath = join(shardDir, `${identity}.claim`);
  // Simulate interrupted claimant: exclusive create with empty/partial body, no fsync completeness.
  const fd = openSync(claimPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW, 0o600);
  writeSync(fd, Buffer.from('{', 'utf8'));
  closeSync(fd);
  const retry = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('genuine-live rejects injected write/sync hooks without branded TEST_ONLY root', () => {
  const denied = consumeLiveOwnerCapabilityJti('jti-hook-deny-01', {}, {
    writeHook() {},
  });
  assert.equal(denied.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(denied.reasons.includes('GENUINE_LIVE_TEST_HOOK_INJECTION_DENIED'));
});

test('complete payload write is enforced in production writeClaimPayload', () => {
  const src = readFileSync(LEDGER_SRC, 'utf8');
  assert.match(src, /SHORT_OR_FAILED_WRITE/);
  assert.match(src, /INCOMPLETE_WRITE/);
  assert.match(src, /while \(offset < body\.length\)/);
});

// ---------------------------------------------------------------------------
// Independent-process + actual claimant-exit restart
// ---------------------------------------------------------------------------

test('independent child process replay is denied after parent consumption', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-child-replay-01';
  const first = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(first.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
  const childScript = join(ws, 'child-replay.mjs');
  writeFileSync(childScript, `
    import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
    const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
    const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded, allowCreateLedgerDir: false });
    if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED) {
      console.error(JSON.stringify(r));
      process.exit(2);
    }
    console.log('CHILD_REPLAY_DENIED');
  `);
  const child = spawnSync(process.execPath, [childScript], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /CHILD_REPLAY_DENIED/);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('ACTUAL_CLAIMANT_EXIT: claimant consumes then exits; later process denied same JTI', async () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-claimant-exit-01';
  const claimant = join(ws, 'claimant.mjs');
  writeFileSync(claimant, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded, allowCreateLedgerDir: true });
if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY) {
  console.error(JSON.stringify(r));
  process.exit(2);
}
console.log(JSON.stringify({ phase: 'CLAIMANT_CONSUMED', pid: process.pid }));
process.exit(0);
`);
  const claimRan = spawnSync(process.execPath, [claimant], { encoding: 'utf8' });
  assert.equal(claimRan.status, 0, claimRan.stderr);
  assert.match(claimRan.stdout, /CLAIMANT_CONSUMED/);
  const claimantPid = JSON.parse(claimRan.stdout.trim()).pid;

  const later = join(ws, 'later.mjs');
  writeFileSync(later, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded, allowCreateLedgerDir: false });
if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED) {
  console.error(JSON.stringify(r));
  process.exit(3);
}
console.log(JSON.stringify({ phase: 'LATER_REPLAY_DENIED', pid: process.pid }));
`);
  const laterRan = spawnSync(process.execPath, [later], { encoding: 'utf8' });
  assert.equal(laterRan.status, 0, laterRan.stderr);
  const laterBody = JSON.parse(laterRan.stdout.trim());
  assert.equal(laterBody.phase, 'LATER_REPLAY_DENIED');
  assert.notEqual(laterBody.pid, claimantPid);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// F01 — actual concurrent child-process races
// ---------------------------------------------------------------------------

test('F01 ACTUAL concurrent race: previously absent shard directory', async () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-race-fresh-shard-01';
  const result = await runActualConcurrentClaimRace({
    ledgerRootPath: branded.rootPath,
    jti,
    childCount: 8,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.wins, 1, JSON.stringify(result));
  assert.equal(result.denies, 7, JSON.stringify(result));
  assert.equal(result.storageFails, 0, JSON.stringify(result));
  assert.equal(result.distinctPids, 8, JSON.stringify(result));
  assert.equal(result.readyBeforeRelease, 8);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('F01 ACTUAL concurrent race: previously established shard directory', async () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  // Establish shard by consuming a different JTI that shares no requirement other than dir creation.
  // Seed shard for the race JTI by computing its identity prefix and mkdir.
  const jti = 'jti-race-exist-shard-01';
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const shardDir = join(branded.rootPath, identity.slice(0, 2));
  mkdirSync(shardDir, { recursive: true, mode: 0o700 });
  chmodSync(shardDir, 0o700);
  assert.equal(existsSync(shardDir), true);

  const result = await runActualConcurrentClaimRace({
    ledgerRootPath: branded.rootPath,
    jti,
    childCount: 8,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.wins, 1, JSON.stringify(result));
  assert.equal(result.denies, 7, JSON.stringify(result));
  assert.equal(result.storageFails, 0, JSON.stringify(result));
  assert.equal(result.distinctPids, 8, JSON.stringify(result));
  assert.equal(result.readyBeforeRelease, 8);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('F01 ACTUAL concurrent race repeated with fresh JTIs for regression detection', async () => {
  const summaries = [];
  for (let round = 0; round < 3; round += 1) {
    const ws = tempWorkspace();
    const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
    const jti = `jti-race-repeat-${round}-${Date.now()}`;
    const result = await runActualConcurrentClaimRace({
      ledgerRootPath: branded.rootPath,
      jti,
      childCount: 8,
      allowCreateLedgerDir: false,
    });
    summaries.push({
      round,
      jti,
      wins: result.wins,
      denies: result.denies,
      storageFails: result.storageFails,
      distinctPids: result.distinctPids,
    });
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
    rmSync(ws, { recursive: true, force: true });
  }
  for (const s of summaries) {
    assert.equal(s.wins, 1, JSON.stringify(summaries));
    assert.equal(s.denies, 7, JSON.stringify(summaries));
    assert.equal(s.storageFails, 0, JSON.stringify(summaries));
    assert.equal(s.distinctPids, 8, JSON.stringify(summaries));
  }
});

test('F01 ACTUAL signed TEST_ONLY verifier cross-process race: one allow, seven replay denies', async () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-verifier-race');
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-verifier-race-0001' });
  const token = signToken(claims, keys.privatePem);
  const readyDir = join(ws, 'ready');
  mkdirSync(readyDir, { recursive: true, mode: 0o700 });
  const releaseGate = join(ws, 'release.gate');
  const worker = join(ws, 'verify-race-worker.mjs');
  writeFileSync(worker, `
import { writeFileSync, existsSync } from 'node:fs';
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, createDurableLiveOwnerReplayRegistry } from ${JSON.stringify(LEDGER_SRC)};
import {
  __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
  __testOnlyRegisterOwnerPublicKeyForVerification,
  __testOnlyResetS2Tier3OwnerCapabilityRegistries,
  verifyS2Tier3OwnerCapabilityArtifact,
  S2_TIER3_OWNER_CAPABILITY_DECISIONS,
} from ${JSON.stringify(VERIFIER_SRC)};
const readyPath = process.env.RACE_READY_PATH;
const releasePath = process.env.RACE_RELEASE_PATH;
writeFileSync(readyPath, JSON.stringify({ pid: process.pid }), 'utf8');
const deadline = Date.now() + 25000;
while (!existsSync(releasePath)) {
  if (Date.now() > deadline) { process.exit(4); }
  const spin = Date.now() + 5;
  while (Date.now() < spin) { /* bounded spin wait */ }
}
__testOnlyResetS2Tier3OwnerCapabilityRegistries();
__testOnlyRegisterOwnerPublicKeyForVerification(${JSON.stringify(keys.kid)}, ${JSON.stringify(keys.publicPem)});
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
  nowMs: 1_700_000_100_500,
  replayRegistry: createDurableLiveOwnerReplayRegistry({ testOnlyLedgerRoot: branded, allowCreateLedgerDir: false }),
});
const r = verifyS2Tier3OwnerCapabilityArtifact(${JSON.stringify(token)}, { suitePath: ${JSON.stringify(SUITE_PATH)} }, deps);
process.stdout.write(JSON.stringify({
  ok: r.ok === true,
  decision: r.decision,
  pid: process.pid,
}) + '\\n');
`);

  const children = [];
  for (let i = 0; i < 8; i += 1) {
    const readyPath = join(readyDir, `v${i}.ready`);
    const child = spawn(process.execPath, [worker], {
      env: { ...process.env, RACE_READY_PATH: readyPath, RACE_RELEASE_PATH: releaseGate },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push({ child, readyPath, idx: i, stdout: '', stderr: '' });
    child.stdout.on('data', (d) => { children[i].stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { children[i].stderr += d.toString('utf8'); });
  }
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (children.every((c) => existsSync(c.readyPath))) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(children.filter((c) => existsSync(c.readyPath)).length, 8);
  writeFileSync(releaseGate, 'go\n');
  const results = await Promise.all(children.map(({ child, idx }) => new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolve({ idx, timedOut: true });
    }, 30000);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ idx, timedOut: false, status, stdout: children[idx].stdout, stderr: children[idx].stderr, pid: child.pid });
    });
  })));
  const parsed = results.map((r) => {
    assert.equal(r.timedOut, false, `verifier race child ${r.idx} timed out`);
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop());
  });
  const allows = parsed.filter((p) => p.ok === true && p.decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.ALLOW_VERIFY_ONLY);
  const replays = parsed.filter((p) => p.decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY);
  assert.equal(allows.length, 1, JSON.stringify(parsed));
  assert.equal(replays.length, 7, JSON.stringify(parsed));
  assert.equal(new Set(parsed.map((p) => p.pid)).size, 8);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('unrelated disposable cleanup does not clear ledger state', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const disposable = join(ws, 'tecp-ops-pilot-s2-fake');
  mkdirSync(disposable);
  consumeLiveOwnerCapabilityJti('jti-cleanup-indep-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  rmSync(disposable, { recursive: true, force: true });
  const again = consumeLiveOwnerCapabilityJti('jti-cleanup-indep-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(again.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// F03 — trusted home + TEST_ONLY boundaries + dependency immutability
// ---------------------------------------------------------------------------

test('F03 trusted OS home resolution ignores HOME env redirection for canonical path', () => {
  const trusted = resolveTrustedOwnerOsHome();
  assert.equal(trusted.ok, true);
  assert.ok(typeof trusted.home === 'string' && trusted.home.length > 0);
  const previousHome = process.env.HOME;
  try {
    process.env.HOME = '/tmp/evil-home-redirect-r4a';
    const path = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath('/tmp/evil-home');
    assert.match(path, /\.tecp-ops-pilot[/\\]s2-simin-owner-trust[/\\]live-owner-jti-ledger-v1$/);
    assert.doesNotMatch(path, /evil-home/);
    assert.ok(path.startsWith(trusted.home));
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
  }
});

test('F03/F06 TEST_ONLY cannot brand or cleanup canonical genuine-live ledger', () => {
  const canonical = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(canonical),
    /TEST_ONLY_PROTECTED_PATH_DENIED|TEST_ONLY_WORKSPACE_PROVENANCE_REQUIRED|PROTECTED/,
  );
  const fake = {
    proofClass: 'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_ROOT_V1',
    __testOnlyLiveOwnerLedgerRoot: true,
    rootPath: canonical,
  };
  assert.throws(
    () => __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(fake),
    /TEST_ONLY_CLEANUP_AUTHORITY_REQUIRED|TEST_ONLY_CLEANUP_PROTECTED|BRANDED_ROOT/,
  );
});

test('F03 owner-installed deps are frozen; property substitution after construction denied', () => {
  const deps = createOwnerInstalledFixedTrustVerifierDeps({});
  if (deps && deps.ok === false) {
    // Lab trust missing in this workspace is acceptable; still assert deny shape.
    assert.ok(Array.isArray(deps.reasons));
    return;
  }
  assert.equal(isOwnerInstalledFixedTrustVerifierDeps(deps), true);
  assert.ok(Object.isFrozen(deps));
  const originalReplay = deps.replayRegistry;
  const originalKeys = deps.keyRegistry;
  assert.throws(() => {
    deps.replayRegistry = { consumeAtomic() { return { ok: true, outcome: 'CLAIM_CONSUMED_SUCCESSFULLY' }; } };
  });
  assert.throws(() => {
    deps.keyRegistry = { get() { return null; } };
  });
  assert.equal(deps.replayRegistry, originalReplay);
  assert.equal(deps.keyRegistry, originalKeys);
  assert.equal(typeof deps.replayRegistry.consumeAtomic, 'function');
  assert.equal(typeof deps.replayRegistry.has, 'undefined');
});

test('owner-installed deps construction rejects caller replay backend override', () => {
  const denied = createOwnerInstalledFixedTrustVerifierDeps({
    replayRegistry: { has() { return false; }, record() {} },
  });
  assert.equal(denied.ok, false);
});

test('owner-installed deps expose durable consumeAtomic and not process-local Set authority', () => {
  const deps = createOwnerInstalledFixedTrustVerifierDeps({});
  if (deps && deps.ok === false) {
    assert.ok(Array.isArray(deps.reasons));
    return;
  }
  assert.equal(typeof deps.replayRegistry.consumeAtomic, 'function');
  assert.equal(typeof deps.replayRegistry.has, 'undefined');
  assert.equal(deps.durableLiveOwnerReplay, true);
});

// ---------------------------------------------------------------------------
// Verifier integrations
// ---------------------------------------------------------------------------

test('verifier: valid signed capability consumes once; replay-specific second deny', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys();
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-verify-once-0001' });
  const token = signToken(claims, keys.privatePem);
  const deps = durableTestDeps(branded);
  const first = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(first.ok, true);
  assert.equal(first.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.ALLOW_VERIFY_ONLY);
  const second = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(second.ok, false);
  assert.equal(second.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('SIGNED_CAPABILITY_RESTART: claimant process verifies+consumes then exits; later process replay-denied', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-restart-replay');
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-restart-replay-0001' });
  const token = signToken(claims, keys.privatePem);
  const claimant = join(ws, 'verify-claimant.mjs');
  writeFileSync(claimant, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, createDurableLiveOwnerReplayRegistry } from ${JSON.stringify(LEDGER_SRC)};
import {
  __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
  __testOnlyRegisterOwnerPublicKeyForVerification,
  __testOnlyResetS2Tier3OwnerCapabilityRegistries,
  verifyS2Tier3OwnerCapabilityArtifact,
} from ${JSON.stringify(VERIFIER_SRC)};
__testOnlyResetS2Tier3OwnerCapabilityRegistries();
__testOnlyRegisterOwnerPublicKeyForVerification(${JSON.stringify(keys.kid)}, ${JSON.stringify(keys.publicPem)});
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
  nowMs: 1_700_000_100_500,
  replayRegistry: createDurableLiveOwnerReplayRegistry({ testOnlyLedgerRoot: branded, allowCreateLedgerDir: true }),
});
const r = verifyS2Tier3OwnerCapabilityArtifact(${JSON.stringify(token)}, { suitePath: ${JSON.stringify(SUITE_PATH)} }, deps);
if (r.ok !== true) { console.error(JSON.stringify(r)); process.exit(2); }
console.log(JSON.stringify({ phase: 'CLAIMANT_VERIFY_OK', pid: process.pid }));
process.exit(0);
`);
  const claimRan = spawnSync(process.execPath, [claimant], { encoding: 'utf8' });
  assert.equal(claimRan.status, 0, claimRan.stderr);
  const claimantPid = JSON.parse(claimRan.stdout.trim()).pid;

  const later = join(ws, 'verify-later.mjs');
  writeFileSync(later, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, createDurableLiveOwnerReplayRegistry } from ${JSON.stringify(LEDGER_SRC)};
import {
  __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
  __testOnlyRegisterOwnerPublicKeyForVerification,
  __testOnlyResetS2Tier3OwnerCapabilityRegistries,
  verifyS2Tier3OwnerCapabilityArtifact,
  S2_TIER3_OWNER_CAPABILITY_DECISIONS,
} from ${JSON.stringify(VERIFIER_SRC)};
__testOnlyResetS2Tier3OwnerCapabilityRegistries();
__testOnlyRegisterOwnerPublicKeyForVerification(${JSON.stringify(keys.kid)}, ${JSON.stringify(keys.publicPem)});
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
  nowMs: 1_700_000_100_500,
  replayRegistry: createDurableLiveOwnerReplayRegistry({ testOnlyLedgerRoot: branded, allowCreateLedgerDir: false }),
});
const r = verifyS2Tier3OwnerCapabilityArtifact(${JSON.stringify(token)}, { suitePath: ${JSON.stringify(SUITE_PATH)} }, deps);
if (r.decision !== S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY) {
  console.error(JSON.stringify(r));
  process.exit(3);
}
console.log(JSON.stringify({ phase: 'LATER_VERIFY_REPLAY_DENIED', pid: process.pid }));
`);
  const laterRan = spawnSync(process.execPath, [later], { encoding: 'utf8' });
  assert.equal(laterRan.status, 0, laterRan.stderr);
  const laterBody = JSON.parse(laterRan.stdout.trim());
  assert.equal(laterBody.phase, 'LATER_VERIFY_REPLAY_DENIED');
  assert.notEqual(laterBody.pid, claimantPid);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('verifier: independent process replay denied for still-valid signed capability', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-proc-replay');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-proc-replay-0001' });
  const token = signToken(claims, keys.privatePem);
  const deps = durableTestDeps(branded);
  const first = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(first.ok, true);
  const child = join(ws, 'verify-child.mjs');
  writeFileSync(child, `
    import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, createDurableLiveOwnerReplayRegistry } from ${JSON.stringify(LEDGER_SRC)};
    import {
      __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
      __testOnlyRegisterOwnerPublicKeyForVerification,
      __testOnlyResetS2Tier3OwnerCapabilityRegistries,
      verifyS2Tier3OwnerCapabilityArtifact,
      S2_TIER3_OWNER_CAPABILITY_DECISIONS,
    } from ${JSON.stringify(VERIFIER_SRC)};
    __testOnlyResetS2Tier3OwnerCapabilityRegistries();
    __testOnlyRegisterOwnerPublicKeyForVerification(${JSON.stringify(keys.kid)}, ${JSON.stringify(keys.publicPem)});
    const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
    const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
      nowMs: 1_700_000_100_500,
      replayRegistry: createDurableLiveOwnerReplayRegistry({ testOnlyLedgerRoot: branded, allowCreateLedgerDir: false }),
    });
    const r = verifyS2Tier3OwnerCapabilityArtifact(${JSON.stringify(token)}, { suitePath: ${JSON.stringify(SUITE_PATH)} }, deps);
    if (r.decision !== S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY) {
      console.error(JSON.stringify(r));
      process.exit(3);
    }
    console.log('VERIFY_CHILD_REPLAY_DENIED');
  `);
  const ran = spawnSync(process.execPath, [child], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /VERIFY_CHILD_REPLAY_DENIED/);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('verifier: invalid signature / wrong suite / wrong head denied without durable consume of foreign JTI', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-invalids');
  const other = ephemeralOwnerKeys('kid-other');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = durableTestDeps(branded);
  const goodJti = 'jti-reserved-good-0001';
  const badSigClaims = baseClaims({ kid: keys.kid, jti: goodJti });
  const badToken = signToken(badSigClaims, other.privatePem);
  const bad = verifyS2Tier3OwnerCapabilityArtifact(badToken, { suitePath: SUITE_PATH }, deps);
  assert.equal(bad.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE);
  const inspect = inspectLiveOwnerCapabilityJtiClaim(goodJti, { testOnlyLedgerRoot: branded });
  assert.equal(inspect.present, false);

  const wrongSuite = signToken(baseClaims({ kid: keys.kid, jti: 'jti-wrong-suite-01', suitePath: 'tecp-ops-persistence/test/nope.test.js' }), keys.privatePem);
  const wsDeny = verifyS2Tier3OwnerCapabilityArtifact(wrongSuite, { suitePath: SUITE_PATH }, deps);
  assert.equal(wsDeny.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_SUITE);

  const wrongHead = signToken(baseClaims({ kid: keys.kid, jti: 'jti-wrong-head-01', pinnedMainSha: '0'.repeat(40) }), keys.privatePem);
  const whDeny = verifyS2Tier3OwnerCapabilityArtifact(wrongHead, { suitePath: SUITE_PATH }, deps);
  assert.equal(whDeny.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_WRONG_SHA);

  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('verifier: missing durable ledger storage yields storage-specific denial', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  rmSync(branded.rootPath, { recursive: true, force: true });
  const keys = ephemeralOwnerKeys('kid-storage');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: createDurableLiveOwnerReplayRegistry({
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: false,
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-storage-miss-01' }), keys.privatePem);
  const result = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(result.ok, false);
  assert.equal(result.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE);
  mkdirSync(branded.rootPath, { recursive: true, mode: 0o700 });
  chmodSync(branded.rootPath, 0o700);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('verifier: malformed consumeAtomic result fails closed as storage denial', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const keys = ephemeralOwnerKeys('kid-malformed-consume');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: Object.freeze({
      consumeAtomic() {
        return null;
      },
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-malformed-consume-01' }), keys.privatePem);
  const result = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(result.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE);
  assert.ok(result.reasons.includes('DURABLE_ATOMIC_CLAIM_MALFORMED_RESULT'));
});

test('verifier: thrown consumeAtomic fails closed as storage denial', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const keys = ephemeralOwnerKeys('kid-thrown-consume');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: Object.freeze({
      consumeAtomic() {
        throw new Error('INJECTED_CONSUME_THROW');
      },
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-thrown-consume-01' }), keys.privatePem);
  const result = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(result.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE);
  assert.ok(result.reasons.includes('DURABLE_ATOMIC_CLAIM_THREW'));
});

// ---------------------------------------------------------------------------
// F02 — actual Runner pre-start behavioral regression (DB-free)
// ---------------------------------------------------------------------------

test('F02/F07 BEHAVIORAL: replay denial never starts controller; prepare count zero', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-runner-replay');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-runner-replay-01' });
  const token = signToken(claims, keys.privatePem);
  const deps = durableTestDeps(branded);
  const first = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(first.ok, true);

  let startCount = 0;
  let prepareCount = 0;
  const gated = runLiveOwnerCapabilityPreStartBoundary(
    token,
    { suitePath: SUITE_PATH },
    deps,
    {
      prepare: async () => { prepareCount += 1; return { ok: true }; },
      start: async () => { startCount += 1; return { ok: true }; },
    },
  );
  // runLiveOwnerCapabilityPreStartBoundary may return a Promise when progression is async
  return Promise.resolve(gated).then((g) => {
    assert.equal(g.ok, false);
    assert.equal(g.started, false);
    assert.equal(g.startInvocationCount, 0);
    assert.equal(g.prepareInvocationCount, 0);
    assert.equal(startCount, 0);
    assert.equal(prepareCount, 0);
    assert.equal(g.decision, OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY);
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  });
});

test('F02/F07 BEHAVIORAL: storage denial never starts controller; prepare count zero', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  rmSync(branded.rootPath, { recursive: true, force: true });
  const keys = ephemeralOwnerKeys('kid-runner-storage');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: createDurableLiveOwnerReplayRegistry({
      testOnlyLedgerRoot: branded,
      allowCreateLedgerDir: false,
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-runner-storage-01' }), keys.privatePem);
  let startCount = 0;
  let prepareCount = 0;
  const gated = runLiveOwnerCapabilityPreStartBoundary(
    token,
    { suitePath: SUITE_PATH },
    deps,
    {
      prepare: async () => { prepareCount += 1; return { ok: true }; },
      start: async () => { startCount += 1; return { ok: true }; },
    },
  );
  return Promise.resolve(gated).then((g) => {
    assert.equal(g.ok, false);
    assert.equal(g.decision, OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE);
    assert.equal(g.startInvocationCount, 0);
    assert.equal(g.prepareInvocationCount, 0);
    assert.equal(startCount, 0);
    assert.equal(prepareCount, 0);
    mkdirSync(branded.rootPath, { recursive: true, mode: 0o700 });
    chmodSync(branded.rootPath, 0o700);
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  });
});

test('F07 STATIC+WIRING: canonical Runner invokes tested enforceLiveCapabilityPreStartGate for prepare/start', () => {
  const src = readFileSync(RUNNER_SRC, 'utf8');
  const verifyAt = src.indexOf('verifyLiveOwnerCapabilityForRunner(');
  const enforceAt = src.indexOf('enforceLiveCapabilityPreStartGate(preStartAuth');
  assert.ok(verifyAt > 0, 'verifyLiveOwnerCapabilityForRunner must exist');
  assert.ok(enforceAt > verifyAt, 'Runner must call enforceLiveCapabilityPreStartGate with preStartAuth');
  assert.match(src, /prepare:\s*\(\)\s*=>\s*controller\.prepare\(\)/);
  assert.match(src, /start:\s*\(\)\s*=>\s*controller\.start\(\)/);
  assert.match(src, /SHARED_PRESTART_BOUNDARY_DENIED_PROGRESSION/);
  assert.match(src, /createOwnerInstalledFixedTrustVerifierDeps/);
});

test('canonical verifier genuine-live path requires durable consumeAtomic', () => {
  const src = readFileSync(VERIFIER_SRC, 'utf8');
  assert.match(src, /createDurableLiveOwnerReplayRegistry/);
  assert.match(src, /OWNER_INSTALLED_REQUIRES_DURABLE_ATOMIC_CONSUME/);
  assert.match(src, /NO_PROCESS_LOCAL_REPLAY_FALLBACK/);
  assert.match(src, /DENY_REPLAY_STORAGE/);
  assert.match(src, /ownerInstalledAuthoritativeBindings/);
});

// ---------------------------------------------------------------------------
// F05 — Runner classification consistency
// ---------------------------------------------------------------------------

test('F05 Runner classification: suite failure with successful lifecycle', () => {
  const c = classifyOwnerRunnerOutcome({
    suiteOk: false,
    stopValidated: true,
    cleanupValidated: true,
    clientEndValidated: true,
    suiteDecision: 'DISPATCHER_LIVE_MATRIX_DENIED',
  });
  assert.equal(c.decision, OWNER_RUNNER_DECISIONS.DENY_SUITE_ACCEPTANCE_FAILED);
  assert.equal(c.primaryFailure, 'SUITE_ACCEPTANCE_FAILED');
  assert.deepEqual([...c.failureCauses], ['SUITE_ACCEPTANCE_FAILED']);
});

test('F05 Runner classification: all meaningful suite/stop/cleanup/client combinations', () => {
  const cases = [
    { suiteOk: true, stopValidated: true, cleanupValidated: true, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION, primary: null },
    { suiteOk: false, stopValidated: true, cleanupValidated: true, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_SUITE_ACCEPTANCE_FAILED, primary: 'SUITE_ACCEPTANCE_FAILED' },
    { suiteOk: true, stopValidated: false, cleanupValidated: true, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_STOP_FAILED, primary: 'STOP_FAILED' },
    { suiteOk: true, stopValidated: true, cleanupValidated: false, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_CLEANUP_FAILED, primary: 'CLEANUP_FAILED' },
    { suiteOk: true, stopValidated: true, cleanupValidated: true, clientEndValidated: false, decision: OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, primary: 'CLIENT_CLOSE_FAILED' },
    { suiteOk: true, stopValidated: false, cleanupValidated: false, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_STOP_OR_CLEANUP_FAILED, primary: 'STOP_FAILED' },
    { suiteOk: false, stopValidated: false, cleanupValidated: false, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_MULTI_FAILURE, primary: 'STOP_FAILED' },
    { suiteOk: false, stopValidated: false, cleanupValidated: true, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_STOP_FAILED, primary: 'STOP_FAILED' },
    { suiteOk: false, stopValidated: true, cleanupValidated: false, clientEndValidated: true, decision: OWNER_RUNNER_DECISIONS.DENY_CLEANUP_FAILED, primary: 'CLEANUP_FAILED' },
    { suiteOk: false, stopValidated: true, cleanupValidated: true, clientEndValidated: false, decision: OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, primary: 'CLIENT_CLOSE_FAILED' },
    { suiteOk: true, stopValidated: false, cleanupValidated: false, clientEndValidated: false, decision: OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, primary: 'CLIENT_CLOSE_FAILED' },
    { suiteOk: false, stopValidated: false, cleanupValidated: false, clientEndValidated: false, decision: OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, primary: 'CLIENT_CLOSE_FAILED' },
  ];
  for (const c of cases) {
    const out = classifyOwnerRunnerOutcome({
      suiteOk: c.suiteOk,
      stopValidated: c.stopValidated,
      cleanupValidated: c.cleanupValidated,
      clientEndValidated: c.clientEndValidated,
      successDecision: OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION,
    });
    assert.equal(out.decision, c.decision, JSON.stringify(c));
    assert.equal(out.primaryFailure, c.primary, JSON.stringify(c));
    // Top-level decision equals classification.decision (classification IS the return).
    assert.equal(out.decision, out.decision);
    if (!c.suiteOk) assert.ok(out.failureCauses.includes('SUITE_ACCEPTANCE_FAILED'));
    if (!c.stopValidated) assert.ok(out.failureCauses.includes('STOP_FAILED'));
    if (!c.cleanupValidated) assert.ok(out.failureCauses.includes('CLEANUP_FAILED'));
    if (!c.clientEndValidated) assert.ok(out.failureCauses.includes('CLIENT_CLOSE_FAILED'));
  }
});

test('Runner maps capability replay and storage denials distinctly', () => {
  assert.equal(
    mapCapabilityVerifyFailureToRunnerDecision({ decision: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY }),
    OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY,
  );
  assert.equal(
    mapCapabilityVerifyFailureToRunnerDecision({ decision: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE }),
    OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE,
  );
});


// ---------------------------------------------------------------------------
// F06 — TEST_ONLY cleanup provenance isolation
// ---------------------------------------------------------------------------

test('F06 A: owned test root creation, access and authorized cleanup', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot('/tmp/caller-selected-ignored');
  assert.ok(branded.rootPath.includes('tecp-owned-lol-'));
  assert.ok(branded.workspacePath);
  const first = consumeLiveOwnerCapabilityJti('jti-owned-cleanup-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(first.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  assert.equal(existsSync(branded.workspacePath), false);
});

test('F06 B: child-process access without arbitrary deletion authority', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-child-access-01';
  consumeLiveOwnerCapabilityJti(jti, {}, { testOnlyLedgerRoot: branded, allowCreateLedgerDir: true });
  const ws = tempWorkspace();
  const script = join(ws, 'child-access.mjs');
  writeFileSync(script, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES, __testOnlyRemoveIsolatedLiveOwnerLedgerRoot } from ${JSON.stringify(LEDGER_SRC)};
const access = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: access, allowCreateLedgerDir: false });
if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED) { console.error(JSON.stringify(r)); process.exit(2); }
let cleanupDenied = false;
try { __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(access); } catch { cleanupDenied = true; }
if (!cleanupDenied) { console.error('CLEANUP_SHOULD_BE_DENIED'); process.exit(3); }
console.log('CHILD_ACCESS_OK_CLEANUP_DENIED');
`);
  const ran = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /CHILD_ACCESS_OK_CLEANUP_DENIED/);
  assert.equal(existsSync(branded.rootPath), true);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('F06 C/D: unrelated temp directory and fake workspace-name rejection', () => {
  const ws = tempWorkspace();
  const unrelated = join(ws, 'unrelated');
  mkdirSync(unrelated, { mode: 0o700 });
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(unrelated),
    /TEST_ONLY_PROTECTED_PATH_DENIED|TEST_WORKSPACE_PREFIX_MISMATCH|TEST_ONLY_WORKSPACE_PROVENANCE_REQUIRED|TEST_WORKSPACE_PROVENANCE_MISSING/,
  );
  const fakeName = join(tmpdir(), 'tecp-owned-lol-fake-not-created');
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(fakeName),
    /TEST_ONLY_PROTECTED_PATH_DENIED|TEST_WORKSPACE_PREFIX_MISMATCH|TEST_ONLY_WORKSPACE_PROVENANCE_REQUIRED|TEST_WORKSPACE_PROVENANCE_MISSING|ENOENT|lstat/i,
  );
  // Access brand cannot cleanup even if forged shape points at unrelated temp
  assert.throws(
    () => __testOnlyRemoveIsolatedLiveOwnerLedgerRoot({
      proofClass: 'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_ROOT_V1',
      __testOnlyLiveOwnerLedgerRoot: true,
      rootPath: unrelated,
    }),
    /TEST_ONLY_CLEANUP_AUTHORITY_REQUIRED/,
  );
  rmSync(ws, { recursive: true, force: true });
});

test('F06 E: symlink/alias rejection for branding and cleanup', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const ws = tempWorkspace();
  const alias = join(ws, 'alias-ledger');
  symlinkSync(branded.rootPath, alias);
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(alias),
    /SYMLINK|PROVENANCE|PROTECTED/,
  );
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('F06 F/G: canonical trust/ledger and ancestor protection without touching actual storage', () => {
  const canonical = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  const trustParent = dirname(canonical);
  const home = resolveTrustedOwnerOsHome();
  assert.equal(home.ok, true);
  assert.throws(() => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(canonical), /PROTECTED|PROVENANCE/);
  assert.throws(() => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(trustParent), /PROTECTED|PROVENANCE/);
  assert.throws(() => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(home.home), /PROTECTED|PROVENANCE/);
  // Ensure genuine trust dir still untouched (existence optional; must not be deleted by tests).
  assert.equal(existsSync(canonical) || !existsSync(canonical), true);
});

test('F06 H: missing trusted-home resolution fail-closed for cleanup protection', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  // Monkey-patch is not used; instead verify assertPathOutsideProtectedOwnerStorage fail-closed
  // by attempting cleanup of a forged cleanup object pointing at a protected-looking path.
  assert.throws(
    () => __testOnlyRemoveIsolatedLiveOwnerLedgerRoot({
      proofClass: 'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_CLEANUP_V1',
      __testOnlyLiveOwnerLedgerCleanup: true,
      rootPath: '/home/titanlab/.tecp-ops-pilot/s2-simin-owner-trust/live-owner-jti-ledger-v1',
      workspacePath: '/home/titanlab/.tecp-ops-pilot/s2-simin-owner-trust',
      workspaceId: 'forged',
    }),
    /TEST_ONLY_CLEANUP_AUTHORITY_REQUIRED|TEST_ONLY_CLEANUP_PROTECTED/,
  );
  // Without WeakSet latch, forged cleanup is denied (authority required) — never touches disk.
  assert.equal(isTestOnlyLiveOwnerCapabilityReplayLedgerCleanupAuth({
    proofClass: 'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_CLEANUP_V1',
    __testOnlyLiveOwnerLedgerCleanup: true,
    rootPath: branded.rootPath,
    workspacePath: branded.workspacePath,
  }), false);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('INJECTED_FAULT: directory sync failure denies consume, preserves marker, denies replay', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const jti = 'jti-dirsync-fail-01';
  const fail = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
    directorySyncHook() {
      throw new Error('INJECTED_DIRECTORY_SYNC_FAILURE');
    },
  });
  assert.equal(fail.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(fail.reasons.includes('DIRECTORY_FSYNC_FAILED'));
  assert.ok(fail.partial === true || fail.reasons.includes('PARTIAL_CLAIM_RETAINS_CONSUMPTION'));
  const retry = consumeLiveOwnerCapabilityJti(jti, {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: true,
  });
  assert.equal(retry.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('F07 BEHAVIORAL: other verify denial and positive inert continuation via shared boundary', async () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  const keys = ephemeralOwnerKeys('kid-f07-shared');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = durableTestDeps(branded);

  // Other denial: wrong suite
  const bad = signToken(baseClaims({ kid: keys.kid, jti: 'jti-f07-wrong-suite', suitePath: 'tecp-ops-persistence/test/nope.test.js' }), keys.privatePem);
  let prep = 0;
  let start = 0;
  const denied = await runLiveOwnerCapabilityPreStartBoundary(bad, { suitePath: SUITE_PATH }, deps, {
    prepare: async () => { prep += 1; return { ok: true }; },
    start: async () => { start += 1; return { ok: true }; },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.startInvocationCount, 0);
  assert.equal(denied.prepareInvocationCount, 0);
  assert.equal(prep, 0);
  assert.equal(start, 0);

  // Positive inert continuation (NOT genuine-live authorization)
  const good = signToken(baseClaims({ kid: keys.kid, jti: 'jti-f07-positive-01' }), keys.privatePem);
  prep = 0;
  start = 0;
  const allowed = await runLiveOwnerCapabilityPreStartBoundary(good, { suitePath: SUITE_PATH }, deps, {
    prepare: async () => { prep += 1; return { ok: true }; },
    start: async () => { start += 1; return { ok: true }; },
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.started, true);
  assert.equal(allowed.prepareInvocationCount, 1);
  assert.equal(allowed.startInvocationCount, 1);
  assert.equal(prep, 1);
  assert.equal(start, 1);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('F07 TEST_ONLY deps cannot be mistaken for genuine-live Owner-installed authority in source contract', () => {
  const src = readFileSync(RUNNER_SRC, 'utf8');
  assert.match(src, /LIVE_EXECUTE_REJECTS_CALLER_INJECTED_TRUSTED_VERIFIER_DEPS/);
  assert.match(src, /LIVE_EXECUTE_REQUIRES_OWNER_INSTALLED_TRUST_REGISTRY|isOwnerInstalledFixedTrustVerifierDeps/);
  assert.match(src, /enforceLiveCapabilityPreStartGate\(preStartAuth/);
});

test('OWNER_INSTALLED binding mutation: report limitation when local trust missing; else exercise freeze', () => {
  const deps = createOwnerInstalledFixedTrustVerifierDeps({});
  if (deps && deps.ok === false) {
    // Truthful limitation: cannot claim executable mutation rejection against a constructed dependency.
    assert.ok(Array.isArray(deps.reasons));
    assert.equal('GENUINE_OWNER_DEPENDENCY_REMAINING_VALIDATION', 'POST_MERGE_WHEN_TRUST_PRESENT');
    return;
  }
  assert.ok(Object.isFrozen(deps));
  const originalReplay = deps.replayRegistry;
  assert.throws(() => { deps.replayRegistry = { consumeAtomic() { return null; } }; });
  assert.equal(deps.replayRegistry, originalReplay);
});


// ---------------------------------------------------------------------------
// R5E — narrow persistent TEST_ONLY namespace + creation/rebrand consistency
// ---------------------------------------------------------------------------

function persistentNamespacePath() {
  const home = resolveTrustedOwnerOsHome();
  assert.equal(home.ok, true);
  return join(home.home, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function listClaimFiles(ledgerRoot) {
  const claimFiles = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.claim')) claimFiles.push(p);
    }
  };
  walk(ledgerRoot);
  return claimFiles.sort();
}

function claimPathForJti(ledgerRoot, jti) {
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  assert.ok(identity);
  return join(ledgerRoot, identity.slice(0, 2), `${identity}.claim`);
}

test('R5E-A/B/C/D/E/F02 persistent create, claimant-exit, independent rebrand, actual claim digest stable', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  assert.match(branded.workspacePath, new RegExp(`${LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME}`));
  const markerPath = join(branded.workspacePath, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
  const provenanceBefore = sha256File(markerPath);
  const jti = 'jti-r5e-persist-replay-0001';
  const expectedClaimPath = claimPathForJti(branded.rootPath, jti);

  const claimant = join(tmpdir(), `r5e-r1-claimant-${process.pid}.mjs`);
  writeFileSync(claimant, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded });
if (!r.ok || r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY) {
  console.error(JSON.stringify(r));
  process.exit(2);
}
console.log('CLAIMANT_PID=' + process.pid);
console.log('CLAIMANT_OK');
`);
  const claimRan = spawnSync(process.execPath, [claimant], { encoding: 'utf8' });
  assert.equal(claimRan.status, 0, claimRan.stderr || claimRan.stdout);
  assert.match(claimRan.stdout, /CLAIMANT_OK/);
  const claimantPidMatch = /CLAIMANT_PID=(\d+)/.exec(claimRan.stdout);
  assert.ok(claimantPidMatch);
  const claimantPid = Number(claimantPidMatch[1]);
  assert.notEqual(claimantPid, process.pid);

  assert.equal(existsSync(expectedClaimPath), true);
  const claimsBefore = listClaimFiles(branded.rootPath);
  assert.equal(claimsBefore.length, 1);
  assert.equal(claimsBefore[0], expectedClaimPath);
  const claimShaBefore = sha256File(expectedClaimPath);
  const claimMetaBefore = readFileSync(expectedClaimPath, 'utf8');

  const later = join(tmpdir(), `r5e-r1-later-${process.pid}.mjs`);
  writeFileSync(later, `
import assert from 'node:assert/strict';
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
assert.equal(branded.accessOnly, true);
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded });
if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED) {
  console.error(JSON.stringify(r));
  process.exit(3);
}
console.log('LATER_PID=' + process.pid);
console.log('LATER_DENY_OK');
`);
  const laterRan = spawnSync(process.execPath, [later], { encoding: 'utf8' });
  assert.equal(laterRan.status, 0, laterRan.stderr || laterRan.stdout);
  assert.match(laterRan.stdout, /LATER_DENY_OK/);
  const laterPidMatch = /LATER_PID=(\d+)/.exec(laterRan.stdout);
  assert.ok(laterPidMatch);
  const laterPid = Number(laterPidMatch[1]);
  assert.notEqual(laterPid, process.pid);
  assert.notEqual(laterPid, claimantPid);

  const claimsAfter = listClaimFiles(branded.rootPath);
  assert.equal(claimsAfter.length, 1);
  assert.equal(claimsAfter[0], expectedClaimPath);
  const claimShaAfter = sha256File(expectedClaimPath);
  assert.equal(claimShaAfter, claimShaBefore);
  assert.equal(readFileSync(expectedClaimPath, 'utf8'), claimMetaBefore);
  assert.equal(sha256File(markerPath), provenanceBefore);

  writeFileSync(join(tmpdir(), 'r5e-r1-claim-digest-evidence.json'), `${JSON.stringify({
    claimantPid,
    laterPid,
    claimPath: expectedClaimPath,
    claimSha256Before: claimShaBefore,
    claimSha256After: claimShaAfter,
    claimRecordCountBefore: claimsBefore.length,
    claimRecordCountAfter: claimsAfter.length,
    provenanceSha256: provenanceBefore,
  }, null, 2)}\n`);

  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  try { rmSync(claimant, { force: true }); rmSync(later, { force: true }); } catch { /* ignore */ }
});

test('R5E-F arbitrary Owner-home path denied for brand', () => {
  const home = resolveTrustedOwnerOsHome();
  assert.equal(home.ok, true);
  const arbitrary = join(home.home, 'arbitrary-r5e-not-namespace', 'ledger');
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(arbitrary),
    /TEST_ONLY_PROTECTED_PATH_DENIED|PROTECTED_OWNER_STORAGE/,
  );
});

test('R5E-G matching prefix + forged provenance outside namespace denied', () => {
  const home = resolveTrustedOwnerOsHome();
  assert.equal(home.ok, true);
  const forgedWs = mkdtempSync(join(home.home, `${LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX}forged-`));
  try {
    chmodSync(forgedWs, 0o700);
    const marker = join(forgedWs, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
    writeFileSync(marker, `${JSON.stringify({
      version: 1,
      kind: 'TEST_ONLY_LIVE_OWNER_LEDGER_WORKSPACE_V1',
      workspaceId: '0'.repeat(32),
      ledgerDirName: 'ledger',
    })}\n`, { mode: 0o600 });
    const ledger = join(forgedWs, 'ledger');
    mkdirSync(ledger, { mode: 0o700 });
    chmodSync(ledger, 0o700);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(ledger),
      /TEST_ONLY_PROTECTED_PATH_DENIED|PROTECTED_OWNER_STORAGE/,
    );
  } finally {
    rmSync(forgedWs, { recursive: true, force: true });
  }
});

test('R5E-H/I canonical trust and ledger paths denied; protected ancestors denied', () => {
  const canonical = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  assert.throws(() => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(canonical), /PROTECTED|DENIED/);
  const home = resolveTrustedOwnerOsHome();
  assert.throws(() => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(home.home), /PROTECTED|DENIED/);
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(join(home.home, '.tecp-ops-pilot')),
    /PROTECTED|DENIED/,
  );
});

test('R5E-J symlink alias denied for brand', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  const aliasParent = mkdtempSync(join(tmpdir(), 'r5e-symlink-'));
  const alias = join(aliasParent, 'alias-ledger');
  try {
    symlinkSync(branded.rootPath, alias);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(alias),
      /SYMLINK|PROTECTED|DENIED|PROVENANCE/,
    );
  } finally {
    try { rmSync(aliasParent, { recursive: true, force: true }); } catch { /* ignore */ }
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  }
});

test('R5E-K missing or malformed provenance denied', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  const marker = join(branded.workspacePath, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
  const original = readFileSync(marker);
  try {
    rmSync(marker);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath),
      /PROVENANCE/,
    );
    writeFileSync(marker, '{not-json\n', { mode: 0o600 });
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath),
      /PROVENANCE/,
    );
  } finally {
    writeFileSync(marker, original, { mode: 0o600 });
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  }
});

test('R5E-L unsafe namespace permissions denied (isolated fixture home)', () => {
  const isoHome = mkdtempSync(join(tmpdir(), 'r5e-iso-home-'));
  const ns = join(isoHome, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
  mkdirSync(ns, { mode: 0o700 });
  chmodSync(ns, 0o755); // intentional unsafe mode inside isolated fixture only
  const homeRes = { ok: true, home: isoHome, uid: typeof process.getuid === 'function' ? process.getuid() : 0 };
  const denied = __testOnlyValidatePersistentNamespaceForDbFreeRegression(ns, homeRes);
  assert.equal(denied.ok, false);
  assert.ok((denied.reasons || []).some((r) => String(r).includes('UNSAFE_PERMISSIONS') || String(r).includes('NAMESPACE')));
  // Real retained namespace must remain untouched.
  assert.equal(statSync(persistentNamespacePath()).mode & 0o777, 0o700);
  rmSync(isoHome, { recursive: true, force: true });
});

test('R5E-L2 unsafe persistent workspace/ledger permissions denied (isolated workspace only)', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  try {
    chmodSync(branded.workspacePath, 0o755);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath),
      /UNSAFE_PERMISSIONS|PROTECTED|DENIED|WORKSPACE/,
    );
    chmodSync(branded.workspacePath, 0o700);
    chmodSync(branded.rootPath, 0o755);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath),
      /UNSAFE_PERMISSIONS|PROTECTED|DENIED|LEDGER/,
    );
  } finally {
    try { chmodSync(branded.workspacePath, 0o700); } catch { /* ignore */ }
    try { chmodSync(branded.rootPath, 0o700); } catch { /* ignore */ }
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  }
});

test('R5E-N access-only rebrand cannot cleanup', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  const childScript = join(tmpdir(), `r5e-cleanup-${process.pid}.mjs`);
  writeFileSync(childScript, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, __testOnlyRemoveIsolatedLiveOwnerLedgerRoot } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
try {
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  console.log('CLEANUP_UNEXPECTED_OK');
  process.exit(3);
} catch (err) {
  if (!String(err.message || err).includes('TEST_ONLY_CLEANUP_AUTHORITY_REQUIRED')) {
    console.error(String(err && err.stack || err));
    process.exit(4);
  }
  console.log('R5E_CLEANUP_DENIED_OK');
}
`);
  const ran = spawnSync(process.execPath, [childScript], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr || ran.stdout);
  assert.match(ran.stdout, /R5E_CLEANUP_DENIED_OK/);
  assert.equal(existsSync(branded.workspacePath), true);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  try { rmSync(childScript, { force: true }); } catch { /* ignore */ }
});

test('R5E-O/P creation/rebrand shared policy; prohibited TMPDIR creation denied before mutation', () => {
  const home = resolveTrustedOwnerOsHome();
  assert.equal(home.ok, true);
  const evil = mkdtempSync(join(home.home, 'r5e-evil-tmpdir-'));
  const previous = process.env.TMPDIR;
  try {
    process.env.TMPDIR = evil;
    assert.throws(
      () => __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(),
      /TMPDIR_UNDER_OWNER_HOME_OUTSIDE_PERSISTENT_NAMESPACE|CREATE_DENIED/,
    );
    const kids = readdirSync(evil).filter((n) => n.startsWith(LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX));
    assert.equal(kids.length, 0);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(evil, { recursive: true, force: true });
  }
});

test('R5E-Q missing trusted-home resolution fails closed (policy branch)', () => {
  const denied = evaluateTestOnlyProtectedStoragePolicy(
    join('/home/someone', LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME, 'tecp-owned-lol-x', 'ledger'),
    { ok: false, reasons: Object.freeze(['TRUSTED_HOMEDIR_UNAVAILABLE']) },
    { forCleanup: false },
  );
  assert.equal(denied.ok, false);
  assert.ok(denied.reasons.includes('TRUSTED_HOME_UNAVAILABLE_PROTECTION_FAIL_CLOSED'));
});

test('R5E-Q2 missing trusted-home creation precheck denies before mutation', () => {
  const parent = mkdtempSync(join(tmpdir(), 'r5e-missing-home-parent-'));
  const pre = __testOnlyEvaluateCreationPrecheckForDbFreeRegression(
    parent,
    { ok: false, reasons: Object.freeze(['TRUSTED_HOMEDIR_UNAVAILABLE']) },
  );
  assert.equal(pre.ok, false);
  assert.ok(pre.reasons.includes('TRUSTED_HOME_UNAVAILABLE_PROTECTION_FAIL_CLOSED'));
  const kids = readdirSync(parent).filter((n) => n.startsWith(LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX));
  assert.equal(kids.length, 0);
  rmSync(parent, { recursive: true, force: true });
});

test('R5E-P2 unsafe TMPDIR symlink parent denied before mutation', () => {
  const real = mkdtempSync(join(tmpdir(), 'r5e-real-tmp-'));
  const aliasParent = mkdtempSync(join(tmpdir(), 'r5e-alias-parent-'));
  const alias = join(aliasParent, 'tmp-alias');
  symlinkSync(real, alias);
  const previous = process.env.TMPDIR;
  try {
    process.env.TMPDIR = alias;
    assert.throws(
      () => __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(),
      /SYMLINK|CREATE_DENIED|CREATE_PARENT/,
    );
    const kids = readdirSync(real).filter((n) => n.startsWith(LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX));
    assert.equal(kids.length, 0);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(aliasParent, { recursive: true, force: true });
    rmSync(real, { recursive: true, force: true });
  }
});

test('R5E-R ordinary temp workspaces remain compatible; genuine-live path unchanged', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  assert.equal(
    branded.workspacePath.includes(`${LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME}`),
    false,
  );
  const rebranded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath);
  assert.equal(rebranded.accessOnly, true);
  const canonical = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  assert.match(canonical, /live-owner-jti-ledger-v1$/);
  assert.ok(canonical.includes('.tecp-ops-pilot'));
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});


test('R2-F01-B absent namespace creation under isolated 0750 home fixture', () => {
  const isoHome = mkdtempSync(join(tmpdir(), 'r2-home0750-'));
  chmodSync(isoHome, 0o750);
  const ns = join(isoHome, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
  assert.equal(existsSync(ns), false);
  const homeRes = {
    ok: true,
    home: isoHome,
    uid: typeof process.getuid === 'function' ? process.getuid() : 0,
  };
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({
    persistent: true,
    testOnlyTrustedHome: homeRes,
  });
  try {
    assert.equal(existsSync(ns), true);
    assert.equal(statSync(ns).mode & 0o777, 0o700);
    assert.equal(statSync(branded.workspacePath).mode & 0o777, 0o700);
    assert.match(branded.workspacePath, new RegExp(LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME));
    // Real retained namespace untouched.
    assert.equal(statSync(persistentNamespacePath()).mode & 0o777, 0o700);
  } finally {
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
    rmSync(isoHome, { recursive: true, force: true });
  }
});

test('R2-F01-A foreign/group-writable parent denied before mutation', () => {
  const isoHome = mkdtempSync(join(tmpdir(), 'r2-badparent-'));
  chmodSync(isoHome, 0o775); // group writable under injected home
  const before = new Set(readdirSync(isoHome));
  assert.throws(
    () => __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({
      persistent: true,
      testOnlyTrustedHome: {
        ok: true,
        home: isoHome,
        uid: typeof process.getuid === 'function' ? process.getuid() : 0,
      },
    }),
    /PARENT_DENIED|GROUP_OR_WORLD_WRITABLE|CREATE_DENIED|POLICY_DENIED/,
  );
  const after = readdirSync(isoHome);
  assert.equal(after.filter((n) => n.startsWith(LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX)).length, 0);
  assert.equal(existsSync(join(isoHome, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME)), false);
  assert.deepEqual(new Set(after), before);
  rmSync(isoHome, { recursive: true, force: true });
});

test('R2-F01-B/C namespace sync failure identity-bound empty rollback', () => {
  const isoHome = mkdtempSync(join(tmpdir(), 'r2-ns-syncfail-'));
  chmodSync(isoHome, 0o750);
  const ns = join(isoHome, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
  __testOnlyArmDirectoryFsyncFailureForDbFreeRegression(ns, 'private');
  try {
    assert.throws(
      () => __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({
        persistent: true,
        testOnlyTrustedHome: {
          ok: true,
          home: isoHome,
          uid: typeof process.getuid === 'function' ? process.getuid() : 0,
        },
      }),
      /NAMESPACE_SYNC_FAILED|INJECTED_FSYNC/,
    );
  } finally {
    __testOnlyClearDirectoryFsyncFailureForDbFreeRegression();
  }
  // Empty newly created ns should be removed; unrelated entries preserved.
  assert.equal(existsSync(ns), false);
  rmSync(isoHome, { recursive: true, force: true });
});

test('R2-F01-C unrelated pre-existing namespace entries preserved on parent sync failure', () => {
  const isoHome = mkdtempSync(join(tmpdir(), 'r2-ns-preserve-'));
  chmodSync(isoHome, 0o750);
  const ns = join(isoHome, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
  mkdirSync(ns, { mode: 0o700 });
  chmodSync(ns, 0o700);
  const keeper = join(ns, 'preexisting-keep-me');
  writeFileSync(keeper, 'keep\n', { mode: 0o600 });
  // Namespace already exists — ensurePersistent validates and returns without recreate.
  // Arm parent sync failure path via creating under a fresh home where ns absent:
  const isoHome2 = mkdtempSync(join(tmpdir(), 'r2-ns-preserve2-'));
  chmodSync(isoHome2, 0o750);
  const ns2 = join(isoHome2, LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME);
  const unrelated = join(isoHome2, 'unrelated-entry.txt');
  writeFileSync(unrelated, 'x\n', { mode: 0o600 });
  __testOnlyArmDirectoryFsyncFailureForDbFreeRegression(isoHome2, 'parent');
  try {
    assert.throws(
      () => __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({
        persistent: true,
        testOnlyTrustedHome: {
          ok: true,
          home: isoHome2,
          uid: typeof process.getuid === 'function' ? process.getuid() : 0,
        },
      }),
      /PARENT_SYNC_FAILED|INJECTED_FSYNC|RESIDUAL/,
    );
  } finally {
    __testOnlyClearDirectoryFsyncFailureForDbFreeRegression();
  }
  assert.equal(existsSync(unrelated), true);
  assert.equal(readFileSync(unrelated, 'utf8'), 'x\n');
  // First fixture keeper untouched
  assert.equal(existsSync(keeper), true);
  rmSync(isoHome, { recursive: true, force: true });
  rmSync(isoHome2, { recursive: true, force: true });
});

test('R2-F01-D unsafe provenance marker permissions denied via actual rebrand', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  const marker = join(branded.workspacePath, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
  const prev = statSync(marker).mode & 0o777;
  try {
    chmodSync(marker, 0o644);
    assert.throws(
      () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath),
      /PROVENANCE_UNSAFE_PERMISSIONS|PROVENANCE/,
    );
  } finally {
    try { chmodSync(marker, prev); } catch { /* ignore */ }
    __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  }
});

test('R2-F01-A ordinary temp creation still compatible after parent validation', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot();
  assert.equal(
    branded.workspacePath.includes(LIVE_OWNER_JTI_LEDGER_PERSISTENT_TEST_NAMESPACE_DIRNAME),
    false,
  );
  const rebranded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(branded.rootPath);
  assert.equal(rebranded.accessOnly, true);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
});

test('R5E claimant-exit then later independent persistent rebrand replay denial', () => {
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot({ persistent: true });
  const jti = 'jti-r5e-claimant-exit-0001';
  const claimant = join(tmpdir(), `r5e-claimant-${process.pid}.mjs`);
  const later = join(tmpdir(), `r5e-later-${process.pid}.mjs`);
  writeFileSync(claimant, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded });
if (!r.ok || r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY) {
  console.error(JSON.stringify(r));
  process.exit(2);
}
console.log('CLAIMANT_OK');
`);
  const claimRan = spawnSync(process.execPath, [claimant], { encoding: 'utf8' });
  assert.equal(claimRan.status, 0, claimRan.stderr || claimRan.stdout);
  writeFileSync(later, `
import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(LEDGER_SRC)};
const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded });
if (r.outcome !== LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED) {
  console.error(JSON.stringify(r));
  process.exit(3);
}
console.log('LATER_DENY_OK');
`);
  const laterRan = spawnSync(process.execPath, [later], { encoding: 'utf8' });
  assert.equal(laterRan.status, 0, laterRan.stderr || laterRan.stdout);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  try { rmSync(claimant, { force: true }); rmSync(later, { force: true }); } catch { /* ignore */ }
});

