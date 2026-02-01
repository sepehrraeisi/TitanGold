
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { SecuritySettingsData, SecurityAlertSettings } from '../../types.ts';
import Skeleton from '../ui/skeleton.tsx';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode, description?: string }> = ({ title, children, description }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

const AlertToggle: React.FC<{ label: string, checked: boolean, onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between text-sm text-gray-200">
        <span>{label}</span>
        <ToggleSwitch enabled={checked} onToggle={() => onChange(!checked)} />
    </label>
);

const SecuritySettings: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<SecuritySettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [alerts, setAlerts] = useState<SecurityAlertSettings | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
    const [twoFactorQR, setTwoFactorQR] = useState<string | null>(null);
    const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [setupError, setSetupError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const response = await api.fetchSecuritySettings();
            setData(response);
            setAlerts(response.alerts);
            setIsLoading(false);
        };
        load();
    }, []);

    const handleToggle2fa = async () => {
        if (!data) return;
        
        if (!data.twoFactor.enabled) {
            // Enable 2FA - Show setup modal
            try {
                setIsProcessing(true);
                setSetupError(null);
                const setupResult = await api.setup2FA();
                setTwoFactorQR(setupResult.qrCode);
                setTwoFactorSecret(setupResult.manualEntryKey);
                setShowTwoFactorSetup(true);
            } catch (error: any) {
                console.error('Failed to setup 2FA:', error);
                setSetupError(error.message || 'Failed to setup 2FA');
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Disable 2FA
            try {
                setIsProcessing(true);
                await api.disable2FA();
                const updated = await api.fetchSecuritySettings();
                setData(updated);
                setAlerts(updated.alerts);
            } catch (error: any) {
                console.error('Failed to disable 2FA:', error);
                setSetupError(error.message || 'Failed to disable 2FA');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleVerify2FA = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setSetupError('Please enter a valid 6-digit code');
            return;
        }
        
        try {
            setIsProcessing(true);
            setSetupError(null);
            await api.verify2FA(verificationCode);
            setShowTwoFactorSetup(false);
            setVerificationCode('');
            setTwoFactorQR(null);
            setTwoFactorSecret(null);
            
            // Refresh settings
            const updated = await api.fetchSecuritySettings();
            setData(updated);
            setAlerts(updated.alerts);
        } catch (error: any) {
            console.error('Failed to verify 2FA:', error);
            setSetupError(error.message || 'Invalid verification code. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAlertChange = async (field: keyof SecurityAlertSettings, value: boolean) => {
        if (!alerts) return;
        const next = { ...alerts, [field]: value };
        setAlerts(next);
        const updated = await api.updateSecurityAlerts(next);
        setData(updated);
        setAlerts(updated.alerts);
    };

    const handleRevokeSession = async (sessionId: string) => {
        const updated = await api.revokeSecuritySession(sessionId);
        setData(updated);
    };

    const handleGenerateBackupCodes = async () => {
        setIsProcessing(true);
        const { codes, data: updated } = await api.generateSecurityBackupCodes();
        setBackupCodes(codes);
        setData(updated);
        setIsProcessing(false);
    };

    if (isLoading || !data || !alerts) {
        return (
            <div className="space-y-6">
                {[...Array(2)].map((_, index) => (
                    <div key={index} className="bg-[#161B22] border border-gray-800 rounded-xl p-6 space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
                    <p className="text-sm text-gray-400">{t('security_score')}</p>
                    <p className="text-3xl font-bold text-white">{data.score}</p>
                </div>
                <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
                    <p className="text-sm text-gray-400">{t('backup_codes_remaining')}</p>
                    <p className="text-3xl font-bold text-white">{data.twoFactor.backupCodesRemaining}</p>
                </div>
                <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
                    <p className="text-sm text-gray-400">{t('security_last_reviewed')}</p>
                    <p className="text-lg font-semibold text-white">{new Date(data.lastReviewed).toLocaleDateString()}</p>
                </div>
            </div>

            <SettingsCard title={t('two_factor_auth')} description={t('two_factor_desc')}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-200">{data.twoFactor.enabled ? t('two_factor_enabled') : t('two_factor_disabled')}</p>
                            <p className="text-sm text-gray-400">{t('two_factor_method', { method: t(`two_factor_method_${data.twoFactor.primaryMethod}`) })}</p>
                        </div>
                        <ToggleSwitch enabled={data.twoFactor.enabled} onToggle={handleToggle2fa} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {data.methods.map(method => (
                            <span key={method.id} className={`px-3 py-1 rounded-full text-xs font-semibold border ${method.enabled ? 'border-green-400/60 text-green-300' : 'border-gray-600 text-gray-400'}`}>
                                {t(`two_factor_method_${method.type}`)}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleGenerateBackupCodes}
                            disabled={isProcessing}
                            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
                        >
                            {t('regenerate_backup_codes')}
                        </button>
                        {backupCodes.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                                {backupCodes.map(code => (
                                    <span key={code} className="px-2 py-1 bg-[#0D111C] border border-gray-700 rounded-md">{code}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard title={t('security_alerts')} description={t('security_alerts_desc')}>
                <div className="space-y-3">
                    <AlertToggle label={t('suspicious_login_alert')} checked={alerts.suspiciousLogin} onChange={value => handleAlertChange('suspiciousLogin', value)} />
                    <AlertToggle label={t('large_withdrawal_alert')} checked={alerts.largeWithdrawal} onChange={value => handleAlertChange('largeWithdrawal', value)} />
                    <AlertToggle label={t('new_device_alert')} checked={alerts.newDevice} onChange={value => handleAlertChange('newDevice', value)} />
                </div>
            </SettingsCard>

            <SettingsCard title={t('active_sessions')} description={t('security_sessions_desc')}>
                <ul className="space-y-3">
                    {data.sessions.map(session => (
                        <li key={session.id} className="flex items-center justify-between text-sm">
                            <div>
                                <p className="font-semibold text-white">{session.device}</p>
                                <p className="text-gray-400 text-xs">{session.location} • {session.ipAddress}</p>
                                <p className="text-gray-500 text-xs">{t('last_active_at', { time: new Date(session.lastActiveAt).toLocaleString() })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {session.current && <span className="text-xs text-green-400 font-semibold">{t('current_session')}</span>}
                                <button className="text-blue-400 hover:underline text-xs" onClick={() => handleRevokeSession(session.id)}>
                                    {t('end_session')}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </SettingsCard>

            <SettingsCard title={t('security_events')} description={t('security_events_desc')}>
                <ul className="space-y-3">
                    {data.events.length === 0 && (
                        <li className="text-sm text-gray-400">{t('no_security_events')}</li>
                    )}
                    {data.events.map(event => (
                        <li key={event.id} className="flex items-start justify-between gap-4 text-sm">
                            <div>
                                <p className="font-semibold text-white">{t(event.titleKey)}</p>
                                <p className="text-gray-400 text-xs">{t(event.descriptionKey)}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${event.severity === 'high' ? 'bg-red-500/20 text-red-400' : event.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                {t(`security_severity_${event.severity}`)}
                            </span>
                        </li>
                    ))}
                </ul>
            </SettingsCard>

            {/* 2FA Setup Modal */}
            {showTwoFactorSetup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-semibold text-white mb-4">{t('setup_2fa') || 'Setup Two-Factor Authentication'}</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-400 mb-2">
                                    {t('scan_qr_code') || 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):'}
                                </p>
                                {twoFactorQR ? (
                                    <div className="flex justify-center p-4 bg-white rounded-lg">
                                        <img src={twoFactorQR} alt="2FA QR Code" className="w-64 h-64" />
                                    </div>
                                ) : (
                                    <div className="p-4 bg-gray-800 rounded-lg text-center text-gray-400">
                                        {t('qr_code_unavailable') || 'QR code unavailable'}
                                    </div>
                                )}
                            </div>

                            {twoFactorSecret && (
                                <div>
                                    <p className="text-sm text-gray-400 mb-2">
                                        {t('or_enter_manually') || 'Or enter this key manually:'}
                                    </p>
                                    <div className="p-3 bg-gray-800 rounded-lg font-mono text-sm text-gray-300 break-all">
                                        {twoFactorSecret}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(twoFactorSecret);
                                        }}
                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        {t('copy_to_clipboard') || 'Copy to clipboard'}
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('verification_code') || 'Enter verification code:'}
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        setVerificationCode(value);
                                        setSetupError(null);
                                    }}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="000000"
                                />
                            </div>

                            {setupError && (
                                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
                                    {setupError}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleVerify2FA}
                                    disabled={isProcessing || verificationCode.length !== 6}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
                                >
                                    {isProcessing ? (t('verifying') || 'Verifying...') : (t('verify_and_enable') || 'Verify and Enable')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowTwoFactorSetup(false);
                                        setVerificationCode('');
                                        setTwoFactorQR(null);
                                        setTwoFactorSecret(null);
                                        setSetupError(null);
                                    }}
                                    disabled={isProcessing}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecuritySettings;