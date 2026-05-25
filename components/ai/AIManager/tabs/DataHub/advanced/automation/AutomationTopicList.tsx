import React from 'react';
import { AIAgent } from '../../../../../../../types';
import {
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SLATE,
    StatusPill,
} from '../../dataHubUi';

interface AutomationTopicListProps {
    topics: any[];
    agentMap: Record<string, AIAgent>;
    publisherMap: Record<string, { name?: string }>;
    t: (key: string) => string;
    onEdit: (topic: any) => void;
    onDelete: (topicId: string) => void;
    deletingTopicId: string | null;
}

const AutomationTopicList: React.FC<AutomationTopicListProps> = ({
    topics,
    agentMap,
    publisherMap,
    t,
    onEdit,
    onDelete,
    deletingTopicId,
}) => {
    return (
        <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-foreground px-1">
                {t('active_routing_rules')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map(topic => (
                    <div
                        key={topic.id}
                        className="rounded-xl border border-white/5 bg-slate-900/60 p-4 hover:border-purple-500/40 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-3 gap-2">
                            <div className="min-w-0">
                                <h5 className="text-sm font-semibold text-foreground truncate">
                                    {topic.title || topic.name}
                                </h5>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                    <StatusPill
                                        label={topic.enabled ? t('enabled') : t('disabled')}
                                        variant={topic.enabled ? 'success' : 'neutral'}
                                    />
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                        {topic.dataTypes?.[0] || topic.source_type || 'pipeline'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button type="button" onClick={() => onEdit(topic)} className={BTN_OUTLINE_SLATE}>
                                    {t('edit')}
                                </button>
                                <button
                                    type="button"
                                    disabled={deletingTopicId === topic.id}
                                    onClick={() => onDelete(topic.id)}
                                    className={BTN_OUTLINE_RED}
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 text-[11px]">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">{t('target_agent')}:</span>
                                <span className="text-purple-300 font-medium truncate">
                                    {topic.agentId ? agentMap[topic.agentId]?.name : t('unknown_agent')}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">{t('publish_to')}:</span>
                                <span className="text-sky-300 font-medium truncate max-w-[150px]">
                                    {topic.publisherTargets?.length > 0
                                        ? topic.publisherTargets
                                              .map((id: string) => publisherMap[id]?.name || id)
                                              .join(', ')
                                        : t('none')}
                                </span>
                            </div>
                        </div>

                        {topic.stats?.last24h && (
                            <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2">
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground">{t('processed')}</p>
                                    <p className="text-xs font-semibold">{topic.stats.last24h.total || 0}</p>
                                </div>
                                <div className="text-center border-x border-slate-800/60">
                                    <p className="text-[10px] text-muted-foreground">{t('rejected')}</p>
                                    <p className="text-xs font-semibold text-red-300">
                                        {topic.stats.last24h.rejected || 0}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground">{t('pass_rate')}</p>
                                    <p className="text-xs font-semibold text-emerald-300">
                                        {topic.stats.last24h.passRate || 0}%
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AutomationTopicList;
