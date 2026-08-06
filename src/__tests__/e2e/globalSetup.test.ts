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
});
