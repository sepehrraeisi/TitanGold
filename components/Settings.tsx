import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import ProfileSettings from './settings/ProfileSettings.tsx';
import ConnectionsSettings from './settings/ConnectionsSettings.tsx';
import NotificationsSettings from './settings/NotificationsSettings.tsx';
import AppearanceSettings from './settings/AppearanceSettings.tsx';
import SecuritySettings from './settings/SecuritySettings.tsx';
import UsersSettings from './settings/UsersSettings.tsx';
import WalletSettings from './settings/WalletSettings.tsx';
import AutomationSettings from './settings/AutomationSettings.tsx';

type SettingsTab = 'profile' | 'connections' | 'notifications' | 'appearance' | 'security' | 'users' | 'wallet' | 'automation';

const Settings: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: t('settings_profile'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> },
        { id: 'connections', label: t('settings_connections'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" /></svg> },
        { id: 'wallet', label: t('settings_wallet'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v6a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" /></svg> },
        { id: 'notifications', label: t('settings_notifications'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg> },
        { id: 'automation', label: t('settings_automation'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg> },
        { id: 'appearance', label: t('settings_appearance'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.464 10a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM10 18a8 8 0 100-16 8 8 0 000 16z" clipRule="evenodd" /></svg> },
        { id: 'security', label: t('settings_security'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5.002L10 18.451l7.834-13.449A11.954 11.954 0 0110 1.944zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg> },
        { id: 'users', label: t('settings_users'), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0110 13v-2.267a5.002 5.002 0 01-4.002-4.433 3 3 0 112.578-1.932A5.002 5.002 0 0110 13v2.267a5 5 0 014 4.433A6.97 6.97 0 0014 16a1 1 0 102 0c0-1.22-.32-2.36-.87-3.33.39-.355.75-.75 1.05-1.192A5 5 0 1113 5.57a3 3 0 11-1.002 2.196 5.002 5.002 0 01-4.193 4.434A6.97 6.97 0 006 16a1 1 0 102 0c0-.34.024-.673.07-1h4.86z" /></svg> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'connections': return <ConnectionsSettings />;
            case 'wallet': return <WalletSettings />;
            case 'notifications': return <NotificationsSettings />;
            case 'automation': return <AutomationSettings />;
            case 'appearance': return <AppearanceSettings />;
            case 'security': return <SecuritySettings />;
            case 'users': return <UsersSettings />;
            default: return null;
        }
    };

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-1/4 lg:w-1/5">
                    <nav className="space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </aside>
                <div className="flex-1">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Settings;