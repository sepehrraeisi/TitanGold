import React from 'react';
import { DataAccessLog } from '../../../../../../types';
import { DataHubModal, BTN_PRIMARY, BTN_SECONDARY, StatusPill } from '../dataHubUi';

function logStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'timeout') return 'warning';
    if (status === 'cached') return 'info';
    return 'neutral';
}

function formatExecutionTime(
    log: DataAccessLog,
    t: (key: string) => string,
): string {
    if (log.responseTime != null && Number.isFinite(log.responseTime)) {
        return `${log.responseTime} ms`;
    }
    const durationMs = log.metadata?.duration_ms;
    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
        return `${durationMs} ms`;
    }
    return t('not_available');
}

function formatMetadata(metadata: Record<string, unknown> | undefined): string {
    if (!metadata || Object.keys(metadata).length === 0) {
        return '{}';
    }
    try {
        return JSON.stringify(metadata, null, 2);
    } catch {
        return String(metadata);
    }
}

const AccessLogDetailModal: React.FC<{
    log: DataAccessLog;
    onClose: () => void;
    onOpenSource?: (sourceId: string) => void;
    t: (key: string) => string;
}> = ({ log, onClose, onOpenSource, t }) => {
    const displaySource = log.sourceName || t('unknown_source');
    const action = log.action || log.dataType;

    return (
        <DataHubModal
            title={t('log_details')}
            subtitle={displaySource}
            onClose={onClose}
            maxWidth="max-w-2xl"
            footer={
                <>
                    <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                        {t('close')}
                    </button>
                    {log.sourceId && onOpenSource && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenSource(log.sourceId);
                                onClose();
                            }}
                            className={BTN_PRIMARY}
                        >
                            {t('open_source')}
                        </button>
                    )}
                </>
            }
        >
            <div className="space-y-4 text-[11px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailField label={t('source')} value={displaySource} />
                    <DetailField label={t('log_action')} value={action} />
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t('status')}</p>
                        <StatusPill label={t(log.status)} variant={logStatusVariant(log.status)} />
                    </div>
                    <DetailField
                        label={t('arbitrage_execution_time')}
                        value={formatExecutionTime(log, t)}
                    />
                </div>

                <DetailField
                    label={t('log_message')}
                    value={log.message || log.error || '—'}
                    mono
                />

                <DetailField
                    label={t('created_at')}
                    value={new Date(log.timestamp).toLocaleString()}
                />

                <div>
                    <p className="text-[10px] text-muted-foreground mb-1">{t('metadata')}</p>
                    <pre className="max-h-48 overflow-auto rounded-lg border border-white/5 bg-slate-950/80 p-3 text-[10px] font-mono text-foreground whitespace-pre-wrap break-words">
                        {formatMetadata(log.metadata)}
                    </pre>
                </div>
            </div>
        </DataHubModal>
    );
};

function DetailField({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div>
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-foreground ${mono ? 'font-mono break-words' : ''}`}>{value}</p>
        </div>
    );
}

export default AccessLogDetailModal;
