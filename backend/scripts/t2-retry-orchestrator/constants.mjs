/**
 * T2 retry orchestrator — durable constants (no production side effects).
 */

export const TOOL_NAME = 't2-retry-orchestrator';
export const TOOL_VERSION = '1.4.0';

export const AUTHORIZED_TRANSACTION =
  'T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PERSIST_DUMP_HARDEN';

export const AUTHORIZED_EFFECTS = Object.freeze([
  'ENGINE_2_TO_1',
  'COLLECTOR_DB_B_PERSIST',
  'DUMP_MODE_HARDEN_0600',
]);

export const ENGINE_NAME = 'titan-engine-worker';
export const BACKEND_NAME = 'titan-backend';
export const PROCESSOR_NAME = 'telegram-processor';
export const COLLECTOR_NAME = 'telegram-collector';
export const MONITOR_NAME = 'telegram-collector-monitor';

export const EXPECTED_COLLECTOR_DB_USER = 'tg_rot_b_0824';

export const COLLECTOR_DB_KEYS = Object.freeze([
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
]);

/** Final active dump mode required after successful forward save + harden. */
export const REQUIRED_POST_SAVE_DUMP_MODE = 0o600;

/** PM2 metadata / launch fields that must never be treated as application env. */
export const PM2_METADATA_KEYS = Object.freeze([
  'pm_id',
  'pmId',
  'name',
  'status',
  'pm_pid_path',
  'pm_err_log_path',
  'pm_out_log_path',
  'pm_log_path',
  'pm_cwd',
  'pm_exec_path',
  'exec_mode',
  'exec_interpreter',
  'instances',
  'pm_uptime',
  'created_at',
  'restart_time',
  'unstable_restarts',
  'axm_actions',
  'axm_monitor',
  'axm_options',
  'axm_dynamic',
  'vizion',
  'vizion_running',
  'NODE_APP_INSTANCE',
  'unique_id',
  'km_link',
  'pmx',
  'automation',
  'autorestart',
  'autostart',
  'watch',
  'filter_env',
  'namespace',
  'version',
  'exit_code',
  'node_args',
  'args',
  'env',
  'pm2_env',
  'cwd',
  'script',
  'pid',
  'monit',
  'pm_id',
  'windowsHide',
  'kill_retry_time',
  'max_memory_restart',
  'treekill',
  'username',
  'merge_logs',
  'source_map_support',
  'instance_var',
  'env_production',
  'env_development',
  'env_file',
  'updateEnv',
  'node_version',
  'PM2_HOME',
  'PM2_JSON_PROCESSING',
  'PM2_USAGE',
]);

/** Volatile runtime metadata excluded from stable config diffs. */
export const VOLATILE_RUNTIME_KEYS = Object.freeze([
  'pid',
  'pm_uptime',
  'created_at',
  'restart_time',
  'unstable_restarts',
  'axm_monitor',
  'axm_actions',
  'axm_dynamic',
  'monit',
  'memory',
  'cpu',
  'exit_code',
]);

/** Stable launch/config fields compared across dump/live. */
export const STABLE_CONFIG_FIELDS = Object.freeze([
  'name',
  'script',
  'cwd',
  'exec_mode',
  'interpreter',
  'instances',
  'namespace',
  'args',
  'node_args',
  'autorestart',
  'watch',
]);

export const State = Object.freeze({
  AUTHORIZED_UNCONSUMED: 'AUTHORIZED_UNCONSUMED',
  PRECHECK_RUNNING: 'PRECHECK_RUNNING',
  PRECHECK_PASS: 'PRECHECK_PASS',
  BACKUP_VERIFIED: 'BACKUP_VERIFIED',
  MUTATION_RUNNING: 'MUTATION_RUNNING',
  ENGINE_SINGLETON_VERIFIED: 'ENGINE_SINGLETON_VERIFIED',
  SAVE_RUNNING: 'SAVE_RUNNING',
  SAVE_SUCCESS: 'SAVE_SUCCESS',
  DUMP_HARDENING: 'DUMP_HARDENING',
  DUMP_HARDENED: 'DUMP_HARDENED',
  POSTSAVE_VERIFIED: 'POSTSAVE_VERIFIED',
  ROLLBACK_RUNNING: 'ROLLBACK_RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  FAIL_FORWARD_COMPLETE: 'FAIL_FORWARD_COMPLETE',
});

export const TERMINAL_STATES = Object.freeze([
  State.COMPLETED,
  State.FAILED,
  State.ROLLED_BACK,
  State.FAIL_FORWARD_COMPLETE,
]);

/** States where guarded rollback mutations are allowed. */
export const ROLLBACK_ELIGIBLE_STATES = Object.freeze([
  State.BACKUP_VERIFIED,
  State.MUTATION_RUNNING,
  State.ENGINE_SINGLETON_VERIFIED,
  State.SAVE_RUNNING,
  State.SAVE_SUCCESS,
  State.DUMP_HARDENING,
  State.DUMP_HARDENED,
  State.POSTSAVE_VERIFIED,
  State.ROLLBACK_RUNNING,
]);

export const ALLOWED_DIFF_KINDS = Object.freeze([
  'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED',
  'COLLECTOR_DB_KEYS_APPEAR',
  'DUMP_SHA_CHANGED',
]);

export const FORBIDDEN_DIFF_KINDS = Object.freeze([
  'NODE_ENV_CHANGE',
  'BACKEND_TOPOLOGY_CHANGE',
  'PROCESSOR_TOPOLOGY_CHANGE',
  'MONITOR_TOPOLOGY_CHANGE',
  'ENV_KEY_ADDED',
  'ENV_KEY_REMOVED',
  'ENV_VALUE_CHANGED',
  'UNRELATED_ENV_CHANGE',
  'TELEGRAM_TOKEN_ENV_RESTORED',
  'PROVIDER_ENV_CHANGE',
  'UNRELATED_PROCESS_CHANGE',
  'SCRIPT_CHANGED',
  'CWD_CHANGED',
  'ARGS_CHANGED',
  'EXEC_MODE_CHANGED',
  'PROCESS_CONFIG_CHANGED',
  'COLLECTOR_DB_LIVE_PERSIST_MISMATCH',
]);

export const PROVIDER_ENV_KEY_RE =
  /^(MEXC_|OPENAI_|GEMINI_|DEEPSEEK_|OPENROUTER_|ANTHROPIC_|API_KEY|API_SECRET)/i;

export const SUPPORTED_ENV_SHAPES = Object.freeze([
  'entry.env',
  'entry.pm2_env.env',
  'flat_dump_entry',
]);
