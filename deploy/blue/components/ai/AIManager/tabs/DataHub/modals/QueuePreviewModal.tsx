import React from 'react';
import { PublisherQueueItem, AgentTopicRoute, NormalizedDataRecord, AIAgent, TelegramPublisher } from '../../../../../../types.ts';

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
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{t('automation_preview_title') || 'Preview'}</h3>
                        <p className="text-xs text-muted-foreground">{topic?.title || item.topicId} → {publisherName || item.publisherId}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">{t('close') || 'Close'}</button>
                </div>
                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-secondary/30 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('automation_queue_quality') || 'Quality'}</p>
                            <p className="text-foreground font-semibold">{item.qualityScore}</p>
                            <p className="text-muted-foreground mt-1">{t('priority') || 'Priority'}: {t(item.priority) || item.priority}</p>
                            <p className="text-muted-foreground mt-1">{t('normalized_status_' + item.normalizedStatus) || item.normalizedStatus}</p>
                        </div>
                        <div className="bg-secondary/30 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('automation_preview_agent') || 'Agent'}</p>
                            <p className="text-foreground font-semibold">{agent?.name || item.agentId}</p>
                            <p className="text-muted-foreground mt-1">{topic?.description || '-'}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('automation_preview_payload') || 'Payload'}</p>
                        <div className="bg-secondary/30 border border-border rounded p-3 text-sm text-foreground space-y-2">
                            <p className="font-semibold">{record?.payload?.title || item.payloadPreview}</p>
                            {record?.payload?.content && (
                                <p className="text-muted-foreground whitespace-pre-wrap">{record.payload.content}</p>
                            )}
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span>{t('source') || 'Source'}: {record?.sourceId || '-'}</span>
                                <span>{t('data_type') || 'Data type'}: {record?.dataType || item.dataType}</span>
                                <span>{t('category') || 'Category'}: {record?.category || item.category}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={onPublish}
                        disabled={processingId === item.id + 'sent'}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {processingId === item.id + 'sent' ? (t('processing') || 'Processing...') : (t('automation_queue_publish_now') || 'Publish now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QueuePreviewModal;

