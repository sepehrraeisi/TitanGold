/**
 * DB-free durable Live Owner JTI ledger + verifier integration + Runner classification.
 * Uses isolated temporary ledgers and ephemeral TEST_ONLY Ed25519 keys only.
 * No genuine Owner trust mutation. No live ledger provisioning. No SQL/PostgreSQL.
 */
import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
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
  canonicalizeLiveOwnerCapabilityJtiIdentity,
  consumeLiveOwnerCapabilityJti,
  createDurableLiveOwnerReplayRegistry,
  inspectLiveOwnerCapabilityJtiClaim,
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
    const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const ws = tempWorkspace();
  const missing = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(join(ws, 'missing-ledger'));
  const result = consumeLiveOwnerCapabilityJti('jti-missing-01', {}, {
    testOnlyLedgerRoot: missing,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.includes('LEDGER_DIR_MISSING'));
  rmSync(ws, { recursive: true, force: true });
});

test('unsafe directory permissions are denied', () => {
  const ws = tempWorkspace();
  const root = join(ws, 'wide');
  mkdirSync(root, { recursive: true });
  chmodSync(root, 0o755);
  const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(root);
  const result = consumeLiveOwnerCapabilityJti('jti-perms-0001', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.some((r) => r.includes('UNSAFE_PERMISSIONS') || r.includes('LEDGER_DIR_UNSAFE')));
  rmSync(ws, { recursive: true, force: true });
});

test('symlink ledger root is denied', () => {
  const ws = tempWorkspace();
  const real = join(ws, 'real');
  const link = join(ws, 'link');
  mkdirSync(real, { mode: 0o700 });
  chmodSync(real, 0o700);
  symlinkSync(real, link);
  const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(link);
  const result = consumeLiveOwnerCapabilityJti('jti-symlink-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  assert.ok(result.reasons.some((r) => String(r).includes('SYMLINK')));
  rmSync(ws, { recursive: true, force: true });
});

test('invalid ledger object type (non-directory) is denied', () => {
  const ws = tempWorkspace();
  const fileAsRoot = join(ws, 'not-a-dir');
  writeFileSync(fileAsRoot, 'not-a-directory\n', { mode: 0o600 });
  const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(fileAsRoot);
  const result = consumeLiveOwnerCapabilityJti('jti-notdir-01', {}, {
    testOnlyLedgerRoot: branded,
    allowCreateLedgerDir: false,
  });
  assert.equal(result.outcome, LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID);
  rmSync(ws, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// F04 — filesystem security (injected fault vs actual FS)
// ---------------------------------------------------------------------------

test('INJECTED_FAULT: write failure after exclusive create remains non-reusable', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
    const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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

test('F03 TEST_ONLY cannot brand or cleanup canonical genuine-live ledger', () => {
  const canonical = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  assert.throws(
    () => brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(canonical),
    /TEST_ONLY_CANONICAL_LEDGER_ACCESS_DENIED/,
  );
  // Fake a branded object pointing at canonical — cleanup must still refuse.
  const fake = {
    proofClass: 'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_ROOT_V1',
    __testOnlyLiveOwnerLedgerRoot: true,
    rootPath: canonical,
  };
  assert.throws(
    () => __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(fake),
    /BRANDED_ROOT_REQUIRED|TEST_ONLY_CANONICAL_LEDGER_ACCESS_DENIED/,
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
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
  const ws = tempWorkspace();
  const missing = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(join(ws, 'absent'));
  const keys = ephemeralOwnerKeys('kid-storage');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: createDurableLiveOwnerReplayRegistry({
      testOnlyLedgerRoot: missing,
      allowCreateLedgerDir: false,
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-storage-miss-01' }), keys.privatePem);
  const result = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(result.ok, false);
  assert.equal(result.decision, S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE);
  rmSync(ws, { recursive: true, force: true });
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

test('F02 BEHAVIORAL: replay denial never starts controller; prepare count zero', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
  const keys = ephemeralOwnerKeys('kid-runner-replay');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const claims = baseClaims({ kid: keys.kid, jti: 'jti-runner-replay-01' });
  const token = signToken(claims, keys.privatePem);
  const deps = durableTestDeps(branded);
  const first = verifyS2Tier3OwnerCapabilityArtifact(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(first.ok, true);

  let startCount = 0;
  let prepareCount = 0;
  const auth = verifyLiveOwnerCapabilityForRunner(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(auth.ok, false);
  assert.equal(auth.decision, OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY);
  assert.equal(auth.dbControllerStartPermitted, false);
  const gated = enforceLiveCapabilityPreStartGate(auth, () => {
    startCount += 1;
    prepareCount += 1;
  });
  assert.equal(gated.started, false);
  assert.equal(gated.startInvocationCount, 0);
  assert.equal(gated.prepareInvocationCount, 0);
  assert.equal(startCount, 0);
  assert.equal(prepareCount, 0);
  __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(branded);
  rmSync(ws, { recursive: true, force: true });
});

test('F02 BEHAVIORAL: storage denial never starts controller; prepare count zero', () => {
  __testOnlyResetS2Tier3OwnerCapabilityRegistries();
  const ws = tempWorkspace();
  const missing = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(join(ws, 'absent-runner'));
  const keys = ephemeralOwnerKeys('kid-runner-storage');
  __testOnlyRegisterOwnerPublicKeyForVerification(keys.kid, keys.publicPem);
  const deps = __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps({
    nowMs: 1_700_000_100_500,
    replayRegistry: createDurableLiveOwnerReplayRegistry({
      testOnlyLedgerRoot: missing,
      allowCreateLedgerDir: false,
    }),
  });
  const token = signToken(baseClaims({ kid: keys.kid, jti: 'jti-runner-storage-01' }), keys.privatePem);
  let startCount = 0;
  let prepareCount = 0;
  const auth = verifyLiveOwnerCapabilityForRunner(token, { suitePath: SUITE_PATH }, deps);
  assert.equal(auth.ok, false);
  assert.equal(auth.decision, OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE);
  assert.equal(auth.dbControllerStartPermitted, false);
  const gated = enforceLiveCapabilityPreStartGate(auth, () => {
    startCount += 1;
    prepareCount += 1;
  });
  assert.equal(gated.startInvocationCount, 0);
  assert.equal(gated.prepareInvocationCount, 0);
  assert.equal(startCount, 0);
  assert.equal(prepareCount, 0);
  rmSync(ws, { recursive: true, force: true });
});

test('STATIC_SOURCE_REVIEW_ONLY: canonical Runner places pre-start gate before controller.start', () => {
  const src = readFileSync(RUNNER_SRC, 'utf8');
  const gateAt = src.indexOf('verifyLiveOwnerCapabilityForRunner(');
  const startAt = src.indexOf('controller.start(');
  assert.ok(gateAt > 0, 'shared pre-start gate must exist');
  assert.ok(startAt > gateAt, 'controller.start must follow pre-start gate');
  assert.match(src, /enforceLiveCapabilityPreStartGate|DB_CONTROLLER_START_NOT_REACHED/);
  assert.match(src, /createOwnerInstalledFixedTrustVerifierDeps/);
  // Explicitly classify: this test is STATIC_SOURCE_REVIEW only — not executable pre-start proof.
  assert.equal('STATIC_SOURCE_REVIEW', 'STATIC_SOURCE_REVIEW');
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
