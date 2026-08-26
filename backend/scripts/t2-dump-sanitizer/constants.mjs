/**
 * T2 dump sanitizer — durable constants (no production side effects).
 * TOOL_VERSION 1.0.0 — unauthorized persisted state removal + preserve collector DB-B.
 */

export const TOOL_NAME = 'titangold-t2-dump-sanitizer';
export const TOOL_VERSION = '1.0.0';

export const AUTHORIZED_TRANSACTION = 'T2_UNAUTHORIZED_DUMP_SANITIZE_PRESERVE_DB_B';

export const AUTHORIZED_EFFECTS = Object.freeze([
  'SANITIZE_UNAUTHORIZED_PERSISTED_STATE',
  'PRESERVE_COLLECTOR_DB_B_EXACT',
  'ATOMIC_DUMP_WRITE_0600',
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

/** Session / IDE / shell keys restored to CLEAN_PRE (names only). */
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

export const PROVIDER_ENV_KEY_RE =
  /^(MEXC_|OPENAI_|GEMINI_|DEEPSEEK_|OPENROUTER_|ANTHROPIC_|API_KEY|API_SECRET)/i;

/** Final active dump mode required after successful sanitized write. */
export const REQUIRED_DUMP_MODE = 0o600;

export const State = Object.freeze({
  AUTHORIZED_UNCONSUMED: 'AUTHORIZED_UNCONSUMED',
  PRECHECK_RUNNING: 'PRECHECK_RUNNING',
  PRECHECK_PASS: 'PRECHECK_PASS',
  BACKUP_VERIFIED: 'BACKUP_VERIFIED',
  SANITIZE_BUILDING: 'SANITIZE_BUILDING',
  SANITIZE_READY: 'SANITIZE_READY',
  SANITIZE_WRITE_RUNNING: 'SANITIZE_WRITE_RUNNING',
  SANITIZE_WRITTEN: 'SANITIZE_WRITTEN',
  POSTWRITE_VERIFIED: 'POSTWRITE_VERIFIED',
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

export const ROLLBACK_ELIGIBLE_STATES = Object.freeze([
  State.BACKUP_VERIFIED,
  State.SANITIZE_BUILDING,
  State.SANITIZE_READY,
  State.SANITIZE_WRITE_RUNNING,
  State.SANITIZE_WRITTEN,
  State.POSTWRITE_VERIFIED,
  State.ROLLBACK_RUNNING,
]);
