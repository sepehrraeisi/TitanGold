
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import * as api from '../../../services/api.ts';
import { database } from '../../../services/database.ts';

interface ColdWalletSettings {
    autoTransfer: boolean;
    transferThreshold: number;
    transferPercentage: number;
    checkInterval: string;
}

const ColdWalletWidget: React.FC = () => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<ColdWalletSettings>({
        autoTransfer: true,
        transferThreshold: 50000,
        transferPercentage: 70,
        checkInterval: 'every_hour',
    });
    const [todayTransfers, setTodayTransfers] = useState(0);
    const [coldWalletBalance, setColdWalletBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [transferring, setTransferring] = useState(false);

    useEffect(() => {
        loadColdWalletData();
        // Refresh every 30 seconds
        const interval = setInterval(loadColdWalletData, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadColdWalletData = async () => {
        try {
            const wallets = await api.fetchWalletConnections();
            const coldWallets = wallets.filter(w => w.type === 'coldwallet');
            const totalBalance = coldWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
            setColdWalletBalance(totalBalance * 2500); // ETH to USD
            
            // Load settings from storage
            const saved = await loadColdWalletSettings();
            if (saved) {
                setSettings(saved);
            }
        } catch (error) {
            console.error('Failed to load cold wallet data:', error);
        }
    };

    const loadColdWalletSettings = async (): Promise<ColdWalletSettings | null> => {
        try {
            const saved = await database.get<ColdWalletSettings>('settings', 'cold_wallet_settings');
            return saved || null;
        } catch (e) {
            const localData = localStorage.getItem('titan_cold_wallet_settings');
            return localData ? JSON.parse(localData) : null;
        }
    };

    const saveColdWalletSettings = async (settings: ColdWalletSettings) => {
        try {
            await database.save('settings', {
                key: 'cold_wallet_settings',
                value: settings,
            });
            localStorage.setItem('titan_cold_wallet_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save cold wallet settings:', e);
        }
    };

    const handleTestConnection = async () => {
        setLoading(true);
        try {
            const wallets = await api.fetchWalletConnections();
            const coldWallets = wallets.filter(w => w.type === 'coldwallet');
            if (coldWallets.length === 0) {
                alert(t('no_cold_wallets_connected') || 'No cold wallets connected');
            } else {
                // Test connection by checking balance
                for (const wallet of coldWallets) {
                    if (wallet.address) {
                        await api.getWalletBalance(wallet.address);
                    }
                }
                alert(t('connection_test_successful') || 'Connection test successful!');
            }
        } catch (error) {
            alert(t('connection_test_failed') || 'Connection test failed');
        } finally {
            setLoading(false);
        }
    };

    const handleInstantTransfer = async () => {
        if (!settings.autoTransfer) {
            alert(t('auto_transfer_disabled') || 'Auto-transfer is disabled. Please enable it first.');
            return;
        }

        const wallets = await api.fetchWalletConnections();
        const coldWallets = wallets.filter(w => w.type === 'coldwallet');
        if (coldWallets.length === 0) {
            alert(t('no_cold_wallets_connected') || 'No cold wallets connected');
            return;
        }

        setTransferring(true);
        try {
            // This would trigger an actual transfer in production
            // For now, just simulate
            await new Promise(resolve => setTimeout(resolve, 2000));
            setTodayTransfers(prev => prev + 1);
            alert(t('transfer_initiated') || 'Transfer initiated successfully!');
        } catch (error) {
            alert(t('transfer_failed') || 'Transfer failed');
        } finally {
            setTransferring(false);
        }
    };

    const handleTransferHistory = () => {
        // Open transfer history modal or navigate
        alert(t('transfer_history_feature') || 'Transfer history feature coming soon!');
    };

    const handleColdWalletReport = () => {
        // Generate and download report
        const wallets = api.fetchWalletConnections().then(wallets => {
            const coldWallets = wallets.filter(w => w.type === 'coldwallet');
            const report = {
                date: new Date().toISOString(),
                coldWallets: coldWallets.map(w => ({
                    name: w.name,
                    address: w.address,
                    balance: w.balance,
                })),
                settings: settings,
                totalBalance: coldWalletBalance,
            };
            
            const dataStr = JSON.stringify(report, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cold-wallet-report-${new Date().toISOString()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('cold_wallet_automation')}</h3>
            <div className="space-y-4">
                <Checkbox 
                    label={t('auto_transfer_to_cold')} 
                    checked={settings.autoTransfer}
                    onChange={(checked) => {
                        const newSettings = { ...settings, autoTransfer: checked };
                        setSettings(newSettings);
                        saveColdWalletSettings(newSettings);
                    }}
                />
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('transfer_threshold')}</label>
                    <input 
                        type="number" 
                        value={settings.transferThreshold}
                        onChange={(e) => {
                            const newSettings = { ...settings, transferThreshold: Number(e.target.value) };
                            setSettings(newSettings);
                            saveColdWalletSettings(newSettings);
                        }}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('transfer_percentage')} ({settings.transferPercentage}%)</label>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.transferPercentage}
                        onChange={(e) => {
                            const newSettings = { ...settings, transferPercentage: Number(e.target.value) };
                            setSettings(newSettings);
                            saveColdWalletSettings(newSettings);
                        }}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-300 block mb-1">{t('check_interval')}</label>
                    <select 
                        value={settings.checkInterval}
                        onChange={(e) => {
                            const newSettings = { ...settings, checkInterval: e.target.value };
                            setSettings(newSettings);
                            saveColdWalletSettings(newSettings);
                        }}
                        className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md"
                    >
                        <option value="every_hour">{t('every_hour')}</option>
                        <option value="every_6_hours">{t('every_6_hours')}</option>
                        <option value="every_12_hours">{t('every_12_hours')}</option>
                        <option value="daily">{t('daily')}</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <StatBox label={t('today_transfers')} value={todayTransfers.toString()} />
                    <StatBox label={t('cold_wallet_balance')} value={`$${coldWalletBalance.toLocaleString()}`} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                    <button 
                        onClick={handleTestConnection}
                        disabled={loading}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:opacity-50 transition-colors"
                    >
                        {loading ? '...' : t('test_cold_wallet_connection')}
                    </button>
                    <button 
                        onClick={handleInstantTransfer}
                        disabled={transferring || !settings.autoTransfer}
                        className="p-2 bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 transition-colors"
                    >
                        {transferring ? '...' : t('instant_transfer')}
                    </button>
                    <button 
                        onClick={handleTransferHistory}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {t('transfer_history')}
                    </button>
                    <button 
                        onClick={handleColdWalletReport}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {t('cold_wallet_report')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Checkbox: React.FC<{label: string, checked: boolean, onChange: (checked: boolean) => void}> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <input 
            type="checkbox" 
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500" 
        />
    </label>
);

const StatBox: React.FC<{label: string, value: string}> = ({label, value}) => (
    <div className="bg-gray-800/50 p-3 rounded-lg text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
    </div>
);

export default ColdWalletWidget;
