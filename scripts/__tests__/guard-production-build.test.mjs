import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  evaluateGuard,
  REFUSAL,
  isApplicationSourcePath,
} from '../guard-production-build.mjs';

const GUARD = fileURLToPath(new URL('../guard-production-build.mjs', import.meta.url));

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function gitEnv() {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'BuildGuardTest',
    GIT_AUTHOR_EMAIL: 'build-guard-test@example.com',
    GIT_COMMITTER_NAME: 'BuildGuardTest',
    GIT_COMMITTER_EMAIL: 'build-guard-test@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: os.tmpdir(),
  };
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r;
}

function initRepo(dir) {
  git(dir, ['init', '-b', 'main']);
  write(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}\n');
  write(path.join(dir, 'README.md'), 'fixture\n');
  git(dir, ['add', 'package-lock.json', 'README.md']);
  git(dir, ['commit', '-m', 'init']);
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

function writeRoots(dir, extra = {}) {
  const cfg = {
    version: 1,
    productionSourceRoots: extra.productionSourceRoots || [],
    liveNginxDistRoots: extra.liveNginxDistRoots || [],
    markerFileName: '.titangold-production-root',
  };
  const p = path.join(dir, 'deploy', 'production-roots.json');
  write(p, JSON.stringify(cfg, null, 2));
  return p;
}

test('isApplicationSourcePath classifies frontend graph files', () => {
  assert.equal(isApplicationSourcePath('components/Foo.tsx'), true);
  assert.equal(isApplicationSourcePath('App.tsx'), true);
  assert.equal(isApplicationSourcePath('vite.config.ts'), true);
  assert.equal(isApplicationSourcePath('node_modules/x.js'), false);
  assert.equal(isApplicationSourcePath('dist/index.html'), false);
});

test('1. dirty release worktree is refused', () => {
  const dir = mkTmp('tg-guard-dirty-');
  initRepo(dir);
  write(path.join(dir, 'README.md'), 'dirty\n');
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: path.join(dir, 'release-dist'),
    release: true,
    configPath: writeRoots(dir),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.RELEASE_WORKTREE_DIRTY);
  assert.match(result.message, /^REFUSED: RELEASE_WORKTREE_DIRTY/);
});

test('2. production root build is refused even without --release', () => {
  const dir = mkTmp('tg-guard-prodroot-');
  initRepo(dir);
  const cfg = writeRoots(dir, { productionSourceRoots: [dir] });
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: path.join(os.tmpdir(), 'tg-nonlive-dist'),
    release: false,
    configPath: cfg,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.PRODUCTION_WORKTREE_BUILD_FORBIDDEN);
});

test('3. live-root outDir is refused', () => {
  const dir = mkTmp('tg-guard-liveroot-');
  initRepo(dir);
  const live = path.join(dir, 'nginx-live');
  fs.mkdirSync(live);
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: live,
    release: false,
    configPath: writeRoots(dir, { liveNginxDistRoots: [live] }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN);
});

test('4. untracked application source refuses release builds', () => {
  const dir = mkTmp('tg-guard-untracked-');
  initRepo(dir);
  write(path.join(dir, 'components', 'NewPanel.tsx'), 'export default function X(){return null}\n');
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: path.join(dir, 'release-dist'),
    release: true,
    configPath: writeRoots(dir),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.UNTRACKED_SOURCE_IN_RELEASE);
});

test('5. missing provenance refuses release builds', () => {
  const dir = mkTmp('tg-guard-noprov-');
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: path.join(dir, 'release-dist'),
    release: true,
    gitHead: '',
    gitPorcelain: '',
    lockfileSha: 'abc',
    configPath: writeRoots(dir),
    config: {
      productionSourceRoots: [],
      liveNginxDistRoots: [],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.SOURCE_PROVENANCE_UNRESOLVED);
});

