/**
 * @jest-environment node
 *
 * ENGINE_NODE_ENV_NORMALIZATION V2 — synthetic unit tests (no live PM2).
 */

import { describe, expect, it } from '@jest/globals';
import {
  assertExtraIsolationGate,
  assertSanitizedRestartEnvKeys,
  buildNumericPm2RestartSpec,
  buildSanitizedPm2RestartEnv,
  projectDumpNodeEnvRetainedOnly,
  resolveEngineTopology,
  resolveRetainedDumpRowBinding,
  SANITIZED_PM2_RESTART_ENV_KEYS,
} from '../../scripts/engine-node-env-normalization/ennV2Core.mjs';
import { buildProductionDumpShapeFixture } from '../../scripts/t2-retry-orchestrator/productionDumpShapeFixture.mjs';

function makeLiveEngine({ pmId, status, pathValue, nodeEnv = 'development' }) {
  return {
    name: 'titan-engine-worker',
    pm_id: pmId,
    pid: status === 'online' ? 2000 + pmId : 0,
    status,
    pm2_env: {
      status,
      pm_exec_path: '/app/backend/workers/engineWorkerLeader.js',
      pm_cwd: '/app/backend',
      exec_mode: 'fork_mode',
      env: {
        NODE_ENV: nodeEnv,
        PATH: pathValue,
        HOME: '/home/ubuntu',
        USER: 'ubuntu',
      },
    },
  };
}

