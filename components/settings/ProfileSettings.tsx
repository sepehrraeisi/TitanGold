
import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    ProfileSettingsData,
    ProfileDetailsUpdate,
    ProfileCommunicationSettings,
} from '../../types.ts';
import Skeleton from '../ui/skeleton.tsx';
import { useAppContext } from '../../context/AppContext.tsx';

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
    const { setAvatarUrl } = useAppContext();
    const [data, setData] = useState<ProfileSettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [details, setDetails] = useState<ProfileDetailsUpdate>({});
    const [preferences, setPreferences] = useState<ProfileCommunicationSettings | null>(null);
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', next: '' });
    const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
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
                // Set avatar preview if exists
                if (response.profile.avatarUrl) {
                    setAvatarPreview(response.profile.avatarUrl);
                    setAvatarUrl(response.profile.avatarUrl);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load profile');
            } finally {
                setIsLoading(false);
            }
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
        setError(null);
        setSuccess(null);
        
        try {
            const updated = await api.saveProfileDetails(details);
            setData(updated);
            setSuccess(t('profile_details_saved'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save details');
        } finally {
            setIsSavingDetails(false);
        }
    };

    const handlePreferenceChange = (field: keyof ProfileCommunicationSettings, value: boolean) => {
        setPreferences(prev => prev ? ({ ...prev, [field]: value }) : prev);
    };

    const handleSavePreferences = async () => {
        if (!preferences) return;
        setIsSavingPreferences(true);
        setError(null);
        setSuccess(null);
        
        try {
            const updated = await api.saveProfileCommunications(preferences);
            setData(updated);
            setPreferences(updated.communications);
            setSuccess(t('preferences_saved'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save preferences');
        } finally {
            setIsSavingPreferences(false);
        }
    };

    const handleChangePassword = async () => {
        setIsChangingPassword(true);
        setError(null);
        setPasswordFeedback(null);
        
        try {
            const result = await api.changeProfilePassword({ currentPassword: passwords.current, newPassword: passwords.next });
            setPasswordFeedback(result.message);
            if (result.success) {
                setPasswords({ current: '', next: '' });
                setSuccess(t('password_changed'));
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(t(result.message));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError(t('invalid_image_file'));
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError(t('image_too_large'));
            return;
        }

        try {
            setError(null);
            setSuccess(null);

            // Upload to backend
            const { avatarUrl } = await api.uploadAvatar(file);

            // Update preview and AppContext immediately
            setAvatarPreview(avatarUrl);
            setAvatarUrl(avatarUrl);

            // Persist avatar URL in profile settings (client-side profile store)
            const updated = await api.saveProfileDetails({ avatarUrl });
            setData(updated);

            // Ensure event is dispatched (should also happen in saveProfileDetails)
            window.dispatchEvent(new CustomEvent('titan_avatar_updated'));

            setSuccess(t('avatar_updated'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to upload avatar:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload avatar');
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
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
            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-300 text-sm">
                    {success}
                </div>
            )}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
                    {error}
                </div>
            )}

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
                {/* Avatar Upload Section */}
                <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-800">
                    <div className="relative">
                        <img
                            src={avatarPreview || data?.profile.avatarUrl || 'https://i.pravatar.cc/40?u=traderone'}
                            alt="Profile"
                            className="h-24 w-24 rounded-full object-cover ring-4 ring-gray-700"
                            onError={(e) => {
                                // Fallback to default if image fails to load
                                (e.target as HTMLImageElement).src = 'https://i.pravatar.cc/40?u=traderone';
                            }}
                        />
                        <button
                            onClick={handleUploadClick}
                            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg"
                            title={t('change_avatar')}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarChange}
                        accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                        className="hidden"
                    />
                    <p className="text-xs text-gray-400 mt-2">{t('avatar_upload_hint')}</p>
                </div>

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