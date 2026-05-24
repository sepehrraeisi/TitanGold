
import React from 'react';
import { AIAgent } from '../../../../../../../types';
import { ActionButton } from '../../../../../../ui/action-button';
import { StatusBadge } from '../../../../../../ui/status-badge';

interface AutomationTopicListProps {
    topics: any[];
    agentMap: Record<string, AIAgent>;
    publisherMap: Record<string, any>;
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
    deletingTopicId
}) => {
    return (
        <div className="space-y-3">
            <h4 className="text-sm font-semibold px-1">{t('active_routing_rules') || 'Routing Topics'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map(topic => (
                    <div key={topic.id} className="border border-border rounded-lg p-4 bg-secondary/5 hover:bg-secondary/10 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h5 className="font-bold text-foreground">{topic.title || topic.name}</h5>
                                <div className="flex gap-2 mt-1">
                                    <StatusBadge
                                        status={topic.enabled ? 'success' : 'neutral'}
                                        label={topic.enabled ? 'Enabled' : 'Disabled'}
                                        size="sm"
                                    />
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                        {topic.dataTypes?.[0] || topic.source_type || 'pipeline'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <ActionButton variant="ghost" size="sm" onClick={() => onEdit(topic)}>
                                    {t('edit') || 'Edit'}
                                </ActionButton>
                                <ActionButton
                                    variant="danger"
                                    size="sm"
                                    loading={deletingTopicId === topic.id}
                                    onClick={() => onDelete(topic.id)}
                                >
                                    {t('delete') || 'Delete'}
                                </ActionButton>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{t('target_agent') || 'Agent'}:</span>
                                <span className="text-purple-300 font-medium">
                                    {topic.agentId ? agentMap[topic.agentId]?.name : 'Unknown Agent'}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{t('publish_to') || 'Publish to'}:</span>
                                <span className="text-blue-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                    {topic.publisherTargets.length > 0
                                        ? topic.publisherTargets.map((id: string) => publisherMap[id]?.name || id).join(', ')
                                        : (t('none') || 'None')}
                                </span>
                            </div>
                        </div>

                        {topic.stats?.last24h && (
                            <div className="mt-4 pt-3 border-t border-border/30 flex justify-between">
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground uppercase">{t('processed') || 'Processed'}</p>
                                    <p className="text-xs font-bold">{topic.stats.last24h.total || 0}</p>
                                </div>
                                <div className="text-center flex-1 border-x border-border/30">
                                    <p className="text-[10px] text-muted-foreground uppercase">{t('rejected') || 'Rejected'}</p>
                                    <p className="text-xs font-bold text-red-400">{topic.stats.last24h.rejected || 0}</p>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-muted-foreground uppercase">{t('pass_rate') || 'Pass Rate'}</p>
                                    <p className="text-xs font-bold text-green-400">{topic.stats.last24h.passRate || 0}%</p>
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
