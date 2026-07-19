/**
 * Canonical runtime provenance for health/readiness observability.
 *
 * Priority:
 * 1. Explicit deploy-time env (TITAN_RUNTIME_COMMIT / GIT_COMMIT / GIT_SHA)
 * 2. Git HEAD from the TitanGold repository root (parent of backend/)
 * 3. Git HEAD from process.cwd()
 * 4. "unknown"
 *
 * Does not read secrets. Does not perform network I/O beyond local git.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_KEYS = ['TITAN_RUNTIME_COMMIT', 'GIT_COMMIT', 'GIT_SHA'];

function normalizeCommit(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  // Accept short or full hex SHAs only — reject accidental secrets/paths.
  if (!/^[0-9a-f]{7,40}$/i.test(value)) return null;
  return value.toLowerCase();
}

function shortSha(sha) {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function isGitDir(dir) {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

function resolveRepoRoots() {
  const roots = [];
  // backend/utils → backend → repo root
  const fromModule = path.resolve(__dirname, '../..');
  roots.push(fromModule);
  try {
    roots.push(process.cwd());
  } catch {
    /* ignore */
  }
  return [...new Set(roots)];
}

function gitShortHead(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return normalizeCommit(out);
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ gitShortHeadFn?: (cwd: string) => string|null, roots?: string[] }} [deps]
 */
export function resolveRuntimeProvenance(env = process.env, deps = {}) {
  for (const key of ENV_KEYS) {
    const normalized = normalizeCommit(env[key]);
    if (normalized) {
      return {
        commit: shortSha(normalized),
        fullCommit: normalized.length >= 40 ? normalized : null,
        source: `env:${key}`,
      };
    }
  }

  const gitFn = deps.gitShortHeadFn || gitShortHead;
  const roots = deps.roots || resolveRepoRoots();
  const requireGitDir = deps.gitShortHeadFn ? false : true;
  for (const root of roots) {
    if (!root) continue;
    if (requireGitDir && !isGitDir(root)) continue;
    const sha = gitFn(root);
    if (sha) {
      return {
        commit: shortSha(sha),
        fullCommit: null,
        source: `git:${root}`,
      };
    }
  }

  return {
    commit: 'unknown',
    fullCommit: null,
    source: 'unavailable',
  };
}

let cached = null;

/**
 * Cached at first call for production env (no injectable deps).
 * Tests may call resetRuntimeProvenanceCache().
 */
export function getRuntimeProvenance(env = process.env, deps = {}) {
  const injectable = Boolean(deps.gitShortHeadFn || deps.roots);
  if (!injectable && cached) return cached;
  const resolved = resolveRuntimeProvenance(env, deps);
  if (!injectable) cached = resolved;
  return resolved;
}

export function resetRuntimeProvenanceCache() {
  cached = null;
}

export function getRuntimeCommitShort(env = process.env, deps = {}) {
  return getRuntimeProvenance(env, deps).commit;
}
