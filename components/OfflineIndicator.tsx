/**
 * Offline Mode Indicator Component (FRONTEND-008)
 * 
 * Displays online/offline status and indicates when cached data is being used.
 * Shows warning banner when offline and provides visual feedback.
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export interface OfflineIndicatorProps {
  /** Show compact version (for inline use) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Hook to detect online/offline state
 * Monitors navigator.onLine and network events
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // Update online status when events fire
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check periodically as a backup (every 30 seconds)
    const interval = setInterval(() => {
      setIsOnline(navigator.onLine);
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}

/**
 * Offline Indicator Component
 * Shows a banner when the application is offline
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  compact = false, 
  className = '' 
}) => {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [wasDismissed, setWasDismissed] = useState(false);

  useEffect(() => {
    // Show banner when going offline (unless user dismissed it)
    if (!isOnline && !wasDismissed) {
      setShowBanner(true);
    }
    // Hide banner when coming back online
    if (isOnline) {
      setShowBanner(false);
      setWasDismissed(false);
    }
  }, [isOnline, wasDismissed]);

  const handleDismiss = () => {
    setShowBanner(false);
    setWasDismissed(true);
  };

  // Don't render anything if online and no banner to show
  if (isOnline && !showBanner) {
    return null;
  }

  // Compact version for inline indicators
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
        <span className="text-xs text-muted-foreground">
          {isOnline ? t('online') || 'Online' : t('offline_mode') || 'Offline Mode'}
        </span>
      </div>
    );
  }

  // Full banner version
  if (!showBanner) {
    return null;
  }

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 backdrop-blur-sm border-b border-yellow-600 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg 
              className="w-5 h-5 text-yellow-900 animate-pulse" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-900">
                {t('offline_mode') || 'Offline Mode'}
              </p>
              <p className="text-xs text-yellow-800 mt-0.5">
                {t('offline_mode_desc') || 'You are offline. Displaying cached data. Some features may be limited.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-yellow-600/20 transition-colors"
            aria-label="Dismiss offline notification"
          >
            <svg 
              className="w-4 h-4 text-yellow-900" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Cached Data Badge
 * Shows a small indicator that data is from cache
 */
export const CachedDataBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();

  // Only show when offline
  if (isOnline) {
    return null;
  }

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 ${className}`}
      title={t('cached_data_tooltip') || 'This data is from local cache'}
    >
      <svg 
        className="w-3.5 h-3.5 text-yellow-500" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" 
        />
      </svg>
      <span className="text-xs font-medium text-yellow-600">
        {t('cached') || 'Cached'}
      </span>
    </span>
  );
};

/**
 * Offline Warning Dialog
 * Shows before performing actions that require network connectivity
 */
export interface OfflineWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue?: () => void;
  title?: string;
  message?: string;
}

export const OfflineWarning: React.FC<OfflineWarningProps> = ({
  isOpen,
  onClose,
  onContinue,
  title,
  message,
}) => {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();

  // Auto-close if coming back online
  useEffect(() => {
    if (isOpen && isOnline) {
      onClose();
    }
  }, [isOpen, isOnline, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-warning-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg 
              className="w-6 h-6 text-yellow-500" 
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
          </div>
          <div className="flex-1">
            <h3 
              id="offline-warning-title" 
              className="text-lg font-semibold text-foreground mb-2"
            >
              {title || t('offline_warning_title') || 'You are offline'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {message || t('offline_warning_message') || 'This action requires an internet connection. Analysis results may be inaccurate or unavailable offline.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent transition-colors text-sm font-medium"
              >
                {t('cancel') || 'Cancel'}
              </button>
              {onContinue && (
                <button
                  onClick={handleContinue}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white transition-colors text-sm font-medium"
                >
                  {t('continue_offline') || 'Continue Anyway'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
