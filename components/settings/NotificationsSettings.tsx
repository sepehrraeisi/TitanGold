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
  channels: 'Notification channels could not be loaded.',
  preferences: 'Notification preferences could not be loaded.',
  history: 'Notification history could not be loaded.',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const color =
    status === 'configured' || status === 'enabled' || status === 'sent'
      ? 'bg-green-500/15 text-green-300 border-green-500/40'
      : status === 'dry_run'
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
        : status === 'failed' || status === 'blocked'
          ? 'bg-red-500/15 text-red-300 border-red-500/40'
          : 'bg-gray-500/15 text-gray-300 border-gray-500/40';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${color}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const Card: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <div className="rounded-lg border border-gray-800 bg-[#161B22]">
    <div className="border-b border-gray-800 p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
    </div>
    <div className="space-y-4 p-5">{children}</div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}> = ({ label, checked, onChange, description }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4">
    <span>
      <span className="block text-sm font-medium text-gray-200">{label}</span>
      {description && <span className="mt-1 block text-xs text-gray-500">{description}</span>}
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#0D111C] text-blue-600"
    />
  </label>
);

const NotificationsSettings: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('channels');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
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
      setPreferences({ ...DEFAULT_PREFERENCES, ...nextPreferences });
    } catch (error) {
      logNotificationLoadError('preferences', error);
      setPreferencesError(sectionErrorMessage.preferences);
      setPreferences(prev => ({ ...DEFAULT_PREFERENCES, ...prev }));
    }
  };

  const loadChannels = async () => {
    setChannelsError('');
    try {
      const nextChannels = await fetchNotificationChannels();
      setChannels({ ...DEFAULT_CHANNELS, ...nextChannels });
    } catch (error) {
      logNotificationLoadError('channels', error);
      setChannelsError(sectionErrorMessage.channels);
      setChannels(DEFAULT_CHANNELS);
    }
  };

  const loadHistory = async () => {
    setHistoryError('');
    try {
      const nextHistory = await fetchUnifiedNotificationHistory(historyFilter);
      setHistory(nextHistory.notifications);
    } catch (error) {
      logNotificationLoadError('history', error);
      setHistoryError(sectionErrorMessage.history);
      setHistory([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.allSettled([loadPreferences(), loadChannels(), loadHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
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
      setPreferences(saved);
      await loadChannels();
      setActionMessage(t('settings_saved') || 'Settings saved');
    } catch (error) {
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

  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setActionMessage('Browser notifications are not supported here.');
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    setPreferences(prev => ({ ...prev, browser_enabled: enabled }));
    setActionMessage(enabled ? 'Browser notifications enabled locally.' : 'Browser permission was not granted.');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-4 text-sm text-blue-200">
        {t('personal_notifications_explanation') ||
          'Personal notifications manage your own alerts and preferences.'}{' '}
        {t('publisher_delivery_explanation') ||
          'Broadcast channels are managed in DataHub -> Advanced Features -> Telegram Publisher.'}
      </div>

      <div className="flex gap-2 border-b border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-400 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="rounded-md border border-gray-700 bg-[#0D111C] p-3 text-sm text-gray-200">
          {actionMessage}
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="space-y-4">
          {channelsError && (
            <div className="rounded-md border border-yellow-700/50 bg-yellow-900/20 p-3 text-sm text-yellow-200">
              {channelsError}
            </div>
          )}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card
            title="Telegram"
            description={t('publisher_delivery_explanation') || 'Personal alerts use Telegram Publisher delivery.'}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Status</span>
              <StatusBadge status={channels.telegram.status} />
            </div>
            <p className="text-sm text-gray-300">
              {channels.telegram.configured
                ? `${t('telegram_delivery_configured') || 'Configured'}: ${channels.telegram.publisherName}`
                : t('telegram_delivery_not_configured') || 'Not configured'}
            </p>
            <p className="text-xs text-gray-500">Provider: Telegram Publisher</p>
            {channels.telegram.destinationMasked && (
              <p className="text-xs text-gray-500">Destination: {channels.telegram.destinationMasked}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionMessage('Open DataHub -> Advanced Features -> Telegram Publisher.')}
                className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
              >
                {t('configure_in_telegram_publisher') || 'Configure in Telegram Publisher'}
              </button>
              <button
                type="button"
                onClick={() => runDryRunTest('telegram')}
                disabled={!channels.telegram.configured || testing === 'telegram'}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {testing === 'telegram' ? 'Testing...' : t('dry_run_test') || 'Dry-run test'}
              </button>
            </div>
          </Card>

          <Card title="Browser" description={t('local_browser_preview') || 'Local browser preview only.'}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Status</span>
              <StatusBadge status={preferences.browser_enabled ? 'enabled' : 'disabled'} />
            </div>
            <p className="text-xs text-gray-500">
              Permission: {'Notification' in window ? Notification.permission : 'unsupported'}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={enableBrowserNotifications}
                className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
              >
                {t('enable_push_notifications') || 'Enable Browser Notifications'}
              </button>
              <button
                type="button"
                onClick={runBrowserPreview}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t('local_browser_preview') || 'Local browser preview'}
              </button>
            </div>
          </Card>

          <Card title="Email" description={t('email_coming_soon') || 'Email notifications are coming soon.'}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Status</span>
              <StatusBadge status="coming soon" />
            </div>
            <p className="text-sm text-gray-300">
              {t('email_coming_soon') || 'Admin SMTP configuration is required before live email can be enabled.'}
            </p>
            <button
              type="button"
              disabled
              className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white opacity-50"
            >
              {t('email_coming_soon') || 'Coming soon'}
            </button>
          </Card>
        </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <Card title={t('notifications_preferences') || 'Preferences'}>
          {preferencesError && (
            <div className="rounded-md border border-yellow-700/50 bg-yellow-900/20 p-3 text-sm text-yellow-200">
              {preferencesError}
            </div>
          )}
          <Toggle
            label={t('quiet_hours') || 'Quiet Hours'}
            checked={preferences.quiet_hours_enabled}
            onChange={checked => setPreferences(prev => ({ ...prev, quiet_hours_enabled: checked }))}
            description="Pause non-critical personal notifications during this window."
          />
          {preferences.quiet_hours_enabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Start
                <input
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={event => setPreferences(prev => ({ ...prev, quiet_hours_start: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-[#0D111C] p-2 text-white"
                />
              </label>
              <label className="text-sm text-gray-300">
                End
                <input
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={event => setPreferences(prev => ({ ...prev, quiet_hours_end: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-[#0D111C] p-2 text-white"
                />
              </label>
            </div>
          )}

          <Toggle
            label={t('do_not_disturb') || 'Do Not Disturb'}
            checked={preferences.do_not_disturb_enabled}
            onChange={checked => setPreferences(prev => ({ ...prev, do_not_disturb_enabled: checked }))}
          />

          <label className="block text-sm text-gray-300">
            {t('notification_frequency') || 'Notification Frequency'}
            <select
              value={preferences.frequency_level}
              onChange={event =>
                setPreferences(prev => ({
                  ...prev,
                  frequency_level: event.target.value as UnifiedNotificationPreferences['frequency_level'],
                }))
              }
              className="mt-1 w-full rounded-md border border-gray-700 bg-[#0D111C] p-2 text-white"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : t('save_changes') || 'Save changes'}
            </button>
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card title={t('notifications_history') || 'History'}>
          {historyError && (
            <div className="rounded-md border border-yellow-700/50 bg-yellow-900/20 p-3 text-sm text-yellow-200">
              {historyError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {(['all', 'sent', 'failed', 'blocked', 'dry_run'] as HistoryFilter[]).map(filter => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                className={`rounded-md px-3 py-1 text-sm ${
                  historyFilter === filter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                }`}
              >
                {filter.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              {t('notification_history_empty') || 'No notification history yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2">Date/time</th>
                    <th className="py-2">Channel</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Dry-run/live</th>
                    <th className="py-2">Result</th>
                    <th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {history.map(item => (
                    <tr key={item.id} className="text-gray-300">
                      <td className="py-3">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                      <td className="py-3 capitalize">{item.channel}</td>
                      <td className="py-3">{item.message_type}</td>
                      <td className="py-3"><StatusBadge status={item.status} /></td>
                      <td className="py-3">{item.dry_run ? 'dry-run' : 'live'}</td>
                      <td className="py-3">
                        {item.error_code || item.error_message || item.message_preview || '-'}
                      </td>
                      <td className="py-3">{item.source_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default NotificationsSettings;
