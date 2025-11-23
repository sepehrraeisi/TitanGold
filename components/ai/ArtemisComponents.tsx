import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { ArtemisState, ArtemisLog, ArtemisConfig } from '../../types.ts';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

// Backtesting Component
export const Backtesting: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const [isRunning, setIsRunning] = useState(false);
    const [backtestResults, setBacktestResults] = useState<any[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<string>('');
    const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | '3m'>('1m');
    
    const handleRunBacktest = async () => {
        setIsRunning(true);
        try {
            const result = await api.runBacktest({
                scenarioId: selectedScenario,
                timeRange,
                mode: artemis.mode,
            });
            setBacktestResults([result, ...backtestResults].slice(0, 10));
            alert(t('backtest_completed') || 'Backtest completed successfully!');
        } catch (e) {
            console.error('Backtest failed:', e);
            alert(t('backtest_failed') || 'Backtest failed. Please try again.');
        } finally {
            setIsRunning(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-semibold text-foreground mb-4">{t('backtesting_system') || 'Backtesting System'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('select_scenario') || 'Select Scenario'}</label>
                        <select
                            value={selectedScenario}
                            onChange={(e) => setSelectedScenario(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="">{t('all_scenarios') || 'All Scenarios'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('time_range') || 'Time Range'}</label>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as any)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="1d">{t('1_day') || '1 Day'}</option>
                            <option value="1w">{t('1_week') || '1 Week'}</option>
                            <option value="1m">{t('1_month') || '1 Month'}</option>
                            <option value="3m">{t('3_months') || '3 Months'}</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleRunBacktest}
                            disabled={isRunning}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isRunning ? t('running_backtest') || 'Running...' : t('run_backtest') || 'Run Backtest'}
                        </button>
                    </div>
                </div>
            </Card>
            
            {backtestResults.length > 0 && (
                <Card>
                    <h3 className="font-semibold text-foreground mb-4">{t('backtest_results') || 'Backtest Results'}</h3>
                    <div className="space-y-3">
                        {backtestResults.map((result, idx) => (
                            <div key={idx} className="p-4 border border-border rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('total_trades') || 'Total Trades'}</p>
                                        <p className="font-semibold text-foreground">{result.totalTrades || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('win_rate') || 'Win Rate'}</p>
                                        <p className="font-semibold text-foreground">{result.winRate?.toFixed(1) || 0}%</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('total_profit') || 'Total Profit'}</p>
                                        <p className={`font-semibold ${(result.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            ${result.totalProfit?.toFixed(2) || '0.00'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('accuracy') || 'Accuracy'}</p>
                                        <p className="font-semibold text-foreground">{result.accuracy?.toFixed(1) || 0}%</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

// System Logs Component
export const SystemLogs: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const [logs, setLogs] = useState<ArtemisLog[]>([]);
    const [filter, setFilter] = useState<'all' | 'command' | 'decision' | 'trade' | 'error'>('all');
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const loadLogs = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchArtemisLogs({ filter, limit: 100 });
                setLogs(data);
            } catch (e) {
                console.error('Failed to load logs:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadLogs();
    }, [filter]);
    
    if (isLoading) {
        return <Card><div className="text-center p-10">{t('loading')}</div></Card>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('system_logs') || 'System Logs'}</h3>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="p-2 bg-secondary border border-border rounded text-foreground text-sm"
                    >
                        <option value="all">{t('all_logs') || 'All Logs'}</option>
                        <option value="command">{t('commands') || 'Commands'}</option>
                        <option value="decision">{t('decisions') || 'Decisions'}</option>
                        <option value="trade">{t('trades') || 'Trades'}</option>
                        <option value="error">{t('errors') || 'Errors'}</option>
                    </select>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {logs.length > 0 ? (
                        logs.map(log => (
                            <div key={log.id} className={`p-3 border rounded-lg text-sm ${
                                log.level === 'error' ? 'border-red-500/30 bg-red-500/10' :
                                log.level === 'warning' ? 'border-yellow-500/30 bg-yellow-500/10' :
                                'border-border'
                            }`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                                                log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {t(log.level) || log.level}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{t(log.type) || log.type}</span>
                                        </div>
                                        <p className="font-semibold text-foreground">{log.action}</p>
                                        {log.details && (
                                            <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(log.details).substring(0, 100)}...</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('source') || 'Source'}: {log.source} · {new Date(log.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    {log.result && (
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            log.result === 'success' ? 'bg-green-500/20 text-green-400' :
                                            log.result === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {t(log.result) || log.result}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('no_logs') || 'No logs found.'}</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

// Artemis Settings Component
export const ArtemisSettings: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis || !artemis.decisionEngine) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const [config, setConfig] = useState<ArtemisConfig>(artemis.config || {
        decisionEngine: {
            strategy: artemis.decisionEngine?.strategy || 'voting',
            activeModel: artemis.decisionEngine?.activeModel || 'internal',
            confidenceThreshold: artemis.decisionEngine?.confidenceThreshold || 75,
            autoExecution: false,
            requireApproval: true,
            maxConcurrentTrades: 5,
        },
        learning: {
            activeLearning: artemis.learningSystem?.activeLearning || false,
            autoRetrain: false,
            retrainInterval: 24,
            minAccuracyForRetrain: 70,
            backtestBeforeRetrain: true,
        },
        monitoring: {
            healthCheckInterval: 5,
            alertOnError: true,
            alertChannels: {
                dashboard: true,
                telegram: false,
                email: false,
            },
        },
        security: {
            requireMFA: false,
            logAllCommands: true,
            encryptSensitiveData: true,
            sessionTimeout: 30,
        },
        integration: {
            mexc: {
                enabled: true,
                testnet: artemis.mode === 'demo',
            },
            telegram: {
                enabled: false,
                channels: [],
            },
        },
        ui: {
            language: 'en',
            theme: 'dark',
            widgets: [],
        },
    });
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateArtemisConfig({ config });
            alert(t('settings_saved') || 'Settings saved successfully!');
            onRefresh();
        } catch (e) {
            console.error('Failed to save settings:', e);
            alert(t('settings_save_failed') || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('artemis_settings') || 'Artemis Settings'}</h3>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save_settings') || 'Save Settings'}
                    </button>
                </div>
                
                <div className="space-y-6">
                    {/* Decision Engine Settings */}
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('decision_engine_settings') || 'Decision Engine Settings'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('strategy') || 'Strategy'}</label>
                                <select
                                    value={config.decisionEngine.strategy}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, strategy: e.target.value as any}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                >
                                    <option value="voting">{t('voting') || 'Voting'}</option>
                                    <option value="weighted">{t('weighted') || 'Weighted'}</option>
                                    <option value="mixture_of_experts">{t('mixture_of_experts') || 'Mixture of Experts'}</option>
                                    <option value="consensus">{t('consensus') || 'Consensus'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('active_model') || 'Active Model'}</label>
                                <select
                                    value={config.decisionEngine.activeModel}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, activeModel: e.target.value as any}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                >
                                    <option value="internal">{t('internal') || 'Internal'}</option>
                                    <option value="claude">{t('claude') || 'Claude'}</option>
                                    <option value="gemini">{t('gemini') || 'Gemini'}</option>
                                    <option value="openai">{t('openai') || 'OpenAI'}</option>
                                    <option value="deepseek">{t('deepseek') || 'DeepSeek'}</option>
                                    <option value="hybrid">{t('hybrid') || 'Hybrid'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('confidence_threshold') || 'Confidence Threshold'} (%)</label>
                                <input
                                    type="number"
                                    value={config.decisionEngine.confidenceThreshold}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, confidenceThreshold: parseInt(e.target.value) || 75}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('max_concurrent_trades') || 'Max Concurrent Trades'}</label>
                                <input
                                    type="number"
                                    value={config.decisionEngine.maxConcurrentTrades}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, maxConcurrentTrades: parseInt(e.target.value) || 5}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="1"
                                    max="20"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.decisionEngine.autoExecution}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, autoExecution: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('auto_execution') || 'Auto Execution'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.decisionEngine.requireApproval}
                                    onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, requireApproval: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('require_approval') || 'Require Approval'}</label>
                            </div>
                        </div>
                    </div>
                    
                    {/* Learning Settings */}
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('learning_settings') || 'Learning Settings'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.learning.activeLearning}
                                    onChange={(e) => setConfig({...config, learning: {...config.learning, activeLearning: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('active_learning') || 'Active Learning'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.learning.autoRetrain}
                                    onChange={(e) => setConfig({...config, learning: {...config.learning, autoRetrain: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('auto_retrain') || 'Auto Retrain'}</label>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('retrain_interval') || 'Retrain Interval'} (hours)</label>
                                <input
                                    type="number"
                                    value={config.learning.retrainInterval}
                                    onChange={(e) => setConfig({...config, learning: {...config.learning, retrainInterval: parseInt(e.target.value) || 24}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('min_accuracy_retrain') || 'Min Accuracy for Retrain'} (%)</label>
                                <input
                                    type="number"
                                    value={config.learning.minAccuracyForRetrain}
                                    onChange={(e) => setConfig({...config, learning: {...config.learning, minAccuracyForRetrain: parseInt(e.target.value) || 70}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="0"
                                    max="100"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Security Settings */}
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('security_settings') || 'Security Settings'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.security.requireMFA}
                                    onChange={(e) => setConfig({...config, security: {...config.security, requireMFA: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('require_mfa') || 'Require Multi-Factor Authentication'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.security.logAllCommands}
                                    onChange={(e) => setConfig({...config, security: {...config.security, logAllCommands: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('log_all_commands') || 'Log All Commands'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.security.encryptSensitiveData}
                                    onChange={(e) => setConfig({...config, security: {...config.security, encryptSensitiveData: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('encrypt_sensitive_data') || 'Encrypt Sensitive Data'}</label>
                            </div>
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('session_timeout') || 'Session Timeout'} (minutes)</label>
                                <input
                                    type="number"
                                    value={config.security.sessionTimeout}
                                    onChange={(e) => setConfig({...config, security: {...config.security, sessionTimeout: parseInt(e.target.value) || 30}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="5"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Monitoring Settings */}
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('monitoring_settings') || 'Monitoring Settings'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">{t('health_check_interval') || 'Health Check Interval'} (minutes)</label>
                                <input
                                    type="number"
                                    value={config.monitoring.healthCheckInterval}
                                    onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, healthCheckInterval: parseInt(e.target.value) || 5}})}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    min="1"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertOnError}
                                    onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertOnError: e.target.checked}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('alert_on_error') || 'Alert on Error'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertChannels.dashboard}
                                    onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, dashboard: e.target.checked}}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('dashboard_alerts') || 'Dashboard Alerts'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertChannels.telegram}
                                    onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, telegram: e.target.checked}}})}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('telegram_alerts') || 'Telegram Alerts'}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

