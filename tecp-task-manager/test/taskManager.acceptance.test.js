import assert from 'node:assert/strict';
import test from 'node:test';
import fsp from 'node:fs/promises';
import { createDisposableDataDir, openFileQueueStore } from '../src/fileQueueStore.js';
import { createTaskManager, TASK_STATUSES } from '../src/taskManager.js';
import { main as cliMain } from '../src/cli.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(PKG_ROOT, 'src', 'cli.js');

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
          changedFilesCount: files.length,
          filesComplete: true,
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

test('partial file list without filesComplete never PASSes', async () => {
  const dir = await createDisposableDataDir();
  const manager = await createTaskManager({
    dataDir: dir,
    githubReader: {
      kind: 'PARTIAL_FIXTURE',
      async fetchPullRequest({ repository, prNumber }) {
        return {
          ok: true,
          code: 'OK',
          data: {
            repository,
            prNumber,
            state: 'OPEN',
            baseSha: BASE,
            headSha: HEAD,
            changedFiles: ['docs/a.md'],
            // filesComplete intentionally omitted
          },
        };
      },
    },
  });
  try {
    await manager.create(createInput());
    await manager.claim({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.prepare({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.ackRunning({ taskId: 'task-1', actorId: 'cursor-1' });
    await manager.submitEvidence({ taskId: 'task-1', actorId: 'cursor-1', prNumber: 11 });
    const verified = await manager.verify({ taskId: 'task-1', actorId: 'owner-1' });
    assert.equal(verified.ok, false);
    assert.equal(verified.code, 'PARTIAL_OR_INCOMPLETE_FILE_LIST');
  } finally {
    await manager.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('complete large PR file list detects forbidden path beyond first page', async () => {
  const { verifyTaskEvidence } = await import('../src/evidenceVerifier.js');
  const pageSize = 100;
  const allowed = [];
  for (let i = 0; i < pageSize; i += 1) {
    allowed.push(`docs/page1-${i}.md`);
  }
  // Second page includes a forbidden path
  const allFiles = [...allowed, 'backend/secret.js', 'docs/tail.md'];

  const reader = {
    kind: 'PAGED_COMPLETE_FIXTURE',
    async fetchPullRequest({ repository, prNumber }) {
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          prNumber,
          state: 'OPEN',
          baseSha: BASE,
          headSha: HEAD,
          changedFiles: allFiles,
          changedFilesCount: allFiles.length,
          filesComplete: true,
        },
      };
    },
  };

  const task = {
    taskId: 'big-1',
    attempt: 1,
    actorId: 'cursor-1',
    repository: 'sepehrraeisi/TitanGold',
    baseSha: BASE,
    fileAllowlist: [...allowed, 'docs/tail.md'],
  };

  const result = await verifyTaskEvidence(
    task,
    { prNumber: 99, actorId: 'cursor-1', attempt: 1 },
    { githubReader: reader, nowMs: 1 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN_PATHS_IN_PR');
  assert.ok(result.forbidden.includes('backend/secret.js'));
  assert.ok(result.changedFiles.length > pageSize);
});

test('reader reporting incomplete pagination blocks verify', async () => {
  const { verifyTaskEvidence } = await import('../src/evidenceVerifier.js');
  const reader = {
    async fetchPullRequest() {
      return {
        ok: false,
        code: 'PARTIAL_OR_INCOMPLETE_FILE_LIST',
        data: null,
        detail: 'simulated truncated gh pr view files page',
      };
    },
  };
  const result = await verifyTaskEvidence(
    {
      taskId: 't',
      attempt: 1,
      repository: 'sepehrraeisi/TitanGold',
      baseSha: BASE,
      fileAllowlist: ['docs/a.md'],
    },
    { prNumber: 1, actorId: 'a', attempt: 1 },
    { githubReader: reader },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PARTIAL_OR_INCOMPLETE_FILE_LIST');
  assert.equal(result.decision, 'BLOCKED');
});

test('fetched file count must match authoritative changedFiles count', async () => {
  const {
    verifyTaskEvidence,
    assertCompleteChangedFileList,
  } = await import('../src/evidenceVerifier.js');

  const mismatch = assertCompleteChangedFileList({
    files: ['docs/a.md', 'docs/b.md'],
    changedFilesCount: 5,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'FILE_COUNT_MISMATCH');

  const reader = {
    async fetchPullRequest({ repository, prNumber }) {
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          prNumber,
          state: 'OPEN',
          baseSha: BASE,
          headSha: HEAD,
          changedFiles: ['docs/a.md'],
          changedFilesCount: 3,
          filesComplete: true,
        },
      };
    },
  };
  const result = await verifyTaskEvidence(
    {
      taskId: 'count-1',
      attempt: 1,
      repository: 'sepehrraeisi/TitanGold',
      baseSha: BASE,
      fileAllowlist: ['docs/a.md'],
    },
    { prNumber: 7, actorId: 'a', attempt: 1 },
    { githubReader: reader, nowMs: 1 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FILE_COUNT_MISMATCH');
  assert.equal(result.decision, 'BLOCKED');
});

test('missing authoritative changedFiles count blocks verify', async () => {
  const { verifyTaskEvidence } = await import('../src/evidenceVerifier.js');
  const reader = {
    async fetchPullRequest({ repository, prNumber }) {
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          prNumber,
          state: 'OPEN',
          baseSha: BASE,
          headSha: HEAD,
          changedFiles: ['docs/a.md'],
          filesComplete: true,
          // changedFilesCount omitted
        },
      };
    },
  };
  const result = await verifyTaskEvidence(
    {
      taskId: 'count-2',
      attempt: 1,
      repository: 'sepehrraeisi/TitanGold',
      baseSha: BASE,
      fileAllowlist: ['docs/a.md'],
    },
    { prNumber: 8, actorId: 'a', attempt: 1 },
    { githubReader: reader, nowMs: 1 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHANGED_FILES_COUNT_UNPROVEN');
  assert.equal(result.decision, 'BLOCKED');
});

test('GitHub 3000-file listing hard limit blocks when completeness unprovable', async () => {
  const {
    assertCompleteChangedFileList,
    GITHUB_PR_FILES_LISTING_HARD_LIMIT,
    verifyTaskEvidence,
  } = await import('../src/evidenceVerifier.js');

  assert.equal(GITHUB_PR_FILES_LISTING_HARD_LIMIT, 3000);

  const overLimit = assertCompleteChangedFileList({
    files: Array.from({ length: 10 }, (_, i) => `docs/f-${i}.md`),
    changedFilesCount: GITHUB_PR_FILES_LISTING_HARD_LIMIT + 1,
  });
  assert.equal(overLimit.ok, false);
  assert.equal(overLimit.code, 'GITHUB_FILE_LIST_HARD_LIMIT');

  const reader = {
    async fetchPullRequest() {
      return {
        ok: false,
        code: 'GITHUB_FILE_LIST_HARD_LIMIT',
        data: null,
        detail: 'authoritative changedFiles exceeds listing hard limit',
        changedFilesCount: GITHUB_PR_FILES_LISTING_HARD_LIMIT + 50,
      };
    },
  };
  const result = await verifyTaskEvidence(
    {
      taskId: 'limit-1',
      attempt: 1,
      repository: 'sepehrraeisi/TitanGold',
      baseSha: BASE,
      fileAllowlist: ['docs/a.md'],
    },
    { prNumber: 9, actorId: 'a', attempt: 1 },
    { githubReader: reader, nowMs: 1 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'GITHUB_FILE_LIST_HARD_LIMIT');
  assert.equal(result.decision, 'BLOCKED');
});

test('inconsistent PR metadata is rejected', async () => {
  const { verifyTaskEvidence } = await import('../src/evidenceVerifier.js');
  const reader = {
    async fetchPullRequest() {
      return {
        ok: false,
        code: 'INCONSISTENT_PR_METADATA',
        data: null,
        detail: 'returned PR number missing or does not match requested prNumber',
      };
    },
  };
  const result = await verifyTaskEvidence(
    {
      taskId: 'meta-1',
      attempt: 1,
      repository: 'sepehrraeisi/TitanGold',
      baseSha: BASE,
      fileAllowlist: ['docs/a.md'],
    },
    { prNumber: 10, actorId: 'a', attempt: 1 },
    { githubReader: reader, nowMs: 1 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INCONSISTENT_PR_METADATA');
  assert.equal(result.decision, 'FAIL');
});

async function runCliJson(dataDir, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, '--json', '--data-dir', dataDir, ...args], {
      cwd: PKG_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      let payload = null;
      try {
        payload = JSON.parse(stdout);
      } catch {
        payload = { parseError: true, stdout, stderr };
      }
      resolve({ code, payload, stdout, stderr });
    });
  });
}

test('idempotent claim same-key replay after manager restart', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-claim-restart-1';
  try {
    const m1 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await m1.create(createInput());
    const first = await m1.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    assert.equal(first.ok, true);
    assert.equal(first.task.attempt, 1);
    assert.equal(first.task.status, TASK_STATUSES.CLAIMED);
    assert.ok(first.task.idempotencyRecords?.[key]);
    await m1.close();

    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const replay = await m2.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.code, 'IDEMPOTENT_REPLAY');
    assert.equal(replay.task.attempt, 1);
    assert.equal(replay.task.status, TASK_STATUSES.CLAIMED);
    assert.equal(replay.task.actorId, 'cursor-1');
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('idempotent claim conflicting-key reuse denied after restart', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-claim-conflict-1';
  try {
    const m1 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await m1.create(createInput());
    const first = await m1.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    assert.equal(first.ok, true);
    await m1.close();

    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const conflict = await m2.claim({
      taskId: 'task-1',
      actorId: 'cursor-2',
      idempotencyKey: key,
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
    const status = await m2.status({ taskId: 'task-1' });
    assert.equal(status.task.attempt, 1);
    assert.equal(status.task.actorId, 'cursor-1');
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('idempotent claim stale-attempt denial', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-claim-stale-1';
  try {
    const m1 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await m1.create(createInput());
    const first = await m1.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
      attempt: 1,
    });
    assert.equal(first.ok, true);
    await m1.close();

    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const stale = await m2.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
      attempt: 99,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'STALE_ATTEMPT');
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('failed claim does not durable-consume idempotency key', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-claim-no-consume-on-fail';
  try {
    const manager = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await manager.create(createInput({ taskId: 'a' }));
    await manager.create(createInput({ taskId: 'b', goal: 'also a.md' }));
    await manager.claim({ taskId: 'a', actorId: 'cursor-1' });
    const denied = await manager.claim({
      taskId: 'b',
      actorId: 'cursor-2',
      idempotencyKey: key,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'RESOURCE_CONFLICT');
    await manager.close();

    // After restart, key must still be usable for a fresh PENDING task.
    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await m2.create(createInput({
      taskId: 'c',
      goal: 'Edit docs/c.md only',
      fileAllowlist: ['docs/c.md'],
    }));
    const okClaim = await m2.claim({
      taskId: 'c',
      actorId: 'cursor-3',
      idempotencyKey: key,
    });
    assert.equal(okClaim.ok, true);
    assert.equal(okClaim.task.attempt, 1);
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('crash before durable idempotency record allows safe retry; corrupt ledger denies', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-crash-safe-1';
  try {
    const m1 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    await m1.create(createInput());
    await m1.close();

    // Simulate crash after claim state write but before idempotency binding:
    // task is CLAIMED without idempotencyRecords → restart must not invent a grant.
    const store = await openFileQueueStore(dir);
    const task = await store.readTask('task-1');
    task.status = TASK_STATUSES.CLAIMED;
    task.actorId = 'cursor-1';
    task.attempt = 1;
    task.lease = {
      leaseId: 'lease-sim',
      taskId: 'task-1',
      actorId: 'cursor-1',
      attempt: 1,
      status: 'ACTIVE',
      issuedAtMs: 1,
      expiresAtMs: Date.now() + 60_000,
      branchName: null,
    };
    delete task.idempotencyRecords;
    await store.writeTask(task);
    await store.close();

    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const again = await m2.claim({
      taskId: 'task-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    // Already claimed — no second active claim; key remains unconsumed.
    assert.equal(again.ok, false);
    assert.equal(again.code, 'INVALID_TRANSITION');
    await m2.close();

    // Corrupt durable ledger must fail closed on open / claim path.
    const store2 = await openFileQueueStore(dir);
    const t2 = await store2.readTask('task-1');
    t2.idempotencyRecords = { [key]: { operation: 'not-an-object', attempt: 1 } };
    await store2.writeTask(t2);
    await store2.close();

    await assert.rejects(
      () => createTaskManager({ dataDir: dir, githubReader: fixtureReader() }),
      (err) => err && err.code === 'CORRUPT_IDEMPOTENCY_LEDGER',
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('independent CLI processes preserve task state; API restart replay stays consistent', async () => {
  const dir = await createDisposableDataDir();
  const key = 'idem-cli-process-1';
  try {
    const created = await runCliJson(dir, [
      'create',
      '--task-id', 'task-cli-1',
      '--owner', 'owner-1',
      '--repo', 'sepehrraeisi/TitanGold',
      '--base-sha', BASE,
      '--goal', 'Edit docs/a.md only',
      '--allow', 'docs/a.md',
    ]);
    assert.equal(created.payload.ok, true);

    const m1 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const claim = await m1.claim({
      taskId: 'task-cli-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    assert.equal(claim.ok, true);
    await m1.close();

    const statusProc = await runCliJson(dir, ['status', '--task-id', 'task-cli-1']);
    assert.equal(statusProc.payload.ok, true);
    assert.equal(statusProc.payload.task.status, TASK_STATUSES.CLAIMED);
    assert.equal(statusProc.payload.task.attempt, 1);
    assert.ok(statusProc.payload.task.idempotencyRecords?.[key]);

    const m2 = await createTaskManager({ dataDir: dir, githubReader: fixtureReader() });
    const replay = await m2.claim({
      taskId: 'task-cli-1',
      actorId: 'cursor-1',
      idempotencyKey: key,
    });
    assert.equal(replay.code, 'IDEMPOTENT_REPLAY');
    assert.equal(replay.task.attempt, 1);
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Append-only Owner-gated reconciliation (authorized four-path slice)
// ---------------------------------------------------------------------------

const ORIG_BASE = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const GOV_HEAD = 'ffffffffffffffffffffffffffffffffffffffff';
const GOV_MERGE = '1111111111111111111111111111111111111111';
const IMPL_HEAD = '2222222222222222222222222222222222222222';
const IMPL_MERGE = '3333333333333333333333333333333333333333';
const RULE02 = '.cursor/rules/titangold-current-active-work.mdc';
const ALLOW_PATHS = [
  'tecp-task-manager/src/taskManager.js',
  'tecp-task-manager/test/taskManager.acceptance.test.js',
];
const OWNER_ACK = 'I_ACKNOWLEDGE_APPEND_ONLY_RECONCILIATION_OF_FAILED_EVIDENCE';

function reconciliationReader(overrides = {}) {
  const govFiles = overrides.govFiles || [RULE02];
  const implFiles = overrides.implFiles || ALLOW_PATHS;
  const govCompareFiles = overrides.govCompareFiles || [RULE02];
  const implCompareFiles = overrides.implCompareFiles || ALLOW_PATHS;
  const failCompare = overrides.failCompare || null;
  const failPr = overrides.failPr || null;
  return {
    kind: 'INERT_RECONCILIATION_FIXTURE_READER',
    async fetchPullRequest({ repository, prNumber }) {
      if (failPr) return { ok: false, code: failPr, data: null };
      if (prNumber === (overrides.govPr || 303)) {
        return {
          ok: true,
          code: 'OK',
          data: {
            repository,
            prNumber,
            state: overrides.govState || 'MERGED',
            baseSha: overrides.govBase || ORIG_BASE,
            headSha: overrides.govHead || GOV_HEAD,
            baseRefName: 'main',
            headRefName: 'governance',
            changedFiles: govFiles,
            changedFilesCount: govFiles.length,
            filesComplete: true,
            mergeCommitOid: overrides.govMerge || GOV_MERGE,
            url: `https://example.test/${repository}/pull/${prNumber}`,
            title: 'governance',
          },
        };
      }
      if (prNumber === (overrides.implPr || 304)) {
        return {
          ok: true,
          code: 'OK',
          data: {
            repository,
            prNumber,
            state: overrides.implState || 'MERGED',
            baseSha: overrides.implBase || GOV_MERGE,
            headSha: overrides.implHead || IMPL_HEAD,
            baseRefName: 'main',
            headRefName: 'impl',
            changedFiles: implFiles,
            changedFilesCount: implFiles.length,
            filesComplete: true,
            mergeCommitOid: overrides.implMerge || IMPL_MERGE,
            url: `https://example.test/${repository}/pull/${prNumber}`,
            title: 'impl',
          },
        };
      }
      return { ok: false, code: 'PR_NOT_FOUND', data: null };
    },
    async compareCommits({ repository, base, head }) {
      if (failCompare) return { ok: false, code: failCompare, data: null };
      const b = base.toLowerCase();
      const h = head.toLowerCase();
      if (b === ORIG_BASE && h === (overrides.govMerge || GOV_MERGE).toLowerCase()) {
        return {
          ok: true,
          code: 'OK',
          data: {
            repository,
            base: b,
            head: h,
            status: overrides.govCompareStatus || 'ahead',
            aheadBy: 2,
            behindBy: overrides.govBehindBy ?? 0,
            totalCommits: 2,
            files: govCompareFiles,
            filesComplete: overrides.govCompareComplete !== false,
          },
        };
      }
      if (
        b === (overrides.govMerge || GOV_MERGE).toLowerCase()
        && h === (overrides.implMerge || IMPL_MERGE).toLowerCase()
      ) {
        return {
          ok: true,
          code: 'OK',
          data: {
            repository,
            base: b,
            head: h,
            status: overrides.implCompareStatus || 'ahead',
            aheadBy: 1,
            behindBy: overrides.implBehindBy ?? 0,
            totalCommits: 1,
            files: implCompareFiles,
            filesComplete: overrides.implCompareComplete !== false,
          },
        };
      }
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          base: b,
          head: h,
          status: 'diverged',
          aheadBy: 1,
          behindBy: 1,
          totalCommits: 1,
          files: ['unrelated/path.js'],
          filesComplete: true,
        },
      };
    },
  };
}

async function seedFailedBaseMismatch(manager, taskId = 'task-recon-1') {
  await manager.create(createInput({
    taskId,
    baseSha: ORIG_BASE,
    fileAllowlist: ALLOW_PATHS,
    goal: 'Idempotency durability two-path fix',
  }));
  await manager.claim({ taskId, actorId: 'cursor-1' });
  await manager.prepare({ taskId, actorId: 'cursor-1' });
  await manager.ackRunning({ taskId, actorId: 'cursor-1' });
  // Evidence points at impl PR; verify uses ordinary reader with mismatched base.
  await manager.submitEvidence({
    taskId,
    actorId: 'cursor-1',
    prNumber: 304,
    headShaHint: IMPL_HEAD,
  });
}

function reconcileArgs(overrides = {}) {
  return {
    taskId: 'task-recon-1',
    actorId: 'owner-1',
    expectedAttempt: 1,
    expectedBaseSha: ORIG_BASE,
    governancePrNumber: 303,
    expectedGovernanceMergeSha: GOV_MERGE,
    implementationPrNumber: 304,
    expectedImplementationHeadSha: IMPL_HEAD,
    expectedImplementationMergeSha: IMPL_MERGE,
    ownerAcknowledgement: OWNER_ACK,
    ...overrides,
  };
}

test('reconciliation preserves historical BASE_SHA_MISMATCH FAIL', async () => {
  const dir = await createDisposableDataDir();
  // First manager: ordinary verify with mismatched base -> FAILED
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
      state: 'MERGED',
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    const verified = await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    assert.equal(verified.ok, false);
    assert.equal(verified.code, 'BASE_SHA_MISMATCH');
    assert.equal(verified.task.status, TASK_STATUSES.FAILED);
    assert.equal(verified.task.verification.decision, 'FAIL');
    const failAt = verified.task.verification.atMs;
    await m1.close();

    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const recon = await m2.reconcile(reconcileArgs());
    assert.equal(recon.ok, true);
    assert.equal(recon.task.status, TASK_STATUSES.FAILED);
    assert.equal(recon.task.verification.decision, 'FAIL');
    assert.equal(recon.task.verification.code, 'BASE_SHA_MISMATCH');
    assert.equal(recon.task.verification.atMs, failAt);
    assert.equal(recon.task.reconciliation.decision, 'RECONCILED');
    assert.equal(recon.task.reconciliation.ownerAcceptStillRequired, true);
    assert.notEqual(recon.task.status, TASK_STATUSES.EVIDENCE_VERIFIED);
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation accepts valid governance-only advancement', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const recon = await m2.reconcile(reconcileArgs());
    assert.equal(recon.ok, true);
    assert.equal(recon.code, 'APPEND_ONLY_RECONCILIATION_VERIFIED');
    assert.equal(
      recon.task.reconciliation.github.governanceChangedFiles[0],
      RULE02,
    );
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation rejects unrelated base advancement', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader({
        govCompareFiles: [RULE02, 'backend/unrelated.js'],
        govFiles: [RULE02, 'backend/unrelated.js'],
      }),
    });
    const recon = await m2.reconcile(reconcileArgs());
    assert.equal(recon.ok, false);
    assert.ok(
      recon.code === 'UNRELATED_BASE_ADVANCEMENT'
      || recon.code === 'GOVERNANCE_PR_NOT_RULE02_ONLY',
    );
    const status = await m2.status({ taskId: 'task-recon-1' });
    assert.equal(status.task.status, TASK_STATUSES.FAILED);
    assert.equal(status.task.verification.decision, 'FAIL');
    assert.equal(status.task.reconciliation, undefined);
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation rejects wrong governance / implementation PR or SHAs', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const wrongGov = await m2.reconcile(reconcileArgs({ governancePrNumber: 999 }));
    assert.equal(wrongGov.ok, false);
    const wrongImplHead = await m2.reconcile(reconcileArgs({
      expectedImplementationHeadSha: '4444444444444444444444444444444444444444',
    }));
    assert.equal(wrongImplHead.ok, false);
    assert.equal(wrongImplHead.code, 'IMPLEMENTATION_HEAD_SHA_MISMATCH');
    const wrongBase = await m2.reconcile(reconcileArgs({
      expectedBaseSha: '5555555555555555555555555555555555555555',
    }));
    assert.equal(wrongBase.ok, false);
    assert.equal(wrongBase.code, 'WRONG_BASE_SHA');
    const wrongAttempt = await m2.reconcile(reconcileArgs({ expectedAttempt: 9 }));
    assert.equal(wrongAttempt.ok, false);
    assert.equal(wrongAttempt.code, 'WRONG_ATTEMPT');
    await m2.close();
    const m3 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader({
        implFiles: [...ALLOW_PATHS, 'tecp-task-manager/package.json'],
      }),
    });
    const badAllow = await m3.reconcile(reconcileArgs());
    assert.equal(badAllow.ok, false);
    assert.equal(badAllow.code, 'IMPLEMENTATION_ALLOWLIST_MISMATCH');
    await m3.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation GitHub unavailable yields BLOCKED never PASS', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader({ failPr: 'GITHUB_UNAVAILABLE' }),
    });
    const recon = await m2.reconcile(reconcileArgs());
    assert.equal(recon.ok, false);
    assert.equal(recon.code, 'GITHUB_UNAVAILABLE');
    assert.equal(recon.decision, 'BLOCKED');
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('ordinary FAILED task cannot bypass accept without reconciliation', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    const denied = await m1.accept({ taskId: 'task-recon-1', actorId: 'owner-1' });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'INVALID_TRANSITION');
    assert.equal((await m1.status({ taskId: 'task-recon-1' })).task.status, TASK_STATUSES.FAILED);
    await m1.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('successful reconciliation still requires separate OWNER_ACCEPT', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const recon = await m2.reconcile(reconcileArgs());
    assert.equal(recon.ok, true);
    assert.equal(recon.task.status, TASK_STATUSES.FAILED);
    const accepted = await m2.accept({
      taskId: 'task-recon-1',
      actorId: 'owner-1',
      acknowledgement: 'Owner accepts after reconciliation',
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.task.status, TASK_STATUSES.OWNER_ACCEPTED);
    assert.equal(
      accepted.task.ownerReview.acceptancePath,
      'AFTER_APPEND_ONLY_RECONCILIATION',
    );
    assert.equal(accepted.task.verification.decision, 'FAIL');
    assert.match(
      accepted.task.ownerReview.identityLimitation,
      /SAME_UID/,
    );
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation replay is idempotent; conflicting binding DENY', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const first = await m2.reconcile(reconcileArgs());
    assert.equal(first.ok, true);
    const auditCount = first.task.auditTrail.filter(
      (e) => e.eventType === 'APPEND_ONLY_RECONCILIATION_RECORDED',
    ).length;
    assert.equal(auditCount, 1);
    await m2.close();

    const m3 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const replay = await m3.reconcile(reconcileArgs());
    assert.equal(replay.ok, true);
    assert.equal(replay.code, 'RECONCILIATION_REPLAY');
    const auditCount2 = replay.task.auditTrail.filter(
      (e) => e.eventType === 'APPEND_ONLY_RECONCILIATION_RECORDED',
    ).length;
    assert.equal(auditCount2, 1);
    const conflict = await m3.reconcile(reconcileArgs({
      expectedImplementationMergeSha: '6666666666666666666666666666666666666666',
    }));
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 'RECONCILIATION_CONFLICT');
    await m3.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('reconciliation requires owner acknowledgement; corrupt record DENY', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1);
    await m1.verify({ taskId: 'task-recon-1', actorId: 'owner-1' });
    await m1.close();
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const missingAck = await m2.reconcile(reconcileArgs({ ownerAcknowledgement: 'short' }));
    assert.equal(missingAck.ok, false);
    assert.equal(missingAck.code, 'OWNER_ACKNOWLEDGEMENT_REQUIRED');
    await m2.close();
    // Persist a corrupt reconciliation record directly then deny accept/reconcile.
    const store = await openFileQueueStore(dir);
    const task = await store.readTask('task-recon-1');
    const mutated = {
      ...task,
      reconciliation: { decision: 'RECONCILED', ok: true },
    };
    await store.writeTask(mutated);
    await store.close();
    const m3 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const corrupt = await m3.reconcile(reconcileArgs());
    assert.equal(corrupt.ok, false);
    assert.equal(corrupt.code, 'CORRUPT_RECONCILIATION_RECORD');
    const acceptCorrupt = await m3.accept({ taskId: 'task-recon-1', actorId: 'owner-1' });
    assert.equal(acceptCorrupt.ok, false);
    assert.equal(acceptCorrupt.code, 'CORRUPT_RECONCILIATION_RECORD');
    await m3.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('CLI reconcile command wires required Owner flags', async () => {
  const dir = await createDisposableDataDir();
  const m1 = await createTaskManager({
    dataDir: dir,
    githubReader: fixtureReader({
      baseSha: GOV_MERGE,
      headSha: IMPL_HEAD,
      files: ALLOW_PATHS,
    }),
  });
  try {
    await seedFailedBaseMismatch(m1, 'task-cli-recon');
    await m1.verify({ taskId: 'task-cli-recon', actorId: 'owner-1' });
    await m1.close();

    // CLI uses default gh reader; inject via manager API path already covered.
    // Here verify parse/help surface and that missing flags fail closed through manager
    // when invoked with incomplete args via programmatic main.
    process.env.TECP_TASK_MANAGER_DATA_DIR = dir;
    const prev = process.env.TECP_TASK_MANAGER_DATA_DIR;
    const { main } = await import('../src/cli.js');
    const codeBefore = process.exitCode;
    process.exitCode = 0;
    // Missing owner-ack should fail
    await main([
      'reconcile',
      '--data-dir', dir,
      '--json',
      '--task-id', 'task-cli-recon',
      '--actor', 'owner-1',
      '--attempt', '1',
      '--base-sha', ORIG_BASE,
      '--governance-pr', '303',
      '--governance-merge-sha', GOV_MERGE,
      '--implementation-pr', '304',
      '--implementation-head-sha', IMPL_HEAD,
      '--implementation-merge-sha', IMPL_MERGE,
      // no --owner-ack
    ]);
    assert.equal(process.exitCode, 1);
    process.exitCode = codeBefore;
    process.env.TECP_TASK_MANAGER_DATA_DIR = prev;

    // Manager-level success with injected reader remains the durable proof path.
    const m2 = await createTaskManager({
      dataDir: dir,
      githubReader: reconciliationReader(),
    });
    const recon = await m2.reconcile(reconcileArgs({ taskId: 'task-cli-recon' }));
    assert.equal(recon.ok, true);
    await m2.close();
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
