/**
 * Local durable file store for Task Manager V1.
 *
 * - Node.js builtins only
 * - Atomic write via temp + rename
 * - Exclusive single-manager lock (one active process)
 * - Corruption DENY (never silently re-init a corrupt store)
 * - Data directory must be outside tracked repository files (caller-owned)
 *
 * NOT a multi-process correctness proof. Concurrent writers fail closed.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export const STORE_SCHEMA_VERSION = 1;
export const STORE_KIND = 'TECP_TASK_MANAGER_V1_LOCAL_FILE_STORE';

const META_NAME = 'meta.json';
const LOCK_NAME = 'manager.lock';
const TASKS_DIR = 'tasks';
const EVENTS_NAME = 'events.jsonl';
const INDEX_NAME = 'index.json';

function fail(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function isAbsoluteOutsideCwd(dataDir) {
  return path.isAbsolute(dataDir);
}

async function realpathOrNull(p) {
  try {
    return await fsp.realpath(p);
  } catch {
    return null;
  }
}

async function ensureSafeDir(dataDir) {
  if (typeof dataDir !== 'string' || dataDir.trim().length === 0) {
    throw fail('INVALID_DATA_DIR', 'dataDir must be a non-empty string');
  }
  const resolved = path.resolve(dataDir);
  if (!isAbsoluteOutsideCwd(resolved) && !path.isAbsolute(dataDir)) {
    // still allow relative for tests, but resolve absolutely
  }
  // Reject null bytes and path tricks in components after resolve
  if (resolved.includes('\0')) {
    throw fail('INVALID_DATA_DIR', 'dataDir contains NUL');
  }
  await fsp.mkdir(resolved, { recursive: true, mode: 0o700 });
  const real = await fsp.realpath(resolved);
  // Restrictive permissions when possible
  try {
    await fsp.chmod(real, 0o700);
  } catch {
    // best-effort on platforms without chmod semantics
  }
  return real;
}

async function assertPathInsideRoot(rootReal, candidate) {
  const resolved = path.resolve(rootReal, candidate);
  // Disallow escape via symlink: require final realpath under root
  const parent = path.dirname(resolved);
  await fsp.mkdir(parent, { recursive: true, mode: 0o700 });
  // If file exists, realpath it; else realpath parent and join basename
  let finalPath;
  const existing = await realpathOrNull(resolved);
  if (existing) {
    finalPath = existing;
  } else {
    const parentReal = await fsp.realpath(parent);
    finalPath = path.join(parentReal, path.basename(resolved));
  }
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  if (finalPath !== rootReal && !finalPath.startsWith(prefix)) {
    throw fail('PATH_ESCAPE', 'resolved path escapes data directory', { finalPath, rootReal });
  }
  // Reject symlink escape for existing nodes
  try {
    const st = await fsp.lstat(resolved);
    if (st.isSymbolicLink()) {
      throw fail('SYMLINK_FORBIDDEN', 'symlinks are not allowed in the store');
    }
  } catch (err) {
    if (err.code === 'SYMLINK_FORBIDDEN' || err.code === 'PATH_ESCAPE') throw err;
    if (err.code !== 'ENOENT') throw err;
  }
  return resolved;
}

async function atomicWriteFile(filePath, contents, mode = 0o600) {
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  await fsp.writeFile(tmp, contents, { encoding: 'utf8', mode });
  await fsp.rename(tmp, filePath);
  try {
    await fsp.chmod(filePath, mode);
  } catch {
    // ignore
  }
}

function hashPayload(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function defaultMeta(nowMs) {
  return {
    kind: STORE_KIND,
    schemaVersion: STORE_SCHEMA_VERSION,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    taskCount: 0,
    integrity: 'OK',
  };
}

async function readJsonFile(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  try {
    return { ok: true, value: JSON.parse(raw), raw };
  } catch {
    return { ok: false, value: null, raw };
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

/**
 * Open or create a store. Corrupt existing stores DENY without wipe.
 *
 * @param {string} dataDir
 * @param {{ nowMs?: number, allowCreate?: boolean }} [options]
 */
