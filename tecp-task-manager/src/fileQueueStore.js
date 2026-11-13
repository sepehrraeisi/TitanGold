/**
 * Local durable file store for Task Manager V1.
 *
 * - Node.js builtins only
 * - Atomic write via temp + fsync + rename + directory fsync
 * - Exclusive single-manager lock (one active process)
 * - Corruption / orphan DENY when correctness is not provable
 * - On restart: reconcile orphan task files into the index only when the
 *   on-disk JSON is valid and taskId matches the filename (provable recovery
 *   of "task written, index not yet updated"). Never silently overwrite orphans.
 *
 * Honest durability limits:
 * - fsync reduces loss windows but does not guarantee power-loss safety on
 *   every filesystem, mount option, or virtual disk.
 * - events.jsonl is supplemental; task.auditTrail inside each task file is
 *   the authoritative audit record after a successful writeTask.
 * - NOT a multi-process correctness proof. Concurrent writers fail closed.
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

/** Test hooks: throw after named durability step. */
const faultHooks = {
  afterTaskFileWrite: null,
  afterIndexWrite: null,
  afterMetaWrite: null,
  afterEventAppend: null,
  beforeRename: null,
};

export function __setFaultHook(name, fn) {
  if (!(name in faultHooks)) {
    throw new Error(`unknown fault hook: ${name}`);
  }
  faultHooks[name] = typeof fn === 'function' ? fn : null;
}

export function __clearFaultHooks() {
  for (const key of Object.keys(faultHooks)) faultHooks[key] = null;
}

