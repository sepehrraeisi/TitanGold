import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';
import type { WalletConnection } from '../services/api.ts';
import type { WalletTransaction, WalletSettingsData } from '../types.ts';

const WalletManagement: React.FC = () => {
    const { t } = useLanguage();
    const [wallets, setWallets] = useState<WalletConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [totalBalance, setTotalBalance] = useState(0);
    const [selectedWallet, setSelectedWallet] = useState<WalletConnection | null>(null);
    const [walletData, setWalletData] = useState<WalletSettingsData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'details'>('overview');
    const [ethPrice, setEthPrice] = useState<number>(2500); // Fallback price

    useEffect(() => {
        loadWallets();
        loadWalletData();
        // Refresh wallets every 30 seconds
        const interval = setInterval(() => {
            loadWallets();
            loadWalletData();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadWallets = async () => {
        try {
            setLoading(true);
            const walletList = await api.fetchWalletConnections();
            setWallets(walletList);
            
            // Calculate total balance
            const total = walletList.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
            setTotalBalance(total);
        } catch (error) {
            console.error('Failed to load wallets:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadWalletData = async () => {
        try {
            const data = await api.fetchWalletData();
            setWalletData(data);
            
            // Fetch real ETH price from MEXC
            try {
                const ethTicker = await api.fetchMexcTicker24hr('ETHUSDT');
                if (ethTicker && ethTicker.length > 0 && ethTicker[0].lastPrice) {
                    setEthPrice(parseFloat(ethTicker[0].lastPrice));
                }
            } catch (error) {
                console.warn('Failed to fetch ETH price, using fallback:', error);
            }
        } catch (error) {
            console.error('Failed to load wallet data:', error);
        }
    };

    const handleRefreshWallet = async (wallet: WalletConnection) => {
        setRefreshing(wallet.id);
        try {
            if (wallet.type === 'metamask' && window.ethereum) {
                // Refresh MetaMask
                const result = await api.connectMetaMask();
                if (result.success && result.wallet) {
                    await loadWallets();
                }
            } else if (wallet.type === 'walletconnect') {
                // Check WalletConnect status
                const status = await api.checkWalletConnectStatus(wallet.address || '');
                if (status.connected && status.wallet) {
                    await loadWallets();
                } else {
                    // Try to get balance
                    if (wallet.address) {
                        const balance = await api.getWalletBalance(wallet.address);
                        if (balance !== undefined) {
                            const updatedWallet = { ...wallet, balance, lastSyncedAt: new Date().toISOString() };
                            await api.saveWalletConnection(updatedWallet);
                            await loadWallets();
                        }
                    }
                }
            } else if (wallet.type === 'coldwallet' && wallet.address) {
                // Refresh cold wallet balance
                const balance = await api.getWalletBalance(wallet.address);
                if (balance !== undefined) {
                    const updatedWallet = { ...wallet, balance, lastSyncedAt: new Date().toISOString() };
                    await api.saveWalletConnection(updatedWallet);
                    await loadWallets();
                }
            }
        } catch (error) {
            console.error('Failed to refresh wallet:', error);
        } finally {
            setRefreshing(null);
        }
    };

    const handleDisconnectWallet = async (walletId: string) => {
        if (confirm(t('confirm_disconnect_wallet') || 'Are you sure you want to disconnect this wallet?')) {
            try {
                await api.deleteWalletConnection(walletId);
                await loadWallets();
                if (selectedWallet?.id === walletId) {
                    setSelectedWallet(null);
                }
            } catch (error) {
                console.error('Failed to disconnect wallet:', error);
            }
        }
    };

    const formatAddress = (address: string) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const getWalletIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            metamask: '🦊',
            walletconnect: '🔗',
            coldwallet: '❄️',
            trustwallet: '💎',
            ledger: '🔒',
            trezor: '🛡️',
        };
        return icons[type] || '💼';
    };

    const getWalletStatusColor = (status: string) => {
        switch (status) {
            case 'connected':
                return 'bg-green-500/20 text-green-400 border-green-500/50';
            case 'syncing':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            case 'disconnected':
                return 'bg-red-500/20 text-red-400 border-red-500/50';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
        }
    };

    if (loading && wallets.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">{t('wallet_management_title') || 'TITAN Wallet Management'}</h2>
                    <p className="text-gray-400 text-sm mt-1">{t('wallet_management_desc') || 'Manage balance, transactions, and wallet connections.'}</p>
                </div>
                <button
                    onClick={loadWallets}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
                >
                    {loading ? '...' : '🔄 Refresh All'}
                </button>
            </div>

            {/* Total Balance Card */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">{t('total_balance') || 'Total Balance'}</p>
                        <p className="text-3xl font-bold text-white">
                            {totalBalance.toFixed(4)} ETH
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            ≈ ${(totalBalance * ethPrice).toLocaleString()} USD
                        </p>
                    </div>
                    <div className="text-4xl">💼</div>
                </div>
            </div>

            {/* Wallets Grid */}
            {wallets.length === 0 ? (
                <div className="text-center py-12 bg-[#161B22] border border-gray-800 rounded-lg">
                    <div className="text-6xl mb-4">💼</div>
                    <p className="text-gray-400 text-lg mb-2">{t('no_wallets_connected') || 'No wallets connected'}</p>
                    <p className="text-gray-500 text-sm">{t('connect_wallet_in_settings') || 'Go to Settings > Connections to connect a wallet'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wallets.map((wallet) => (
                        <div
                            key={wallet.id}
                            className={`bg-[#161B22] border rounded-lg p-4 hover:border-blue-500/50 transition-colors cursor-pointer ${
                                selectedWallet?.id === wallet.id ? 'border-blue-500' : 'border-gray-800'
                            }`}
                            onClick={() => setSelectedWallet(wallet)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="text-3xl">{getWalletIcon(wallet.type)}</div>
                                    <div>
                                        <h3 className="font-semibold text-white">{wallet.name}</h3>
                                        <p className="text-xs text-gray-400 capitalize">{wallet.type}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs border ${getWalletStatusColor(wallet.status || 'disconnected')}`}>
                                    {wallet.status || 'disconnected'}
                                </span>
                            </div>

                            {wallet.address && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500 mb-1">Address</p>
                                    <p className="text-xs font-mono text-gray-300 break-all">{formatAddress(wallet.address)}</p>
                                </div>
                            )}

                            <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Balance</p>
                                <p className="text-lg font-bold text-green-400">
                                    {(wallet.balance || 0).toFixed(4)} ETH
                                </p>
                            </div>

                            {wallet.lastSyncedAt && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500">
                                        {t('last_synced') || 'Last synced'}: {new Date(wallet.lastSyncedAt).toLocaleString()}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRefreshWallet(wallet);
                                    }}
                                    disabled={refreshing === wallet.id}
                                    className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-sm font-semibold disabled:opacity-50 transition-colors"
                                >
                                    {refreshing === wallet.id ? '...' : '🔄 Refresh'}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDisconnectWallet(wallet.id);
                                    }}
                                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm font-semibold transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Wallet Details Panel */}
            {selectedWallet && (
                <div className="mt-6 bg-[#161B22] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white">
                            {selectedWallet.name} - {t('details') || 'Details'}
                        </h3>
                        <button
                            onClick={() => {
                                setSelectedWallet(null);
                                setActiveTab('overview');
                            }}
                            className="text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 border-b border-gray-800">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${
                                activeTab === 'overview'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {t('overview') || 'Overview'}
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${
                                activeTab === 'transactions'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {t('transactions') || 'Transactions'}
                        </button>
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${
                                activeTab === 'details'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {t('details') || 'Details'}
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <div className="space-y-4">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400 mb-1">{t('balance') || 'Balance'}</p>
                                    <p className="text-2xl font-bold text-white">{(selectedWallet.balance || 0).toFixed(4)} ETH</p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        ≈ ${((selectedWallet.balance || 0) * ethPrice).toLocaleString()} USD
                                    </p>
                                </div>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                    <p className="text-sm text-gray-400 mb-1">{t('status') || 'Status'}</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getWalletStatusColor(selectedWallet.status || 'disconnected')}`}>
                                        {selectedWallet.status || 'disconnected'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('wallet_type') || 'Wallet Type'}</p>
                                    <p className="text-white font-semibold capitalize">{selectedWallet.type}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('network') || 'Network'}</p>
                                    <p className="text-white font-semibold">{selectedWallet.network || 'Ethereum Mainnet'}</p>
                                </div>
                                {selectedWallet.address && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm text-gray-400 mb-1">{t('address') || 'Address'}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-mono text-sm break-all">{selectedWallet.address}</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedWallet.address || '');
                                                    alert(t('address_copied') || 'Address copied to clipboard!');
                                                }}
                                                className="text-blue-400 hover:text-blue-300 text-xs"
                                                title={t('copy_address') || 'Copy address'}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {selectedWallet.createdAt && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">{t('created_at') || 'Created At'}</p>
                                        <p className="text-white">{new Date(selectedWallet.createdAt).toLocaleString()}</p>
                                    </div>
                                )}
                                {selectedWallet.lastSyncedAt && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">{t('last_synced') || 'Last Synced'}</p>
                                        <p className="text-white">{new Date(selectedWallet.lastSyncedAt).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'transactions' && (
                        <div className="space-y-4">
                            {walletData && walletData.transactions.length > 0 ? (
                                <div className="space-y-3">
                                    {walletData.transactions
                                        .filter(tx => tx.exchange === selectedWallet.name)
                                        .map(tx => (
                                            <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-2xl ${
                                                            tx.type === 'Deposit' ? 'text-green-400' :
                                                            tx.type === 'Withdrawal' ? 'text-red-400' :
                                                            'text-blue-400'
                                                        }`}>
                                                            {tx.type === 'Deposit' ? '⬇️' : tx.type === 'Withdrawal' ? '⬆️' : '🔄'}
                                                        </span>
                                                        <div>
                                                            <p className="font-semibold text-white">{tx.type}</p>
                                                            <p className="text-sm text-gray-400">{tx.exchange} - {tx.time}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-white">{tx.amount}</p>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                                        tx.status === 'Completed'
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-yellow-500/20 text-yellow-300'
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    {walletData.transactions.filter(tx => tx.exchange === selectedWallet.name).length === 0 && (
                                        <div className="text-center py-8 text-gray-400">
                                            <p>{t('no_transactions_for_wallet') || 'No transactions found for this wallet'}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <p>{t('no_transactions') || 'No transactions yet'}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('wallet_type') || 'Wallet Type'}</p>
                                    <p className="text-white font-semibold capitalize">{selectedWallet.type}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('status') || 'Status'}</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getWalletStatusColor(selectedWallet.status || 'disconnected')}`}>
                                        {selectedWallet.status || 'disconnected'}
                                    </span>
                                </div>
                                {selectedWallet.address && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm text-gray-400 mb-1">{t('address') || 'Address'}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-mono text-sm break-all">{selectedWallet.address}</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedWallet.address || '');
                                                    alert(t('address_copied') || 'Address copied to clipboard!');
                                                }}
                                                className="text-blue-400 hover:text-blue-300 text-xs"
                                                title={t('copy_address') || 'Copy address'}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('balance') || 'Balance'}</p>
                                    <p className="text-white font-semibold text-lg">{(selectedWallet.balance || 0).toFixed(4)} ETH</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{t('network') || 'Network'}</p>
                                    <p className="text-white font-semibold">{selectedWallet.network || 'Ethereum Mainnet'}</p>
                                </div>
                                {selectedWallet.createdAt && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">{t('created_at') || 'Created At'}</p>
                                        <p className="text-white">{new Date(selectedWallet.createdAt).toLocaleString()}</p>
                                    </div>
                                )}
                                {selectedWallet.lastSyncedAt && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">{t('last_synced') || 'Last Synced'}</p>
                                        <p className="text-white">{new Date(selectedWallet.lastSyncedAt).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            {/* WalletConnect Specific Info */}
                            {selectedWallet.type === 'walletconnect' && (
                                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                                    <p className="text-sm text-blue-400 mb-2">ℹ️ WalletConnect Connection</p>
                                    <p className="text-xs text-gray-400">
                                        {t('walletconnect_info') || 'This wallet is connected via WalletConnect. Make sure your mobile wallet app is open and connected.'}
                                    </p>
                                </div>
                            )}

                            {/* Cold Wallet Specific Info */}
                            {selectedWallet.type === 'coldwallet' && (
                                <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                                    <p className="text-sm text-gray-300 mb-2">❄️ Cold Wallet</p>
                                    <p className="text-xs text-gray-400">
                                        {t('cold_wallet_info') || 'This is a cold wallet (hardware wallet). It provides enhanced security by keeping your private keys offline.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WalletManagement;
