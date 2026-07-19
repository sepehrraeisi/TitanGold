import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAppContext } from '../context/AppContext.tsx';
import ProfileSettings from './settings/ProfileSettings.tsx';
import ConnectionsSettings from './settings/ConnectionsSettings.tsx';
import NotificationsSettings from './settings/NotificationsSettings.tsx';
import AppearanceSettings from './settings/AppearanceSettings.tsx';
import SecuritySettings from './settings/SecuritySettings.tsx';
import WalletSettings from './settings/WalletSettings.tsx';
import EmailSettings from './settings/EmailSettings.tsx';
import UsersSettings from './settings/UsersSettings.tsx';
import ConfigurationSettings from './settings/ConfigurationSettings.tsx';
import CacheSettings from './settings/CacheSettings.tsx';

type SettingsTab =
  | 'profile'
  | 'connections'
  | 'wallet'
  | 'notifications'
  | 'email'
  | 'appearance'
  | 'security'
  | 'users'
  | 'configuration'
  | 'cache';

type SettingsProps = {
  initialTab?: string;
  initialSubtab?: string;
  onNavigationComplete?: () => void;
};

const Settings: React.FC<SettingsProps> = ({ initialTab, initialSubtab, onNavigationComplete }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const userRole = user?.role || 'Trader';
  const [activeTab, setActiveTab] = useState<SettingsTab>((initialTab as SettingsTab) || 'profile');

  // Auto-navigate to initial tab when provided
  React.useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab as SettingsTab);
      // Notify parent that navigation is complete (no setTimeout needed!)
      if (onNavigationComplete) {
        onNavigationComplete();
      }
    }
  }, [initialTab, activeTab, onNavigationComplete]);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'profile',
      label: t('settings_profile'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    // Configuration tab for Admin only
    ...(userRole === 'Admin'
      ? [
          {
            id: 'configuration' as SettingsTab,
            label: t('settings_configuration'),
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            ),
          },
        ]
      : []),
    {
      id: 'connections',
      label: t('settings_connections'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
        </svg>
      ),
    },
    {
      id: 'wallet',
      label: t('settings_wallet'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path
            fillRule="evenodd"
            d="M18 9H2v6a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: t('settings_notifications'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      id: 'email',
      label: t('email_configuration') || 'Email Configuration',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      ),
    },
    {
      id: 'appearance',
      label: t('settings_appearance'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path
            fillRule="evenodd"
            d="M.464 10a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM10 18a8 8 0 100-16 8 8 0 000 16z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: 'security',
      label: t('settings_security'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 1.944A11.954 11.954 0 012.166 5.002L10 18.451l7.834-13.449A11.954 11.954 0 0110 1.944zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: 'cache',
      label: t('clear_cache'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    // Users tab only for Admin role
    ...(userRole === 'Admin'
      ? [
          {
            id: 'users',
            label: t('settings_users'),
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'configuration':
        // Guard: only allow Admin to see configuration tab
        return userRole === 'Admin' ? (
          <ConfigurationSettings initialSubtab={initialSubtab} />
        ) : null;
      case 'connections':
        return <ConnectionsSettings />;
      case 'wallet':
        return <WalletSettings />;
      case 'notifications':
        return <NotificationsSettings />;
      case 'email':
        return <EmailSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'cache':
        return <CacheSettings />;
      case 'users':
        // Guard: only allow Admin to see users tab
        return userRole === 'Admin' ? <UsersSettings /> : null;
      default:
        return null;
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
                data-tab-id={tab.id}
                data-testid={`settings-tab-${tab.id}`}
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
        <div className="flex-1">{renderContent()}</div>
      </div>
    </div>
  );
};

export default Settings;
