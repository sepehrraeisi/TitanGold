/**
 * DB-free durable Live Owner JTI ledger + verifier integration + Runner classification.
 * Uses isolated temporary ledgers and ephemeral TEST_ONLY Ed25519 keys only.
 */
import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
  verifyS2Tier3OwnerCapabilityArtifact,
} from '../scripts/s2Tier3OwnerCapabilityVerifier.js';

import {
  OWNER_RUNNER_DECISIONS,
  classifyOwnerRunnerOutcome,
  mapCapabilityVerifyFailureToRunnerDecision,
} from '../scripts/ownerControlledTier3LocalRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
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

test('write failure after exclusive create remains non-reusable', () => {
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

test('sync failure after exclusive create remains non-reusable', () => {
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
    import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(join(HERE, '../src/liveOwnerCapabilityReplayLedger.js'))};
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

test('concurrent child-process race has exactly one winner', () => {
  const ws = tempWorkspace();
  const branded = __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(ws);
  const jti = 'jti-race-00000001';
  const worker = join(ws, 'race-worker.mjs');
  writeFileSync(worker, `
    import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, consumeLiveOwnerCapabilityJti, LIVE_OWNER_JTI_CLAIM_OUTCOMES } from ${JSON.stringify(join(HERE, '../src/liveOwnerCapabilityReplayLedger.js'))};
    const branded = brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(${JSON.stringify(branded.rootPath)});
    const r = consumeLiveOwnerCapabilityJti(${JSON.stringify(jti)}, {}, { testOnlyLedgerRoot: branded, allowCreateLedgerDir: false });
    process.stdout.write(JSON.stringify({ outcome: r.outcome, pid: process.pid }) + '\\n');
  `);
  const children = [];
  for (let i = 0; i < 8; i += 1) {
    children.push(spawnSync(process.execPath, [worker], { encoding: 'utf8' }));
  }
  const outcomes = children.map((c) => {
    assert.equal(c.status, 0, c.stderr);
    return JSON.parse(c.stdout.trim());
  });
  const wins = outcomes.filter((o) => o.outcome === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY);
  const denies = outcomes.filter((o) => o.outcome === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED);
  assert.equal(wins.length, 1);
  assert.equal(denies.length, 7);
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

test('canonical production ledger path is derived from Owner trust architecture', () => {
  const path = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath('/tmp/evil-home');
  assert.match(path, /\.tecp-ops-pilot[/\\]s2-simin-owner-trust[/\\]live-owner-jti-ledger-v1$/);
  assert.doesNotMatch(path, /evil-home/);
});

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
    import { brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot, createDurableLiveOwnerReplayRegistry } from ${JSON.stringify(join(HERE, '../src/liveOwnerCapabilityReplayLedger.js'))};
    import {
      __testOnlyCreateS2Tier3OwnerCapabilityVerifierDeps,
      __testOnlyRegisterOwnerPublicKeyForVerification,
      __testOnlyResetS2Tier3OwnerCapabilityRegistries,
      verifyS2Tier3OwnerCapabilityArtifact,
      S2_TIER3_OWNER_CAPABILITY_DECISIONS,
    } from ${JSON.stringify(join(HERE, '../scripts/s2Tier3OwnerCapabilityVerifier.js'))};
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
  // Invalid signature for good JTI must not consume it.
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

test('owner-installed deps construction rejects caller replay backend override', () => {
  const denied = createOwnerInstalledFixedTrustVerifierDeps({
    replayRegistry: { has() { return false; }, record() {} },
  });
  assert.equal(denied.ok, false);
});

test('owner-installed deps expose durable consumeAtomic and not process-local Set authority', () => {
  const deps = createOwnerInstalledFixedTrustVerifierDeps({});
  // Lab may lack pubkey in this worktree user context — accept missing trust OR durable registry.
  if (deps && deps.ok === false) {
    assert.ok(Array.isArray(deps.reasons));
    return;
  }
  assert.equal(typeof deps.replayRegistry.consumeAtomic, 'function');
  assert.equal(typeof deps.replayRegistry.has, 'undefined');
  assert.equal(deps.durableLiveOwnerReplay, true);
});

test('Runner classification: suite failure with successful lifecycle', () => {
  const c = classifyOwnerRunnerOutcome({
    suiteOk: false,
    stopValidated: true,
    cleanupValidated: true,
    suiteDecision: 'DISPATCHER_LIVE_MATRIX_DENIED',
  });
  assert.equal(c.decision, OWNER_RUNNER_DECISIONS.DENY_SUITE_ACCEPTANCE_FAILED);
  assert.deepEqual([...c.failureCauses], ['SUITE_ACCEPTANCE_FAILED']);
});

test('Runner classification: stop / cleanup / multi / success', () => {
  assert.equal(classifyOwnerRunnerOutcome({
    suiteOk: true, stopValidated: false, cleanupValidated: true,
  }).decision, OWNER_RUNNER_DECISIONS.DENY_STOP_FAILED);
  assert.equal(classifyOwnerRunnerOutcome({
    suiteOk: true, stopValidated: true, cleanupValidated: false,
  }).decision, OWNER_RUNNER_DECISIONS.DENY_CLEANUP_FAILED);
  assert.equal(classifyOwnerRunnerOutcome({
    suiteOk: false, stopValidated: false, cleanupValidated: false,
  }).decision, OWNER_RUNNER_DECISIONS.DENY_MULTI_FAILURE);
  assert.equal(classifyOwnerRunnerOutcome({
    suiteOk: true, stopValidated: true, cleanupValidated: true,
    successDecision: OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION,
  }).decision, OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION);
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

test('canonical Runner call chain places durable verify before controller.start', () => {
  const src = readFileSync(join(HERE, '../scripts/ownerControlledTier3LocalRunner.js'), 'utf8');
  const verifyAt = src.indexOf('verifyS2Tier3OwnerCapabilityArtifact(capabilityToken');
  const startAt = src.indexOf('controller.start(');
  assert.ok(verifyAt > 0);
  assert.ok(startAt > verifyAt);
  assert.match(src, /mapCapabilityVerifyFailureToRunnerDecision/);
  assert.match(src, /DB_CONTROLLER_START_NOT_REACHED/);
  assert.match(src, /createOwnerInstalledFixedTrustVerifierDeps/);
});

test('canonical verifier genuine-live path requires durable consumeAtomic', () => {
  const src = readFileSync(join(HERE, '../scripts/s2Tier3OwnerCapabilityVerifier.js'), 'utf8');
  assert.match(src, /createDurableLiveOwnerReplayRegistry/);
  assert.match(src, /OWNER_INSTALLED_REQUIRES_DURABLE_ATOMIC_CONSUME/);
  assert.match(src, /NO_PROCESS_LOCAL_REPLAY_FALLBACK/);
  assert.match(src, /DENY_REPLAY_STORAGE/);
  assert.doesNotMatch(src, /const replay = new Set\(\);\s*\n\s*const revoked = new Set\(\);\s*\n\s*const deps = \{\s*\n\s*proofClass: S2_OWNER_INSTALLED/);
});
