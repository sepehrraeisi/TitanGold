import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import { AgentRunButton } from './AgentRunButton.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    OrderManagementConfig,
    OrderManagementMetrics,
    OrderManagementResult,
    OrderRoute,
    OrderHistoryEntry,
    ExecutionAnalysisDetail,
    OrderAlertDetail,
} from '../../types.ts';

interface OrderManagementAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const OrderManagementAgentControl: React.FC<OrderManagementAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    type OrderTab = 'overview' | 'open_orders' | 'history' | 'execution_analysis' | 'settings' | 'alerts' | 'integration';
    const [activeTab, setActiveTab] = useState<OrderTab>('overview');
    const [config, setConfig] = useState<OrderManagementConfig | null>(agent.orderManagementConfig || null);
    const [metrics, setMetrics] = useState<OrderManagementMetrics | null>(agent.orderManagementMetrics || null);
    const [analysis, setAnalysis] = useState<OrderManagementResult | null>(agent.lastOrderManagementRun || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchOrderManagementAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastRun) setAnalysis(data.lastRun);
            } catch (error) {
                console.error('Failed to load order agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunCycle = async () => {
        if (!guardExecution()) return;
        setIsRunning(true);
        try {
            const result = await api.runOrderManagementCycle(agent.id);
            setAnalysis(result);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.orderManagementMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run order cycle:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: OrderManagementConfig) => {
        setIsLoading(true);
        try {
            await api.updateOrderManagementConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated');
        } catch (error) {
            console.error('Failed to update order config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const updatedAgents = await api.fetchAIAgents();
            const updatedAgent = updatedAgents.find(a => a.id === agent.id);
            if (updatedAgent) {
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const executions = useMemo(() => analysis?.executions ?? [], [analysis]);
    const openOrders = useMemo(() => analysis?.tickets.filter(t => t.status === 'open' || t.status === 'pending') ?? [], [analysis?.tickets]);
    const orderHistory = useMemo(() => analysis?.orderHistory ?? metrics?.orderHistory ?? [], [analysis?.orderHistory, metrics?.orderHistory]);
    const executionAnalysis = useMemo(() => analysis?.executionAnalysis ?? [], [analysis?.executionAnalysis]);
    const alertDetails = useMemo(() => analysis?.alertDetails ?? [], [analysis?.alertDetails]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#161B22] border-b border-gray-800 p-6 flex flex-wrap gap-4 justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {agent.name} - {t('order_agent') || 'Order Management'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('order_agent_desc') || 'Routes and supervises spot/perp orders on MEXC with adaptive learning.'}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <AgentRunButton
                            onRun={handleRunCycle}
                            running={isRunning}
                            label={t('run_cycle') || 'Run cycle'}
                            disabled={agent.status !== 'active'}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        />
                        <button
                            onClick={onClose}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900/50 border-b border-gray-800 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4 flex-wrap">
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
                            <span className="text-sm text-gray-400">
                                {t('decisions')}: <span className="text-white font-semibold">{agent.decisions.toLocaleString()}</span>
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {agent.status === 'active' ? (
                                <button
                                    onClick={() => handleControlCommand('pause')}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                                >
                                    {t('pause')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleControlCommand('start')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                                >
                                    {t('start')}
                                </button>
                            )}
                            <button
                                onClick={() => handleControlCommand('restart')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                            >
                                {t('restart')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-b border-gray-800">
                    <nav className="flex flex-wrap gap-4 px-6">
                        {([
                            { id: 'overview', key: 'tab_overview' },
                            { id: 'open_orders', key: 'tab_open_orders' },
                            { id: 'history', key: 'tab_order_history' },
                            { id: 'execution_analysis', key: 'tab_execution_analysis' },
                            { id: 'settings', key: 'tab_settings' },
                            { id: 'alerts', key: 'tab_alerts' },
                            { id: 'integration', key: 'tab_integration' },
                        ] as const).map(tab => {
                            const translation = t(tab.key);
                            const label = (translation && translation !== tab.key) 
                                ? translation 
                                : tab.key.replace('tab_', '').replace(/_/g, ' ');
                            return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as OrderTab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-emerald-500 text-emerald-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                    {label}
                            </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 300px)' }}>
                    {activeTab === 'overview' && analysis && metrics && (
                        <OrderOverview agent={agent} analysis={analysis} metrics={metrics} t={t} />
                    )}
                    {activeTab === 'open_orders' && <OpenOrdersTab orders={openOrders} executions={executions} t={t} />}
                    {activeTab === 'history' && <OrderHistoryTab history={orderHistory} t={t} />}
                    {activeTab === 'execution_analysis' && <ExecutionAnalysisTab analysis={executionAnalysis} t={t} />}
                    {activeTab === 'settings' && config && (
                        <OrderSettings config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}
                    {activeTab === 'alerts' && <AlertsTab alerts={alertDetails} t={t} />}
                    {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                    {!analysis && activeTab === 'overview' && (
                        <div className="text-center text-gray-400 py-10">
                            <p>{t('no_order_data') || 'No order management cycles have been executed yet.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const OrderOverview: React.FC<{ agent: AIAgent; analysis: OrderManagementResult; metrics: OrderManagementMetrics; t: (key: string) => string }> = ({ agent, analysis, metrics, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label={t('tickets_total') || 'Tickets'} value={analysis.summary.totalTickets} />
            <MetricCard label={t('tickets_filled') || 'Filled'} value={analysis.summary.filled} />
            <MetricCard label={t('execution_success_rate') || 'Success Rate'} value={`${analysis.summary.executionSuccessRate.toFixed(1)}%`} />
            <MetricCard label={t('avg_latency') || 'Avg latency'} value={`${analysis.summary.avgLatencyMs} ms`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={t('avg_slippage') || 'Avg slippage'} value={`${analysis.summary.avgSlippageBps} bps`} />
            <MetricCard label={t('runs_total') || 'Runs'} value={metrics.totalRuns} />
            <MetricCard label={t('fill_rate_avg') || 'Fill rate'} value={`${metrics.fillRate.toFixed(1)}%`} />
        </div>
        {analysis.orderTypeMix && (
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('order_type_mix') || 'Order Type Mix'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(analysis.orderTypeMix).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-sm text-gray-300 bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
                            <span>{type.toUpperCase()}</span>
                            <span className="text-white font-semibold">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
        {analysis.alerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-yellow-300">{t('recent_alerts') || 'Recent alerts'}</h3>
                <ul className="text-xs text-gray-200 space-y-1 list-disc pl-4">
                    {analysis.alerts.slice(0, 6).map((alert, index) => (
                        <li key={index}>{alert}</li>
                    ))}
                </ul>
            </div>
        )}

        {/* Agent Capabilities */}
        <CapabilitiesSection agent={agent} />
    </div>
);

const OpenOrdersTab: React.FC<{ orders: any[]; executions: any[]; t: (key: string) => string }> = ({ orders, executions, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('open_orders') || 'Open Orders'}</h3>
            {orders.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {orders.map(order => {
                        const exec = executions.find(e => e.ticketId === order.ticketId);
                        const timeRemaining = order.expiresAt ? Math.max(0, new Date(order.expiresAt).getTime() - Date.now()) : null;
                        return (
                            <div key={order.ticketId} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-white font-semibold">{order.symbol} · {order.route.toUpperCase()}</p>
                                        <p className="text-xs text-gray-500">{order.clientOrderId}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            order.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {t(order.side) || order.side}
                                        </span>
                                        <span className={`px-2 py-1 text-xs rounded ${
                                            order.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {t(order.status) || order.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500">{t('quantity') || 'Quantity'}</p>
                                        <p className="text-white font-semibold">{order.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('price') || 'Price'}</p>
                                        <p className="text-white font-semibold">${order.price?.toFixed(2) || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{t('type') || 'Type'}</p>
                                        <p className="text-white font-semibold">{order.type.toUpperCase()}</p>
                                    </div>
                                    {timeRemaining !== null && (
                                        <div>
                                            <p className="text-xs text-gray-500">{t('time_remaining') || 'Time Remaining'}</p>
                                            <p className="text-white font-semibold">{Math.floor(timeRemaining / 60000)}m</p>
                                        </div>
                                    )}
                                </div>
                                {order.allocation && (
                                    <div className="mt-3 text-xs text-gray-400">
                                        {t('order_allocation') || 'Allocation'}: {order.allocation.currentPart}/{order.allocation.totalParts} ({order.allocation.partSize})
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_open_orders') || 'No open orders.'}</p>
                </div>
            )}
        </div>
    </div>
);

const OrderHistoryTab: React.FC<{ history: OrderHistoryEntry[]; t: (key: string) => string }> = ({ history, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('order_history') || 'Order History'}</h3>
            {history.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {history.slice(-30).reverse().map(entry => (
                        <div key={entry.ticketId} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white font-semibold">{entry.symbol}</p>
                                    <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                        entry.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {t(entry.side) || entry.side}
                                    </span>
                                    <span className={`px-2 py-1 text-xs rounded ${
                                        entry.status === 'filled' ? 'bg-green-500/20 text-green-400' :
                                        entry.status === 'canceled' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                        {t(entry.status) || entry.status}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">{t('quantity') || 'Quantity'}</p>
                                    <p className="text-white font-semibold">{entry.quantity}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('price') || 'Price'}</p>
                                    <p className="text-white font-semibold">${entry.price?.toFixed(2) || '—'}</p>
                                </div>
                                {entry.executedPrice && (
                                    <div>
                                        <p className="text-xs text-gray-500">{t('executed_price') || 'Executed'}</p>
                                        <p className="text-white font-semibold">${entry.executedPrice.toFixed(2)}</p>
                                    </div>
                                )}
                                {entry.fillRate !== undefined && (
                                    <div>
                                        <p className="text-xs text-gray-500">{t('fill_rate') || 'Fill Rate'}</p>
                                        <p className="text-white font-semibold">{entry.fillRate.toFixed(1)}%</p>
                                    </div>
                                )}
                            </div>
                            {(entry.latencyMs || entry.slippageBps) && (
                                <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 mt-3">
                                    {entry.latencyMs && <p>{t('latency') || 'Latency'}: {entry.latencyMs}ms</p>}
                                    {entry.slippageBps && <p>{t('slippage') || 'Slippage'}: {entry.slippageBps.toFixed(2)} bps</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_order_history') || 'No order history available.'}</p>
                </div>
            )}
        </div>
    </div>
);

const ExecutionAnalysisTab: React.FC<{ analysis: ExecutionAnalysisDetail[]; t: (key: string) => string }> = ({ analysis, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('execution_analysis') || 'Execution Analysis'}</h3>
            {analysis.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {analysis.map(detail => (
                        <div key={detail.ticketId} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-white font-semibold">{detail.symbol}</p>
                                    <p className="text-xs text-gray-500">{detail.orderType.toUpperCase()} · {detail.route.toUpperCase()}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded ${
                                    detail.fillRate >= 100 ? 'bg-green-500/20 text-green-400' :
                                    detail.fillRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                    {detail.fillRate.toFixed(1)}% {t('filled') || 'filled'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">{t('fill_rate') || 'Fill Rate'}</p>
                                    <p className="text-white font-semibold">{detail.fillRate.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('latency') || 'Latency'}</p>
                                    <p className="text-white font-semibold">{detail.latencyMs}ms</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('slippage') || 'Slippage'}</p>
                                    <p className={`font-semibold ${detail.slippageBps > 20 ? 'text-red-400' : 'text-white'}`}>
                                        {detail.slippageBps.toFixed(2)} bps
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{t('execution_price') || 'Execution Price'}</p>
                                    <p className="text-white font-semibold">${detail.executionPrice.toFixed(2)}</p>
                                </div>
                            </div>
                            {detail.priceDifference !== undefined && (
                                <div className="mt-3 text-xs text-gray-400">
                                    {t('price_difference') || 'Price Difference'}: ${detail.priceDifference.toFixed(4)} ({detail.targetPrice ? ((detail.priceDifference / detail.targetPrice) * 100).toFixed(2) : '0'}%)
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_execution_analysis') || 'No execution analysis data available.'}</p>
                </div>
            )}
        </div>
    </div>
);

const AlertsTab: React.FC<{ alerts: OrderAlertDetail[]; t: (key: string) => string }> = ({ alerts, t }) => (
    <div className="space-y-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('alerts_management') || 'Alerts & Management'}</h3>
            {alerts.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                    {alerts.map(alert => (
                        <div key={alert.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        alert.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                        alert.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                                        'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                    }`}>
                                        {t(alert.severity) || alert.severity}
                                    </span>
                                    <span className="text-xs text-gray-500">{t(alert.type) || alert.type}</span>
                                </div>
                                <span className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                            {alert.symbol && (
                                <p className="text-xs text-gray-500">{t('symbol') || 'Symbol'}: {alert.symbol}</p>
                            )}
                            {alert.action && (
                                <div className="mt-3">
                                    <button className="px-3 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30">
                                        {t(alert.action) || alert.action}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-10">
                    <p>{t('no_alerts') || 'No alerts generated yet.'}</p>
                </div>
            )}
        </div>
    </div>
);

const IntegrationTab: React.FC<{ config: OrderManagementConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integrations = config.integrationSettings ?? {
        shareWithArtemis: true,
        syncWithSignals: true,
        syncWithRisk: true,
        syncWithLiquidity: true,
        syncWithAllocation: true,
        forwardToDashboard: true,
    };
    const channels = config.alertChannels ?? { dashboard: true, email: false, messenger: false };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('integration_settings') || 'Integration Settings'}</h3>
                <div className="space-y-3">
                    <IntegrationRow label={t('share_with_artemis') || 'Share with Artemis'} enabled={integrations.shareWithArtemis} />
                    <IntegrationRow label={t('sync_with_signals') || 'Sync with Signals'} enabled={integrations.syncWithSignals} />
                    <IntegrationRow label={t('sync_with_risk') || 'Sync with Risk'} enabled={integrations.syncWithRisk} />
                    <IntegrationRow label={t('sync_with_liquidity') || 'Sync with Liquidity'} enabled={integrations.syncWithLiquidity} />
                    <IntegrationRow label={t('sync_with_allocation') || 'Sync with Allocation'} enabled={integrations.syncWithAllocation} />
                    <IntegrationRow label={t('forward_to_dashboard') || 'Forward to Dashboard'} enabled={integrations.forwardToDashboard} />
                </div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t('alert_channels') || 'Alert Channels'}</h3>
                <div className="space-y-3">
                    <IntegrationRow label={t('dashboard') || 'Dashboard'} enabled={channels.dashboard} />
                    <IntegrationRow label={t('email') || 'Email'} enabled={channels.email} />
                    <IntegrationRow label={t('messenger') || 'Messenger'} enabled={channels.messenger} />
                </div>
            </div>
        </div>
    );
};

const IntegrationRow: React.FC<{ label: string; enabled?: boolean }> = ({ label, enabled }) => (
    <div className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <span className="text-sm text-white">{label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            enabled ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
            'bg-gray-700/40 text-gray-300 border border-gray-600/60'
        }`}>
            {enabled ? 'ON' : 'OFF'}
        </span>
    </div>
);


const OrderSettings: React.FC<{
    config: OrderManagementConfig;
    disabled: boolean;
    onUpdate: (config: OrderManagementConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const updateField = (field: keyof OrderManagementConfig, value: any) => {
        onUpdate({ ...config, [field]: value });
    };

    const updateExecution = (key: keyof OrderManagementConfig['execution'], value: number | boolean) => {
        updateField('execution', { ...config.execution, [key]: value });
    };

    const updateRisk = (key: keyof OrderManagementConfig['riskLimits'], value: number | boolean) => {
        updateField('riskLimits', { ...config.riskLimits, [key]: value });
    };

    return (
        <div className="space-y-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('tracked_symbols') || 'Tracked Symbols'}</h3>
                <textarea
                    rows={2}
                    disabled={disabled}
                    value={config.symbols.join(', ')}
                    onChange={(e) => updateField('symbols', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput label={t('max_concurrent_orders') || 'Max concurrent'} value={config.maxConcurrentOrders} disabled={disabled} onChange={value => updateField('maxConcurrentOrders', value)} />
                    <NumberInput label={t('max_notional_order') || 'Max notional'} value={config.maxNotionalPerOrder} onChange={value => updateField('maxNotionalPerOrder', value)} disabled={disabled} />
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('execution_settings') || 'Execution'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberInput label={t('timeout_ms') || 'Timeout (ms)'} value={config.execution.timeoutMs} disabled={disabled} onChange={value => updateExecution('timeoutMs', value)} />
                    <NumberInput label={t('retry_count') || 'Retry count'} value={config.execution.retryCount} disabled={disabled} onChange={value => updateExecution('retryCount', value)} />
                    <NumberInput label={t('max_slippage_bps') || 'Max slippage (bps)'} value={config.execution.maxSlippageBps} disabled={disabled} onChange={value => updateExecution('maxSlippageBps', value)} />
                    <NumberInput label={t('partial_fill_threshold') || 'Partial fill %'} value={config.execution.partialFillThreshold} step={0.05} disabled={disabled} onChange={value => updateExecution('partialFillThreshold', value)} />
                    <NumberInput label={t('slippage_tolerance') || 'Slippage Tolerance (bps)'} value={config.execution.slippageTolerance || 20} disabled={disabled} onChange={value => updateExecution('slippageTolerance', value)} />
                    <NumberInput label={t('max_order_size') || 'Max Order Size'} value={config.execution.maxOrderSize || 5000} disabled={disabled} onChange={value => updateExecution('maxOrderSize', value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <label className="flex items-center text-sm text-gray-300 gap-2">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={config.execution.autoOrderEnabled ?? true}
                            onChange={(e) => updateExecution('autoOrderEnabled', e.target.checked)}
                            className="w-4 h-4 accent-emerald-500"
                        />
                        {t('auto_order_enabled') || 'Auto Order Enabled'}
                    </label>
                    <label className="flex items-center text-sm text-gray-300 gap-2">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={config.execution.requireManualApproval ?? false}
                            onChange={(e) => updateExecution('requireManualApproval', e.target.checked)}
                            className="w-4 h-4 accent-emerald-500"
                        />
                        {t('require_manual_approval') || 'Require Manual Approval'}
                    </label>
                    <label className="flex items-center text-sm text-gray-300 gap-2">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={config.execution.orderSplittingEnabled ?? true}
                            onChange={(e) => updateExecution('orderSplittingEnabled', e.target.checked)}
                            className="w-4 h-4 accent-emerald-500"
                        />
                        {t('order_splitting_enabled') || 'Order Splitting Enabled'}
                    </label>
                </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">{t('risk_limits') || 'Risk limits'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberInput label={t('max_daily_volume') || 'Max daily volume'} value={config.riskLimits.maxDailyVolume} disabled={disabled} onChange={value => updateRisk('maxDailyVolume', value)} />
                    <NumberInput label={t('max_open_notional') || 'Max open notional'} value={config.riskLimits.maxOpenNotional} disabled={disabled} onChange={value => updateRisk('maxOpenNotional', value)} />
                    <label className="flex items-center text-sm text-gray-300 gap-2">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={config.riskLimits.cancelOnDisconnect}
                            onChange={(e) => updateRisk('cancelOnDisconnect', e.target.checked)}
                            className="w-4 h-4 accent-emerald-500"
                        />
                        {t('cancel_on_disconnect') || 'Cancel on disconnect'}
                    </label>
                </div>
            </div>

            {config.orderTypes && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{t('order_types') || 'Order Types'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(config.orderTypes).map(([type, enabled]) => (
                            <label key={type} className="flex items-center text-sm text-gray-300 gap-2">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={enabled}
                                    onChange={(e) => updateField('orderTypes', { ...config.orderTypes, [type]: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-500"
                                />
                                {t(`order_type_${type}`) || type.toUpperCase()}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {config.retryPolicy && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">{t('retry_policy') || 'Retry Policy'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center text-sm text-gray-300 gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={config.retryPolicy.enabled}
                                onChange={(e) => updateField('retryPolicy', { ...config.retryPolicy, enabled: e.target.checked })}
                                className="w-4 h-4 accent-emerald-500"
                            />
                            {t('retry_enabled') || 'Retry Enabled'}
                        </label>
                        <NumberInput label={t('max_retries') || 'Max Retries'} value={config.retryPolicy.maxRetries} disabled={disabled} onChange={value => updateField('retryPolicy', { ...config.retryPolicy, maxRetries: value })} />
                        <NumberInput label={t('retry_delay_ms') || 'Retry Delay (ms)'} value={config.retryPolicy.retryDelayMs} disabled={disabled} onChange={value => updateField('retryPolicy', { ...config.retryPolicy, retryDelayMs: value })} />
                        <label className="flex items-center text-sm text-gray-300 gap-2">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={config.retryPolicy.alertOnFailure}
                                onChange={(e) => updateField('retryPolicy', { ...config.retryPolicy, alertOnFailure: e.target.checked })}
                                className="w-4 h-4 accent-emerald-500"
                            />
                            {t('alert_on_failure') || 'Alert on Failure'}
                        </label>
                    </div>
                </div>
            )}

            {config.exchangeSettings && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">{t('exchange_settings') || 'Exchange Settings'}</h3>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('preferred_exchanges') || 'Preferred Exchanges'}</label>
                        <input
                            type="text"
                            disabled={disabled}
                            value={config.exchangeSettings.preferredExchanges.join(', ')}
                            onChange={(e) => updateField('exchangeSettings', { ...config.exchangeSettings, preferredExchanges: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{t('priority') || 'Priority'}</label>
                        <select
                            disabled={disabled}
                            value={config.exchangeSettings.priority}
                            onChange={(e) => updateField('exchangeSettings', { ...config.exchangeSettings, priority: e.target.value as 'speed' | 'cost' | 'reliability' })}
                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                        >
                            <option value="speed">{t('speed') || 'Speed'}</option>
                            <option value="cost">{t('cost') || 'Cost'}</option>
                            <option value="reliability">{t('reliability') || 'Reliability'}</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
};

const NumberInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    step?: number;
}> = ({ label, value, onChange, disabled, step }) => (
    <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            step={step ?? 1}
            value={value}
            disabled={disabled}
            onChange={(e) => {
                const parsed = e.target.value === '' ? 0 : parseFloat(e.target.value);
                onChange(Number.isNaN(parsed) ? 0 : parsed);
            }}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white text-xs"
        />
    </div>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const ORDER_CAPABILITY_KEYS = [
    'order_management_capability_routing',
    'order_management_capability_execution',
    'order_management_capability_splitting',
    'order_management_capability_monitoring',
    'order_management_capability_risk',
    'order_management_capability_learning',
    'order_management_capability_integration',
    'order_management_capability_alerts',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isOrderAgent = agent.id === '11' || agent.role === 'Order Management';
    const capabilityItems = isOrderAgent
        ? ORDER_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('order_management_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isOrderAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderManagementAgentControl;

