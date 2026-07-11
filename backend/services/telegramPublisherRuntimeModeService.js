import { query } from '../database/db.js';

export const RUNTIME_MODES = ['dry_run', 'live_test', 'live'];
export const SINGLETON_KEY = 'default';
const LIVE_TEST_DURATION_MS = 10 * 60 * 1000;

const SETTINGS_SELECT = `
  SELECT
    id,
    mode,
    is_live_enabled,
    live_test_expires_at,
    live_test_remaining_sends,
    changed_by_user_id,
    changed_by_email,
    changed_by_name,
    reason,
    created_at,
    updated_at,
    last_changed_at
  FROM telegram_publisher_runtime_settings
  WHERE id = $1
`;

function mapSettingsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mode: row.mode,
    isLiveEnabled: row.is_live_enabled === true,
    liveTestExpiresAt: row.live_test_expires_at
      ? new Date(row.live_test_expires_at).toISOString()
      : null,
    liveTestRemainingSends: Number(row.live_test_remaining_sends) || 0,
    changedByUserId: row.changed_by_user_id || null,
    changedByEmail: row.changed_by_email || null,
    changedByName: row.changed_by_name || null,
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastChangedAt: new Date(row.last_changed_at).toISOString(),
  };
}

export function isServerSafetyOverrideActive() {
  if (process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN === 'true') return true;
  if (process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN === 'false') return false;
  if (process.env.TELEGRAM_PUBLISHER_DRY_RUN === 'true') return true;
  return false;
}

/** @deprecated Use isServerSafetyOverrideActive — kept for list endpoint compatibility */
export function isPublisherDryRunForced() {
  return isServerSafetyOverrideActive();
}

export function assertCanChangeMode(user) {
  if (!user) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  if (user.role !== 'admin') {
    const err = new Error('Only administrators can change publisher runtime mode');
    err.status = 403;
    err.code = 'RUNTIME_MODE_ADMIN_ONLY';
    throw err;
  }
}

async function ensureSettingsRow() {
  await query(
    `INSERT INTO telegram_publisher_runtime_settings (id, mode, is_live_enabled, reason)
     VALUES ($1, 'dry_run', FALSE, 'Initial default — dry-run safest mode')
     ON CONFLICT (id) DO NOTHING`,
    [SINGLETON_KEY],
  );
}

export async function auditModeChange({
  oldMode = null,
  newMode,
  userId = null,
  reason,
  eventType,
  metadata = {},
}) {
  await query(
    `INSERT INTO telegram_publisher_runtime_audit
      (old_mode, new_mode, changed_by_user_id, reason, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      oldMode,
      newMode,
      userId,
      reason,
      eventType,
      JSON.stringify(metadata),
    ],
  );
}

export async function getRuntimeMode() {
  await ensureSettingsRow();
  const result = await query(SETTINGS_SELECT, [SINGLETON_KEY]);
  return mapSettingsRow(result.rows[0]);
}

function computeEffectiveModeFromSettings(settings) {
  if (!settings) return 'dry_run';
  if (settings.mode === 'live') return 'live';
  if (settings.mode === 'live_test') {
    const expiresAt = settings.liveTestExpiresAt
      ? new Date(settings.liveTestExpiresAt).getTime()
      : 0;
    if (expiresAt > 0 && Date.now() >= expiresAt) return 'dry_run';
    if (settings.liveTestRemainingSends <= 0) return 'dry_run';
    return 'live_test';
  }
  return 'dry_run';
}

export async function expireLiveTestIfNeeded() {
  const settings = await getRuntimeMode();
  if (!settings || settings.mode !== 'live_test') return { expired: false, settings };

  const expiresAt = settings.liveTestExpiresAt
    ? new Date(settings.liveTestExpiresAt).getTime()
    : 0;
  const expiredByTime = expiresAt > 0 && Date.now() >= expiresAt;
  const expiredBySends = settings.liveTestRemainingSends <= 0;

  if (!expiredByTime && !expiredBySends) {
    return { expired: false, settings };
  }

  const reason = expiredByTime
    ? 'Live test window expired (10 minutes)'
    : 'Live test send quota consumed';

  await query(
    `UPDATE telegram_publisher_runtime_settings SET
      mode = 'dry_run',
      is_live_enabled = FALSE,
      live_test_expires_at = NULL,
      live_test_remaining_sends = 0,
      reason = $2,
      updated_at = NOW(),
      last_changed_at = NOW()
     WHERE id = $1`,
    [SINGLETON_KEY, reason],
  );

  await auditModeChange({
    oldMode: 'live_test',
    newMode: 'dry_run',
    reason,
    eventType: 'live_test_expired',
    metadata: {
      expired_by_time: expiredByTime,
      expired_by_sends: expiredBySends,
      live_test_expires_at: settings.liveTestExpiresAt,
    },
  });

  const refreshed = await getRuntimeMode();
  return { expired: true, settings: refreshed };
}

export async function getEffectiveMode() {
  if (isServerSafetyOverrideActive()) return 'dry_run';
  await expireLiveTestIfNeeded();
  const settings = await getRuntimeMode();
  return computeEffectiveModeFromSettings(settings);
}

async function fetchDeliveryStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'sent'
          AND COALESCE(metadata->>'delivery_mode', '') IN ('live', 'live_test')
          AND created_at >= date_trunc('day', NOW())
      )::int AS sent_today,
      COUNT(*) FILTER (
        WHERE status = 'dry_run'
          AND created_at >= date_trunc('day', NOW())
      )::int AS dry_runs_today,
      COUNT(*) FILTER (
        WHERE status = 'failed'
          AND created_at >= date_trunc('day', NOW())
      )::int AS failed_today,
      MAX(created_at) FILTER (
        WHERE status = 'sent'
          AND telegram_message_id IS NOT NULL
          AND COALESCE(metadata->>'delivery_mode', '') IN ('live', 'live_test')
      ) AS last_telegram_delivery_at
    FROM publisher_delivery_history
  `);
  const row = result.rows[0] || {};
  return {
    messagesSentToday: parseInt(row.sent_today, 10) || 0,
    dryRunsToday: parseInt(row.dry_runs_today, 10) || 0,
    failedSendsToday: parseInt(row.failed_today, 10) || 0,
    lastTelegramDeliveryAt: row.last_telegram_delivery_at
      ? new Date(row.last_telegram_delivery_at).toISOString()
      : null,
  };
}

