
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
import PipelineHealthOverview from './PipelineHealthOverview';

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
        agentMap,
        publisherMap,
        topicMap,
        findCategorySignal,
    } = useAdvancedFeatures({ dataHub, agents });


    return (
        <div className="space-y-6">
            {/* Feature navigation tabs (redesigned to match DESIGN_SYSTEM_DATAHUB.md) */}
            <div className="border border-white/5 bg-slate-950/70 rounded-xl p-2 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 whitespace-nowrap">
                <button
                    onClick={() => setActiveFeature('crawlers')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'crawlers' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('web_crawlers')}
                </button>
                <button
                    onClick={() => setActiveFeature('discovery')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'discovery' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('auto_discovery')}
                </button>
                <button
                    onClick={() => setActiveFeature('prioritization')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'prioritization' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('smart_prioritization')}
                </button>
                <button
                    onClick={() => setActiveFeature('access')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'access' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('access_control')}
                </button>
                <button
                    onClick={() => setActiveFeature('blacklist')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'blacklist' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('blacklist_whitelist')}
                </button>
                <button
                    onClick={() => setActiveFeature('telegram')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeFeature === 'telegram' ? 'bg-sky-500/15 border-sky-500/60 text-sky-300' : ''
                    }`}
                >
                    <span>📱</span>
                    {t('telegram_publisher')}
                </button>
                <button
                    onClick={() => setActiveFeature('automation')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeFeature === 'automation' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    <span>🤖</span>
                    {t('automation_routing')}
                </button>
                <button
                    onClick={() => setActiveFeature('archive')}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${
                        activeFeature === 'archive' ? 'bg-purple-600/20 border-purple-500/60 text-purple-300' : ''
                    }`}
                >
                    {t('archiving')}
                </button>
                </div>
            </div>

            {/* Telegram-specific hints (TASK-DHT-065) */}
            {(activeFeature === 'telegram' || activeFeature === 'automation') && (
                <div className="bg-gradient-to-r from-sky-950/40 via-slate-900/40 to-sky-950/40 border border-sky-500/30 rounded-lg p-3 backdrop-blur-sm">
                    <div className="flex items-start gap-2">
                        <span className="text-sky-400 text-lg">💡</span>
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-sky-200 mb-1">
                                {activeFeature === 'telegram'
                                    ? t('telegram_publisher_hint_title')
                                    : t('telegram_automation_hint_title')}
                            </p>
                            <p className="text-[11px] text-sky-300/80 leading-relaxed">
                                {activeFeature === 'telegram'
                                    ? t('telegram_publisher_hint')
                                    : t('telegram_automation_hint')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Conditionally rendered feature sections */}
            {activeFeature === 'crawlers' && <WebCrawlerConfig t={t} />}

            {activeFeature === 'discovery' && <AutoDiscoveryConfig t={t} />}

            {activeFeature === 'prioritization' && (
                <SmartPrioritization
                    t={t}
                />
            )}

            {activeFeature === 'access' && (
                <AccessControlPanel t={t} />
            )}

            {activeFeature === 'blacklist' && <BlacklistWhitelist t={t} />}

            {activeFeature === 'telegram' && (
                <TelegramPublisher
                    t={t}
                    telegramSources={dataHub.sources.filter(s => s.type === 'telegram')}
                />
            )}

            {activeFeature === 'automation' && (
                <AutomationTopics
                    categories={dataHub.categories}
                    t={t}
                    formatTimeAgo={formatTimeAgo}
                    agents={agents}
                    isLoadingAgents={isLoadingAgents}
                    agentMap={agentMap}
                    availableDataTypes={Array.from(
                        new Set(dataHub.sources.map(s => s.type).filter(Boolean)),
                    )}
                />
            )}

            {activeFeature === 'archive' && (
                <Archiving t={t} />
            )}

            <PipelineHealthOverview t={t} />
        </div>
    );
};

export default AdvancedFeatures;
