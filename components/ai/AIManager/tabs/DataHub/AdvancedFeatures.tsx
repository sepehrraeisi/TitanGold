
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
import { DataHubTabStrip } from './dataHubUi';

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


    const advancedTabItems = [
        { id: 'crawlers', label: t('web_crawlers') },
        { id: 'discovery', label: t('auto_discovery') },
        { id: 'prioritization', label: t('smart_prioritization') },
        { id: 'access', label: t('access_control') },
        { id: 'blacklist', label: t('blacklist_whitelist') },
        {
            id: 'telegram',
            label: t('telegram_publisher'),
            icon: '📱',
            activeVariant: 'telegram' as const,
        },
        {
            id: 'automation',
            label: t('automation_routing'),
            icon: '🤖',
        },
        { id: 'archive', label: t('data_archiving') },
    ];

    return (
        <div className="space-y-6">
            <DataHubTabStrip
                ariaLabel={t('advanced_features') || 'Advanced features'}
                activeId={activeFeature}
                onChange={id => setActiveFeature(id as typeof activeFeature)}
                items={advancedTabItems}
            />

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
