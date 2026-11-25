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
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

import { OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR } from './disposableOpsPilotDbHarness.js';

export const LIVE_OWNER_CAPABILITY_REPLAY_DOMAIN = 'LIVE_OWNER_CAPABILITY_JTI_V1';
export const LIVE_OWNER_JTI_LEDGER_DIRNAME = 'live-owner-jti-ledger-v1';
export const LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS =
  'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_ROOT_V1';
export const LIVE_OWNER_JTI_LEDGER_TEST_ONLY_CLEANUP_PROOF_CLASS =
  'TEST_ONLY_LIVE_OWNER_JTI_REPLAY_LEDGER_CLEANUP_V1';
export const LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER =
  '.tecp-test-only-live-owner-ledger-workspace-v1';
export const LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX = 'tecp-owned-lol-';

export const LIVE_OWNER_JTI_CLAIM_OUTCOMES = Object.freeze({
  CLAIM_CONSUMED_SUCCESSFULLY: 'CLAIM_CONSUMED_SUCCESSFULLY',
  CLAIM_ALREADY_CONSUMED: 'CLAIM_ALREADY_CONSUMED',
  CLAIM_STORAGE_UNAVAILABLE_OR_INVALID: 'CLAIM_STORAGE_UNAVAILABLE_OR_INVALID',
});

const testOnlyLedgerRootLatch = new WeakSet();
const testOnlyCleanupLatch = new WeakSet();
/** Maps access brands created by prepare() to cleanup authority (not transferable by path branding). */
const testOnlyCleanupByAccessBrand = new WeakMap();
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

export function resolveTrustedOwnerOsHome() {
  // Use OS identity (getpwuid), not process.env.HOME / os.homedir().
  let info;
  try {
    info = userInfo();
  } catch (err) {
    return Object.freeze({
      ok: false,
      reasons: Object.freeze(['USERINFO_UNAVAILABLE', String(err.message || err)]),
    });
  }
  if (!info || typeof info.homedir !== 'string' || info.homedir.length === 0) {
    return Object.freeze({
      ok: false,
      reasons: Object.freeze(['TRUSTED_HOMEDIR_UNAVAILABLE']),
    });
  }
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) {
    return Object.freeze({
      ok: false,
      reasons: Object.freeze([
        'TRUSTED_UID_MISMATCH',
        `USERINFO_UID=${info.uid}`,
        `PROCESS_UID=${process.getuid()}`,
      ]),
    });
  }
  return Object.freeze({
    ok: true,
    home: info.homedir,
    uid: info.uid,
  });
}

export function resolveCanonicalLiveOwnerCapabilityReplayLedgerPath(home = undefined) {
  // Caller-supplied home is ignored for genuine-live authority.
  void home;
  const resolved = resolveTrustedOwnerOsHome();
  if (!resolved.ok) {
    throw new Error(`TRUSTED_OWNER_HOME_UNAVAILABLE:${(resolved.reasons || []).join(',')}`);
  }
  const trustDir = join(resolved.home, OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR);
  return join(trustDir, LIVE_OWNER_JTI_LEDGER_DIRNAME);
}

function pathIsWithin(absPath, root) {
  const a = resolve(absPath);
  const r = resolve(root);
  return a === r || a.startsWith(r + sep);
}

/**
 * Protection checks that remain active even when trusted home resolution fails.
 * Missing home must fail closed for destructive cleanup and for branding of
 * potentially protected paths — it must never disable protection.
 */
