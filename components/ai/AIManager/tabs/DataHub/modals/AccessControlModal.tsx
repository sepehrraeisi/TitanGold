import React, { useState } from 'react';
import { DataSource } from '../../../../../../types';

const AccessControlModal: React.FC<{
    sourceId: string;
    source?: DataSource;
    accessControl?: any;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ sourceId, source, accessControl, onClose, onSave, t }) => {
    const [allowedAgents, setAllowedAgents] = useState<string[]>(accessControl?.allowedAgents || []);
    const [blockedAgents, setBlockedAgents] = useState<string[]>(accessControl?.blockedAgents || []);
    const [allowedDataTypes, setAllowedDataTypes] = useState<string[]>(accessControl?.allowedDataTypes || []);
    const [requireAuth, setRequireAuth] = useState(accessControl?.requireAuth ?? false);
    const [maxRequestsPerMinute, setMaxRequestsPerMinute] = useState(accessControl?.maxRequestsPerMinute || '');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await onSave({
                sourceId,
                allowedAgents: allowedAgents.length > 0 ? allowedAgents : [],
                blockedAgents,
                allowedDataTypes: allowedDataTypes.length > 0 ? allowedDataTypes : [],
                requireAuth,
                maxRequestsPerMinute: maxRequestsPerMinute ? parseInt(maxRequestsPerMinute) : undefined,
                rateLimitWindow: 60,
            });
        } catch (e) {
            console.error('Failed to save access control:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('configure_access_control') || 'Configure Access Control'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {source?.name || sourceId}
                </p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('allowed_agents') || 'Allowed Agents'} ({t('empty_for_all') || 'Empty = All'})
                        </label>
                        <input
                            type="text"
                            value={allowedAgents.join(', ')}
                            onChange={(e) => setAllowedAgents(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="agent1, agent2, agent3"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('blocked_agents') || 'Blocked Agents'}
                        </label>
                        <input
                            type="text"
                            value={blockedAgents.join(', ')}
                            onChange={(e) => setBlockedAgents(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="agent1, agent2"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                            {t('allowed_data_types') || 'Allowed Data Types'} ({t('empty_for_all') || 'Empty = All'})
                        </label>
                        <input
                            type="text"
                            value={allowedDataTypes.join(', ')}
                            onChange={(e) => setAllowedDataTypes(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, news, analysis"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('max_requests_per_minute') || 'Max Requests/Minute'}
                            </label>
                            <input
                                type="number"
                                value={maxRequestsPerMinute}
                                onChange={(e) => setMaxRequestsPerMinute(e.target.value)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="60"
                            />
                        </div>
                        
                        <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={requireAuth}
                                    onChange={(e) => setRequireAuth(e.target.checked)}
                                    className="rounded"
                                />
                                {t('require_auth') || 'Require Auth'}
                            </label>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccessControlModal;

