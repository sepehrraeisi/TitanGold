/**
 * TECP-DLP-001 disposable local PostgreSQL harness.
 *
 * Creates an ephemeral initdb cluster with Unix-domain sockets only.
 * No TCP listener, no DATABASE_URL, no remote/Docker/app DB fallback.
 * If isolation cannot be proven: throw BLOCKED.
 *
 * Cleanup rules:
 * - Track startup attempts before pg_ctl start.
 * - After a startup attempt, never use unconditional pre-start deletion.
 * - Delete the cluster directory only after positively verified termination.
 * - Uncertain postmaster status is BLOCKED, not proof of termination.
 * - Recursive delete is restricted to verified harness temp roots only.
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

export const PG_BIN_DIR = '/usr/lib/postgresql/14/bin';
export const EXPECTED_PG_VERSION_PREFIX = 'postgres (PostgreSQL) 14.24';
export const HARNESS_ROOT_PREFIX = 'tecp-dlp001-';
export const HARNESS_MARKER_NAME = '.tecp-dlp001-harness';
export const HARNESS_MARKER_MAGIC = 'TECP-DLP-001-DISPOSABLE-HARNESS';

export const POSTMASTER_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  UNCERTAIN: 'UNCERTAIN',
});

const HARNESS_USER = 'dlp_proof';
const HARNESS_DB = 'dlp_proof';

function chooseSocketPort() {
  return 55000 + (randomBytes(2).readUInt16BE(0) % 5000);
}

function assertNoEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    throw new Error('BLOCKED: DATABASE_URL is set; disposable harness refuses env DB URLs');
  }
  for (const key of Object.keys(process.env)) {
    if (/^(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|POSTGRES_)/i.test(key)) {
      throw new Error(`BLOCKED: refusing PostgreSQL environment variable ${key}`);
    }
  }
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `BLOCKED: ${bin} ${args.join(' ')} failed: ${result.stderr || result.stdout || result.status}`,
    );
  }
  return result;
}

function requirePgBinaries() {
  for (const name of ['initdb', 'pg_ctl', 'postgres', 'psql', 'pg_isready']) {
    const path = join(PG_BIN_DIR, name);
    if (!existsSync(path)) {
      throw new Error(`BLOCKED: missing PostgreSQL binary ${path}`);
    }
  }
  const version = run(join(PG_BIN_DIR, 'postgres'), ['--version']).stdout.trim();
  if (!version.startsWith(EXPECTED_PG_VERSION_PREFIX)) {
    throw new Error(`BLOCKED: unexpected postgres version '${version}'`);
  }
  return version;
}

function readListenAddresses(dataDir) {
  const conf = readFileSync(join(dataDir, 'postgresql.conf'), 'utf8');
  const match = conf.match(/^\s*listen_addresses\s*=\s*'([^']*)'\s*(?:#.*)?$/m);
  return match ? match[1] : null;
}

function assertUnixSocketOnly(dataDir, socketDir, socketPort) {
  const listen = readListenAddresses(dataDir);
  if (listen !== '') {
    throw new Error(`BLOCKED: listen_addresses must be empty, found '${listen}'`);
  }

  const socketPath = join(socketDir, `.s.PGSQL.${socketPort}`);
  if (!existsSync(socketPath)) {
    throw new Error(`BLOCKED: unix socket missing at ${socketPath}`);
  }

  const ss = spawnSync('ss', ['-ltn'], { encoding: 'utf8' });
  if (ss.status === 0 && ss.stdout) {
    const portToken = `:${socketPort}`;
    const tcpHit = ss.stdout
      .split('\n')
      .some((line) => line.includes(portToken) && /LISTEN/i.test(line));
    if (tcpHit) {
      throw new Error(`BLOCKED: TCP LISTEN observed on disposable port ${socketPort}`);
    }
  }
}

function schemaPath() {
  return fileURLToPath(new URL('./disposableSchema.sql', import.meta.url));
}

function readPostmasterPid(dataDir) {
  const pidFile = join(dataDir, 'postmaster.pid');
  if (!existsSync(pidFile)) {
    return { pid: null, pidFilePresent: false, parseError: null };
  }
  try {
    const firstLine = readFileSync(pidFile, 'utf8').split('\n')[0]?.trim();
    const pid = Number(firstLine);
    if (!Number.isInteger(pid) || pid <= 0) {
      return { pid: null, pidFilePresent: true, parseError: 'malformed_pid' };
    }
    return { pid, pidFilePresent: true, parseError: null };
  } catch (error) {
    return {
      pid: null,
      pidFilePresent: true,
      parseError: String(error.message || error),
    };
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'EPERM') return true;
    if (error && error.code === 'ESRCH') return false;
    // Any unexpected kill(0) failure is treated as uncertain by callers.
    return null;
  }
}

function isUnderDirectory(candidate, parent) {
  const resolvedCandidate = resolve(candidate);
  const resolvedParent = resolve(parent);
  return resolvedCandidate === resolvedParent
    || resolvedCandidate.startsWith(resolvedParent + sep);
}

function writeHarnessMarker(root, dataDir) {
  const payload = {
    magic: HARNESS_MARKER_MAGIC,
    root: resolve(root),
    dataDir: resolve(dataDir),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(root, HARNESS_MARKER_NAME), `${JSON.stringify(payload)}\n`, {
    mode: 0o600,
  });
}

/**
 * Reject arbitrary paths before any recursive deletion.
 * Only harness-created temp roots with a verification marker are eligible.
 */