export async function openFileQueueStore(dataDir, options = {}) {
  const allowCreate = options.allowCreate !== false;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const root = await ensureSafeDir(dataDir);
  const metaPath = await assertPathInsideRoot(root, META_NAME);
  const lockPath = await assertPathInsideRoot(root, LOCK_NAME);
  const tasksDir = await assertPathInsideRoot(root, TASKS_DIR);
  const eventsPath = await assertPathInsideRoot(root, EVENTS_NAME);
  const indexPath = await assertPathInsideRoot(root, INDEX_NAME);

  const metaExists = fs.existsSync(metaPath);
  const indexExists = fs.existsSync(indexPath);
  const tasksExist = fs.existsSync(tasksDir);

  if (!metaExists && !indexExists && !tasksExist) {
    if (!allowCreate) {
      throw fail('STORE_NOT_FOUND', 'store does not exist');
    }
    await fsp.mkdir(tasksDir, { recursive: true, mode: 0o700 });
    const meta = defaultMeta(nowMs);
    await atomicWriteFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    await atomicWriteFile(indexPath, `${JSON.stringify({ taskIds: [] }, null, 2)}\n`);
    await atomicWriteFile(eventsPath, '', 0o600);
  } else {
    // Partial / corrupt detection
    if (!metaExists || !indexExists) {
      throw fail(
        'CORRUPT_STORE',
        'existing store is incomplete or corrupt; refusing silent re-init',
        { metaExists, indexExists },
      );
    }
    const metaRead = await readJsonFile(metaPath);
    if (!metaRead.ok || !metaRead.value || metaRead.value.kind !== STORE_KIND) {
      throw fail('CORRUPT_STORE', 'meta.json is corrupt or wrong kind');
    }
    if (metaRead.value.schemaVersion !== STORE_SCHEMA_VERSION) {
      throw fail('UNSUPPORTED_SCHEMA', `unsupported schemaVersion=${metaRead.value.schemaVersion}`);
    }
    if (metaRead.value.integrity === 'CORRUPT') {
      throw fail('CORRUPT_STORE', 'store integrity marked CORRUPT');
    }
    const indexRead = await readJsonFile(indexPath);
    if (!indexRead.ok || !indexRead.value || !Array.isArray(indexRead.value.taskIds)) {
      throw fail('CORRUPT_STORE', 'index.json is corrupt');
    }
    await fsp.mkdir(tasksDir, { recursive: true, mode: 0o700 });
  }

  // Acquire exclusive manager lock
  let lockFd;
  try {
    lockFd = await fsp.open(lockPath, 'wx', 0o600);
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      const existing = await readJsonFile(lockPath).catch(() => ({ ok: false }));
      if (existing.ok && existing.value && pidAlive(existing.value.pid)) {
        throw fail('MANAGER_LOCK_HELD', 'another active manager process holds the store lock', {
          holderPid: existing.value.pid,
        });
      }
      // Stale lock: remove and retry once
      await fsp.unlink(lockPath).catch(() => {});
      try {
        lockFd = await fsp.open(lockPath, 'wx', 0o600);
      } catch (err2) {
        throw fail('MANAGER_LOCK_HELD', 'unable to acquire manager lock', {
          cause: err2 && err2.code,
        });
      }
    } else {
      throw err;
    }
  }

  const lockPayload = {
    pid: process.pid,
    hostname: os.hostname(),
    acquiredAtMs: nowMs,
    kind: STORE_KIND,
  };
  await lockFd.writeFile(`${JSON.stringify(lockPayload, null, 2)}\n`, 'utf8');

  const store = {
    root,
    metaPath,
    lockPath,
    tasksDir,
    eventsPath,
    indexPath,
    lockFd,
    closed: false,
  };

  return createStoreApi(store);
}

function createStoreApi(store) {
  async function ensureOpen() {
    if (store.closed) throw fail('STORE_CLOSED', 'store is closed');
  }

  async function readIndex() {
    await ensureOpen();
    const parsed = await readJsonFile(store.indexPath);
    if (!parsed.ok || !parsed.value || !Array.isArray(parsed.value.taskIds)) {
      await markCorrupt('index.json unreadable');
      throw fail('CORRUPT_STORE', 'index.json unreadable during operation');
    }
    return parsed.value.taskIds;
  }

  async function writeIndex(taskIds) {
    await ensureOpen();
    const payload = `${JSON.stringify({ taskIds: [...taskIds].sort() }, null, 2)}\n`;
    await atomicWriteFile(store.indexPath, payload);
  }

  async function markCorrupt(reason) {
    try {
      const metaRead = await readJsonFile(store.metaPath);
      const meta = metaRead.ok && metaRead.value ? metaRead.value : defaultMeta(Date.now());
      meta.integrity = 'CORRUPT';
      meta.corruptReason = reason;
      meta.updatedAtMs = Date.now();
      await atomicWriteFile(store.metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    } catch {
      // still fail closed to caller
    }
  }

  async function taskPath(taskId) {
    if (typeof taskId !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(taskId)) {
      throw fail('INVALID_TASK_ID', 'taskId has forbidden characters');
    }
    return assertPathInsideRoot(store.root, path.join(TASKS_DIR, `${taskId}.json`));
  }

  return {
    root: store.root,

    async listTaskIds() {
      return readIndex();
    },

    async readTask(taskId) {
      await ensureOpen();
      const filePath = await taskPath(taskId);
      try {
        const parsed = await readJsonFile(filePath);
        if (!parsed.ok) {
          await markCorrupt(`task ${taskId} corrupt`);
          throw fail('CORRUPT_STORE', `task record corrupt: ${taskId}`);
        }
        return parsed.value;
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },

    async writeTask(task) {
      await ensureOpen();
      if (!task || typeof task.taskId !== 'string') {
        throw fail('INVALID_TASK', 'task.taskId required');
      }
      const filePath = await taskPath(task.taskId);
      const body = `${JSON.stringify(task, null, 2)}\n`;
      await atomicWriteFile(filePath, body);
      const ids = await readIndex();
      if (!ids.includes(task.taskId)) {
        ids.push(task.taskId);
        await writeIndex(ids);
      }
      const metaRead = await readJsonFile(store.metaPath);
      if (metaRead.ok && metaRead.value) {
        const meta = metaRead.value;
        meta.updatedAtMs = Date.now();
        meta.taskCount = ids.length;
        meta.lastTaskSha256 = hashPayload(body);
        await atomicWriteFile(store.metaPath, `${JSON.stringify(meta, null, 2)}\n`);
      }
      return task;
    },

    async appendEvent(event) {
      await ensureOpen();
      const line = `${JSON.stringify(event)}\n`;
      await fsp.appendFile(store.eventsPath, line, { encoding: 'utf8', mode: 0o600 });
    },

    async readMeta() {
      await ensureOpen();
      const parsed = await readJsonFile(store.metaPath);
      if (!parsed.ok) throw fail('CORRUPT_STORE', 'meta unreadable');
      return parsed.value;
    },

    async close() {
      if (store.closed) return;
      store.closed = true;
      try {
        await store.lockFd.close();
      } catch {
        // ignore
      }
      try {
        await fsp.unlink(store.lockPath);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Helper for tests: create a disposable data directory under os.tmpdir().
 */
export async function createDisposableDataDir(prefix = 'tecp-tm-v1-') {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  await fsp.chmod(dir, 0o700).catch(() => {});
  return dir;
}
