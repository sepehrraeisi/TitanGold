import React, { useState } from 'react';
import type { DataSource } from '../../../../../../types';
import type {
    CreateCrawlerPayload,
    CrawlerTargetType,
    DataHubCrawler,
    CrawlerScheduleInterval,
} from '../../../../../../services/dataHubCrawlersApi';

const WebCrawlerModal: React.FC<{
    crawler?: DataHubCrawler;
    sources: DataSource[];
    onClose: () => void;
    onSave: (data: CreateCrawlerPayload) => Promise<void>;
    isSaving?: boolean;
    t: (key: string) => string;
}> = ({ crawler, sources, onClose, onSave, isSaving = false, t }) => {
    const [name, setName] = useState(crawler?.name || '');
    const [targetType, setTargetType] = useState<CrawlerTargetType>(crawler?.target_type || 'website');
    const [startUrl, setStartUrl] = useState(crawler?.start_url || '');
    const [sourceMode, setSourceMode] = useState<'existing' | 'new'>(
        crawler?.source_id ? 'existing' : 'new',
    );
    const [sourceId, setSourceId] = useState(crawler?.source_id || '');
    const [newSourceName, setNewSourceName] = useState('');
    const [scheduleInterval, setScheduleInterval] = useState<CrawlerScheduleInterval>(
        crawler?.schedule_interval || '5min',
    );
    const [maxDepth, setMaxDepth] = useState(String(crawler?.max_depth ?? 0));
    const [maxPages, setMaxPages] = useState(String(crawler?.max_pages_per_run ?? 50));
    const [timeoutMs, setTimeoutMs] = useState(String(crawler?.timeout_ms ?? 600000));
    const [isEnabled, setIsEnabled] = useState(crawler?.is_enabled ?? true);
    const [respectRobots, setRespectRobots] = useState(crawler?.respect_robots ?? true);
    const [renderJs, setRenderJs] = useState(crawler?.render_js ?? false);
    const [selectors, setSelectors] = useState({
        title: crawler?.selectors?.title || '',
        content: crawler?.selectors?.content || '',
        price: crawler?.selectors?.price || '',
        volume: crawler?.selectors?.volume || '',
        date: crawler?.selectors?.date || '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = t('crawler_name_required');
        try {
            const parsed = new URL(startUrl.trim());
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                newErrors.start_url = t('crawler_url_invalid');
            }
        } catch {
            newErrors.start_url = t('crawler_url_invalid');
        }
        if (sourceMode === 'existing' && !sourceId) {
            newErrors.source = t('crawler_source_required');
        }
        if (sourceMode === 'new' && !newSourceName.trim()) {
            newErrors.source = t('crawler_source_required');
        }
        if (targetType === 'website') {
            const hasSelectors = Object.values(selectors).some(v => v.trim());
            if (!hasSelectors) newErrors.selectors = t('crawler_selector_required');
        }
        if (Object.keys(newErrors).length) {
            setErrors(newErrors);
            return;
        }

        const selectorPayload = Object.fromEntries(
            Object.entries(selectors).filter(([, v]) => v.trim()),
        );

        const payload: CreateCrawlerPayload = {
            name: name.trim(),
            target_type: targetType,
            start_url: startUrl.trim(),
            max_depth: targetType === 'rss' ? 0 : Math.min(5, parseInt(maxDepth, 10) || 0),
            max_pages_per_run: Math.min(500, parseInt(maxPages, 10) || 50),
            schedule_interval: scheduleInterval,
            respect_robots: respectRobots,
            render_js: renderJs,
            selectors: selectorPayload,
            timeout_ms: parseInt(timeoutMs, 10) || 600000,
            is_enabled: isEnabled,
        };

        if (sourceMode === 'existing') {
            payload.source_id = sourceId;
        } else {
            payload.source = {
                name: newSourceName.trim(),
                url: startUrl.trim(),
                type: targetType === 'rss' ? 'rss' : 'web',
                update_interval: scheduleInterval,
            };
        }

        setErrors({});
        await onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <form
                onSubmit={handleSubmit}
                className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-foreground">
                        {crawler ? t('edit_crawler') : t('create_crawler')}
                    </h3>
                    <button type="button" onClick={onClose} className="text-xl text-muted-foreground">
                        ×
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                    <label className="block text-[11px] text-muted-foreground">
                        {t('crawler_target_type')}
                        <select
                            value={targetType}
                            onChange={e => setTargetType(e.target.value as CrawlerTargetType)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        >
                            <option value="website">{t('crawler_type_website')}</option>
                            <option value="rss">{t('crawler_type_rss')}</option>
                        </select>
                    </label>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('name')} *
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        />
                        {errors.name ? <p className="text-red-400 text-[10px] mt-0.5">{errors.name}</p> : null}
                    </label>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('crawler_start_url')} *
                        <input
                            value={startUrl}
                            onChange={e => setStartUrl(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
                        />
                        {errors.start_url ? (
                            <p className="text-red-400 text-[10px] mt-0.5">{errors.start_url}</p>
                        ) : null}
                    </label>

                    <div className="flex gap-4 text-[11px]">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                checked={sourceMode === 'existing'}
                                onChange={() => setSourceMode('existing')}
                            />
                            {t('crawler_source_existing')}
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                checked={sourceMode === 'new'}
                                onChange={() => setSourceMode('new')}
                            />
                            {t('crawler_source_new')}
                        </label>
                    </div>

                    {sourceMode === 'existing' ? (
                        <label className="block text-[11px] text-muted-foreground">
                            {t('crawler_source')}
                            <select
                                value={sourceId}
                                onChange={e => setSourceId(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            >
                                <option value="">{t('crawler_select_source')}</option>
                                {sources.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.type})
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <label className="block text-[11px] text-muted-foreground">
                            {t('crawler_new_source_name')}
                            <input
                                value={newSourceName}
                                onChange={e => setNewSourceName(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            />
                        </label>
                    )}
                    {errors.source ? (
                        <p className="text-red-400 text-[10px]">{errors.source}</p>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                        {targetType === 'website' ? (
                            <label className="block text-[11px] text-muted-foreground">
                                {t('crawler_depth')}
                                <input
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={maxDepth}
                                    onChange={e => setMaxDepth(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                                />
                            </label>
                        ) : null}
                        <label className="block text-[11px] text-muted-foreground">
                            {t('crawler_max_pages')}
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={maxPages}
                                onChange={e => setMaxPages(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block text-[11px] text-muted-foreground">
                            {t('crawler_timeout_ms')}
                            <input
                                type="number"
                                min={5000}
                                value={timeoutMs}
                                onChange={e => setTimeoutMs(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block text-[11px] text-muted-foreground">
                            {t('interval')}
                            <select
                                value={scheduleInterval}
                                onChange={e =>
                                    setScheduleInterval(e.target.value as CrawlerScheduleInterval)
                                }
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            >
                                <option value="5min">{t('5min')}</option>
                                <option value="15min">{t('15min')}</option>
                                <option value="1hour">{t('1hour')}</option>
                                <option value="daily">{t('daily')}</option>
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={e => setIsEnabled(e.target.checked)}
                            />
                            {t('enabled')}
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={respectRobots}
                                onChange={e => setRespectRobots(e.target.checked)}
                            />
                            {t('crawler_respect_robots')}
                        </label>
                        {targetType === 'website' ? (
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={renderJs}
                                    onChange={e => setRenderJs(e.target.checked)}
                                />
                                {t('crawler_render_js')}
                            </label>
                        ) : null}
                    </div>
                    {renderJs ? (
                        <p className="text-[10px] text-amber-300/90">{t('crawler_render_js_disabled_hint')}</p>
                    ) : null}

                    {targetType === 'website' ? (
                        <div className="border-t border-white/10 pt-3">
                            <p className="text-[11px] font-semibold text-foreground mb-2">
                                {t('css_selectors')}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['title', 'content', 'price', 'volume', 'date'] as const).map(key => (
                                    <input
                                        key={key}
                                        placeholder={key}
                                        value={selectors[key]}
                                        onChange={e =>
                                            setSelectors({ ...selectors, [key]: e.target.value })
                                        }
                                        className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs font-mono"
                                    />
                                ))}
                            </div>
                            {errors.selectors ? (
                                <p className="text-red-400 text-[10px] mt-1">{errors.selectors}</p>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/10"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="text-[11px] px-4 py-1.5 rounded-full bg-purple-600 text-white disabled:opacity-50"
                    >
                        {isSaving ? t('saving') : t('save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WebCrawlerModal;
