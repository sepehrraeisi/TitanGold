/**
 * Sanitized production-shape PM2 dump fixture (no secret values).
 * Structural facts from current dump.pm2 / PM2 6.0.13 dumpProcessList:
 * - entry is flattened pm2_env (no wrapping pm2_env)
 * - nested env object present
 * - top-level mirrors of nested env keys (Utility.extend dump shape)
 * - no pm_id; no instances (deleted by dumpProcessList)
 * - error_file / out_file aliases; restart_delay; process-name key quirk
 */

/** Placeholder — never a real credential. */
const PH = {
  pathCanon: '/usr/bin:/bin',
  pathNonCanon: '/noncanonical/extra/bin:/usr/bin',
  jwt: 'PLACEHOLDER_JWT',
  dbPass: 'PLACEHOLDER_DB_PASSWORD',
  master: 'PLACEHOLDER_MASTER_KEY',
};

function engineRecord({ pathValue, status = 'online' }) {
  const nestedEnv = {
    NODE_ENV: 'development',
    PATH: pathValue,
    JWT_SECRET: PH.jwt,
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    DB_NAME: 'titangold_db',
    DB_USER: 'tg_rot_b_0824',
    DB_PASSWORD: PH.dbPass,
    MASTER_KEY: PH.master,
    HOME: '/home/ubuntu',
    USER: 'ubuntu',
  };
  const entry = {
    name: 'titan-engine-worker',
    status,
    exec_mode: 'fork_mode',
    pm_exec_path: '/app/backend/workers/engineWorkerLeader.js',
    pm_cwd: '/app/backend',
    exec_interpreter: 'node',
    namespace: 'default',
    node_args: [],
    autorestart: true,
    watch: false,
    kill_timeout: 1600,
    kill_retry_time: 100,
    max_memory_restart: '1G',
    username: 'ubuntu',
    windowsHide: true,
    NODE_APP_INSTANCE: 0,
    merge_logs: true,
    filter_env: [],
    km_link: false,
    PM2_HOME: '/home/ubuntu/.pm2',
    env_file: '',
    restart_delay: 1000,
    exp_backoff_restart_delay: 100,
    // regenerated / volatile present in dump shape
    unique_id: 'placeholder-unique-id',
    created_at: 1000,
    restart_time: 2,
    version: '1.0.0',
    node_version: '20.19.5',
    pm_out_log_path: '/home/ubuntu/.pm2/logs/engine-out.log',
    pm_err_log_path: '/home/ubuntu/.pm2/logs/engine-err.log',
    pm_pid_path: '/home/ubuntu/.pm2/pids/engine.pid',
    error_file: '/home/ubuntu/.pm2/logs/engine-err.log',
    out_file: '/home/ubuntu/.pm2/logs/engine-out.log',
    // NO pm_id, NO instances (dumpProcessList deleted)
    env: { ...nestedEnv },
  };
  // Top-level mirrors of nested env (production dump shape)
  for (const [k, v] of Object.entries(nestedEnv)) {
    entry[k] = v;
  }
  // Process-name key quirk
  entry['titan-engine-worker'] = '[]';
  return entry;
}

/**
 * @returns {{ dump: object[], liveClassEnvKeys: Set<string>, meta: object }}
 */
export function buildProductionDumpShapeFixture({ pathEqual = false } = {}) {
  const path0 = pathEqual ? PH.pathCanon : PH.pathNonCanon;
  const path1 = PH.pathCanon;
  const dump = [
    engineRecord({ pathValue: path0 }),
    engineRecord({ pathValue: path1 }),
    {
      name: 'titan-backend',
      status: 'online',
      exec_mode: 'cluster_mode',
      pm_exec_path: '/app/backend/server.js',
      pm_cwd: '/app/backend',
      env: { NODE_ENV: 'development', PATH: PH.pathCanon, BACKEND_SECRET: 'PLACEHOLDER' },
      PATH: PH.pathCanon,
      NODE_ENV: 'development',
      BACKEND_SECRET: 'PLACEHOLDER',
    },
  ];
  const liveKeys = new Set(Object.keys(dump[0].env));
  return {
    dump,
    liveClassEnvKeys: liveKeys,
    meta: {
      PRODUCTION_DUMP_SHAPE_FIXTURE: 'PASS',
      PM2_DUMP_TRANSFORM_MODEL: 'PASS',
      hasNestedEnv: true,
      hasPmId: false,
      hasInstances: false,
      engineCount: 2,
      pathEqual,
    },
  };
}

export function buildLiveEnginePairMatchingFixture(dumpEngines) {
  // Live God shape: pm2_env wrapper + nested env; no instances (standalone)
  return dumpEngines.map((d, i) => {
    const env = { ...d.env };
    return {
      name: d.name,
      pm_id: i === 0 ? 5 : 9,
      pid: 1000 + i,
      status: 'online',
      pm2_env: {
        ...d,
        pm_id: i === 0 ? 5 : 9,
        // instances remain absent (standalone prepare)
        env,
      },
    };
  });
}
