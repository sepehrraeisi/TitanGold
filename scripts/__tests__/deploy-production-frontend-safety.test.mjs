import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SCRIPT = fileURLToPath(
  new URL('../deploy-production-frontend.sh', import.meta.url),
);

test('legacy deploy script is a hard refuse, not a live-root build', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(text, /LIVE_WORKTREE_DEPLOY_BUILD_FORBIDDEN/);
  assert.doesNotMatch(text, /^\s*npm\s+run\s+build\b/m);
  assert.doesNotMatch(text, /^\s*npx\s+vite\s+build\b/m);
  assert.doesNotMatch(text, /systemctl\s+reload\s+nginx/);
  assert.doesNotMatch(text, /nginx\s+-s\s+reload/);
  assert.match(text, /release-frontend-build\.sh/);
  assert.match(text, /activate-frontend-dist\.sh/);

  const r = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED: LIVE_WORKTREE_DEPLOY_BUILD_FORBIDDEN/);
});

test('release and activate scripts never default outDir to live nginx dist', () => {
  const release = fs.readFileSync(
    path.join(path.dirname(SCRIPT), 'release-frontend-build.sh'),
    'utf8',
  );
  const activate = fs.readFileSync(
    path.join(path.dirname(SCRIPT), 'activate-frontend-dist.sh'),
    'utf8',
  );
  assert.match(release, /TITANGOLD_VITE_OUTDIR/);
  assert.match(release, /releases\/titangold/);
  assert.match(release, /LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN/);
  assert.doesNotMatch(release, /systemctl\s+reload\s+nginx/);
  assert.match(activate, /BACKUP_OK|Would backup/);
  assert.match(activate, /TITANGOLD_CONFIRM_DIST_ACTIVATE/);
  assert.match(activate, /ROLLBACK/);
});