describe('ENGINE_NODE_ENV_NORMALIZATION V2 core', () => {
  describe('resolveEngineTopology — duplicate engine names, numeric binding', () => {
    it('resolves retained online + extra stopped by pm_id (not name)', () => {
      const live = [
        makeLiveEngine({ pmId: 5, status: 'stopped', pathValue: '/long/path:/usr/bin' }),
        makeLiveEngine({ pmId: 9, status: 'online', pathValue: '/usr/bin:/bin' }),
      ];
      const topo = resolveEngineTopology(live);
      expect(topo.ok).toBe(true);
      expect(topo.retainedPmId).toBe(9);
      expect(topo.extraPmId).toBe(5);
      expect(topo.retained.pm2_env.status).toBe('online');
      expect(topo.extra.pm2_env.status).toBe('stopped');
    });

    it('fails when two engines are online (duplicate name hazard)', () => {
      const live = [
        makeLiveEngine({ pmId: 5, status: 'online', pathValue: '/usr/bin' }),
        makeLiveEngine({ pmId: 9, status: 'online', pathValue: '/usr/bin' }),
      ];
      const topo = resolveEngineTopology(live);
      expect(topo.ok).toBe(false);
      expect(topo.error).toMatch(/ENGINE_ONLINE_COUNT_EXPECTED_1/);
    });

    it('fails when engine entry count is not 2', () => {
      const live = [makeLiveEngine({ pmId: 9, status: 'online', pathValue: '/usr/bin' })];
      expect(resolveEngineTopology(live).ok).toBe(false);
    });
  });

  describe('EXTRA_ISOLATION_GATE', () => {
    const ids = { extraPmId: 5, retainedPmId: 9 };

    it('PASS at PRE when extra stopped and retained online', () => {
      const live = [
        makeLiveEngine({ pmId: 5, status: 'stopped', pathValue: '/long' }),
        makeLiveEngine({ pmId: 9, status: 'online', pathValue: '/usr/bin' }),
      ];
      const gate = assertExtraIsolationGate(live, ids, 'PRE');
      expect(gate.ok).toBe(true);
    });

    it('FAIL when extra becomes online during execution', () => {
      const live = [
        makeLiveEngine({ pmId: 5, status: 'online', pathValue: '/long' }),
        makeLiveEngine({ pmId: 9, status: 'online', pathValue: '/usr/bin' }),
      ];
      const gate = assertExtraIsolationGate(live, ids, 'MID_FORWARD');
      expect(gate.ok).toBe(false);
      expect(gate.error).toBe('EXTRA_ISOLATION_GATE_EXTRA_BECAME_ONLINE');
    });

    it('FAIL when retained is not online', () => {
      const live = [
        makeLiveEngine({ pmId: 5, status: 'stopped', pathValue: '/long' }),
        makeLiveEngine({ pmId: 9, status: 'stopped', pathValue: '/usr/bin' }),
      ];
      const gate = assertExtraIsolationGate(live, ids, 'PRE_DUMP');
      expect(gate.ok).toBe(false);
      expect(gate.error).toBe('EXTRA_ISOLATION_GATE_RETAINED_NOT_ONLINE');
    });
  });

  describe('numeric restart only — no startOrRestart / name targeting', () => {
    it('builds pm2 restart <numeric_id> --update-env only', () => {
      const spec = buildNumericPm2RestartSpec(9, 'production');
      expect(spec.ok).toBe(true);
      expect(spec.command).toBe('pm2');
      expect(spec.args).toEqual(['restart', '9', '--update-env']);
      expect(spec.usesNameTargeting).toBe(false);
      expect(spec.args.join(' ')).not.toContain('startOrRestart');
      expect(spec.args.join(' ')).not.toContain('--only');
      expect(spec.args.join(' ')).not.toContain('titan-engine-worker');
    });

    it('rejects non-numeric pm_id', () => {
      expect(buildNumericPm2RestartSpec('titan-engine-worker', 'production').ok).toBe(false);
    });

    it('sanitized shell env has bounded keys only', () => {
      const env = buildSanitizedPm2RestartEnv({
        nodeEnv: 'production',
        home: '/home/ubuntu',
        user: 'ubuntu',
        logname: 'ubuntu',
      });
      const check = assertSanitizedRestartEnvKeys(env);
      expect(check.ok).toBe(true);
      expect(Object.keys(env).sort()).toEqual([...SANITIZED_PM2_RESTART_ENV_KEYS].sort());
      expect(env.NODE_ENV).toBe('production');
    });
  });

  describe('dump row binding + NODE_ENV-only projection', () => {
    it('binds to online row with PATH match to retained live (not stopped extra)', () => {
      const { dump } = buildProductionDumpShapeFixture({ pathEqual: false });
      dump[0].status = 'stopped';
      dump[1].status = 'online';

      const retainedLive = makeLiveEngine({
        pmId: 9,
        status: 'online',
        pathValue: '/usr/bin:/bin',
      });

      const binding = resolveRetainedDumpRowBinding(dump, retainedLive);
      expect(binding.ok).toBe(true);
      expect(binding.retainedDumpIndex).toBe(1);
      expect(binding.extraDumpIndex).toBe(0);
      expect(binding.extraDumpStatus).toBe('stopped');
    });

    it('projects NODE_ENV only on retained online row; extra row untouched', () => {
      const { dump } = buildProductionDumpShapeFixture({ pathEqual: false });
      dump[0].status = 'stopped';
      dump[0].NODE_ENV = 'development';
      dump[0].env.NODE_ENV = 'development';
      dump[1].status = 'online';
      dump[1].NODE_ENV = 'development';
      dump[1].env.NODE_ENV = 'development';

      const retainedLive = makeLiveEngine({
        pmId: 9,
        status: 'online',
        pathValue: '/usr/bin:/bin',
      });

      const binding = resolveRetainedDumpRowBinding(dump, retainedLive);
      expect(binding.ok).toBe(true);

      const extraBefore = JSON.stringify(dump[binding.extraDumpIndex]);
      const projected = projectDumpNodeEnvRetainedOnly(dump, binding, 'production');
      const parsed = JSON.parse(projected.bytes.toString('utf8'));
      const extraAfter = JSON.stringify(parsed[binding.extraDumpIndex]);

      expect(parsed[binding.retainedDumpIndex].NODE_ENV).toBe('production');
      expect(parsed[binding.retainedDumpIndex].env.NODE_ENV).toBe('production');
      expect(extraBefore).toBe(extraAfter);
      expect(projected.extraRowUntouched).toBe(true);
      expect(projected.changedLeafCount).toBeGreaterThan(0);
      expect(projected.changedLeafCount).toBeLessThanOrEqual(3);
    });

    it('fails binding when two online rows (ambiguous PATH)', () => {
      const { dump } = buildProductionDumpShapeFixture({ pathEqual: true });
      dump[0].status = 'online';
      dump[1].status = 'online';

      const retainedLive = makeLiveEngine({
        pmId: 9,
        status: 'online',
        pathValue: '/usr/bin:/bin',
      });

      const binding = resolveRetainedDumpRowBinding(dump, retainedLive);
      expect(binding.ok).toBe(false);
      expect(binding.error).toBe('DUMP_ONLINE_ROW_COUNT_MISMATCH');
    });

    it('throws if projection would touch extra row', () => {
      const { dump } = buildProductionDumpShapeFixture({ pathEqual: false });
      dump[0].status = 'stopped';
      dump[1].status = 'online';

      const retainedLive = makeLiveEngine({
        pmId: 9,
        status: 'online',
        pathValue: '/usr/bin:/bin',
      });

      const binding = resolveRetainedDumpRowBinding(dump, retainedLive);
      const badBinding = { ...binding, extraDumpIndex: binding.retainedDumpIndex };
      expect(() => projectDumpNodeEnvRetainedOnly(dump, badBinding, 'production')).toThrow(
        'PROJECT_DUMP_EXTRA_ROW_TOUCHED',
      );
    });
  });
});
