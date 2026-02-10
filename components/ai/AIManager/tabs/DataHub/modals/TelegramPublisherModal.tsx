import React, { useState } from 'react';
import { DataSource, DataCategory, AIAgent } from '../../../../../../types';

const TelegramPublisherModal: React.FC<{
    publisher?: any;
    sources: DataSource[];
    categories: DataCategory[];
    agents: AIAgent[];
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ publisher, sources, categories, agents, onClose, onSave, t }) => {
    const [name, setName] = useState(publisher?.name || '');
    const [botToken, setBotToken] = useState(publisher?.botToken || '');
    const [chatId, setChatId] = useState(publisher?.chatId || '');
    const [enabled, setEnabled] = useState(publisher?.enabled ?? true);
    const [template, setTemplate] = useState(publisher?.template || '{{data}}');
    const [selectedSources, setSelectedSources] = useState<string[]>(publisher?.filters?.sources || []);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(publisher?.filters?.categories || []);
    const [selectedAgents, setSelectedAgents] = useState<string[]>(publisher?.filters?.agentIds || []);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = t('publisher_name_required') || 'Publisher name is required.';
        }
        const token = botToken.trim();
        if (!token) {
            newErrors.botToken = t('publisher_token_required') || 'Bot token is required.';
        } else if (!/^\d{5,}:[A-Za-z0-9_-]{10,}$/.test(token)) {
            newErrors.botToken = t('publisher_token_invalid') || 'Bot token format looks invalid.';
        }
        const chat = chatId.trim();
        if (!chat) {
            newErrors.chatId = t('publisher_chat_required') || 'Chat ID is required.';
        } else if (!/^(-100)?\d+$/.test(chat) && !/^@[\w\d_]{5,}$/.test(chat)) {
            newErrors.chatId = t('publisher_chat_invalid') || 'Chat ID must be numeric (e.g. -100...) or @username.';
        }
        if (!template.includes('{{data}}')) {
            newErrors.template = t('publisher_template_placeholder_required') || 'Template must include {{data}} placeholder.';
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        
        setIsSaving(true);
        try {
            await onSave({
                name,
                botToken,
                chatId,
                enabled,
                template,
                filters: {
                    sources: selectedSources.length > 0 ? selectedSources : undefined,
                    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                    agentIds: selectedAgents.length > 0 ? selectedAgents : undefined,
                },
            });
        } catch (e) {
            console.error('Failed to save publisher:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {publisher ? t('edit_publisher') || 'Edit Publisher' : t('create_publisher') || 'Create Telegram Publisher'}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('publisher_name') || 'Publisher name'}
                        />
                        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('telegram_bot_token') || 'Telegram Bot Token'} *</label>
                        <input
                            type="password"
                            value={botToken}
                            onChange={(e) => setBotToken(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        />
                        {errors.botToken && <p className="text-xs text-red-400 mt-1">{errors.botToken}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('chat_id') || 'Chat ID'} *</label>
                        <input
                            type="text"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="-1001234567890"
                        />
                        {errors.chatId && <p className="text-xs text-red-400 mt-1">{errors.chatId}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('message_template') || 'Message Template'}</label>
                        <textarea
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            rows={4}
                            placeholder="{{data}} - Use {{data}} to insert data"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('template_hint') || 'Use {{data}} to insert data content'}
                        </p>
                        {errors.template && <p className="text-xs text-red-400 mt-1">{errors.template}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_sources') || 'Filter Sources'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {sources.map(source => (
                                <label key={source.id} className="flex items-center gap-2 text-sm mb-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedSources.includes(source.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedSources([...selectedSources, source.id]);
                                            } else {
                                                setSelectedSources(selectedSources.filter(id => id !== source.id));
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    {source.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_categories') || 'Filter Categories'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {categories.map(category => (
                                <label key={category.id} className="flex items-center gap-2 text-sm mb-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(category.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedCategories([...selectedCategories, category.id]);
                                            } else {
                                                setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    {category.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-2">{t('filter_agents') || 'Filter Agents'} (Optional)</label>
                        <div className="max-h-32 overflow-y-auto border border-border rounded p-2">
                            {agents.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t('automation_no_agents_available') || 'No agents available'}</p>
                            ) : (
                                agents.map(agent => (
                                    <label key={agent.id} className="flex items-center gap-2 text-sm mb-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedAgents.includes(agent.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedAgents([...selectedAgents, agent.id]);
                                                } else {
                                                    setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        {agent.name} — {agent.role}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="rounded"
                            />
                            {t('enabled') || 'Enabled'}
                        </label>
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
                        {isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramPublisherModal;

