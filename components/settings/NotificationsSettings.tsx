import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import {
  fetchNotificationChannels,
  fetchNotificationPreferences,
  fetchUnifiedNotificationHistory,
  testNotificationChannel,
  updateNotificationPreferences,
  type UnifiedNotificationChannels,
  type UnifiedNotificationHistoryItem,
  type UnifiedNotificationPreferences,
} from '../../services/api.ts';

type ActiveTab = 'channels' | 'preferences' | 'history';
type HistoryFilter = 'all' | 'sent' | 'failed' | 'blocked' | 'dry_run';

const DEFAULT_PREFERENCES: UnifiedNotificationPreferences = {
  telegram_enabled: false,
  browser_enabled: false,
  email_enabled: false,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  do_not_disturb_enabled: false,
  frequency_level: 'normal',
};

const DEFAULT_CHANNELS: UnifiedNotificationChannels = {
  telegram: {
    status: 'not_configured',
    provider: 'telegram_publisher',
    configured: false,
    enabled: false,
    publisherId: null,
    publisherName: null,
    destinationMasked: null,
  },
  browser: {
    status: 'disabled',
    configured: true,
    enabled: false,
  },
  email: {
    status: 'coming_soon',
    configured: false,
    enabled: false,
  },
};

const sectionErrorMessage = {
  channels: 'Channel data is temporarily unavailable. Showing safe defaults.',
  preferences: 'Preference data is temporarily unavailable. Saved values are unchanged.',
  history: 'History data is temporarily unavailable. Try refresh after connectivity recovers.',
};

const isAuthExpiredError = (error: unknown) =>
  error instanceof Error &&
  (error.message === 'AUTH_EXPIRED' || (error as Error & { code?: string }).code === 'AUTH_EXPIRED');

type BrowserPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

const getBrowserPermissionStatus = (): BrowserPermissionStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

const isBrowserChannelEnabled = (browserEnabled: boolean) =>
  getBrowserPermissionStatus() === 'granted' && browserEnabled === true;

const mergeChannels = (channels?: Partial<UnifiedNotificationChannels>): UnifiedNotificationChannels => ({
  telegram: { ...DEFAULT_CHANNELS.telegram, ...(channels?.telegram || {}) },
  browser: { ...DEFAULT_CHANNELS.browser, ...(channels?.browser || {}) },
  email: { ...DEFAULT_CHANNELS.email, ...(channels?.email || {}) },
});

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const statusTone = (status: string) => {
  if (['configured', 'enabled', 'sent'].includes(status)) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'dry_run') {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-300';
  }
  if (['failed', 'blocked'].includes(status)) {
    return 'border-red-500/40 bg-red-500/10 text-red-300';
  }
  if (status === 'coming_soon' || status === 'coming soon') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-600 bg-slate-700 text-slate-300';
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', statusTone(status))}>
    {status.replace(/_/g, ' ')}
  </span>
);

