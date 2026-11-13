import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  openFileQueueStore,
  createDisposableDataDir,
  STORE_KIND,
} from '../src/fileQueueStore.js';

async function withStore(fn) {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  try {
    await fn(store, dir);
  } finally {
    await store.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

test('create and persisted reload', async () => {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  await store.writeTask({ taskId: 't1', status: 'PENDING', goal: 'x' });
  await store.close();

  const store2 = await openFileQueueStore(dir);
  const task = await store2.readTask('t1');
  assert.equal(task.taskId, 't1');
  assert.equal(task.status, 'PENDING');
  const meta = await store2.readMeta();
  assert.equal(meta.kind, STORE_KIND);
  await store2.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

test('crash-safe atomic write leaves readable task', async () => {
  await withStore(async (store) => {
    await store.writeTask({ taskId: 'atomic-1', status: 'PENDING', n: 1 });
    await store.writeTask({ taskId: 'atomic-1', status: 'CLAIMED', n: 2 });
    const task = await store.readTask('atomic-1');
    assert.equal(task.status, 'CLAIMED');
    assert.equal(task.n, 2);
  });
});

test('corrupt index fail-closed without silent re-init', async () => {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  await store.writeTask({ taskId: 'c1', status: 'PENDING' });
  await store.close();

  await fsp.writeFile(path.join(dir, 'index.json'), '{not-json', 'utf8');
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'CORRUPT_STORE',
  );
  // original corrupt index still present (not wiped to empty)
  const raw = await fsp.readFile(path.join(dir, 'index.json'), 'utf8');
  assert.equal(raw, '{not-json');
  await fsp.rm(dir, { recursive: true, force: true });
});

test('incomplete existing store refuses silent empty init', async () => {
  const dir = await createDisposableDataDir();
  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify({
    kind: STORE_KIND,
    schemaVersion: 1,
    integrity: 'OK',
  }), 'utf8');
  // missing index.json
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'CORRUPT_STORE',
  );
  await fsp.rm(dir, { recursive: true, force: true });
});

test('concurrent manager writer fail-closed', async () => {
  const dir = await createDisposableDataDir();
  const store1 = await openFileQueueStore(dir);
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'MANAGER_LOCK_HELD',
  );
  await store1.close();
  const store2 = await openFileQueueStore(dir);
  await store2.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

test('path escape / invalid task id denied', async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.writeTask({ taskId: '../escape', status: 'PENDING' }),
      (err) => err.code === 'INVALID_TASK_ID',
    );
  });
});

test('symlink in data tree forbidden on write path parent file', async () => {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  const tasksDir = path.join(dir, 'tasks');
  const outside = path.join(dir, 'outside-target.json');
  await fsp.writeFile(outside, '{"taskId":"x"}\n', 'utf8');
  // Replace a future task path with symlink — open/write should refuse
  const linkPath = path.join(tasksDir, 'symlinked.json');
  fs.symlinkSync(outside, linkPath);
  await assert.rejects(
    () => store.writeTask({ taskId: 'symlinked', status: 'PENDING' }),
    (err) => err.code === 'SYMLINK_FORBIDDEN' || err.code === 'PATH_ESCAPE',
  );
  await store.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

test('orphan task file after crash is reconciled on restart (provable)', async () => {
  const {
    __setFaultHook,
    __clearFaultHooks,
  } = await import('../src/fileQueueStore.js');
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  __setFaultHook('afterTaskFileWrite', async () => {
    throw Object.assign(new Error('injected crash after task file'), { code: 'INJECTED_CRASH' });
  });
  await assert.rejects(
    () => store.writeTask({ taskId: 'orphan-1', status: 'PENDING', goal: 'x', auditTrail: [] }),
    (err) => err.code === 'INJECTED_CRASH',
  );
  __clearFaultHooks();
  // Close without completing index update (lock release)
  await store.close();

  // Index should not yet list orphan-1 (crash before index write)
  const indexRaw = JSON.parse(await fsp.readFile(path.join(dir, 'index.json'), 'utf8'));
  assert.equal(indexRaw.taskIds.includes('orphan-1'), false);
  assert.equal(fs.existsSync(path.join(dir, 'tasks', 'orphan-1.json')), true);

  const store2 = await openFileQueueStore(dir);
  assert.ok(store2.lastReconcile.recoveredOrphans.includes('orphan-1'));
  const ids = await store2.listTaskIds();
  assert.equal(ids.includes('orphan-1'), true);
  const task = await store2.readTask('orphan-1');
  assert.equal(task.taskId, 'orphan-1');
  await store2.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

test('mismatched orphan taskId fails closed and is never overwritten', async () => {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  await store.close();

  await fsp.writeFile(
    path.join(dir, 'tasks', 'file-id.json'),
    `${JSON.stringify({ taskId: 'other-id', status: 'PENDING' }, null, 2)}\n`,
    'utf8',
  );
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'ORPHAN_TASK_UNPROVABLE',
  );
  // File unchanged
  const raw = JSON.parse(await fsp.readFile(path.join(dir, 'tasks', 'file-id.json'), 'utf8'));
  assert.equal(raw.taskId, 'other-id');
  await fsp.rm(dir, { recursive: true, force: true });
});

test('index entry without task file fails closed', async () => {
  const dir = await createDisposableDataDir();
  const store = await openFileQueueStore(dir);
  await store.writeTask({ taskId: 'keep', status: 'PENDING' });
  await store.close();
  await fsp.writeFile(
    path.join(dir, 'index.json'),
    `${JSON.stringify({ taskIds: ['keep', 'ghost'] }, null, 2)}\n`,
    'utf8',
  );
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'CORRUPT_STORE' && /missing files/.test(err.message),
  );
  await fsp.rm(dir, { recursive: true, force: true });
});

test('fsync durability fault hooks around rename boundary', async () => {
  const {
    __setFaultHook,
    __clearFaultHooks,
    atomicWriteFile,
  } = await import('../src/fileQueueStore.js');
  const dir = await createDisposableDataDir();
  const target = path.join(dir, 'durability.json');
  let hit = false;
  __setFaultHook('beforeRename', async () => {
    hit = true;
    throw Object.assign(new Error('crash before rename'), { code: 'INJECTED_CRASH' });
  });
  await assert.rejects(
    () => atomicWriteFile(target, '{"ok":true}\n'),
    (err) => err.code === 'INJECTED_CRASH',
  );
  assert.equal(hit, true);
  assert.equal(fs.existsSync(target), false);
  // leftover tmp may exist; final file must not
  __clearFaultHooks();
  await atomicWriteFile(target, '{"ok":true}\n');
  assert.equal(JSON.parse(await fsp.readFile(target, 'utf8')).ok, true);
  await fsp.rm(dir, { recursive: true, force: true });
});

test('partial initialization refuses silent empty re-init', async () => {
  const dir = await createDisposableDataDir();
  await fsp.writeFile(path.join(dir, 'events.jsonl'), '', 'utf8');
  await assert.rejects(
    () => openFileQueueStore(dir),
    (err) => err.code === 'CORRUPT_STORE',
  );
  await fsp.rm(dir, { recursive: true, force: true });
});
