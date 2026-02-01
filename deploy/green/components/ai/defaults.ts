import {
    ArtemisState,
    SystemHealth,
    DecisionEngineState,
    LearningSystemState,
    OrchestrationState,
    DataHubState,
    DataHubAdvancedFeatures,
    DataCacheStats,
    DataPipelineSnapshot,
    DataNormalizationSummary
} from '../../types.ts';
import { deepMerge } from '../../utils/dataMerge.ts';

const now = () => new Date().toISOString();

const createDefaultSystemHealth = (): SystemHealth => ({
    overall: 'healthy',
    agents: [],
    integrations: [],
    resources: {
        cpu: 0,
        memory: 0,
        network: 0,
        storage: 0,
        apiQuota: {
            used: 0,
            limit: 0,
            resetAt: now(),
        },
    },
    alerts: [],
});

const createDefaultDecisionEngine = (): DecisionEngineState => ({
    strategy: 'consensus',
    activeModel: 'hybrid',
    confidenceThreshold: 70,
    recentDecisions: [],
    performance: {
        accuracy: 0,
        avgConfidence: 0,
        avgExecutionTime: 0,
    },
});

const createDefaultLearningSystem = (): LearningSystemState => ({
    totalDecisions: 0,
    totalTrades: 0,
    accuracyHistory: [],
    improvements: [],
    mistakes: [],
    activeLearning: false,
    lastTraining: now(),
    modelVersions: [],
});

const createDefaultOrchestration = (): OrchestrationState => ({
    activeAgents: 0,
    agentTasks: [],
    resourceAllocation: {},
    failoverStatus: {
        enabled: false,
        fallbackAgents: {},
    },
});

const createDefaultCache = (): DataCacheStats => ({
    totalEntries: 0,
    hitRate: 0,
    missRate: 0,
    totalSize: 0,
    oldestEntry: now(),
    newestEntry: now(),
    evictionCount: 0,
    data: {},
});

const createDefaultPipelineSnapshot = (): DataPipelineSnapshot => ({
    lastRefreshed: now(),
    totalRequests24h: 0,
    passed24h: 0,
    failed24h: 0,
    pending24h: 0,
    sources: [],
    categories: [],
});

const createDefaultNormalizationSummary = (): DataNormalizationSummary => ({
    totalProcessed: 0,
    passed: 0,
    warnings: 0,
    rejected: 0,
    lastProcessedAt: now(),
});

const createDefaultAdvancedFeatures = (): DataHubAdvancedFeatures => ({
    webCrawlers: [],
    autoDiscovery: {
        enabled: false,
        rules: [],
        discoveredSources: [],
    },
    smartPrioritization: {
        enabled: false,
        rules: [],
    },
    accessControl: [],
    blacklist: {
        sources: [],
        patterns: [],
        reasons: {},
    },
    whitelist: {
        sources: [],
        patterns: [],
    },
    archives: [],
    telegramPublishers: [],
    automation: undefined,
    publisherQueue: [],
    publisherHistory: [],
});

const createDefaultDataHub = (): DataHubState => ({
    id: 'data-hub',
    status: 'standby',
    totalSources: 0,
    activeSources: 0,
    totalDataPoints: 0,
    lastUpdateTime: now(),
    sources: [],
    categories: [],
    accessLogs: [],
    health: {
        overall: 'healthy',
        activeConnections: 0,
        failedConnections: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errors: [],
        lastHealthCheck: now(),
    },
    cache: createDefaultCache(),
    advanced: createDefaultAdvancedFeatures(),
    telegramCollector: {
        status: 'unknown',
        channels: [],
    },
    pipelineSnapshot: createDefaultPipelineSnapshot(),
    pipelineHistory: [],
    normalizedData: [],
    normalizationSummary: createDefaultNormalizationSummary(),
});

export const DEFAULT_ARTEMIS_STATE = (): ArtemisState => ({
    id: 'artemis-default',
    status: 'standby',
    mode: 'demo',
    lastDecisionTime: now(),
    totalDecisions: 0,
    successRate: 0,
    systemHealth: createDefaultSystemHealth(),
    activeAgents: [],
    decisionEngine: createDefaultDecisionEngine(),
    learningSystem: createDefaultLearningSystem(),
    orchestration: createDefaultOrchestration(),
    dataHub: createDefaultDataHub(),
    config: undefined,
    logs: [],
});

/**
 * Safely merges partial Artemis state with defaults to prevent undefined crashes.
 */
export const mergeWithArtemisDefaults = (data: Partial<ArtemisState> | null | undefined): ArtemisState => {
    const base = DEFAULT_ARTEMIS_STATE();
    if (!data) return base;
    return deepMerge(base, data);
};

