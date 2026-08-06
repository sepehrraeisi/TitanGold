/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertCanonicalStagingDeployEnv,
  assertSafeFixtureIdentity,
} from '../../scripts/e2eFixtureSafety.js';

const SAFE = {
  username: 'e2e_trend_fixture',
  email: 'e2e-trend-fixture@titangold.test',
  owner: 'trend-pr18',
  fixtureUserId: '11111111-2222-4333-a444-555555555555',
};

describe('e2eFixtureSafety identity contract', () => {
  it('accepts disposable e2e_ / @titangold.test identities', () => {
    expect(() => assertSafeFixtureIdentity({ ...SAFE, requireId: true })).not.toThrow();
  });

  it.each([
    ['quote', { username: 'e2e_"evil"' }],
    ['semicolon', { username: 'e2e_x;rm' }],
    ['dollar substitution', { email: 'e2e-$(whoami)@titangold.test' }],
    ['backtick', { owner: 'trend`id`' }],
    ['newline', { username: 'e2e_x\nrm' }],
    ['pipe', { owner: 'trend|x' }],
  ])('rejects shell metacharacter payload: %s', (_label, patch) => {
    expect(() => assertSafeFixtureIdentity({ ...SAFE, ...patch, requireId: true })).toThrow();
  });

  it('rejects non-disposable username and non-test email', () => {
    expect(() =>
      assertSafeFixtureIdentity({ ...SAFE, username: 'admin', requireId: true }),
    ).toThrow(/e2e_/);
    expect(() =>
      assertSafeFixtureIdentity({ ...SAFE, email: 'user@example.com', requireId: true }),
    ).toThrow(/titangold\.test/);
  });

  it('rejects invalid UUID fixture IDs', () => {
    expect(() =>
      assertSafeFixtureIdentity({ ...SAFE, fixtureUserId: 'not-a-uuid', requireId: true }),
    ).toThrow(/UUID/);
  });
});

describe('e2eFixtureSafety deploy-env gate', () => {
  it('requires TITAN_DEPLOY_ENV=staging and rejects production/missing/conflict', () => {
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: 'staging' }),
    ).not.toThrow();
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: 'production' }),
    ).toThrow(/production/);
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: undefined }),
    ).toThrow(/TITAN_DEPLOY_ENV is required/);
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'staging', deployEnv: 'dev' }),
    ).toThrow(/TITAN_DEPLOY_ENV=staging/);
    expect(() =>
      assertCanonicalStagingDeployEnv({ targetEnv: 'production', deployEnv: 'staging' }),
    ).toThrow(/--target-env=staging/);
  });
});
