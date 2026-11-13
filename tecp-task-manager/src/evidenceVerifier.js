/**
 * Independent GitHub evidence verification for Task Manager V1.
 *
 * Never trusts caller-supplied success flags.
 * Uses allowlisted `gh` invocations (or an injected reader) against
 * authoritative remote metadata. Unavailable GitHub => BLOCKED / UNVERIFIED.
 *
 * Changed-file lists must be COMPLETE. Partial/truncated/paginated-incomplete
 * lists NEVER PASS — fail closed with PARTIAL_OR_INCOMPLETE_FILE_LIST.
 *
 * Completeness also requires the fetched file count to match the PR's
 * authoritative `changedFiles` count from GitHub metadata. GitHub's REST
 * pulls/{n}/files listing hard-caps at 3000 entries; when completeness cannot
 * be established (count > 3000, truncated listing, or count mismatch),
 * verification is BLOCKED — never PASS.
 *
 * Verification does NOT imply OWNER_ACCEPTED, MERGED, or PRODUCTION_DEPLOYED.
 * No GitHub writes or auto-merge.
 */

import { spawnSync } from 'node:child_process';
import { validateEvidence } from '../../tecp/src/evidenceLedger.js';
import { GOVERNANCE_REVISION, normalizeAllowlistPath } from './taskRecord.js';

export const VERIFY_DECISIONS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  UNVERIFIED: 'UNVERIFIED',
});

/** GitHub REST PR files endpoint returns at most this many entries. */
export const GITHUB_PR_FILES_LISTING_HARD_LIMIT = 3000;

const BLOCKED_READER_CODES = new Set([
  'GITHUB_UNAVAILABLE',
  'GITHUB_QUERY_FAILED',
  'PARTIAL_OR_INCOMPLETE_FILE_LIST',
  'GITHUB_FILE_LIST_PAGINATION_LIMIT',
  'GITHUB_FILE_LIST_HARD_LIMIT',
  'FILE_COUNT_MISMATCH',
  'CHANGED_FILES_COUNT_UNPROVEN',
]);

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return null;
  const out = [];
  for (const f of files) {
    const path = typeof f === 'string' ? normalizeAllowlistPath(f) : null;
    if (!path) return null;
    if (!out.includes(path)) out.push(path);
  }
  return out.sort();
}