function assertPathOutsideProtectedOwnerStorage(absPath, { forCleanup = false } = {}) {
  const target = resolve(absPath);
  const reasons = [];
  // Always-on string defenses (do not require home resolution).
  if (target.includes(`${sep}.tecp-ops-pilot${sep}`) || target.endsWith(`${sep}.tecp-ops-pilot`)) {
    reasons.push('PROTECTED_TECP_OPS_PILOT_PATH');
  }
  if (target.includes(`${sep}s2-simin-owner-trust${sep}`) || target.endsWith(`${sep}s2-simin-owner-trust`)) {
    reasons.push('PROTECTED_OWNER_TRUST_PATH');
  }
  if (target.includes(`${sep}${LIVE_OWNER_JTI_LEDGER_DIRNAME}${sep}`)
    || target.endsWith(`${sep}${LIVE_OWNER_JTI_LEDGER_DIRNAME}`)) {
    reasons.push('PROTECTED_LIVE_OWNER_LEDGER_PATH_SEGMENT');
  }

  const home = resolveTrustedOwnerOsHome();
  if (!home.ok) {
    if (forCleanup || reasons.length > 0) {
      return {
        ok: false,
        reasons: Object.freeze([
          'TRUSTED_HOME_UNAVAILABLE_PROTECTION_FAIL_CLOSED',
          ...(home.reasons || []),
          ...reasons,
        ]),
      };
    }
    // Access branding of clearly non-protected owned test workspaces may proceed
    // only when no protected-path markers were observed.
    return { ok: true, homeUnavailable: true };
  }

  const trustDir = resolve(join(home.home, OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR));
  const ledgerDir = resolve(join(trustDir, LIVE_OWNER_JTI_LEDGER_DIRNAME));
  const ownerHome = resolve(home.home);
  const protectedRoots = [trustDir, ledgerDir, ownerHome, resolve(join(ownerHome, '.tecp-ops-pilot'))];
  for (const pro of protectedRoots) {
    if (pathIsWithin(target, pro) || pathIsWithin(pro, target)) {
      // Cleanup of an ancestor of trust/ledger would destroy protected storage.
      reasons.push('PROTECTED_OWNER_STORAGE_OR_ANCESTOR', `AT=${pro}`);
    }
  }
  if (reasons.length > 0) {
    return { ok: false, reasons: Object.freeze(reasons) };
  }
  return { ok: true, homeUnavailable: false, trustDir, ledgerDir, ownerHome };
}

function readOwnedWorkspaceProvenance(ledgerRootAbs) {
  const abs = resolve(ledgerRootAbs);
  const symlinkCheck = assertNoSymlinkPathComponents(abs);
  if (!symlinkCheck.ok) {
    return { ok: false, reasons: symlinkCheck.reasons };
  }
  // Provenance marker lives in the workspace parent of the ledger directory.
  const workspacePath = dirname(abs);
  const markerPath = join(workspacePath, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
  if (!existsSync(markerPath)) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_MISSING'] };
  }
  let markerStat;
  try {
    markerStat = lstatSync(markerPath);
  } catch (err) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_LSTAT_FAILED', String(err.message || err)] };
  }
  if (markerStat.isSymbolicLink() || !markerStat.isFile()) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_UNSAFE'] };
  }
  if (typeof process.getuid === 'function' && markerStat.uid !== process.getuid()) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_UNEXPECTED_OWNERSHIP'] };
  }
  let raw;
  try {
    const fd = openSync(markerPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      const st = fstatSync(fd);
      if (!st.isFile() || st.dev !== markerStat.dev || st.ino !== markerStat.ino) {
        return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_FD_MISMATCH'] };
      }
      const buf = Buffer.alloc(4096);
      const n = readSync(fd, buf, 0, buf.length, 0);
      raw = buf.slice(0, n).toString('utf8');
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_READ_FAILED', String(err.message || err)] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_MALFORMED'] };
  }
  if (!isPlainObject(parsed)
    || parsed.version !== 1
    || parsed.kind !== 'TEST_ONLY_LIVE_OWNER_LEDGER_WORKSPACE_V1'
    || !isNonEmptyString(parsed.workspaceId)
    || parsed.ledgerDirName !== 'ledger') {
    return { ok: false, reasons: ['TEST_WORKSPACE_PROVENANCE_INVALID'] };
  }
  const expectedLedger = resolve(join(workspacePath, 'ledger'));
  if (expectedLedger !== abs) {
    return { ok: false, reasons: ['TEST_WORKSPACE_LEDGER_PATH_MISMATCH'] };
  }
  if (!workspacePath.includes(`${sep}${LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX}`)
    && !workspacePath.includes(LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX)) {
    return { ok: false, reasons: ['TEST_WORKSPACE_PREFIX_MISMATCH'] };
  }
  return {
    ok: true,
    workspacePath,
    workspaceId: parsed.workspaceId,
    ledgerRoot: abs,
    markerPath,
  };
}

/**
 * Access branding for an already-created owned TEST_ONLY ledger root.
 * Does NOT grant cleanup authority. Child processes may use this for claim access.
 */
