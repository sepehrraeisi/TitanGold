import React, { useState, useEffect } from 'react';
import { AIAgent, DataCategory, TelegramPublisher, AgentTopicRoute, AgentTopicFormValues, NormalizedDataStatus } from '../../../../../../types.ts';

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
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        if (!agentId) {
            alert(t('automation_topic_agent_required') || 'Select an agent for this route.');
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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {topic ? t('automation_topic_modal_title_edit') || 'Edit Routing' : t('automation_topic_modal_title_create') || 'Create Routing'}
                </h3>
                <div className="space-y-4 text-sm">
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('title') || 'Title'} *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-border rounded"
                            placeholder="Signals for Crypto VIP"
                        />
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('description') || 'Description'}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-border rounded"
                            rows={3}
                            placeholder={t('automation_topic_description_placeholder') || 'Explain what this route does'}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_agent') || 'Agent'} *</label>
                            <select
                                value={agentId}
                                onChange={e => setAgentId(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                disabled={isLoadingAgents || agents.length === 0}
                            >
                                {agents.length === 0 ? (
                                    <option value="">{t('automation_no_agents_available') || 'No agents available'}</option>
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
                            <label className="block text-muted-foreground mb-1">{t('priority') || 'Priority'}</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as AgentTopicFormValues['priority'])}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
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
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_categories') || 'Categories'}</label>
                            <select
                                multiple
                                value={categoryIds}
                                onChange={e => handleMultiSelectChange(e, setCategoryIds)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[120px]"
                            >
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_datatypes') || 'Data types'}</label>
                            <select
                                multiple
                                value={dataTypeSelection}
                                onChange={e => handleMultiSelectChange(e, setDataTypeSelection)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[120px]"
                            >
                                {dataTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_pass_rate') || 'Min pass rate (%)'}</label>
                            <input
                                type="number"
                                value={minPassRate}
                                onChange={e => setMinPassRate(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="e.g. 70"
                            />
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_min_quality') || 'Min quality score'}</label>
                            <input
                                type="number"
                                value={minQualityScore}
                                onChange={e => setMinQualityScore(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="e.g. 75"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-muted-foreground mb-1">{t('automation_topic_statuses') || 'Allowed statuses'}</label>
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
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_publishers') || 'Publishers'}</label>
                            <select
                                multiple
                                value={publisherTargets}
                                onChange={e => handleMultiSelectChange(e, setPublisherTargets)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded min-h-[100px]"
                            >
                                {publishers.length === 0 && <option value="">{t('automation_topic_publishers_none') || 'No Telegram publishers configured'}</option>}
                                {publishers.map(publisher => (
                                    <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-muted-foreground mb-1">{t('automation_topic_tags') || 'Tags (comma separated)'}</label>
                            <input
                                value={tagsInput}
                                onChange={e => setTagsInput(e.target.value)}
                                className="w-full px-3 py-2 bg-secondary border border-border rounded"
                                placeholder="signal, persian, vip"
                            />
                            <label className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={e => setEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                {t('automation_topic_enabled') || 'Route enabled'}
                            </label>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                        {isSaving ? t('saving') || 'Saving...' : (t('save') || 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutomationTopicModal;