const Panel: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, action, children }) => (
  <section className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 shadow-lg backdrop-blur-sm">
    <div className="flex flex-col gap-3 border-b border-white/5 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 max-w-3xl text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const MetricTile: React.FC<{ label: string; value: string; tone: 'emerald' | 'blue' | 'purple' | 'amber' }> = ({
  label,
  value,
  tone,
}) => {
  const classes = {
    emerald: 'from-emerald-500/10 via-emerald-500/5 text-emerald-100',
    blue: 'from-blue-500/10 via-blue-500/5 text-blue-100',
    purple: 'from-purple-500/10 via-purple-500/5 text-purple-100',
    amber: 'from-amber-500/10 via-amber-500/5 text-amber-100',
  }[tone];

  return (
    <div className={cx('rounded-xl border border-white/5 bg-gradient-to-br to-transparent p-3 backdrop-blur-sm', classes)}>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
};

const InlineNotice: React.FC<{ children: React.ReactNode; tone?: 'warning' | 'success' }> = ({ children, tone = 'warning' }) => (
  <div
    className={cx(
      'rounded-lg border px-3 py-2 text-[11px]',
      tone === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    )}
  >
    {children}
  </div>
);

const Skeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      {[0, 1, 2, 3].map(item => (
        <div key={item} className="h-20 animate-pulse rounded-xl border border-white/5 bg-slate-900/60" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[0, 1, 2].map(item => (
        <div key={item} className="h-44 animate-pulse rounded-xl border border-white/5 bg-slate-900/60" />
      ))}
    </div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}> = ({ label, checked, onChange, description }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-white/5 bg-slate-900/60 p-3">
    <span>
      <span className="block text-xs font-medium text-foreground">{label}</span>
      {description && <span className="mt-1 block text-[11px] text-muted-foreground">{description}</span>}
    </span>
    <span className={cx('inline-flex h-4 w-8 items-center rounded-full transition-colors', checked ? 'bg-emerald-500/80' : 'bg-slate-700')}>
      <span className={cx('h-3 w-3 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-1')} />
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="sr-only"
      />
    </span>
  </label>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-200">
      LOG
    </div>
    <p className="text-xs font-semibold text-foreground">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">{description}</p>
  </div>
);

const NotificationsSettings: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('channels');
  const [initialLoading, setInitialLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [enablingBrowser, setEnablingBrowser] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [channelsError, setChannelsError] = useState('');
  const [preferencesError, setPreferencesError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [preferences, setPreferences] = useState<UnifiedNotificationPreferences>(DEFAULT_PREFERENCES);
  const [channels, setChannels] = useState<UnifiedNotificationChannels>(DEFAULT_CHANNELS);
  const [history, setHistory] = useState<UnifiedNotificationHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const tabs = useMemo(
    () => [
      { id: 'channels' as const, label: t('notifications_channels') || 'Channels' },
      { id: 'preferences' as const, label: t('notifications_preferences') || 'Preferences' },
      { id: 'history' as const, label: t('notifications_history') || 'History' },
    ],
    [t],
  );

  const logNotificationLoadError = (section: ActiveTab, error: unknown) => {
    if (import.meta.env.DEV) {
      console.warn(`[notifications] ${section} load failed`, error);
    }
  };

  const loadPreferences = async () => {
    setPreferencesError('');
    try {
      const nextPreferences = await fetchNotificationPreferences();
      setPreferences({ ...DEFAULT_PREFERENCES, ...(nextPreferences || {}) });
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      logNotificationLoadError('preferences', error);
      setPreferencesError(sectionErrorMessage.preferences);
      setPreferences(prev => ({ ...DEFAULT_PREFERENCES, ...prev }));
    }
  };

  const loadChannels = async () => {
    setChannelsError('');
    try {
      const nextChannels = await fetchNotificationChannels();
      setChannels(mergeChannels(nextChannels));
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      logNotificationLoadError('channels', error);
      setChannelsError(sectionErrorMessage.channels);
      setChannels(DEFAULT_CHANNELS);
    }
  };

  const loadHistory = async () => {
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const nextHistory = await fetchUnifiedNotificationHistory(historyFilter);
      setHistory(nextHistory?.notifications || []);
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      logNotificationLoadError('history', error);
      setHistoryError(sectionErrorMessage.history);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      setInitialLoading(true);
      await Promise.allSettled([loadPreferences(), loadChannels(), loadHistory()]);
      setInitialLoading(false);
    };
    loadInitial();
    // Initial load intentionally runs once; historyFilter reloads are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilter]);

  useEffect(() => {
    setActionMessage('');
  }, [activeTab]);

  const savePreferences = async () => {
    setSaving(true);
    setActionMessage('');
    setPreferencesError('');
    try {
      const saved = await updateNotificationPreferences(preferences);
      setPreferences({ ...DEFAULT_PREFERENCES, ...(saved || {}) });
      await loadChannels();
      setActionMessage(t('settings_saved') || 'Settings saved');
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      if (import.meta.env.DEV) {
        console.warn('[notifications] preferences save failed', error);
      }
      setPreferencesError('Notification preferences could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const runDryRunTest = async (channel: 'telegram' | 'browser' | 'email') => {
    setTesting(channel);
    setActionMessage('');
    try {
      const result = await testNotificationChannel({ channel, dry_run: true, confirm_live: false });
      setActionMessage(
        result.success
          ? `${t('notification_status_dry_run') || 'Dry-run'}: ${channel}`
          : 'Dry-run test could not be completed.',
      );
      await loadHistory();
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      if (import.meta.env.DEV) {
        console.warn('[notifications] dry-run test failed', error);
      }
      setActionMessage('Dry-run test could not be completed.');
    } finally {
      setTesting(null);
    }
  };

  const runBrowserPreview = () => {
    if (!('Notification' in window)) {
      setActionMessage('Browser notifications are not supported here.');
      return;
    }
    if (Notification.permission !== 'granted') {
      setActionMessage('Enable browser notification permission first.');
      return;
    }
    new Notification('TitanGold', {
      body: t('local_browser_preview') || 'Local browser preview',
      icon: '/vite.svg',
    });
    setActionMessage(t('local_browser_preview') || 'Local browser preview');
  };

  const persistBrowserPreference = async (enabled: boolean) => {
    const saved = await updateNotificationPreferences({ browser_enabled: enabled });
    setPreferences({ ...DEFAULT_PREFERENCES, ...(saved || {}) });
    await loadChannels();
    return saved;
  };

  const enableBrowserNotifications = async () => {
    setActionMessage('');
    if (!('Notification' in window)) {
      setActionMessage('Browser notifications are not supported here.');
      return;
    }

    setEnablingBrowser(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await persistBrowserPreference(true);
        setActionMessage('Browser notifications enabled on this device.');
      } else if (permission === 'denied') {
        await persistBrowserPreference(false);
        setActionMessage('Browser notification permission was denied.');
      } else {
        setActionMessage('Browser notification permission was not granted.');
      }
    } catch (error) {
      if (isAuthExpiredError(error)) return;
      if (import.meta.env.DEV) {
        console.warn('[notifications] browser enable failed', error);
      }
      setActionMessage('Browser notifications could not be enabled.');
    } finally {
      setEnablingBrowser(false);
    }
  };

  const browserChannelEnabled = isBrowserChannelEnabled(preferences.browser_enabled);
  const browserPermissionStatus = getBrowserPermissionStatus();
  const configuredChannels = [channels.telegram.configured, browserChannelEnabled, false].filter(Boolean).length;
  const recentFailures = history.filter(item => item.status === 'failed' || item.status === 'blocked').length;
  const hasAnyWarning = Boolean(channelsError || preferencesError || historyError);

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <Panel
          title="Notification Center"
          description="Loading personal delivery preferences, provider status, and recent history."
        >
          <Skeleton />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Notification Center"
        description={`${t('personal_notifications_explanation') || 'Personal notifications manage your own alerts and preferences.'} ${
          t('publisher_delivery_explanation') ||
          'Personal Telegram notifications use the configured Telegram Publisher delivery layer. Broadcast channels are managed in DataHub -> Advanced Features -> Telegram Publisher.'
        }`}
        action={<StatusBadge status={hasAnyWarning ? 'degraded' : 'configured'} />}
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <MetricTile label="Delivery mode" value="Personal only" tone="purple" />
          <MetricTile label="Active channels" value={`${configuredChannels}/3`} tone="emerald" />
          <MetricTile label="History entries" value={`${history.length}`} tone="blue" />
          <MetricTile label="Blocked or failed" value={`${recentFailures}`} tone={recentFailures > 0 ? 'amber' : 'blue'} />
        </div>
      </Panel>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/70 p-1">
        <div className="flex min-w-max gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                'rounded-lg px-4 py-2 text-xs font-medium transition-colors',
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-900 hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionMessage && <InlineNotice tone="success">{actionMessage}</InlineNotice>}

      {activeTab === 'channels' && (
        <Panel title="Channels" description="Delivery surfaces stay connected to existing providers; raw Telegram credentials are not accepted here.">
          <div className="space-y-3">
            {channelsError && <InlineNotice>{channelsError}</InlineNotice>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Telegram</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t('publisher_delivery_explanation') || 'Personal alerts use Telegram Publisher delivery.'}
                    </p>
                  </div>
                  <StatusBadge status={channels.telegram.status} />
                </div>
                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <p className="text-xs text-foreground">
                    {channels.telegram.configured
                      ? `${t('telegram_delivery_configured') || 'Telegram delivery configured'}: ${channels.telegram.publisherName || 'Publisher'}`
                      : t('telegram_delivery_not_configured') || 'Telegram delivery not configured'}
                  </p>
                  <p>Provider: Telegram Publisher</p>
                  {channels.telegram.destinationMasked && <p>Destination: {channels.telegram.destinationMasked}</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActionMessage('Open DataHub -> Advanced Features -> Telegram Publisher.')}
                    className="rounded-full border border-sky-400/70 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/10"
                  >
                    {t('configure_in_telegram_publisher') || 'Configure in Telegram Publisher'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runDryRunTest('telegram')}
                    disabled={!channels.telegram.configured || testing === 'telegram'}
                    className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === 'telegram' ? 'Testing...' : t('dry_run_test') || 'Dry-run test'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Browser</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t('local_browser_preview') || 'Local browser preview only.'}</p>
                  </div>
                  <StatusBadge status={browserChannelEnabled ? 'enabled' : 'disabled'} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Permission: {browserPermissionStatus}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={enableBrowserNotifications}
                    disabled={enablingBrowser || browserPermissionStatus === 'unsupported'}
                    className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enablingBrowser
                      ? 'Enabling...'
                      : t('enable_push_notifications') || 'Enable Browser Notifications'}
                  </button>
                  <button
                    type="button"
                    onClick={runBrowserPreview}
                    className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    {t('local_browser_preview') || 'Local browser preview'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Email</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t('email_coming_soon') || 'Email notifications are coming soon.'}</p>
                  </div>
                  <StatusBadge status="coming soon" />
                </div>
                <p className="text-xs text-foreground">
                  {t('email_coming_soon') || 'Email notifications are coming soon'}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Admin SMTP configuration is required before live email can be enabled.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 rounded-full bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 opacity-50"
                >
                  {t('email_coming_soon') || 'Coming soon'}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'preferences' && (
        <Panel title={t('notifications_preferences') || 'Preferences'} description="Control quiet hours, local browser alerts, and notification frequency for the current user.">
          <div className="space-y-4">
            {preferencesError && <InlineNotice>{preferencesError}</InlineNotice>}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Toggle
                label={t('quiet_hours') || 'Quiet Hours'}
                checked={preferences.quiet_hours_enabled}
                onChange={checked => setPreferences(prev => ({ ...prev, quiet_hours_enabled: checked }))}
                description="Pause non-critical personal notifications during this window."
              />
              <Toggle
                label={t('do_not_disturb') || 'Do Not Disturb'}
                checked={preferences.do_not_disturb_enabled}
                onChange={checked => setPreferences(prev => ({ ...prev, do_not_disturb_enabled: checked }))}
                description="Suppress all personal notifications until this setting is turned off."
              />
            </div>

            {preferences.quiet_hours_enabled && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[11px] text-muted-foreground">
                  Start
                  <input
                    type="time"
                    value={preferences.quiet_hours_start}
                    onChange={event => setPreferences(prev => ({ ...prev, quiet_hours_start: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-foreground"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  End
                  <input
                    type="time"
                    value={preferences.quiet_hours_end}
                    onChange={event => setPreferences(prev => ({ ...prev, quiet_hours_end: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-foreground"
                  />
                </label>
              </div>
            )}

            <label className="block text-[11px] text-muted-foreground">
              {t('notification_frequency') || 'Notification frequency'}
              <select
                value={preferences.frequency_level}
                onChange={event =>
                  setPreferences(prev => ({
                    ...prev,
                    frequency_level: event.target.value as UnifiedNotificationPreferences['frequency_level'],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-foreground"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>

            <div className="flex justify-end border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={savePreferences}
                disabled={saving}
                className="rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : t('save_changes') || 'Save changes'}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'history' && (
        <Panel
          title={t('notifications_history') || 'History'}
          description="Audit trail for personal notification tests and delivery outcomes."
          action={historyLoading ? <StatusBadge status="loading" /> : <StatusBadge status={`${history.length} entries`} />}
        >
          <div className="space-y-4">
            {historyError && <InlineNotice>{historyError}</InlineNotice>}
            <div className="flex flex-wrap gap-2">
              {(['all', 'sent', 'failed', 'blocked', 'dry_run'] as HistoryFilter[]).map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHistoryFilter(filter)}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    historyFilter === filter ? 'bg-blue-600 text-white' : 'border border-slate-600 text-slate-100 hover:border-indigo-400',
                  )}
                >
                  {filter.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div className="h-40 animate-pulse rounded-xl border border-white/5 bg-slate-900/60" />
            ) : history.length === 0 ? (
              <EmptyState
                title={t('notification_history_empty') || 'No notification history yet.'}
                description="Dry-run tests and future scoped deliveries will appear here with status, source, and provider metadata."
              />
            ) : (
              <div className="-mx-3 mt-2 overflow-x-auto">
                <table className="min-w-full text-xs text-foreground/90">
                  <thead className="border-b border-slate-800 text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Date/time</th>
                      <th className="px-3 py-2 text-left">Channel</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Dry-run/live</th>
                      <th className="px-3 py-2 text-left">Result</th>
                      <th className="px-3 py-2 text-left">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => (
                      <tr key={item.id} className="border-b border-slate-900/60 last:border-0">
                        <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 align-top capitalize">{item.channel}</td>
                        <td className="px-3 py-2 align-top">{item.message_type}</td>
                        <td className="px-3 py-2 align-top"><StatusBadge status={item.status} /></td>
                        <td className="px-3 py-2 align-top">{item.dry_run ? 'dry-run' : 'live'}</td>
                        <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">
                          {item.error_code || item.error_message || item.message_preview || '-'}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">{item.source_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default NotificationsSettings;