export function brandTestOnlyLiveOwnerCapabilityReplayLedgerRoot(rootPath) {
  if (!isNonEmptyString(rootPath)) {
    throw new TypeError('TEST_ONLY_LEDGER_ROOT_REQUIRED');
  }
  const abs = resolve(rootPath);
  const protectedCheck = assertPathOutsideProtectedOwnerStorage(abs, { forCleanup: false });
  if (!protectedCheck.ok) {
    throw new Error(`TEST_ONLY_PROTECTED_PATH_DENIED:${(protectedCheck.reasons || []).join(',')}`);
  }
  const provenance = readOwnedWorkspaceProvenance(abs);
  if (!provenance.ok) {
    throw new Error(`TEST_ONLY_WORKSPACE_PROVENANCE_REQUIRED:${(provenance.reasons || []).join(',')}`);
  }
  const branded = {
    proofClass: LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS,
    __testOnlyLiveOwnerLedgerRoot: true,
    rootPath: abs,
    workspacePath: provenance.workspacePath,
    workspaceId: provenance.workspaceId,
    accessOnly: true,
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

export function isTestOnlyLiveOwnerCapabilityReplayLedgerCleanupAuth(value) {
  return isPlainObject(value)
    && value.__testOnlyLiveOwnerLedgerCleanup === true
    && value.proofClass === LIVE_OWNER_JTI_LEDGER_TEST_ONLY_CLEANUP_PROOF_CLASS
    && testOnlyCleanupLatch.has(value)
    && isNonEmptyString(value.rootPath)
    && isNonEmptyString(value.workspacePath);
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
  const body = Buffer.from(`${JSON.stringify(payloadObject)}\n`, 'utf8');
  let offset = 0;
  while (offset < body.length) {
    const written = writeSync(fd, body, offset, body.length - offset);
    if (!Number.isInteger(written) || written <= 0) {
      throw new Error(`SHORT_OR_FAILED_WRITE offset=${offset} written=${written} total=${body.length}`);
    }
    offset += written;
  }
  if (offset !== body.length) {
    throw new Error(`INCOMPLETE_WRITE expected=${body.length} got=${offset}`);
  }
}

function fsyncFd(fd) {
  fsyncSync(fd);
}

function requireDirectoryNofollowFlags() {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW) || fsConstants.O_NOFOLLOW === 0
    || !Number.isInteger(fsConstants.O_DIRECTORY) || fsConstants.O_DIRECTORY === 0) {
    throw new Error('O_DIRECTORY_O_NOFOLLOW_REQUIRED_BUT_UNAVAILABLE');
  }
  return fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW;
}

function assertFdMatchesPathStat(fd, pathStat, label) {
  const st = fstatSync(fd);
  if (st.dev !== pathStat.dev || st.ino !== pathStat.ino) {
    throw new Error(`${label}_PATH_DESCRIPTOR_IDENTITY_MISMATCH`);
  }
  return st;
}

function assertClaimFdSafe(fd) {
  const st = fstatSync(fd);
  if (typeof st.isFile === 'function' ? !st.isFile() : (st.mode & 0o170000) !== 0o100000) {
    throw new Error('CLAIM_FD_NOT_REGULAR_FILE');
  }
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`CLAIM_FD_UNEXPECTED_OWNERSHIP UID=${st.uid}`);
  }
  if (modeOf(st) !== EXPECTED_FILE_MODE) {
    throw new Error(`CLAIM_FD_UNSAFE_PERMISSIONS MODE=${modeOf(st).toString(8)}`);
  }
  return st;
}

/**
 * Open a directory with O_DIRECTORY|O_NOFOLLOW and validate the descriptor via fstat.
 * Residual assumption: between lstat and open, an unrestricted same-UID process could
 * still race the path; we detect path/descriptor identity mismatch (dev+ino) and fail closed.
 */
