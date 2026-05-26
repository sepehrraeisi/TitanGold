import React, { useState } from 'react';
import type { DiscoveryRule } from '../../../../../../services/dataHubDiscoveryApi';

const DiscoveryRuleModal: React.FC<{
    onClose: () => void;
    onSave: (payload: {
        name: string;
        pattern: string;
        source_kind: string;
        category: string;
        priority: string;
    }) => Promise<void>;
    isSaving?: boolean;
    t: (key: string) => string;
}> = ({ onClose, onSave, isSaving = false, t }) => {
    const [name, setName] = useState('');
    const [pattern, setPattern] = useState('');
    const [sourceKind, setSourceKind] = useState<DiscoveryRule['source_kind']>('website');
    const [category, setCategory] = useState('uncategorized');
    const [priority, setPriority] = useState('medium');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ name, pattern, source_kind: sourceKind, category, priority });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <form
                onSubmit={handleSubmit}
                className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
            >
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold">{t('discovery_rule_add')}</h3>
                </div>
                <div className="p-4 space-y-3">
                    <label className="block text-[11px] text-muted-foreground">
                        {t('name')}
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block text-[11px] text-muted-foreground">
                        {t('discovery_rule_pattern')}
                        <input
                            value={pattern}
                            onChange={e => setPattern(e.target.value)}
                            required
                            placeholder="https://example.com/feed.xml"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
                        />
                    </label>
                    <label className="block text-[11px] text-muted-foreground">
                        {t('discovery_rule_kind')}
                        <select
                            value={sourceKind}
                            onChange={e => setSourceKind(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        >
                            <option value="website">{t('crawler_type_website')}</option>
                            <option value="rss">{t('crawler_type_rss')}</option>
                            <option value="telegram">{t('discovery_kind_telegram')}</option>
                            <option value="api">API</option>
                        </select>
                    </label>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-white/10">
                    <button type="button" onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-full border border-white/10">
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

export default DiscoveryRuleModal;
