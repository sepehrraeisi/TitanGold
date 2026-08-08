import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { OnNavigateHandler } from '../types/navigation.ts';
import AIManager from './ai/AIManager/index.tsx';
import AIAgents from './ai/AIAgents.tsx';
import DataHubWorkspace from './ai/DataHubWorkspace.tsx';
import TrainingCenter from './ai/TrainingCenter.tsx';
import AnalyticsDashboard from './ai/AnalyticsDashboard.tsx';
import APIConfig from './ai/APIConfig.tsx';
import TopicRouting from './ai/TopicRouting.tsx';
import OfflineIndicator, { CachedDataBadge, useOnlineStatus } from './OfflineIndicator';
import * as api from '../services/api.ts';

export type AITab =
  | 'manager'
  | 'agents'
  | 'data_hub'
  | 'training'
  | 'analytics'
  | 'config'
  | 'topic_routing';

const AI_TABS: AITab[] = [
  'manager',
  'agents',
  'data_hub',
  'training',
  'analytics',
  'config',
  'topic_routing',
];

const ARTEMIS_SECTION_IDS = new Set([
  'overview',
  'evidence',
  'decisions',
  'orchestration',
  'controls',
  'lineage',
  'system',
  'legacy_admin',
  'autopilot',
  'decision_engine',
  'learning',
  'monitoring',
  'scenarios',
  'backtesting',
  'logs',
  'settings',
]);

type Props = {
  onNavigate?: OnNavigateHandler;
  initialAgentId?: string;
  initialAgentSection?: string;
  initialRunId?: string;
  initialAiTab?: string;
};

function isAiTab(value: string | null | undefined): value is AITab {
  return Boolean(value && (AI_TABS as string[]).includes(value));
}

export function readAiTabFromLocation(initialAiTab?: string): AITab {
  if (isAiTab(initialAiTab)) return initialAiTab;
  try {
    const params = new URLSearchParams(window.location.search);
    const aiTab = params.get('aiTab');
    if (isAiTab(aiTab)) return aiTab;

    const legacy = params.get('subtab') || params.get('artemisSection');
    if (legacy === 'data_hub' || legacy === 'datahub') return 'data_hub';
    if (legacy && ARTEMIS_SECTION_IDS.has(legacy)) return 'manager';
  } catch {
    /* ignore */
  }
  return 'agents';
}

const AICenter: React.FC<Props> = ({
  onNavigate,
  initialAgentId,
  initialAgentSection,
  initialRunId,
  initialAiTab,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<AITab>(() => readAiTabFromLocation(initialAiTab));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const dir = language === 'fa' ? 'rtl' : 'ltr';

  const prefetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      await api.fetchAIManagerData();
    } catch (e: any) {
      console.error('Failed to prefetch AI manager data:', e);
      const message = e?.message || e?.toString() || 'Unknown error';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    prefetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = readAiTabFromLocation(initialAiTab);
    setActiveTab((current) => (current === next ? current : next));
  }, [initialAiTab]);

  const selectTab = (id: AITab) => {
    setActiveTab(id);
    if (onNavigate) {
      onNavigate({ view: 'ai', aiTab: id });
      return;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'ai');
      url.searchParams.set('aiTab', id);
      if (id === 'data_hub') {
        url.searchParams.delete('subtab');
        url.searchParams.delete('artemisSection');
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'manager':
        return <AIManager onNavigate={onNavigate} />;
      case 'agents':
        return (
          <AIAgents
            onNavigate={onNavigate}
            initialAgentId={initialAgentId}
            initialAgentSection={initialAgentSection}
            initialRunId={initialRunId}
          />
        );
      case 'data_hub':
        return <DataHubWorkspace />;
      case 'training':
        return <TrainingCenter />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'config':
        return <APIConfig onNavigate={onNavigate} />;
      case 'topic_routing':
        return <TopicRouting />;
      default:
        return null;
    }
  };

  const tabs: { id: AITab; label: string; purposeKey: string }[] = [
    {
      id: 'manager',
      label: t('artemis') !== 'artemis' ? t('artemis') : t('ai_manager_artemis') || 'Artemis',
      purposeKey: 'ai_tab_purpose_artemis',
    },
    { id: 'agents', label: t('ai_agents'), purposeKey: 'ai_tab_purpose_agents' },
    {
      id: 'data_hub',
      label: t('ai_data_hub') !== 'ai_data_hub' ? t('ai_data_hub') : t('artemis_data_hub') || 'Data Hub',
      purposeKey: 'ai_tab_purpose_data_hub',
    },
    { id: 'training', label: t('ai_training'), purposeKey: 'ai_tab_purpose_training' },
    { id: 'analytics', label: t('ai_analytics'), purposeKey: 'ai_tab_purpose_analytics' },
    {
      id: 'config',
      label: t('ai_integrations') !== 'ai_integrations' ? t('ai_integrations') : t('ai_config') || 'Integrations',
      purposeKey: 'ai_tab_purpose_integrations',
    },
    {
      id: 'topic_routing',
      label: t('topic_routing') !== 'topic_routing' ? t('topic_routing') : 'Topic Routing',
      purposeKey: 'ai_tab_purpose_topic_routing',
    },
  ];

  return (
    <div className="space-y-6" dir={dir} data-ai-center="canonical">
      <OfflineIndicator />

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {t('ai_center_title') !== 'ai_center_title'
                  ? t('ai_center_title')
                  : t('ai_management_system') || 'AI Center'}
              </h1>
              {!isOnline && <CachedDataBadge />}
            </div>
            <p className="text-muted-foreground mt-1">
              {t('ai_center_desc') !== 'ai_center_desc'
                ? t('ai_center_desc')
                : t('ai_management_desc')}
            </p>
          </div>
        </div>
        <div className="border-b border-border mt-4">
          <nav
            className="-mb-px flex gap-4 sm:gap-6 overflow-x-auto"
            aria-label={t('ai_center_nav') || 'AI Center'}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-ai-tab={tab.id}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                title={t(tab.purposeKey) !== tab.purposeKey ? t(tab.purposeKey) : undefined}
                onClick={() => selectTab(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="text-center p-10">{t('loading')}</div>
        ) : loadError ? (
          <div className="text-center p-6 space-y-3">
            <p className="text-sm text-red-400">
              {t('failed_to_load_data') || 'Failed to load AI center data.'}
            </p>
            <button
              type="button"
              onClick={prefetchData}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
            >
              {t('retry') || 'Retry'}
            </button>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default AICenter;