function openValidatedDirectoryFd(dirPath) {
  let lst;
  try {
    lst = lstatSync(dirPath);
  } catch (err) {
    throw new Error(`DIR_LSTAT_FAILED:${err.message || err}`);
  }
  if (lst.isSymbolicLink()) throw new Error('DIR_SYMLINK_FORBIDDEN');
  if (!lst.isDirectory()) throw new Error('DIR_NOT_DIRECTORY');
  if (typeof process.getuid === 'function' && lst.uid !== process.getuid()) {
    throw new Error(`DIR_UNEXPECTED_OWNERSHIP UID=${lst.uid}`);
  }
  if (modeOf(lst) !== EXPECTED_DIR_MODE) {
    throw new Error(`DIR_UNSAFE_PERMISSIONS MODE=${modeOf(lst).toString(8)}`);
  }
  const fd = openSync(dirPath, requireDirectoryNofollowFlags());
  try {
    const st = assertFdMatchesPathStat(fd, lst, 'DIR');
    if (typeof st.isDirectory === 'function' ? !st.isDirectory() : (st.mode & 0o170000) !== 0o040000) {
      throw new Error('DIR_FD_NOT_DIRECTORY');
    }
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
      throw new Error(`DIR_FD_UNEXPECTED_OWNERSHIP UID=${st.uid}`);
    }
    if (modeOf(st) !== EXPECTED_DIR_MODE) {
      throw new Error(`DIR_FD_UNSAFE_PERMISSIONS MODE=${modeOf(st).toString(8)}`);
    }
    return fd;
  } catch (err) {
    try { closeSync(fd); } catch { /* ignore */ }
    throw err;
  }
}

