import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { GoldAsset } from '../../types.ts';

interface LiveGoldPriceWidgetProps {
    assets: GoldAsset[];
}

const LiveGoldPriceWidget: React.FC<LiveGoldPriceWidgetProps> = ({ assets }) => {
    const { t } = useLanguage();

    return (
        <div className="bg-card border border-border rounded-lg">
            <h3 className="text-lg font-semibold text-foreground p-4 border-b border-border">{t('live_gold_prices')}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase">
                        <tr>
                            <th className="px-4 py-3">{t('asset')}</th>
                            <th className="px-4 py-3 text-right">{t('buy_price')} (IRR)</th>
                            <th className="px-4 py-3 text-right">{t('sell_price')} (IRR)</th>
                            <th className="px-4 py-3 text-right">{t('change')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-card-foreground">
                        {assets.map(asset => (
                            <tr key={asset.id} className="border-t border-border">
                                <td className="px-4 py-3 font-semibold">{asset.name}</td>
                                <td className="px-4 py-3 font-mono text-right">{asset.buyPrice.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-right">{asset.sellPrice.toLocaleString()}</td>
                                <td className={`px-4 py-3 font-semibold text-right ${asset.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                                    {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LiveGoldPriceWidget;