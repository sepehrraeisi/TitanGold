import React, { useState } from 'react';
import { DataCategory } from '../../../../../../types';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';

type Props = {
    category?: DataCategory | null;
    onClose: () => void;
    onSave: (category: Omit<DataCategory, 'id' | 'createdAt' | 'sourceCount'>) => Promise<void>;
    t: (key: string) => string;
};

const CreateCategoryModal: React.FC<Props> = ({ category, onClose, onSave, t }) => {
    const [name, setName] = useState(category?.name || '');
    const [description, setDescription] = useState(category?.description || '');
    const [color, setColor] = useState(category?.color || '#9333ea');
    const [icon, setIcon] = useState(category?.icon || 'Tag');
    const [tags, setTags] = useState(category?.tags?.join(', ') || '');
    const [dataTypes, setDataTypes] = useState(category?.dataTypes?.join(', ') || '');
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!name) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }

        setFormError(null);
        setIsSaving(true);
        try {
            await onSave({
                name,
                description: description || undefined,
                color,
                icon,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                dataTypes: dataTypes.split(',').map(t => t.trim()).filter(t => t),
            });
        } catch (e) {
            console.error('Failed to save category:', e);
            if (e instanceof DataHubApiError) {
                setFormError(e.message);
            } else if (e instanceof Error) {
                setFormError(e.message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const icons = ['Tag', 'TrendingUp', 'Activity', 'BarChart', 'FileText', 'Globe', 'Zap', 'Database'];
    const colors = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <span className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    </span>
                    {t('create_category') || 'Create Data Category'}
                </h3>

                <div className="space-y-5">
                    {formError && (
                        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                            {formError}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">{t('name') || 'Category Name'} *</label>
                        <input
                            type="text"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                            placeholder={t('enter_category_name') || 'e.g. Price Data, News'}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">{t('description') || 'Description'}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 outline-none transition-all resize-none"
                            rows={2}
                            placeholder={t('enter_description') || 'Brief description of this category'}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">{t('icon') || 'Icon'}</label>
                            <select
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 outline-none"
                            >
                                {icons.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">{t('color') || 'Color'}</label>
                            <div className="flex gap-1.5 flex-wrap">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">{t('tags') || 'Tags'}</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 outline-none"
                                placeholder="price, eth"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">{t('data_types') || 'Data Types'}</label>
                            <input
                                type="text"
                                value={dataTypes}
                                onChange={(e) => setDataTypes(e.target.value)}
                                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 outline-none"
                                placeholder="json, rss"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-secondary hover:bg-accent text-secondary-foreground rounded-xl text-sm font-semibold transition-colors"
                        disabled={isSaving}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('saving') || 'Saving...'}
                            </>
                        ) : (
                            t('save_category') || 'Create Category'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateCategoryModal;