function fsyncPathDirectory(dirPath) {
  const fd = openValidatedDirectoryFd(dirPath);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Validate trusted/private ancestors.
 * Residual trusted-directory assumptions (supported lab):
 * - System ancestors (e.g. /, /home, /tmp) may be root-owned.
 * - From Owner home (or owned TEST workspace root) downward, directories must be
 *   owned by the process UID and not group/world-writable.
 * Fully race-free TOCTOU-free ancestor resolution is not available through Node.js
 * path APIs alone; we combine no-follow opens + fstat identity checks on the
 * storage objects we mutate.
 */
function assertTrustedAncestorChain(ledgerRoot, { testOnly = false, workspacePath = null } = {}) {
  const abs = resolve(ledgerRoot);
  const stopAt = testOnly && isNonEmptyString(workspacePath)
    ? resolve(workspacePath)
    : null;
  let homeResolved = resolveTrustedOwnerOsHome();
  if (!testOnly && !homeResolved.ok) {
    return {
      ok: false,
      reasons: ['TRUSTED_HOME_UNAVAILABLE_PROTECTION_FAIL_CLOSED', ...(homeResolved.reasons || [])],
    };
  }
  const ownerHome = homeResolved.ok ? resolve(homeResolved.home) : null;
  const parts = abs.split(sep).filter(Boolean);
  let cur = abs.startsWith(sep) ? sep : '';
  for (const part of parts) {
    cur = cur === sep ? `${sep}${part}` : (cur ? join(cur, part) : part);
    let lst;
    try {
      lst = lstatSync(cur);
    } catch (err) {
      return { ok: false, reasons: ['ANCESTOR_LSTAT_FAILED', String(err.message || err), `AT=${cur}`] };
    }
    if (lst.isSymbolicLink()) {
      return { ok: false, reasons: ['ANCESTOR_SYMLINK_FORBIDDEN', `AT=${cur}`] };
    }
    if (!lst.isDirectory()) {
      return { ok: false, reasons: ['ANCESTOR_NOT_DIRECTORY', `AT=${cur}`] };
    }
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    const isSystemAncestor = cur === '/' || cur === '/home' || cur === '/tmp' || cur === '/var' || cur === '/var/tmp';
    const withinPrivate = (stopAt && pathIsWithin(cur, stopAt))
      || (ownerHome && pathIsWithin(cur, ownerHome));
    if (withinPrivate) {
      if (uid != null && lst.uid !== uid) {
        return { ok: false, reasons: ['PRIVATE_ANCESTOR_UNEXPECTED_OWNERSHIP', `AT=${cur}`, `UID=${lst.uid}`] };
      }
      const mode = modeOf(lst);
      // Reject group/world writable private ancestors (substitution risk).
      if ((mode & 0o022) !== 0) {
        return { ok: false, reasons: ['PRIVATE_ANCESTOR_WRITABLE_BY_OTHERS', `AT=${cur}`, `MODE=${mode.toString(8)}`] };
      }
    } else if (!isSystemAncestor && uid != null && lst.uid !== uid && lst.uid !== 0) {
      // Unexpected non-root foreign ownership on intermediate paths.
      return { ok: false, reasons: ['ANCESTOR_UNEXPECTED_FOREIGN_OWNERSHIP', `AT=${cur}`, `UID=${lst.uid}`] };
    }
  }
  return { ok: true };
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

  if (options.writeHook != null || options.syncHook != null || options.directorySyncHook != null) {
    // Genuine-live path must never accept injected fault hooks.
    // TEST_ONLY may inject only when a branded test ledger root is present.
    if (options.testOnlyLedgerRoot == null) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'GENUINE_LIVE_TEST_HOOK_INJECTION_DENIED',
      ]);
    }
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
    try {
      ledgerRoot = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
    } catch (err) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'TRUSTED_OWNER_HOME_UNAVAILABLE',
        String(err.message || err),
      ]);
    }
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

  const workspacePath = testOnly && isNonEmptyString(options.testOnlyLedgerRoot?.workspacePath)
    ? options.testOnlyLedgerRoot.workspacePath
    : (testOnly ? dirname(ledgerRoot) : null);
  const ancestorChain = assertTrustedAncestorChain(ledgerRoot, { testOnly, workspacePath });
  if (!ancestorChain.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      [...ancestorChain.reasons, 'TRUSTED_ANCESTOR_VALIDATION_FAILED'],
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
  if (!Number.isInteger(fsConstants.O_NOFOLLOW) || fsConstants.O_NOFOLLOW === 0) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'O_NOFOLLOW_REQUIRED_BUT_UNAVAILABLE',
    ], { identity });
  }
  try {
    fd = openSync(
      claimPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
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
  try {
    assertClaimFdSafe(fd);
  } catch (err) {
    try { closeSync(fd); } catch { /* ignore */ }
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_FD_VALIDATION_FAILED',
      String(err.message || err),
      'PARTIAL_CLAIM_RETAINS_CONSUMPTION',
    ], { identity, partial: true });
  }
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
    if (typeof options.directorySyncHook === 'function') {
      options.directorySyncHook({ phase: 'before_directory_fsync', dirPath: shardDir, ledgerRoot });
    }
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
    try {
      ledgerRoot = resolveCanonicalLiveOwnerCapabilityReplayLedgerPath();
    } catch (err) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'TRUSTED_OWNER_HOME_UNAVAILABLE',
        String(err.message || err),
      ]);
    }
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
  if (!safe.ok) {
    return outcome(
      LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID,
      [...safe.reasons, 'UNSAFE_INSPECTION_DENIED_BEFORE_READ'],
      { present: true, identity, safeFile: false },
    );
  }
  let raw = null;
  try {
    if (!Number.isInteger(fsConstants.O_NOFOLLOW) || fsConstants.O_NOFOLLOW === 0) {
      return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
        'O_NOFOLLOW_REQUIRED_BUT_UNAVAILABLE',
        'UNSAFE_INSPECTION_DENIED_BEFORE_READ',
      ], { present: true, identity, safeFile: false });
    }
    const pathStat = lstatSync(claimPath);
    const ifd = openSync(claimPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      const st = assertFdMatchesPathStat(ifd, pathStat, 'INSPECT');
      assertClaimFdSafe(ifd);
      const size = Number(st.size);
      const buf = Buffer.alloc(size > 0 && size < 1024 * 1024 ? size : 65536);
      const n = readSync(ifd, buf, 0, buf.length, 0);
      raw = buf.slice(0, n).toString('utf8');
    } finally {
      closeSync(ifd);
    }
  } catch (err) {
    return outcome(LIVE_OWNER_JTI_CLAIM_OUTCOMES.CLAIM_STORAGE_UNAVAILABLE_OR_INVALID, [
      'CLAIM_DESCRIPTOR_READ_FAILED',
      String(err.message || err),
    ], { present: true, identity, safeFile: false });
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  return Object.freeze({
    ok: true,
    present: true,
    identity,
    safeFile: true,
    reasons: Object.freeze([]),
    parsed,
    malformed: parsed == null,
    claimPath: testOnly ? claimPath : undefined,
  });
}

/**
 * TEST_ONLY helper: create an owned isolated workspace with durable provenance.
 * Caller-selected base paths are ignored for creation authority — storage is always
 * allocated under a dedicated owned prefix in the process temp directory.
 */
