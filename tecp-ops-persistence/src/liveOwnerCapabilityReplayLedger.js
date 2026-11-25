/**
 * Durable Live Owner capability JTI replay ledger (filesystem, cross-process).
 *
 * Domain: LIVE Owner capability JTIs only. Not offline implementation JTIs,
 * not TEST_ONLY operational capability JTIs, and not disposable PostgreSQL
 * transaction replay records.
 *
 * Genuine-live storage path is derived from the Owner-installed trust registry
 * directory and is never caller-selectable. Isolated TEST_ONLY ledgers may use
 * branded temporary roots for DB-free regression only.
 *
 * Supported filesystem assumptions: local POSIX filesystem with durable
 * O_CREAT|O_EXCL exclusive create plus fsync of claim file and parent directory
 * (e.g. ext4 on the SIMIN lab). Process-restart persistence is covered by tests;
 * host reboot / power-loss durability is a remaining environmental readiness
 * requirement and is not claimed as observed evidence by this module alone.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

import { OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR } from './disposableOpsPilotDbHarness.js';

export const LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN = 'LIVE_OWNER_CAPABILITY_JTI_V1';
export const LIVE_OWNER_JTI_LEDGER_DIRNAME = 'live-owner-jti-ledger-v1';
export const LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS =
  'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_ROOT_V1';

export const LIVE_OWNER_JTI_CLAIM_OUTCOMES = Object.freeze({
  CLAIM_CONSUMED_SUCCESSFULLY: 'CLAIM_CONSUMED_SUCCESSFULLY',
  CLAIM_ALREADY_CONSUMED: 'CLAIM_ALREADY_CONSUMED',
  CLAIM_STORAGE_UNAVAILABLE_OR_INVALID: 'CLAIM_STORAGE_UNAVAILABLE_OR_INVALID',
});

const testOnlyLedgerRootLatch = new WeakSet();
const JTI_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const EXPECTED_DIR_MODE_MASK = 0o777;
const EXPECTED_DIR_MODE = 0o700;
const EXPECTED_FILE_MODE = 0o600;
const CLAIM_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function outcome(code, reasons = [], extra = {}) {
  const ok = code === LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY;
  return Object.freeze({
    ok,
    outcome: code,
    reasons: Object.freeze([...reasons]),
    ...extra,
  });
}

export function isValidLiveOwnerCapabilityJti(jti) {
  return isNonEmptyString(jti) && JTI_PATTERN.test(jti) && !jti.includes('..') && !jti.includes('/')
    && !jti.includes('\\');
}

export function canonicalizeLiveOwnerCapabilityJtiIdentity(jti) {
  if (!isValidLiveOwnerCapabilityJti(jti)) {
    return null;
  }
  const material = `${LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN}\n${jti}`;
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export function resolveCanonicalLiveOwnerCapabilityReplayLedgerPath(home = undefined) {
  // Caller-supplied home is ignored for genuine-live authority.
  void home;
  const trustedHome = homedir();
  const trustDir = join(trustedHome, OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR);
  return join(trustDir, LIVE_OWNER_JTI_LEDGER_DIRNAME);
}

export function brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(rootPath) {
  if (!isNonEmptyString(rootPath)) {
    throw new TypeError('TEST_ONLY_LEDGER_ROOT_REQUIRED');
  }
  const abs = resolve(rootPath);
  const branded = {
    proofClass: LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS,
    __testOnlyLiveOwnerLedgerRoot: true,
    rootPath: abs,
  };
  testOnlyLedgerRootLatch.add(branded);
  return Object.freeze(branded);
}

export function isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(value) {
  return isPlainObject(value)
    && value.__testOnlyLiveOwnerLedgerRoot === true
    && value.proofClass === LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS
    && testOnlyLedgerRootLatch.has(value)
    && isNonEmptyString(value.rootPath);
}

function modeOf(stat) {
  return stat.mode & EXPECTED_DIR_MODE_MASK;
}

function assertSafeDirectory(path, { createIfMissing = false } = {}) {
  if (createIfMissing && !existsSync(path)) {
    mkdirSync(path, { recursive: false, mode: EXPECTED_DIR_MODE });
  }
  let lst;
  try {
    lst = lstatSync(path);
  } catch (err) {
    return { ok: false, reasons: ['LEDGER_DIR_LSTAT_FAILED', String(err.message || err)] };
  }
  if (lst.isSymbolicLink()) {
    return { ok: false, reasons: ['LEDGER_DIR_SYMLINK_FORBIDDEN'] };
  }
  if (!lst.isDirectory()) {
    return { ok: false, reasons: ['LEDGER_DIR_NOT_DIRECTORY'] };
  }
  if (typeof process.getuid === 'function' && lst.uid !== process.getuid()) {
    return { ok: false, reasons: ['LEDGER_DIR_UNEXPECTED_OWNERSHIP', `UID=${lst.uid}`] };
  }
  if (modeOf(lst) !== EXPECTED_DIR_MODE) {
    return {
      ok: false,
      reasons: ['LEDGER_DIR_UNSAFE_PERMISSIONS', `MODE=${modeOf(lst).toString(8)}`],
    };
  }
  return { ok: true };
}

function assertNoSymlinkPathComponents(absPath) {
  const resolved = resolve(absPath);
  const parts = resolved.split(sep).filter(Boolean);
  let cur = resolved.startsWith(sep) ? sep : '';
  for (const part of parts) {
    cur = cur === sep ? `${sep}${part}` : (cur ? join(cur, part) : part);
    try {
      const lst = lstatSync(cur);
      if (lst.isSymbolicLink()) {
        return { ok: false, reasons: ['PATH_COMPONENT_SYMLINK_FORBIDDEN', `AT=${cur}`] };
      }
    } catch (err) {
      return { ok: false, reasons: ['PATH_COMPONENT_LSTAT_FAILED', String(err.message || err)] };
    }
  }
  return { ok: true };
}

function assertSafeRegularFile(path) {
  let lst;
  try {
    lst = lstatSync(path);
  } catch (err) {
    return { ok: false, reasons: ['CLAIM_FILE_LSTAT_FAILED', String(err.message || err)] };
  }
  if (lst.isSymbolicLink()) {
    return { ok: false, reasons: ['CLAIM_FILE_SYMLINK_FORBIDDEN'] };
  }
  if (!lst.isFile()) {
    return { ok: false, reasons: ['CLAIM_FILE_NOT_REGULAR'] };
  }
  if (typeof process.getuid === 'function' && lst.uid !== process.getuid()) {
    return { ok: false, reasons: ['CLAIM_FILE_UNEXPECTED_OWNERSHIP', `UID=${lst.uid}`] };
  }
  if (modeOf(lst) !== EXPECTED_FILE_MODE) {
    return {
      ok: false,
      reasons: ['CLAIM_FILE_UNSAFE_PERMISSIONS', `MODE=${modeOf(lst).toString(8)}`],
    };
  }
  return { ok: true };
}

function claimPathForIdentity(ledgerRoot, identityHex) {
  if (!/^[0-9a-f]{64}$/.test(identityHex)) {
    return null;
  }
  // Shard one level to avoid huge directories; identity remains collision-resistant.
  const shard = identityHex.slice(0, 2);
  return join(ledgerRoot, shard, `${identityHex}.claim`);
}

function writeClaimPayload(fd, payloadObject) {
  const body = `${JSON.stringify(payloadObject)}\n`;
  writeSync(fd, body, 0, 'utf8');
}

function fsyncFd(fd) {
  fsyncSync(fd);
}

function fsyncPathDirectory(dirPath) {
  const fd = openSync(dirPath, fsConstants.O_RDONLY);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Atomically consume a Live Owner capability JTI.
 *
 * @param {string} jti
 * @param {object} [metadata] non-secret audit fields only
 * @param {object} [options]
 * @param {object} [options.testOnlyLedgerRoot] branded TEST_ONLY root
 * @param {boolean} [options.allowCreateLedgerDir] TEST_ONLY only
 * @param {Function} [options.writeHook] test injection after exclusive create
 * @param {Function} [options.syncHook] test injection before fsync
 */
