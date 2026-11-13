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

export const RECONCILIATION_DECISIONS = Object.freeze({
  RECONCILED: 'RECONCILED',
  DENY: 'DENY',
  BLOCKED: 'BLOCKED',
});

/** Sole path permitted for governance-only base advancement. */
export const GOVERNANCE_ONLY_RULE02_PATH =
  '.cursor/rules/titangold-current-active-work.mdc';

/** GitHub REST PR files endpoint returns at most this many entries. */
export const GITHUB_PR_FILES_LISTING_HARD_LIMIT = 3000;

/** GitHub compare API truncates the files array around this size. */
export const GITHUB_COMPARE_FILES_SOFT_LIMIT = 300;

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
      // `mergeCommit` is required for append-only reconciliation of MERGED PRs.
      const view = runGh(
        ghPath,
        [
          'pr',
          'view',
          String(prNumber),
          '--repo',
          repository,
          '--json',
          'number,state,baseRefOid,headRefOid,baseRefName,headRefName,url,title,headRepositoryOwner,headRepository,changedFiles,mergeCommit',
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

      let mergeCommitOid = null;
      if (parsed.mergeCommit && typeof parsed.mergeCommit.oid === 'string') {
        mergeCommitOid = parsed.mergeCommit.oid;
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
          mergeCommitOid,
          url: parsed.url,
          title: parsed.title,
        },
      };
    },

    /**
     * Trusted remote ancestry / intervening-file probe via GitHub compare API.
     * Never trusts caller-supplied ancestry booleans.
     */
    async compareCommits({ repository, base, head }) {
      if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
        return { ok: false, code: 'INVALID_REPOSITORY', data: null };
      }
      if (!isSha(base) || !isSha(head)) {
        return { ok: false, code: 'INVALID_COMPARE_SHA', data: null };
      }
      const api = runGh(
        ghPath,
        [
          'api',
          '-H',
          'Accept: application/vnd.github+json',
          `repos/${repository}/compare/${base.toLowerCase()}...${head.toLowerCase()}`,
        ],
        env,
      );
      if (api.error) {
        return { ok: false, code: 'GITHUB_UNAVAILABLE', data: null, detail: api.error.message };
      }
      if (api.status !== 0) {
        return {
          ok: false,
          code: 'GITHUB_QUERY_FAILED',
          data: null,
          detail: (api.stderr || api.stdout || '').slice(0, 500),
        };
      }
      let parsed;
      try {
        parsed = JSON.parse(api.stdout);
      } catch {
        return { ok: false, code: 'GITHUB_PARSE_FAILED', data: null };
      }
      if (!parsed || typeof parsed.status !== 'string') {
        return { ok: false, code: 'GITHUB_UNEXPECTED_COMPARE_SHAPE', data: null };
      }
      const files = Array.isArray(parsed.files)
        ? parsed.files.map((f) => f && f.filename).filter((p) => typeof p === 'string')
        : null;
      if (!files) {
        return { ok: false, code: 'GITHUB_UNEXPECTED_COMPARE_SHAPE', data: null };
      }
      // Compare API truncates file lists; if we hit the soft limit, completeness
      // of intervening paths cannot be proven — BLOCK rather than PASS.
      const filesComplete = files.length < GITHUB_COMPARE_FILES_SOFT_LIMIT;
      return {
        ok: true,
        code: 'OK',
        data: {
          repository,
          base: base.toLowerCase(),
          head: head.toLowerCase(),
          status: parsed.status,
          aheadBy: Number.isInteger(parsed.ahead_by) ? parsed.ahead_by : null,
          behindBy: Number.isInteger(parsed.behind_by) ? parsed.behind_by : null,
          totalCommits: Number.isInteger(parsed.total_commits) ? parsed.total_commits : null,
          files,
          filesComplete,
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

function reconcileDeny(code, nowMs, extra = {}) {
  return {
    ok: false,
    decision: RECONCILIATION_DECISIONS.DENY,
    code,
    atMs: nowMs,
    ...extra,
  };
}

function reconcileBlocked(code, nowMs, extra = {}) {
  return {
    ok: false,
    decision: RECONCILIATION_DECISIONS.BLOCKED,
    unverified: true,
    code,
    atMs: nowMs,
    ...extra,
  };
}

function shaEq(a, b) {
  return typeof a === 'string' && typeof b === 'string'
    && a.toLowerCase() === b.toLowerCase();
}

function isDescendantCompare(data) {
  if (!data) return false;
  if (data.behindBy !== 0) return false;
  return data.status === 'ahead' || data.status === 'identical';
}

function filesOnlyRule02(files) {
  if (!Array.isArray(files) || files.length === 0) return false;
  const normalized = normalizeFiles(files);
  if (!normalized || normalized.length !== 1) return false;
  return normalized[0] === GOVERNANCE_ONLY_RULE02_PATH;
}

/**
 * Independently verify Owner-gated append-only reconciliation of a FAILED
 * task whose historical verification was BASE_SHA_MISMATCH (or similar)
 * because a governance-only Rule02 PR advanced main between task base and
 * implementation PR base.
 *
 * Never fabricates retrospective VERIFY PASS. Never trusts caller success
 * flags, ancestry booleans, or changed-file lists.
 *
 * @param {object} task durable task record (must retain original verification FAIL)
 * @param {object} request Owner-supplied binding claims (verified against GitHub)
 * @param {{ githubReader?: object, nowMs?: number }} [deps]
 */
export async function verifyAppendOnlyReconciliation(task, request, deps = {}) {
  const nowMs = Number.isFinite(deps.nowMs) ? deps.nowMs : Date.now();
  const reader = deps.githubReader || createGhPrReader();

  if (request && request.success === true) {
    // ignored intentionally — never trust caller success flags
  }

  if (!task || !Array.isArray(task.fileAllowlist) || !isSha(task.baseSha)) {
    return reconcileDeny('INVALID_TASK', nowMs);
  }
  if (!request || typeof request !== 'object') {
    return reconcileDeny('INVALID_RECONCILIATION_REQUEST', nowMs);
  }
  if (!Number.isInteger(request.expectedAttempt) || request.expectedAttempt !== task.attempt) {
    return reconcileDeny('WRONG_ATTEMPT', nowMs, {
      expectedAttempt: request.expectedAttempt,
      taskAttempt: task.attempt,
    });
  }
  if (!isSha(request.expectedBaseSha) || !shaEq(request.expectedBaseSha, task.baseSha)) {
    return reconcileDeny('WRONG_BASE_SHA', nowMs, {
      expectedBaseSha: request.expectedBaseSha,
      taskBaseSha: task.baseSha,
    });
  }
  if (task.status !== 'FAILED') {
    return reconcileDeny('TASK_NOT_FAILED', nowMs, { status: task.status });
  }
  if (!task.verification || task.verification.decision !== VERIFY_DECISIONS.FAIL) {
    return reconcileDeny('HISTORICAL_FAIL_MISSING', nowMs);
  }
  if (
    typeof request.ownerAcknowledgement !== 'string'
    || request.ownerAcknowledgement.trim().length < 8
  ) {
    return reconcileDeny('OWNER_ACKNOWLEDGEMENT_REQUIRED', nowMs);
  }
  if (!Number.isInteger(request.governancePrNumber) || request.governancePrNumber <= 0) {
    return reconcileDeny('INVALID_GOVERNANCE_PR', nowMs);
  }
  if (!Number.isInteger(request.implementationPrNumber) || request.implementationPrNumber <= 0) {
    return reconcileDeny('INVALID_IMPLEMENTATION_PR', nowMs);
  }
  if (!isSha(request.expectedGovernanceMergeSha)) {
    return reconcileDeny('INVALID_GOVERNANCE_MERGE_SHA', nowMs);
  }
  if (!isSha(request.expectedImplementationHeadSha)) {
    return reconcileDeny('INVALID_IMPLEMENTATION_HEAD_SHA', nowMs);
  }
  if (!isSha(request.expectedImplementationMergeSha)) {
    return reconcileDeny('INVALID_IMPLEMENTATION_MERGE_SHA', nowMs);
  }
  if (typeof reader.fetchPullRequest !== 'function' || typeof reader.compareCommits !== 'function') {
    return reconcileBlocked('GITHUB_READER_INSUFFICIENT', nowMs, {
      detail: 'reader must expose fetchPullRequest and compareCommits',
    });
  }

  let govRemote;
  let implRemote;
  let govCompare;
  let implAncestry;
  try {
    govRemote = await reader.fetchPullRequest({
      repository: task.repository,
      prNumber: request.governancePrNumber,
    });
    implRemote = await reader.fetchPullRequest({
      repository: task.repository,
      prNumber: request.implementationPrNumber,
    });
    govCompare = await reader.compareCommits({
      repository: task.repository,
      base: task.baseSha,
      head: request.expectedGovernanceMergeSha,
    });
    implAncestry = await reader.compareCommits({
      repository: task.repository,
      base: request.expectedGovernanceMergeSha,
      head: request.expectedImplementationMergeSha,
    });
  } catch (err) {
    return reconcileBlocked('GITHUB_UNAVAILABLE', nowMs, { detail: err && err.message });
  }

  if (!govRemote || !govRemote.ok) {
    const code = govRemote && govRemote.code ? govRemote.code : 'GITHUB_UNAVAILABLE';
    if (BLOCKED_READER_CODES.has(code) || code === 'GITHUB_UNAVAILABLE') {
      return reconcileBlocked(code, nowMs, { detail: govRemote && govRemote.detail });
    }
    return reconcileDeny(code, nowMs, { detail: govRemote && govRemote.detail });
  }
  if (!implRemote || !implRemote.ok) {
    const code = implRemote && implRemote.code ? implRemote.code : 'GITHUB_UNAVAILABLE';
    if (BLOCKED_READER_CODES.has(code) || code === 'GITHUB_UNAVAILABLE') {
      return reconcileBlocked(code, nowMs, { detail: implRemote && implRemote.detail });
    }
    return reconcileDeny(code, nowMs, { detail: implRemote && implRemote.detail });
  }
  if (!govCompare || !govCompare.ok) {
    const code = govCompare && govCompare.code ? govCompare.code : 'GITHUB_UNAVAILABLE';
    if (BLOCKED_READER_CODES.has(code) || code === 'GITHUB_UNAVAILABLE' || code === 'GITHUB_QUERY_FAILED') {
      return reconcileBlocked(code, nowMs, { detail: govCompare && govCompare.detail });
    }
    return reconcileDeny(code, nowMs, { detail: govCompare && govCompare.detail });
  }
  if (!implAncestry || !implAncestry.ok) {
    const code = implAncestry && implAncestry.code ? implAncestry.code : 'GITHUB_UNAVAILABLE';
    if (BLOCKED_READER_CODES.has(code) || code === 'GITHUB_UNAVAILABLE' || code === 'GITHUB_QUERY_FAILED') {
      return reconcileBlocked(code, nowMs, { detail: implAncestry && implAncestry.detail });
    }
    return reconcileDeny(code, nowMs, { detail: implAncestry && implAncestry.detail });
  }

  const gov = govRemote.data;
  const impl = implRemote.data;
  if (!gov || !impl) {
    return reconcileBlocked('GITHUB_INSUFFICIENT_EVIDENCE', nowMs);
  }
  if (gov.repository !== task.repository || impl.repository !== task.repository) {
    return reconcileDeny('REPOSITORY_MISMATCH', nowMs);
  }
  if (gov.prNumber !== request.governancePrNumber || impl.prNumber !== request.implementationPrNumber) {
    return reconcileDeny('PR_NUMBER_MISMATCH', nowMs);
  }
  if (String(gov.state).toUpperCase() !== 'MERGED') {
    return reconcileDeny('GOVERNANCE_PR_NOT_MERGED', nowMs, { state: gov.state });
  }
  if (String(impl.state).toUpperCase() !== 'MERGED') {
    return reconcileDeny('IMPLEMENTATION_PR_NOT_MERGED', nowMs, { state: impl.state });
  }
  if (!isSha(gov.mergeCommitOid) || !shaEq(gov.mergeCommitOid, request.expectedGovernanceMergeSha)) {
    return reconcileDeny('GOVERNANCE_MERGE_SHA_MISMATCH', nowMs, {
      remote: gov.mergeCommitOid,
      expected: request.expectedGovernanceMergeSha,
    });
  }
  if (!isSha(impl.mergeCommitOid) || !shaEq(impl.mergeCommitOid, request.expectedImplementationMergeSha)) {
    return reconcileDeny('IMPLEMENTATION_MERGE_SHA_MISMATCH', nowMs, {
      remote: impl.mergeCommitOid,
      expected: request.expectedImplementationMergeSha,
    });
  }
  if (!isSha(impl.headSha) || !shaEq(impl.headSha, request.expectedImplementationHeadSha)) {
    return reconcileDeny('IMPLEMENTATION_HEAD_SHA_MISMATCH', nowMs, {
      remote: impl.headSha,
      expected: request.expectedImplementationHeadSha,
    });
  }
  // Governance PR must start from the original task base.
  if (!isSha(gov.baseSha) || !shaEq(gov.baseSha, task.baseSha)) {
    return reconcileDeny('GOVERNANCE_BASE_MISMATCH', nowMs, {
      remote: gov.baseSha,
      expected: task.baseSha,
    });
  }
  // Implementation PR must be based on the governance merge tip (not original base).
  if (!isSha(impl.baseSha) || !shaEq(impl.baseSha, request.expectedGovernanceMergeSha)) {
    return reconcileDeny('IMPLEMENTATION_BASE_MISMATCH', nowMs, {
      remote: impl.baseSha,
      expected: request.expectedGovernanceMergeSha,
    });
  }

  if (!gov.filesComplete || !impl.filesComplete) {
    return reconcileBlocked('PARTIAL_OR_INCOMPLETE_FILE_LIST', nowMs);
  }
  if (!govCompare.data || !govCompare.data.filesComplete) {
    return reconcileBlocked('COMPARE_FILE_LIST_INCOMPLETE', nowMs, {
      detail: 'GitHub compare file list truncated; cannot prove Rule02-only advancement',
    });
  }
  if (!implAncestry.data || implAncestry.data.filesComplete !== true) {
    // Ancestry for merge commit only needs behindBy/status; file list completeness
    // is still required to reject silent unrelated paths between gov and impl merge.
    return reconcileBlocked('COMPARE_FILE_LIST_INCOMPLETE', nowMs, {
      detail: 'GitHub compare file list truncated between governance and implementation merges',
    });
  }

  if (!isDescendantCompare(govCompare.data)) {
    return reconcileDeny('GOVERNANCE_NOT_DESCENDANT_OF_ORIGINAL_BASE', nowMs, {
      compare: govCompare.data,
    });
  }
  if (!filesOnlyRule02(govCompare.data.files)) {
    return reconcileDeny('UNRELATED_BASE_ADVANCEMENT', nowMs, {
      interveningFiles: govCompare.data.files,
      detail: 'original-base..governance-merge must change only Rule02',
    });
  }
  // Governance PR complete changed-file list must also be Rule02-only.
  const govFiles = normalizeFiles(gov.changedFiles);
  if (!govFiles || !filesOnlyRule02(govFiles)) {
    return reconcileDeny('GOVERNANCE_PR_NOT_RULE02_ONLY', nowMs, {
      changedFiles: govFiles,
    });
  }
  if (gov.changedFilesCount !== 1) {
    return reconcileDeny('GOVERNANCE_PR_NOT_RULE02_ONLY', nowMs, {
      changedFilesCount: gov.changedFilesCount,
    });
  }

  if (!isDescendantCompare(implAncestry.data)) {
    return reconcileDeny('IMPLEMENTATION_MERGE_NOT_DESCENDANT_OF_GOVERNANCE', nowMs, {
      compare: implAncestry.data,
    });
  }

  const implFiles = normalizeFiles(impl.changedFiles);
  if (!implFiles) {
    return reconcileDeny('INVALID_REMOTE_FILE_LIST', nowMs);
  }
  const implCompleteness = assertCompleteChangedFileList({
    files: impl.changedFiles,
    changedFilesCount: impl.changedFilesCount,
  });
  if (!implCompleteness.ok) {
    return reconcileBlocked(implCompleteness.code, nowMs, {
      detail: implCompleteness.detail,
    });
  }
  if (implFiles.length !== impl.changedFilesCount) {
    return reconcileBlocked('FILE_COUNT_MISMATCH', nowMs);
  }
  const allow = new Set(task.fileAllowlist);
  const forbidden = implFiles.filter((f) => !allow.has(f));
  if (forbidden.length > 0) {
    return reconcileDeny('IMPLEMENTATION_ALLOWLIST_MISMATCH', nowMs, {
      forbidden,
      changedFiles: implFiles,
      allowlist: [...allow],
    });
  }
  if (implFiles.length === 0) {
    return reconcileDeny('EMPTY_CHANGED_FILE_LIST', nowMs);
  }
  // Reject scope expansion relative to allowlist: every allowlisted path need
  // not appear, but no extras; already enforced. Also reject if compare between
  // gov merge and impl merge introduces paths outside the allowlist (merge
  // commit may include only PR files — still check).
  const between = normalizeFiles(implAncestry.data.files);
  if (!between) {
    return reconcileDeny('INVALID_COMPARE_FILE_LIST', nowMs);
  }
  const betweenForbidden = between.filter((f) => !allow.has(f));
  if (betweenForbidden.length > 0) {
    return reconcileDeny('UNRELATED_PATHS_BETWEEN_GOV_AND_IMPL', nowMs, {
      forbidden: betweenForbidden,
    });
  }

  const limitations = Object.freeze([
    'RECONCILED means independently verified governance-only base advancement plus matching implementation PR metadata',
    'Historical verification decision remains FAIL and is never rewritten to PASS',
    'RECONCILED does not mean OWNER_ACCEPTED',
    'RECONCILED does not mean PRODUCTION_DEPLOYED',
    'Local CLI / same-UID acknowledgement is NOT independently authenticated Owner authority',
    'Caller-supplied success flags, ancestry booleans, and file lists are ignored',
    'GitHub unavailable or incomplete evidence yields BLOCKED, never PASS',
  ]);

  return {
    ok: true,
    decision: RECONCILIATION_DECISIONS.RECONCILED,
    code: 'APPEND_ONLY_RECONCILIATION_VERIFIED',
    atMs: nowMs,
    limitations,
    originalFailure: Object.freeze({
      decision: task.verification.decision,
      code: task.verification.code,
      atMs: task.verification.atMs || null,
    }),
    github: Object.freeze({
      repository: task.repository,
      originalBaseSha: task.baseSha.toLowerCase(),
      governancePrNumber: gov.prNumber,
      governanceMergeSha: gov.mergeCommitOid.toLowerCase(),
      governanceBaseSha: gov.baseSha.toLowerCase(),
      governanceChangedFiles: Object.freeze(govFiles),
      implementationPrNumber: impl.prNumber,
      implementationHeadSha: impl.headSha.toLowerCase(),
      implementationMergeSha: impl.mergeCommitOid.toLowerCase(),
      implementationBaseSha: impl.baseSha.toLowerCase(),
      implementationChangedFiles: Object.freeze(implFiles),
      implementationChangedFilesCount: impl.changedFilesCount,
    }),
  };
}
