import { describe, expect, it } from 'vitest';
import { assertE2EFixtureEnv } from '../../../e2e/global-setup';

describe('e2e global setup fixture guards', () => {
  it('fails closed without explicit staging fixture inputs', () => {
    expect(() =>
      assertE2EFixtureEnv({
        RUN_LOGIN_E2E: '1',
      } as NodeJS.ProcessEnv),
    ).toThrow('TITAN_E2E_TARGET_ENV=staging');
  });

  it('accepts only explicit staging fixture inputs', () => {
    expect(() =>
      assertE2EFixtureEnv({
        RUN_LOGIN_E2E: '1',
        TITAN_E2E_TARGET_ENV: 'staging',
        TITAN_E2E_BACKEND_DIR: '/tmp/backend',
        TITAN_E2E_FIXTURE_USERNAME: 'e2e_trend_fixture',
        TITAN_E2E_FIXTURE_EMAIL: 'e2e-trend-fixture@titangold.test',
        TITAN_E2E_FIXTURE_OWNER: 'trend-pr18',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('global-setup source uses execFileSync with shell disabled', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../e2e/global-setup.ts'),
      'utf8',
    );
    expect(source).toContain('execFileSync');
    expect(source).toContain('shell: false');
    expect(source).not.toMatch(/execSync\(/);
  });

  it('prepareTrendStagingFixture source does not interpolate shell command strings', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../e2e/prepareTrendStagingFixture.mjs'),
      'utf8',
    );
    expect(source).not.toMatch(/execSync\(/);
    expect(source).toContain('prepareTrendStagingFixture');
  });
});
