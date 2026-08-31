#!/usr/bin/env node
/**
 * TitanGold production / release frontend build guard (Core Rule §109).
 *
 * Wired into `npm run build` and Vite `apply: 'build'` so a casual
 * `vite build` cannot silently skip the npm script wrapper.
 *
 * Never rely on an unsettable skip env var. Live nginx outDir cannot be
 * bypassed. Emergency Owner file may only allow a production-worktree
 * build into a NON-live outDir.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REFUSAL = Object.freeze({
  PRODUCTION_WORKTREE_BUILD_FORBIDDEN: 'PRODUCTION_WORKTREE_BUILD_FORBIDDEN',
  LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN: 'LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN',
  RELEASE_WORKTREE_DIRTY: 'RELEASE_WORKTREE_DIRTY',
  UNTRACKED_SOURCE_IN_RELEASE: 'UNTRACKED_SOURCE_IN_RELEASE',
  SOURCE_PROVENANCE_UNRESOLVED: 'SOURCE_PROVENANCE_UNRESOLVED',
  LOCKFILE_PROVENANCE_UNRESOLVED: 'LOCKFILE_PROVENANCE_UNRESOLVED',
});

const BUILTIN_PRODUCTION_SOURCE_ROOTS = Object.freeze([
  '/home/ubuntu/webapp/TitanGold',
]);
const BUILTIN_LIVE_NGINX_DIST_ROOTS = Object.freeze([
  '/home/ubuntu/webapp/TitanGold/dist',
]);

const APP_SOURCE_PREFIXES = Object.freeze([
  'components/',
  'services/',
  'hooks/',
  'utils/',
  'types/',
  'src/',
  'pages/',
  'public/',
  'App.tsx',
  'App.jsx',
  'main.tsx',
  'main.jsx',
  'index.tsx',
  'index.jsx',
  'index.html',
  'types.ts',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]);

const ROOT_APP_FILES = Object.freeze([
  'App.tsx',
  'App.jsx',
  'main.tsx',
  'main.jsx',
  'index.tsx',
  'index.jsx',
  'index.html',
  'types.ts',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]);

function refused(code, detail) {
  return {
    ok: false,
    code,
    message: `REFUSED: ${code}${detail ? `\n${detail}` : ''}`,
  };
}

function ok(extra = {}) {
  return { ok: true, code: null, message: null, ...extra };
}

export function realpathOrResolve(p, { exists = fs.existsSync, realpath = fs.realpathSync } = {}) {
  if (!p) return p;
  const resolved = path.resolve(p);
  try {
    if (exists(resolved)) return realpath(resolved);
  } catch {
    /* fall through */
  }
  return resolved;
}

export function isSameOrInside(candidate, parent, io = {}) {
  const c = realpathOrResolve(candidate, io);
  const p = realpathOrResolve(parent, io);
  if (!c || !p) return false;
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}

export function isApplicationSourcePath(relPath) {
  const n = String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/$/, '');
  if (!n) return false;
  if (
    n.startsWith('node_modules/') ||
    n === 'node_modules' ||
    n.startsWith('dist/') ||
    n === 'dist' ||
    n.startsWith('.git/') ||
    n.startsWith('coverage/')
  ) {
    return false;
  }
  if (ROOT_APP_FILES.includes(n)) return true;
  const base = n.split('/').pop();
  if (n === base && /^vite\.config\.(ts|js|mjs|cjs)$/.test(base)) return true;
  return APP_SOURCE_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return n === prefix.slice(0, -1) || n.startsWith(prefix);
    return n === prefix || n.startsWith(`${prefix}/`);
  });
}

function parsePorcelain(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter(Boolean);
  const trackedDirty = [];
  const untracked = [];
  for (const line of lines) {
    if (line.startsWith('?? ')) {
      untracked.push(line.slice(3).trim());
      continue;
    }
    const pathPart = line.length >= 3 ? line.slice(3).trim() : line;
    if (pathPart) trackedDirty.push(pathPart.split(' -> ').pop());
  }
  return { trackedDirty, untracked, raw: lines };
}

