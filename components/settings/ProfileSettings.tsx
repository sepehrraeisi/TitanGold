
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ label: string, id: string, type: string, defaultValue?: string }> = ({ label, id, type, defaultValue }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            defaultValue={defaultValue}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);


const ProfileSettings: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="space-y-6">
            <SettingsCard title={t('settings_profile')}>
                <InputField label={t('full_name')} id="full_name" type="text" defaultValue="Trader One" />
                <InputField label={t('email_address')} id="email" type="email" defaultValue="trader.one@titan.ai" />
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">{t('save_changes')}</button>
            </SettingsCard>
            <SettingsCard title={t('change_password')}>
                 <InputField label={t('current_password')} id="current_password" type="password" />
                 <InputField label={t('new_password')} id="new_password" type="password" />
                 <InputField label={t('confirm_password')} id="confirm_password" type="password" />
                 <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">{t('change_password')}</button>
            </SettingsCard>
        </div>
    );
};

export default ProfileSettings;