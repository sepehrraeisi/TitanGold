import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { DataSource, TelegramPublisherConfig, Workflow } from '../../types.ts';

const SettingsCard: React.FC<{ title: string, description: string, children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-card border border-border rounded-lg">
        <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="p-6 space-y-6">
            {children}
        </div>
    </div>
);

interface AutomationData {
    dataSources: DataSource[];
    telegramConfigs: TelegramPublisherConfig[];
    workflows: Workflow[];
}

const AutomationSettings: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<AutomationData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const automationSettings = await api.fetchAutomationSettings();
            setSettings(automationSettings);
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        await api.saveAutomationSettings(settings);
        setIsSaving(false);
        // In a real app, you might show a success toast here.
    };
    
    const handleWorkflowToggle = (workflowId: string) => {
        setSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                workflows: prev.workflows.map(wf => 
                    wf.id === workflowId ? { ...wf, enabled: !wf.enabled } : wf
                )
            };
        });
    };
    
    const handleTelegramConfigChange = (channelId: string, field: keyof TelegramPublisherConfig, value: any) => {
         setSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                telegramConfigs: prev.telegramConfigs.map(config => 
                    config.id === channelId 
                    ? { ...config, [field]: value }
                    : config
                )
            };
        });
    }
    
     const handleTelegramTriggerChange = (channelId: string, trigger: keyof TelegramPublisherConfig['autoPostTriggers'], value: boolean) => {
         setSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                telegramConfigs: prev.telegramConfigs.map(config => 
                    config.id === channelId 
                    ? { ...config, autoPostTriggers: { ...config.autoPostTriggers, [trigger]: value } }
                    : config
                )
            };
        });
    }

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>
    }

    if (!settings) return null;

    return (
        <div className="space-y-8">
            <SettingsCard title={t('data_sources')} description={t('data_sources_desc')}>
                <DataSourceTable sources={settings.dataSources} />
            </SettingsCard>

            <SettingsCard title={t('advanced_telegram_publishing')} description={t('telegram_publishing_desc')}>
                {settings.telegramConfigs.map((config) => (
                    <ChannelConfig 
                        key={config.id} 
                        config={config}
                        onConfigChange={handleTelegramConfigChange}
                        onTriggerChange={handleTelegramTriggerChange}
                    />
                ))}
                 <div className="text-center pt-4 border-t border-border">
                    <button className="text-primary hover:underline font-semibold text-sm">{t('add_new_channel')}</button>
                </div>
            </SettingsCard>

            <SettingsCard title={t('automated_workflows')} description={t('automated_workflows_desc')}>
                {settings.workflows.map(workflow => (
                    <WorkflowCard key={workflow.id} workflow={workflow} onToggle={handleWorkflowToggle} />
                ))}
                <div className="text-center pt-4 border-t border-border">
                    <button className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-md text-sm">{t('create_workflow')}</button>
                </div>
            </SettingsCard>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground font-bold py-2 px-6 rounded-md disabled:opacity-50">
                    {isSaving ? t('saving') : t('save_changes')}
                </button>
            </div>
        </div>
    );
};