export function consumeLiveOwnerCapabilityJti(jti, metadata = {}, options = {}) {
  if (!isPlainObject(options)) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'OPTIONS_OBJECT_REQUIRED',
    ]);
  }
  if (options.ledgerRoot != null
    || options.ledgerPath != null
    || options.rootPath != null
    || options.home != null
    || options.trustHome != null
    || options.replayDirectory != null) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CALLER_LEDGER_PATH_OVERRIDE_FORBIDDEN',
    ]);
  }
  if (!isValidLiveOwnerCapabilityJti(jti)) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'INVALID_JTI',
    ]);
  }
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  if (!identity) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'IDENTITY_DERIVATION_FAILED',
    ]);
  }

  let ledgerRoot;
  let testOnly = false;
  if (options.testOnlyLedgerRoot != null) {
    if (!isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(options.testOnlyLedgerRoot)) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'TEST_ONLY_LEDGER_ROOT_BRAND_REQUIRED',
      ]);
    }
    ledgerRoot = options.testOnlyLedgerRoot.rootPath;
    testOnly = true;
  } else {
    ledgerRoot = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  }

  // Genuine-live: never auto-create missing ledger (Owner provisioning required).
  const createIfMissing = testOnly === true && options.allowCreateLedgerDir === true;
  if (!existsSync(ledgerRoot) && !createIfMissing) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'LEDGER_DIR_MISSING',
      `PATH=${ledgerRoot}`,
    ]);
  }
  if (createIfMissing && !existsSync(ledgerRoot)) {
    try {
      mkdirSync(ledgerRoot, { recursive: true, mode: EXPECTED_DIR_MODE });
      chmodSync(ledgerRoot, EXPECTED_DIR_MODE);
    } catch (err) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'LEDGER_DIR_CREATE_FAILED',
        String(err.message || err),
      ]);
    }
  }

  const symlinkPathCheck = assertNoSymlinkPathComponents(ledgerRoot);
  if (!symlinkPathCheck.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      symlinkPathCheck.reasons,
    );
  }

  const dirCheck = assertSafeDirectory(ledgerRoot, { createIfMissing: false });
  if (!dirCheck.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      dirCheck.reasons,
    );
  }

  const claimPath = claimPathForIdentity(ledgerRoot, identity);
  if (!claimPath) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_PATH_DERIVATION_FAILED',
    ]);
  }
  // Path must remain under ledger root (defense in depth).
  const resolvedClaim = resolve(claimPath);
  const resolvedRoot = resolve(ledgerRoot);
  if (!resolvedClaim.startsWith(resolvedRoot + sep) && resolvedClaim !== resolvedRoot) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_PATH_TRAVERSAL_REJECTED',
    ]);
  }

  const shardDir = dirname(claimPath);
  if (!existsSync(shardDir)) {
    try {
      mkdirSync(shardDir, { recursive: true, mode: EXPECTED_DIR_MODE });
      chmodSync(shardDir, EXPECTED_DIR_MODE);
    } catch (err) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'SHARD_DIR_CREATE_FAILED',
        String(err.message || err),
      ]);
    }
  }
  const shardCheck = assertSafeDirectory(shardDir);
  if (!shardCheck.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      shardCheck.reasons,
    );
  }

  if (existsSync(claimPath)) {
    const existing = assertSafeRegularFile(claimPath);
    // Any existing claim marker — even corrupt — is non-reusable (fail-closed).
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED, [
      'CLAIM_FILE_EXISTS',
      ...(existing.ok ? [] : existing.reasons),
    ], {
      identity,
      claimPath: testOnly ? claimPath : undefined,
    });
  }

  let fd;
  const noFollow = Number(fsConstants.O_NOFOLLOW || 0);
  try {
    fd = openSync(
      claimPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | noFollow,
      EXPECTED_FILE_MODE,
    );
  } catch (err) {
    if (err && (err.code === 'EEXIST' || err.code === 'EISDIR')) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_ALREADY_CONSUMED, [
        'EXCLUSIVE_CREATE_LOST_RACE',
        String(err.code || err.message || err),
      ], { identity });
    }
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'EXCLUSIVE_CREATE_FAILED',
      String(err.code || err.message || err),
    ], { identity });
  }

  // Exclusive create succeeded — marker exists. Never unlink on later failure.
  const consumedAt = new Date().toISOString();
  const safeMeta = isPlainObject(metadata) ? {
    suitePath: isNonEmptyString(metadata.suitePath) ? metadata.suitePath : undefined,
    repositoryId: isNonEmptyString(metadata.repositoryId) ? metadata.repositoryId : undefined,
    pinnedMainSha: isNonEmptyString(metadata.pinnedMainSha) ? metadata.pinnedMainSha : undefined,
    kid: isNonEmptyString(metadata.kid) ? metadata.kid : undefined,
    purpose: isNonEmptyString(metadata.purpose) ? metadata.purpose : undefined,
  } : {};
  const payload = {
    version: CLAIM_VERSION,
    domain: LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN,
    identity,
    jtiSha256: createHash('sha256').update(jti, 'utf8').digest('hex'),
    consumedAt,
    pid: process.pid,
    testOnly,
    ...safeMeta,
  };

  try {
    if (typeof options.writeHook === 'function') {
      options.writeHook({ phase: 'after_exclusive_create', claimPath, identity });
    }
    writeClaimPayload(fd, payload);
    if (typeof options.syncHook === 'function') {
      options.syncHook({ phase: 'before_fsync', claimPath, identity });
    }
    fsyncFd(fd);
  } catch (err) {
    try { closeSync(fd); } catch { /* ignore */ }
    // Leave partial claim in place — fail-closed, non-reusable.
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_WRITE_OR_SYNC_FAILED',
      String(err.message || err),
      'PARTIAL_CLAIM_RETAINS_CONSUMPTION',
    ], { identity, partial: true });
  }

  try {
    closeSync(fd);
  } catch (err) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_CLOSE_FAILED',
      String(err.message || err),
      'PARTIAL_CLAIM_RETAINS_CONSUMPTION',
    ], { identity, partial: true });
  }

  try {
    fsyncPathDirectory(shardDir);
    fsyncPathDirectory(ledgerRoot);
  } catch (err) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'DIRECTORY_FSYNC_FAILED',
      String(err.message || err),
      'PARTIAL_CLAIM_RETAINS_CONSUMPTION',
    ], { identity, partial: true });
  }

  const fileCheck = assertSafeRegularFile(claimPath);
  if (!fileCheck.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      [...fileCheck.reasons, 'PARTIAL_CLAIM_RETAINS_CONSUMPTION'],
      { identity, partial: true },
    );
  }

  return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_CONSUMED_SUCCESSFULLY, [
    'EXCLUSIVE_CREATE_OK',
    'DURABLE_FILE_SYNC_OK',
    'DURABLE_DIRECTORY_SYNC_OK',
  ], {
    identity,
    claimPath: testOnly ? claimPath : undefined,
    consumedAt,
  });
}

