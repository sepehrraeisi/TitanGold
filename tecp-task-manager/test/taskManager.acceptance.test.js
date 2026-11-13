import assert from 'node:assert/strict';
import test from 'node:test';
import fsp from 'node:fs/promises';
import { createDisposableDataDir } from '../src/fileQueueStore.js';
import { createTaskManager, TASK_STATUSES } from '../src/taskManager.js';
import { main as cliMain } from '../src/cli.js';

const BASE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HEAD = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HEAD2 = 'cccccccccccccccccccccccccccccccccccccccc';

function fixtureReader({
  headSha = HEAD,
  baseSha = BASE,
  files = ['docs/a.md'],
  state = 'OPEN',
  failCode = null,
} = {}) {
  return {
    kind: 'INERT_FIXTURE_READER',
    async fetchPullRequest({ repository, prNumber }) {
      if (failCode) return { ok: false, code: failCode, data: null };
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          prNumber,
          state,
          baseSha,
          headSha,
          baseRefName: 'main',
          headRefName: 'feature',
          changedFiles: files,
          url: `https://example.test/${repository}/pull/${prNumber}`,
          title: `task`,
        },
      };
    },
  };
}

async function withManager(fn, readerOpts = {}) {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader(readerOpts),
    claimTtlMs: 60_000,
    runningTtlMs: 60_000,
  });
  try {
    await fn(manager, dir);
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

function createInput(overrides = {}) {
  return {
    taskId: 'task-1',
    ownerActorId: 'owner-1',
    repository: 'sepehrraeisi/TitanGold',
    baseSha: BASE,
    goal: 'Edit docs/a.md only',
    fileAllowlist: ['docs/a.md'],
    ...overrides,
  };
}

test('create persists and reloads', async () => {
  await withManager(async (manager) => {
    const created = await manager.create(createInput());
    assert.equal(created.ok, true);
    assert.equal(created.task.status, TASK_STATUSES.PENDING);
    const status = await manager.status({ taskId: 'task-1' });
    assert.equal(status.ok, true);
    assert.equal(status.task.goal, 'Edit docs/a.md only');
  });
});

test('single claim then double-claim denial', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput());
    const claim = await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    assert.equal(claim.ok, true);
    assert.equal(claim.task.status, TASK_STATUSES.CLAIMED);
    assert.equal(claim.task.attempt, 1);
    const again = await manager.claim({ taskId: 'task-1', actorId: 'cursor-2' });
    assert.equal(again.ok, false);
    assert.equal(again.code, 'INVALID_TRANSITION');
  });
});

test('resource conflict denial across tasks', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput({ taskId: 'a' }));
    await manager.create(createInput({ taskId: 'b', goal: 'also a.md' }));
    const c1 = await manager.claim({ taskId: 'a', actorId: 'cursor-1' });
    assert.equal(c1.ok, true);
    const c2 = await manager.claim({ taskId: 'b', actorId: 'cursor-2' });
    assert.equal(c2.ok, false);
    assert.equal(c2.code, 'RESOURCE_CONFLICT');
  });
});

test('wrong file path denied at create', async () => {
  await withManager(async (manager) => {
    const bad = await manager.create(createInput({
      fileAllowlist: ['../secrets/x'],
    }));
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'FORBIDDEN_OR_INVALID_PATH');
  });
});

