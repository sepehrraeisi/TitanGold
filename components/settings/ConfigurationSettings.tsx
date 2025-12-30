import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import Integrations from './configuration/Integrations.tsx';
import DecisionEngine from './configuration/DecisionEngine.tsx';
import Security from './configuration/Security.tsx';
import Monitoring from './configuration/Monitoring.tsx';

type ConfigTab = 'integrations' | 'decision-engine' | 'security' | 'monitoring';

const ConfigurationSettings: React.FC = () => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ConfigTab>('integrations');

  const tabs: { id: ConfigTab; label: string; icon: string }[] = [
    {
      id: 'integrations',
      label: language === 'fa' ? 'یکپارچه‌سازی‌ها' : 'Integrations',
      icon: '🔌',
    },
    {
      id: 'decision-engine',
      label: language === 'fa' ? 'موتور تصمیم‌گیری' : 'Decision Engine',
      icon: '🧠',
    },
    {
      id: 'security',
      label: language === 'fa' ? 'امنیت' : 'Security',
      icon: '🔐',
    },
    {
      id: 'monitoring',
      label: language === 'fa' ? 'نظارت' : 'Monitoring',
      icon: '📊',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'integrations':
        return <Integrations />;
      case 'decision-engine':
        return <DecisionEngine />;
      case 'security':
        return <Security />;
      case 'monitoring':
        return <Monitoring />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div>{renderContent()}</div>
    </div>
  );
};

export default ConfigurationSettings;
