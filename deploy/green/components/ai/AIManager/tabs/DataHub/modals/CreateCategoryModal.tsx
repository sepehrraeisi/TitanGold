import React, { useState } from 'react';
import { DataCategory } from '../../../../../../types.ts';

type Props = {
    onClose: () => void;
    onSave: (category: Omit<DataCategory, 'id' | 'createdAt' | 'sourceCount'>) => Promise<void>;
    t: (key: string) => string;
};

const CreateCategoryModal: React.FC<Props> = ({ onClose, onSave, t }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [dataTypes, setDataTypes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSubmit = async () => {
        if (!name) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }
        
        setIsSaving(true);
        try {
            await onSave({
                name,
                description: description || undefined,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                dataTypes: dataTypes.split(',').map(t => t.trim()).filter(t => t),
            });
        } catch (e) {
            console.error('Failed to save category:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t('create_category') || 'Create Category'}</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_category_name') || 'Enter category name'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('description') || 'Description'}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            rows={3}
                            placeholder={t('enter_description') || 'Enter description'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('tags') || 'Tags'} (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="price, news, analysis"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('data_types') || 'Data Types'} (comma-separated)</label>
                        <input
                            type="text"
                            value={dataTypes}
                            onChange={(e) => setDataTypes(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="json, xml, rss"
                        />
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

export default CreateCategoryModal;

