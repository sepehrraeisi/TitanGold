import React, { useState } from 'react';
import { DataSource } from '../../../../../../types.ts';

const WebCrawlerModal: React.FC<{
    crawler?: any;
    sources: DataSource[];
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    t: (key: string) => string;
}> = ({ crawler, sources, onClose, onSave, t }) => {
    const [name, setName] = useState(crawler?.name || '');
    const [url, setUrl] = useState(crawler?.url || '');
    const [sourceId, setSourceId] = useState(crawler?.sourceId || '');
    const [interval, setInterval] = useState<'realtime' | '1min' | '5min' | '15min' | '30min' | '1hour' | 'daily'>(crawler?.interval || '5min');
    const [enabled, setEnabled] = useState(crawler?.enabled ?? true);
    const [selectors, setSelectors] = useState({
        title: crawler?.selectors?.title || '',
        content: crawler?.selectors?.content || '',
        price: crawler?.selectors?.price || '',
        volume: crawler?.selectors?.volume || '',
        date: crawler?.selectors?.date || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = t('crawler_name_required') || 'Crawler name is required.';
        }
        if (!url.trim()) {
            newErrors.url = t('crawler_url_required') || 'URL is required.';
        } else {
            try {
                const parsed = new URL(url.trim());
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    newErrors.url = t('crawler_url_invalid') || 'URL must start with http or https.';
                }
            } catch {
                newErrors.url = t('crawler_url_invalid') || 'Please enter a valid URL.';
            }
        }
        const hasSelectors = Object.values(selectors).some(value => value.trim().length > 0);
        if (!hasSelectors) {
            newErrors.selectors = t('crawler_selector_required') || 'Provide at least one CSS selector to extract data.';
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
                url,
                sourceId: sourceId || undefined,
                interval,
                enabled,
                selectors: Object.fromEntries(
                    Object.entries(selectors).filter(([_, v]) => v.trim() !== '')
                ),
            });
        } catch (e) {
            console.error('Failed to save crawler:', e);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {crawler ? t('edit_crawler') || 'Edit Crawler' : t('create_crawler') || 'Create Web Crawler'}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('name') || 'Name'} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('crawler_name') || 'Crawler name'}
                        />
                        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('url') || 'URL'} *</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder="https://example.com"
                        />
                        {errors.url && <p className="text-xs text-red-400 mt-1">{errors.url}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('link_to_source') || 'Link to Source'} (Optional)</label>
                        <select
                            value={sourceId}
                            onChange={(e) => setSourceId(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="">{t('none') || 'None'}</option>
                            {sources.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('interval') || 'Interval'}</label>
                            <select
                                value={interval}
                                onChange={(e) => setInterval(e.target.value as any)}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            >
                                <option value="realtime">{t('realtime') || 'Real-time'}</option>
                                <option value="1min">{t('1min') || '1 Minute'}</option>
                                <option value="5min">{t('5min') || '5 Minutes'}</option>
                                <option value="15min">{t('15min') || '15 Minutes'}</option>
                                <option value="30min">{t('30min') || '30 Minutes'}</option>
                                <option value="1hour">{t('1hour') || '1 Hour'}</option>
                                <option value="daily">{t('daily') || 'Daily'}</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center pt-6">
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
                    
                    <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">{t('css_selectors') || 'CSS Selectors'} (Optional)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('title_selector') || 'Title'}</label>
                                <input
                                    type="text"
                                    value={selectors.title}
                                    onChange={(e) => setSelectors({ ...selectors, title: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder="h1.title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('content_selector') || 'Content'}</label>
                                <input
                                    type="text"
                                    value={selectors.content}
                                    onChange={(e) => setSelectors({ ...selectors, content: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".content"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('price_selector') || 'Price'}</label>
                                <input
                                    type="text"
                                    value={selectors.price}
                                    onChange={(e) => setSelectors({ ...selectors, price: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".price"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('volume_selector') || 'Volume'}</label>
                                <input
                                    type="text"
                                    value={selectors.volume}
                                    onChange={(e) => setSelectors({ ...selectors, volume: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".volume"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">{t('date_selector') || 'Date'}</label>
                                <input
                                    type="text"
                                    value={selectors.date}
                                    onChange={(e) => setSelectors({ ...selectors, date: e.target.value })}
                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                                    placeholder=".date"
                                />
                            </div>
                        </div>
                        {errors.selectors && <p className="text-xs text-red-400 mt-2">{errors.selectors}</p>}
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

export default WebCrawlerModal;

