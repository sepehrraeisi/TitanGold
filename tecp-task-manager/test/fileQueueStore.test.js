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
