import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsSettings from '../../components/settings/NotificationsSettings';
import {
  fetchNotificationChannels,
  fetchNotificationPreferences,
  fetchUnifiedNotificationHistory,
  updateNotificationPreferences,
} from '../../services/api.ts';

vi.mock('../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      notifications_channels: 'Channels',
      notifications_preferences: 'Preferences',
      notifications_history: 'History',
      telegram_delivery_configured: 'Telegram delivery configured',
      telegram_delivery_not_configured: 'Telegram delivery not configured',
      configure_in_telegram_publisher: 'Configure in Telegram Publisher',
      dry_run_test: 'Dry-run test',
      local_browser_preview: 'Local browser preview',
      enable_push_notifications: 'Enable Browser Notifications',
      notification_frequency: 'Notification frequency',
      quiet_hours: 'Quiet Hours',
      do_not_disturb: 'Do Not Disturb',
      notification_history_empty: 'No notification history yet',
      notification_status_dry_run: 'Dry-run',
      email_coming_soon: 'Email notifications are coming soon',
      save_changes: 'Save changes',
      settings_saved: 'Settings saved',
      personal_notifications_explanation: 'Personal notifications manage your own alerts and preferences.',
      publisher_delivery_explanation:
        'Personal Telegram notifications use the configured Telegram Publisher delivery layer.',
    }[key] || key),
  }),
}));

vi.mock('../../services/api.ts', () => ({
  fetchNotificationPreferences: vi.fn(async () => ({
    telegram_enabled: false,
    browser_enabled: false,
    email_enabled: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    do_not_disturb_enabled: false,
    frequency_level: 'normal',
  })),
  updateNotificationPreferences: vi.fn(async preferences => preferences),
  fetchNotificationChannels: vi.fn(async () => ({
    telegram: {
      status: 'configured',
      provider: 'telegram_publisher',
      configured: true,
      enabled: false,
      publisherId: 'pub-1',
      publisherName: 'Safe Publisher',
      destinationMasked: '@cha***',
    },
    browser: { status: 'disabled', configured: true, enabled: false },
    email: { status: 'coming_soon', configured: false, enabled: false },
  })),
  fetchUnifiedNotificationHistory: vi.fn(async () => ({
    notifications: [],
    total: 0,
  })),
  testNotificationChannel: vi.fn(async () => ({
    success: true,
    status: 'dry_run',
    dry_run: true,
  })),
}));

describe('NotificationsSettings unified center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchNotificationPreferences).mockResolvedValue({
      telegram_enabled: false,
      browser_enabled: false,
      email_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      do_not_disturb_enabled: false,
      frequency_level: 'normal',
    });
    vi.mocked(updateNotificationPreferences).mockImplementation(async preferences => ({
      telegram_enabled: false,
      browser_enabled: false,
      email_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      do_not_disturb_enabled: false,
      frequency_level: 'normal',
      ...preferences,
    }));
    vi.mocked(fetchNotificationChannels).mockResolvedValue({
      telegram: {
        status: 'configured',
        provider: 'telegram_publisher',
        configured: true,
        enabled: false,
        publisherId: 'pub-1',
        publisherName: 'Safe Publisher',
        destinationMasked: '@cha***',
      },
      browser: { status: 'disabled', configured: true, enabled: false },
      email: { status: 'coming_soon', configured: false, enabled: false },
    });
    vi.mocked(fetchUnifiedNotificationHistory).mockResolvedValue({
      notifications: [],
      total: 0,
    });
  });

  it('renders the new Channels / Preferences / History tabs', async () => {
    render(<NotificationsSettings />);

    expect(await screen.findByRole('button', { name: 'Channels' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText(/Safe Publisher/)).toBeInTheDocument();
  });

  it('does not render legacy unsafe or advanced notification controls', async () => {
    render(<NotificationsSettings />);

    await waitFor(() => expect(screen.getByText(/Safe Publisher/)).toBeInTheDocument());

    expect(screen.queryByText(/Bot Token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chat ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BotFather/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Analytics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Import/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Retry Policy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Messages Per Minute/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parse Mode/i)).not.toBeInTheDocument();
  });

  it('does not render raw Not Found when channels endpoint fails', async () => {
    vi.mocked(fetchNotificationChannels).mockRejectedValueOnce(new Error('Not Found'));

    render(<NotificationsSettings />);

    expect(await screen.findByText('Telegram')).toBeInTheDocument();
    expect(screen.getByText('Browser')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Notification channels could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/^Not Found$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Telegram delivery not configured/i)).toBeInTheDocument();
  });

  it('saves preferences through the backend API', async () => {
    render(<NotificationsSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preferences' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'high' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() =>
      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ frequency_level: 'high' }),
      ),
    );
    expect(await screen.findByText(/Settings saved/i)).toBeInTheDocument();
  });

  it('renders backend-backed history empty state and filters', async () => {
    render(<NotificationsSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'History' }));

    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'failed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'blocked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dry run' })).toBeInTheDocument();
    expect(screen.getByText(/No notification history yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Not Found$/i)).not.toBeInTheDocument();
  });
});
