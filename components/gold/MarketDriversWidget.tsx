import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { GoldMarketDriver } from '../../types.ts';
import Button from '../ui/button.tsx';

interface MarketDriversWidgetProps {
    drivers: GoldMarketDriver[];
    onRefresh: () => void;
    isRefreshing: boolean;
}

const MarketDriversWidget: React.FC<MarketDriversWidgetProps> = ({ drivers, onRefresh, isRefreshing }) => {
    const { t, language } = useLanguage();

    const formatUpdated = (value: string) =>
        new Date(value).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { hour12: false });

    return (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">{t('key_market_drivers')}</h3>
                <Button variant="ghost" onClick={onRefresh} disabled={isRefreshing} className="h-8 px-3 text-xs">
                    {isRefreshing ? t('loading') : t('refresh_market')}
                </Button>
            </div>

            <div className="space-y-3">
                {drivers.map(driver => (
                    <div key={driver.id} className="rounded-lg border border-border/60 bg-secondary/60 p-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-foreground">{t(driver.labelKey)}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {t(driver.descriptionKey)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-semibold text-foreground">{driver.value}</p>
                                <p className={`text-xs font-semibold ${driver.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                                    {driver.change >= 0 ? '+' : ''}{driver.change.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                            {t('last_updated', { time: formatUpdated(driver.updatedAt) })}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketDriversWidget;