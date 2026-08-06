import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSafeFixtureIdentity,
  assertCanonicalStagingDeployEnv,
} from '../../../backend/scripts/e2eFixtureSafety.js';
import {
  MARKER_STATE_PENDING,
  MARKER_STATE_PROMOTED,
  cleanupPromotedFixture,
  prepareTrendStagingFixture,
  recoverUnresolvedPromotionMarker,
  runNodeScript,
  writePromotionMarker,
} from '../../../e2e/fixtureProcess.mjs';

const BACKEND_DIR = path.resolve(__dirname, '../../../backend');
const SAFE_ID = '11111111-2222-4333-a444-555555555555';
const OTHER_ID = 'aaaaaaaa-2222-4333-a444-555555555555';

const BASE_ENV = {
  TITAN_DEPLOY_ENV: 'staging',
  TITAN_E2E_TARGET_ENV: 'staging',
  TITAN_E2E_BACKEND_DIR: BACKEND_DIR,
  TITAN_E2E_FIXTURE_USERNAME: 'e2e_trend_fixture',
  TITAN_E2E_FIXTURE_EMAIL: 'e2e-trend-fixture@titangold.test',
  TITAN_E2E_FIXTURE_OWNER: 'trend-pr18',
};

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-e2e-fixture-'));
  return {
    dir,
    envOut: path.join(dir, 'playwright.env'),
    markerPath: path.join(dir, 'promotion.json'),
  };
}

function writeEnvOut(envOut: string, overrides: Record<string, string> = {}) {
  fs.writeFileSync(
    envOut,
    [
      'PLAYWRIGHT_LOGIN_USER=e2e_trend_fixture',
      'PLAYWRIGHT_LOGIN_PASSWORD=secret-must-not-persist',
      `TITAN_E2E_FIXTURE_USER_ID=${SAFE_ID}`,
      'TITAN_E2E_FIXTURE_OWNER=trend-pr18',
      'TITAN_E2E_FIXTURE_EMAIL=e2e-trend-fixture@titangold.test',
      'TITAN_E2E_TARGET_ENV=staging',
      '',
    ]
      .map((line) => {
        const key = line.split('=')[0];
        if (key && overrides[key] != null) return `${key}=${overrides[key]}`;
        return line;
      })
      .join('\n'),
    { mode: 0o600 },
  );
}

function mockPrepareAndPromote(envOut: string, options: { failOnPromote?: boolean } = {}) {
  return vi.fn(({ scriptPath }) => {
    if (String(scriptPath).includes('prepare_login_e2e_fixture')) {
      writeEnvOut(envOut);
      return;
    }
    if (String(scriptPath).includes('promote_e2e_fixture_trader')) {
      if (options.failOnPromote) {
        throw new Error('promote failed after pending marker');
      }
      return;
    }
    if (String(scriptPath).includes('cleanup_e2e_fixture_role')) {
      return;
    }
    throw new Error(`unexpected script ${scriptPath}`);
  });
}

