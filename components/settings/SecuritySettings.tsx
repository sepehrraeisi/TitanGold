
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6">
            {children}
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean; setEnabled: (enabled: boolean) => void }> = ({ enabled, setEnabled }) => (
  <button
    onClick={() => setEnabled(!enabled)}
    className={`${
      enabled ? 'bg-blue-600' : 'bg-gray-600'
    } relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}
  >
    <span
      className={`${
        enabled ? 'translate-x-6' : 'translate-x-1'
      } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
    />
  </button>
);


const SecuritySettings: React.FC = () => {
    const { t } = useLanguage();
    const [is2faEnabled, setIs2faEnabled] = useState(false);
    
    return (
        <div className="space-y-6">
            <SettingsCard title={t('two_factor_auth')}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-200">{t('enable_2fa')}</p>
                        <p className="text-sm text-gray-400">Protect your account with an extra layer of security.</p>
                    </div>
                    <ToggleSwitch enabled={is2faEnabled} setEnabled={setIs2faEnabled} />
                </div>
            </SettingsCard>
             <SettingsCard title={t('active_sessions')}>
                <ul className="space-y-3">
                    <li className="flex items-center justify-between text-sm">
                        <div>
                            <p className="font-semibold text-white">Chrome on macOS</p>
                            <p className="text-gray-400">New York, USA (Current session)</p>
                        </div>
                        <button className="text-blue-400 hover:underline">{t('logout')}</button>
                    </li>
                     <li className="flex items-center justify-between text-sm">
                        <div>
                            <p className="font-semibold text-white">iPhone App</p>
                            <p className="text-gray-400">New York, USA</p>
                        </div>
                        <button className="text-blue-400 hover:underline">{t('logout')}</button>
                    </li>
                </ul>
            </SettingsCard>
        </div>
    );
};

export default SecuritySettings;