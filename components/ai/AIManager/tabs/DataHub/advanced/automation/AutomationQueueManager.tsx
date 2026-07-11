import React from 'react';
import {
    DATAHUB_INNER_LIST,
    BTN_PRIMARY,
    BTN_OUTLINE_EMERALD,
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SLATE,
    DataHubEmpty,
    StatusPill,
    dataHubWriteGate,
} from '../../dataHubUi';
import type { AutomationRefreshSummary } from '../../../../../../../services/datahubAutomationApi';

interface AutomationQueueManagerProps {
    queue: any[];
    isDryRun: boolean;
    canWrite: boolean;
    isDispatching: boolean;
    onDispatch: () => void;
    onPreview: (item: any) => void;
    onProcess: (itemId: string, action: 'sent' | 'failed') => void;
    processingId: string | null;
    formatTimeAgo: (timestamp?: string) => string;
    emptyMessage: string;
    refreshSummary?: AutomationRefreshSummary | null;
    t: (key: string) => string;
}

const AutomationQueueManager: React.FC<AutomationQueueManagerProps> = ({
    queue,
    isDryRun,
    canWrite,
    isDispatching,
    onDispatch,
    onPreview,
    onProcess,
    processingId,
    formatTimeAgo,
    emptyMessage,
    refreshSummary,
    t,
}) => {
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const pendingCount = queue.filter(item => item.status === 'pending').length;

    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-2">
                        {t('automation_queue')}
                        <StatusPill
                            label={String(pendingCount)}
                            variant={pendingCount > 0 ? 'warning' : 'neutral'}
                        />
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('automation_queue_desc')} · {isDryRun ? t('dry_run') : t('live_requires_confirmation')}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={wg(pendingCount === 0 || isDispatching).disabled}
                    title={
                        pendingCount === 0
                            ? t('automation_no_pending_items') || 'No pending queue items to dispatch'
                            : wg(pendingCount === 0 || isDispatching).title
                    }
                    onClick={onDispatch}
                    className={BTN_PRIMARY}
                >
                    {isDispatching ? t('dispatching') : isDryRun ? t('dispatch_queue_dry_run') : t('dispatch_queue_live')}
                </button>
            </div>

            {refreshSummary && (
                <div className="mb-4 rounded-lg border border-white/5 bg-slate-950/60 p-3 text-[10px] text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                        <span className="block text-foreground font-medium">{refreshSummary.candidates}</span>
                        {t('automation_candidates') || 'Candidates'}
                    </div>
                    <div>
                        <span className="block text-emerald-300 font-medium">{refreshSummary.queued}</span>
                        {t('automation_queued') || 'Queued'}
                    </div>
                    <div>
                        <span className="block text-amber-300 font-medium">{refreshSummary.skipped}</span>
                        {t('skipped')}
                    </div>
                    <div>
                        <span className="block text-red-300 font-medium">{refreshSummary.blocked}</span>
                        {t('blocked')}
                    </div>
                    {refreshSummary.reasons?.length > 0 && (
                        <div className="col-span-full mt-1 space-y-1">
                            {refreshSummary.reasons.map(reason => (
                                <p key={reason.code} className="text-amber-200/90">
                                    {reason.label} ({reason.count})
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {queue.filter(item => item.status === 'pending').length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                        <thead>
                            <tr className="border-b border-slate-800 text-muted-foreground">
                                <th className="py-2 pr-2">{t('time')}</th>
                                <th className="py-2 pr-2">{t('topic')}</th>
                                <th className="py-2 pr-2">{t('publisher')}</th>
                                <th className="py-2 pr-2">{t('data_preview')}</th>
                                <th className="py-2 pr-2">{t('priority')}</th>
                                <th className="py-2 pr-2">{t('mode')}</th>
                                <th className="py-2 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue
                                .filter(item => item.status === 'pending')
                                .map(item => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-slate-900/60 hover:bg-slate-900/40"
                                    >
                                        <td className="py-2 pr-2 text-muted-foreground">
                                            {formatTimeAgo(item.createdAt)}
                                        </td>
                                        <td className="py-2 pr-2 font-medium">{item.topicId}</td>
                                        <td className="py-2 pr-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sky-300">
                                                    {item.publisherName || item.publisherId}
                                                </span>
                                                <StatusPill
                                                    label={item.publisherActive ? t('enabled') : t('disabled')}
                                                    variant={item.publisherActive ? 'success' : 'error'}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-2 pr-2 truncate max-w-[150px]">
                                            {item.payloadPreview}
                                        </td>
                                        <td className="py-2 pr-2">
                                            <StatusPill label={`${item.priority}/10`} variant="info" />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <StatusPill
                                                label={isDryRun ? t('dry_run') : t('live')}
                                                variant={isDryRun ? 'info' : 'warning'}
                                            />
                                        </td>
                                        <td className="py-2 text-right">
                                            <div className="flex justify-end gap-1 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => onPreview(item)}
                                                    className={BTN_OUTLINE_SLATE}
                                                >
                                                    {t('view')}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={wg(processingId === item.id || !item.publisherActive).disabled}
                                                    title={
                                                        !item.publisherActive
                                                            ? t('automation_publisher_disabled') ||
                                                              'Publisher is disabled'
                                                            : wg(processingId === item.id).title
                                                    }
                                                    onClick={() => onProcess(item.id, 'sent')}
                                                    className={BTN_OUTLINE_EMERALD}
                                                >
                                                    {isDryRun ? t('dry_run_publish') : t('publish_now')}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={wg().disabled}
                                                    title={wg().title}
                                                    onClick={() => onProcess(item.id, 'failed')}
                                                    className={BTN_OUTLINE_RED}
                                                >
                                                    {t('reject')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <DataHubEmpty message={emptyMessage} />
            )}
        </div>
    );
};

export default AutomationQueueManager;