function gitCapture(cwd, args) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function loadProductionRootsConfig(configPath, { readFile = fs.readFileSync, exists = fs.existsSync } = {}) {
  if (!configPath || !exists(configPath)) {
    return {
      productionSourceRoots: [...BUILTIN_PRODUCTION_SOURCE_ROOTS],
      liveNginxDistRoots: [...BUILTIN_LIVE_NGINX_DIST_ROOTS],
      markerFileName: '.titangold-production-root',
      emergencyAuthorizationFile: 'deploy/EMERGENCY_LIVE_BUILD.authorized',
      source: 'builtin',
    };
  }
  const parsed = JSON.parse(readFile(configPath, 'utf8'));
  const productionSourceRoots = [
    ...new Set([
      ...BUILTIN_PRODUCTION_SOURCE_ROOTS,
      ...(parsed.productionSourceRoots || []),
    ]),
  ];
  const liveNginxDistRoots = [
    ...new Set([
      ...BUILTIN_LIVE_NGINX_DIST_ROOTS,
      ...(parsed.liveNginxDistRoots || []),
    ]),
  ];
  return {
    productionSourceRoots,
    liveNginxDistRoots,
    markerFileName: parsed.markerFileName || '.titangold-production-root',
    emergencyAuthorizationFile:
      parsed.emergencyAuthorizationFile || 'deploy/EMERGENCY_LIVE_BUILD.authorized',
    releaseStagingRootDefault: parsed.releaseStagingRootDefault,
    source: configPath,
  };
}

function resolveConfigPath({ cwd, gitToplevel, configPath, env = process.env }) {
  if (configPath) return configPath;
  if (env.TITANGOLD_PRODUCTION_ROOTS_CONFIG) return env.TITANGOLD_PRODUCTION_ROOTS_CONFIG;
  const root = gitToplevel || cwd;
  return path.join(root, 'deploy', 'production-roots.json');
}

function emergencyBypassAllowsProductionWorktree({ gitToplevel, cwd, config, env, exists, readFile }) {
  const rel = config.emergencyAuthorizationFile || 'deploy/EMERGENCY_LIVE_BUILD.authorized';
  const filePath = path.isAbsolute(rel) ? rel : path.join(gitToplevel || cwd, rel);
  if (!exists(filePath)) return { allowed: false, reason: 'ABSENT' };
  const runId = String(env.TITANGOLD_EMERGENCY_LIVE_BUILD_RUN_ID || '').trim();
  if (!runId) return { allowed: false, reason: 'RUN_ID_MISSING' };
  let body = '';
  try {
    body = readFile(filePath, 'utf8');
  } catch {
    return { allowed: false, reason: 'UNREADABLE' };
  }
  const authorized = /^AUTHORIZED\s*=\s*YES\s*$/m.test(body);
  const fileRun = (body.match(/^RUN_ID\s*=\s*(\S+)\s*$/m) || [])[1] || '';
  if (!authorized || fileRun !== runId) return { allowed: false, reason: 'MISMATCH' };
  return { allowed: true, reason: 'OWNER_EMERGENCY_FILE', filePath };
}

/**
 * @returns {{ok:boolean, code:string|null, message:string|null}}
 */