export function __testOnlyPrepareIsolatedLiveOwnerLedgerRoot(baseTempDir = undefined) {
  void baseTempDir; // intentionally ignored — prevents acquiring cleanup via caller paths
  const workspacePath = mkdtempSync(join(tmpdir(), LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_PREFIX));
  chmodSync(workspacePath, EXPECTED_DIR_MODE);
  const workspaceId = randomBytes(16).toString('hex');
  const markerPath = join(workspacePath, LIVE_OWNER_JTI_LEDGER_TEST_WORKSPACE_MARKER);
  const markerBody = `${JSON.stringify({
    version: 1,
    kind: 'TEST_ONLY_LIVE_OWNER_LEDGER_WORKSPACE_V1',
    workspaceId,
    ledgerDirName: 'ledger',
    createdAt: new Date().toISOString(),
    createdByPid: process.pid,
  })}\n`;
  const mfd = openSync(markerPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW, 0o600);
  try {
    writeSync(mfd, markerBody);
    fsyncSync(mfd);
  } finally {
    closeSync(mfd);
  }
  const ledgerRoot = join(workspacePath, 'ledger');
  mkdirSync(ledgerRoot, { recursive: false, mode: EXPECTED_DIR_MODE });
  chmodSync(ledgerRoot, EXPECTED_DIR_MODE);
  fsyncPathDirectory(workspacePath);

  const accessBrand = {
    proofClass: LIVE_OWNER_JTI_LEDGER_TEST_ONLY_PROOF_CLASS,
    __testOnlyLiveOwnerLedgerRoot: true,
    rootPath: resolve(ledgerRoot),
    workspacePath: resolve(workspacePath),
    workspaceId,
    accessOnly: false,
  };
  testOnlyLedgerRootLatch.add(accessBrand);
  const cleanupAuth = Object.freeze({
    proofClass: LIVE_OWNER_JTI_LEDGER_TEST_ONLY_CLEANUP_PROOF_CLASS,
    __testOnlyLiveOwnerLedgerCleanup: true,
    rootPath: resolve(ledgerRoot),
    workspacePath: resolve(workspacePath),
    workspaceId,
  });
  testOnlyCleanupLatch.add(cleanupAuth);
  const frozenAccess = Object.freeze(accessBrand);
  testOnlyCleanupByAccessBrand.set(frozenAccess, cleanupAuth);
  return frozenAccess;
}

/**
 * Destructive cleanup requires validated creation provenance + cleanup authority.
 * Ordinary access brands (including child-process re-brands) do not suffice.
 * Broad /tmp membership or pathname substrings are not deletion authority.
 */
export function __testOnlyRemoveIsolatedLiveOwnerLedgerRoot(brandedRootOrCleanup) {
  let cleanup = null;
  if (isTestOnlyLiveOwnerCapabilityReplayLedgerCleanupAuth(brandedRootOrCleanup)) {
    cleanup = brandedRootOrCleanup;
  } else if (isTestOnlyLiveOwnerCapabilityReplayLedgerRoot(brandedRootOrCleanup)) {
    cleanup = testOnlyCleanupByAccessBrand.get(brandedRootOrCleanup) || null;
  }
  if (!cleanup || !isTestOnlyLiveOwnerCapabilityReplayLedgerCleanupAuth(cleanup)) {
    throw new Error('TEST_ONLY_CLEANUP_AUTHORITY_REQUIRED');
  }
  const ledgerTarget = resolve(cleanup.rootPath);
  const workspaceTarget = resolve(cleanup.workspacePath);
  const protectedCheck = assertPathOutsideProtectedOwnerStorage(workspaceTarget, { forCleanup: true });
  if (!protectedCheck.ok) {
    throw new Error(`TEST_ONLY_CLEANUP_PROTECTED:${(protectedCheck.reasons || []).join(',')}`);
  }
  const provenance = readOwnedWorkspaceProvenance(ledgerTarget);
  if (!provenance.ok) {
    throw new Error(`TEST_ONLY_CLEANUP_PROVENANCE_INVALID:${(provenance.reasons || []).join(',')}`);
  }
  if (provenance.workspaceId !== cleanup.workspaceId
    || resolve(provenance.workspacePath) !== workspaceTarget) {
    throw new Error('TEST_ONLY_CLEANUP_PROVENANCE_MISMATCH');
  }
  const symlinkCheck = assertNoSymlinkPathComponents(workspaceTarget);
  if (!symlinkCheck.ok) {
    throw new Error(`TEST_ONLY_CLEANUP_SYMLINK_DENIED:${symlinkCheck.reasons.join(',')}`);
  }
  // Validate workspace directory descriptor before recursive delete.
  const wsFd = openValidatedDirectoryFd(workspaceTarget);
  closeSync(wsFd);
  rmSync(workspaceTarget, { recursive: true, force: false });
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
    directorySyncHook: options.directorySyncHook,
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
