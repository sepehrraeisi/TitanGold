import React, { useState, useEffect } from 'react';
import { DataHubModal, INPUT_CLASS, SELECT_CLASS, BTN_PRIMARY, BTN_SECONDARY, DataHubToggle } from '../dataHubUi';
import { AIAgent, DataCategory, TelegramPublisher, AgentTopicRoute, AgentTopicFormValues, NormalizedDataStatus } from '../../../../../../types';

const AutomationTopicModal: React.FC<{
    topic: AgentTopicRoute | null;
    agents: AIAgent[];
    isLoadingAgents: boolean;
    categories: DataCategory[];
    dataTypes: string[];
    publishers: TelegramPublisher[];
    isSaving: boolean;
    onClose: () => void;
    onSave: (values: AgentTopicFormValues) => Promise<void> | void;
    t: (key: string) => string;
}> = ({ topic, agents, isLoadingAgents, categories, dataTypes, publishers, isSaving, onClose, onSave, t }) => {
    const [title, setTitle] = useState(topic?.title || '');
    const [description, setDescription] = useState(topic?.description || '');
    const [agentId, setAgentId] = useState(topic?.agentId || (agents[0]?.id ?? ''));
    const [categoryIds, setCategoryIds] = useState<string[]>(topic?.categoryIds || []);
    const [dataTypeSelection, setDataTypeSelection] = useState<string[]>(topic?.dataTypes || []);
    const [tagsInput, setTagsInput] = useState(topic?.tags?.join(', ') || '');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(topic?.priority || 'medium');
    const [minPassRate, setMinPassRate] = useState<string>(topic?.minPassRate !== undefined ? String(topic.minPassRate) : '');
    const [minQualityScore, setMinQualityScore] = useState<string>(topic?.minQualityScore !== undefined ? String(topic.minQualityScore) : '');
    const [includeStatuses, setIncludeStatuses] = useState<NormalizedDataStatus[]>(topic?.includeStatuses || ['ready']);
    const [publisherTargets, setPublisherTargets] = useState<string[]>(topic?.publisherTargets || []);
    const [enabled, setEnabled] = useState(topic?.enabled ?? true);
    const statusOptions: NormalizedDataStatus[] = ['ready', 'warning', 'rejected'];

    useEffect(() => {
        if (!agentId && agents.length > 0) {
            setAgentId(agents[0].id);
        }
    }, [agents, agentId]);

    const handleMultiSelectChange = (event: React.ChangeEvent<HTMLSelectElement>, setter: (values: string[]) => void) => {
        const values = Array.from(event.target.selectedOptions).map(option => option.value);
        setter(values);
    };

    const handleStatusToggle = (status: NormalizedDataStatus) => {
        setIncludeStatuses(prev => prev.includes(status) ? prev.filter(item => item !== status) : [...prev, status]);
    };

    const handleSubmit = () => {
        if (!title.trim()) {
            alert(t('fill_required_fields'));
            return;
        }
        if (!agentId) {
            alert(t('automation_topic_agent_required'));
            return;
        }
        const parsedPassRate = minPassRate.trim() !== '' ? Number(minPassRate) : undefined;
        const parsedQuality = minQualityScore.trim() !== '' ? Number(minQualityScore) : undefined;
        const tags = tagsInput
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
        onSave({
            title: title.trim(),
            description: description.trim() || undefined,
            agentId,
            categoryIds,
            dataTypes: dataTypeSelection,
            tags,
            priority,
            minPassRate: parsedPassRate,
            minQualityScore: parsedQuality,
            includeStatuses: includeStatuses.length > 0 ? includeStatuses : ['ready'],
            publisherTargets,
            enabled,
        });
    };

    const modalTitle = topic ? t('automation_topic_modal_title_edit') : t('automation_topic_modal_title_create');

    return (
        <DataHubModal
            title={modalTitle}
            onClose={onClose}
            maxWidth="max-w-3xl"
            footer={
                <>
                    <button type="button" onClick={onClose} disabled={isSaving} className={BTN_SECONDARY}>
                        {t('cancel')}
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={isSaving} className={BTN_PRIMARY}>
                        {isSaving ? t('saving') : t('save')}
                    </button>
                </>
            }
        >
                <div className="space-y-4 text-[11px]">
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('title')} *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="Signals for Crypto VIP"
                        />
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('description')}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className={INPUT_CLASS}
                            rows={3}
                            placeholder={t('automation_topic_description_placeholder')}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_agent')} *</label>
                            <select
                                value={agentId}
                                onChange={e => setAgentId(e.target.value)}
                                className={SELECT_CLASS}
                                disabled={isLoadingAgents || agents.length === 0}
                            >
                                {agents.length === 0 ? (
                                    <option value="">{t('automation_no_agents_available')}</option>
                                ) : (
                                    agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.name} — {agent.role}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('priority')}</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as AgentTopicFormValues['priority'])}
                                className={SELECT_CLASS}
                            >
                                {['low', 'medium', 'high', 'critical'].map(level => (
                                    <option key={level} value={level}>
                                        {t(level) || level}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_categories')}</label>
                            <select
                                multiple
                                value={categoryIds}
                                onChange={e => handleMultiSelectChange(e, setCategoryIds)}
                                className={`${INPUT_CLASS} min-h-[120px]`}
                            >
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_datatypes')}</label>
                            <select
                                multiple
                                value={dataTypeSelection}
                                onChange={e => handleMultiSelectChange(e, setDataTypeSelection)}
                                className={`${INPUT_CLASS} min-h-[120px]`}
                            >
                                {dataTypes.map(type => (
                                    <option key={type} value={type}>
                                        {type === 'telegram' ? `📱 ${type}` : type}
                                    </option>
                                ))}
                            </select>
                            {dataTypeSelection.includes('telegram') && (
                                <p className="text-[10px] text-sky-300/80 mt-1">
                                    {t('telegram_automation_hint')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_pass_rate')}</label>
                            <input
                                type="number"
                                value={minPassRate}
                                onChange={e => setMinPassRate(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder="e.g. 70"
                            />
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_quality')}</label>
                            <input
                                type="number"
                                value={minQualityScore}
                                onChange={e => setMinQualityScore(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder="e.g. 75"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('automation_topic_statuses')}</label>
                        <div className="flex flex-wrap gap-3 text-xs">
                            {statusOptions.map(status => (
                                <label key={status} className="flex items-center gap-1">
                                    <input
                                        type="checkbox"
                                        checked={includeStatuses.includes(status)}
                                        onChange={() => handleStatusToggle(status)}
                                        className="rounded"
                                    />
                                    {t(`normalized_status_${status}`) || status}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_publishers')}</label>
                            <select
                                multiple
                                value={publisherTargets}
                                onChange={e => handleMultiSelectChange(e, setPublisherTargets)}
                                className={`${INPUT_CLASS} min-h-[100px]`}
                            >
                                {publishers.length === 0 && <option value="">{t('automation_topic_publishers_none')}</option>}
                                {publishers.map(publisher => (
                                    <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_tags')}</label>
                            <input
                                value={tagsInput}
                                onChange={e => setTagsInput(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder="signal, persian, vip"
                            />
                            <div className="mt-3">
                                <DataHubToggle
                                    id="automation-topic-enabled"
                                    checked={enabled}
                                    onChange={setEnabled}
                                    label={t('automation_topic_enabled')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
        </DataHubModal>
    );
};

export default AutomationTopicModal;