export function evaluateGuard(options = {}) {
  const exists = options.exists || fs.existsSync;
  const realpath = options.realpath || fs.realpathSync;
  const readFile = options.readFile || fs.readFileSync;
  const io = { exists, realpath };
  const env = options.env || process.env;
  const cwd = realpathOrResolve(options.cwd || process.cwd(), io);
  const release =
    options.release !== undefined
      ? Boolean(options.release)
      : env.TITANGOLD_RELEASE_BUILD === '1' ||
        (Array.isArray(options.argv) && options.argv.includes('--release'));

  let gitToplevel = options.gitToplevel;
  if (gitToplevel === undefined) {
    const r = gitCapture(cwd, ['rev-parse', '--show-toplevel']);
    gitToplevel = r.status === 0 ? r.stdout.trim() : cwd;
  }
  gitToplevel = realpathOrResolve(gitToplevel || cwd, io);

  const configPath = resolveConfigPath({
    cwd,
    gitToplevel,
    configPath: options.configPath,
    env,
  });
  const config = options.config || loadProductionRootsConfig(configPath, { readFile, exists });

  const defaultOutDir = path.resolve(cwd, 'dist');
  const outDir = realpathOrResolve(
    options.outDir || env.TITANGOLD_VITE_OUTDIR || defaultOutDir,
    io,
  );

  const markerName = config.markerFileName || '.titangold-production-root';
  const markerHits = [cwd, gitToplevel]
    .filter(Boolean)
    .some((root) => exists(path.join(root, markerName)));

  const productionWorktree =
    markerHits ||
    (config.productionSourceRoots || []).some(
      (root) => isSameOrInside(cwd, root, io) || isSameOrInside(gitToplevel, root, io),
    );

  const liveNginxHit = (config.liveNginxDistRoots || []).some(
    (root) => isSameOrInside(outDir, root, io),
  );

  // B always wins — never bypass live nginx output.
  if (liveNginxHit) {
    return refused(
      REFUSAL.LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN,
      `outDir=${outDir}\nlive nginx root match. Build into a non-live staging directory.`,
    );
  }

  if (productionWorktree) {
    const emergency = emergencyBypassAllowsProductionWorktree({
      gitToplevel,
      cwd,
      config,
      env,
      exists,
      readFile,
    });
    if (!emergency.allowed) {
      return refused(
        REFUSAL.PRODUCTION_WORKTREE_BUILD_FORBIDDEN,
        `cwd=${cwd}\ngitToplevel=${gitToplevel}\nBuilding from a production-serving worktree is forbidden.`,
      );
    }
  }

  if (!release) {
    return ok({ cwd, outDir, gitToplevel, release: false });
  }

  let gitHead = options.gitHead;
  if (gitHead === undefined) {
    const r = gitCapture(gitToplevel, ['rev-parse', 'HEAD']);
    gitHead = r.status === 0 ? r.stdout.trim() : '';
  }
  if (!gitHead || !/^[0-9a-f]{40}$/i.test(gitHead)) {
    return refused(
      REFUSAL.SOURCE_PROVENANCE_UNRESOLVED,
      'Release builds require a resolvable 40-character commit SHA.',
    );
  }

  const lockfilePath =
    options.lockfilePath || path.join(gitToplevel, 'package-lock.json');
  let lockfileSha = options.lockfileSha;
  if (lockfileSha === undefined) {
    if (!exists(lockfilePath)) {
      return refused(
        REFUSAL.LOCKFILE_PROVENANCE_UNRESOLVED,
        `Missing lockfile: ${lockfilePath}`,
      );
    }
    try {
      lockfileSha = sha256File(lockfilePath);
    } catch {
      return refused(REFUSAL.LOCKFILE_PROVENANCE_UNRESOLVED, lockfilePath);
    }
  }
  if (!lockfileSha) {
    return refused(REFUSAL.LOCKFILE_PROVENANCE_UNRESOLVED, lockfilePath);
  }

  let porcelain = options.gitPorcelain;
  if (porcelain === undefined) {
    const r = gitCapture(gitToplevel, ['status', '--porcelain']);
    porcelain = r.status === 0 ? r.stdout : null;
    if (porcelain === null) {
      return refused(REFUSAL.SOURCE_PROVENANCE_UNRESOLVED, 'git status --porcelain failed');
    }
  }
  const { trackedDirty, untracked } = parsePorcelain(porcelain);
  if (trackedDirty.length > 0) {
    return refused(
      REFUSAL.RELEASE_WORKTREE_DIRTY,
      `Dirty tracked paths (${trackedDirty.length}): ${trackedDirty.slice(0, 8).join(', ')}`,
    );
  }
  const untrackedSource = untracked.filter(isApplicationSourcePath);
  if (untrackedSource.length > 0) {
    return refused(
      REFUSAL.UNTRACKED_SOURCE_IN_RELEASE,
      `Untracked application source: ${untrackedSource.slice(0, 8).join(', ')}`,
    );
  }

  return ok({
    cwd,
    outDir,
    gitToplevel,
    release: true,
    gitHead,
    lockfileSha,
  });
}

export function formatRefusal(result) {
  return result.message || `REFUSED: ${result.code}`;
}

export function runGuardCli(argv = process.argv.slice(2), env = process.env) {
  const release = argv.includes('--release') || env.TITANGOLD_RELEASE_BUILD === '1';
  const result = evaluateGuard({ argv, env, release, cwd: process.cwd() });
  if (!result.ok) {
    process.stderr.write(`${formatRefusal(result)}\n`);
    process.exitCode = 2;
    return result;
  }
  process.stderr.write(
    `[titangold-build-guard] PASS release=${release} outDir=${result.outDir}\n`,
  );
  return result;
}

export function titangoldProductionBuildGuardPlugin() {
  return {
    name: 'titangold-production-build-guard',
    apply: 'build',
    configResolved(config) {
      const release =
        process.env.TITANGOLD_RELEASE_BUILD === '1' ||
        process.argv.includes('--release');
      const outDir = path.resolve(config.root, config.build.outDir || 'dist');
      const result = evaluateGuard({
        cwd: config.root,
        outDir,
        release,
        argv: process.argv,
        env: process.env,
      });
      if (!result.ok) {
        throw new Error(formatRefusal(result));
      }
    },
  };
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  runGuardCli();
  if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
}