const DataSourceTable: React.FC<{ sources: DataSource[] }> = ({ sources }) => {
    const { t } = useLanguage();
    const statusClasses = {
        connected: 'bg-green-500/20 text-green-400',
        error: 'bg-red-500/20 text-red-400',
        pending: 'bg-yellow-500/20 text-yellow-400',
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                        <th className="px-4 py-2">{t('source_type')}</th>
                        <th className="px-4 py-2">{t('source_value')}</th>
                        <th className="px-4 py-2">{t('status')}</th>
                        <th className="px-4 py-2 text-right">{t('action')}</th>
                    </tr>
                </thead>
                <tbody className="text-card-foreground">
                    {sources.map(source => (
                        <tr key={source.id} className="border-b border-border last:border-b-0">
                            <td className="px-4 py-3 font-medium">{t(source.type.toLowerCase().replace(/ /g, '_'))}</td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{source.value}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[source.status]}`}>
                                    {t(source.status)}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button className="text-xs text-primary hover:underline">{t('edit')}</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface ChannelConfigProps {
    config: TelegramPublisherConfig;
    onConfigChange: (channelId: string, field: keyof TelegramPublisherConfig, value: any) => void;
    onTriggerChange: (channelId: string, trigger: keyof TelegramPublisherConfig['autoPostTriggers'], value: boolean) => void;
}

const ChannelConfig: React.FC<ChannelConfigProps> = ({ config, onConfigChange, onTriggerChange }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="bg-secondary rounded-lg border border-border">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4">
                <span className="font-semibold text-foreground">{config.channelName}</span>
                <svg className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h5 className="font-semibold text-card-foreground mb-2">{t('auto_post_triggers')}</h5>
                            <div className="grid grid-cols-2 gap-2">
                                <Checkbox label={t('gold_predictions')} checked={config.autoPostTriggers.gold_predictions} onChange={(e) => onTriggerChange(config.id, 'gold_predictions', e.target.checked)} />
                                <Checkbox label={t('crypto_signals')} checked={config.autoPostTriggers.crypto_signals} onChange={(e) => onTriggerChange(config.id, 'crypto_signals', e.target.checked)} />
                                <Checkbox label={t('verified_news')} checked={config.autoPostTriggers.verified_news} onChange={(e) => onTriggerChange(config.id, 'verified_news', e.target.checked)} />
                                <Checkbox label={t('market_analysis')} checked={config.autoPostTriggers.market_analysis} onChange={(e) => onTriggerChange(config.id, 'market_analysis', e.target.checked)} />
                            </div>
                        </div>
                        <div>
                            <h5 className="font-semibold text-card-foreground mb-2">{t('schedule')}</h5>
                            <select value={config.schedule} onChange={(e) => onConfigChange(config.id, 'schedule', e.target.value)} className="w-full p-2 bg-input border border-border rounded-md text-sm">
                                <option value="instantly">{t('instantly')}</option>
                                <option value="daily_9am">{t('daily_at_9am')}</option>
                                <option value="weekdays_only">{t('weekdays_only')}</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <h5 className="font-semibold text-card-foreground mb-2">{t('content_filters')}</h5>
                        <div className="p-3 bg-background rounded-md space-y-3 border border-border">
                            <p className="text-xs font-semibold text-muted-foreground">{t('only_post_if')}</p>
                            <div className="flex items-center gap-4">
                                <label className="text-sm text-card-foreground">{t('crypto_signal_strength_is')}</label>
                                <select defaultValue={config.contentFilters.crypto_signal_strength} className="p-1 bg-input border border-border rounded-md text-sm">
                                    <option value="any">{t('any')}</option>
                                    <option value="medium">{t('medium')}</option>
                                    <option value="strong">{t('strong')}</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="text-sm text-card-foreground">{t('news_impact_score_greater_than')}</label>
                                <input type="number" defaultValue={config.contentFilters.news_impact_score} className="w-20 p-1 bg-input border border-border rounded-md text-sm" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border">
                        <div>
                            <h5 className="font-semibold text-card-foreground">{t('require_approval')}</h5>
                            <p className="text-xs text-muted-foreground">{t('require_approval_desc')}</p>
                        </div>
                        <ToggleSwitch enabled={config.requiresApproval} onToggle={(val) => onConfigChange(config.id, 'requiresApproval', val)} />
                    </div>
                </div>
            )}
        </div>
    )
};

interface WorkflowCardProps {
    workflow: Workflow;
    onToggle: (workflowId: string) => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, onToggle }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-secondary rounded-lg border border-border p-4">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-foreground">{workflow.name}</h4>
                    <p className="text-xs text-muted-foreground">Trigger: {workflow.trigger.type}</p>
                </div>
                <div className="flex items-center gap-4">
                    <ToggleSwitch enabled={workflow.enabled} onToggle={() => onToggle(workflow.id)} />
                    <button className="text-xs text-primary hover:underline">{t('view_logs')}</button>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-sm space-y-2">
                <p><span className="font-semibold text-purple-400">{t('workflow_if')}</span> <span className="text-card-foreground">{workflow.trigger.type}</span></p>
                <p><span className="font-semibold text-purple-400">{t('workflow_and')}</span> <span className="text-card-foreground">{workflow.conditions[0].field} &gt; {workflow.conditions[0].value}</span></p>
                <p><span className="font-semibold text-purple-400">{t('workflow_then')}</span> <span className="text-card-foreground">{workflow.actions[0].type} on {workflow.actions[0].target}</span></p>
            </div>
        </div>
    );
};

const Checkbox: React.FC<{label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({ label, checked, onChange }) => (
    <label className="flex items-center text-sm">
        <input type="checkbox" checked={checked} onChange={onChange} className="form-checkbox h-4 w-4 rounded bg-input border-border text-primary focus:ring-primary" />
        <span className="ml-2 text-muted-foreground">{label}</span>
    </label>
);

const ToggleSwitch: React.FC<{ enabled: boolean, onToggle: (enabled: boolean) => void }> = ({ enabled, onToggle }) => (
    <button onClick={() => onToggle(!enabled)} className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}>
        <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
);

export default AutomationSettings;