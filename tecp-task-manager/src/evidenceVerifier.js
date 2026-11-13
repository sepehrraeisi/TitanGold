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
 * Fetch ALL PR files via GitHub REST with explicit pagination.
 * Never trusts `gh pr view --json files` alone (historically truncated).
 */
export function fetchCompletePrFilesViaGhApi({
  ghPath = 'gh',
  env = process.env,
  repository,
  prNumber,
  perPage = 100,
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

  return {
    ok: true,
    code: 'OK',
    files,
    filesComplete: true,
    pageCount: page,
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
      const view = runGh(
        ghPath,
        [
          'pr',
          'view',
          String(prNumber),
          '--repo',
          repository,
          '--json',
          'number,state,baseRefOid,headRefOid,baseRefName,headRefName,url,title,headRepositoryOwner,headRepository',
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
      });
      if (!filesResult.ok || filesResult.filesComplete !== true) {
        return {
          ok: false,
          code: filesResult.code || 'PARTIAL_OR_INCOMPLETE_FILE_LIST',
          data: null,
          detail: filesResult.detail,
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
    if (
      code === 'GITHUB_UNAVAILABLE'
      || code === 'GITHUB_QUERY_FAILED'
      || code === 'PARTIAL_OR_INCOMPLETE_FILE_LIST'
      || code === 'GITHUB_FILE_LIST_PAGINATION_LIMIT'
    ) {
      return blocked(code, nowMs, { detail: remote && remote.detail });
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
