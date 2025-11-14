
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';

const SettingsCard: React.FC<{ title: string, description?: string, children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ label: string, id: string, type: string, placeholder?: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, id, type, placeholder, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

const NotificationsSettings: React.FC = () => {
    const { t } = useLanguage();
    const [botToken, setBotToken] = useState('');
    const [channelId, setChannelId] = useState('');
    const [testStatus, setTestStatus] = useState('');
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(Notification.permission);

    useEffect(() => {
        const fetchSettings = async () => {
            const settings = await api.fetchNotificationSettings();
            setBotToken(settings.botToken);
            setChannelId(settings.channelId);
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        await api.saveNotificationSettings({ botToken, channelId });
        // Optionally show a success message
    };

    const handleTest = async () => {
        setTestStatus('Sending...');
        const result = await api.sendTestTelegramMessage(botToken, channelId);
        setTestStatus(result.message);
    };
    
    const handleRequestPermission = async () => {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
        return;
      }
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
    };

    const handleSendTestNotification = () => {
      if (permissionStatus === 'granted') {
        new Notification('Titan Trade Alert', {
          body: 'This is a test notification from your Titan trading system.',
          icon: '/vite.svg'
        });
      }
    };
    
    const renderPermissionStatus = () => {
        switch (permissionStatus) {
            case 'granted':
                return <span className="text-sm text-green-400">{t('permission_granted')}</span>;
            case 'denied':
                return <span className="text-sm text-red-400">{t('permission_denied')}</span>;
            default:
                return <span className="text-sm text-yellow-400">{t('permission_default')}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <SettingsCard title={t('telegram_notifications')} description="Get real-time trade alerts, predictions, and news analysis in your Telegram.">
                <InputField label={t('telegram_bot_token')} id="bot_token" type="text" placeholder="Enter your Telegram bot token" value={botToken} onChange={e => setBotToken(e.target.value)} />
                <InputField label={t('telegram_channel_id')} id="channel_id" type="text" placeholder="Enter your Telegram channel ID" value={channelId} onChange={e => setChannelId(e.target.value)} />
                <div className="flex gap-4 items-center">
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">{t('save_changes')}</button>
                    <button onClick={handleTest} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">{t('send_test_message')}</button>
                    {testStatus && <span className="text-sm text-gray-400">{testStatus}</span>}
                </div>
            </SettingsCard>
            <SettingsCard title={t('browser_push_notifications')} description={t('push_notifications_desc')}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-300 font-medium">{t('permission_status')}</p>
                        {renderPermissionStatus()}
                    </div>
                     <div>
                        {permissionStatus === 'default' && (
                            <button onClick={handleRequestPermission} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                {t('enable_push_notifications')}
                            </button>
                        )}
                        {permissionStatus === 'granted' && (
                             <button onClick={handleSendTestNotification} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                {t('send_test_push_notification')}
                            </button>
                        )}
                    </div>
                </div>
            </SettingsCard>
        </div>
    );
};

export default NotificationsSettings;
