import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { DataSource, TelegramPublisherConfig, Workflow } from '../../types.ts';

const SettingsCard: React.FC<{ title: string, description: string, children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
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
    tradingAutomation: api.AutomationSettingsData['tradingAutomation'];
    scheduleRules: api.AutomationSettingsData['scheduleRules'];
    logs: api.AutomationSettingsData['logs'];
    statistics: api.AutomationSettingsData['statistics'];
}

const AutomationSettings: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<AutomationData | null>(null);
    const [activeTab, setActiveTab] = useState<'sources' | 'telegram' | 'workflows' | 'trading' | 'schedules' | 'logs'>('sources');
    const [statusMessage, setStatusMessage] = useState('');
    const [showDataSourceModal, setShowDataSourceModal] = useState(false);
    const [showWorkflowModal, setShowWorkflowModal] = useState(false);
    const [showTelegramModal, setShowTelegramModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
            setIsLoading(true);
        try {
            const data = await api.fetchAutomationSettings();
            setSettings(data);
        } catch (error) {
            console.error('Failed to load automation settings:', error);
            setStatusMessage('❌ Failed to load settings');
        } finally {
            setIsLoading(false);
        }
        };
    
    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
        await api.saveAutomationSettings(settings);
            setStatusMessage('✅ Settings saved successfully!');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (error) {
            setStatusMessage('❌ Failed to save settings');
        } finally {
        setIsSaving(false);
        }
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
        return (
            <div className="flex items-center justify-center p-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'sources'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('data_sources') || 'Data Sources'}
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'telegram'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('telegram_publishing') || 'Telegram Publishing'}
                </button>
                <button
                    onClick={() => setActiveTab('workflows')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'workflows'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('automated_workflows') || 'Workflows'}
                </button>
                <button
                    onClick={() => setActiveTab('trading')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'trading'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('trading_automation') || 'Trading Automation'}
                </button>
                <button
                    onClick={() => setActiveTab('schedules')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'schedules'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('schedules') || 'Schedules'}
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                        activeTab === 'logs'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    {t('logs') || 'Logs'}
                </button>
            </div>

            {/* Status Message */}
            {statusMessage && (
                <div className={`p-3 rounded-md ${
                    statusMessage.includes('✅') ? 'bg-green-900/20 border border-green-700/50 text-green-300' :
                    statusMessage.includes('❌') ? 'bg-red-900/20 border border-red-700/50 text-red-300' :
                    'bg-blue-900/20 border border-blue-700/50 text-blue-300'
                }`}>
                    {statusMessage}
                </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">{t('workflows_executed') || 'Workflows Executed'}</div>
                    <div className="text-2xl font-bold text-white mt-1">{settings.statistics.workflowsExecuted}</div>
                    <div className="text-xs text-gray-500 mt-1">+{settings.statistics.last24Hours.workflows} last 24h</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">{t('trades_executed') || 'Trades Executed'}</div>
                    <div className="text-2xl font-bold text-white mt-1">{settings.statistics.tradesExecuted}</div>
                    <div className="text-xs text-gray-500 mt-1">+{settings.statistics.last24Hours.trades} last 24h</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">{t('messages_published') || 'Messages Published'}</div>
                    <div className="text-2xl font-bold text-white mt-1">{settings.statistics.messagesPublished}</div>
                    <div className="text-xs text-gray-500 mt-1">+{settings.statistics.last24Hours.messages} last 24h</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400">{t('errors') || 'Errors'}</div>
                    <div className="text-2xl font-bold text-red-400 mt-1">{settings.statistics.errorsCount}</div>
                    <div className="text-xs text-gray-500 mt-1">+{settings.statistics.last24Hours.errors} last 24h</div>
            </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'sources' && (
                <DataSourceSection
                    sources={settings.dataSources}
                    onAdd={() => { setEditingItem(null); setShowDataSourceModal(true); }}
                    onEdit={(source) => { setEditingItem(source); setShowDataSourceModal(true); }}
                    onDelete={async (id) => {
                        try {
                            await api.removeDataSource(id);
                            await loadSettings();
                            setStatusMessage('✅ Data source removed');
                        } catch (error) {
                            setStatusMessage('❌ Failed to remove data source');
                        }
                    }}
                    onTest={async (id) => {
                        try {
                            const result = await api.testDataSource(id);
                            setStatusMessage(result.message);
                            await loadSettings();
                        } catch (error) {
                            setStatusMessage('❌ Test failed');
                        }
                    }}
                />
            )}

            {activeTab === 'telegram' && (
                <TelegramPublishingSection
                    configs={settings.telegramConfigs}
                    onAdd={() => { setEditingItem(null); setShowTelegramModal(true); }}
                    onEdit={(config) => { setEditingItem(config); setShowTelegramModal(true); }}
                    onDelete={async (id) => {
                        try {
                            await api.removeTelegramPublisherConfig(id);
                            await loadSettings();
                            setStatusMessage('✅ Telegram config removed');
                        } catch (error) {
                            setStatusMessage('❌ Failed to remove config');
                        }
                    }}
                    onUpdate={async (id, updates) => {
                        try {
                            await api.updateTelegramPublisherConfig(id, updates);
                            await loadSettings();
                            setStatusMessage('✅ Config updated');
                        } catch (error) {
                            setStatusMessage('❌ Failed to update config');
                        }
                    }}
                />
            )}

            {activeTab === 'workflows' && (
                <WorkflowsSection
                    workflows={settings.workflows}
                    onAdd={() => { setEditingItem(null); setShowWorkflowModal(true); }}
                    onEdit={(workflow) => { setEditingItem(workflow); setShowWorkflowModal(true); }}
                    onDelete={async (id) => {
                        try {
                            await api.deleteWorkflow(id);
                            await loadSettings();
                            setStatusMessage('✅ Workflow deleted');
                        } catch (error) {
                            setStatusMessage('❌ Failed to delete workflow');
                        }
                    }}
                    onToggle={async (id, enabled) => {
                        try {
                            await api.updateWorkflow(id, { enabled });
                            await loadSettings();
                        } catch (error) {
                            setStatusMessage('❌ Failed to update workflow');
                        }
                    }}
                    onExecute={async (id) => {
                        try {
                            const result = await api.executeWorkflow(id);
                            setStatusMessage(result.message);
                            await loadSettings();
                        } catch (error) {
                            setStatusMessage('❌ Failed to execute workflow');
                        }
                    }}
                />
            )}

            {activeTab === 'trading' && (
                <TradingAutomationSection
                    config={settings.tradingAutomation}
                    onUpdate={async (updates) => {
                        try {
                            await api.updateTradingAutomation(updates);
                            await loadSettings();
                            setStatusMessage('✅ Trading automation updated');
                        } catch (error) {
                            setStatusMessage('❌ Failed to update trading automation');
                        }
                    }}
                />
            )}

            {activeTab === 'schedules' && (
                <SchedulesSection
                    rules={settings.scheduleRules}
                    onAdd={async (rule) => {
                        try {
                            await api.addScheduleRule(rule);
                            await loadSettings();
                            setStatusMessage('✅ Schedule rule added');
                        } catch (error) {
                            setStatusMessage('❌ Failed to add schedule rule');
                        }
                    }}
                    onUpdate={async (id, updates) => {
                        try {
                            await api.updateScheduleRule(id, updates);
                            await loadSettings();
                            setStatusMessage('✅ Schedule rule updated');
                        } catch (error) {
                            setStatusMessage('❌ Failed to update schedule rule');
                        }
                    }}
                    onDelete={async (id) => {
                        try {
                            await api.removeScheduleRule(id);
                            await loadSettings();
                            setStatusMessage('✅ Schedule rule removed');
                        } catch (error) {
                            setStatusMessage('❌ Failed to remove schedule rule');
                        }
                    }}
                />
            )}

            {activeTab === 'logs' && (
                <LogsSection
                    logs={settings.logs}
                    onClear={async () => {
                        try {
                            await api.clearAutomationLogs();
                            await loadSettings();
                            setStatusMessage('✅ Logs cleared');
                        } catch (error) {
                            setStatusMessage('❌ Failed to clear logs');
                        }
                    }}
                />
            )}

            {/* Modals */}
            {showDataSourceModal && (
                <DataSourceModal
                    source={editingItem}
                    onClose={() => { setShowDataSourceModal(false); setEditingItem(null); }}
                    onSave={async (source) => {
                        try {
                            if (editingItem) {
                                await api.updateAutomationDataSource(editingItem.id, source);
                            } else {
                                await api.addDataSource(source);
                            }
                            await loadSettings();
                            setShowDataSourceModal(false);
                            setEditingItem(null);
                            setStatusMessage('✅ Data source saved');
                        } catch (error) {
                            setStatusMessage('❌ Failed to save data source');
                        }
                    }}
                />
            )}

            {showWorkflowModal && (
                <WorkflowModal
                    workflow={editingItem}
                    onClose={() => { setShowWorkflowModal(false); setEditingItem(null); }}
                    onSave={async (workflow) => {
                        try {
                            if (editingItem) {
                                await api.updateWorkflow(editingItem.id, workflow);
                            } else {
                                await api.createWorkflow(workflow);
                            }
                            await loadSettings();
                            setShowWorkflowModal(false);
                            setEditingItem(null);
                            setStatusMessage('✅ Workflow saved');
                        } catch (error) {
                            setStatusMessage('❌ Failed to save workflow');
                        }
                    }}
                />
            )}

            {showTelegramModal && (
                <TelegramConfigModal
                    config={editingItem}
                    onClose={() => { setShowTelegramModal(false); setEditingItem(null); }}
                    onSave={async (config) => {
                        try {
                            if (editingItem) {
                                await api.updateTelegramPublisherConfig(editingItem.id, config);
                            } else {
                                await api.addTelegramPublisherConfig(config);
                            }
                            await loadSettings();
                            setShowTelegramModal(false);
                            setEditingItem(null);
                            setStatusMessage('✅ Telegram config saved');
                        } catch (error) {
                            setStatusMessage('❌ Failed to save config');
                        }
                    }}
                />
            )}
        </div>
    );
};

