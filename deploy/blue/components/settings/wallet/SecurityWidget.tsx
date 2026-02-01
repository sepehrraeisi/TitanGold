
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import * as api from '../../../services/api.ts';
import type { WalletSecurityControl } from '../../../types.ts';

interface SecurityWidgetProps {
    controls: WalletSecurityControl[];
    onToggle: (controlId: string, enabled: boolean) => void;
}

const SecurityWidget: React.FC<SecurityWidgetProps> = ({ controls, onToggle }) => {
    const { t } = useLanguage();
    const [maxWithdrawal, setMaxWithdrawal] = useState(10000);
    const [authorizedAddresses, setAuthorizedAddresses] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSecuritySettings();
    }, []);

    const loadSecuritySettings = async () => {
        try {
            const settings = await api.fetchWalletSecuritySettings();
            setMaxWithdrawal(settings.maxDailyWithdrawal);
            setAuthorizedAddresses(settings.authorizedAddresses.join('\n'));
        } catch (error) {
            console.error('Failed to load security settings:', error);
        }
    };

    const handleSaveSecuritySettings = async () => {
        setSaving(true);
        try {
            const addresses = authorizedAddresses
                .split('\n')
                .map(addr => addr.trim())
                .filter(addr => addr.length > 0 && /^0x[a-fA-F0-9]{40}$/.test(addr));
            
            await api.saveWalletSecuritySettings({
                maxDailyWithdrawal: maxWithdrawal,
                authorizedAddresses: addresses,
            });
            
            alert(t('settings_saved') || 'Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save security settings:', error);
            alert(t('failed_to_save') || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleBackupWallets = () => {
        // Export wallet connections as JSON
        api.fetchWalletConnections().then(wallets => {
            const dataStr = JSON.stringify(wallets, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `wallet-backup-${new Date().toISOString()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('wallet_security')}</h3>
            <div className="space-y-3">
                {controls.map(control => (
                    <Checkbox
                        key={control.id}
                        label={t(control.labelKey)}
                        checked={control.enabled}
                        onChange={value => onToggle(control.id, value)}
                    />
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('max_daily_withdrawal')}</label>
                    <input 
                        type="number" 
                        value={maxWithdrawal}
                        onChange={(e) => setMaxWithdrawal(Number(e.target.value))}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('authorized_withdrawal_addresses')}</label>
                    <textarea 
                        rows={3} 
                        value={authorizedAddresses}
                        onChange={(e) => setAuthorizedAddresses(e.target.value)}
                        placeholder={t('one_address_per_line')} 
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    />
                </div>
                <button 
                    onClick={handleSaveSecuritySettings}
                    disabled={saving}
                    className="w-full bg-gray-700 hover:bg-gray-600 font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                    {saving ? t('saving') || 'Saving...' : t('save_security_settings') || 'Save Security Settings'}
                </button>
                <button 
                    onClick={handleBackupWallets}
                    className="w-full bg-orange-600 hover:bg-orange-700 font-semibold py-2 rounded-lg transition-colors"
                >
                    {t('backup_wallets')}
                </button>
            </div>
        </div>
    );
};

const Checkbox: React.FC<{label: string, checked: boolean, onChange: (value: boolean) => void}> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <input
            type="checkbox"
            checked={checked}
            onChange={event => onChange(event.target.checked)}
            className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
        />
    </label>
);

export default SecurityWidget;