export function inspectLiveOwnerCapabilityJtiClaim(jti, options = {}) {
  if (!isValidLiveOwnerCapabilityJti(jti)) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, ['INVALID_JTI']);
  }
  if (options.ledgerRoot != null || options.home != null) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CALLER_LEDGER_PATH_OVERRIDE_FORBIDDEN',
    ]);
  }
  let ledgerRoot;
  let testOnly = false;
  if (options.testOnlyLedgerRoot != null) {
    if (!isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(options.testOnlyLedgerRoot)) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'TEST_ONLY_LEDGER_ROOT_BRAND_REQUIRED',
      ]);
    }
    ledgerRoot = options.testOnlyLedgerRoot.rootPath;
    testOnly = true;
  } else {
    ledgerRoot = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
  }
  const identity = canonicalizeLiveOwnerCapabilityJtiIdentity(jti);
  const claimPath = claimPathForIdentity(ledgerRoot, identity);
  if (!existsSync(ledgerRoot)) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'LEDGER_DIR_MISSING',
    ]);
  }
  if (!existsSync(claimPath)) {
    return Object.freeze({
      ok: true,
      present: false,
      identity,
      claimPath: testOnly ? claimPath : undefined,
    });
  }
  const safe = assertSafeRegularFile(claimPath);
  let raw = null;
  try {
    raw = readFileSync(claimPath, 'utf8');
  } catch (err) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_READ_FAILED',
      String(err.message || err),
    ], { present: true, identity });
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  return Object.freeze({
    ok: safe.ok,
    present: true,
    identity,
    safeFile: safe.ok,
    reasons: safe.ok ? Object.freeze([]) : Object.freeze([...safe.reasons]),
    parsed,
    claimPath: testOnly ? claimPath : undefined,
  });
}