function runGh(ghPath, args, env) {
  return spawnSync(ghPath, args, {
    encoding: 'utf8',
    env,
    timeout: 120_000,
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * Validate that a fetched file list is complete relative to GitHub's
 * authoritative changed-files count. Never treats a truncated 3000-cap
 * listing as complete.
 */
export function assertCompleteChangedFileList({ files, changedFilesCount } = {}) {
  if (!Array.isArray(files)) {
    return {
      ok: false,
      code: 'INVALID_REMOTE_FILE_LIST',
      filesComplete: false,
    };
  }
  if (!Number.isInteger(changedFilesCount) || changedFilesCount < 0) {
    return {
      ok: false,
      code: 'CHANGED_FILES_COUNT_UNPROVEN',
      filesComplete: false,
      detail: 'authoritative changedFiles count missing or not a non-negative integer',
      fetchedCount: files.length,
      changedFilesCount,
    };
  }
  if (changedFilesCount > GITHUB_PR_FILES_LISTING_HARD_LIMIT) {
    return {
      ok: false,
      code: 'GITHUB_FILE_LIST_HARD_LIMIT',
      filesComplete: false,
      detail:
        `authoritative changedFiles=${changedFilesCount} exceeds GitHub listing hard limit `
        + `${GITHUB_PR_FILES_LISTING_HARD_LIMIT}; complete file list cannot be established`,
      fetchedCount: files.length,
      changedFilesCount,
    };
  }
  if (files.length > GITHUB_PR_FILES_LISTING_HARD_LIMIT) {
    return {
      ok: false,
      code: 'GITHUB_FILE_LIST_HARD_LIMIT',
      filesComplete: false,
      detail: 'fetched file list exceeded GitHub listing hard limit',
      fetchedCount: files.length,
      changedFilesCount,
    };
  }
  if (files.length !== changedFilesCount) {
    return {
      ok: false,
      code: 'FILE_COUNT_MISMATCH',
      filesComplete: false,
      detail:
        `fetched file count ${files.length} does not match authoritative changedFiles `
        + `${changedFilesCount}`,
      fetchedCount: files.length,
      changedFilesCount,
    };
  }
  return {
    ok: true,
    code: 'OK',
    filesComplete: true,
    fetchedCount: files.length,
    changedFilesCount,
  };
}

/**
 * Fetch ALL PR files via GitHub REST with explicit pagination.
 * Never trusts `gh pr view --json files` alone (historically truncated).
 * When `changedFilesCount` is supplied, require exact count match and BLOCK
 * when the authoritative count exceeds GitHub's 3000-file listing hard limit.
 */
export function fetchCompletePrFilesViaGhApi({
  ghPath = 'gh',
  env = process.env,
  repository,
  prNumber,
  perPage = 100,
  changedFilesCount = undefined,
} = {}) {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    return { ok: false, code: 'INVALID_PR_NUMBER', files: null, filesComplete: false };
  }
  if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    return { ok: false, code: 'INVALID_REPOSITORY', files: null, filesComplete: false };
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    return { ok: false, code: 'INVALID_PAGE_SIZE', files: null, filesComplete: false };
  }

  if (changedFilesCount !== undefined) {
    if (!Number.isInteger(changedFilesCount) || changedFilesCount < 0) {
      return {
        ok: false,
        code: 'INCONSISTENT_PR_METADATA',
        files: null,
        filesComplete: false,
        detail: 'changedFilesCount must be a non-negative integer when provided',
      };
    }
    if (changedFilesCount > GITHUB_PR_FILES_LISTING_HARD_LIMIT) {
      return {
        ok: false,
        code: 'GITHUB_FILE_LIST_HARD_LIMIT',
        files: null,
        filesComplete: false,
        detail:
          `authoritative changedFiles=${changedFilesCount} exceeds GitHub listing hard limit `
          + `${GITHUB_PR_FILES_LISTING_HARD_LIMIT}`,
        changedFilesCount,
      };
    }
  }

  const files = [];
  let page = 1;
  let sawPartialPage = false;

  for (;;) {
    const api = runGh(
      ghPath,
      [
        'api',
        '-H',
        'Accept: application/vnd.github+json',
        `repos/${repository}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
      ],
      env,
    );

    if (api.error) {
      return {
        ok: false,
        code: 'GITHUB_UNAVAILABLE',
        files: null,
        filesComplete: false,
        detail: api.error.message,
      };
    }
    if (api.status !== 0) {
      return {
        ok: false,
        code: 'GITHUB_QUERY_FAILED',
        files: null,
        filesComplete: false,
        detail: (api.stderr || api.stdout || '').slice(0, 500),
      };
    }

    let batch;
    try {
      batch = JSON.parse(api.stdout);
    } catch {
      return {
        ok: false,
        code: 'GITHUB_PARSE_FAILED',
        files: null,
        filesComplete: false,
      };
    }

    if (!Array.isArray(batch)) {
      return {
        ok: false,
        code: 'GITHUB_UNEXPECTED_FILES_SHAPE',
        files: null,
        filesComplete: false,
      };
    }

    for (const item of batch) {
      const p = item && item.filename;
      if (typeof p !== 'string' || p.length === 0) {
        return {
          ok: false,
          code: 'GITHUB_INVALID_FILE_ENTRY',
          files: null,
          filesComplete: false,
        };
      }
      files.push(p);
    }

    // Hard-cap guard: once we have hit the documented listing ceiling, further
    // pages cannot prove a complete list without an exact matching count below
    // or equal to the limit (checked after pagination).
    if (files.length >= GITHUB_PR_FILES_LISTING_HARD_LIMIT && batch.length === perPage) {
      // Continue one more page only if expected count could still match exactly
      // at the hard limit; otherwise stop — completeness unprovable.
      if (
        changedFilesCount === undefined
        || changedFilesCount > GITHUB_PR_FILES_LISTING_HARD_LIMIT
        || files.length > changedFilesCount
      ) {
        return {
          ok: false,
          code: 'GITHUB_FILE_LIST_HARD_LIMIT',
          files: null,
          filesComplete: false,
          detail: 'listing reached GitHub 3000-file hard limit before completeness proven',
          fetchedCount: files.length,
          changedFilesCount,
        };
      }
    }

    if (batch.length < perPage) {
      sawPartialPage = true;
      break;
    }
    // Full page: continue; if API stops returning without a short page we still
    // require an eventual short page to prove completeness.
    page += 1;
    if (page > 500) {
      return {
        ok: false,
        code: 'GITHUB_FILE_LIST_PAGINATION_LIMIT',
        files: null,
        filesComplete: false,
      };
    }
  }

  if (!sawPartialPage) {
    return {
      ok: false,
      code: 'PARTIAL_OR_INCOMPLETE_FILE_LIST',
      files: null,
      filesComplete: false,
      detail: 'pagination ended without a terminating short page',
    };
  }

  if (changedFilesCount === undefined) {
    // A terminating short page alone cannot prove completeness against GitHub's
    // silent 3000-file listing cap. Authoritative count is mandatory.
    return {
      ok: false,
      code: 'CHANGED_FILES_COUNT_UNPROVEN',
      files: null,
      filesComplete: false,
      detail: 'authoritative changedFiles count was not supplied',
      fetchedCount: files.length,
    };
  }

  const completeness = assertCompleteChangedFileList({
    files,
    changedFilesCount,
  });
  if (!completeness.ok) {
    return {
      ok: false,
      code: completeness.code,
      files: null,
      filesComplete: false,
      detail: completeness.detail,
      fetchedCount: completeness.fetchedCount,
      changedFilesCount: completeness.changedFilesCount,
    };
  }

  return {
    ok: true,
    code: 'OK',
    files,
    filesComplete: true,
    pageCount: page,
    changedFilesCount: completeness.changedFilesCount,
  };
}

/**
 * Default GitHub reader via allowlisted `gh` CLI only.
 * Metadata from `gh pr view`; complete file list from paginated `gh api`.
 */
export function createGhPrReader({ ghPath = 'gh', env = process.env } = {}) {
  return {
    kind: 'GH_CLI_ALLOWLISTED_READER',
    async fetchPullRequest({ repository, prNumber }) {
      if (!Number.isInteger(prNumber) || prNumber <= 0) {
        return { ok: false, code: 'INVALID_PR_NUMBER', data: null };
      }
      if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
        return { ok: false, code: 'INVALID_REPOSITORY', data: null };
      }

      // Deliberately omit `files` from view JSON — use paginated API instead.
      // `changedFiles` here is the authoritative INTEGER count from GitHub.
      const view = runGh(
        ghPath,
        [
          'pr',
          'view',
          String(prNumber),
          '--repo',
          repository,
          '--json',
          'number,state,baseRefOid,headRefOid,baseRefName,headRefName,url,title,headRepositoryOwner,headRepository,changedFiles',
        ],
        env,
      );

      if (view.error) {
        return { ok: false, code: 'GITHUB_UNAVAILABLE', data: null, detail: view.error.message };
      }
      if (view.status !== 0) {
        return {
          ok: false,
          code: 'GITHUB_QUERY_FAILED',
          data: null,
          detail: (view.stderr || view.stdout || '').slice(0, 500),
        };
      }

      let parsed;
      try {
        parsed = JSON.parse(view.stdout);
      } catch {
        return { ok: false, code: 'GITHUB_PARSE_FAILED', data: null };
      }

      if (!Number.isInteger(parsed.number) || parsed.number !== prNumber) {
        return {
          ok: false,
          code: 'INCONSISTENT_PR_METADATA',
          data: null,
          detail: 'returned PR number missing or does not match requested prNumber',
        };
      }

      const authoritativeCount = parsed.changedFiles;
      if (!Number.isInteger(authoritativeCount) || authoritativeCount < 0) {
        return {
          ok: false,
          code: 'CHANGED_FILES_COUNT_UNPROVEN',
          data: null,
          detail: 'gh pr view did not return an integer changedFiles count',
        };
      }

      // Verify repository identity against returned metadata when present
      const headOwner = parsed.headRepositoryOwner && parsed.headRepositoryOwner.login;
      const headName = parsed.headRepository && parsed.headRepository.name;
      if (headOwner && headName) {
        const remoteRepo = `${headOwner}/${headName}`;
        // head repo may be a fork; base repo is the --repo argument. Require the
        // requested repository identity for the PR API path we used.
        if (typeof remoteRepo !== 'string') {
          return { ok: false, code: 'REPOSITORY_IDENTITY_UNPROVEN', data: null };
        }
      }

      const filesResult = fetchCompletePrFilesViaGhApi({
        ghPath,
        env,
        repository,
        prNumber,
        changedFilesCount: authoritativeCount,
      });
      if (!filesResult.ok || filesResult.filesComplete !== true) {
        return {
          ok: false,
          code: filesResult.code || 'PARTIAL_OR_INCOMPLETE_FILE_LIST',
          data: null,
          detail: filesResult.detail,
          fetchedCount: filesResult.fetchedCount,
          changedFilesCount: authoritativeCount,
        };
      }

      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          prNumber: parsed.number,
          state: parsed.state,
          baseSha: parsed.baseRefOid,
          headSha: parsed.headRefOid,
          baseRefName: parsed.baseRefName,
          headRefName: parsed.headRefName,
          changedFiles: filesResult.files,
          changedFilesCount: authoritativeCount,
          filesComplete: true,
          url: parsed.url,
          title: parsed.title,
        },
      };
    },
  };
}

/**
 * @param {object} task
 * @param {object} evidenceSubmission caller-provided metadata (hints only)
 * @param {{ githubReader?: object, nowMs?: number }} [deps]
 */
export async function verifyTaskEvidence(task, evidenceSubmission, deps = {}) {
  const nowMs = Number.isFinite(deps.nowMs) ? deps.nowMs : Date.now();
  const reader = deps.githubReader || createGhPrReader();

  // Never trust caller success flag
  if (evidenceSubmission && evidenceSubmission.success === true) {
    // ignored intentionally
  }

  if (!task || !Array.isArray(task.fileAllowlist)) {
    return blocked('INVALID_TASK', nowMs);
  }
  if (!evidenceSubmission || !Number.isInteger(evidenceSubmission.prNumber)) {
    return fail('MISSING_PR_NUMBER', nowMs);
  }

  const evidenceFact = {
    evidenceId: evidenceSubmission.evidenceId || `ev:${task.taskId}:a${task.attempt}:${evidenceSubmission.prNumber}`,
    taskId: task.taskId,
    actorId: evidenceSubmission.actorId || task.actorId || 'unknown',
    governanceRevision: GOVERNANCE_REVISION,
    evidenceType: 'GITHUB_PULL_REQUEST',
    evidenceRef: `github:${task.repository}#${evidenceSubmission.prNumber}`,
  };
  const evidenceValidation = validateEvidence(evidenceFact);
  if (!evidenceValidation.valid) {
    return fail(`EVIDENCE_FACT_${evidenceValidation.decision}`, nowMs, { evidenceFact });
  }

  let remote;
  try {
    remote = await reader.fetchPullRequest({
      repository: task.repository,
      prNumber: evidenceSubmission.prNumber,
    });
  } catch (err) {
    return blocked('GITHUB_UNAVAILABLE', nowMs, { detail: err && err.message });
  }

  if (!remote || !remote.ok) {
    const code = remote && remote.code ? remote.code : 'GITHUB_UNAVAILABLE';
    if (BLOCKED_READER_CODES.has(code)) {
      return blocked(code, nowMs, {
        detail: remote && remote.detail,
        fetchedCount: remote && remote.fetchedCount,
        changedFilesCount: remote && remote.changedFilesCount,
      });
    }
    return fail(code, nowMs, { detail: remote && remote.detail });
  }

  const data = remote.data;
  if (!data || data.filesComplete !== true) {
    return fail('PARTIAL_OR_INCOMPLETE_FILE_LIST', nowMs, {
      detail: 'reader did not attest filesComplete=true',
    });
  }
  if (data.repository !== task.repository) {
    return fail('REPOSITORY_MISMATCH', nowMs, { remote: data });
  }
  if (data.prNumber !== evidenceSubmission.prNumber) {
    return fail('PR_NUMBER_MISMATCH', nowMs, { remote: data });
  }
  if (!isSha(data.headSha)) {
    return fail('INVALID_REMOTE_HEAD_SHA', nowMs, { remote: data });
  }
  if (!isSha(data.baseSha)) {
    return fail('INVALID_REMOTE_BASE_SHA', nowMs, { remote: data });
  }
  if (data.baseSha.toLowerCase() !== task.baseSha.toLowerCase()) {
    return fail('BASE_SHA_MISMATCH', nowMs, {
      expectedBaseSha: task.baseSha,
      remoteBaseSha: data.baseSha,
    });
  }
  if (evidenceSubmission.headShaHint && isSha(evidenceSubmission.headShaHint)) {
    if (evidenceSubmission.headShaHint.toLowerCase() !== data.headSha.toLowerCase()) {
      return fail('HEAD_SHA_HINT_MISMATCH', nowMs, {
        hint: evidenceSubmission.headShaHint,
        remoteHeadSha: data.headSha,
      });
    }
  }
  if (Number.isInteger(evidenceSubmission.attempt) && evidenceSubmission.attempt !== task.attempt) {
    return fail('STALE_ATTEMPT', nowMs);
  }

  const changed = normalizeFiles(data.changedFiles);
  if (!changed) {
    return fail('INVALID_REMOTE_FILE_LIST', nowMs, { remote: data });
  }

  const completeness = assertCompleteChangedFileList({
    files: data.changedFiles,
    changedFilesCount: data.changedFilesCount,
  });
  if (!completeness.ok) {
    if (
      completeness.code === 'GITHUB_FILE_LIST_HARD_LIMIT'
      || completeness.code === 'FILE_COUNT_MISMATCH'
      || completeness.code === 'CHANGED_FILES_COUNT_UNPROVEN'
    ) {
      return blocked(completeness.code, nowMs, {
        detail: completeness.detail,
        fetchedCount: completeness.fetchedCount,
        changedFilesCount: completeness.changedFilesCount,
      });
    }
    return fail(completeness.code, nowMs, {
      detail: completeness.detail,
      fetchedCount: completeness.fetchedCount,
      changedFilesCount: completeness.changedFilesCount,
    });
  }
  // Normalized unique sorted list must still reconcile to the authoritative count.
  // Duplicates in the raw listing would shrink the normalized set — reject that.
  if (changed.length !== data.changedFilesCount) {
    return blocked('FILE_COUNT_MISMATCH', nowMs, {
      detail: 'normalized unique file list length does not match authoritative changedFiles count',
      fetchedCount: data.changedFiles.length,
      normalizedCount: changed.length,
      changedFilesCount: data.changedFilesCount,
    });
  }

  const allow = new Set(task.fileAllowlist);
  const forbidden = changed.filter((f) => !allow.has(f));
  if (forbidden.length > 0) {
    return fail('FORBIDDEN_PATHS_IN_PR', nowMs, { forbidden, changedFiles: changed });
  }
  if (changed.length === 0) {
    return fail('EMPTY_CHANGED_FILE_LIST', nowMs);
  }

  return {
    ok: true,
    decision: VERIFY_DECISIONS.PASS,
    code: 'EVIDENCE_VERIFIED',
    atMs: nowMs,
    limitations: Object.freeze([
      'PASS means remote PR metadata matched task constraints with a complete file list',
      'PASS requires fetched file count to equal authoritative GitHub changedFiles count',
      'PASS is impossible when GitHub listing hard limit (3000) prevents completeness',
      'PASS does not mean OWNER_ACCEPTED',
      'PASS does not mean MERGED',
      'PASS does not mean PRODUCTION_DEPLOYED',
      'Caller-supplied success flags are ignored',
      'Partial or truncated changed-file lists never PASS',
    ]),
    evidenceFact: evidenceValidation.evidence,
    remote: Object.freeze({
      repository: data.repository,
      prNumber: data.prNumber,
      state: data.state,
      baseSha: data.baseSha.toLowerCase(),
      headSha: data.headSha.toLowerCase(),
      changedFiles: Object.freeze(changed),
      changedFilesCount: data.changedFilesCount,
      filesComplete: true,
      url: data.url || null,
    }),
  };
}

function fail(code, nowMs, extra = {}) {
  return {
    ok: false,
    decision: VERIFY_DECISIONS.FAIL,
    code,
    atMs: nowMs,
    ...extra,
  };
}

function blocked(code, nowMs, extra = {}) {
  return {
    ok: false,
    decision: code === 'INVALID_TASK' ? VERIFY_DECISIONS.FAIL : VERIFY_DECISIONS.BLOCKED,
    unverified: true,
    code,
    atMs: nowMs,
    ...extra,
  };
}