export async function buildRuntimeModeView(user = null) {
  const serverSafetyOverride = isServerSafetyOverrideActive();
  const settings = await getRuntimeMode();
  const configuredMode = settings?.mode || 'dry_run';
  const effectiveMode = serverSafetyOverride
    ? 'dry_run'
    : computeEffectiveModeFromSettings(settings);
  const stats = await fetchDeliveryStats();

  const warnings = [];
  if (serverSafetyOverride) {
    warnings.push('Live mode disabled by server safety override');
  }
  if (configuredMode === 'live' && effectiveMode === 'dry_run' && !serverSafetyOverride) {
    warnings.push('Configured live mode is not effective — check live_test expiry or remaining sends');
  }

  let canChangeMode = false;
  if (user?.role === 'admin' && !serverSafetyOverride) {
    canChangeMode = true;
  }

  return {
    configuredMode,
    effectiveMode,
    serverSafetyOverride,
    liveTestExpiresAt: settings?.liveTestExpiresAt || null,
    liveTestRemainingSends: settings?.liveTestRemainingSends ?? 0,
    lastChangedBy: settings?.changedByEmail || settings?.changedByName || null,
    lastChangedAt: settings?.lastChangedAt || null,
    reason: settings?.reason || null,
    canChangeMode,
    warnings,
    stats,
  };
}

function eventTypeForMode(mode) {
  if (mode === 'live') return 'live_enabled';
  if (mode === 'live_test') return 'live_test_started';
  return 'dry_run_enabled';
}