test('incorrect base/head SHA denial on verify', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({ baseSha: HEAD2, files: ['docs/a.md'] }),
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.submitEvidence({
      taskId: 'task-1',
      actorId: 'cursor-1',
      prNumber: 7,
      headShaHint: HEAD,
    });
    const verified = await manager.verify({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(verified.ok, false);
    assert.equal(verified.code, 'BASE_SHA_MISMATCH');
    assert.equal(verified.task.status, TASK_STATUSES.FAILED);
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('forbidden path in PR denied', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({ files: ['docs/a.md', 'backend/secret.js'] }),
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.submitEvidence({
      taskId: 'task-1',
      actorId: 'cursor-1',
      prNumber: 9,
    });
    const verified = await manager.verify({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(verified.ok, false);
    assert.equal(verified.code, 'FORBIDDEN_PATHS_IN_PR');
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('lease expiry moves RUNNING to UNCERTAIN_RUNNING (no silent reassign)', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader(),
    claimTtlMs: 5,
    runningTtlMs: 5,
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1', nowMs: 1000 });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1', nowMs: 1001 });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1', nowMs: 1002 });
    const recovered = await manager.recover({
      taskId: 'task-1',
      actorId: 'owner-1',
      nowMs: 50_000,
      reason: 'LEASE_EXPIRED',
    });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.task.status, TASK_STATUSES.UNCERTAIN_RUNNING);
    // Must not be claimable again while uncertain
    const reclaim = await manager.claim({ taskId: 'task-1', actorId: 'cursor-2', nowMs: 50_001 });
    assert.equal(reclaim.ok, false);
    assert.equal(reclaim.code, 'INVALID_TRANSITION');
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('expired CLAIMED becomes RECOVERY_REQUIRED', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader(),
    claimTtlMs: 5,
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1', nowMs: 1000 });
    const recovered = await manager.recover({
      taskId: 'task-1',
      actorId: 'owner-1',
      nowMs: 50_000,
      reason: 'LEASE_EXPIRED',
    });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.task.status, TASK_STATUSES.RECOVERY_REQUIRED);
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('evidence verification failure when GitHub unavailable is BLOCKED', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({ failCode: 'GITHUB_UNAVAILABLE' }),
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.submitEvidence({
      taskId: 'task-1',
      actorId: 'cursor-1',
      prNumber: 3,
      success: true, // must be ignored
    });
    const verified = await manager.verify({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(verified.ok, false);
    assert.equal(verified.code, 'GITHUB_UNAVAILABLE');
    assert.equal(verified.task.status, TASK_STATUSES.BLOCKED);
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('replayed/stale attempt denial on submit', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    const stale = await manager.submitEvidence({
      taskId: 'task-1',
      actorId: 'cursor-1',
      prNumber: 1,
      attempt: 99,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'STALE_ATTEMPT');
  });
});

test('happy path verify + owner accept/reject transitions', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    const prepared = await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    assert.equal(prepared.ok, true);
    assert.match(prepared.instruction.markdown, /NOT TECP operational authorization/);
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.submitEvidence({
      taskId: 'task-1',
      actorId: 'cursor-1',
      prNumber: 42,
      headShaHint: HEAD,
      success: true,
    });
    const verified = await manager.verify({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(verified.ok, true);
    assert.equal(verified.task.status, TASK_STATUSES.EVIDENCE_VERIFIED);
    assert.ok(verified.verification.limitations.some((l) => l.includes('OWNER_ACCEPTED')));

    const accepted = await manager.accept({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.task.status, TASK_STATUSES.OWNER_ACCEPTED);
    assert.match(
      accepted.task.ownerReview.identityLimitation,
      /SAME_UID/,
    );
  });
});

test('owner reject from verified state', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput({ taskId: 'task-r' }));
    await manager.claim({ taskId: 'task-r', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-r', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-r', actorId: 'cursor-1' });
    await manager.submitEvidence({ taskId: 'task-r', actorId: 'cursor-1', prNumber: 5 });
    await manager.verify({ taskId: 'task-r', actorId: 'owner-1' });
    const rejected = await manager.reject({
      taskId: 'task-r',
      actorId: 'owner-1',
      reason: 'needs revision',
    });
    assert.equal(rejected.ok, true);
    assert.equal(rejected.task.status, TASK_STATUSES.OWNER_REJECTED);
  });
});

test('next eligible task ordering respects deps and conflicts', async () => {
  await withManager(async (manager) => {
    await manager.create(createInput({
      taskId: 'first',
      fileAllowlist: ['docs/a.md'],
    }));
    await manager.create(createInput({
      taskId: 'second',
      fileAllowlist: ['docs/b.md'],
      dependsOnTaskIds: ['first'],
    }));
    await manager.create(createInput({
      taskId: 'third',
      fileAllowlist: ['docs/c.md'],
    }));

    const n1 = await manager.next();
    assert.equal(n1.ok, true);
    assert.equal(n1.task.taskId, 'first');

    // claim first so second still blocked by dependency; third eligible
    await manager.claim({ taskId: 'first', actorId: 'cursor-1' });
    const n2 = await manager.next();
    assert.equal(n2.ok, true);
    assert.equal(n2.task.taskId, 'third');
  });
});

test('CLI walkthrough with disposable data dir (no github)', async () => {
  const dir = await createDisposableDataDir();
  const prev = process.env.TECP_TASK_MANAGER_DATA_DIR;
  process.env.TECP_TASK_MANAGER_DATA_DIR = dir;
  try {
    process.exitCode = 0;
    await cliMain([
      'create',
      '--task-id', 'cli-1',
      '--owner', 'owner-1',
      '--repo', 'sepehrraeisi/TitanGold',
      '--base-sha', BASE,
      '--goal', 'CLI disposable demo',
      '--allow', 'docs/a.md',
      '--json',
    ]);
    assert.equal(process.exitCode || 0, 0);
    await cliMain(['claim', '--task-id', 'cli-1', '--actor', 'cursor-1', '--json']);
    assert.equal(process.exitCode || 0, 0);
    await cliMain(['status', '--task-id', 'cli-1', '--json']);
    assert.equal(process.exitCode || 0, 0);
  } finally {
    if (prev === undefined) delete process.env.TECP_TASK_MANAGER_DATA_DIR;
    else process.env.TECP_TASK_MANAGER_DATA_DIR = prev;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('zero DB/Worker/MCP/dispatcher side effects in package surface', async () => {
  // Static package contract: no pg dependency and no dispatcher imports.
  const pkg = JSON.parse(await fsp.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.dependencies, {});
  const tm = await fsp.readFile(new URL('../src/taskManager.js', import.meta.url), 'utf8');
  assert.equal(tm.includes('operationalDispatcher'), false);
  assert.equal(tm.includes('postgres'), false);
  assert.equal(tm.includes('createTitanMcpServer'), false);
});
