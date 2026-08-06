/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';
import { promoteFixtureRole } from '../../scripts/promote_e2e_fixture_trader.js';
import { cleanupFixtureRole } from '../../scripts/cleanup_e2e_fixture_role.js';

const SAFE = {
  fixtureUserId: '11111111-2222-4333-a444-555555555555',
  username: 'e2e_trend_fixture',
  email: 'e2e-trend-fixture@titangold.test',
  owner: 'trend-pr18',
  targetEnv: 'staging',
  deployEnv: 'staging',
};

describe('e2e fixture role mutation scripts', () => {
  it('promote rejects missing TITAN_DEPLOY_ENV even when --target-env=staging', async () => {
    const dbQuery = jest.fn();
    await expect(
      promoteFixtureRole({ ...SAFE, deployEnv: undefined, dbQuery }),
    ).rejects.toThrow(/TITAN_DEPLOY_ENV is required/);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('promote rejects production deploy env', async () => {
    const dbQuery = jest.fn();
    await expect(
      promoteFixtureRole({ ...SAFE, deployEnv: 'production', dbQuery }),
    ).rejects.toThrow(/production/);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('promote requires exact one matching row', async () => {
    const dbQuery = jest.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(promoteFixtureRole({ ...SAFE, dbQuery })).rejects.toThrow(
      /exactly one disposable fixture row for role promotion/,
    );
  });

  it('cleanup requires exact rowCount === 1', async () => {
    const dbQuery = jest.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(cleanupFixtureRole({ ...SAFE, dbQuery })).rejects.toThrow(
      /exactly one disposable fixture row for cleanup/,
    );
  });

  it('cleanup cannot target a different fixture identity', async () => {
    const dbQuery = jest.fn().mockImplementation(async (_sql, params) => {
      // Simulate WHERE miss when username does not match the promoted row.
      if (params[1] !== SAFE.username) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ id: SAFE.fixtureUserId, username: SAFE.username, role: 'user' }] };
    });

    await expect(
      cleanupFixtureRole({
        ...SAFE,
        username: 'e2e_other_fixture',
        dbQuery,
      }),
    ).rejects.toThrow(/exactly one disposable fixture row for cleanup/);
  });

  it('promote succeeds only for matching disposable identity', async () => {
    const dbQuery = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: SAFE.fixtureUserId, username: SAFE.username, role: 'trader' }],
    });
    const row = await promoteFixtureRole({ ...SAFE, dbQuery });
    expect(row.role).toBe('trader');
    expect(dbQuery).toHaveBeenCalledTimes(1);
    const params = dbQuery.mock.calls[0][1];
    expect(params).toEqual([
      SAFE.fixtureUserId,
      SAFE.username,
      SAFE.email,
      `E2E Login Fixture (${SAFE.owner})`,
    ]);
  });
});
