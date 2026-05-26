import React, { useState } from 'react';
import type {
    DataHubFilterRule,
    FilterApplyTarget,
    FilterMatchType,
    FilterRuleScope,
    FilterRuleType,
} from '../../../../../../services/dataHubFilterRulesApi';

const FilterRuleModal: React.FC<{
    rule?: DataHubFilterRule | null;
    defaultRuleType?: FilterRuleType;
    onClose: () => void;
    onSave: (payload: {
        rule_type: FilterRuleType;
        scope: FilterRuleScope;
        pattern: string;
        match_type: FilterMatchType;
        apply_target: FilterApplyTarget;
        priority: number;
        reason?: string | null;
        is_active: boolean;
    }) => Promise<void>;
    isSaving?: boolean;
    t: (key: string) => string;
}> = ({ rule, defaultRuleType = 'blacklist', onClose, onSave, isSaving = false, t }) => {
    const [ruleType, setRuleType] = useState<FilterRuleType>(rule?.rule_type ?? defaultRuleType);
    const [scope, setScope] = useState<FilterRuleScope>(rule?.scope ?? 'domain');
    const [pattern, setPattern] = useState(rule?.pattern ?? '');
    const [matchType, setMatchType] = useState<FilterMatchType>(rule?.match_type ?? 'contains');
    const [applyTarget, setApplyTarget] = useState<FilterApplyTarget>(
        rule?.apply_target ?? 'ingestion',
    );
    const [priority, setPriority] = useState(String(rule?.priority ?? 100));
    const [reason, setReason] = useState(rule?.reason ?? '');
    const [isActive, setIsActive] = useState(rule?.is_active ?? true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            rule_type: ruleType,
            scope,
            pattern: pattern.trim(),
            match_type: matchType,
            apply_target: applyTarget,
            priority: parseInt(priority, 10) || 100,
            reason: reason.trim() || null,
            is_active: isActive,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />
            <form
                onSubmit={handleSubmit}
                className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-foreground">
                        {rule ? t('filter_rule_edit') : t('filter_rule_create')}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-xl leading-none"
                        aria-label={t('close')}
                    >
                        ×
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_rule_type')}
                        <select
                            value={ruleType}
                            onChange={e => setRuleType(e.target.value as FilterRuleType)}
                            disabled={Boolean(rule)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-foreground"
                        >
                            <option value="blacklist">{t('blacklist')}</option>
                            <option value="whitelist">{t('whitelist')}</option>
                        </select>
                    </label>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_rule_scope')}
                        <select
                            value={scope}
                            onChange={e => setScope(e.target.value as FilterRuleScope)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-foreground"
                        >
                            <option value="domain">{t('filter_scope_domain')}</option>
                            <option value="source">{t('filter_scope_source')}</option>
                            <option value="keyword">{t('filter_scope_keyword')}</option>
                        </select>
                    </label>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_rule_pattern')}
                        <input
                            value={pattern}
                            onChange={e => setPattern(e.target.value)}
                            required
                            placeholder={
                                scope === 'source'
                                    ? t('filter_pattern_source_uuid')
                                    : t('filter_pattern_placeholder')
                            }
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-foreground font-mono"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block text-[11px] text-muted-foreground">
                            {t('filter_match_type')}
                            <select
                                value={matchType}
                                onChange={e => setMatchType(e.target.value as FilterMatchType)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            >
                                <option value="exact">{t('filter_match_exact')}</option>
                                <option value="contains">{t('filter_match_contains')}</option>
                                <option value="regex">{t('filter_match_regex')}</option>
                            </select>
                        </label>
                        <label className="block text-[11px] text-muted-foreground">
                            {t('filter_apply_target')}
                            <select
                                value={applyTarget}
                                onChange={e =>
                                    setApplyTarget(e.target.value as FilterApplyTarget)
                                }
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                            >
                                <option value="ingestion">{t('filter_target_ingestion')}</option>
                                <option value="publishing">{t('filter_target_publishing')}</option>
                                <option value="both">{t('filter_target_both')}</option>
                            </select>
                        </label>
                    </div>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_priority')}
                        <input
                            type="number"
                            min={0}
                            max={10000}
                            value={priority}
                            onChange={e => setPriority(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_reason')}
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm resize-none"
                        />
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="rounded"
                        />
                        {t('filter_rule_active')}
                    </label>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-muted-foreground hover:text-foreground"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !pattern.trim()}
                        className="text-[11px] px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                    >
                        {isSaving ? t('saving') : t('save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FilterRuleModal;
