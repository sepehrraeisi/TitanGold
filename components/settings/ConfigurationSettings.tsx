import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import Integrations from './configuration/Integrations.tsx';

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
        return (
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">🧠</div>
            <h3 className="text-xl font-bold text-white mb-2">
              {language === 'fa' ? 'موتور تصمیم‌گیری' : 'Decision Engine Settings'}
            </h3>
            <p className="text-gray-400">
              {language === 'fa' 
                ? 'تنظیمات مدل فعال، استراتژی رأی‌گیری، و کوئروم'
                : 'Active model, voting strategy, and quorum settings'}
            </p>
            <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
          </div>
        );
      case 'security':
        return (
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-white mb-2">
              {language === 'fa' ? 'تنظیمات امنیت' : 'Security Settings'}
            </h3>
            <p className="text-gray-400">
              {language === 'fa' 
                ? 'رمزنگاری، دسترسی‌ها، و گزارش‌های ممیزی'
                : 'Encryption, access controls, and audit logs'}
            </p>
            <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
          </div>
        );
      case 'monitoring':
        return (
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-2">
              {language === 'fa' ? 'نظارت سیستم' : 'System Monitoring'}
            </h3>
            <p className="text-gray-400">
              {language === 'fa' 
                ? 'سلامت ارائه‌دهندگان، لاگ‌ها، و متریک‌های عملکرد'
                : 'Provider health, logs, and performance metrics'}
            </p>
            <p className="text-sm text-gray-500 mt-4">Coming soon...</p>
          </div>
        );
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