describe('shell-free e2e fixture process', () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const dir of temps.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects quote/semicolon/dollar/backtick/newline before any child process', () => {
    const run = vi.fn();
    const attacks = [
      { TITAN_E2E_FIXTURE_USERNAME: 'e2e_"x"' },
      { TITAN_E2E_FIXTURE_USERNAME: 'e2e_x;id' },
      { TITAN_E2E_FIXTURE_EMAIL: 'e2e-$(id)@titangold.test' },
      { TITAN_E2E_FIXTURE_OWNER: 'trend`id`' },
      { TITAN_E2E_FIXTURE_USERNAME: 'e2e_x\nid' },
    ];

    for (const patch of attacks) {
      expect(() =>
        prepareTrendStagingFixture({
          run,
          env: { ...BASE_ENV, ...patch },
        }),
      ).toThrow();
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('runNodeScript requires argv array and never builds a shell command string', () => {
    const execFile = vi.fn().mockReturnValue(Buffer.from(''));

    expect(() =>
      // @ts-expect-error intentional invalid call
      runNodeScript({
        scriptPath: path.join(BACKEND_DIR, 'scripts', 'prepare_login_e2e_fixture.js'),
        cwd: BACKEND_DIR,
        args: 'node -e "process.exit(1)"',
        execFile,
      }),
    ).toThrow(/explicit array/);
    expect(execFile).not.toHaveBeenCalled();

    runNodeScript({
      scriptPath: path.join(BACKEND_DIR, 'scripts', 'prepare_login_e2e_fixture.js'),
      cwd: BACKEND_DIR,
      args: ['--fixture-username', 'e2e_trend_fixture', '--fixture-email', 'e2e-trend@titangold.test'],
      execFile,
    });

    expect(execFile).toHaveBeenCalledTimes(1);
    const [execPath, argv, options] = execFile.mock.calls[0];
    expect(execPath).toBe(process.execPath);
    expect(Array.isArray(argv)).toBe(true);
    expect(options).toMatchObject({ shell: false });
  });

  it('metacharacter fixture values are rejected by identity validation', () => {
    const payloads = [
      { username: 'e2e_"evil"', email: 'ok@titangold.test', owner: 'trend-pr18' },
      { username: 'e2e_x;rm', email: 'ok@titangold.test', owner: 'trend-pr18' },
      { username: 'e2e_ok_user', email: 'e2e-$(whoami)@titangold.test', owner: 'trend-pr18' },
      { username: 'e2e_ok_user', email: 'ok@titangold.test', owner: 'trend`id`' },
      { username: 'e2e_x\nrm', email: 'ok@titangold.test', owner: 'trend-pr18' },
    ];
    for (const payload of payloads) {
      expect(() => assertSafeFixtureIdentity(payload)).toThrow();
    }
  });

  it('setup failure before promotion does not write a promotion marker', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    const run = vi.fn(() => {
      throw new Error('prepare failed before promotion');
    });

    expect(() =>
      prepareTrendStagingFixture({
        run,
        envOut,
        markerPath,
        env: BASE_ENV,
      }),
    ).toThrow(/prepare failed/);
    expect(fs.existsSync(markerPath)).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('successful promotion writes promoted non-secret marker and cleanup removes it', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    const run = mockPrepareAndPromote(envOut);

    prepareTrendStagingFixture({
      run,
      envOut,
      markerPath,
      env: BASE_ENV,
    });

    expect(fs.existsSync(markerPath)).toBe(true);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.state).toBe(MARKER_STATE_PROMOTED);
    expect(marker.fixtureUserId).toBe(SAFE_ID);
    expect(marker.password).toBeUndefined();
    expect(JSON.stringify(marker)).not.toContain('secret-must-not-persist');

    const cleanupRun = vi.fn();
    const cleaned = cleanupPromotedFixture({
      run: cleanupRun,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.previousState).toBe(MARKER_STATE_PROMOTED);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('cleanup no-ops when no promotion marker exists', () => {
    const { dir, markerPath } = tempPaths();
    temps.push(dir);
    const run = vi.fn();
    const result = cleanupPromotedFixture({
      run,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(result).toEqual({ cleaned: false, reason: 'no_promotion_marker' });
    expect(run).not.toHaveBeenCalled();
  });

  it('promotion marker with missing identity fails loudly', () => {
    const { dir, markerPath } = tempPaths();
    temps.push(dir);
    fs.writeFileSync(markerPath, JSON.stringify({ username: 'e2e_trend_fixture' }), 'utf8');
    expect(() =>
      cleanupPromotedFixture({
        run: vi.fn(),
        markerPath,
        env: { TITAN_DEPLOY_ENV: 'staging' },
      }),
    ).toThrow(/missing required identity field/);
  });

  it('cleanup cannot retarget a different fixture than the marker', () => {
    const { dir, markerPath } = tempPaths();
    temps.push(dir);
    writePromotionMarker(
      {
        fixtureUserId: SAFE_ID,
        username: 'e2e_trend_fixture',
        email: 'e2e-trend-fixture@titangold.test',
        owner: 'trend-pr18',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PROMOTED,
      },
      markerPath,
    );
    const run = vi.fn();
    cleanupPromotedFixture({
      run,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(run.mock.calls[0][0].args[1]).toBe(SAFE_ID);
    expect(run.mock.calls[0][0].args[3]).toBe('e2e_trend_fixture');
    expect(run.mock.calls[0][0].args).not.toContain('e2e_other_fixture');
  });

  it('rejects production and missing deploy env before mutation', () => {
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: 'production' }),
    ).toThrow(/production/);
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: undefined }),
    ).toThrow(/TITAN_DEPLOY_ENV is required/);
  });
});

