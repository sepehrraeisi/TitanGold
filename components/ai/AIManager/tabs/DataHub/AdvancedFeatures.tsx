
import React from 'react';
import { DataHubState, AIAgent } from '../../../../../types';
import WebCrawlerConfig from './advanced/WebCrawlerConfig';
import AutoDiscoveryConfig from './advanced/AutoDiscoveryConfig';
import SmartPrioritization from './advanced/SmartPrioritization';
import AccessControlPanel from './advanced/AccessControlPanel';
import BlacklistWhitelist from './advanced/BlacklistWhitelist';
import TelegramPublisher from './advanced/TelegramPublisher';
import AutomationTopics from './advanced/AutomationTopics';
import Archiving from './advanced/Archiving';

// Custom Hook
import { useAdvancedFeatures } from '../../../../../hooks/useAdvancedFeatures';

const AdvancedFeatures: React.FC<{
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    agents: AIAgent[];
    isLoadingAgents: boolean;
}> = ({ dataHub, setDataHub, onRefresh, t, formatTimeAgo, agents, isLoadingAgents }) => {
    const {
        activeFeature,
        setActiveFeature,
        advanced,
        pipelineSnapshot,
        sourceQualityMap,
        agentMap,
        publisherMap,
        topicMap,
        findCategorySignal,
        getStatusBadgeClass
    } = useAdvancedFeatures({ dataHub, agents });


    return (
        <div className="space-y-6">
            {/* Feature navigation tabs */}
            <div className="flex gap-2 flex-wrap border-b border-border pb-2">
                <button
                    onClick={() => setActiveFeature('crawlers')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'crawlers' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('web_crawlers') || 'Web Crawlers'}
                </button>
                <button
                    onClick={() => setActiveFeature('discovery')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'discovery' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('auto_discovery') || 'Auto Discovery'}
                </button>
                <button
                    onClick={() => setActiveFeature('prioritization')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'prioritization' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('smart_prioritization') || 'Smart Prioritization'}
                </button>
                <button
                    onClick={() => setActiveFeature('access')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'access' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('access_control') || 'Access Control'}
                </button>
                <button
                    onClick={() => setActiveFeature('blacklist')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'blacklist' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('blacklist_whitelist') || 'Blacklist/Whitelist'}
                </button>
                <button
                    onClick={() => setActiveFeature('telegram')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'telegram' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('telegram_publisher') || 'Telegram Publisher'}
                </button>
                <button
                    onClick={() => setActiveFeature('automation')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'automation' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('automation_routing') || 'Automation'}
                </button>
                <button
                    onClick={() => setActiveFeature('archive')}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeFeature === 'archive' ? 'bg-secondary/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('archiving') || 'Archiving'}
                </button>
            </div>

            {/* Conditionally rendered feature sections */}
            {activeFeature === 'crawlers' && (
                <WebCrawlerConfig
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    sourceQualityMap={sourceQualityMap}
                    getStatusBadgeClass={getStatusBadgeClass}
                />
            )}

            {activeFeature === 'discovery' && (
                <AutoDiscoveryConfig
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    findCategorySignal={findCategorySignal}
                />
            )}

            {activeFeature === 'prioritization' && (
                <SmartPrioritization
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    sourceQualityMap={sourceQualityMap}
                    getStatusBadgeClass={getStatusBadgeClass}
                />
            )}

            {activeFeature === 'access' && (
                <AccessControlPanel
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    agents={agents}
                    sourceQualityMap={sourceQualityMap}
                    getStatusBadgeClass={getStatusBadgeClass}
                />
            )}

            {activeFeature === 'blacklist' && (
                <BlacklistWhitelist
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    sourceQualityMap={sourceQualityMap}
                    prioritizationSummary={{ lastUpdate: advanced.smartPrioritization.lastUpdate }}
                />
            )}

            {activeFeature === 'telegram' && (
                <TelegramPublisher
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    agents={agents}
                    agentMap={agentMap}
                />
            )}

            {activeFeature === 'automation' && (
                <AutomationTopics
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    agents={agents}
                    isLoadingAgents={isLoadingAgents}
                    agentMap={agentMap}
                    topicMap={topicMap}
                    publisherMap={publisherMap}
                />
            )}

            {activeFeature === 'archive' && (
                <Archiving
                    dataHub={dataHub}
                    setDataHub={setDataHub}
                    onRefresh={onRefresh}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                />
            )}

            {/* Pipeline Quality Snapshot - Keep high-level view if needed or move to Dashboard */}
            {pipelineSnapshot && (
                <div className="mt-8 border-t border-border pt-6">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">{t('pipeline_health_overview') || 'Pipeline Health Overview'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-secondary/20 border border-border rounded p-4">
                            <p className="text-xs text-muted-foreground uppercase">{t('system_status') || 'System Status'}</p>
                            <p className={`text-xl font-bold mt-1 ${getStatusBadgeClass(pipelineSnapshot.overallStatus).replace('bg-', 'text-').replace('/20', '')}`}>
                                {t(`log_status_${pipelineSnapshot.overallStatus}` as any) || pipelineSnapshot.overallStatus}
                            </p>
                        </div>
                        <div className="bg-secondary/20 border border-border rounded p-4">
                            <p className="text-xs text-muted-foreground uppercase">{t('active_sources') || 'Active Sources'}</p>
                            <p className="text-xl font-bold mt-1">{pipelineSnapshot.activeSources} / {pipelineSnapshot.totalSources}</p>
                        </div>
                        <div className="bg-secondary/20 border border-border rounded p-4">
                            <p className="text-xs text-muted-foreground uppercase">{t('avg_latency') || 'Avg Latency'}</p>
                            <p className="text-xl font-bold mt-1">{Math.round(pipelineSnapshot.avgLatency)} ms</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedFeatures;
