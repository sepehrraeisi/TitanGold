
import React from 'react';
import { ActionButton } from '../../../../../../ui/action-button';
import { StatusBadge } from '../../../../../../ui/status-badge';
import { EmptyState } from '../../../../../../ui/empty-state';

interface AutomationQueueManagerProps {
    queue: any[];
    isDispatching: boolean;
    onDispatch: () => void;
    onPreview: (item: any) => void;
    onProcess: (itemId: string, action: 'approve' | 'reject') => void;
    processingId: string | null;
    formatTimeAgo: (timestamp?: string) => string;
    t: (key: string) => string;
}

const AutomationQueueManager: React.FC<AutomationQueueManagerProps> = ({
    queue,
    isDispatching,
    onDispatch,
    onPreview,
    onProcess,
    processingId,
    formatTimeAgo,
    t
}) => {
    return (
        <div className="bg-secondary/10 border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        📥 {t('automation_queue') || 'Automation Queue'}
                        <StatusBadge status={queue.length > 0 ? 'warning' : 'neutral'} label={`${queue.length} items`} size="sm" />
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('automation_queue_desc') || 'Data items waiting for processing and publication.'}
                    </p>
                </div>
                <ActionButton
                    variant="success"
                    size="sm"
                    disabled={queue.length === 0}
                    loading={isDispatching}
                    onClick={onDispatch}
                >
                    🚀 {t('dispatch_queue') || 'Dispatch All'}
                </ActionButton>
            </div>

            {queue.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="text-muted-foreground border-b border-border/50">
                            <tr>
                                <th className="py-2 px-1">{t('time') || 'Time'}</th>
                                <th className="py-2 px-1">{t('topic') || 'Topic'}</th>
                                <th className="py-2 px-1">{t('data_preview') || 'Preview'}</th>
                                <th className="py-2 px-1">{t('priority') || 'Priority'}</th>
                                <th className="py-2 px-1 text-right">{t('actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(item => (
                                <tr key={item.id} className="border-b border-border/30 hover:bg-secondary/10">
                                    <td className="py-2 px-1 text-muted-foreground">{formatTimeAgo(item.createdAt)}</td>
                                    <td className="py-2 px-1 font-medium">{item.topicId}</td>
                                    <td className="py-2 px-1 truncate max-w-[150px]">{item.payloadPreview}</td>
                                    <td className="py-2 px-1">
                                        <StatusBadge
                                            status={item.priority > 7 ? 'error' : item.priority > 4 ? 'warning' : 'success'}
                                            label={`${item.priority}/10`}
                                            size="sm"
                                        />
                                    </td>
                                    <td className="py-2 px-1 text-right">
                                        <div className="flex justify-end gap-1">
                                            <ActionButton variant="ghost" size="xs" onClick={() => onPreview(item)}>
                                                {t('view') || 'View'}
                                            </ActionButton>
                                            <ActionButton
                                                variant="success"
                                                size="xs"
                                                loading={processingId === item.id}
                                                onClick={() => onProcess(item.id, 'approve')}
                                            >
                                                {t('approve') || 'Approve'}
                                            </ActionButton>
                                            <ActionButton
                                                variant="danger"
                                                size="xs"
                                                onClick={() => onProcess(item.id, 'reject')}
                                            >
                                                {t('reject') || 'Reject'}
                                            </ActionButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState
                    title={t('queue_empty') || 'Queue is empty'}
                    description={t('queue_empty_desc') || 'New data items will appear here for review before publishing.'}
                    icon={<span className="text-3xl">🏜️</span>}
                    className="py-6"
                />
            )}
        </div>
    );
};

export default AutomationQueueManager;
