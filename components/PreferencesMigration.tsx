/**
 * ============================================================================
 * Preferences Migration Component
 * ============================================================================
 * 
 * Shows migration prompt and progress when legacy LocalStorage data is detected
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import userPreferencesService from '../services/userPreferences';

interface MigrationModalProps {
    onComplete: () => void;
    onSkip: () => void;
}

const PreferencesMigrationModal: React.FC<MigrationModalProps> = ({ onComplete, onSkip }) => {
    const [migrating, setMigrating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [result, setResult] = useState<{
        success: boolean;
        migrated: number;
        errors: string[];
    } | null>(null);

    const handleMigrate = async () => {
        setMigrating(true);
        setProgress(10);
        setStatus('Scanning local storage...');

        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            setProgress(30);
            setStatus('Extracting preferences...');

            await new Promise(resolve => setTimeout(resolve, 500));
            setProgress(50);
            setStatus('Uploading to server...');

            const migrationResult = await userPreferencesService.migrateLegacyPreferences();
            
            setProgress(90);
            setStatus('Cleaning up...');

            await new Promise(resolve => setTimeout(resolve, 300));
            setProgress(100);
            setResult(migrationResult);

            if (migrationResult.success) {
                setStatus(`✅ Migration completed! ${migrationResult.migrated} categories migrated.`);
                setTimeout(() => {
                    onComplete();
                }, 2000);
            } else {
                setStatus(`❌ Migration failed: ${migrationResult.errors.join(', ')}`);
            }
        } catch (error: any) {
            setStatus(`❌ Error: ${error.message}`);
            setResult({ success: false, migrated: 0, errors: [error.message] });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
                <div className="text-center mb-6">
                    <div className="text-4xl mb-4">🔄</div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Preferences Migration
                    </h2>
                    <p className="text-gray-400">
                        We detected local preferences that can be synced across your devices.
                    </p>
                </div>

                {!migrating && !result && (
                    <div className="space-y-4">
                        <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4">
                            <h3 className="text-blue-400 font-semibold mb-2">✨ Benefits:</h3>
                            <ul className="text-sm text-gray-300 space-y-1">
                                <li>✅ Access settings from any device</li>
                                <li>✅ Never lose your preferences</li>
                                <li>✅ Automatic backup</li>
                                <li>✅ Sync across devices instantly</li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleMigrate}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Migrate Now
                            </button>
                            <button
                                onClick={onSkip}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Skip
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            You can always migrate later from Settings
                        </p>
                    </div>
                )}

                {migrating && (
                    <div className="space-y-4">
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block text-blue-400">
                                        {progress}%
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-700">
                                <div
                                    style={{ width: `${progress}%` }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"
                                />
                            </div>
                        </div>
                        
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
                            <p className="text-sm text-gray-300">{status}</p>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="space-y-4">
                        {result.success ? (
                            <div className="bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-4">
                                <h3 className="text-green-400 font-semibold mb-2">✅ Success!</h3>
                                <p className="text-sm text-gray-300">
                                    {result.migrated} categories have been migrated and synced to the server.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-4">
                                <h3 className="text-red-400 font-semibold mb-2">❌ Migration Failed</h3>
                                <p className="text-sm text-gray-300 mb-2">
                                    Some errors occurred during migration:
                                </p>
                                <ul className="text-xs text-gray-400 space-y-1">
                                    {result.errors.map((error, idx) => (
                                        <li key={idx}>• {error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button
                            onClick={result.success ? onComplete : onSkip}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                        >
                            {result.success ? 'Continue' : 'Close'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Migration manager component - checks and triggers migration
 */
export const PreferencesMigrationManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [needsMigration, setNeedsMigration] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [migrationDismissed, setMigrationDismissed] = useState(false);

    useEffect(() => {
        // Check if migration is needed
        const migrationNeeded = userPreferencesService.needsMigration();
        const dismissed = localStorage.getItem('titan_migration_dismissed') === 'true';
        
        if (migrationNeeded && !dismissed) {
            setNeedsMigration(true);
            // Show modal after 2 seconds to not overwhelm user on login
            setTimeout(() => {
                setShowModal(true);
            }, 2000);
        }
    }, []);

    const handleComplete = () => {
        setShowModal(false);
        setNeedsMigration(false);
        localStorage.setItem('titan_migration_dismissed', 'true');
    };

    const handleSkip = () => {
        setShowModal(false);
        setMigrationDismissed(true);
        localStorage.setItem('titan_migration_dismissed', 'true');
    };

    return (
        <>
            {children}
            {needsMigration && showModal && !migrationDismissed && (
                <PreferencesMigrationModal 
                    onComplete={handleComplete} 
                    onSkip={handleSkip} 
                />
            )}
        </>
    );
};

export default PreferencesMigrationModal;
