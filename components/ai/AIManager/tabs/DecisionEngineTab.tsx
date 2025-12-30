import React from 'react';

type Props = {
    artemis?: any;
    t: (key: string) => string;
    onRefresh?: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    onNavigate?: (view: string) => void;
};

/**
 * DecisionEngineTab - Redirects to Settings > Configuration > Decision Engine
 * 
 * This tab has been consolidated with Settings to avoid duplication.
 * The Decision Engine configuration is now managed exclusively in:
 * Settings → Configuration → Decision Engine
 * 
 * Related: OVERLAP_MATRIX.md - Decision Engine Config (DUPLICATE → LINK_TO_SETTINGS)
 */
const DecisionEngineTab: React.FC<Props> = ({ t, Card, onNavigate }) => {
    const handleOpenSettings = () => {
        if (onNavigate) {
            // Navigate to Settings view in Dashboard
            onNavigate('settings');
            
            // Wait for Settings to load, then activate Configuration → Decision Engine
            setTimeout(() => {
                // Trigger Configuration tab
                const configTab = document.querySelector('[data-tab-id="configuration"]');
                if (configTab instanceof HTMLElement) {
                    configTab.click();
                    
                    // Then trigger Decision Engine sub-tab
                    setTimeout(() => {
                        const deTab = document.querySelector('[data-subtab-id="decision-engine"]');
                        if (deTab instanceof HTMLElement) {
                            deTab.click();
                        }
                    }, 100);
                }
            }, 200);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
                    {/* Icon */}
                    <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">
                            {t('decision_engine_moved') || 'Decision Engine Configuration Moved'}
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                            {t('decision_engine_moved_desc') || 
                             'Decision Engine configuration is now available in Settings > Configuration > Decision Engine to avoid duplication and provide a unified configuration experience.'}
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleOpenSettings}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-sm shadow-lg transition-all duration-200 hover:shadow-xl flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('open_in_settings') || 'Open in Settings'}
                    </button>

                    {/* Info Box */}
                    <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-left max-w-md">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">ℹ️ {t('note') || 'Note'}:</span>{' '}
                            {t('decision_engine_note') || 
                             'This change consolidates configuration in one place, making it easier to manage and reducing redundancy.'}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DecisionEngineTab;
