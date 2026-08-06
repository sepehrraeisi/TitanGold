import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSafeFixtureIdentity,
  assertCanonicalStagingDeployEnv,
} from '../../../backend/scripts/e2eFixtureSafety.js';
import {
  cleanupPromotedFixture,
  prepareTrendStagingFixture,
  runNodeScript,
  writePromotionMarker,
  clearPromotionMarker,
} from '../../../e2e/fixtureProcess.mjs';

const BACKEND_DIR = path.resolve(__dirname, '../../../backend');
const SAFE_ID = '11111111-2222-4333-a444-555555555555';

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trend-e2e-fixture-'));
  return {
    dir,
    envOut: path.join(dir, 'playwright.env'),
    markerPath: path.join(dir, 'promotion.json'),
  };
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
          env: {
            TITAN_DEPLOY_ENV: 'staging',
            TITAN_E2E_TARGET_ENV: 'staging',
            TITAN_E2E_BACKEND_DIR: BACKEND_DIR,
            TITAN_E2E_FIXTURE_USERNAME: 'e2e_trend_fixture',
            TITAN_E2E_FIXTURE_EMAIL: 'e2e-trend-fixture@titangold.test',
            TITAN_E2E_FIXTURE_OWNER: 'trend-pr18',
            ...patch,
          },
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
    expect(argv[0]).toContain('prepare_login_e2e_fixture.js');
    expect(argv).toContain('e2e_trend_fixture');
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
        env: {
          TITAN_DEPLOY_ENV: 'staging',
          TITAN_E2E_TARGET_ENV: 'staging',
          TITAN_E2E_BACKEND_DIR: BACKEND_DIR,
          TITAN_E2E_FIXTURE_USERNAME: 'e2e_trend_fixture',
          TITAN_E2E_FIXTURE_EMAIL: 'e2e-trend-fixture@titangold.test',
          TITAN_E2E_FIXTURE_OWNER: 'trend-pr18',
        },
      }),
    ).toThrow(/prepare failed/);
    expect(fs.existsSync(markerPath)).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('successful promotion writes non-secret marker and cleanup removes it', () => {
    const { dir, envOut, markerPath } = tempPaths();
    temps.push(dir);
    const calls: Array<{ scriptPath: string; args: string[] }> = [];

    const run = vi.fn(({ scriptPath, args }) => {
      calls.push({ scriptPath, args });
      if (String(scriptPath).includes('prepare_login_e2e_fixture')) {
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
          ].join('\n'),
          { mode: 0o600 },
        );
      }
    });

    prepareTrendStagingFixture({
      run,
      envOut,
      markerPath,
      env: {
        TITAN_DEPLOY_ENV: 'staging',
        TITAN_E2E_TARGET_ENV: 'staging',
        TITAN_E2E_BACKEND_DIR: BACKEND_DIR,
        TITAN_E2E_FIXTURE_USERNAME: 'e2e_trend_fixture',
        TITAN_E2E_FIXTURE_EMAIL: 'e2e-trend-fixture@titangold.test',
        TITAN_E2E_FIXTURE_OWNER: 'trend-pr18',
      },
    });

    expect(fs.existsSync(markerPath)).toBe(true);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    expect(marker.fixtureUserId).toBe(SAFE_ID);
    expect(marker.password).toBeUndefined();
    expect(JSON.stringify(marker)).not.toContain('secret-must-not-persist');
    expect(calls[0].args).toEqual(expect.arrayContaining(['--fixture-username', 'e2e_trend_fixture']));
    expect(calls.every((c) => Array.isArray(c.args))).toBe(true);

    const cleanupRun = vi.fn();
    const cleaned = cleanupPromotedFixture({
      run: cleanupRun,
      markerPath,
      env: { TITAN_DEPLOY_ENV: 'staging' },
    });
    expect(cleaned.cleaned).toBe(true);
    expect(cleanupRun).toHaveBeenCalledTimes(1);
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
    // Marker identity is authoritative; callers cannot override via env.
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
