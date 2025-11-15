
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import StatCard from './wallet/StatCard.tsx';
import AllocationWidget from './wallet/AllocationWidget.tsx';
import RecentTransactionsWidget from './wallet/RecentTransactionsWidget.tsx';
import SecurityWidget from './wallet/SecurityWidget.tsx';
import ColdWalletWidget from './wallet/ColdWalletWidget.tsx';
import DeFiWidget from './wallet/DeFiWidget.tsx';
import GeneralConfigWidget from './wallet/GeneralConfigWidget.tsx';
import type { WalletSettingsData } from '../../types.ts';

const WalletSettings: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<WalletSettingsData | null>(null);
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const walletData = await api.fetchWalletData();
            setData(walletData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleRefreshConnector = async (connectorId: string) => {
        const updated = await api.refreshWalletConnector(connectorId, 'connected');
        setData(updated);
    };

    const handleToggleSecurity = async (controlId: string, enabled: boolean) => {
        const updated = await api.toggleWalletSecurityControl(controlId, enabled);
        setData(updated);
    };

    const handleSavePreferences = async (preferences: WalletSettingsData['preferences']) => {
        setIsSavingPreferences(true);
        const updated = await api.updateWalletPreferences(preferences);
        setData(updated);
        setIsSavingPreferences(false);
    };

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('wallet_management_title')}</h2>
                    <p className="text-gray-400 text-sm">{t('wallet_management_desc')}</p>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                    <span>{t('wallet_last_synced', { time: new Date(data.lastSyncedAt).toLocaleString() })}</span>
                </div>
            </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={t('total_assets')} value={`$${data.stats.totalAssets.toLocaleString()}`} />
                <StatCard label={t('active_wallets')} value={data.stats.activeWallets} />
                <StatCard label={t('24h_profit')} value={`${data.stats.profit24h}%`} isPositive />
                <StatCard label={t('cold_storage')} value={data.stats.coldStorage} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <AllocationWidget assets={data.assets} />
                    <RecentTransactionsWidget transactions={data.transactions} />
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                        <h3 className="font-semibold text-white mb-4">{t('connected_wallets')}</h3>
                        <ul className="space-y-3 text-sm">
                            {data.connectors.map(connector => (
                                <li key={connector.id} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-white">{connector.name}</p>
                                        <p className="text-xs text-gray-400">{t(connector.descriptionKey)}</p>
                                        <p className="text-xs text-gray-500">{t('last_synced_at', { time: new Date(connector.lastSyncedAt).toLocaleString() })}</p>
                                    </div>
                                    <button
                                        className={`text-xs px-3 py-1 rounded-full ${connector.status === 'connected' ? 'bg-green-500/20 text-green-300' : connector.status === 'syncing' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}
                                        onClick={() => handleRefreshConnector(connector.id)}
                                    >
                                        {t(`integration_status_${connector.status}`)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <SecurityWidget controls={data.securityControls} onToggle={handleToggleSecurity} />
                    <ColdWalletWidget />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DeFiWidget />
                </div>
                <div className="lg:col-span-1">
                    <GeneralConfigWidget preferences={data.preferences} onSave={handleSavePreferences} isSaving={isSavingPreferences} />
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
                <button className="bg-gray-700 hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg">{t('import_data')}</button>
                <button className="bg-gray-700 hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg">{t('export_data')}</button>
                <button className="bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg">{t('save_settings')}</button>
            </div>

        </div>
    );
};

export default WalletSettings;