/** TEST_ONLY helper: prepare an isolated empty ledger root (700). */
export function __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(baseTempDir) {
  if (!isNonEmptyString(baseTempDir)) {
    throw new TypeError('BASE_TEMP_DIR_REQUIRED');
  }
  const root = join(resolve(baseTempDir), `ledger-${randomBytes(8).toString('hex')}`);
  mkdirSync(root, { recursive: true, mode: EXPECTED_DIR_MODE });
  chmodSync(root, EXPECTED_DIR_MODE);
  return brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(root);
}

/** TEST_ONLY helper: remove an isolated branded ledger root. */
export function __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(brandedRoot) {
  if (!isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(brandedRoot)) {
    throw new TypeError('BRANDED_ROOT_REQUIRED');
  }
  rmSync(brandedRoot.rootPath, { recursive: true, force: true });
}

export function createDurableLiveOwnerReplayRegistry(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('OPTIONS_OBJECT_REQUIRED');
  }
  const testOnly = options.testOnlyLedgerRoot != null;
  if (testOnly && !isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(options.testOnlyLedgerRoot)) {
    throw new TypeError('TEST_ONLY_LEDGER_ROOT_BRAND_REQUIRED');
  }
  if (!testOnly) {
    for (const key of ['ledgerRoot', 'ledgerPath', 'home', 'trustHome', 'rootPath']) {
      if (options[key] != null) {
        throw new TypeError('CALLER_LEDGER_PATH_OVERRIDE_FORBIDDEN');
      }
    }
  }
  const consumeOpts = {
    testOnlyLedgerRoot: options.testOnlyLedgerRoot,
    allowCreateLedgerDir: testOnly === true && options.allowCreateLedgerDir === true,
    writeHook: options.writeHook,
    syncHook: options.syncHook,
  };
  return Object.freeze({
    kind: testOnly
      ? 'TEST_ONLY_DURABLE_LIVE_OWNER_REPLAY_REGISTRY'
      : 'OWNER_INSTALLED_DURABLE_LIVE_OWNER_REPLAY_REGISTRY',
    consumeAtomic(jti, metadata = {}) {
      return consumeLiveOwnerCapabilityJti(jti, metadata, consumeOpts);
    },
  });
}
