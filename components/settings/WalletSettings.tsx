
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

const WalletSettings: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const walletData = await api.fetchWalletData();
            setData(walletData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('wallet_management_title')}</h2>
                    <p className="text-gray-400 text-sm">{t('wallet_management_desc')}</p>
                </div>
                 <div className="flex gap-2">
                    <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('refresh_balance')}</button>
                    <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('connect_new_wallet')}</button>
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
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <SecurityWidget />
                    <ColdWalletWidget />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DeFiWidget />
                </div>
                <div className="lg:col-span-1">
                    <GeneralConfigWidget />
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
