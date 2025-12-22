
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';

const SettingsCard: React.FC<{ title: string, description?: string, children: React.ReactNode, className?: string }> = ({ title, description, children, className = '' }) => (
    <div className={`bg-[#161B22] border border-gray-800 rounded-lg ${className}`}>
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ 
    label: string, 
    id: string, 
    type: string, 
    placeholder?: string, 
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    disabled?: boolean,
    helpText?: string
}> = ({ label, id, type, placeholder, value, onChange, disabled, helpText }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
);

const TextAreaField: React.FC<{
    label: string;
    id: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    helpText?: string;
}> = ({ label, id, value, onChange, placeholder, rows = 3, disabled, helpText }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <textarea
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
);

const Checkbox: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    description?: string;
}> = ({ label, checked, onChange, description }) => (
    <label className="flex items-start justify-between cursor-pointer group">
        <div className="flex-1">
            <span className="text-sm text-gray-300 block">{label}</span>
            {description && <span className="text-xs text-gray-500 mt-1 block">{description}</span>}
        </div>
        <div className="relative">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${
                checked ? 'bg-blue-600' : 'bg-gray-700'
            }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                }`}></div>
            </div>
        </div>
    </label>
);

const SelectField: React.FC<{
    label: string;
    id: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
}> = ({ label, id, value, onChange, options, disabled }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </div>
);

const TimeInput: React.FC<{
    label: string;
    value: string; // HH:mm format
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
    </div>
);

const NotificationsSettings: React.FC = () => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [testStatus, setTestStatus] = useState('');
    const [testing, setTesting] = useState(false);
    const [botInfo, setBotInfo] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'telegram' | 'browser' | 'global' | 'analytics'>('telegram');
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [editingChannel, setEditingChannel] = useState<string | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        loadSettings();
        if ('Notification' in window) {
            const permission = Notification.permission;
            if (settings) {
                setSettings((prev: any) => ({
                    ...prev,
                    browser: { ...prev.browser, permission }
                }));
            }
        }
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await api.fetchNotificationSettings();
            setSettings(data);
            
            // Add null/undefined checks before accessing nested properties
            if (data && data.telegram && data.telegram.botToken) {
                const botResult = await api.getTelegramBotInfo(data.telegram.botToken);
                if (botResult.success) {
                    setBotInfo(botResult.data);
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Set default empty settings to prevent crashes
            setSettings({
                telegram: { botToken: '', channels: [] },
                browser: { permission: 'default', enabled: false },
                global: { enabled: true },
                analytics: { enabled: true }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        
        try {
            setTestStatus('Saving...');
            await api.saveNotificationSettings(settings);
            setTestStatus('✅ Settings saved successfully!');
            setTimeout(() => setTestStatus(''), 3000);
        } catch (error) {
            console.error('Save error:', error);
            setTestStatus('❌ Failed to save settings');
        }
    };

    const handleTestBot = async () => {
        if (!settings?.telegram.botToken) {
            setTestStatus('⚠️ Please enter bot token first');
            return;
        }
        
        try {
            setTesting(true);
            setTestStatus('Testing bot...');
            console.log('Testing bot with token:', settings.telegram.botToken.substring(0, 10) + '...');
            
            const result = await api.getTelegramBotInfo(settings.telegram.botToken);
            
            console.log('Bot test result:', result);
            
            // Update state in correct order
            if (result.success) {
                setBotInfo(result.data);
                setSettings((prev: any) => ({
                    ...prev,
                    telegram: { ...prev.telegram, botInfo: result.data }
                }));
            }
            
            // Set status and then disable testing
            setTestStatus(result.message || (result.success ? '✅ Bot verified successfully!' : '❌ Failed to test bot'));
            setTesting(false);
            
            // Auto-clear status after 5 seconds
            setTimeout(() => {
                setTestStatus('');
            }, 5000);
        } catch (error) {
            console.error('Error testing bot:', error);
            setTestStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setTesting(false);
            
            setTimeout(() => {
                setTestStatus('');
            }, 5000);
        }
    };

    const handleAddChannel = async () => {
        const channelId = prompt(t('enter_channel_id') || 'Enter Channel ID (e.g., @my_channel or -1001234567890):');
        const channelName = prompt(t('enter_channel_name') || 'Enter Channel Name:');
        
        if (!channelId || !channelName) return;
        
        try {
            const updated = await api.addTelegramChannel({
                channelId: channelId.trim(),
                name: channelName.trim(),
            });
            setSettings(updated);
            setShowAddChannel(false);
            setTestStatus('✅ ' + (t('channel_added_successfully') || 'Channel added successfully!'));
        } catch (error) {
            setTestStatus('❌ ' + (t('failed_to_add_channel') || 'Failed to add channel'));
        }
    };

    const handleTestChannel = async (channelId: string, channelName: string) => {
        if (!settings?.telegram.botToken) {
            setTestStatus('⚠️ Please configure bot token first');
            return;
        }
        
        try {
            setTesting(true);
            setTestStatus(`Testing ${channelName}...`);
            console.log('Testing channel:', channelId, 'with bot token:', settings.telegram.botToken.substring(0, 10) + '...');
            
            const result = await api.testTelegramChannel(settings.telegram.botToken, channelId);
            
            console.log('Channel test result:', result);
            
            // Set status first, then disable testing
            setTestStatus(result.message || (result.success ? '✅ Channel verified successfully!' : '❌ Failed to verify channel'));
            setTesting(false);
            
            // Auto-clear status after 5 seconds
            setTimeout(() => {
                setTestStatus('');
            }, 5000);
        } catch (error) {
            console.error('Error testing channel:', error);
            setTestStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setTesting(false);
            
            setTimeout(() => {
                setTestStatus('');
            }, 5000);
        }
    };

    const handleTestMessage = async (channelId?: string) => {
        const targetChannelId = channelId || settings?.telegram.channels[0]?.channelId;
        
        if (!settings?.telegram.botToken || !targetChannelId) {
            setTestStatus('⚠️ Please configure bot token and channel first');
            return;
        }
        
        setTesting(true);
        setTestStatus('Sending test message...');
        const result = await api.sendTestTelegramMessage(
            settings.telegram.botToken,
            targetChannelId,
            {
                parse_mode: settings.telegram.parseMode,
                disable_notification: settings.telegram.disableNotifications,
            }
        );
        setTesting(false);
        setTestStatus(result.message);
        
        if (result.success) {
            await loadSettings(); // Reload to update analytics
        }
    };
    
    const handleRequestPermission = async () => {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
        return;
      }
      const permission = await Notification.requestPermission();
        if (settings) {
            setSettings({
                ...settings,
                browser: { ...settings.browser, permission, enabled: permission === 'granted' }
        });
      }
    };
    
    const handleSendTestBrowserNotification = async () => {
        if (!settings || settings.browser.permission !== 'granted') {
            return;
        }
        
        const result = await api.sendBrowserNotification(
            'Titan Trade Alert',
            'This is a test notification from your Titan trading system.',
            'alerts',
            {
                image: '/vite.svg',
                actions: [
                    { action: 'view', title: 'View Details' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            }
        );
        
        if (result.success) {
            setTestStatus('✅ Browser notification sent!');
            await loadSettings();
        } else {
            setTestStatus(result.message);
        }
    };

    const handleExportSettings = async () => {
        try {
            const exported = await api.exportNotificationSettings();
            const blob = new Blob([exported], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `titan-notification-settings-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            setTestStatus('✅ Settings exported successfully!');
        } catch (error) {
            setTestStatus('❌ Failed to export settings');
        }
    };

    const handleImportSettings = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const result = await api.importNotificationSettings(text);
                setTestStatus(result.message);
                if (result.success) {
                    await loadSettings();
                }
            } catch (error) {
                setTestStatus('❌ Failed to import settings');
            }
        };
        input.click();
    };

    const handleClearHistory = async (type?: 'telegram' | 'browser') => {
        if (confirm(`Are you sure you want to clear ${type || 'all'} notification history?`)) {
            await api.clearNotificationHistory(type);
            await loadSettings();
            setTestStatus('✅ History cleared');
        }
    };

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Loading State */}
            {(loading || !settings) && (
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-8">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <span className="ml-3 text-gray-400">Loading notification settings...</span>
                    </div>
                </div>
            )}
            
            {/* Main Content - Only show when loaded */}
            {!loading && settings && (
                <>
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('telegram')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'telegram'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Telegram
                </button>
                <button
                    onClick={() => setActiveTab('browser')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'browser'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Browser
                </button>
                <button
                    onClick={() => setActiveTab('global')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'global'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Global Settings
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'analytics'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Analytics
                </button>
            </div>

            {/* Status Message */}
            {testStatus && (
                <div className={`p-3 rounded-md ${
                    testStatus.includes('✅') ? 'bg-green-900/20 border border-green-700/50 text-green-300' :
                    testStatus.includes('❌') ? 'bg-red-900/20 border border-red-700/50 text-red-300' :
                    'bg-blue-900/20 border border-blue-700/50 text-blue-300'
                }`}>
                    {testStatus}
                </div>
            )}

            {/* Telegram Tab */}
            {activeTab === 'telegram' && (
                <SettingsCard 
                    title={t('telegram_notifications')} 
                    description="Get real-time trade alerts, predictions, and news analysis in your Telegram."
                >
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-md">
                        <p className="text-xs text-blue-300 mb-2 font-semibold">📋 Setup Instructions:</p>
                        <ol className="text-xs text-blue-200 space-y-1 list-decimal list-inside">
                            <li>Create a bot via @BotFather on Telegram</li>
                            <li>Get your bot token (format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)</li>
                            <li>Create a channel and add your bot as administrator</li>
                            <li>Use channel username (e.g., @my_channel) or numeric ID</li>
                        </ol>
                    </div>

                    <Checkbox
                        label={t('enable_telegram_notifications') || 'Enable Telegram Notifications'}
                        checked={settings.telegram.enabled}
                        onChange={(checked) => setSettings({
                            ...settings,
                            telegram: { ...settings.telegram, enabled: checked }
                        })}
                    />

                    <InputField 
                        label={t('telegram_bot_token')} 
                        id="bot_token" 
                        type="text" 
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
                        value={settings.telegram.botToken || ''} 
                        onChange={e => setSettings({
                            ...settings,
                            telegram: { ...settings.telegram, botToken: e.target.value }
                        })}
                        disabled={!settings.telegram.enabled}
                    />

                    {botInfo && (
                        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-md">
                            <p className="text-xs text-green-300 font-semibold">✅ Bot Verified</p>
                            <p className="text-xs text-green-200 mt-1">
                                @{botInfo.username} - {botInfo.first_name}
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!testing && settings?.telegram.botToken) {
                                handleTestBot();
                            }
                        }}
                        disabled={testing || !settings?.telegram.botToken}
                        className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {testing ? 'Testing...' : 'Test Bot'}
                    </button>

                    {/* Channels Management */}
                    <div className="pt-4 border-t border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-gray-300">{t('channels') || 'Channels'}</p>
                            <button
                                onClick={handleAddChannel}
                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                            >
                                + {t('add_channel') || 'Add Channel'}
                            </button>
                        </div>

                        {settings.telegram.channels.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">{t('no_channels_configured') || 'No channels configured'}</p>
                        ) : (
                            <div className="space-y-3">
                                {settings.telegram.channels.map((channel: any) => (
                                    <div key={channel.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <p className="font-semibold text-white">{channel.name}</p>
                                                <p className="text-xs text-gray-400 mt-1">{channel.channelId}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!testing && settings?.telegram.botToken) {
                                                            handleTestChannel(channel.channelId, channel.name);
                                                        }
                                                    }}
                                                    disabled={testing || !settings?.telegram.botToken}
                                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {t('test') || 'Test'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(t('remove_this_channel') || 'Remove this channel?')) {
                                                            api.removeTelegramChannel(channel.id).then(loadSettings);
                                                        }
                                                    }}
                                                    className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
                                                >
                                                    {t('remove') || 'Remove'}
                                                </button>
                                            </div>
                                        </div>

                                        <Checkbox
                                            label={t('enabled') || 'Enabled'}
                                            checked={channel.enabled}
                                            onChange={(checked) => {
                                                api.updateTelegramChannel(channel.id, { enabled: checked }).then(loadSettings);
                                            }}
                                        />

                                        <SelectField
                                            label={t('priority') || 'Priority'}
                                            id={`priority-${channel.id}`}
                                            value={channel.priority}
                                            onChange={(e) => {
                                                api.updateTelegramChannel(channel.id, { priority: e.target.value }).then(loadSettings);
                                            }}
                                            options={[
                                                { value: 'low', label: t('low') || 'Low' },
                                                { value: 'normal', label: t('normal') || 'Normal' },
                                                { value: 'high', label: t('high') || 'High' },
                                                { value: 'urgent', label: t('urgent') || 'Urgent' },
                                            ]}
                                        />

                                        <div className="mt-3 pt-3 border-t border-gray-700">
                                            <p className="text-xs font-semibold text-gray-400 mb-2">{t('notification_types') || 'Notification Types'}</p>
                                            <div className="space-y-1">
                                                {(['trades', 'alerts', 'news', 'predictions', 'errors'] as const).map(type => (
                                                    <Checkbox
                                                        key={type}
                                                        label={t(type) || type.charAt(0).toUpperCase() + type.slice(1)}
                                                        checked={channel.notificationTypes[type]}
                                                        onChange={(checked) => {
                                                            api.updateTelegramChannel(channel.id, {
                                                                notificationTypes: { ...channel.notificationTypes, [type]: checked }
                                                            }).then(loadSettings);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {channel.quietHours && (
                                            <div className="mt-3 pt-3 border-t border-gray-700">
                                                <Checkbox
                                                    label={t('quiet_hours') || 'Quiet Hours'}
                                                    checked={channel.quietHours.enabled}
                                                    onChange={(checked) => {
                                                        api.updateTelegramChannel(channel.id, {
                                                            quietHours: { ...channel.quietHours, enabled: checked }
                                                        }).then(loadSettings);
                                                    }}
                                                />
                                                {channel.quietHours.enabled && (
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <TimeInput
                                                            label={t('start_time') || 'Start'}
                                                            value={channel.quietHours.start}
                                                            onChange={(value) => {
                                                                api.updateTelegramChannel(channel.id, {
                                                                    quietHours: { ...channel.quietHours, start: value }
                                                                }).then(loadSettings);
                                                            }}
                                                        />
                                                        <TimeInput
                                                            label={t('end_time') || 'End'}
                                                            value={channel.quietHours.end}
                                                            onChange={(value) => {
                                                                api.updateTelegramChannel(channel.id, {
                                                                    quietHours: { ...channel.quietHours, end: value }
                                                                }).then(loadSettings);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Advanced Settings */}
                    <div className="pt-4 border-t border-gray-700">
                        <p className="text-sm font-semibold text-gray-300 mb-3">{t('advanced_settings') || 'Advanced Settings'}</p>
                        
                        <SelectField
                            label={t('parse_mode') || 'Parse Mode'}
                            id="parse_mode"
                            value={settings.telegram.parseMode}
                            onChange={e => setSettings({
                                ...settings,
                                telegram: { ...settings.telegram, parseMode: e.target.value as 'Markdown' | 'HTML' | 'None' }
                            })}
                            options={[
                                { value: 'Markdown', label: t('markdown') || 'Markdown' },
                                { value: 'HTML', label: t('html') || 'HTML' },
                                { value: 'None', label: t('plain_text') || 'Plain Text' },
                            ]}
                        />

                        <Checkbox
                            label={t('disable_notifications_silent_mode') || 'Disable Notifications (Silent Mode)'}
                            checked={settings.telegram.disableNotifications}
                            onChange={(checked) => setSettings({
                                ...settings,
                                telegram: { ...settings.telegram, disableNotifications: checked }
                            })}
                            description={t('send_messages_without_notification_sound') || 'Send messages without notification sound'}
                        />

                        <div className="p-3 bg-gray-800/50 rounded-md">
                            <Checkbox
                                label={t('rate_limiting') || 'Rate Limiting'}
                                checked={settings.telegram.rateLimit.enabled}
                                onChange={(checked) => setSettings({
                                    ...settings,
                                    telegram: {
                                        ...settings.telegram,
                                        rateLimit: { ...settings.telegram.rateLimit, enabled: checked }
                                    }
                                })}
                                description={t('limit_messages_per_minute') || 'Limit messages per minute to avoid API throttling'}
                            />
                            {settings.telegram.rateLimit.enabled && (
                                <InputField
                                    label={t('messages_per_minute') || 'Messages Per Minute'}
                                    id="rate_limit"
                                    type="number"
                                    value={settings.telegram.rateLimit.messagesPerMinute.toString()}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        telegram: {
                                            ...settings.telegram,
                                            rateLimit: {
                                                ...settings.telegram.rateLimit,
                                                messagesPerMinute: parseInt(e.target.value) || 20
                                            }
                                        }
                                    })}
                                    helpText={t('telegram_limit_is_30_recommended_20') || 'Telegram limit is 30, recommended: 20'}
                                />
                            )}
                        </div>

                        <div className="p-3 bg-gray-800/50 rounded-md">
                            <Checkbox
                                label={t('retry_policy') || 'Retry Policy'}
                                checked={settings.telegram.retryPolicy.enabled}
                                onChange={(checked) => setSettings({
                                    ...settings,
                                    telegram: {
                                        ...settings.telegram,
                                        retryPolicy: { ...settings.telegram.retryPolicy, enabled: checked }
                                    }
                                })}
                                description={t('automatically_retry_failed_messages') || 'Automatically retry failed messages'}
                            />
                            {settings.telegram.retryPolicy.enabled && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <InputField
                                        label={t('max_retries') || 'Max Retries'}
                                        id="max_retries"
                                        type="number"
                                        value={settings.telegram.retryPolicy.maxRetries.toString()}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            telegram: {
                                                ...settings.telegram,
                                                retryPolicy: {
                                                    ...settings.telegram.retryPolicy,
                                                    maxRetries: parseInt(e.target.value) || 3
                                                }
                                            }
                                        })}
                                    />
                                    <InputField
                                        label={t('retry_delay_ms') || 'Retry Delay (ms)'}
                                        id="retry_delay"
                                        type="number"
                                        value={settings.telegram.retryPolicy.retryDelay.toString()}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            telegram: {
                                                ...settings.telegram,
                                                retryPolicy: {
                                                    ...settings.telegram.retryPolicy,
                                                    retryDelay: parseInt(e.target.value) || 1000
                                                }
                                            }
                                        })}
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {showTemplates ? (t('hide_message_templates') || 'Hide Message Templates') : (t('show_message_templates') || 'Show Message Templates')}
                        </button>

                        {showTemplates && (
                            <div className="space-y-3 mt-3">
                                {(['trades', 'alerts', 'news', 'predictions', 'errors'] as const).map(type => (
                                    <TextAreaField
                                        key={type}
                                        label={t(`${type}_template`) || `${type.charAt(0).toUpperCase() + type.slice(1)} Template`}
                                        id={`template-${type}`}
                                        value={settings.telegram.messageTemplates[type]}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            telegram: {
                                                ...settings.telegram,
                                                messageTemplates: {
                                                    ...settings.telegram.messageTemplates,
                                                    [type]: e.target.value
                                                }
                                            }
                                        })}
                                        helpText={t('use_variable_for_dynamic_content') || 'Use {variable} for dynamic content'}
                                        rows={2}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 items-center flex-wrap pt-4 border-t border-gray-700">
                        <button 
                            onClick={handleSave} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('save_changes')}
                        </button>
                        <button 
                            onClick={() => handleTestMessage()}
                            disabled={testing || !settings.telegram.botToken || settings.telegram.channels.length === 0}
                            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            {testing ? (t('sending') || 'Sending...') : t('send_test_message')}
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            {showHistory ? (t('hide_history') || 'Hide History') : (t('show_history') || 'Show History')}
                        </button>
                    </div>

                    {showHistory && settings.history.telegram.length > 0 && (
                        <div className="pt-4 border-t border-gray-700">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-sm font-semibold text-gray-300">{t('message_history') || 'Message History'}</p>
                                <button
                                    onClick={() => handleClearHistory('telegram')}
                                    className="text-xs text-red-400 hover:text-red-300"
                                >
                                    {t('clear_history') || 'Clear History'}
                                </button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {settings.history.telegram.slice(0, 20).map((item: any) => (
                                    <div key={item.id} className="p-2 bg-gray-800/50 rounded text-xs">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <span className="text-gray-400">{item.type}</span>
                                                <p className="text-gray-300 mt-1">{item.message}</p>
                                                <p className="text-gray-500 mt-1">
                                                    {new Date(item.sentAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 rounded ${
                                                item.status === 'success' 
                                                    ? 'bg-green-500/20 text-green-300' 
                                                    : 'bg-red-500/20 text-red-300'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                </div>
                    )}
            </SettingsCard>
            )}

            {/* Browser Tab */}
            {activeTab === 'browser' && (
                <SettingsCard 
                    title={t('browser_push_notifications')} 
                    description={t('push_notifications_desc')}
                >
                    <Checkbox
                        label={t('enable_push_notifications')}
                        checked={settings.browser.enabled}
                        onChange={(checked) => setSettings({
                            ...settings,
                            browser: { ...settings.browser, enabled: checked }
                        })}
                    />

                    <div className="flex items-center justify-between pt-2">
                    <div>
                        <p className="text-sm text-gray-300 font-medium">{t('permission_status')}</p>
                            <span className={`text-sm ${
                                settings.browser.permission === 'granted' ? 'text-green-400' :
                                settings.browser.permission === 'denied' ? 'text-red-400' :
                                'text-yellow-400'
                            }`}>
                                {settings.browser.permission === 'granted' ? t('permission_granted') :
                                 settings.browser.permission === 'denied' ? t('permission_denied') :
                                 t('permission_default')}
                            </span>
                    </div>
                     <div>
                            {settings.browser.permission === 'default' && (
                                <button 
                                    onClick={handleRequestPermission} 
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                                >
                                {t('enable_push_notifications')}
                            </button>
                        )}
                            {settings.browser.permission === 'granted' && (
                                <button 
                                    onClick={handleSendTestBrowserNotification} 
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
                                >
                                {t('send_test_push_notification')}
                            </button>
                        )}
                    </div>
                </div>

                    {settings.browser.permission === 'granted' && (
                        <>
                            <div className="pt-4 border-t border-gray-700">
                                <p className="text-sm font-semibold text-gray-300 mb-3">{t('notification_settings') || 'Notification Settings'}</p>
                                
                                <Checkbox
                                    label={t('sound') || 'Sound'}
                                    checked={settings.browser.sound}
                                    onChange={(checked) => setSettings({
                                        ...settings,
                                        browser: { ...settings.browser, sound: checked }
                                    })}
                                />
                                
                                <Checkbox
                                    label={t('badge') || 'Badge'}
                                    checked={settings.browser.badge}
                                    onChange={(checked) => setSettings({
                                        ...settings,
                                        browser: { ...settings.browser, badge: checked }
                                    })}
                                    description={t('show_badge_on_app_icon') || 'Show badge on app icon'}
                                />
                                
                                <Checkbox
                                    label={t('require_interaction') || 'Require Interaction'}
                                    checked={settings.browser.requireInteraction}
                                    onChange={(checked) => setSettings({
                                        ...settings,
                                        browser: { ...settings.browser, requireInteraction: checked }
                                    })}
                                    description={t('notification_stays_until_user_interacts') || 'Notification stays until user interacts'}
                                />

                                <SelectField
                                    label={t('priority') || 'Priority'}
                                    id="browser_priority"
                                    value={settings.browser.priority}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        browser: { ...settings.browser, priority: e.target.value as any }
                                    })}
                                    options={[
                                        { value: 'low', label: t('low') || 'Low' },
                                        { value: 'normal', label: t('normal') || 'Normal' },
                                        { value: 'high', label: t('high') || 'High' },
                                        { value: 'urgent', label: t('urgent') || 'Urgent' },
                                    ]}
                                />

                                <div className="p-3 bg-gray-800/50 rounded-md">
                                    <Checkbox
                                        label={t('group_notifications') || 'Group Notifications'}
                                        checked={settings.browser.grouping.enabled}
                                        onChange={(checked) => setSettings({
                                            ...settings,
                                            browser: {
                                                ...settings.browser,
                                                grouping: { ...settings.browser.grouping, enabled: checked }
                                            }
                                        })}
                                        description={t('group_notifications_by_tag') || 'Group notifications by tag'}
                                    />
                                </div>

                                <div className="p-3 bg-gray-800/50 rounded-md">
                                    <Checkbox
                                        label={t('rich_notifications') || 'Rich Notifications'}
                                        checked={settings.browser.richNotifications.enabled}
                                        onChange={(checked) => setSettings({
                                            ...settings,
                                            browser: {
                                                ...settings.browser,
                                                richNotifications: {
                                                    ...settings.browser.richNotifications,
                                                    enabled: checked
                                                }
                                            }
                                        })}
                                        description={t('show_images_and_actions') || 'Show images and actions in notifications'}
                                    />
                                    {settings.browser.richNotifications.enabled && (
                                        <div className="mt-2 space-y-2">
                                            <Checkbox
                                                label={t('show_image') || 'Show Image'}
                                                checked={settings.browser.richNotifications.showImage}
                                                onChange={(checked) => setSettings({
                                                    ...settings,
                                                    browser: {
                                                        ...settings.browser,
                                                        richNotifications: {
                                                            ...settings.browser.richNotifications,
                                                            showImage: checked
                                                        }
                                                    }
                                                })}
                                            />
                                            <Checkbox
                                                label={t('show_actions') || 'Show Actions'}
                                                checked={settings.browser.richNotifications.showActions}
                                                onChange={(checked) => setSettings({
                                                    ...settings,
                                                    browser: {
                                                        ...settings.browser,
                                                        richNotifications: {
                                                            ...settings.browser.richNotifications,
                                                            showActions: checked
                                                        }
                                                    }
                                                })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-700">
                                <p className="text-sm font-semibold text-gray-300 mb-3">{t('notification_types') || 'Notification Types'}</p>
                                <div className="space-y-2">
                                    {(['trades', 'alerts', 'news', 'predictions', 'errors'] as const).map(type => (
                                        <Checkbox
                                            key={type}
                                            label={t(type) || type.charAt(0).toUpperCase() + type.slice(1)}
                                            checked={settings.browser.notificationTypes[type]}
                                            onChange={(checked) => setSettings({
                                                ...settings,
                                                browser: {
                                                    ...settings.browser,
                                                    notificationTypes: {
                                                        ...settings.browser.notificationTypes,
                                                        [type]: checked
                                                    }
                                                }
                                            })}
                                        />
                                    ))}
                                </div>
                            </div>

                            {settings.history.browser.length > 0 && (
                                <div className="pt-4 border-t border-gray-700">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-sm font-semibold text-gray-300">{t('notification_history') || 'Notification History'}</p>
                                        <button
                                            onClick={() => handleClearHistory('browser')}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            {t('clear_history') || 'Clear History'}
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {settings.history.browser.slice(0, 10).map((item: any) => (
                                            <div key={item.id} className="p-2 bg-gray-800/50 rounded text-xs">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className="text-gray-300 font-semibold">{item.title}</p>
                                                        <p className="text-gray-400 mt-1">{item.body}</p>
                                                        <p className="text-gray-500 mt-1">
                                                            {new Date(item.sentAt).toLocaleString()}
                                                            {item.clicked && ' • Clicked'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </SettingsCard>
            )}

            {/* Global Settings Tab */}
            {activeTab === 'global' && (
                <div className="space-y-6">
                    <SettingsCard title={t('quiet_hours') || 'Quiet Hours'} description={t('configure_quiet_hours') || 'Configure times when notifications should be suppressed'}>
                        <Checkbox
                            label={t('enable_quiet_hours') || 'Enable Quiet Hours'}
                            checked={settings.global.quietHours.enabled}
                            onChange={(checked) => setSettings({
                                ...settings,
                                global: {
                                    ...settings.global,
                                    quietHours: { ...settings.global.quietHours, enabled: checked }
                                }
                            })}
                        />

                        {settings.global.quietHours.enabled && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <TimeInput
                                        label={t('start_time') || 'Start Time'}
                                        value={settings.global.quietHours.start}
                                        onChange={(value) => setSettings({
                                            ...settings,
                                            global: {
                                                ...settings.global,
                                                quietHours: { ...settings.global.quietHours, start: value }
                                            }
                                        })}
                                    />
                                    <TimeInput
                                        label={t('end_time') || 'End Time'}
                                        value={settings.global.quietHours.end}
                                        onChange={(value) => setSettings({
                                            ...settings,
                                            global: {
                                                ...settings.global,
                                                quietHours: { ...settings.global.quietHours, end: value }
                                            }
                                        })}
                                    />
                                </div>

                                <div className="p-3 bg-gray-800/50 rounded-md">
                                    <p className="text-xs font-semibold text-gray-400 mb-2">{t('active_days') || 'Active Days'}</p>
                                    <div className="grid grid-cols-7 gap-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                            <label key={day} className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.global.quietHours.days.includes(index)}
                                                    onChange={(e) => {
                                                        const days = [...settings.global.quietHours.days];
                                                        if (e.target.checked) {
                                                            days.push(index);
                                                        } else {
                                                            const idx = days.indexOf(index);
                                                            if (idx > -1) days.splice(idx, 1);
                                                        }
                                                        setSettings({
                                                            ...settings,
                                                            global: {
                                                                ...settings.global,
                                                                quietHours: { ...settings.global.quietHours, days }
                                                            }
                                                        });
                                                    }}
                                                    className="mr-2"
                                                />
                                                <span className="text-xs text-gray-300">{day}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </SettingsCard>

                    <SettingsCard title={t('do_not_disturb') || 'Do Not Disturb'} description={t('temporarily_disable_all_notifications') || 'Temporarily disable all notifications'}>
                        <Checkbox
                            label={t('enable_do_not_disturb') || 'Enable Do Not Disturb'}
                            checked={settings.global.doNotDisturb.enabled}
                            onChange={(checked) => setSettings({
                                ...settings,
                                global: {
                                    ...settings.global,
                                    doNotDisturb: {
                                        ...settings.global.doNotDisturb,
                                        enabled: checked,
                                        until: checked ? undefined : settings.global.doNotDisturb.until
                                    }
                                }
                            })}
                        />

                        {settings.global.doNotDisturb.enabled && (
                            <InputField
                                label={t('until_optional') || 'Until (Optional)'}
                                id="dnd_until"
                                type="datetime-local"
                                value={settings.global.doNotDisturb.until 
                                    ? new Date(settings.global.doNotDisturb.until).toISOString().slice(0, 16)
                                    : ''}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    global: {
                                        ...settings.global,
                                        doNotDisturb: {
                                            ...settings.global.doNotDisturb,
                                            until: e.target.value ? new Date(e.target.value).toISOString() : undefined
                                        }
                                    }
                                })}
                                helpText={t('leave_empty_for_indefinite_dnd') || 'Leave empty for indefinite DND'}
                            />
                        )}
                    </SettingsCard>

                    <SettingsCard title={t('import_export') || 'Import/Export'} description={t('backup_and_restore_settings') || 'Backup and restore your notification settings'}>
                        <div className="flex gap-4">
                            <button
                                onClick={handleExportSettings}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                            >
                                {t('export_settings') || 'Export Settings'}
                            </button>
                            <button
                                onClick={handleImportSettings}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                            >
                                {t('import_settings') || 'Import Settings'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {t('bot_token_will_not_be_exported') || 'Note: Bot token will not be exported for security reasons'}
                        </p>
            </SettingsCard>
                </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <SettingsCard title={t('notification_analytics') || 'Notification Analytics'} description={t('statistics_and_performance_metrics') || 'Statistics and performance metrics'}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('telegram') || 'Telegram'}</p>
                            <p className="text-2xl font-bold text-white">{settings.analytics.telegram.totalSent}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('total_sent') || 'Total Sent'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('success_rate') || 'Success Rate'}</p>
                            <p className="text-2xl font-bold text-green-400">{settings.analytics.telegram.successRate}%</p>
                            <p className="text-xs text-gray-500 mt-1">{t('telegram') || 'Telegram'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('last_24h') || 'Last 24h'}</p>
                            <p className="text-2xl font-bold text-blue-400">{settings.analytics.telegram.last24h}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('messages') || 'Messages'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('avg_response') || 'Avg Response'}</p>
                            <p className="text-2xl font-bold text-yellow-400">{settings.analytics.telegram.averageResponseTime}ms</p>
                            <p className="text-xs text-gray-500 mt-1">{t('telegram_api') || 'Telegram API'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('browser') || 'Browser'}</p>
                            <p className="text-2xl font-bold text-white">{settings.analytics.browser.totalSent}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('total_sent') || 'Total Sent'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400 mb-1">{t('click_rate') || 'Click Rate'}</p>
                            <p className="text-2xl font-bold text-purple-400">{settings.analytics.browser.clickRate}%</p>
                            <p className="text-xs text-gray-500 mt-1">{t('browser') || 'Browser'}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <button
                            onClick={() => {
                                if (confirm(t('reset_all_analytics_data') || 'Reset all analytics data?')) {
                                    setSettings({
                                        ...settings,
                                        analytics: {
                                            telegram: {
                                                totalSent: 0,
                                                totalFailed: 0,
                                                successRate: 100,
                                                averageResponseTime: 0,
                                                last24h: 0,
                                            },
                                            browser: {
                                                totalSent: 0,
                                                totalClicked: 0,
                                                clickRate: 0,
                                                last24h: 0,
                                            },
                                        }
                                    });
                                    handleSave();
                                }
                            }}
                            className="text-sm text-red-400 hover:text-red-300"
                        >
                            {t('reset_analytics') || 'Reset Analytics'}
                        </button>
                    </div>
                </SettingsCard>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
                <button 
                    onClick={handleSave} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md transition-colors"
                >
                    {t('save_changes')}
                </button>
            </div>
            </>
            )}
        </div>
    );
};

export default NotificationsSettings;
