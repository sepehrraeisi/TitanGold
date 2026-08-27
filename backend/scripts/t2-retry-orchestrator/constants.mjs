/**
 * T2 retry orchestrator — durable constants (no production side effects).
 * TOOL_VERSION 1.6.1 — equal-PATH live tie-break + symmetric equivalent dump slots.
 */

export const TOOL_NAME = 't2-retry-orchestrator';
export const TOOL_VERSION = '1.6.1';

export const AUTHORIZED_TRANSACTION =
  'T2_ENGINE_SINGLETON_EQUIVALENT_DUMP_PROJECTED_PERSIST';

export const AUTHORIZED_EFFECTS = Object.freeze([
  'ENGINE_2_TO_1',
  'PROJECTED_DUMP_WRITE_0600',
]);

/** Legacy 1.6.0 identity — must fail closed against 1.6.1 auth. */
export const LEGACY_AUTHORIZED_TRANSACTION_1_6_0 =
  'T2_ENGINE_SINGLETON_DB_ALREADY_PRESENT_PROJECTED_PERSIST';

/** Legacy 1.5.0 identity — must fail closed. */
export const LEGACY_AUTHORIZED_TRANSACTION_1_5_0 =
  'T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PROJECTED_PERSIST';

/** Legacy 1.4.0 identity — must fail closed. */
export const LEGACY_AUTHORIZED_TRANSACTION_1_4_0 =
  'T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PERSIST_DUMP_HARDEN';

export const DUMP_ENGINE_MAPPING_MODE = Object.freeze({
  UNIQUE_SEMANTIC_IDENTITY: 'UNIQUE_SEMANTIC_IDENTITY',
  SYMMETRIC_EQUIVALENT_SLOTS: 'SYMMETRIC_EQUIVALENT_SLOTS',
  /** Persisted PATH-only dump asymmetry under LIVE symmetric class — no pm_id identity. */
  CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY: 'CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY',
});

export const LIVE_ENGINE_PAIR_MODE = Object.freeze({
  UNIQUE_CANONICAL_PATH: 'UNIQUE_CANONICAL_PATH',
  SYMMETRIC_RUNTIME_EQUIVALENT: 'SYMMETRIC_RUNTIME_EQUIVALENT',
});

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

export const COLLECTOR_DB_PRESTATE = Object.freeze({
  ABSENT: 'ABSENT',
  ALREADY_PRESENT_EXACT: 'ALREADY_PRESENT_EXACT',
  PARTIAL: 'PARTIAL',
  PRESENT_MISMATCHED: 'PRESENT_MISMATCHED',
  UNSUPPORTED: 'UNSUPPORTED',
});

/** Final active dump mode required after successful projected write. */
export const REQUIRED_PROJECTED_DUMP_MODE = 0o600;

/** @deprecated Use REQUIRED_PROJECTED_DUMP_MODE — kept for historical journal parsers. */
export const REQUIRED_POST_SAVE_DUMP_MODE = REQUIRED_PROJECTED_DUMP_MODE;

/** Session / IDE / shell keys restored by dump sanitization (names only). */
export const SESSION_IDE_ENV_KEYS = Object.freeze([
  'PWD',
  'OLDPWD',
  'SSH_CLIENT',
  'SSH_CONNECTION',
  'XDG_SESSION_ID',
  '_',
  '__CURSOR_SANDBOX_ENV_RESTORE',
  'CURSOR_CONVERSATION_ID',
  'CURSOR_RIPGREP_PATH',
  'VSCODE_IPC_HOOK_CLI',
  'VSCODE_NLS_CONFIG',
  'AGENT_TRANSCRIPTS',
  'BROWSER',
]);

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
  'prev_restart_delay',
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
  'pmx_module',
]);

/** Volatile runtime metadata excluded from stable config diffs. */
export const VOLATILE_RUNTIME_KEYS = Object.freeze([
  'pid',
  'pm_uptime',
  'created_at',
  'restart_time',
  'unstable_restarts',
  'prev_restart_delay',
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
  PROJECTION_BUILDING: 'PROJECTION_BUILDING',
  PROJECTION_READY: 'PROJECTION_READY',
  PROJECTION_WRITE_RUNNING: 'PROJECTION_WRITE_RUNNING',
  PROJECTION_WRITTEN: 'PROJECTION_WRITTEN',
  POSTWRITE_VERIFIED: 'POSTWRITE_VERIFIED',
  // Legacy 1.4.0 states (journal parse only — v1.6 must not enter)
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

/** States where guarded rollback mutations are allowed (v1.6 + legacy). */
export const ROLLBACK_ELIGIBLE_STATES = Object.freeze([
  State.BACKUP_VERIFIED,
  State.MUTATION_RUNNING,
  State.ENGINE_SINGLETON_VERIFIED,
  State.PROJECTION_BUILDING,
  State.PROJECTION_READY,
  State.PROJECTION_WRITE_RUNNING,
  State.PROJECTION_WRITTEN,
  State.POSTWRITE_VERIFIED,
  State.SAVE_RUNNING,
  State.SAVE_SUCCESS,
  State.DUMP_HARDENING,
  State.DUMP_HARDENED,
  State.POSTSAVE_VERIFIED,
  State.ROLLBACK_RUNNING,
]);

export const ALLOWED_DIFF_KINDS = Object.freeze([
  'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED',
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
  'COLLECTOR_DB_KEYS_APPEAR',
]);

export const PROVIDER_ENV_KEY_RE =
  /^(MEXC_|OPENAI_|GEMINI_|DEEPSEEK_|OPENROUTER_|ANTHROPIC_|API_KEY|API_SECRET)/i;

export const SUPPORTED_ENV_SHAPES = Object.freeze([
  'entry.env',
  'entry.pm2_env.env',
  'flat_dump_entry',
]);
