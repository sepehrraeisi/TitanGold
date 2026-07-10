/**
 * DH-TELEGRAM-PUBLISHER-P3 — runtime delivery mode control
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const runtimeMode = await import('../../services/telegramPublisherRuntimeModeService.js');
const {
  runPublisherTest,
  runPublisherPublish,
} = await import('../../services/telegramPublisherService.js');

const PUBLISHER_ID = '887495e6-0b47-4450-88ef-35dd43477f9a';
const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER = {
  id: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
  email: 'admin@local',
  full_name: 'Admin',
  role: 'admin',
};
const VIEWER_USER = { id: '22222222-2222-4222-8222-222222222222', role: 'viewer' };

const accessControl = {
  enforced: true,
  allowed: true,
  sourceId: SOURCE_ID,
  agentKey: 'publisher',
};

function runtimeSettingsRow(overrides = {}) {
  return {
    id: 'default',
    mode: 'dry_run',
    is_live_enabled: false,
    live_test_expires_at: null,
    live_test_remaining_sends: 0,
    changed_by_user_id: null,
    changed_by_email: null,
    changed_by_name: null,
    reason: 'Initial default — dry-run safest mode',
    created_at: new Date(),
    updated_at: new Date(),
    last_changed_at: new Date(),
    ...overrides,
  };
}

function installRuntimeQueryHandlers(modeOverrides = {}) {
  mockQuery.mockImplementation(async (sql, params = []) => {
    const text = String(sql);
    if (text.includes('INSERT INTO telegram_publisher_runtime_settings')) {
      return { rows: [] };
    }
    if (text.includes('FROM telegram_publisher_runtime_settings')) {
      return { rows: [runtimeSettingsRow(modeOverrides)] };
    }
    if (text.includes('UPDATE telegram_publisher_runtime_settings')) {
      return { rows: [] };
    }
    if (text.includes('INSERT INTO telegram_publisher_runtime_audit')) {
      return { rows: [] };
    }
    if (text.includes('FROM publisher_delivery_history')) {
      return {
        rows: [{
          sent_today: 0,
          dry_runs_today: 0,
          failed_today: 0,
          last_telegram_delivery_at: null,
        }],
      };
    }
    if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [] };
    if (text.includes('SELECT id FROM datahub_publisher_source_mappings')) {
      return { rows: [{ id: 'mapping-1' }] };
    }
    if (text.includes('SELECT * FROM telegram_publishers')) {
      return {
        rows: [{
          id: PUBLISHER_ID,
          is_active: true,
          template: '{message}',
          channel_id: '104595348',
          bot_token_encrypted: 'enc:token',
        }],
      };
    }
    if (text.includes('INSERT INTO publisher_delivery_history')) {
      return { rows: [{ id: 'hist-runtime-1' }] };
    }
    if (text.includes('UPDATE telegram_publishers')) {
      return { rows: [] };
    }
    if (text.includes('telegram_publisher_runtime_audit')) {
      return { rows: [] };
    }
    return { rows: [], rowCount: 0 };
  });
}

describe('telegramPublisherRuntimeModeService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockFetch.mockReset();
    delete process.env.TELEGRAM_PUBLISHER_DRY_RUN;
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_PUBLISHER_DRY_RUN;
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
  });

  it('defaults effective mode to dry_run', async () => {
    installRuntimeQueryHandlers();
    const effective = await runtimeMode.getEffectiveMode();
    expect(effective).toBe('dry_run');
  });

  it('env override forces effective dry_run even if DB mode is live', async () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'true';
    installRuntimeQueryHandlers({ mode: 'live', is_live_enabled: true });
    const effective = await runtimeMode.getEffectiveMode();
    expect(effective).toBe('dry_run');
    const view = await runtimeMode.buildRuntimeModeView(ADMIN_USER);
    expect(view.configuredMode).toBe('live');
    expect(view.effectiveMode).toBe('dry_run');
    expect(view.serverSafetyOverride).toBe(true);
    expect(view.canChangeMode).toBe(false);
  });

  it('legacy TELEGRAM_PUBLISHER_DRY_RUN=true acts as emergency override when FORCE unset', () => {
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
    process.env.TELEGRAM_PUBLISHER_DRY_RUN = 'true';
    expect(runtimeMode.isServerSafetyOverrideActive()).toBe(true);
  });

  it('explicit FORCE_DRY_RUN=false disables legacy DRY_RUN override', () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'false';
    process.env.TELEGRAM_PUBLISHER_DRY_RUN = 'true';
    expect(runtimeMode.isServerSafetyOverrideActive()).toBe(false);
  });

  it('admin can set live_test with confirm, reason, and acknowledgement', async () => {
    installRuntimeQueryHandlers();
    const view = await runtimeMode.setRuntimeMode({
      mode: 'live_test',
      reason: 'Operator approved one-shot live test',
      user: ADMIN_USER,
      acknowledgeLiveDeliveryRisk: true,
      confirmRuntimeModeChange: true,
    });
    expect(view).toBeTruthy();
    expect(
      mockQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE telegram_publisher_runtime_settings')),
    ).toBe(true);
  });

  it('rejects mode change without reason', async () => {
    installRuntimeQueryHandlers();
    await expect(
      runtimeMode.setRuntimeMode({
        mode: 'dry_run',
        reason: 'x',
        user: ADMIN_USER,
        confirmRuntimeModeChange: true,
      }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('rejects live mode without acknowledgement', async () => {
    installRuntimeQueryHandlers();
    await expect(
      runtimeMode.setRuntimeMode({
        mode: 'live',
        reason: 'Enable permanent live',
        user: ADMIN_USER,
        confirmRuntimeModeChange: true,
      }),
    ).rejects.toMatchObject({ code: 'ACKNOWLEDGEMENT_REQUIRED' });
  });

  it('blocks viewer from changing mode', async () => {
    await expect(
      runtimeMode.setRuntimeMode({
        mode: 'dry_run',
        reason: 'viewer attempt',
        user: VIEWER_USER,
        confirmRuntimeModeChange: true,
      }),
    ).rejects.toMatchObject({ code: 'RUNTIME_MODE_ADMIN_ONLY' });
  });

  it('rejects live enable when server override active', async () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'true';
    installRuntimeQueryHandlers();
    await expect(
      runtimeMode.setRuntimeMode({
        mode: 'live',
        reason: 'Should be blocked',
        user: ADMIN_USER,
        acknowledgeLiveDeliveryRisk: true,
        confirmRuntimeModeChange: true,
      }),
    ).rejects.toMatchObject({ code: 'SERVER_DRY_RUN_OVERRIDE_ACTIVE' });
  });

  it('live_test expires when remaining sends is zero', async () => {
    installRuntimeQueryHandlers({
      mode: 'live_test',
      live_test_remaining_sends: 0,
      live_test_expires_at: new Date(Date.now() + 600000),
    });
    const effective = await runtimeMode.getEffectiveMode();
    expect(effective).toBe('dry_run');
  });

  it('consumeLiveTestIfNeeded reverts configured mode after successful send context', async () => {
    installRuntimeQueryHandlers({
      mode: 'live_test',
      live_test_remaining_sends: 1,
      live_test_expires_at: new Date(Date.now() + 600000),
    });
    const consumed = await runtimeMode.consumeLiveTestIfNeeded({
      userId: ADMIN_USER.id,
      historyId: 'hist-runtime-1',
    });
    expect(consumed.consumed).toBe(true);
  });
});

describe('telegramPublisherDelivery with runtime mode', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockFetch.mockReset();
    delete process.env.TELEGRAM_PUBLISHER_DRY_RUN;
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
    process.env.NODE_ENV = 'test';
  });

  it('runPublisherTest records dry_run without Telegram API in dry_run mode', async () => {
    installRuntimeQueryHandlers();
    const result = await runPublisherTest(PUBLISHER_ID, 'dry-run test', 'user-1');
    expect(result.dry_run).toBe(true);
    expect(result.effectiveMode).toBe('dry_run');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('runPublisherTest sends live when DB mode is live', async () => {
    installRuntimeQueryHandlers({ mode: 'live', is_live_enabled: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 321 } }),
    });
    const result = await runPublisherTest(PUBLISHER_ID, 'live test', 'user-1');
    expect(result.status).toBe('sent');
    expect(result.effectiveMode).toBe('live');
    expect(result.telegram_message_id).toBe('321');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('runPublisherPublish dry-run never calls Telegram API', async () => {
    installRuntimeQueryHandlers();
    const result = await runPublisherPublish(
      PUBLISHER_ID,
      {
        message: 'hello',
        confirm_publish: true,
        source_id: SOURCE_ID,
        content_type: 'manual',
        accessControl,
      },
      'user-1',
    );
    expect(result.dry_run).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('runPublisherPublish live_test consumes mode after successful send', async () => {
    installRuntimeQueryHandlers({
      mode: 'live_test',
      live_test_remaining_sends: 1,
      live_test_expires_at: new Date(Date.now() + 600000),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 555 } }),
    });
    const result = await runPublisherPublish(
      PUBLISHER_ID,
      {
        message: 'live test publish',
        confirm_publish: true,
        source_id: SOURCE_ID,
        content_type: 'manual',
        accessControl,
      },
      'user-1',
    );
    expect(result.status).toBe('sent');
    expect(result.effectiveMode).toBe('live_test');
    expect(result.liveTestConsumed).toBe(true);
    expect(result.telegram_message_id).toBe('555');
  });
});