// ==================== Section Components ====================

// Data Source Section
interface DataSourceSectionProps {
    sources: DataSource[];
    onAdd: () => void;
    onEdit: (source: DataSource) => void;
    onDelete: (id: string) => Promise<void>;
    onTest: (id: string) => Promise<void>;
}

const DataSourceSection: React.FC<DataSourceSectionProps> = ({ sources, onAdd, onEdit, onDelete, onTest }) => {
    const { t } = useLanguage();
    const [testingId, setTestingId] = useState<string | null>(null);

    return (
        <SettingsCard 
            title={t('data_sources') || 'Data Sources'} 
            description={t('data_sources_desc') || 'Manage the sources your AI uses for analysis (Telegram channels, websites, APIs).'}
        >
            <div className="space-y-4">
                {sources.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>{t('no_data_sources') || 'No data sources configured yet.'}</p>
                        <button
                            onClick={onAdd}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('add_data_source') || 'Add Data Source'}
                        </button>
                    </div>
                ) : (
                    <>
        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left">{t('type') || 'Type'}</th>
                                        <th className="px-4 py-3 text-left">{t('value') || 'Value'}</th>
                                        <th className="px-4 py-3 text-left">{t('status') || 'Status'}</th>
                                        <th className="px-4 py-3 text-right">{t('actions') || 'Actions'}</th>
                    </tr>
                </thead>
                                <tbody className="text-gray-300">
                    {sources.map(source => (
                                        <tr key={source.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                            <td className="px-4 py-3">{source.type}</td>
                                            <td className="px-4 py-3 truncate max-w-xs">{source.value}</td>
                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                    source.status === 'connected' ? 'bg-green-500/20 text-green-400' :
                                                    source.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {source.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setTestingId(source.id);
                                                            onTest(source.id).finally(() => setTestingId(null));
                                                        }}
                                                        disabled={testingId === source.id}
                                                        className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded disabled:opacity-50"
                                                    >
                                                        {testingId === source.id ? 'Testing...' : t('test') || 'Test'}
                                                    </button>
                                                    <button
                                                        onClick={() => onEdit(source)}
                                                        className="text-xs text-blue-400 hover:text-blue-300"
                                                    >
                                                        {t('edit') || 'Edit'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
                                                                onDelete(source.id);
                                                            }
                                                        }}
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        {t('delete') || 'Delete'}
                                                    </button>
                                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
                        <div className="text-center pt-4 border-t border-gray-800">
                            <button
                                onClick={onAdd}
                                className="text-blue-400 hover:text-blue-300 font-semibold text-sm"
                            >
                                + {t('add_new_source') || 'Add New Source'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </SettingsCard>
    );
};

// Telegram Publishing Section
interface TelegramPublishingSectionProps {
    configs: TelegramPublisherConfig[];
    onAdd: () => void;
    onEdit: (config: TelegramPublisherConfig) => void;
    onDelete: (id: string) => Promise<void>;
    onUpdate: (id: string, updates: Partial<TelegramPublisherConfig>) => Promise<void>;
}

const TelegramPublishingSection: React.FC<TelegramPublishingSectionProps> = ({ configs, onAdd, onEdit, onDelete, onUpdate }) => {
    const { t } = useLanguage();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    return (
        <SettingsCard 
            title={t('telegram_publishing_automation') || 'Telegram Publishing Automation'} 
            description={t('telegram_publishing_desc') || 'Configure automated posting to Telegram channels based on triggers and schedules.'}
        >
            <div className="space-y-4">
                {configs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>{t('no_telegram_configs') || 'No Telegram publishing configurations yet.'}</p>
                        <button
                            onClick={onAdd}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('add_telegram_config') || 'Add Telegram Configuration'}
                        </button>
                    </div>
                ) : (
                    <>
                        {configs.map(config => (
                            <div key={config.id} className="bg-gray-800/50 rounded-lg border border-gray-700">
                                <button
                                    onClick={() => setExpandedId(expandedId === config.id ? null : config.id)}
                                    className="w-full flex justify-between items-center p-4 hover:bg-gray-800/70 transition-colors"
                                >
                                    <span className="font-semibold text-white">{config.channelName}</span>
                                    <svg
                                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === config.id ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
            </button>
                                {expandedId === config.id && (
                                    <div className="p-4 border-t border-gray-700 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    {t('auto_post_triggers') || 'Auto Post Triggers'}
                                                </label>
                                                <div className="space-y-2">
                                                    {Object.entries(config.autoPostTriggers).map(([key, value]) => (
                                                        <label key={key} className="flex items-center text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={value}
                                                                onChange={(e) => onUpdate(config.id, {
                                                                    autoPostTriggers: {
                                                                        ...config.autoPostTriggers,
                                                                        [key]: e.target.checked
                                                                    }
                                                                })}
                                                                className="mr-2"
                                                            />
                                                            <span className="text-gray-300">{t(key) || key}</span>
                                                        </label>
                                                    ))}
                            </div>
                        </div>
                        <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    {t('schedule') || 'Schedule'}
                                                </label>
                                                <select
                                                    value={config.schedule}
                                                    onChange={(e) => onUpdate(config.id, { schedule: e.target.value as any })}
                                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white"
                                                >
                                                    <option value="instantly">{t('instantly') || 'Instantly'}</option>
                                                    <option value="daily_9am">{t('daily_at_9am') || 'Daily at 9 AM'}</option>
                                                    <option value="weekdays_only">{t('weekdays_only') || 'Weekdays Only'}</option>
                            </select>
                        </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-md">
                                            <div>
                                                <div className="font-semibold text-white">{t('require_approval') || 'Require Approval'}</div>
                                                <div className="text-xs text-gray-400">{t('require_approval_desc') || 'Require manual approval before posting'}</div>
                                            </div>
                                            <ToggleSwitch
                                                enabled={config.requiresApproval}
                                                onToggle={(val) => onUpdate(config.id, { requiresApproval: val })}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onEdit(config)}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                                            >
                                                {t('edit') || 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
                                                        onDelete(config.id);
                                                    }
                                                }}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                                            >
                                                {t('delete') || 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="text-center pt-4 border-t border-gray-800">
                            <button
                                onClick={onAdd}
                                className="text-blue-400 hover:text-blue-300 font-semibold text-sm"
                            >
                                + {t('add_new_channel') || 'Add New Channel'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </SettingsCard>
    );
};

// Workflows Section
interface WorkflowsSectionProps {
    workflows: Workflow[];
    onAdd: () => void;
    onEdit: (workflow: Workflow) => void;
    onDelete: (id: string) => Promise<void>;
    onToggle: (id: string, enabled: boolean) => Promise<void>;
    onExecute: (id: string) => Promise<void>;
}

const WorkflowsSection: React.FC<WorkflowsSectionProps> = ({ workflows, onAdd, onEdit, onDelete, onToggle, onExecute }) => {
    const { t } = useLanguage();
    const [executingId, setExecutingId] = useState<string | null>(null);

    return (
        <SettingsCard 
            title={t('automated_workflows') || 'Automated Workflows'} 
            description={t('automated_workflows_desc') || 'Create powerful IF-THEN rules to connect AI analysis to actions.'}
        >
            <div className="space-y-4">
                {workflows.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>{t('no_workflows') || 'No workflows created yet.'}</p>
                        <button
                            onClick={onAdd}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('create_workflow') || 'Create Workflow'}
                        </button>
                    </div>
                ) : (
                    <>
                        {workflows.map(workflow => (
                            <div key={workflow.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-white mb-1">{workflow.name}</h4>
                                        <p className="text-xs text-gray-400">Trigger: {workflow.trigger.type}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ToggleSwitch
                                            enabled={workflow.enabled}
                                            onToggle={(val) => onToggle(workflow.id, val)}
                                        />
                                        <button
                                            onClick={() => {
                                                setExecutingId(workflow.id);
                                                onExecute(workflow.id).finally(() => setExecutingId(null));
                                            }}
                                            disabled={executingId === workflow.id || !workflow.enabled}
                                            className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded disabled:opacity-50"
                                        >
                                            {executingId === workflow.id ? 'Executing...' : t('execute') || 'Execute'}
                                        </button>
                                        <button
                                            onClick={() => onEdit(workflow)}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            {t('edit') || 'Edit'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
                                                    onDelete(workflow.id);
                                                }
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-700 text-sm space-y-1">
                                    <p>
                                        <span className="font-semibold text-purple-400">{t('workflow_if') || 'If'}</span>{' '}
                                        <span className="text-gray-300">{workflow.trigger.type}</span>
                                    </p>
                                    {workflow.conditions.map((condition, idx) => (
                                        <p key={idx}>
                                            <span className="font-semibold text-purple-400">
                                                {idx === 0 ? t('workflow_and') || 'And' : 'And'}
                                            </span>{' '}
                                            <span className="text-gray-300">
                                                {condition.field} {condition.operator} {String(condition.value)}
                                            </span>
                                        </p>
                                    ))}
                                    {workflow.actions.map((action, idx) => (
                                        <p key={idx}>
                                            <span className="font-semibold text-purple-400">
                                                {idx === 0 ? t('workflow_then') || 'Then' : 'Then'}
                                            </span>{' '}
                                            <span className="text-gray-300">
                                                {action.type} on {action.target}
                                            </span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="text-center pt-4 border-t border-gray-800">
                            <button
                                onClick={onAdd}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors"
                            >
                                {t('create_workflow') || 'Create Workflow'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </SettingsCard>
    );
};

// Trading Automation Section
interface TradingAutomationSectionProps {
    config: api.AutomationSettingsData['tradingAutomation'];
    onUpdate: (updates: Partial<api.AutomationSettingsData['tradingAutomation']>) => Promise<void>;
}

const TradingAutomationSection: React.FC<TradingAutomationSectionProps> = ({ config, onUpdate }) => {
    const { t } = useLanguage();
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (field: keyof typeof config, value: any) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        await onUpdate(localConfig);
    };

    return (
        <SettingsCard 
            title={t('trading_automation') || 'Trading Automation'} 
            description={t('trading_automation_desc') || 'Configure automated trading rules and risk management.'}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div>
                        <div className="font-semibold text-white">{t('enable_trading_automation') || 'Enable Trading Automation'}</div>
                        <div className="text-xs text-gray-400">{t('enable_trading_automation_desc') || 'Allow workflows to execute trades automatically'}</div>
                    </div>
                    <ToggleSwitch
                        enabled={localConfig.enabled}
                        onToggle={(val) => handleChange('enabled', val)}
                    />
                </div>

                {localConfig.enabled && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('max_daily_trades') || 'Max Daily Trades'}
                                </label>
                                <input
                                    type="number"
                                    value={localConfig.maxDailyTrades}
                                    onChange={(e) => handleChange('maxDailyTrades', parseInt(e.target.value))}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('max_position_size') || 'Max Position Size (%)'}
                                </label>
                                <input
                                    type="number"
                                    value={localConfig.maxPositionSize}
                                    onChange={(e) => handleChange('maxPositionSize', parseFloat(e.target.value))}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="0.1"
                                    max="100"
                                    step="0.1"
                                />
                    </div>
                    <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('risk_level') || 'Risk Level'}
                                </label>
                                <select
                                    value={localConfig.riskLevel}
                                    onChange={(e) => handleChange('riskLevel', e.target.value)}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                >
                                    <option value="conservative">{t('conservative') || 'Conservative'}</option>
                                    <option value="balanced">{t('balanced') || 'Balanced'}</option>
                                    <option value="aggressive">{t('aggressive') || 'Aggressive'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('stop_loss') || 'Stop Loss (%)'}
                                </label>
                                <input
                                    type="number"
                                    value={localConfig.stopLoss}
                                    onChange={(e) => handleChange('stopLoss', parseFloat(e.target.value))}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('take_profit') || 'Take Profit (%)'}
                                </label>
                                <input
                                    type="number"
                                    value={localConfig.takeProfit}
                                    onChange={(e) => handleChange('takeProfit', parseFloat(e.target.value))}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="0.1"
                                    max="50"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('trailing_stop_distance') || 'Trailing Stop Distance (%)'}
                                </label>
                                <input
                                    type="number"
                                    value={localConfig.trailingStopDistance}
                                    onChange={(e) => handleChange('trailingStopDistance', parseFloat(e.target.value))}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    disabled={!localConfig.trailingStop}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('trailing_stop') || 'Trailing Stop'}</div>
                                <div className="text-xs text-gray-400">{t('trailing_stop_desc') || 'Automatically adjust stop loss as price moves favorably'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={localConfig.trailingStop}
                                onToggle={(val) => handleChange('trailingStop', val)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('allowed_trading_pairs') || 'Allowed Trading Pairs'}
                            </label>
                            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="flex flex-wrap gap-2">
                                    {localConfig.allowedPairs.map((pair, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm flex items-center gap-2">
                                            {pair}
                                            <button
                                                onClick={() => {
                                                    const newPairs = localConfig.allowedPairs.filter((_, i) => i !== idx);
                                                    handleChange('allowedPairs', newPairs);
                                                }}
                                                className="text-blue-300 hover:text-red-400"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('add_trading_pair') || 'Add pair (e.g., BTC/USDT)'}
                                    className="mt-2 w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            const value = (e.target as HTMLInputElement).value.trim();
                                            if (value && !localConfig.allowedPairs.includes(value)) {
                                                handleChange('allowedPairs', [...localConfig.allowedPairs, value]);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('save_changes') || 'Save Changes'}
                        </button>
                    </>
                )}
            </div>
        </SettingsCard>
    );
};

// Schedules Section
interface SchedulesSectionProps {
    rules: api.AutomationSettingsData['scheduleRules'];
    onAdd: (rule: Omit<api.AutomationSettingsData['scheduleRules'][0], 'id'>) => Promise<void>;
    onUpdate: (id: string, updates: Partial<api.AutomationSettingsData['scheduleRules'][0]>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const SchedulesSection: React.FC<SchedulesSectionProps> = ({ rules, onAdd, onUpdate, onDelete }) => {
    const { t } = useLanguage();
    const [showAddModal, setShowAddModal] = useState(false);

    return (
        <SettingsCard 
            title={t('schedules') || 'Schedules'} 
            description={t('schedules_desc') || 'Schedule automated tasks using cron expressions.'}
        >
            <div className="space-y-4">
                {rules.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>{t('no_schedules') || 'No schedule rules configured yet.'}</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            {t('add_schedule') || 'Add Schedule Rule'}
                        </button>
                    </div>
                ) : (
                    <>
                        {rules.map(rule => (
                            <div key={rule.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-white mb-1">{rule.name}</h4>
                                        <p className="text-xs text-gray-400">
                                            {rule.type} • {rule.cronExpression} • {rule.timezone}
                                        </p>
                                        {rule.nextRun && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Next run: {new Date(rule.nextRun).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ToggleSwitch
                                            enabled={rule.enabled}
                                            onToggle={(val) => onUpdate(rule.id, { enabled: val })}
                                        />
                                        <button
                                            onClick={() => {
                                                if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
                                                    onDelete(rule.id);
                                                }
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                            </div>
                        </div>
                    </div>
                        ))}
                        <div className="text-center pt-4 border-t border-gray-800">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="text-blue-400 hover:text-blue-300 font-semibold text-sm"
                            >
                                + {t('add_schedule') || 'Add Schedule Rule'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </SettingsCard>
    );
};

// Logs Section
interface LogsSectionProps {
    logs: api.AutomationSettingsData['logs'];
    onClear: () => Promise<void>;
}

const LogsSection: React.FC<LogsSectionProps> = ({ logs, onClear }) => {
    const { t } = useLanguage();
    const [filter, setFilter] = useState<string>('all');

    const filteredLogs = filter === 'all' 
        ? logs 
        : logs.filter(log => log.type === filter || log.status === filter);

    return (
        <SettingsCard 
            title={t('logs') || 'Logs'} 
            description={t('logs_desc') || 'View automation execution logs and errors.'}
        >
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                    >
                        <option value="all">{t('all') || 'All'}</option>
                        <option value="workflow">Workflows</option>
                        <option value="trading">Trading</option>
                        <option value="telegram_publish">Telegram</option>
                        <option value="error">Errors</option>
                    </select>
                    <button
                        onClick={onClear}
                        className="text-sm text-red-400 hover:text-red-300"
                    >
                        {t('clear_logs') || 'Clear Logs'}
                    </button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            {t('no_logs') || 'No logs available.'}
                        </div>
                    ) : (
                        filteredLogs.map(log => (
                            <div
                                key={log.id}
                                className={`p-3 rounded-md border ${
                                    log.status === 'success' ? 'bg-green-900/20 border-green-700/50' :
                                    log.status === 'error' ? 'bg-red-900/20 border-red-700/50' :
                                    'bg-yellow-900/20 border-yellow-700/50'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-white">{log.action}</div>
                                        <div className="text-xs text-gray-400 mt-1">{log.message}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </div>
                        </div>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        log.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                        log.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        {log.status}
                                    </span>
                    </div>
                </div>
                        ))
            )}
        </div>
            </div>
        </SettingsCard>
    );
};

// ==================== Modal Components ====================

// Data Source Modal
interface DataSourceModalProps {
    source: DataSource | null;
    onClose: () => void;
    onSave: (source: Omit<DataSource, 'id' | 'status'>) => Promise<void>;
}

const DataSourceModal: React.FC<DataSourceModalProps> = ({ source, onClose, onSave }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        type: source?.type || 'Telegram Channel',
        value: source?.value || '',
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    {source ? t('edit_data_source') || 'Edit Data Source' : t('add_data_source') || 'Add Data Source'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('type') || 'Type'}
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            <option value="Telegram Channel">Telegram Channel</option>
                            <option value="News Website">News Website</option>
                            <option value="Custom API">Custom API</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('value') || 'Value'}
                        </label>
                        <input
                            type="text"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            placeholder={t('enter_source_value') || 'Enter source URL or identifier'}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                </div>
                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Workflow Modal
interface WorkflowModalProps {
    workflow: Workflow | null;
    onClose: () => void;
    onSave: (workflow: Omit<Workflow, 'id'>) => Promise<void>;
}

const WorkflowModal: React.FC<WorkflowModalProps> = ({ workflow, onClose, onSave }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: workflow?.name || '',
        enabled: workflow?.enabled ?? true,
        trigger: workflow?.trigger || { type: 'new_news_article' as const, source: '' },
        conditions: workflow?.conditions || [],
        actions: workflow?.actions || [],
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 my-auto">
                <h3 className="text-lg font-semibold text-white mb-4">
                    {workflow ? t('edit_workflow') || 'Edit Workflow' : t('create_workflow') || 'Create Workflow'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('workflow_name') || 'Workflow Name'}
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('trigger_type') || 'Trigger Type'}
                        </label>
                        <select
                            value={formData.trigger.type}
                            onChange={(e) => setFormData({
                                ...formData,
                                trigger: { ...formData.trigger, type: e.target.value as any }
                            })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            <option value="new_news_article">New News Article</option>
                            <option value="new_crypto_signal">New Crypto Signal</option>
                            <option value="market_event">Market Event</option>
                        </select>
                </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.enabled}
                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            className=""
                        />
                        <label className="text-sm text-gray-300">{t('enabled') || 'Enabled'}</label>
                </div>
            </div>
                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Telegram Config Modal
interface TelegramConfigModalProps {
    config: TelegramPublisherConfig | null;
    onClose: () => void;
    onSave: (config: Omit<TelegramPublisherConfig, 'id'>) => Promise<void>;
}

const TelegramConfigModal: React.FC<TelegramConfigModalProps> = ({ config, onClose, onSave }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        channelName: config?.channelName || '',
        botToken: config?.botToken || '',
        channelId: config?.channelId || '',
        schedule: config?.schedule || 'instantly',
        requiresApproval: config?.requiresApproval ?? false,
        autoPostTriggers: config?.autoPostTriggers || {
            gold_predictions: false,
            crypto_signals: false,
            verified_news: false,
            market_analysis: false,
        },
        contentFilters: config?.contentFilters || {
            crypto_signal_strength: 'any',
            news_impact_score: 50,
        },
        messageTemplates: config?.messageTemplates || {
            gold_prediction: '',
            crypto_signal: '',
            news_article: '',
        },
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 my-auto">
                <h3 className="text-lg font-semibold text-white mb-4">
                    {config ? t('edit_telegram_config') || 'Edit Telegram Config' : t('add_telegram_config') || 'Add Telegram Config'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('channel_name') || 'Channel Name'}
                        </label>
                        <input
                            type="text"
                            value={formData.channelName}
                            onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('bot_token') || 'Bot Token'}
                        </label>
                        <input
                            type="text"
                            value={formData.botToken}
                            onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('channel_id') || 'Channel ID'}
    </label>
                        <input
                            type="text"
                            value={formData.channelId}
                            onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                </div>
                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Toggle Switch Component
const ToggleSwitch: React.FC<{ enabled: boolean; onToggle: (enabled: boolean) => void }> = ({ enabled, onToggle }) => (
    <button
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-600'
        }`}
    >
        <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

export default AutomationSettings;