test('5b. missing lockfile refuses release builds', () => {
  const dir = mkTmp('tg-guard-nolock-');
  git(dir, ['init', '-b', 'main']);
  write(path.join(dir, 'README.md'), 'x\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-m', 'init']);
  const result = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir: path.join(dir, 'release-dist'),
    release: true,
    configPath: writeRoots(dir),
    config: {
      productionSourceRoots: [],
      liveNginxDistRoots: [],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFUSAL.LOCKFILE_PROVENANCE_UNRESOLVED);
});

test('6. clean isolated non-live development/release fixture is allowed', () => {
  const dir = mkTmp('tg-guard-allow-');
  initRepo(dir);
  const outDir = path.join(dir, 'non-live-dist');
  const dev = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir,
    release: false,
    configPath: writeRoots(dir),
  });
  assert.equal(dev.ok, true, dev.message);
  const rel = evaluateGuard({
    cwd: dir,
    gitToplevel: dir,
    outDir,
    release: true,
    configPath: writeRoots(dir),
  });
  assert.equal(rel.ok, true, rel.message);
  assert.match(rel.gitHead, /^[0-9a-f]{40}$/i);
});

test('B8 incident regression: production root + nginx=dist + dirty source fails BEFORE dist write', () => {
  const prod = mkTmp('tg-incident-prod-');
  initRepo(prod);
  const liveDist = path.join(prod, 'dist');
  fs.mkdirSync(liveDist);
  const canaryPath = path.join(liveDist, 'canary.txt');
  write(canaryPath, 'LIVE_CANARY_UNTOUCHED\n');
  write(path.join(prod, 'App.tsx'), 'export default function Dirty(){return null}\n');
  const cfg = writeRoots(prod, {
    productionSourceRoots: [prod],
    liveNginxDistRoots: [liveDist],
  });

  const poison = path.join(prod, 'poison-write.mjs');
  write(
    poison,
    `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join('dist', 'poisoned-by-vite.txt'), 'SHOULD_NOT_EXIST');
`,
  );

  const wrapped = spawnSync(
    process.execPath,
    [
      '-e',
      `import {spawnSync} from 'node:child_process';
const g = spawnSync(process.execPath, ${JSON.stringify([GUARD])}, {stdio:'inherit'});
if (g.status) process.exit(g.status);
const p = spawnSync(process.execPath, ${JSON.stringify([poison])}, {stdio:'inherit'});
process.exit(p.status ?? 1);`,
    ],
    {
      cwd: prod,
      env: {
        ...process.env,
        TITANGOLD_PRODUCTION_ROOTS_CONFIG: cfg,
      },
      encoding: 'utf8',
    },
  );

  assert.notEqual(wrapped.status, 0, `expected non-zero, got ${wrapped.status}\n${wrapped.stderr}\n${wrapped.stdout}`);
  assert.match(
    `${wrapped.stderr}\n${wrapped.stdout}`,
    /REFUSED: (LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN|PRODUCTION_WORKTREE_BUILD_FORBIDDEN)/,
  );
  assert.equal(fs.readFileSync(canaryPath, 'utf8'), 'LIVE_CANARY_UNTOUCHED\n');
  assert.equal(fs.existsSync(path.join(liveDist, 'poisoned-by-vite.txt')), false);

  const unit = evaluateGuard({
    cwd: prod,
    gitToplevel: prod,
    outDir: liveDist,
    release: false,
    configPath: cfg,
  });
  assert.equal(unit.ok, false);
  assert.equal(unit.code, REFUSAL.LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN);
});

test('CLI incident: guard exits 2 and does not need Vite', () => {
  const prod = mkTmp('tg-incident-cli-');
  initRepo(prod);
  const liveDist = path.join(prod, 'dist');
  fs.mkdirSync(liveDist);
  write(path.join(liveDist, 'index.html'), '<html>live</html>');
  const cfg = writeRoots(prod, {
    productionSourceRoots: [prod],
    liveNginxDistRoots: [liveDist],
  });
  const r = spawnSync(process.execPath, [GUARD], {
    cwd: prod,
    env: { ...process.env, TITANGOLD_PRODUCTION_ROOTS_CONFIG: cfg },
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED: LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN/);
});
