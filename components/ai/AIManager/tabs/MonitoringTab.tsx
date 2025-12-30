import React from 'react';
import { OnNavigateHandler } from '../../../../types/navigation.ts';
import { useAppContext } from '../../../../context/AppContext.tsx';
import { isAdminRole } from '../../../../utils/auth.ts';

type Props = {
  artemis?: any;
  t: (key: string) => string;
  onRefresh?: () => void;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
  onNavigate?: OnNavigateHandler;
};

/**
 * MonitoringTab - Redirects to Settings > Configuration > Monitoring
 *
 * This tab has been consolidated with Settings to avoid duplication.
 * System monitoring is now managed exclusively in:
 * Settings → Configuration → Monitoring
 *
 * Related: OVERLAP_MATRIX.md - System Monitoring (DUPLICATE → LINK_TO_SETTINGS)
 */
const MonitoringTab: React.FC<Props> = ({ t, Card, onNavigate }) => {
  const { user } = useAppContext();
  const isAdmin = isAdminRole(user?.role);

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
        settingsSubtab: 'monitoring',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-purple-500"
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
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {t('monitoring_moved') || 'System Monitoring Moved'}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {t('monitoring_moved_desc') ||
                'System monitoring is now available in Settings > Configuration > Monitoring to provide unified health tracking and reduce duplication.'}
            </p>
          </div>

          {/* Action Button */}
          {isAdmin ? (
            <button
              onClick={handleOpenSettings}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg text-sm shadow-lg transition-all duration-200 hover:shadow-xl flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {t('open_in_settings') || 'Open in Settings'}
            </button>
          ) : (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-md">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <svg
                  className="w-5 h-5 flex-shrink-0"
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

          {/* Features List */}
          <div className="mt-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg text-left max-w-md">
            <p className="text-sm font-semibold text-foreground mb-2">
              📊 {t('available_metrics') || 'Available Metrics'}:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• {t('health_status') || 'Health Status (API + DB)'}</li>
              <li>• {t('request_metrics') || 'Request Metrics (Count, Errors, Latency)'}</li>
              <li>• {t('top_routes') || 'Top Routes Analysis'}</li>
              <li>• {t('recent_errors') || 'Recent Errors Log'}</li>
              <li>• {t('real_time_data') || 'Real-time Data Updates'}</li>
            </ul>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-left max-w-md">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">ℹ️ {t('note') || 'Note'}:</span>{' '}
              {t('monitoring_note') ||
                'This consolidation provides a single source of truth for system health monitoring, making it easier to track and respond to issues.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MonitoringTab;
