
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAppContext } from '../../context/AppContext.tsx';
import * as api from '../../services/api.ts';
import StatCard from './wallet/StatCard.tsx';
import AllocationWidget from './wallet/AllocationWidget.tsx';
import RecentTransactionsWidget from './wallet/RecentTransactionsWidget.tsx';
import SecurityWidget from './wallet/SecurityWidget.tsx';
import ColdWalletWidget from './wallet/ColdWalletWidget.tsx';
import DeFiWidget from './wallet/DeFiWidget.tsx';
import GeneralConfigWidget from './wallet/GeneralConfigWidget.tsx';
import MexcWalletCapabilityBanner from './wallet/MexcWalletCapabilityBanner.tsx';
import type { WalletSettingsData } from '../../types.ts';
import { database } from '../../services/database.ts';

const WalletSettings: React.FC = () => {
    const { t } = useLanguage();
    const { isDemoMode } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<WalletSettingsData | null>(null);
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [tradingMode, setTradingMode] = useState<'demo' | 'live'>('demo');
    const [demoBalance, setDemoBalance] = useState({ USDT: 0, BTC: 0, ETH: 0 });
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        loadData();
        loadTradingMode();
        loadDemoBalance();
        // Auto-refresh based on preferences
        const interval = setInterval(() => {
            loadData();
            loadTradingMode();
            loadDemoBalance();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        return () => clearInterval(interval);
    }, []);

    const loadTradingMode = async () => {
        try {
            const response = await api.fetchTradingMode();
            setTradingMode(response.mode);
        } catch (error) {
            console.error('Failed to load trading mode:', error);
        }
    };

    const loadDemoBalance = async () => {
        try {
            const response = await api.fetchWalletBalance();
            if (response.mode === 'demo' && response.balances) {
                setDemoBalance(response.balances);
            }
        } catch (error) {
            console.error('Failed to load demo balance:', error);
        }
    };

    const handleResetDemoWallet = async () => {
        if (!confirm(t('confirm_reset_demo_wallet') || 'Are you sure you want to reset your demo wallet to default values (USDT: 10,000)?')) {
            return;
        }
        
        setIsResetting(true);
        try {
            await api.resetDemoWallet();
            await loadDemoBalance();
            alert(t('demo_wallet_reset_success') || 'Demo wallet has been reset successfully!');
        } catch (error) {
            console.error('Failed to reset demo wallet:', error);
            alert(t('demo_wallet_reset_failed') || 'Failed to reset demo wallet');
        } finally {
            setIsResetting(false);
        }
    };

    const loadData = async () => {
        try {
            setIsLoading(true);
            const walletData = await api.fetchWalletData();
            setData(walletData);
        } catch (error) {
            console.error('Failed to load wallet data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefreshConnector = async (connectorId: string) => {
        setRefreshing(connectorId);
        try {
            const updated = await api.refreshWalletConnector(connectorId, 'connected');
            setData(updated);
        } catch (error) {
            console.error('Failed to refresh connector:', error);
        } finally {
            setRefreshing(null);
        }
    };

    const handleToggleSecurity = async (controlId: string, enabled: boolean) => {
        try {
            const updated = await api.toggleWalletSecurityControl(controlId, enabled);
            setData(updated);
        } catch (error) {
            console.error('Failed to toggle security control:', error);
        }
    };

    const handleSavePreferences = async (preferences: WalletSettingsData['preferences']) => {
        setIsSavingPreferences(true);
        try {
            const updated = await api.updateWalletPreferences(preferences);
            setData(updated);
        } catch (error) {
            console.error('Failed to save preferences:', error);
        } finally {
            setIsSavingPreferences(false);
        }
    };

    const handleRefreshAll = async () => {
        if (!data) return;
        
        setRefreshing('all');
        try {
            // Refresh all connectors
            for (const connector of data.connectors) {
                await api.refreshWalletConnector(connector.id, connector.status);
            }
            await loadData();
        } catch (error) {
            console.error('Failed to refresh all:', error);
        } finally {
            setRefreshing(null);
        }
    };

    if (isLoading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-400">{t('failed_to_load_data') || 'Failed to load wallet data'}</p>
                <button
                    onClick={loadData}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                    {t('retry') || 'Retry'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <MexcWalletCapabilityBanner />
            {/* Trading Mode & Virtual Wallet Section */}
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {tradingMode === 'demo' ? '🎮' : '🔴'} 
                            {t('trading_mode') || 'Trading Mode'}
                        </h2>
                        <p className="text-gray-300 text-sm mt-1">
                            {tradingMode === 'demo' 
                                ? (t('demo_mode_desc') || 'Virtual funds for testing - No real money at risk')
                                : (t('live_mode_desc') || 'Real trading with real funds')}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-6 py-3 rounded-lg font-bold text-lg ${
                            tradingMode === 'demo' 
                                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' 
                                : 'bg-red-500/30 text-red-300 border border-red-500/50'
                        }`}>
                            {tradingMode === 'demo' ? '🟢 DEMO' : '🔴 LIVE'}
                        </div>
                    </div>
                </div>

                {/* Virtual Wallet Section (Demo Mode Only) */}
                {tradingMode === 'demo' && (
                    <div className="bg-black/30 rounded-lg p-6 space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">{t('virtual_wallet') || '💰 Virtual Wallet'}</h3>
                            <button
                                onClick={handleResetDemoWallet}
                                disabled={isResetting}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                                {isResetting ? '...' : (t('reset_wallet') || '🔄 Reset Wallet')}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30 rounded-lg p-4">
                                <div className="text-green-400 text-sm font-medium mb-1">USDT</div>
                                <div className="text-2xl font-bold text-white">${demoBalance.USDT.toLocaleString()}</div>
                                <div className="text-xs text-gray-400 mt-1">{t('tether_usd') || 'Tether USD'}</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-500/30 rounded-lg p-4">
                                <div className="text-orange-400 text-sm font-medium mb-1">BTC</div>
                                <div className="text-2xl font-bold text-white">{demoBalance.BTC.toFixed(8)}</div>
                                <div className="text-xs text-gray-400 mt-1">{t('bitcoin') || 'Bitcoin'}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-lg p-4">
                                <div className="text-purple-400 text-sm font-medium mb-1">ETH</div>
                                <div className="text-2xl font-bold text-white">{demoBalance.ETH.toFixed(6)}</div>
                                <div className="text-xs text-gray-400 mt-1">{t('ethereum') || 'Ethereum'}</div>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">ℹ️</span>
                                <div className="flex-1">
                                    <p className="text-yellow-300 font-medium">{t('demo_mode_notice') || 'Demo Mode Active'}</p>
                                    <p className="text-yellow-200/70 text-sm mt-1">
                                        {t('demo_mode_notice_desc') || 'All trades are simulated. No real funds are used. Switch to LIVE mode from the header to trade with real money.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('wallet_management_title')}</h2>
                    <p className="text-gray-400 text-sm">{t('wallet_management_desc')}</p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="text-xs text-gray-400">
                        <span>{t('wallet_last_synced', { time: new Date(data.lastSyncedAt).toLocaleString() }) || `Last synced: ${new Date(data.lastSyncedAt).toLocaleString()}`}</span>
                    </div>
                    <button
                        onClick={handleRefreshAll}
                        disabled={refreshing === 'all'}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                    >
                        {refreshing === 'all' ? '...' : t('refresh_all') || '🔄 Refresh All'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={t('total_assets')} value={`$${data.stats.totalAssets.toLocaleString()}`} />
                <StatCard label={t('active_wallets')} value={data.stats.activeWallets.toString()} />
                <StatCard label={t('24h_profit')} value={`${data.stats.profit24h}%`} isPositive={data.stats.profit24h >= 0} />
                <StatCard label={t('cold_storage')} value={data.stats.coldStorage.toString()} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <AllocationWidget assets={data.assets} />
                    <RecentTransactionsWidget transactions={data.transactions} />
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white">{t('connected_wallets')}</h3>
                            <button
                                onClick={handleRefreshAll}
                                disabled={refreshing === 'all'}
                                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                            >
                                {refreshing === 'all' ? '...' : '🔄'}
                            </button>
                        </div>
                        {data.connectors.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">
                                {t('no_wallets_connected') || 'No wallets connected'}
                            </p>
                        ) : (
                            <ul className="space-y-3 text-sm">
                                {data.connectors.map(connector => (
                                    <li key={connector.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded transition-colors">
                                        <div className="flex-1">
                                            <p className="font-semibold text-white">{connector.name}</p>
                                            <p className="text-xs text-gray-400">{t(connector.descriptionKey) || connector.descriptionKey}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {t('last_synced_at') || 'Last synced'}: {new Date(connector.lastSyncedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleRefreshConnector(connector.id)}
                                                disabled={refreshing === connector.id}
                                                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
                                                title={t('refresh') || 'Refresh'}
                                            >
                                                {refreshing === connector.id ? '...' : '🔄'}
                                            </button>
                                            <span className={`text-xs px-3 py-1 rounded-full ${
                                                connector.status === 'connected' 
                                                    ? 'bg-green-500/20 text-green-300' 
                                                    : connector.status === 'syncing' 
                                                    ? 'bg-yellow-500/20 text-yellow-300' 
                                                    : 'bg-red-500/20 text-red-300'
                                            }`}>
                                                {t(`integration_status_${connector.status}`) || connector.status}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
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
                    <GeneralConfigWidget 
                        preferences={data.preferences} 
                        onSave={handleSavePreferences} 
                        isSaving={isSavingPreferences} 
                    />
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
                <button 
                    onClick={handleRefreshAll}
                    disabled={refreshing === 'all'}
                    className="bg-gray-700 hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg disabled:opacity-50 transition-colors"
                >
                    {t('refresh_all') || 'Refresh All'}
                </button>
                <button 
                    onClick={async () => {
                        await loadData();
                        alert(t('settings_saved') || 'Settings saved successfully!');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                    {t('save_settings') || 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default WalletSettings;
