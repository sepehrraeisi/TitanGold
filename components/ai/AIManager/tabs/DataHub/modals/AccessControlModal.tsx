import React, { useState } from 'react';
import type { SourceAccessControlUi } from '../../../../../../services/accessControlApi';

const AccessControlModal: React.FC<{
    sourceId: string;
    sourceName?: string;
    accessControl?: SourceAccessControlUi;
    onClose: () => void;
    onSave: (data: {
        sourceId: string;
        allowedAgents: string[];
        blockedAgents: string[];
        allowedDataTypes: string[];
        requireAuth: boolean;
        maxRequestsPerMinute?: number;
    }) => Promise<void>;
    isSaving?: boolean;
    saveDisabled?: boolean;
    saveTitle?: string;
    t: (key: string) => string;
}> = ({
    sourceId,
    sourceName,
    accessControl,
    onClose,
    onSave,
    isSaving = false,
    saveDisabled = false,
    saveTitle,
    t,
}) => {
    const [allowedAgents, setAllowedAgents] = useState(
        (accessControl?.allowedAgents || []).join(', '),
    );
    const [blockedAgents, setBlockedAgents] = useState(
        (accessControl?.blockedAgents || []).join(', '),
    );
    const [allowedDataTypes, setAllowedDataTypes] = useState(
        (accessControl?.allowedDataTypes || []).join(', '),
    );
    const [requireAuth, setRequireAuth] = useState(accessControl?.requireAuth ?? false);
    const [maxRequestsPerMinute, setMaxRequestsPerMinute] = useState(
        accessControl?.maxRequestsPerMinute ? String(accessControl.maxRequestsPerMinute) : '',
    );

    const splitList = (value: string) =>
        value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

    const handleSubmit = async () => {
        await onSave({
            sourceId,
            allowedAgents: splitList(allowedAgents),
            blockedAgents: splitList(blockedAgents),
            allowedDataTypes: splitList(allowedDataTypes),
            requireAuth,
            maxRequestsPerMinute: maxRequestsPerMinute
                ? parseInt(maxRequestsPerMinute, 10)
                : undefined,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />
            <div className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">
                            {t('configure_access_control')}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {sourceName || sourceId}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-xl leading-none"
                        aria-label={t('close')}
                    >
                        ×
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">
                            {t('allowed_agents')} ({t('empty_for_all')})
                        </label>
                        <input
                            type="text"
                            value={allowedAgents}
                            onChange={e => setAllowedAgents(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                            placeholder="agent_key_1, agent_key_2"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">
                            {t('blocked_agents')}
                        </label>
                        <input
                            type="text"
                            value={blockedAgents}
                            onChange={e => setBlockedAgents(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">
                            {t('allowed_data_types')} ({t('empty_for_all')})
                        </label>
                        <input
                            type="text"
                            value={allowedDataTypes}
                            onChange={e => setAllowedDataTypes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                            placeholder="ticker, article"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">
                                {t('max_requests_per_minute')}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={maxRequestsPerMinute}
                                onChange={e => setMaxRequestsPerMinute(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={requireAuth}
                                    onClick={() => setRequireAuth(!requireAuth)}
                                    className={`inline-flex items-center justify-center w-8 h-4 rounded-full transition-colors ${
                                        requireAuth ? 'bg-emerald-500/80' : 'bg-slate-700'
                                    }`}
                                >
                                    <span
                                        className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                                            requireAuth ? 'translate-x-2' : '-translate-x-2'
                                        }`}
                                    />
                                </button>
                                {t('require_auth')}
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5 disabled:opacity-50"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving || saveDisabled}
                        title={saveTitle}
                        className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 disabled:opacity-50"
                    >
                        {isSaving ? t('saving') : t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccessControlModal;
