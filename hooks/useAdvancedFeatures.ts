
import { useState, useMemo, useCallback } from 'react';
import {
    DataHubState,
    AIAgent,
    DataPipelineSourceSnapshot,
    DataPipelineCategorySnapshot
} from '../types';

export type AdvancedFeatureTab =
    | 'crawlers'
    | 'discovery'
    | 'prioritization'
    | 'access'
    | 'blacklist'
    | 'archive'
    | 'telegram'
    | 'automation';

export interface UseAdvancedFeaturesProps {
    dataHub: DataHubState;
    agents: AIAgent[];
}

export const useAdvancedFeatures = ({ dataHub, agents }: UseAdvancedFeaturesProps) => {
    const [activeFeature, setActiveFeature] = useState<AdvancedFeatureTab>('crawlers');

    const advanced = useMemo(() => dataHub.advanced || {
        webCrawlers: [],
        autoDiscovery: { enabled: false, rules: [], discoveredSources: [], lastScan: undefined },
        smartPrioritization: { enabled: false, rules: [], lastUpdate: undefined },
        accessControl: [],
        blacklist: { sources: [], reasons: {} },
        whitelist: { sources: [] },
        archives: [],
        telegramPublishers: [],
        publisherHistory: []
    }, [dataHub.advanced]);

    const pipelineSnapshot = dataHub.pipelineSnapshot;

    // Memoized lookups
    const sourceQualityMap = useMemo(() => {
        const map: Record<string, DataPipelineSourceSnapshot> = {};
        if (pipelineSnapshot?.sources) {
            pipelineSnapshot.sources.forEach(s => {
                map[s.sourceId] = s;
            });
        }
        return map;
    }, [pipelineSnapshot]);

    const agentMap = useMemo(() => {
        const map: Record<string, AIAgent> = {};
        agents.forEach(a => map[a.id] = a);
        return map;
    }, [agents]);

    const publisherMap = useMemo(() => {
        const map: Record<string, any> = {};
        advanced.telegramPublishers.forEach(p => map[p.id] = p);
        return map;
    }, [advanced.telegramPublishers]);

    const topicMap = useMemo(() => {
        const map = new Map<string, any>();
        dataHub.automation?.agentTopics.forEach(t => map.set(t.id, t));
        return map;
    }, [dataHub.automation]);

    // Helpers
    const findCategorySignal = useCallback((categoryKey: string): DataPipelineCategorySnapshot | undefined => {
        return pipelineSnapshot?.categories.find(c => c.categoryId === categoryKey);
    }, [pipelineSnapshot]);

    const getStatusBadgeClass = useCallback((status?: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-500/20 text-green-400';
            case 'degraded': return 'bg-yellow-500/20 text-yellow-400';
            case 'failed': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    }, []);

    return {
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
    };
};
