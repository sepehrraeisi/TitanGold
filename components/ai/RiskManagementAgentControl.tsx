import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { useIsMounted } from '../../hooks/useMemoryLeakFree.ts';
import type {
    AIAgent,
    RiskAssessment,
    RiskManagementConfig,
    RiskManagementMetrics,
    RiskRule,
} from '../../types.ts';

type RiskTab =
    | 'overview'
    | 'portfolio'
    | 'riskChart'
    | 'positions'
    | 'alerts'
    | 'performance'
    | 'settings';

const TAB_ITEMS: Array<{ id: RiskTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'portfolio', labelKey: 'tab_portfolio_exposure' },
    { id: 'riskChart', labelKey: 'tab_risk_chart' },
    { id: 'positions', labelKey: 'tab_positions' },
    { id: 'alerts', labelKey: 'tab_alerts_limits' },
    { id: 'performance', labelKey: 'tab_performance_analysis' },
    { id: 'settings', labelKey: 'tab_settings' },
];

interface RiskManagementAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (updated: AIAgent) => void;
}

const RiskManagementAgentControl: React.FC<RiskManagementAgentControlProps> = ({
    agent,
    onClose,
    onUpdate,
}) => {
    const { t } = useLanguage();
    const isMountedRef = useIsMounted(); // FRONTEND-009: Track mounted state
    const [activeTab, setActiveTab] = useState<RiskTab>('overview');
    const [config, setConfig] = useState<RiskManagementConfig | null>(agent.riskManagementConfig ?? null);
    const [metrics, setMetrics] = useState<RiskManagementMetrics | null>(agent.riskMetrics ?? null);
    const [lastAssessment, setLastAssessment] = useState<RiskAssessment | null>(agent.lastRiskAssessment ?? null);
    const [isBusy, setIsBusy] = useState(false);
    const [isAssessing, setIsAssessing] = useState(false);

    // FRONTEND-009: Memory leak fix - Add cleanup
    useEffect(() => {
        let isCancelled = false;

        if (!config && agent.id === '2' && !isCancelled && isMountedRef.current) {
            setConfig(createDefaultConfig());
        }
        
        const loadData = async () => {
            if (isCancelled || !isMountedRef.current) return;
            if (isMountedRef.current) setIsBusy(true);
            try {
                const snapshot = await api.fetchRiskManagementAgentData(agent.id);
                if (!isCancelled && isMountedRef.current) {
                    if (snapshot.config) setConfig(snapshot.config);
                    if (snapshot.metrics) setMetrics(snapshot.metrics);
                    if (snapshot.lastAssessment) setLastAssessment(snapshot.lastAssessment);
                }
            } catch (error) {
                if (isMountedRef.current) {
                    console.error('Risk agent snapshot failed:', error);
                }
            } finally {
                if (isMountedRef.current) setIsBusy(false);
            }
        };
        
        loadData();

        return () => {
            isCancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent.id]);

    // FRONTEND-009: Safe async - check mounted before setState
    const loadAgentSnapshot = async () => {
        if (!isMountedRef.current) return;
        if (isMountedRef.current) setIsBusy(true);
        try {
            const snapshot = await api.fetchRiskManagementAgentData(agent.id);
            if (isMountedRef.current) {
                if (snapshot.config) setConfig(snapshot.config);
                if (snapshot.metrics) setMetrics(snapshot.metrics);
                if (snapshot.lastAssessment) setLastAssessment(snapshot.lastAssessment);
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Risk agent snapshot failed:', error);
            }
        } finally {
            if (isMountedRef.current) setIsBusy(false);
        }
    };

    const handleRunAssessment = async () => {
        if (!isMountedRef.current) return;
        if (isMountedRef.current) setIsAssessing(true);
        try {
            const result = await api.runRiskAssessment(agent.id);
            if (isMountedRef.current) setLastAssessment(result);
            await loadAgentSnapshot();
            const updatedAgents = await api.fetchAIAgents();
            const refreshed = updatedAgents.find(item => item.id === agent.id);
            if (refreshed && isMountedRef.current) {
                onUpdate(refreshed);
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Risk assessment failed:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                alert((t('assessment_failed') || 'Risk assessment failed') + (errorMessage ? `: ${errorMessage}` : ''));
            }
        } finally {
            if (isMountedRef.current) setIsAssessing(false);
        }
    };

    const handleUpdateConfig = async (updated: RiskManagementConfig) => {
        if (!isMountedRef.current) return;
        if (isMountedRef.current) setIsBusy(true);
        try {
            await api.updateRiskManagementConfig(agent.id, updated);
            if (isMountedRef.current) {
                setConfig(updated);
                alert(t('config_updated') || 'Configuration updated successfully');
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Update config failed:', error);
                alert(t('update_failed') || 'Failed to update configuration');
            }
        } finally {
            if (isMountedRef.current) setIsBusy(false);
        }
    };

    const handleCommand = async (command: string) => {
        if (!isMountedRef.current) return;
        if (isMountedRef.current) setIsBusy(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const updatedAgents = await api.fetchAIAgents();
            const refreshed = updatedAgents.find(item => item.id === agent.id);
            if (refreshed && isMountedRef.current) {
                onUpdate(refreshed);
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Command failed:', error);
                alert(t('command_failed') || 'Command failed');
            }
        } finally {
            if (isMountedRef.current) setIsBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <Header
                    agent={agent}
                    t={t}
                    isAssessing={isAssessing}
                    onRunAssessment={handleRunAssessment}
                    onClose={onClose}
                />
                <StatusBar agent={agent} metrics={metrics} t={t} onCommand={handleCommand} isBusy={isBusy} />

                <div className="border-b border-gray-800">
                    <nav className="flex flex-wrap gap-4 px-6">
                        {TAB_ITEMS.map(tab => {
                            const translation = t(tab.labelKey);
                            const label = (translation && translation !== tab.labelKey) 
                                ? translation 
                                : tab.labelKey.replace('tab_', '').replace(/_/g, ' ');
                            return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-red-500 text-red-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                    {label}
                            </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <OverviewTab agent={agent} metrics={metrics} lastAssessment={lastAssessment} />
                    )}
                    {activeTab === 'portfolio' && <PortfolioExposureTab metrics={metrics} />}
                    {activeTab === 'riskChart' && <RiskChartTab metrics={metrics} />}
                    {activeTab === 'positions' && (
                        <PositionsTab metrics={metrics} config={config} assessment={lastAssessment} />
                    )}
                    {activeTab === 'alerts' && (
                        <AlertsTab
                            metrics={metrics}
                            config={config}
                            onRunAssessment={handleRunAssessment}
                            isAssessing={isAssessing}
                        />
                    )}
                    {activeTab === 'performance' && (
                        <PerformanceTab metrics={metrics} agent={agent} />
                    )}
                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} onUpdate={handleUpdateConfig} />
                    )}
                </div>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------- //
// Tabs
// ----------------------------------------------------------------------------- //

const OverviewTab: React.FC<{
    agent: AIAgent;
    metrics: RiskManagementMetrics | null;
    lastAssessment: RiskAssessment | null;
}> = ({ agent, metrics, lastAssessment }) => {
    const { t } = useLanguage();
    const limitUsage = metrics?.riskLimitUsage ?? [];
    const heatmap = metrics?.riskHeatmap ?? [];
    const activeAlerts = metrics?.alerts?.filter(alert => !alert.acknowledged).length ?? 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label={t('total_assessments') || 'Assessments'} value={metrics?.totalAssessments ?? 0} icon="📊" />
                <StatCard label={t('risks_blocked') || 'Risks Blocked'} value={metrics?.risksBlocked ?? 0} icon="🛡️" />
                <StatCard label={t('active_risk_alerts') || 'Alerts'} value={activeAlerts} icon="⚠️" />
                <StatCard
                    label={t('portfolio_protection') || 'Protection'}
                    value={`${(metrics?.portfolioProtectionRate ?? 0).toFixed(1)}%`}
                    icon="✅"
                />
            </div>

            {limitUsage.length > 0 && (
                <SectionCard title={t('risk_limit_usage') || 'Risk Limit Usage'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {limitUsage.map(limit => {
                            const utilization = Math.min(100, (limit.usedPercent / Math.max(limit.limitPercent, 1)) * 100);
                            return (
                                <div key={limit.window} className="p-4 rounded-lg bg-gray-800/40 border border-gray-700 text-sm text-gray-300">
                                    <div className="flex justify-between mb-2">
                                        <span>{t(`${limit.window}_window`) || limit.window.toUpperCase()}</span>
                                        <span>{limit.usedPercent}% / {limit.limitPercent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-900 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${utilization > 90 ? 'bg-red-500' : utilization > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${utilization}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">{t('reset_at') || 'Reset'}: {new Date(limit.resetAt).toLocaleTimeString()}</p>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            )}

            {lastAssessment && (
                <SectionCard title={t('last_assessment') || 'Last Assessment'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <MetricTile label={t('portfolio_risk') || 'Portfolio'} value={lastAssessment.portfolioRisk.toFixed(1)} accent="bg-red-500/20 text-red-300" />
                        <MetricTile label={t('current_drawdown') || 'Drawdown'} value={`${lastAssessment.riskMetrics.currentDrawdown.toFixed(2)}%`} accent="bg-yellow-500/20 text-yellow-300" />
                        <MetricTile label={t('daily_pnl') || 'Daily P&L'} value={`${lastAssessment.riskMetrics.dailyPnL >= 0 ? '+' : ''}${lastAssessment.riskMetrics.dailyPnL.toFixed(2)}%`} accent="bg-green-500/20 text-green-300" />
                    </div>
                    {lastAssessment.recommendations.length > 0 && (
                        <div className="space-y-2">
                            {lastAssessment.recommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                                    <RiskBadge level={rec.priority === 'critical' ? 'critical' : rec.priority === 'high' ? 'high' : 'medium'} />
                                    <p className="flex-1 ml-3 text-sm text-white">{rec.reason}</p>
                                    <span className="text-xs text-gray-400 uppercase">{t(rec.action) || rec.action}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}

            {heatmap.length > 0 && (
                <SectionCard title={t('risk_heatmap') || 'Risk Heatmap'}>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {heatmap.map(cell => (
                            <div key={cell.timeframe} className="p-3 bg-gray-800/50 rounded-md border border-gray-700 text-center">
                                <p className="text-sm text-gray-400 mb-1">{cell.timeframe}</p>
                                <p className="text-2xl font-semibold text-white">{cell.riskScore.toFixed(0)}</p>
                                <RiskBadge level={cell.riskLabel} />
                                <p className="text-xs text-gray-500 mt-1">{t(cell.context) || cell.context}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Agent Capabilities */}
            <CapabilitiesSection agent={agent} />
        </div>
    );
};

const PortfolioExposureTab: React.FC<{ metrics: RiskManagementMetrics | null }> = ({ metrics }) => {
    const { t } = useLanguage();
    const exposures = metrics?.exposureBreakdown ?? [];
    const diversification = metrics?.diversification;
    const correlation = metrics?.correlationMatrix;

    return (
        <div className="space-y-6">
            <SectionCard title={t('exposure_breakdown') || 'Exposure Breakdown'}>
                {exposures.length === 0 ? (
                    <EmptyState message={t('no_risk_exposure_data') || 'No exposure data available'} />
                ) : (
                    <div className="space-y-3">
                        {exposures.map(asset => (
                            <div key={asset.asset} className="flex items-center gap-4 bg-gray-800/40 border border-gray-800 rounded-lg p-3">
                                <div className="flex-1">
                                    <p className="text-white font-semibold">{asset.asset}</p>
                                    <p className="text-xs text-gray-400">{t('pnl_percent') || 'PnL'}: {asset.pnlPercent.toFixed(2)}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-semibold">{asset.exposurePercent.toFixed(1)}%</p>
                                    <p className="text-xs text-gray-400">{t('leverage') || 'Leverage'}: {asset.leverage.toFixed(2)}x</p>
                                </div>
                                <RiskBadge level={asset.riskLevel} />
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title={t('portfolio_diversification') || 'Diversification'}>
                    {diversification ? (
                        <div className="space-y-2 text-sm text-gray-300">
                            <DetailRow label={t('diversification_score') || 'Score'} value={`${diversification.diversificationScore.toFixed(1)} / 100`} />
                            <DetailRow label="HHI" value={diversification.herfindahlIndex.toFixed(2)} />
                            <DetailRow label="Gini" value={diversification.giniCoefficient.toFixed(2)} />
                            <DetailRow label={t('largest_allocation') || 'Largest'} value={`${diversification.largestAssetPercent.toFixed(1)}%`} />
                            <div>
                                <p className="text-xs uppercase text-gray-400 mb-1">{t('sectors') || 'Sectors'}</p>
                                <div className="space-y-1">
                                    {diversification.sectors.map(sector => (
                                        <div key={sector.name} className="flex items-center justify-between text-xs">
                                            <span className="text-gray-300">{sector.name}</span>
                                            <span className="text-white font-semibold">{sector.percent.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <EmptyState message={t('no_risk_metrics') || 'Metrics unavailable'} />
                    )}
                </SectionCard>

                <SectionCard title={t('correlation_matrix') || 'Correlation Matrix'}>
                    {correlation && correlation.assets.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-gray-300">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-left">{t('asset') || 'Asset'}</th>
                                        {correlation.assets.map(asset => (
                                            <th key={asset} className="p-2 text-center">{asset}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {correlation.assets.map((asset, rowIdx) => (
                                        <tr key={asset} className="border-t border-gray-800">
                                            <td className="p-2 text-gray-400">{asset}</td>
                                            {correlation.values[rowIdx].map((value, colIdx) => (
                                                <td key={`${asset}-${correlation.assets[colIdx]}`} className="p-2 text-center text-white">
                                                    {value.toFixed(2)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message={t('no_risk_metrics') || 'Metrics unavailable'} />
                    )}
                </SectionCard>
            </div>
        </div>
    );
};

const RiskChartTab: React.FC<{ metrics: RiskManagementMetrics | null }> = ({ metrics }) => {
    const { t } = useLanguage();
    const drawdowns = metrics?.drawdownHistory ?? [];
    const sizing = metrics?.positionSizingInsights;
    const limitUsage = metrics?.riskLimitUsage ?? [];

    return (
        <div className="space-y-6">
            <SectionCard title={t('drawdown_trend') || 'Drawdown Trend'}>
                {drawdowns.length === 0 ? (
                    <EmptyState message={t('no_risk_metrics') || 'Metrics unavailable'} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {drawdowns.slice(-12).map(point => (
                            <div key={point.timestamp} className="flex items-center justify-between bg-gray-800/40 rounded-lg p-3">
                                <span className="text-sm text-gray-400">{new Date(point.timestamp).toLocaleString()}</span>
                                <span className="text-white font-semibold">{point.value.toFixed(2)}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {limitUsage.length > 0 && (
                <SectionCard title={t('risk_limit_windows') || 'Risk Limit Windows'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {limitUsage.map(window => (
                            <div key={window.window} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-sm">
                                <p className="text-gray-400">{t(`${window.window}_window`) || window.window}</p>
                                <p className="text-white text-lg font-semibold mt-1">
                                    {Math.max(window.limitPercent - window.usedPercent, 0).toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-500">{t('remaining') || 'Remaining'}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {sizing && (
                <SectionCard title={t('position_sizing_insights') || 'Position Sizing'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricTile label={t('recommended_size') || 'Recommended Size'} value={`${sizing.recommendedSizePercent.toFixed(1)}%`} />
                        <MetricTile label={t('current_exposure') || 'High-Risk Exposure'} value={`${sizing.currentExposurePercent.toFixed(1)}%`} />
                        <MetricTile label={t('signals_pending') || 'Signals Pending'} value={sizing.signalsAwaitingAdjustment.toString()} />
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

const PositionsTab: React.FC<{
    metrics: RiskManagementMetrics | null;
    config: RiskManagementConfig | null;
    assessment: RiskAssessment | null;
}> = ({ metrics, config, assessment }) => {
    const { t } = useLanguage();
    const positions = metrics?.openPositions ?? [];
    const positionRisks = assessment?.positionRisks ?? [];

    return (
        <div className="space-y-6">
            <SectionCard title={t('open_positions') || 'Open Positions'}>
                {positions.length === 0 ? (
                    <EmptyState message={t('no_positions') || 'No active positions'} />
                ) : (
                    <div className="space-y-3">
                        {positions.map(position => (
                            <div key={position.symbol} className="bg-gray-800/40 rounded-lg p-3 border border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-semibold">{position.symbol}</p>
                                        <p className="text-xs text-gray-400">{t('recommended_action') || 'Action'}: {t(position.recommendedAction) || position.recommendedAction}</p>
                                    </div>
                                    <RiskBadge level={position.riskLevel} />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-300 mt-3">
                                    <DetailRow label={t('exposure_percent') || 'Exposure'} value={`${position.sizePercent.toFixed(1)}%`} />
                                    <DetailRow label={t('leverage') || 'Leverage'} value={`${position.leverage.toFixed(2)}x`} />
                                    <DetailRow label={t('pnl_percent') || 'PnL'} value={`${position.pnlPercent.toFixed(2)}%`} />
                                    <DetailRow label={t('confidence_score') || 'Confidence'} value={`${position.confidence.toFixed(1)}%`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {positionRisks.length > 0 && (
                <SectionCard title={t('position_risks') || 'Position Risks'}>
                    <div className="space-y-2">
                        {positionRisks.map(pos => (
                            <div key={pos.symbol} className="flex items-center justify-between bg-gray-800/40 rounded-lg p-3 border border-gray-700">
                                <div>
                                    <p className="text-white font-semibold">{pos.symbol}</p>
                                    <p className="text-xs text-gray-400">{pos.reasons.join(', ')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-semibold">{pos.riskScore.toFixed(1)}</p>
                                    <RiskBadge level={pos.riskLevel} />
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {config && (
                <SectionCard title={t('sizing_profile') || 'Sizing Profile'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                        <DetailRow label={t('position_sizing_mode') || 'Mode'} value={t(config.positionSizingMode) || config.positionSizingMode} />
                        <DetailRow label={t('min_risk_reward') || 'Min R/R'} value={`${config.minRiskRewardRatio.toFixed(1)}x`} />
                        <DetailRow label={t('stop_loss') || 'Stop Loss'} value={`${config.stopLossPercentage.toFixed(1)}%`} />
                        <DetailRow label={t('take_profit') || 'Take Profit'} value={`${config.takeProfitPercentage.toFixed(1)}%`} />
                        <DetailRow label={t('trailing_stop') || 'Trailing Stop'} value={config.trailingStop.enabled ? `${config.trailingStop.distancePercent.toFixed(1)}%` : t('disabled') || 'Disabled'} />
                        <DetailRow label={t('allowed_assets') || 'Allowed Assets'} value={config.allowedAssets.join(', ')} />
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

const AlertsTab: React.FC<{
    metrics: RiskManagementMetrics | null;
    config: RiskManagementConfig | null;
    onRunAssessment: () => void;
    isAssessing: boolean;
}> = ({ metrics, config, onRunAssessment, isAssessing }) => {
    const { t } = useLanguage();
    const alerts = metrics?.alerts ?? [];
    const breaches = metrics?.limitBreaches ?? [];

    return (
        <div className="space-y-6">
            <SectionCard
                title={t('risk_alert_center') || 'Risk Alert Center'}
                actions={
                    <button
                        onClick={onRunAssessment}
                        disabled={isAssessing}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md disabled:opacity-50"
                    >
                        {isAssessing ? t('assessing') : t('run_assessment')}
                    </button>
                }
            >
                {alerts.length === 0 ? (
                    <EmptyState message={t('no_alerts') || 'No active alerts'} />
                ) : (
                    <div className="space-y-2">
                        {alerts.map(alert => (
                            <div key={alert.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg p-3 border border-gray-700 text-sm text-gray-300">
                                <div>
                                    <p className="text-white font-semibold">{alert.title}</p>
                                    <p className="text-xs text-gray-400">{alert.message}</p>
                                </div>
                                <RiskBadge level={alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'high' : 'medium'} />
                                <span className="text-xs text-gray-500 ml-3">{new Date(alert.occurredAt).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <SectionCard title={t('limit_breaches') || 'Limit Breaches'}>
                {breaches.length === 0 ? (
                    <EmptyState message={t('no_limit_breaches') || 'No breaches recorded'} />
                ) : (
                    <div className="space-y-2 text-sm text-gray-300">
                        {breaches.map(breach => (
                            <div key={breach.id} className="bg-gray-800/40 rounded-lg p-3 border border-gray-700">
                                <div className="flex items-center justify-between">
                                    <p className="text-white font-semibold">{breach.description}</p>
                                    <RiskBadge level={breach.severity === 'critical' ? 'critical' : 'high'} />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{new Date(breach.triggeredAt).toLocaleString()} · {t('action_taken') || 'Action'}: {t(breach.actionTaken) || breach.actionTaken}</p>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {config && (
                <SectionCard title={t('alert_channels') || 'Alert Channels'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                        <DetailRow label="Dashboard" value={config.alerting.channels.dashboard ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'} />
                        <DetailRow label="Email" value={config.alerting.channels.email ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'} />
                        <DetailRow label="Telegram" value={config.alerting.channels.telegram ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'} />
                        <DetailRow label={t('alert_sensitivity') || 'Sensitivity'} value={t(config.alerting.sensitivity) || config.alerting.sensitivity} />
                        <DetailRow label={t('smart_close_enabled') || 'Smart Close'} value={config.alerting.smartCloseEnabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'} />
                        <DetailRow label={t('notify_on_auto_close') || 'Notify on Auto Close'} value={config.alerting.notifyOnAutoClose ? t('yes') || 'Yes' : t('no') || 'No'} />
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

const PerformanceTab: React.FC<{ metrics: RiskManagementMetrics | null; agent: AIAgent }> = ({ metrics, agent }) => {
    const { t } = useLanguage();
    if (!metrics) {
        return <EmptyState message={t('no_performance_data') || 'No performance data available'} />;
    }

    return (
        <div className="space-y-6">
            <SectionCard title={t('performance_summary') || 'Performance Summary'}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricTile label="Sharpe" value={metrics.performanceSummary.sharpe.toFixed(2)} />
                    <MetricTile label="Sortino" value={metrics.performanceSummary.sortino.toFixed(2)} />
                    <MetricTile label={t('max_drawdown') || 'Max Drawdown'} value={`${metrics.performanceSummary.maxDrawdown.toFixed(1)}%`} />
                    <MetricTile label={t('avg_risk_reward') || 'Avg R/R'} value={`${metrics.performanceSummary.avgRiskReward.toFixed(2)}x`} />
                </div>
            </SectionCard>

            <SectionCard title={t('recent_performance') || 'Recent Performance'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                    <DetailRow label={t('last_24h') || 'Last 24h'} value={`${metrics.recentPerformance.last24h.assessments} / ${metrics.recentPerformance.last24h.risksBlocked}`} />
                    <DetailRow label={t('last_7d') || 'Last 7d'} value={`${metrics.recentPerformance.last7d.assessments} / ${metrics.recentPerformance.last7d.risksBlocked}`} />
                    <DetailRow label={t('last_30d') || 'Last 30d'} value={`${metrics.recentPerformance.last30d.assessments} / ${metrics.recentPerformance.last30d.risksBlocked}`} />
                </div>
            </SectionCard>

            <SectionCard title={t('learning_metrics') || 'Learning Metrics'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                    <DetailRow label={t('mistakes_learned') || 'Mistakes Learned'} value={`${metrics.learningMetrics.mistakesLearned}`} />
                    <DetailRow label={t('predictions_improved') || 'Predictions Improved'} value={`${metrics.learningMetrics.predictionsImproved}`} />
                    <DetailRow label={t('accuracy_gain') || 'Accuracy Gain'} value={`${metrics.learningMetrics.accuracyGain.toFixed(2)}%`} />
                </div>
            </SectionCard>
        </div>
    );
};

const SettingsTab: React.FC<{ config: RiskManagementConfig; onUpdate: (config: RiskManagementConfig) => void }> = ({
    config,
    onUpdate,
}) => {
    const { t } = useLanguage();

    const handleRuleToggle = (ruleId: string) => {
        const updatedRules = config.enabledRiskRules.map(rule =>
            rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule,
        );
        onUpdate({ ...config, enabledRiskRules: updatedRules });
    };

    const handleAutoAdjustmentToggle = (key: keyof RiskManagementConfig['autoAdjustment']) => {
        onUpdate({
            ...config,
            autoAdjustment: {
                ...config.autoAdjustment,
                [key]: !config.autoAdjustment[key],
            },
        });
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('risk_limits') || 'Risk Limits'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberField label={t('max_position_size') || 'Max Position'} value={config.maxPositionSize} onChange={value => onUpdate({ ...config, maxPositionSize: value })} />
                    <NumberField label={t('risk_per_trade') || 'Risk / Trade'} value={config.riskPerTrade} onChange={value => onUpdate({ ...config, riskPerTrade: value })} />
                    <NumberField label={t('max_daily_loss') || 'Max Daily Loss'} value={config.maxDailyLoss} onChange={value => onUpdate({ ...config, maxDailyLoss: value })} />
                    <NumberField label={t('max_weekly_loss') || 'Max Weekly Loss'} value={config.maxWeeklyLoss} onChange={value => onUpdate({ ...config, maxWeeklyLoss: value })} />
                    <NumberField label={t('max_monthly_loss') || 'Max Monthly Loss'} value={config.maxMonthlyLoss} onChange={value => onUpdate({ ...config, maxMonthlyLoss: value })} />
                    <NumberField label={t('max_drawdown') || 'Max Drawdown'} value={config.maxDrawdown} onChange={value => onUpdate({ ...config, maxDrawdown: value })} />
                </div>
            </SectionCard>

            <SectionCard title={t('risk_rules') || 'Risk Rules'}>
                {config.enabledRiskRules.length === 0 ? (
                    <EmptyState message={t('no_risk_rules') || 'No risk rules configured'} />
                ) : (
                    <div className="space-y-2">
                        {config.enabledRiskRules.map(rule => (
                            <label key={rule.id} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm text-gray-300">
                                <div>
                                    <p className="text-white font-semibold">{rule.name}</p>
                                    <p className="text-xs text-gray-400">{rule.condition}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={() => handleRuleToggle(rule.id)}
                                    className="h-4 w-4 rounded"
                                />
                            </label>
                        ))}
                    </div>
                )}
            </SectionCard>

            <SectionCard title={t('auto_adjustment') || 'Auto Adjustment'}>
                <div className="space-y-3">
                    {(['enabled', 'learningMode', 'adjustBasedOnPerformance', 'adjustBasedOnMarketConditions'] as const).map(key => (
                        <div key={key} className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm text-gray-300">
                            <div>
                                <p className="text-white font-semibold">{t(key) || key}</p>
                                <p className="text-xs text-gray-400">{t(`${key}_desc`) || ''}</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.autoAdjustment[key]}
                                onChange={() => handleAutoAdjustmentToggle(key)}
                                className="h-4 w-4 rounded"
                            />
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const RISK_CAPABILITY_KEYS = [
    'risk_capability_control_limits',
    'risk_capability_position_sizing',
    'risk_capability_drawdown_monitoring',
    'risk_capability_exposure_management',
    'risk_capability_real_time_alerts',
    'risk_capability_stop_management',
    'risk_capability_diversification',
    'risk_capability_agent_coordination',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isRiskAgent = agent.id === '2' || agent.role === 'Risk Management';
    const capabilityItems = isRiskAgent
        ? RISK_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('risk_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isRiskAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------------- //
// UI helpers
// ----------------------------------------------------------------------------- //

const Header = ({
    agent,
    t,
    isAssessing,
    onRunAssessment,
    onClose,
}: {
    agent: AIAgent;
    t: ReturnType<typeof useLanguage>['t'];
    isAssessing: boolean;
    onRunAssessment: () => void;
    onClose: () => void;
}) => (
    <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex justify-between items-center z-10">
        <div>
            <h2 className="text-2xl font-bold text-white">{agent.name} - {t('risk_management')}</h2>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunAssessment}
                disabled={isAssessing || agent.status !== 'active'}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isAssessing ? t('assessing') : t('run_assessment')}
            </button>
            <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar = ({
    agent,
    metrics,
    t,
    onCommand,
    isBusy,
}: {
    agent: AIAgent;
    metrics: RiskManagementMetrics | null;
    t: ReturnType<typeof useLanguage>['t'];
    onCommand: (command: string) => void;
    isBusy: boolean;
}) => (
    <div className="bg-gray-900/50 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    agent.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                }`}>
                    {t(agent.status)}
                </span>
                <span className="text-sm text-gray-400">
                    {t('accuracy')}: <span className="text-white font-semibold">{agent.accuracy.toFixed(1)}%</span>
                </span>
                {metrics && (
                    <span className="text-sm text-gray-400">
                        {t('portfolio_protection')}: <span className="text-white font-semibold">{metrics.portfolioProtectionRate.toFixed(1)}%</span>
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => onCommand(agent.status === 'active' ? 'pause' : 'start')}
                    disabled={isBusy}
                    className={`text-xs font-semibold py-1.5 px-3 rounded-md text-white ${
                        agent.status === 'active' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                    } disabled:opacity-50`}
                >
                    {agent.status === 'active' ? t('pause') : t('start')}
                </button>
                <button
                    onClick={() => onCommand('restart')}
                    disabled={isBusy}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md disabled:opacity-50"
                >
                    {t('restart')}
                </button>
            </div>
        </div>
    </div>
);

const SectionCard: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({
    title,
    actions,
    children,
}) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">{title}</h3>
            {actions}
        </div>
        {children}
    </div>
);

const StatCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-2xl font-semibold text-white mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
    </div>
);

const MetricTile: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
    <div className={`rounded-lg p-4 border border-gray-800 bg-gray-800/40 ${accent ?? ''}`}>
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-white mt-1">{value}</p>
    </div>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-semibold">{value}</span>
    </div>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({
    label,
    value,
    onChange,
}) => (
    <div>
        <label className="block text-sm text-gray-400 mb-2">{label}</label>
        <input
            type="number"
            value={Number.isFinite(value) ? value : 0}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
    </div>
);

const TextareaField: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({
    label,
    value,
    onChange,
}) => (
    <div>
        <label className="block text-sm text-gray-400 mb-2">{label}</label>
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
        />
    </div>
);

const RiskBadge: React.FC<{ level: 'low' | 'medium' | 'high' | 'critical' }> = ({ level }) => {
    const colors: Record<typeof level, string> = {
        low: 'bg-green-500/20 text-green-300',
        medium: 'bg-yellow-500/20 text-yellow-300',
        high: 'bg-orange-500/20 text-orange-300',
        critical: 'bg-red-500/20 text-red-300',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[level]}`}>{level.toUpperCase()}</span>;
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-sm text-gray-500 py-6 border border-dashed border-gray-700 rounded-lg bg-gray-900/40">
        {message}
    </div>
);

const createDefaultConfig = (): RiskManagementConfig => ({
    maxPositionSize: 20,
    maxDailyLoss: 5,
    maxWeeklyLoss: 12,
    maxMonthlyLoss: 20,
    maxDrawdown: 15,
    stopLossPercentage: 2,
    takeProfitPercentage: 4,
    riskPerTrade: 1,
    minRiskRewardRatio: 2,
    maxOpenPositions: 10,
    leverageLimit: 3,
    correlationLimit: 0.7,
    volatilityThreshold: 50,
    positionSizingMode: 'percent',
    fixedPositionSize: 2,
    trailingStop: {
        enabled: true,
        distancePercent: 1.2,
        activationPercent: 1.8,
        cooldownMinutes: 15,
    },
    diversificationSettings: {
        maxPerAssetPercent: 30,
        maxPerSectorPercent: 45,
        minAssets: 6,
        rebalanceFrequency: 'weekly',
    },
    exposureControls: {
        perAsset: 30,
        perSector: 45,
        derivativesRatio: 40,
        stableReservePercent: 15,
    },
    allowedAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'OPUSDT', 'ARBUSDT'],
    restrictedAssets: ['MEMEUSDT'],
    alerting: {
        sensitivity: 'medium',
        channels: {
            dashboard: true,
            email: true,
            telegram: true,
        },
        smartCloseEnabled: true,
        notifyOnAutoClose: true,
    },
    integrationSettings: {
        syncWithTechnical: true,
        syncWithTiming: true,
        syncWithVolume: true,
        enforceLimitsInExecution: true,
        autoHedge: false,
    },
    enabledRiskRules: [
        { id: 'max_position', name: 'Maximum Position Size', enabled: true, condition: 'positionSize > maxPositionSize', action: 'block', priority: 10, parameters: {} },
        { id: 'daily_loss', name: 'Daily Loss Limit', enabled: true, condition: 'dailyLoss > maxDailyLoss', action: 'block', priority: 9, parameters: {} },
        { id: 'drawdown', name: 'Maximum Drawdown', enabled: true, condition: 'drawdown > maxDrawdown', action: 'reduce', priority: 8, parameters: {} },
        { id: 'correlation', name: 'High Correlation', enabled: true, condition: 'correlation > correlationLimit', action: 'warn', priority: 7, parameters: {} },
    ],
    autoAdjustment: {
        enabled: true,
        learningMode: true,
        adjustBasedOnPerformance: true,
        adjustBasedOnMarketConditions: true,
    },
    notificationSettings: {
        onRiskLimit: true,
        onStopLoss: true,
        onTakeProfit: true,
        onHighRisk: true,
    },
    advancedSettings: {
        useMachineLearning: true,
        dynamicRiskAdjustment: true,
        portfolioHeatMap: true,
        realTimeMonitoring: true,
        stressTesting: true,
    },
    marketStressTests: {
        enableStressTests: true,
        varConfidence: 95,
    },
});

export default RiskManagementAgentControl;