describe('promotion marker crash-safety', () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const dir of temps.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('existing promoted marker is never silently deleted', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    writePromotionMarker(
      {
        fixtureUserId: SAFE_ID,
        username: 'e2e_trend_fixture',
        email: 'e2e-trend-fixture@titangold.test',
        owner: 'trend-pr18',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PROMOTED,
      },
      markerPath,
    );

    const run = vi.fn(({ scriptPath }) => {
      if (String(scriptPath).includes('cleanup_e2e_fixture_role')) {
        throw new Error('cleanup refused');
      }
      throw new Error(`unexpected script ${scriptPath}`);
    });

    expect(() =>
      prepareTrendStagingFixture({
        run,
        envOut,
        markerPath,
        env: BASE_ENV,
      }),
    ).toThrow(/cleanup refused/);

    expect(fs.existsSync(markerPath)).toBe(true);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.state).toBe(MARKER_STATE_PROMOTED);
    expect(marker.fixtureUserId).toBe(SAFE_ID);
    // Prepare/promote must not run while unresolved marker remains.
    expect(
      run.mock.calls.some((c) => String(c[0].scriptPath).includes('prepare_login_e2e_fixture')),
    ).toBe(false);
  });

  it('existing pending marker is cleaned before new setup', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    writePromotionMarker(
      {
        fixtureUserId: OTHER_ID,
        username: 'e2e_prior_fixture',
        email: 'e2e-prior-fixture@titangold.test',
        owner: 'trend-prior',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PENDING,
      },
      markerPath,
    );

    const cleanupIds: string[] = [];
    const run = vi.fn(({ scriptPath, args }) => {
      if (String(scriptPath).includes('cleanup_e2e_fixture_role')) {
        cleanupIds.push(args[1]);
        return;
      }
      if (String(scriptPath).includes('prepare_login_e2e_fixture')) {
        writeEnvOut(envOut);
        return;
      }
      if (String(scriptPath).includes('promote_e2e_fixture_trader')) {
        return;
      }
      throw new Error(`unexpected script ${scriptPath}`);
    });

    prepareTrendStagingFixture({
      run,
      envOut,
      markerPath,
      env: BASE_ENV,
    });

    expect(cleanupIds).toEqual([OTHER_ID]);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.state).toBe(MARKER_STATE_PROMOTED);
    expect(marker.fixtureUserId).toBe(SAFE_ID);
  });

  it('promotion fails after pending marker creation: marker remains and teardown cleans it', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    const run = mockPrepareAndPromote(envOut, { failOnPromote: true });

    expect(() =>
      prepareTrendStagingFixture({
        run,
        envOut,
        markerPath,
        env: BASE_ENV,
      }),
    ).toThrow(/promote failed after pending marker/);

    expect(fs.existsSync(markerPath)).toBe(true);
    const pending = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(pending.state).toBe(MARKER_STATE_PENDING);
    expect(pending.fixtureUserId).toBe(SAFE_ID);

    const cleanupRun = vi.fn();
    const cleaned = cleanupPromotedFixture({
      run: cleanupRun,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.previousState).toBe(MARKER_STATE_PENDING);
    expect(cleanupRun.mock.calls[0][0].args[1]).toBe(SAFE_ID);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('promotion succeeds but process stops before promoted update: pending marker still cleans fixture', () => {
    const { dir, markerPath } = tempPaths();
    temps.push(dir);

    // Simulate crash window: DB promotion succeeded, marker still pending.
    writePromotionMarker(
      {
        fixtureUserId: SAFE_ID,
        username: 'e2e_trend_fixture',
        email: 'e2e-trend-fixture@titangold.test',
        owner: 'trend-pr18',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PENDING,
      },
      markerPath,
    );

    const cleanupRun = vi.fn();
    const cleaned = cleanupPromotedFixture({
      run: cleanupRun,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.previousState).toBe(MARKER_STATE_PENDING);
    expect(cleanupRun.mock.calls[0][0].args).toEqual([
      '--fixture-user-id',
      SAFE_ID,
      '--fixture-username',
      'e2e_trend_fixture',
      '--fixture-email',
      'e2e-trend-fixture@titangold.test',
      '--fixture-owner',
      'trend-pr18',
      '--target-env',
      'staging',
    ]);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('cleanup failure aborts setup and preserves marker', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    writePromotionMarker(
      {
        fixtureUserId: SAFE_ID,
        username: 'e2e_trend_fixture',
        email: 'e2e-trend-fixture@titangold.test',
        owner: 'trend-pr18',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PROMOTED,
      },
      markerPath,
    );

    const run = vi.fn(({ scriptPath }) => {
      if (String(scriptPath).includes('cleanup_e2e_fixture_role')) {
        throw new Error('cleanup rowCount zero');
      }
    });

    expect(() =>
      prepareTrendStagingFixture({
        run,
        envOut,
        markerPath,
        env: BASE_ENV,
      }),
    ).toThrow(/cleanup rowCount zero/);

    expect(fs.existsSync(markerPath)).toBe(true);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.state).toBe(MARKER_STATE_PROMOTED);
    expect(marker.fixtureUserId).toBe(SAFE_ID);
  });

  it('invalid or incomplete marker causes setup to abort', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    fs.writeFileSync(
      markerPath,
      JSON.stringify({
        username: 'e2e_trend_fixture',
        state: MARKER_STATE_PROMOTED,
      }),
      'utf8',
    );

    const run = vi.fn();
    expect(() =>
      prepareTrendStagingFixture({
        run,
        envOut,
        markerPath,
        env: BASE_ENV,
      }),
    ).toThrow(/incomplete or invalid|missing required identity field/);
    expect(fs.existsSync(markerPath)).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('successful cleanup removes marker and new promotion may begin', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    writePromotionMarker(
      {
        fixtureUserId: OTHER_ID,
        username: 'e2e_prior_fixture',
        email: 'e2e-prior-fixture@titangold.test',
        owner: 'trend-prior',
        targetEnv: 'staging',
        backendDir: BACKEND_DIR,
        state: MARKER_STATE_PROMOTED,
      },
      markerPath,
    );

    const recovered = recoverUnresolvedPromotionMarker({
      run: vi.fn(),
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(recovered.recovered).toBe(true);
    expect(fs.existsSync(markerPath)).toBe(false);

    const run = mockPrepareAndPromote(envOut);
    prepareTrendStagingFixture({
      run,
      envOut,
      markerPath,
      env: BASE_ENV,
    });
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.state).toBe(MARKER_STATE_PROMOTED);
    expect(marker.fixtureUserId).toBe(SAFE_ID);
  });

  it('pending then promoted states never persist secrets and use shell-free argv', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    const statesSeen: string[] = [];
    const run = vi.fn(({ scriptPath, args }) => {
      expect(Array.isArray(args)).toBe(true);
      if (String(scriptPath).includes('prepare_login_e2e_fixture')) {
        writeEnvOut(envOut);
        return;
      }
      if (String(scriptPath).includes('promote_e2e_fixture_trader')) {
        const pending = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        statesSeen.push(pending.state);
        expect(pending.state).toBe(MARKER_STATE_PENDING);
        expect(JSON.stringify(pending)).not.toMatch(/password|secret-must-not-persist/i);
        return;
      }
    });

    prepareTrendStagingFixture({
      run,
      envOut,
      markerPath,
      env: BASE_ENV,
    });

    const promoted = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    statesSeen.push(promoted.state);
    expect(statesSeen).toEqual([MARKER_STATE_PENDING, MARKER_STATE_PROMOTED]);
    expect(promoted.password).toBeUndefined();
    expect(JSON.stringify(promoted)).not.toContain('secret-must-not-persist');
  });
});