export function assertVerifiedHarnessPaths(root, dataDir) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('BLOCKED: refusing deletion; harness root path missing');
  }
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new Error('BLOCKED: refusing deletion; harness dataDir path missing');
  }

  const resolvedRoot = resolve(root);
  const resolvedData = resolve(dataDir);
  const tempRoot = resolve(tmpdir());

  if (!isUnderDirectory(resolvedRoot, tempRoot)) {
    throw new Error(
      'BLOCKED: refusing arbitrary path outside process temporary directory',
    );
  }
  if (!basename(resolvedRoot).startsWith(HARNESS_ROOT_PREFIX)) {
    throw new Error(
      'BLOCKED: refusing path that is not a harness-created tecp-dlp001 temporary root',
    );
  }
  if (resolvedData !== join(resolvedRoot, 'data')) {
    throw new Error(
      'BLOCKED: dataDir must be the matching harness root/data directory',
    );
  }

  const markerPath = join(resolvedRoot, HARNESS_MARKER_NAME);
  if (!existsSync(markerPath)) {
    throw new Error(
      'BLOCKED: missing harness verification marker; refusing recursive deletion',
    );
  }

  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `BLOCKED: unreadable harness verification marker; refusing deletion (${error.message})`,
    );
  }
  if (!marker || marker.magic !== HARNESS_MARKER_MAGIC) {
    throw new Error('BLOCKED: invalid harness verification marker; refusing deletion');
  }
  if (resolve(marker.root) !== resolvedRoot || resolve(marker.dataDir) !== resolvedData) {
    throw new Error('BLOCKED: harness marker path mismatch; refusing deletion');
  }

  return { resolvedRoot, resolvedData, markerPath };
}

/**
 * Inspect postmaster liveness. UNCERTAIN must never be treated as terminated.
 */
