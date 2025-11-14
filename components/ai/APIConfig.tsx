import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';

const APIConfig: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            await api.fetchAPIConfigData();
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    return (
        <div className="space-y-8">
            <Card title={t('ai_services')}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <APIInputGroup service="Google Gemini" />
                    <APIInputGroup service="Anthropic Claude" />
                    <APIInputGroup service="OpenAI GPT" />
                </div>
            </Card>
             <Card title={t('exchange_apis')}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <APIInputGroup service="MEXC" hasSecret />
                    <APIInputGroup service="Binance" hasSecret />
                    <APIInputGroup service="Coinbase" hasSecret />
                    <APIInputGroup service="KuCoin" hasSecret />
                </div>
            </Card>
            <Card title={t('communications_and_alerts')}>
                 <p className="text-muted-foreground text-sm">Configure Telegram, Email, and Voice services here.</p>
            </Card>
             <Card title={t('market_data_and_analysis')}>
                 <p className="text-muted-foreground text-sm">Configure News APIs and Technical Analysis providers here.</p>
            </Card>
            <div className="flex justify-end gap-4 pt-4">
                <button className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-5 rounded-lg text-sm transition-colors">{t('test_all_apis')}</button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg text-sm transition-colors">{t('save_all_settings')}</button>
            </div>
        </div>
    );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-semibold text-lg text-foreground mb-5">{title}</h2>
        {children}
    </div>
);

const APIInputGroup: React.FC<{service: string; hasSecret?: boolean}> = ({ service, hasSecret }) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-card-foreground">{service}</h4>
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input type="password" defaultValue="******************" className="w-full text-sm mt-1 p-2 bg-background border border-border rounded-md focus:ring-purple-500 focus:border-purple-500" />
                </div>
                {hasSecret && (
                     <div>
                        <label className="text-xs text-muted-foreground">Secret Key</label>
                        <input type="password" defaultValue="******************" className="w-full text-sm mt-1 p-2 bg-background border border-border rounded-md focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                )}
            </div>
            <button className="w-full text-center mt-2 p-2 bg-secondary border border-border hover:bg-accent rounded-md text-sm font-medium transition-colors">{t('test_api')}</button>
        </div>
    )
}

export default APIConfig;