function fail(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

async function realpathOrNull(p) {
  try {
    return await fsp.realpath(p);
  } catch {
    return null;
  }
}

async function fsyncPath(targetPath) {
  const fh = await fsp.open(targetPath, 'r');
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

async function fsyncDir(dirPath) {
  // O_RDONLY directory fsync — best effort; may be unsupported on some FS.
  try {
    const fh = await fsp.open(dirPath, 'r');
    try {
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (err) {
    if (err && (err.code === 'EINVAL' || err.code === 'EISDIR')) {
      // Some platforms reject directory fsync; durability note remains in README.
      return;
    }
    throw err;
  }
}

async function ensureSafeDir(dataDir) {
  if (typeof dataDir !== 'string' || dataDir.trim().length === 0) {
    throw fail('INVALID_DATA_DIR', 'dataDir must be a non-empty string');
  }
  const resolved = path.resolve(dataDir);
  if (resolved.includes('\0')) {
    throw fail('INVALID_DATA_DIR', 'dataDir contains NUL');
  }
  await fsp.mkdir(resolved, { recursive: true, mode: 0o700 });
  const real = await fsp.realpath(resolved);
  try {
    await fsp.chmod(real, 0o700);
  } catch {
    // best-effort
  }
  return real;
}

async function assertPathInsideRoot(rootReal, candidate) {
  const resolved = path.resolve(rootReal, candidate);
  const parent = path.dirname(resolved);
  await fsp.mkdir(parent, { recursive: true, mode: 0o700 });
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

/**
 * Atomic replace with file + directory fsync.
 * Capsule: write tmp → fsync tmp → rename → fsync dir.
 */
export async function atomicWriteFile(filePath, contents, mode = 0o600) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  const fh = await fsp.open(tmp, 'w', mode);
  try {
    await fh.writeFile(contents, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  if (faultHooks.beforeRename) await faultHooks.beforeRename({ filePath, tmp });
  await fsp.rename(tmp, filePath);
  try {
    await fsp.chmod(filePath, mode);
  } catch {
    // ignore
  }
  await fsyncDir(dir);
}

async function appendFileDurable(filePath, contents, mode = 0o600) {
  const dir = path.dirname(filePath);
  const fh = await fsp.open(filePath, 'a', mode);
  try {
    await fh.writeFile(contents, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fsyncDir(dir);
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

function isValidTaskId(taskId) {
  return typeof taskId === 'string' && /^[A-Za-z0-9._:-]+$/.test(taskId);
}

async function listTaskFilesOnDisk(tasksDir) {
  let entries;
  try {
    entries = await fsp.readdir(tasksDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const ids = [];
  for (const ent of entries) {
    if (!ent.isFile()) {
      if (ent.isSymbolicLink && ent.isSymbolicLink()) {
        throw fail('SYMLINK_FORBIDDEN', 'symlink in tasks directory');
      }
      // skip non-files except reject symlinks via lstat below
      continue;
    }
    if (ent.name.startsWith('.')) continue; // temp files
    if (!ent.name.endsWith('.json')) {
      throw fail('CORRUPT_STORE', `unexpected file in tasks/: ${ent.name}`);
    }
    const id = ent.name.slice(0, -'.json'.length);
    if (!isValidTaskId(id)) {
      throw fail('CORRUPT_STORE', `invalid task filename: ${ent.name}`);
    }
    const full = path.join(tasksDir, ent.name);
    const st = await fsp.lstat(full);
    if (st.isSymbolicLink()) {
      throw fail('SYMLINK_FORBIDDEN', 'symlink task file');
    }
    ids.push(id);
  }
  return ids.sort();
}

/**
 * Reconcile index ↔ on-disk task files.
 * - Orphan file (disk, not index): recover into index only if JSON valid and
 *   task.taskId === filename stem. Never overwrite the orphan file.
 * - Missing file for index id: fail closed.
 * - Mismatched taskId inside file: fail closed.
 */
async function reconcileIndexAndTasks({ root, tasksDir, indexPath, metaPath }) {
  const indexRead = await readJsonFile(indexPath);
  if (!indexRead.ok || !indexRead.value || !Array.isArray(indexRead.value.taskIds)) {
    throw fail('CORRUPT_STORE', 'index.json is corrupt');
  }
  const indexed = [...new Set(indexRead.value.taskIds)].sort();
  for (const id of indexed) {
    if (!isValidTaskId(id)) {
      throw fail('CORRUPT_STORE', `invalid taskId in index: ${id}`);
    }
  }

  const onDisk = await listTaskFilesOnDisk(tasksDir);
  const indexedSet = new Set(indexed);
  const diskSet = new Set(onDisk);

  const missingFiles = indexed.filter((id) => !diskSet.has(id));
  if (missingFiles.length > 0) {
    throw fail(
      'CORRUPT_STORE',
      'index references tasks with missing files; refusing silent repair',
      { missingFiles },
    );
  }

  const orphans = onDisk.filter((id) => !indexedSet.has(id));
  const recovered = [];
  for (const id of orphans) {
    const filePath = path.join(tasksDir, `${id}.json`);
    const parsed = await readJsonFile(filePath);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
      throw fail('ORPHAN_TASK_UNPROVABLE', `orphan task file unreadable: ${id}`);
    }
    if (parsed.value.taskId !== id) {
      throw fail(
        'ORPHAN_TASK_UNPROVABLE',
        'orphan filename does not match embedded taskId; refusing overwrite/repair',
        { fileId: id, embeddedTaskId: parsed.value.taskId },
      );
    }
    // Provable: durable task file survived; index update was interrupted.
    recovered.push(id);
  }

  if (recovered.length > 0) {
    const nextIds = [...indexed, ...recovered].sort();
    await atomicWriteFile(indexPath, `${JSON.stringify({ taskIds: nextIds }, null, 2)}\n`);
    const metaRead = await readJsonFile(metaPath);
    if (metaRead.ok && metaRead.value) {
      const meta = metaRead.value;
      meta.updatedAtMs = Date.now();
      meta.taskCount = nextIds.length;
      meta.lastReconcile = {
        recoveredOrphans: recovered,
        atMs: meta.updatedAtMs,
      };
      await atomicWriteFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    }
    return { taskIds: nextIds, recoveredOrphans: recovered };
  }

  return { taskIds: indexed, recoveredOrphans: [] };
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
  const eventsExist = fs.existsSync(eventsPath);

  // Partial initialization: any subset without full trio → fail closed (no silent empty init)
  const any = metaExists || indexExists || tasksExist || eventsExist;
  const allCore = metaExists && indexExists && tasksExist;

  if (!any) {
    if (!allowCreate) {
      throw fail('STORE_NOT_FOUND', 'store does not exist');
    }
    await fsp.mkdir(tasksDir, { recursive: true, mode: 0o700 });
    await fsyncDir(root);
    const meta = defaultMeta(nowMs);
    await atomicWriteFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    await atomicWriteFile(indexPath, `${JSON.stringify({ taskIds: [] }, null, 2)}\n`);
    await atomicWriteFile(eventsPath, '', 0o600);
  } else if (!allCore) {
    throw fail(
      'CORRUPT_STORE',
      'existing store is incompletely initialized; refusing silent re-init',
      { metaExists, indexExists, tasksExist, eventsExist },
    );
  } else {
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
    if (!eventsExist) {
      // events missing but core present: create empty events only if no tasks claim audits
      // Fail closed if indexed tasks have audit trails (would contradict empty events)
      const indexRead = await readJsonFile(indexPath);
      if (!indexRead.ok) throw fail('CORRUPT_STORE', 'index corrupt while events missing');
      for (const id of indexRead.value.taskIds || []) {
        const tp = path.join(tasksDir, `${id}.json`);
        const tr = await readJsonFile(tp);
        if (tr.ok && tr.value && Array.isArray(tr.value.auditTrail) && tr.value.auditTrail.length > 0) {
          throw fail(
            'CORRUPT_STORE',
            'events.jsonl missing but task auditTrail present; refusing silent contradiction',
          );
        }
      }
      await atomicWriteFile(eventsPath, '', 0o600);
    }
  }

  // Acquire exclusive manager lock before reconcile
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
  await lockFd.sync();

  // Reconcile orphans under lock
  let reconcileInfo = { recoveredOrphans: [] };
  try {
    reconcileInfo = await reconcileIndexAndTasks({ root, tasksDir, indexPath, metaPath });
  } catch (err) {
    try {
      await lockFd.close();
    } catch {
      // ignore
    }
    try {
      await fsp.unlink(lockPath);
    } catch {
      // ignore
    }
    throw err;
  }

  const store = {
    root,
    metaPath,
    lockPath,
    tasksDir,
    eventsPath,
    indexPath,
    lockFd,
    closed: false,
    lastReconcile: reconcileInfo,
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
    if (faultHooks.afterIndexWrite) await faultHooks.afterIndexWrite({ taskIds });
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
    if (!isValidTaskId(taskId)) {
      throw fail('INVALID_TASK_ID', 'taskId has forbidden characters');
    }
    return assertPathInsideRoot(store.root, path.join(TASKS_DIR, `${taskId}.json`));
  }

  return {
    root: store.root,
    lastReconcile: store.lastReconcile,

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
        if (parsed.value.taskId !== taskId) {
          await markCorrupt(`task ${taskId} id mismatch`);
          throw fail('CORRUPT_STORE', `taskId mismatch in ${taskId}.json`);
        }
        return parsed.value;
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },

    /**
     * Persist task then index (for new ids). Crash between these steps leaves
     * a recoverable orphan that openFileQueueStore reconciles on restart.
     * Never silently overwrites an on-disk orphan for a different embedded id.
     */
    async writeTask(task) {
      await ensureOpen();
      if (!task || typeof task.taskId !== 'string') {
        throw fail('INVALID_TASK', 'task.taskId required');
      }
      const filePath = await taskPath(task.taskId);

      // Refuse to overwrite a mismatched on-disk record (orphan / corruption).
      try {
        await fsp.access(filePath, fs.constants.F_OK);
        const existing = await readJsonFile(filePath);
        if (!existing.ok) {
          throw fail('CORRUPT_STORE', `existing task file unreadable: ${task.taskId}`);
        }
        if (existing.value.taskId !== task.taskId) {
          throw fail(
            'ORPHAN_TASK_CONFLICT',
            'refusing to overwrite on-disk task with mismatched taskId',
          );
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          // new task file — ok
        } else {
          throw err;
        }
      }

      const body = `${JSON.stringify(task, null, 2)}\n`;
      await atomicWriteFile(filePath, body);
      if (faultHooks.afterTaskFileWrite) {
        await faultHooks.afterTaskFileWrite({ taskId: task.taskId, filePath });
      }

      const ids = await readIndex();
      if (!ids.includes(task.taskId)) {
        ids.push(task.taskId);
        await writeIndex(ids);
      }

      const metaRead = await readJsonFile(store.metaPath);
      if (metaRead.ok && metaRead.value) {
        const meta = metaRead.value;
        meta.updatedAtMs = Date.now();
        meta.taskCount = (await readIndex()).length;
        meta.lastTaskSha256 = hashPayload(body);
        await atomicWriteFile(store.metaPath, `${JSON.stringify(meta, null, 2)}\n`);
        if (faultHooks.afterMetaWrite) await faultHooks.afterMetaWrite({ taskId: task.taskId });
      }
      return task;
    },

    async appendEvent(event) {
      await ensureOpen();
      const line = `${JSON.stringify(event)}\n`;
      await appendFileDurable(store.eventsPath, line, 0o600);
      if (faultHooks.afterEventAppend) await faultHooks.afterEventAppend({ event });
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
