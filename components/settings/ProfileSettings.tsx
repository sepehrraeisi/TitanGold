
import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    ProfileSettingsData,
    ProfileDetailsUpdate,
    ProfileCommunicationSettings,
} from '../../types.ts';
import Skeleton from '../ui/skeleton.tsx';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode, description?: string }> = ({ title, children, description }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const TextField: React.FC<{
    label: string;
    id: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
}> = ({ label, id, value, onChange, type = 'text' }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={event => onChange(event.target.value)}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

const Toggle: React.FC<{ label: string, checked: boolean, onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between text-sm text-gray-200">
        <span>{label}</span>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-600'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </label>
);

const ProfileSettings: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<ProfileSettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [details, setDetails] = useState<ProfileDetailsUpdate>({});
    const [preferences, setPreferences] = useState<ProfileCommunicationSettings | null>(null);
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', next: '' });
    const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const response = await api.fetchProfileSettings();
            setData(response);
            setDetails({
                fullName: response.profile.fullName,
                email: response.profile.email,
                jobTitle: response.profile.jobTitle,
                phone: response.profile.phone,
                timezone: response.profile.timezone,
                language: response.profile.language,
                location: response.profile.location,
            });
            setPreferences(response.communications);
            setIsLoading(false);
        };

        load();
    }, []);

    const profileStatusKey = useMemo(() => {
        if (!data) return '';
        switch (data.profile.status) {
            case 'verified':
                return 'profile_status_verified';
            case 'pending':
                return 'profile_status_pending';
            default:
                return 'profile_status_restricted';
        }
    }, [data]);

    const handleDetailChange = (field: keyof ProfileDetailsUpdate, value: string) => {
        setDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveDetails = async () => {
        if (!details) return;
        setIsSavingDetails(true);
        const updated = await api.saveProfileDetails(details);
        setData(updated);
        setIsSavingDetails(false);
    };

    const handlePreferenceChange = (field: keyof ProfileCommunicationSettings, value: boolean) => {
        setPreferences(prev => prev ? ({ ...prev, [field]: value }) : prev);
    };

    const handleSavePreferences = async () => {
        if (!preferences) return;
        setIsSavingPreferences(true);
        const updated = await api.saveProfileCommunications(preferences);
        setData(updated);
        setPreferences(updated.communications);
        setIsSavingPreferences(false);
    };

    const handleChangePassword = async () => {
        setIsChangingPassword(true);
        const result = await api.changeProfilePassword({ currentPassword: passwords.current, newPassword: passwords.next });
        setPasswordFeedback(result.message);
        if (result.success) {
            setPasswords({ current: '', next: '' });
        }
        setIsChangingPassword(false);
    };

    if (isLoading || !data || !preferences) {
        return (
            <div className="space-y-6">
                {[...Array(3)].map((_, index) => (
                    <div key={index} className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {data.metrics.map(metric => (
                    <div key={metric.id} className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
                        <p className="text-sm text-gray-400">{t(metric.labelKey)}</p>
                        <div className="flex items-end gap-2 mt-2">
                            <span className="text-2xl font-semibold text-white">{metric.value}</span>
                            {typeof metric.change === 'number' && (
                                <span className={`text-xs font-medium ${metric.direction === 'down' ? 'text-red-400' : 'text-green-400'}`}>
                                    {metric.direction === 'down' ? '▼' : '▲'} {Math.abs(metric.change)}%
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <SettingsCard title={t('account_details')} description={t('account_details_desc')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField label={t('full_name')} id="full_name" value={details.fullName ?? ''} onChange={value => handleDetailChange('fullName', value)} />
                    <TextField label={t('email_address')} id="email" type="email" value={details.email ?? ''} onChange={value => handleDetailChange('email', value)} />
                    <TextField label={t('job_title')} id="job_title" value={details.jobTitle ?? ''} onChange={value => handleDetailChange('jobTitle', value)} />
                    <TextField label={t('phone_number')} id="phone" value={details.phone ?? ''} onChange={value => handleDetailChange('phone', value)} />
                    <TextField label={t('timezone')} id="timezone" value={details.timezone ?? ''} onChange={value => handleDetailChange('timezone', value)} />
                    <TextField label={t('location')} id="location" value={details.location ?? ''} onChange={value => handleDetailChange('location', value)} />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <div>
                        <p>{t('profile_member_since', { date: new Date(data.profile.memberSince).toLocaleDateString() })}</p>
                        <p>{t('profile_last_login', { time: new Date(data.profile.lastLoginAt).toLocaleString() })}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-3 py-1 text-xs font-semibold text-gray-200">
                        <span className={`h-2 w-2 rounded-full ${data.profile.status === 'verified' ? 'bg-green-400' : data.profile.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        {t(profileStatusKey)}
                    </span>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleSaveDetails}
                        disabled={isSavingDetails}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-md"
                    >
                        {isSavingDetails ? t('saving') : t('save_changes')}
                    </button>
                </div>
            </SettingsCard>

            <SettingsCard title={t('communication_preferences')} description={t('communication_preferences_desc')}>
                <div className="space-y-3">
                    <Toggle label={t('communication_email_reports')} checked={preferences.emailReports} onChange={value => handlePreferenceChange('emailReports', value)} />
                    <Toggle label={t('communication_sms_alerts')} checked={preferences.smsAlerts} onChange={value => handlePreferenceChange('smsAlerts', value)} />
                    <Toggle label={t('communication_ai_summaries')} checked={preferences.aiSummaries} onChange={value => handlePreferenceChange('aiSummaries', value)} />
                    <Toggle label={t('communication_trade_push')} checked={preferences.tradePush} onChange={value => handlePreferenceChange('tradePush', value)} />
                    <Toggle label={t('communication_weekly_digest')} checked={preferences.weeklyDigest} onChange={value => handlePreferenceChange('weeklyDigest', value)} />
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleSavePreferences}
                        disabled={isSavingPreferences}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-md"
                    >
                        {isSavingPreferences ? t('saving') : t('save_changes')}
                    </button>
                </div>
            </SettingsCard>

            <SettingsCard title={t('connected_integrations')} description={t('connected_integrations_desc')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.integrations.map(integration => (
                        <div key={integration.id} className="border border-gray-800 rounded-lg p-4 bg-[#111827]">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-semibold text-white">{t(integration.nameKey)}</h4>
                                    <p className="text-xs text-gray-400">{t(`integration_type_${integration.type}`)}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${integration.status === 'connected' ? 'bg-green-500/20 text-green-400' : integration.status === 'syncing' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {t(`integration_status_${integration.status}`)}
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-gray-500">
                                {t('last_synced_at', { time: new Date(integration.lastSyncedAt).toLocaleString() })}
                            </p>
                        </div>
                    ))}
                </div>
            </SettingsCard>

            <SettingsCard title={t('change_password')} description={t('change_password_desc')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField label={t('current_password')} id="current_password" type="password" value={passwords.current} onChange={value => setPasswords(prev => ({ ...prev, current: value }))} />
                    <TextField label={t('new_password')} id="new_password" type="password" value={passwords.next} onChange={value => setPasswords(prev => ({ ...prev, next: value }))} />
                </div>
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-md"
                    >
                        {isChangingPassword ? t('saving') : t('change_password')}
                    </button>
                    {passwordFeedback && (
                        <span className="text-sm text-gray-400">{t(passwordFeedback)}</span>
                    )}
                </div>
            </SettingsCard>

            <SettingsCard title={t('recent_activity')}>
                <ul className="space-y-3">
                    {data.activity.map(entry => (
                        <li key={entry.id} className="flex items-center justify-between text-sm text-gray-300">
                            <div>
                                <p className="font-medium text-white">{t(entry.messageKey, { context: entry.context })}</p>
                                <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </SettingsCard>
        </div>
    );
};

export default ProfileSettings;