export async function setRuntimeMode({
  mode,
  reason,
  user,
  acknowledgeLiveDeliveryRisk = false,
  confirmRuntimeModeChange = false,
}) {
  assertCanChangeMode(user);

  if (!confirmRuntimeModeChange) {
    const err = new Error('confirm_runtime_mode_change must be true');
    err.status = 400;
    err.code = 'CONFIRMATION_REQUIRED';
    throw err;
  }

  if (!reason || String(reason).trim().length < 5) {
    const err = new Error('reason is required (minimum 5 characters)');
    err.status = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  if (!RUNTIME_MODES.includes(mode)) {
    const err = new Error('Invalid runtime mode');
    err.status = 400;
    throw err;
  }

  if ((mode === 'live' || mode === 'live_test') && !acknowledgeLiveDeliveryRisk) {
    const err = new Error('acknowledge_live_delivery_risk must be true for live modes');
    err.status = 400;
    err.code = 'ACKNOWLEDGEMENT_REQUIRED';
    throw err;
  }

  if (isServerSafetyOverrideActive() && (mode === 'live' || mode === 'live_test')) {
    const err = new Error('Cannot enable live modes while server safety override is active');
    err.status = 409;
    err.code = 'SERVER_DRY_RUN_OVERRIDE_ACTIVE';
    throw err;
  }

  const current = await getRuntimeMode();
  const oldMode = current?.mode || 'dry_run';

  const liveTestExpiresAt =
    mode === 'live_test' ? new Date(Date.now() + LIVE_TEST_DURATION_MS) : null;
  const liveTestRemainingSends = mode === 'live_test' ? 1 : 0;
  const isLiveEnabled = mode === 'live';

  await query(
    `UPDATE telegram_publisher_runtime_settings SET
      mode = $2,
      is_live_enabled = $3,
      live_test_expires_at = $4,
      live_test_remaining_sends = $5,
      changed_by_user_id = $6,
      changed_by_email = $7,
      changed_by_name = $8,
      reason = $9,
      updated_at = NOW(),
      last_changed_at = NOW()
     WHERE id = $1`,
    [
      SINGLETON_KEY,
      mode,
      isLiveEnabled,
      liveTestExpiresAt,
      liveTestRemainingSends,
      user.id,
      user.email || null,
      user.full_name || user.username || null,
      String(reason).trim(),
    ],
  );

  await auditModeChange({
    oldMode,
    newMode: mode,
    userId: user.id,
    reason: String(reason).trim(),
    eventType: eventTypeForMode(mode),
    metadata: {
      live_test_expires_at: liveTestExpiresAt
        ? liveTestExpiresAt.toISOString()
        : null,
      live_test_remaining_sends: liveTestRemainingSends,
    },
  });

  return buildRuntimeModeView(user);
}

export async function consumeLiveTestIfNeeded({ userId = null, historyId = null } = {}) {
  const settings = await getRuntimeMode();
  if (!settings || settings.mode !== 'live_test') {
    return { consumed: false, settings };
  }

  if (settings.liveTestRemainingSends <= 0) {
    return { consumed: false, settings };
  }

  await query(
    `UPDATE telegram_publisher_runtime_settings SET
      mode = 'dry_run',
      is_live_enabled = FALSE,
      live_test_expires_at = NULL,
      live_test_remaining_sends = 0,
      reason = 'Live test consumed after successful Telegram delivery',
      updated_at = NOW(),
      last_changed_at = NOW()
     WHERE id = $1`,
    [SINGLETON_KEY],
  );

  await auditModeChange({
    oldMode: 'live_test',
    newMode: 'dry_run',
    userId,
    reason: 'Live test consumed after successful Telegram delivery',
    eventType: 'live_test_consumed',
    metadata: { history_id: historyId },
  });

  const refreshed = await getRuntimeMode();
  return { consumed: true, settings: refreshed };
}

export async function listRuntimeModeAudit({ limit = 20 } = {}) {
  const result = await query(
    `SELECT
      a.id,
      a.old_mode,
      a.new_mode,
      a.changed_by_user_id,
      a.reason,
      a.event_type,
      a.metadata,
      a.created_at,
      u.email AS changed_by_email,
      u.full_name AS changed_by_name
     FROM telegram_publisher_runtime_audit a
     LEFT JOIN users u ON u.id = a.changed_by_user_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [Math.min(limit, 100)],
  );

  return result.rows.map(row => ({
    id: row.id,
    oldMode: row.old_mode,
    newMode: row.new_mode,
    changedByUserId: row.changed_by_user_id,
    changedByEmail: row.changed_by_email || null,
    changedByName: row.changed_by_name || null,
    reason: row.reason,
    eventType: row.event_type,
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function resolvePublishDeliveryContext() {
  const view = await buildRuntimeModeView();
  const effectiveMode = view.effectiveMode;
  const configuredMode = view.configuredMode;
  const serverSafetyOverride = view.serverSafetyOverride;

  return {
    configuredMode,
    effectiveMode,
    serverSafetyOverride,
    willSendLive: effectiveMode === 'live' || effectiveMode === 'live_test',
    deliveryMode: effectiveMode === 'dry_run' ? 'dry_run' : effectiveMode,
    runtimeModeReason: view.reason,
  };
}

export function attachRuntimeFields(result, context, { liveTestConsumed = false } = {}) {
  return {
    ...result,
    configuredMode: context.configuredMode,
    effectiveMode: context.effectiveMode,
    serverSafetyOverride: context.serverSafetyOverride,
    dryRun: context.effectiveMode === 'dry_run' || Boolean(result.dry_run),
    liveTestConsumed,
    runtimeModeReason: context.runtimeModeReason || null,
  };
}
