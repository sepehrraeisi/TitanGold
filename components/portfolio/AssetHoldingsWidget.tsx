import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { PortfolioAsset } from '../../types.ts';

interface AssetHoldingsWidgetProps {
    assets: PortfolioAsset[];
}

const AssetHoldingsWidget: React.FC<AssetHoldingsWidgetProps> = ({ assets }) => {
    const { t } = useLanguage();
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg">
            <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
                <h3 className="font-semibold text-white">{t('asset_holdings')}</h3>
                <button className="text-xs bg-gray-700/50 hover:bg-gray-700 px-3 py-1 rounded-md">{t('update')}</button>
            </div>
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
                        </tr>
                    </thead>
                    <tbody className="text-gray-200">
                        {assets.map(asset => (
                            <tr key={asset.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-semibold">{asset.symbol}</td>
                                <td className="px-4 py-3">{asset.amount.toFixed(4)}</td>
                                <td className="px-4 py-3">${asset.avgPrice.toLocaleString()}</td>
                                <td className="px-4 py-3">${asset.currentPrice.toLocaleString()}</td>
                                <td className="px-4 py-3">${asset.value.toLocaleString()}</td>
                                <td className={`px-4 py-3 font-semibold ${asset.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {asset.pnlPercent.toFixed(2)}%
                                </td>
                                <td className="px-4 py-3">{asset.volatility.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssetHoldingsWidget;