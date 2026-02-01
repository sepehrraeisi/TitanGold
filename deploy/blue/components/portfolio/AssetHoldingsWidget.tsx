import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioAsset } from '../../types.ts';

interface AssetHoldingsWidgetProps {
    assets: PortfolioAsset[];
    isUpdating?: boolean;
}

const AssetHoldingsWidget: React.FC<AssetHoldingsWidgetProps> = ({ assets, isUpdating }) => {
    const { t, language } = useLanguage();

    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 2,
            }),
        [language],
    );

    const amountFormatter = useMemo(
        () =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
            }),
        [language],
    );

    const hasTargets = assets.some(asset => typeof asset.targetAllocation === 'number');
    const hasAllocations = assets.some(asset => typeof asset.allocation === 'number');

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg">
            <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
                <h3 className="font-semibold text-white">{t('asset_holdings')}</h3>
                <span className="text-xs text-gray-500">
                    {isUpdating ? t('portfolio_updating') : t('portfolio_live_data')}
                </span>
            </div>
            {assets.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">{t('no_portfolio_holdings')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="px-4 py-3">{t('asset')}</th>
                                <th className="px-4 py-3">{t('amount')}</th>
                                <th className="px-4 py-3">{t('avg_price')}</th>
                                <th className="px-4 py-3">{t('current_price')}</th>
                                <th className="px-4 py-3">{t('value')}</th>
                                <th className="px-4 py-3">{t('pnl')}</th>
                                <th className="px-4 py-3">{t('volatility')}</th>
                                {hasAllocations && <th className="px-4 py-3">{t('allocation')}</th>}
                                {hasTargets && <th className="px-4 py-3">{t('target_allocation')}</th>}
                            </tr>
                        </thead>
                        <tbody className="text-gray-200">
                            {assets.map(asset => {
                                const pnlPositive = asset.pnlPercent >= 0;
                                return (
                                    <tr key={asset.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                                        <td className="px-4 py-3 font-semibold">
                                            <div className="flex flex-col">
                                                <span>{asset.symbol}</span>
                                                <span className="text-xs text-gray-500">{asset.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{amountFormatter.format(asset.amount)}</td>
                                        <td className="px-4 py-3">{currencyFormatter.format(asset.avgPrice)}</td>
                                        <td className="px-4 py-3">{currencyFormatter.format(asset.currentPrice)}</td>
                                        <td className="px-4 py-3">{currencyFormatter.format(asset.value)}</td>
                                        <td className={`px-4 py-3 font-semibold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
                                            {`${pnlPositive ? '+' : ''}${asset.pnlPercent.toFixed(2)}%`}
                                        </td>
                                        <td className="px-4 py-3">{asset.volatility.toFixed(1)}%</td>
                                        {hasAllocations && (
                                            <td className="px-4 py-3">{asset.allocation?.toFixed(2)}%</td>
                                        )}
                                        {hasTargets && (
                                            <td className="px-4 py-3">{asset.targetAllocation?.toFixed(2)}%</td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AssetHoldingsWidget;