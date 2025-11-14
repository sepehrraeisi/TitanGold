import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const MarketDriversWidget: React.FC = () => {
    const { t } = useLanguage();

    const drivers = [
        { label: t('global_gold_price'), value: '$2,350.50', change: 0.25 },
        { label: t('usd_irr_rate'), value: '59,500 IRR', change: -0.15 },
    ];

    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('key_market_drivers')}</h3>
            <div className="space-y-4">
                {drivers.map(driver => (
                    <div key={driver.label} className="bg-secondary p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">{driver.label}</p>
                        <div className="flex justify-between items-baseline">
                            <p className="text-xl font-bold text-foreground">{driver.value}</p>
                            <p className={`font-semibold ${driver.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {driver.change >= 0 ? '+' : ''}{driver.change.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketDriversWidget;