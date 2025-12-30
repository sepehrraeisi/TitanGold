import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { OnNavigateHandler } from '../../types/navigation.ts';
import { useAppContext } from '../../context/AppContext.tsx';

type Props = {
  onNavigate?: OnNavigateHandler;
};

/**
 * APIConfig - Redirects to Settings > Configuration > Integrations
 *
 * This component has been consolidated with Settings to avoid duplication.
 * API Integrations configuration is now managed exclusively in:
 * Settings → Configuration → Integrations
 *
 * Related: OVERLAP_MATRIX.md - API Integrations (DUPLICATE → LINK_TO_SETTINGS)
 */
const APIConfig: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const isAdmin = user?.role === 'Admin';

  const handleOpenSettings = () => {
    // No alert needed - UI already shows Admin-only warning
    if (!isAdmin) {
      return;
    }

    if (onNavigate) {
      // State-based navigation - no DOM selectors needed!
      onNavigate({
        view: 'settings',
        settingsTab: 'configuration',
        settingsSubtab: 'integrations',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
          {/* Icon */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </div>

          {/* Title */}
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground">
              {t('api_config_moved') || 'API Configuration Moved'}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t('api_config_moved_desc') ||
                'API Integrations configuration is now available in Settings > Configuration > Integrations to provide a unified configuration experience and reduce duplication.'}
            </p>
          </div>

          {/* Action Button or Admin Warning */}
          {isAdmin ? (
            <button
              onClick={handleOpenSettings}
              className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-base shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {t('open_in_settings') || 'Open in Settings'}
            </button>
          ) : (
            <div className="mt-6 p-5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-xl">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-3">
                <svg
                  className="w-6 h-6 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>
                  <span className="font-semibold">{t('admin_only') || 'Admin Only'}:</span>{' '}
                  {t('admin_only_feature_desc') ||
                    'This configuration is only available to Admin users. Please contact your administrator for access.'}
                </span>
              </p>
            </div>
          )}

          {/* Features Grid */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
            <div className="p-5 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🔌</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {t('ai_services') || 'AI Services'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('ai_services_desc') ||
                      'Multiple AI API keys (Gemini, Claude, OpenAI, DeepSeek, OpenRouter) with load balancing'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🤝</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {t('mixture_agents') || 'Mixture Agents'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('mixture_agents_desc_short') ||
                      'Collaborative AI decision making with weighted models'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {t('market_data') || 'Market Data'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('market_data_desc') || 'On-chain data and news API integrations'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📧</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {t('communications') || 'Communications'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('communications_desc') || 'Email, Telegram, and Voice alerts configuration'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-5 bg-blue-500/5 border border-blue-500/20 rounded-lg text-left max-w-2xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  {t('why_consolidated') || 'Why was this consolidated?'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('consolidation_reason') ||
                    'By consolidating API configuration in Settings, we provide a single source of truth for all integrations, making it easier to manage, reducing redundancy, and improving the overall user experience.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIConfig;
