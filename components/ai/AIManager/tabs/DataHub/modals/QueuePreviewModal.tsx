import React from 'react';
import { PublisherQueueItem, AgentTopicRoute, NormalizedDataRecord, AIAgent } from '../../../../../../types';
import { DataHubModal, BTN_PRIMARY, BTN_SECONDARY } from '../dataHubUi';

const QueuePreviewModal: React.FC<{
    item: PublisherQueueItem;
    topic: AgentTopicRoute | null;
    publisherName?: string;
    record: NormalizedDataRecord | null;
    agent?: AIAgent;
    onClose: () => void;
    onPublish: () => Promise<void> | void;
    t: (key: string) => string;
    processingId: string | null;
}> = ({ item, topic, publisherName, record, agent, onClose, onPublish, t, processingId }) => {
    const statusKey = `normalized_status_${item.normalizedStatus}`;

    return (
        <DataHubModal
            title={t('automation_preview_title')}
            subtitle={`${topic?.title || item.topicId} → ${publisherName || item.publisherId}`}
            onClose={onClose}
            maxWidth="max-w-3xl"
            footer={
                <>
                    <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onPublish}
                        disabled={processingId === item.id + 'sent'}
                        className={BTN_PRIMARY}
                    >
                        {processingId === item.id + 'sent' ? t('processing') : t('dry_run_publish')}
                    </button>
                </>
            }
        >
            <div className="space-y-4 text-[11px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/5 bg-slate-950/70 p-3">
                        <p className="text-muted-foreground text-[10px]">{t('automation_queue_quality')}</p>
                        <p className="text-foreground font-semibold">{item.qualityScore}</p>
                        <p className="text-muted-foreground mt-1">
                            {t('priority')}: {t(item.priority)}
                        </p>
                        <p className="text-muted-foreground mt-1">{t(statusKey)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-slate-950/70 p-3">
                        <p className="text-muted-foreground text-[10px]">{t('automation_preview_agent')}</p>
                        <p className="text-foreground font-semibold">{agent?.name || item.agentId}</p>
                        <p className="text-muted-foreground mt-1">{topic?.description || '—'}</p>
                    </div>
                </div>
                <div>
                    <p className="text-[10px] text-muted-foreground mb-1">{t('automation_preview_payload')}</p>
                    <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-foreground space-y-2">
                        <p className="font-semibold">{record?.payload?.title || item.payloadPreview}</p>
                        {record?.payload?.content && (
                            <p className="text-muted-foreground whitespace-pre-wrap">{record.payload.content}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-4">
                            <span>
                                {t('source')}: {record?.sourceId || '—'}
                            </span>
                            <span>
                                {t('data_type')}: {record?.dataType || item.dataType}
                            </span>
                            <span>
                                {t('category')}: {record?.category || item.category}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </DataHubModal>
    );
};

export default QueuePreviewModal;
