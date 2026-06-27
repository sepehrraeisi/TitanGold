import React from 'react';
import { AIAgent } from '../../../../../../../types';
import {
    BTN_OUTLINE_AMBER,
    BTN_OUTLINE_EMERALD,
    BTN_OUTLINE_RED,
    BTN_OUTLINE_SKY,
    BTN_OUTLINE_SLATE,
    StatusPill,
    dataHubWriteGate,
} from '../../dataHubUi';
import {
    topicValidityLabel,
    topicValidityVariant,
} from './automationErrorLabels';

interface AutomationTopicListProps {
    topics: any[];
    agentMap: Record<string, AIAgent>;
    publisherMap: Record<string, { id?: string; name?: string; isActive?: boolean }>;
    activePublisherId?: string | null;
    canWrite: boolean;
    t: (key: string) => string;
    onEdit: (topic: any, repair?: { publisherId?: string }) => void;
    onDelete: (topicId: string) => void;
    onValidate: (topicId: string) => void;
    onTestDryRun: (topicId: string) => void;
    deletingTopicId: string | null;
    validatingTopicId: string | null;
    testingTopicId: string | null;
}

const AutomationTopicList: React.FC<AutomationTopicListProps> = ({
    topics,
    agentMap,
    publisherMap,
    activePublisherId,
    canWrite,
    t,
    onEdit,
    onDelete,
    onValidate,
    onTestDryRun,
    deletingTopicId,
    validatingTopicId,
    testingTopicId,
}) => {
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);

    return (
        <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-foreground px-1">
                {t('active_routing_rules')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map(topic => {
                    const validityStatus = topic.validity?.status || 'disabled_publisher';
                    const isValid = topic.validity?.valid === true;
                    return (
                        <div
                            key={topic.id}
                            className={`rounded-xl border p-4 transition-colors ${
                                isValid
                                    ? 'border-emerald-500/30 bg-slate-900/60'
                                    : 'border-amber-500/40 bg-amber-500/5'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3 gap-2">
                                <div className="min-w-0">
                                    <h5 className="text-sm font-semibold text-foreground truncate">
                                        {topic.title || topic.name}
                                    </h5>
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        <StatusPill
                                            label={topicValidityLabel(validityStatus, t)}
                                            variant={topicValidityVariant(validityStatus)}
                                        />
                                        <StatusPill
                                            label={topic.enabled ? t('enabled') : t('disabled')}
                                            variant={topic.enabled ? 'success' : 'neutral'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {!isValid && topic.validity?.reasons?.length > 0 && (
                                <p className="text-[10px] text-amber-200 mb-3 leading-relaxed">
                                    {topic.validity.reasons[0]}
                                </p>
                            )}

                            <div className="space-y-2 text-[11px]">
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{t('target_agent')}:</span>
                                    <span className="text-purple-300 font-medium truncate">
                                        {topic.agentId
                                            ? agentMap[topic.agentId]?.name
                                            : t('unknown_agent')}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{t('publish_to')}:</span>
                                    <span className="text-sky-300 font-medium truncate max-w-[180px]">
                                        {topic.publisherTargets?.length > 0
                                            ? topic.publisherTargets
                                                  .map((id: string) => {
                                                      const publisher = publisherMap[id];
                                                      const state = publisher?.isActive
                                                          ? t('enabled')
                                                          : t('disabled');
                                                      return `${publisher?.name || id} (${state})`;
                                                  })
                                                  .join(', ')
                                            : t('none')}
                                    </span>
                                </div>
                                {topic.validity?.matchingCandidates != null && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">
                                            {t('automation_matching_candidates') || 'Matching records'}:
                                        </span>
                                        <span className="text-foreground font-medium">
                                            {topic.validity.matchingCandidates}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onEdit(topic)}
                                    className={BTN_OUTLINE_SLATE}
                                    disabled={wg().disabled}
                                    title={wg().title}
                                >
                                    {t('edit')}
                                </button>
                                {!isValid && activePublisherId && (
                                    <button
                                        type="button"
                                        onClick={() => onEdit(topic, { publisherId: activePublisherId })}
                                        className={BTN_OUTLINE_AMBER}
                                        disabled={wg().disabled}
                                        title={wg().title}
                                    >
                                        {t('automation_select_active_publisher') || 'Select active publisher'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onValidate(topic.id)}
                                    className={BTN_OUTLINE_SKY}
                                    disabled={wg(validatingTopicId === topic.id).disabled}
                                    title={wg(validatingTopicId === topic.id).title}
                                >
                                    {validatingTopicId === topic.id
                                        ? t('processing')
                                        : t('automation_validate') || 'Validate'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onTestDryRun(topic.id)}
                                    className={BTN_OUTLINE_EMERALD}
                                    disabled={wg(!isValid || testingTopicId === topic.id).disabled}
                                    title={
                                        !isValid
                                            ? t('automation_fix_topic_first') ||
                                              'Fix topic configuration before dry-run test'
                                            : wg(testingTopicId === topic.id).title
                                    }
                                >
                                    {testingTopicId === topic.id
                                        ? t('processing')
                                        : t('automation_test_dry_run') || 'Test dry-run'}
                                </button>
                                <button
                                    type="button"
                                    disabled={wg(deletingTopicId === topic.id).disabled}
                                    title={wg(deletingTopicId === topic.id).title}
                                    onClick={() => onDelete(topic.id)}
                                    className={BTN_OUTLINE_RED}
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AutomationTopicList;
