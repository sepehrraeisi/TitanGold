import React from 'react';
import {
    DATAHUB_INNER_LIST,
    BTN_PRIMARY,
    BTN_OUTLINE_EMERALD,
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SLATE,
    DataHubEmpty,
    StatusPill,
} from '../../dataHubUi';

interface AutomationQueueManagerProps {
    queue: any[];
    isDispatching: boolean;
    onDispatch: () => void;
    onPreview: (item: any) => void;
    onProcess: (itemId: string, action: 'sent' | 'failed') => void;
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
    t,
}) => {
    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-2">
                        {t('automation_queue')}
                        <StatusPill
                            label={String(queue.length)}
                            variant={queue.length > 0 ? 'warning' : 'neutral'}
                        />
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('automation_queue_desc')}</p>
                </div>
                <button
                    type="button"
                    disabled={queue.length === 0 || isDispatching}
                    onClick={onDispatch}
                    className={BTN_PRIMARY}
                >
                    {isDispatching ? t('dispatching') : t('dispatch_queue')}
                </button>
            </div>

            {queue.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                        <thead>
                            <tr className="border-b border-slate-800 text-muted-foreground">
                                <th className="py-2 pr-2">{t('time')}</th>
                                <th className="py-2 pr-2">{t('topic')}</th>
                                <th className="py-2 pr-2">{t('data_preview')}</th>
                                <th className="py-2 pr-2">{t('priority')}</th>
                                <th className="py-2 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(item => (
                                <tr
                                    key={item.id}
                                    className="border-b border-slate-900/60 hover:bg-slate-900/40"
                                >
                                    <td className="py-2 pr-2 text-muted-foreground">
                                        {formatTimeAgo(item.createdAt)}
                                    </td>
                                    <td className="py-2 pr-2 font-medium">{item.topicId}</td>
                                    <td className="py-2 pr-2 truncate max-w-[150px]">{item.payloadPreview}</td>
                                    <td className="py-2 pr-2">
                                        <StatusPill
                                            label={`${item.priority}/10`}
                                            variant={
                                                item.priority > 7
                                                    ? 'error'
                                                    : item.priority > 4
                                                      ? 'warning'
                                                      : 'success'
                                            }
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
                                                disabled={processingId === item.id}
                                                onClick={() => onProcess(item.id, 'sent')}
                                                className={BTN_OUTLINE_EMERALD}
                                            >
                                                {t('approve')}
                                            </button>
                                            <button
                                                type="button"
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
                <DataHubEmpty message={t('queue_empty')} />
            )}
        </div>
    );
};

export default AutomationQueueManager;