export function inspectPostmasterStatus(dataDir, { pgCtlStatusFn } = {}) {
  if (!dataDir || typeof dataDir !== 'string') {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: 'missing_data_dir_argument',
    };
  }
  if (!existsSync(dataDir)) {
    return {
      status: POSTMASTER_STATUS.STOPPED,
      reason: 'data_dir_absent',
    };
  }

  const statusFn = pgCtlStatusFn || ((dir) => spawnSync(
    join(PG_BIN_DIR, 'pg_ctl'),
    ['-D', dir, 'status'],
    { encoding: 'utf8' },
  ));

  let statusResult;
  try {
    statusResult = statusFn(dataDir);
  } catch (error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_threw:${error.message || error}`,
    };
  }

  if (!statusResult || statusResult.error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_error:${statusResult?.error?.message || 'unknown'}`,
    };
  }

  if (statusResult.status === 0) {
    return {
      status: POSTMASTER_STATUS.RUNNING,
      reason: 'pg_ctl_status_running',
    };
  }

  const pidInfo = readPostmasterPid(dataDir);
  if (pidInfo.parseError) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pid_file_unreadable:${pidInfo.parseError}`,
    };
  }

  if (pidInfo.pidFilePresent && pidInfo.pid) {
    const alive = processExists(pidInfo.pid);
    if (alive === true) {
      return {
        status: POSTMASTER_STATUS.RUNNING,
        reason: 'postmaster_pid_alive',
        pid: pidInfo.pid,
      };
    }
    if (alive === null) {
      return {
        status: POSTMASTER_STATUS.UNCERTAIN,
        reason: 'process_existence_check_failed',
        pid: pidInfo.pid,
      };
    }
  }

  // pg_ctl uses exit status 3 for "not running".
  if (statusResult.status === 3) {
    return {
      status: POSTMASTER_STATUS.STOPPED,
      reason: 'pg_ctl_status_not_running',
    };
  }

  // Any other status (including inaccessible data dir = 4) is uncertain.
  return {
    status: POSTMASTER_STATUS.UNCERTAIN,
    reason: `pg_ctl_status_unexpected:${statusResult.status}`,
  };
}

/**
 * Boolean helper. Uncertain status throws BLOCKED instead of returning false.
 */
export function isPostmasterRunning(dataDir, options = {}) {
  const inspection = inspectPostmasterStatus(dataDir, options);
  if (inspection.status === POSTMASTER_STATUS.UNCERTAIN) {
    throw new Error(
      `BLOCKED: uncertain postmaster status (${inspection.reason}); not proof of termination`,
    );
  }
  return inspection.status === POSTMASTER_STATUS.RUNNING;
}

/**
 * Attempt stop, then require positive STOPPED evidence before any delete.
 */
export function stopClusterAndProveTerminated(dataDir, {
  stopFn,
  inspectFn,
} = {}) {
  const stopper = stopFn || ((dir) => spawnSync(
    join(PG_BIN_DIR, 'pg_ctl'),
    ['-D', dir, '-m', 'fast', '-w', 'stop'],
    { encoding: 'utf8' },
  ));
  const inspect = inspectFn || inspectPostmasterStatus;

  let stopError = null;
  try {
    const result = stopper(dataDir);
    if (result && result.error) stopError = result.error;
    else if (result && result.status !== 0) {
      stopError = new Error(result.stderr || result.stdout || `pg_ctl stop status=${result.status}`);
    }
  } catch (error) {
    stopError = error;
  }

  const after = inspect(dataDir);
  if (after.status === POSTMASTER_STATUS.RUNNING) {
    return {
      terminated: false,
      blocked: true,
      status: after.status,
      reason: after.reason,
      stopError: stopError ? String(stopError.message || stopError) : 'postmaster still running',
    };
  }
  if (after.status === POSTMASTER_STATUS.UNCERTAIN) {
    return {
      terminated: false,
      blocked: true,
      status: after.status,
      reason: after.reason,
      stopError: stopError
        ? String(stopError.message || stopError)
        : `uncertain postmaster status (${after.reason})`,
    };
  }

  return {
    terminated: true,
    blocked: false,
    status: after.status,
    reason: after.reason,
    stopError: stopError ? String(stopError.message || stopError) : null,
  };
}

/**
 * Delete harness root only when:
 * 1) paths are verified harness-managed temp roots, and
 * 2) postmaster status is positively STOPPED.
 */
export function removeHarnessRootIfSafe(root, dataDir, { inspectFn } = {}) {
  const verified = assertVerifiedHarnessPaths(root, dataDir);
  const inspect = inspectFn || inspectPostmasterStatus;
  const inspection = inspect(verified.resolvedData);

  if (inspection.status === POSTMASTER_STATUS.RUNNING) {
    throw new Error(
      'BLOCKED: refusing to delete live cluster data directory; postmaster still running',
    );
  }
  if (inspection.status === POSTMASTER_STATUS.UNCERTAIN) {
    throw new Error(
      `BLOCKED: refusing to delete cluster directory with uncertain postmaster status (${inspection.reason})`,
    );
  }

  rmSync(verified.resolvedRoot, { recursive: true, force: true });
  return {
    deleted: true,
    root: verified.resolvedRoot,
    dataDir: verified.resolvedData,
  };
}

function defaultStartCluster({ dataDir, socketDir, socketPort, logFile }) {
  return run(join(PG_BIN_DIR, 'pg_ctl'), [
    '-D', dataDir,
    '-l', logFile,
    '-o', `-c listen_addresses= -c unix_socket_directories=${socketDir} -c port=${socketPort}`,
    '-w',
    'start',
  ]);
}

/**
 * @param {object} [options]
 * @param {function} [options.startCluster] - override pg_ctl start (tests)
 * @param {function} [options.beforeStart] - throw before startupAttempted (tests)
 * @param {function} [options.stopFn] - override stop during cleanup (tests)
 * @param {function} [options.inspectFn] - override status inspection (tests)
 */
export function createDisposablePgHarness(options = {}) {
  assertNoEnvDatabaseUrl();
  const postgresVersion = requirePgBinaries();
  const socketPort = chooseSocketPort();

  let root = null;
  let dataDir = null;
  let socketDir = null;
  let logFile = null;
  let started = false;
  let startupAttempted = false;
  let cleaned = false;

  const inspectFn = options.inspectFn;
  const stopFn = options.stopFn;

  function attachCleanupDiagnostics(error, extra = {}) {
    if (!error || typeof error !== 'object') return error;
    error.dlpCleanup = {
      root,
      dataDir,
      started,
      startupAttempted,
      cleaned,
      ...extra,
    };
    return error;
  }

  function cleanupBeforeStartupAttempt() {
    if (startupAttempted || started) {
      throw new Error(
        'BLOCKED: cannot use pre-start unconditional deletion after startup was attempted',
      );
    }
    if (!root) {
      cleaned = true;
      return { deleted: false };
    }
    // Still require verified paths; marker is written immediately after mkdtemp.
    return removeHarnessRootIfSafe(root, dataDir, { inspectFn });
  }

  function cleanupAfterStartupAttempt() {
    const proof = stopClusterAndProveTerminated(dataDir, { stopFn, inspectFn });
    if (!proof.terminated) {
      throw new Error(
        `BLOCKED: PostgreSQL did not positively terminate after startup attempt; refusing unsafe data-directory deletion (${proof.stopError || proof.reason || 'not terminated'})`,
      );
    }
    started = false;
    const removed = removeHarnessRootIfSafe(root, dataDir, { inspectFn });
    cleaned = true;
    return {
      ...removed,
      terminated: true,
      status: proof.status,
    };
  }

  function stop() {
    if (cleaned) {
      return {
        cleaned: true,
        deleted: false,
        terminated: true,
        alreadyCleaned: true,
      };
    }

    if (started || startupAttempted) {
      const result = cleanupAfterStartupAttempt();
      return {
        cleaned: true,
        deleted: true,
        terminated: true,
        root: result.root,
        dataDir: result.dataDir,
      };
    }

    const removed = cleanupBeforeStartupAttempt();
    cleaned = true;
    return {
      cleaned: true,
      deleted: Boolean(removed.deleted),
      terminated: true,
      root,
      dataDir,
    };
  }

  try {
    root = mkdtempSync(join(tmpdir(), HARNESS_ROOT_PREFIX));
    dataDir = join(root, 'data');
    socketDir = join(root, 'socket');
    logFile = join(root, 'pg.log');
    mkdirSync(dataDir);
    mkdirSync(socketDir);
    writeHarnessMarker(root, dataDir);

    const pwfile = join(root, 'pwfile');
    writeFileSync(pwfile, randomBytes(16).toString('hex'), { mode: 0o600 });

    run(join(PG_BIN_DIR, 'initdb'), [
      '-D', dataDir,
      '-U', HARNESS_USER,
      '--auth-local=trust',
      '--auth-host=scram-sha-256',
      '--pwfile', pwfile,
      '--encoding=UTF8',
      '--locale=C',
    ]);

    let conf = readFileSync(join(dataDir, 'postgresql.conf'), 'utf8');
    conf = conf.replace(/#?listen_addresses\s*=\s*.*/m, "listen_addresses = ''");
    conf = conf.replace(/#?unix_socket_directories\s*=\s*.*/m, `unix_socket_directories = '${socketDir}'`);
    conf = conf.replace(/#?port\s*=\s*.*/m, `port = ${socketPort}`);
    conf += `\n# TECP-DLP-001 disposable cluster\nlisten_addresses = ''\nunix_socket_directories = '${socketDir}'\nport = ${socketPort}\n`;
    writeFileSync(join(dataDir, 'postgresql.conf'), conf);

    writeFileSync(
      join(dataDir, 'pg_hba.conf'),
      [
        '# TYPE  DATABASE  USER  ADDRESS  METHOD',
        'local   all       all            trust',
        'host    all       all   0.0.0.0/0 reject',
        'host    all       all   ::/0     reject',
        '',
      ].join('\n'),
    );

    if (typeof options.beforeStart === 'function') {
      options.beforeStart({ root, dataDir, socketDir, socketPort, logFile });
    }

    // Mark attempt BEFORE invoking start so failure cannot fall into pre-start delete.
    startupAttempted = true;
    const startCluster = typeof options.startCluster === 'function'
      ? options.startCluster
      : defaultStartCluster;
    startCluster({
      dataDir,
      socketDir,
      socketPort,
      logFile,
      pgBinDir: PG_BIN_DIR,
      run,
    });
    started = true;

    assertUnixSocketOnly(dataDir, socketDir, socketPort);

    run(join(PG_BIN_DIR, 'pg_ctl'), [
      '-D', dataDir,
      'status',
    ]);

    const connectionConfig = Object.freeze({
      host: socketDir,
      port: socketPort,
      user: HARNESS_USER,
      database: 'postgres',
    });

    async function withClient(database, fn) {
      const client = new Client({
        host: socketDir,
        port: socketPort,
        user: HARNESS_USER,
        database,
      });
      await client.connect();
      try {
        return await fn(client);
      } finally {
        try {
          await client.end();
        } catch {
          // ignore close errors during cleanup
        }
      }
    }

    async function createProofDatabase() {
      await withClient('postgres', async (client) => {
        await client.query(`CREATE DATABASE ${HARNESS_DB}`);
      });
      const sql = readFileSync(schemaPath(), 'utf8');
      await withClient(HARNESS_DB, async (client) => {
        await client.query(sql);
      });
    }

    async function createClient() {
      const client = new Client({
        host: socketDir,
        port: socketPort,
        user: HARNESS_USER,
        database: HARNESS_DB,
      });
      await client.connect();
      return client;
    }

    async function proveIsolation() {
      await withClient('postgres', async (client) => {
        const r = await client.query('SHOW listen_addresses');
        if (r.rows[0].listen_addresses !== '') {
          throw new Error(`BLOCKED: runtime listen_addresses='${r.rows[0].listen_addresses}'`);
        }
        const sock = await client.query('SHOW unix_socket_directories');
        if (!String(sock.rows[0].unix_socket_directories).includes(socketDir)) {
          throw new Error('BLOCKED: unix_socket_directories mismatch');
        }
      });

      const tcpClient = new Client({
        host: '127.0.0.1',
        port: socketPort,
        user: HARNESS_USER,
        database: 'postgres',
        connectionTimeoutMillis: 1000,
      });
      let tcpFailed = false;
      try {
        await tcpClient.connect();
      } catch {
        tcpFailed = true;
      } finally {
        try {
          await tcpClient.end();
        } catch {
          // ignore
        }
      }
      if (!tcpFailed) {
        throw new Error('BLOCKED: TCP connection unexpectedly succeeded; cannot prove unix-only isolation');
      }

      return {
        postgresVersion,
        socketDir,
        dataDir,
        socketPort,
        listenAddresses: '',
        tcpRejected: true,
        databaseUrlUsed: false,
      };
    }

    const isolationFingerprint = createHash('sha256')
      .update(root)
      .update(postgresVersion)
      .digest('hex')
      .slice(0, 16);

    return {
      root,
      dataDir,
      socketDir,
      socketPort,
      logFile,
      postgresVersion,
      isolationFingerprint,
      connectionConfig,
      createProofDatabase,
      createClient,
      proveIsolation,
      stop,
      get started() {
        return started;
      },
      get startupAttempted() {
        return startupAttempted;
      },
      get cleaned() {
        return cleaned;
      },
    };
  } catch (error) {
    let cleanupError = null;
    let cleanupBlocked = false;
    try {
      if (startupAttempted || started) {
        cleanupAfterStartupAttempt();
      } else {
        cleanupBeforeStartupAttempt();
        cleaned = true;
      }
    } catch (err) {
      cleanupError = err;
      cleanupBlocked = true;
    }

    if (cleanupError) {
      const wrapped = new Error(
        `BLOCKED: setup failed and safe cleanup could not be established: ${cleanupError.message}`,
      );
      wrapped.cause = error;
      attachCleanupDiagnostics(wrapped, {
        cleanupBlocked,
        originalMessage: String(error.message || error),
      });
      throw wrapped;
    }

    attachCleanupDiagnostics(error, {
      cleanupBlocked: false,
      cleaned: true,
    });
    throw error;
  }
}
