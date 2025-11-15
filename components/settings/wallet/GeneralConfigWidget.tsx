
import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { WalletPreferences } from '../../../types.ts';

interface GeneralConfigWidgetProps {
    preferences: WalletPreferences;
    onSave: (preferences: WalletPreferences) => void;
    isSaving: boolean;
}

const GeneralConfigWidget: React.FC<GeneralConfigWidgetProps> = ({ preferences, onSave, isSaving }) => {
    const { t } = useLanguage();
    const [draft, setDraft] = useState<WalletPreferences>(preferences);

    const handleChange = <K extends keyof WalletPreferences>(key: K, value: WalletPreferences[K]) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        onSave(draft);
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full space-y-4">
            <div>
                <h3 className="font-semibold text-white mb-1">{t('general_wallet_config')}</h3>
                <p className="text-xs text-gray-400">{t('general_wallet_config_desc')}</p>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('base_currency')}</label>
                    <select
                        value={draft.baseCurrency}
                        onChange={event => handleChange('baseCurrency', event.target.value)}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="IRR">IRR</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('auto_refresh_balance')}</label>
                    <input
                        type="number"
                        value={draft.autoRefreshIntervalMinutes}
                        onChange={event => handleChange('autoRefreshIntervalMinutes', Number(event.target.value))}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('low_balance_threshold')}</label>
                    <input
                        type="number"
                        value={draft.lowBalanceThreshold}
                        onChange={event => handleChange('lowBalanceThreshold', Number(event.target.value))}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    />
                </div>
                <label className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{t('show_zero_balance')}</span>
                    <input
                        type="checkbox"
                        checked={draft.showZeroBalance}
                        onChange={event => handleChange('showZeroBalance', event.target.checked)}
                        className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500"
                    />
                </label>
            </div>
            <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg"
            >
                {isSaving ? t('saving') : t('save_changes')}
            </button>
        </div>
    );
};

export default GeneralConfigWidget;
