/**
 * Audited live PM2/system boundary for T2 orchestrator.
 * Must not be selected accidentally — CLI requires full execution gates.
 * Never logs secret stdout/stderr into evidence; returns exit codes only for mutations.
 */

import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { ForbiddenLiveExecutionError } from './commandBoundary.mjs';

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * @param {object} opts
 * @param {boolean} opts.gatesSatisfied - caller must prove all Owner execution gates
 * @param {(cmd: string, args: string[], options?: object) => {status:number|null, stdout:string, stderr:string}} [opts.spawnSyncImpl]
 * @param {string} [opts.dumpPath]
 * @param {string} [opts.collectorBaseUrl]
 */
export function createLiveBoundary(opts = {}) {
  if (opts.gatesSatisfied !== true) {
    throw new ForbiddenLiveExecutionError('LIVE_BOUNDARY_GATES_NOT_SATISFIED');
  }

  const spawnImpl = opts.spawnSyncImpl || spawnSync;
  const dumpPath = opts.dumpPath || path.join(process.env.PM2_HOME || path.join(process.env.HOME || '', '.pm2'), 'dump.pm2');
  const collectorBase = opts.collectorBaseUrl || 'http://127.0.0.1:5003';

  function runPm2(args) {
    const result = spawnImpl('pm2', args, {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    });
    // Do not return raw stdout/stderr to callers that might log evidence.
    return {
      exitCode: typeof result.status === 'number' ? result.status : 1,
      // intentionally omit stdout/stderr payloads
    };
  }

  function httpStatus(url) {
    const result = spawnImpl(
      'curl',
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url],
      { encoding: 'utf8' },
    );
    const code = Number(String(result.stdout || '').trim());
    return Number.isFinite(code) ? code : 0;
  }

  return {
    async listLiveProcesses() {
      const result = spawnImpl('pm2', ['jlist'], { encoding: 'utf8', timeout: 60000 });
      if (result.status !== 0) {
        throw new Error('PM2_JLIST_FAILED');
      }
      return JSON.parse(result.stdout || '[]');
    },

    async readDump() {
      const bytes = await fsp.readFile(dumpPath);
      const parsed = JSON.parse(bytes.toString('utf8'));
      return { bytes, parsed, sha256: sha256Buffer(bytes) };
    },

    async writeBackup(bytes, destPath) {
      await fsp.writeFile(destPath, bytes, { mode: 0o600 });
      await fsp.chmod(destPath, 0o600);
      return { sha256: sha256Buffer(bytes), bytes: bytes.length, mode: 0o600 };
    },

    async restoreDump(backupBytes) {
      const dir = path.dirname(dumpPath);
      const tmp = path.join(dir, `dump.pm2.t2restore.${process.pid}.${Date.now()}`);
      await fsp.writeFile(tmp, backupBytes, { mode: 0o600 });
      await fsp.rename(tmp, dumpPath);
      // preserve commonly observed active dump mode; do not normalize secrets
      try {
        await fsp.chmod(dumpPath, 0o664);
      } catch {
        /* ignore */
      }
    },

    async stopProcessByPmId(pmId) {
      return runPm2(['stop', String(pmId)]);
    },

    async startProcessByPmId(pmId) {
      return runPm2(['start', String(pmId)]);
    },

    async pm2Save() {
      return runPm2(['save']);
    },

    async healthCheck(port) {
      const statusCode = httpStatus(`http://127.0.0.1:${port}/health`);
      return { statusCode };
    },

    async collectorFunctionalCheck() {
      return {
        health: httpStatus(`${collectorBase}/api/telegram-collector/health`),
        accounts: httpStatus(`${collectorBase}/api/telegram-collector/accounts`),
        channels: httpStatus(`${collectorBase}/api/telegram-collector/collector-channels`),
      };
    },

    async ensureDir(dirPath, mode) {
      await fsp.mkdir(dirPath, { recursive: true, mode });
      await fsp.chmod(dirPath, mode);
    },

    async chmod(filePath, mode) {
      await fsp.chmod(filePath, mode);
    },

    async pathExists(p) {
      try {
        await fsp.access(p, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Node fs adapter for durable journal (exclusive mkdir / exclusive create).
 */
export function createNodeJournalFs() {
  return {
    async mkdirExclusive(dir, mode) {
      try {
        await fsp.mkdir(dir, { recursive: false, mode });
      } catch (err) {
        if (err && err.code === 'EEXIST') {
          const e = new Error('RUN_DIR_EXISTS');
          e.code = 'RUN_DIR_EXISTS';
          throw e;
        }
        throw err;
      }
      await fsp.chmod(dir, mode);
    },
    async writeFileExclusive(file, data, mode) {
      const fh = await fsp.open(file, 'wx', mode);
      try {
        await fh.writeFile(data, 'utf8');
        await fh.sync();
        await fh.chmod(mode);
      } finally {
        await fh.close();
      }
      await this.fsync(path.dirname(file));
    },
    async writeFileAtomic(file, data, mode) {
      const dir = path.dirname(file);
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      const fh = await fsp.open(tmp, 'w', mode);
      try {
        await fh.writeFile(data, 'utf8');
        await fh.sync();
        await fh.chmod(mode);
      } finally {
        await fh.close();
      }
      await fsp.rename(tmp, file);
      await this.fsync(dir);
    },
    async readFile(file) {
      return fsp.readFile(file, 'utf8');
    },
    async exists(file) {
      try {
        await fsp.access(file, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    async chmod(file, mode) {
      await fsp.chmod(file, mode);
    },
    async fsync(target) {
      const fh = await fsp.open(target, 'r');
      try {
        await fh.sync();
      } finally {
        await fh.close();
      }
    },
  };
}
