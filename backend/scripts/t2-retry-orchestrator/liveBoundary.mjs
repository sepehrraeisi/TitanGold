/**
 * Audited live PM2/system boundary for T2 orchestrator.
 * Must not be selected accidentally — CLI requires full execution gates.
 * Never logs secret stdout/stderr into evidence; returns exit codes only for mutations.
 * Never propagates raw JSON/parser snippets into errors.
 */

import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
} from './commandBoundary.mjs';
import { REQUIRED_PROJECTED_DUMP_MODE } from './constants.mjs';

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fixedError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

/**
 * @param {object} opts
 * @param {boolean} opts.gatesSatisfied
 * @param {(cmd: string, args: string[], options?: object) => {status:number|null, stdout:string, stderr:string}} [opts.spawnSyncImpl]
 * @param {string} [opts.dumpPath]
 * @param {string} [opts.collectorBaseUrl]
 */
export function createLiveBoundary(opts = {}) {
  if (opts.gatesSatisfied !== true) {
    throw new ForbiddenLiveExecutionError('LIVE_BOUNDARY_GATES_NOT_SATISFIED');
  }

  const spawnImpl = opts.spawnSyncImpl || spawnSync;
  const dumpPath =
    opts.dumpPath ||
    path.join(process.env.PM2_HOME || path.join(process.env.HOME || '', '.pm2'), 'dump.pm2');
  const collectorBase = opts.collectorBaseUrl || 'http://127.0.0.1:5003';

  function runPm2(args) {
    const result = spawnImpl('pm2', args, {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    });
    return {
      exitCode: typeof result.status === 'number' ? result.status : 1,
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

  async function fsyncPath(target) {
    const fh = await fsp.open(target, 'r');
    try {
      await fh.sync();
    } finally {
      await fh.close();
    }
  }

  function getExecIdentity() {
    return {
      euid: typeof process.geteuid === 'function' ? process.geteuid() : null,
      egid: typeof process.getegid === 'function' ? process.getegid() : null,
      groups: typeof process.getgroups === 'function' ? process.getgroups() : [],
    };
  }

  async function inspectWriteOwnershipSafety() {
    let dumpStat;
    let parentStat;
    try {
      dumpStat = await fsp.stat(dumpPath);
      parentStat = await fsp.stat(path.dirname(dumpPath));
    } catch {
      throw fixedError('PM2_DUMP_READ_FAILED');
    }
    const exec = getExecIdentity();
    const ownerSafe = exec.euid != null && dumpStat.uid === exec.euid;
    const groupSafe =
      exec.egid != null &&
      (dumpStat.gid === exec.egid || (Array.isArray(exec.groups) && exec.groups.includes(dumpStat.gid)));
    return {
      dumpUid: dumpStat.uid,
      dumpGid: dumpStat.gid,
      dumpMode: dumpStat.mode & 0o777,
      parentUid: parentStat.uid,
      parentGid: parentStat.gid,
      parentMode: parentStat.mode & 0o777,
      execEuid: exec.euid,
      execEgid: exec.egid,
      execGroups: exec.groups,
      ownerSafe,
      groupSafe,
      safe: ownerSafe && groupSafe,
    };
  }

  async function createOwnedTempEmpty(tmp, { uid, gid, mode }) {
    const fh = await fsp.open(tmp, 'w', mode);
    await fh.close();
    try {
      if (typeof uid === 'number' && typeof gid === 'number') {
        await fsp.chown(tmp, uid, gid);
      }
      await fsp.chmod(tmp, mode);
      const st = await fsp.stat(tmp);
      if ((st.mode & 0o777) !== mode) {
        throw fixedError('PROJECTED_TEMP_MODE_NOT_0600');
      }
      if (typeof uid === 'number' && st.uid !== uid) {
        throw fixedError('DUMP_OWNER_MISMATCH');
      }
      if (typeof gid === 'number' && st.gid !== gid) {
        throw fixedError('DUMP_GROUP_MISMATCH');
      }
      return st;
    } catch (err) {
      try {
        await fsp.unlink(tmp);
      } catch {
        /* ignore */
      }
      throw err.code ? err : fixedError(err.message || 'DUMP_OWNERSHIP_PRESERVATION_UNSAFE');
    }
  }

  async function writeBytesAndSync(tmp, bytes) {
    const fh = await fsp.open(tmp, 'r+');
    try {
      await fh.writeFile(bytes);
      await fh.sync();
    } finally {
      await fh.close();
    }
  }

  return {
    async listLiveProcesses() {
      const result = spawnImpl('pm2', ['jlist'], { encoding: 'utf8', timeout: 60000 });
      if (result.status !== 0) {
        throw fixedError('PM2_JLIST_FAILED');
      }
      try {
        return JSON.parse(result.stdout || '[]');
      } catch {
        throw fixedError('PM2_JLIST_PARSE_FAILED');
      }
    },

    async readDump() {
      let bytes;
      let st;
      try {
        st = await fsp.stat(dumpPath);
        bytes = await fsp.readFile(dumpPath);
      } catch {
        throw fixedError('PM2_DUMP_READ_FAILED');
      }
      const mode = st.mode & 0o777;
      let parsed;
      try {
        parsed = JSON.parse(bytes.toString('utf8'));
      } catch {
        throw fixedError('PM2_DUMP_PARSE_FAILED');
      }
      return {
        bytes,
        parsed,
        sha256: sha256Buffer(bytes),
        mode,
        uid: st.uid,
        gid: st.gid,
      };
    },

    async inspectActiveDumpWriteSafety() {
      const info = await inspectWriteOwnershipSafety();
      return {
        dumpUid: info.dumpUid,
        dumpGid: info.dumpGid,
        dumpMode: info.dumpMode,
        ownerSafe: info.ownerSafe,
        groupSafe: info.groupSafe,
        safe: info.safe,
      };
    },

    async writeBackup(bytes, destPath) {
      await fsp.writeFile(destPath, bytes, { mode: 0o600 });
      await fsp.chmod(destPath, 0o600);
      return { sha256: sha256Buffer(bytes), bytes: bytes.length, mode: 0o600 };
    },

    /**
     * Atomic restore using EXACT PRE active-dump mode (never invent 0664).
     * @param {Buffer} backupBytes
     * @param {{ mode: number, uid?: number, gid?: number }} opts
     */
    async restoreDump(backupBytes, opts = {}) {
      if (typeof opts.mode !== 'number' || !Number.isFinite(opts.mode)) {
        throw fixedError('RESTORE_MODE_REQUIRED');
      }
      const mode = opts.mode & 0o777;
      const dir = path.dirname(dumpPath);
      const tmp = path.join(dir, `dump.pm2.t2restore.${process.pid}.${Date.now()}`);
      await createOwnedTempEmpty(tmp, {
        uid: typeof opts.uid === 'number' ? opts.uid : undefined,
        gid: typeof opts.gid === 'number' ? opts.gid : undefined,
        mode,
      });
      try {
        await writeBytesAndSync(tmp, backupBytes);
        const stBeforeRename = await fsp.stat(tmp);
        if ((stBeforeRename.mode & 0o777) !== mode) {
          throw fixedError('ROLLBACK_DUMP_MODE_MISMATCH');
        }
        if (typeof opts.uid === 'number' && stBeforeRename.uid !== opts.uid) {
          throw fixedError('RESTORE_OWNER_MISMATCH');
        }
        if (typeof opts.gid === 'number' && stBeforeRename.gid !== opts.gid) {
          throw fixedError('RESTORE_GROUP_MISMATCH');
        }
        await fsp.rename(tmp, dumpPath);
        await fsyncPath(dir);
      } catch (err) {
        try {
          await fsp.unlink(tmp);
        } catch {
          /* ignore */
        }
        throw err.code ? err : fixedError(err.message || 'RESTORE_DUMP_FAILED');
      }
      const st = await fsp.stat(dumpPath);
      if ((st.mode & 0o777) !== mode) {
        throw fixedError('ROLLBACK_DUMP_MODE_MISMATCH');
      }
      if (typeof opts.uid === 'number' && st.uid !== opts.uid) {
        throw fixedError('RESTORE_OWNER_MISMATCH');
      }
      if (typeof opts.gid === 'number' && st.gid !== opts.gid) {
        throw fixedError('RESTORE_GROUP_MISMATCH');
      }
      return { ok: true, mode, uid: st.uid, gid: st.gid };
    },

    async stopProcessByPmId(pmId) {
      return runPm2(['stop', String(pmId)]);
    },

    async startProcessByPmId(pmId) {
      return runPm2(['start', String(pmId)]);
    },

    /**
     * Global pm2 save is forbidden on the v1.5.0 forward/rollback path.
     */
    async pm2Save() {
      throw new GlobalPm2SaveForbiddenError();
    },

    /**
     * Atomic projected dump write — mode 0600 from first byte; never 0664 intermediate.
     * Targets ONLY the resolved active dump path.
     * @param {Buffer} projectedBytes
     * @param {{ expectedUid?: number, expectedGid?: number, expectedSha256?: string }} [opts]
     */
    async writeProjectedActiveDump(projectedBytes, opts = {}) {
      if (!Buffer.isBuffer(projectedBytes)) {
        throw fixedError('PROJECTED_BYTES_INVALID');
      }
      let preSt;
      try {
        preSt = await fsp.stat(dumpPath);
      } catch {
        throw fixedError('PM2_DUMP_READ_FAILED');
      }
      if (typeof opts.expectedUid === 'number' && preSt.uid !== opts.expectedUid) {
        throw fixedError('DUMP_OWNER_MISMATCH');
      }
      if (typeof opts.expectedGid === 'number' && preSt.gid !== opts.expectedGid) {
        throw fixedError('DUMP_GROUP_MISMATCH');
      }
      const execSafety = await inspectWriteOwnershipSafety();
      if (!execSafety.safe) {
        throw fixedError('DUMP_OWNERSHIP_PRESERVATION_UNSAFE');
      }

      const dir = path.dirname(dumpPath);
      const tmp = path.join(dir, `dump.pm2.t2proj.${process.pid}.${Date.now()}`);
      const targetMode = REQUIRED_PROJECTED_DUMP_MODE;
      await createOwnedTempEmpty(tmp, {
        uid: typeof opts.expectedUid === 'number' ? opts.expectedUid : undefined,
        gid: typeof opts.expectedGid === 'number' ? opts.expectedGid : undefined,
        mode: targetMode,
      });
      try {
        await writeBytesAndSync(tmp, projectedBytes);
        const tmpSt = await fsp.stat(tmp);
        if ((tmpSt.mode & 0o777) !== targetMode) {
          throw fixedError('PROJECTED_TEMP_MODE_NOT_0600');
        }
        if (typeof opts.expectedUid === 'number' && tmpSt.uid !== opts.expectedUid) {
          throw fixedError('DUMP_OWNER_MISMATCH');
        }
        if (typeof opts.expectedGid === 'number' && tmpSt.gid !== opts.expectedGid) {
          throw fixedError('DUMP_GROUP_MISMATCH');
        }
        await fsp.rename(tmp, dumpPath);
        await fsyncPath(dir);
      } catch (err) {
        try {
          await fsp.unlink(tmp);
        } catch {
          /* ignore */
        }
        throw err.code ? err : fixedError(err.message || 'PROJECTED_DUMP_WRITE_FAILED');
      }

      const st = await fsp.stat(dumpPath);
      const mode = st.mode & 0o777;
      if (mode !== targetMode) {
        throw fixedError('PROJECTED_DUMP_MODE_NOT_0600');
      }
      if (typeof opts.expectedUid === 'number' && st.uid !== opts.expectedUid) {
        throw fixedError('DUMP_OWNER_MISMATCH');
      }
      if (typeof opts.expectedGid === 'number' && st.gid !== opts.expectedGid) {
        throw fixedError('DUMP_GROUP_MISMATCH');
      }
      const bytes = await fsp.readFile(dumpPath);
      const sha = sha256Buffer(bytes);
      if (opts.expectedSha256 && sha !== opts.expectedSha256) {
        throw fixedError('PROJECTED_DUMP_READBACK_MISMATCH');
      }
      try {
        JSON.parse(bytes.toString('utf8'));
      } catch {
        throw fixedError('PROJECTED_DUMP_PARSE_FAILED');
      }

      return {
        mode,
        sha256: sha,
        uid: st.uid,
        gid: st.gid,
        ownerPreserved:
          typeof opts.expectedUid !== 'number' ? true : st.uid === opts.expectedUid,
        groupPreserved:
          typeof opts.expectedGid !== 'number' ? true : st.gid === opts.expectedGid,
      };
    },

    /**
     * Legacy harden — not used by v1.5 forward path.
     * @param {number} [mode]
     */
    async hardenActiveDumpMode(mode = 0o600) {
      const targetMode = mode & 0o777;
      await fsp.chmod(dumpPath, targetMode);
      try {
        await fsyncPath(dumpPath);
      } catch {
        // Best-effort fsync; mode verification below is authoritative.
      }
      const st = await fsp.stat(dumpPath);
      const actual = st.mode & 0o777;
      return { mode: actual, ok: actual === targetMode };
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
