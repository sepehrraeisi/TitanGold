import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAPIConfigData, APIServiceIntegration } from '../../types.ts';

const APIConfig: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [config, setConfig] = useState<AIAPIConfigData | null>(null);
    const [testingService, setTestingService] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const apiConfig = await api.fetchAPIConfigData();
            setConfig(apiConfig);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleTest = async (serviceId: string) => {
        if (testingService) {
            return;
        }

        try {
            setTestingService(serviceId);
            await api.testAIIntegration(serviceId);
            const updated = await api.fetchAPIConfigData();
            setConfig(updated);
        } finally {
            setTestingService(null);
        }
    };

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    return (
        <div className="space-y-8">
            <Card title={t('ai_services')}>
                <IntegrationGrid
                    services={config?.aiServices ?? []}
                    onTest={handleTest}
                    testingService={testingService}
                />
            </Card>
             <Card title={t('exchange_apis')}>
                <IntegrationGrid
                    services={config?.exchangeServices ?? []}
                    onTest={handleTest}
                    testingService={testingService}
                />
            </Card>
            <Card title={t('communications_and_alerts')}>
                <IntegrationGrid
                    services={config?.communicationServices ?? []}
                    onTest={handleTest}
                    testingService={testingService}
                />
            </Card>
             <Card title={t('market_data_and_analysis')}>
                <IntegrationGrid
                    services={config?.marketDataServices ?? []}
                    onTest={handleTest}
                    testingService={testingService}
                />
            </Card>
            <div className="flex justify-end gap-4 pt-4">
                <button className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-5 rounded-lg text-sm transition-colors">{t('test_all_apis')}</button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg text-sm transition-colors">{t('save_all_settings')}</button>
            </div>
            {config && (
                <p className="text-xs text-muted-foreground text-right">{t('last_update')}: {new Date(config.lastUpdated).toLocaleString()}</p>
            )}
        </div>
    );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-semibold text-lg text-foreground mb-5">{title}</h2>
        {children}
    </div>
);

const IntegrationGrid: React.FC<{
    services: APIServiceIntegration[];
    onTest: (id: string) => void;
    testingService: string | null;
}> = ({ services, onTest, testingService }) => {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
                <APIInputGroup
                    key={service.id}
                    integration={service}
                    onTest={onTest}
                    disabled={testingService !== null && testingService !== service.id}
                    isTesting={testingService === service.id}
                />
            ))}
            {services.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-6">{t('no_integrations_configured')}</p>
            )}
        </div>
    );
};

const APIInputGroup: React.FC<{
    integration: APIServiceIntegration;
    onTest: (id: string) => void;
    disabled?: boolean;
    isTesting?: boolean;
}> = ({ integration, onTest, disabled, isTesting }) => {
    const { t } = useLanguage();
    const statusClass = integration.connected ? 'text-green-400' : 'text-yellow-400';
    return (
        <div className="space-y-4 border border-border rounded-lg p-4 bg-background/40">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-card-foreground">{integration.name}</h4>
                    <p className={`text-xs font-semibold ${statusClass}`}>
                        {integration.connected ? t('connected') : t('disconnected')}
                    </p>
                </div>
                {integration.lastTestedAt && (
                    <span className="text-[10px] text-muted-foreground">{t('last_tested')}: {new Date(integration.lastTestedAt).toLocaleString()}</span>
                )}
            </div>
            <div className="space-y-3 text-xs text-muted-foreground">
                <div>
                    <label className="text-xs uppercase tracking-wide">{t('api_key')}</label>
                    <p className="mt-1 text-foreground font-semibold">{integration.maskedKey}</p>
                </div>
                {integration.hasSecret && (
                    <div>
                        <label className="text-xs uppercase tracking-wide">{t('secret_key')}</label>
                        <p className="mt-1 text-foreground font-semibold">•••••••••••</p>
                    </div>
                )}
                {integration.issues && (
                    <p className="text-xs text-red-400">{integration.issues}</p>
                )}
            </div>
            <button
                onClick={() => onTest(integration.id)}
                disabled={disabled}
                className="w-full text-center mt-2 p-2 bg-secondary border border-border hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
            >
                {isTesting ? t('testing') : t('test_api')}
            </button>
        </div>
    );
};

export default APIConfig;