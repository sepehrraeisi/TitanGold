import React, { useState } from 'react';
import { DataCategory } from '../../../../../../types';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import {
    DataHubModal,
    INPUT_CLASS,
    SELECT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    DataHubAlert,
} from '../dataHubUi';

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
            setFormError(t('fill_required_fields'));
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
                tags: tags.split(',').map(s => s.trim()).filter(Boolean),
                dataTypes: dataTypes.split(',').map(s => s.trim()).filter(Boolean),
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

    const title = category ? t('edit_category') : t('create_category');

    return (
        <DataHubModal
            title={title}
            subtitle={t('create_category_desc')}
            onClose={onClose}
            maxWidth="max-w-md"
            footer={
                <>
                    <button type="button" onClick={onClose} disabled={isSaving} className={BTN_SECONDARY}>
                        {t('cancel')}
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={isSaving} className={BTN_PRIMARY}>
                        {isSaving ? t('saving') : category ? t('save') : t('save_category')}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                {formError && <DataHubAlert variant="error" message={formError} />}

                <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        {t('name')} *
                    </label>
                    <input
                        type="text"
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder={t('enter_category_name')}
                    />
                </div>

                <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        {t('description')}
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className={`${INPUT_CLASS} resize-none`}
                        rows={2}
                        placeholder={t('enter_description')}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            {t('icon')}
                        </label>
                        <select value={icon} onChange={e => setIcon(e.target.value)} className={SELECT_CLASS}>
                            {icons.map(i => (
                                <option key={i} value={i}>
                                    {i}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            {t('color')}
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 rounded-full transition-all ${
                                        color === c
                                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110'
                                            : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: c }}
                                    aria-label={c}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            {t('tags')}
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder={t('category_tags_placeholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            {t('data_types')}
                        </label>
                        <input
                            type="text"
                            value={dataTypes}
                            onChange={e => setDataTypes(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder={t('category_data_types_placeholder')}
                        />
                    </div>
                </div>
            </div>
        </DataHubModal>
    );
};

export default CreateCategoryModal;
