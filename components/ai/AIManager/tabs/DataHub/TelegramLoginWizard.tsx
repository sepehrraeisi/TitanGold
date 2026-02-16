import React, { useEffect, useMemo, useState } from 'react';
import type { Props as TelegramPanelProps } from './TelegramPanel'; // reuse types if exported, otherwise keep standalone

type CollectorForm = TelegramPanelProps extends { collectorForm: infer F } ? F : {
    apiId: string;
    apiHash: string;
    phoneNumber: string;
    code: string;
    password: string;
};

type Props = {
    t: (key: string) => string;
    isOpen: boolean;
    onClose: () => void;
    collectorForm: CollectorForm;
    handleCollectorInputChange: (field: keyof CollectorForm, value: string) => void;
    handleStartCollectorLogin: () => Promise<void> | void;
    handleConfirmCollectorLogin: () => Promise<void> | void;
    handleCancelCollectorLogin: () => Promise<void> | void;
    isLoadingCollector: boolean;
    collectorError: string | null;
    collectorMessage: string | null;
    collectorCooldownSeconds: number;
    collectorAuthId: string | null;
};

type WizardStep = 'phone' | 'code';

const TelegramLoginWizard: React.FC<Props> = ({
    t,
    isOpen,
    onClose,
    collectorForm,
    handleCollectorInputChange,
    handleStartCollectorLogin,
    handleConfirmCollectorLogin,
    handleCancelCollectorLogin,
    isLoadingCollector,
    collectorError,
    collectorMessage,
    collectorCooldownSeconds,
    collectorAuthId,
}) => {
    const [step, setStep] = useState<WizardStep>('phone');

    // وقتی authId ست شد، به صورت خودکار به مرحله کد می‌رویم
    useEffect(() => {
        if (collectorAuthId) {
            setStep('code');
        }
    }, [collectorAuthId]);

    // اگر مودال بسته شد، مرحله را ریست کن
    useEffect(() => {
        if (!isOpen) {
            setStep('phone');
        }
    }, [isOpen]);

    const isFloodCooldown = collectorCooldownSeconds > 0;

    const handleBackgroundClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (e.target === e.currentTarget && !isLoadingCollector) {
            onClose();
        }
    };

    const handleStartClick = async () => {
        await handleStartCollectorLogin();
        // مرحله بعد را با effect روی collectorAuthId کنترل می‌کنیم
    };

    const handleConfirmClick = async () => {
        await handleConfirmCollectorLogin();
    };

    if (!isOpen) return null;

    const stepIndex = step === 'phone' ? 1 : 2;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleBackgroundClick}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-900/85 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-white/10">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-purple-300/80">
                                {t('telegram_login_wizard') || 'Telegram Login Wizard'}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground mt-0.5">
                                {step === 'phone'
                                    ? (t('telegram_step_phone_title') || 'Step 1 – Enter phone number')
                                    : (t('telegram_step_code_title') || 'Step 2 – Enter code')}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isLoadingCollector}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                        >
                            ✕
                        </button>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400 transition-all duration-300"
                                style={{ width: stepIndex === 1 ? '50%' : '100%' }}
                            />
                        </div>
                        <span className="text-[10px] text-slate-300">
                            {stepIndex}/2
                        </span>
                    </div>
                    {isFloodCooldown && (
                        <p className="mt-2 text-[11px] text-amber-300">
                            {t('telegram_cooldown_wait') ||
                                `Please wait ${collectorCooldownSeconds} seconds before requesting a new code.`}
                        </p>
                    )}
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                    {collectorError && (
                        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
                            {collectorError}
                        </div>
                    )}
                    {collectorMessage && !collectorError && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                            {collectorMessage}
                        </div>
                    )}

                    {step === 'phone' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">
                                    {t('phone_number') || 'Phone Number'}
                                </label>
                                <input
                                    value={collectorForm.phoneNumber}
                                    onChange={(e) =>
                                        handleCollectorInputChange('phoneNumber', e.target.value)
                                    }
                                    placeholder="+98912..."
                                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    disabled={isLoadingCollector}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('telegram_api_id') || 'Telegram API ID'}
                                    </label>
                                    <input
                                        type="number"
                                        value={(collectorForm as any).apiId}
                                        onChange={(e) =>
                                            handleCollectorInputChange('apiId' as any, e.target.value)
                                        }
                                        placeholder={t('optional') || 'Optional'}
                                        className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        disabled={isLoadingCollector}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">
                                        {t('telegram_api_hash') || 'Telegram API Hash'}
                                    </label>
                                    <input
                                        value={(collectorForm as any).apiHash}
                                        onChange={(e) =>
                                            handleCollectorInputChange(
                                                'apiHash' as any,
                                                e.target.value,
                                            )
                                        }
                                        placeholder={t('optional') || 'Optional'}
                                        className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        disabled={isLoadingCollector}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleStartClick}
                                disabled={isLoadingCollector || isFloodCooldown}
                                className="w-full mt-1 text-xs px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium shadow-sm"
                            >
                                {isLoadingCollector
                                    ? (t('loading') || 'Loading...')
                                    : (t('send_verification_code') || 'Send Verification Code')}
                            </button>
                            <p className="text-[11px] text-muted-foreground">
                                {t('telegram_login_hint') ||
                                    'Collector stores the Telegram session securely on the server. API credentials are optional if already configured.'}
                            </p>
                        </div>
                    )}

                    {step === 'code' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">
                                    {t('verification_code') || 'Verification Code'}
                                </label>
                                <input
                                    value={(collectorForm as any).code}
                                    onChange={(e) =>
                                        handleCollectorInputChange('code' as any, e.target.value)
                                    }
                                    placeholder="12345"
                                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    disabled={isLoadingCollector || !collectorAuthId}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">
                                    {t('telegram_password_optional') || 'Telegram Password (2FA)'}
                                </label>
                                <input
                                    type="password"
                                    value={(collectorForm as any).password}
                                    onChange={(e) =>
                                        handleCollectorInputChange(
                                            'password' as any,
                                            e.target.value,
                                        )
                                    }
                                    placeholder={t('optional') || 'Optional'}
                                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    disabled={isLoadingCollector || !collectorAuthId}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleConfirmClick}
                                    disabled={isLoadingCollector || !collectorAuthId}
                                    className="flex-1 text-xs px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
                                >
                                    {t('confirm_login') || 'Confirm Login'}
                                </button>
                                <button
                                    onClick={handleCancelCollectorLogin}
                                    disabled={isLoadingCollector || !collectorAuthId}
                                    className="text-xs px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {collectorAuthId
                                    ? (t('code_sent_status') ||
                                          'Code sent. Complete login before it expires.')
                                    : (t('no_active_login') || 'No active login request.')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TelegramLoginWizard;

