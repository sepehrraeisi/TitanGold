import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { OnNavigateHandler } from '../types/navigation.ts';
import AIManager from './ai/AIManager/index.tsx';
import AIAgents from './ai/AIAgents.tsx';
import TrainingCenter from './ai/TrainingCenter.tsx';
import AnalyticsDashboard from './ai/AnalyticsDashboard.tsx';
import APIConfig from './ai/APIConfig.tsx';
import * as api from '../services/api.ts';

type AITab = 'manager' | 'agents' | 'training' | 'analytics' | 'config';

type Props = {
  onNavigate?: OnNavigateHandler;
};

const AICenter: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useLanguage();
  // Changed from 'manager' to 'agents' - new UI with registry support
  const [activeTab, setActiveTab] = useState<AITab>('agents');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const prefetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // This is a placeholder pre-fetch to simulate loading the section.
      // Each child component will fetch its own specific data.
      await api.fetchAIManagerData();
    } catch (e: any) {
      // We only show a minimal inline error; details go to console.
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

  const renderContent = () => {
    // We let each component handle its own loading state for a better UX
    switch (activeTab) {
      case 'manager':
        return <AIManager onNavigate={onNavigate} />;
      case 'agents':
        return <AIAgents />;
      case 'training':
        return <TrainingCenter />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'config':
        return <APIConfig onNavigate={onNavigate} />;
      default:
        return null;
    }
  };

  const tabs: { id: AITab; label: string }[] = [
    { id: 'manager', label: t('ai_manager') },
    { id: 'agents', label: t('ai_agents') },
    { id: 'training', label: t('ai_training') },
    { id: 'analytics', label: t('ai_analytics') },
    { id: 'config', label: t('ai_config') },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('ai_management_system')}</h1>
            <p className="text-muted-foreground mt-1">{t('ai_management_desc')}</p>
          </div>
        </div>
        <div className="border-b border-border mt-4">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
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
