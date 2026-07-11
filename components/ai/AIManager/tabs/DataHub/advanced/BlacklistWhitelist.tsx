import React, { useMemo, useState } from 'react';
import FilterRuleModal from '../modals/FilterRuleModal';
import {
    useDataHubFilterRulesQuery,
    useCreateFilterRuleMutation,
    useUpdateFilterRuleMutation,
    useDeleteFilterRuleMutation,
    useEvaluateFilterRulesMutation,
} from '../../../../../../hooks/useDataHubFilterRules';
import type {
    CreateFilterRulePayload,
    DataHubFilterRule,
} from '../../../../../../services/dataHubFilterRulesApi';
import { DataHubApiError } from '../../../../../../services/dataSourcesApi';
import { formatApiErrorForUi, safeDynamicT } from '../dataHubI18n';
import { DataHubTabStrip, dataHubWriteGate } from '../dataHubUi';
import { useDataHubPermissions } from '../hooks/useDataHubPermissions';

interface BlacklistWhitelistProps {
    t: (key: string) => string;
}

const SHELL =
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5';

const BlacklistWhitelist: React.FC<BlacklistWhitelistProps> = ({ t }) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
    const { data: rules = [], isLoading, error, refetch } = useDataHubFilterRulesQuery({
        active_only: true,
    });
    const createMut = useCreateFilterRuleMutation();
    const updateMut = useUpdateFilterRuleMutation();
    const deleteMut = useDeleteFilterRuleMutation();
    const evaluateMut = useEvaluateFilterRulesMutation();

    const [activeTab, setActiveTab] = useState<'blacklist' | 'whitelist' | 'rules' | 'evaluate'>(
        'blacklist',
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [modalRule, setModalRule] = useState<DataHubFilterRule | null | undefined>(undefined);
    const [evalUrl, setEvalUrl] = useState('');
    const [evalText, setEvalText] = useState('');
    const [evalTarget, setEvalTarget] = useState<'ingestion' | 'publishing'>('ingestion');

    const blacklistRules = useMemo(
        () => rules.filter(r => r.rule_type === 'blacklist'),
        [rules],
    );
    const whitelistRules = useMemo(
        () => rules.filter(r => r.rule_type === 'whitelist'),
        [rules],
    );

    const metrics = useMemo(
        () => ({
            blockedCount: blacklistRules.length,
            trustedCount: whitelistRules.length,
            activeRules: rules.filter(r => r.is_active).length,
            keywordRules: rules.filter(r => r.scope === 'keyword').length,
        }),
        [rules, blacklistRules, whitelistRules],
    );

    const tabRules = useMemo(() => {
        if (activeTab === 'blacklist') return blacklistRules;
        if (activeTab === 'whitelist') return whitelistRules;
        if (activeTab === 'rules') return rules;
        return [];
    }, [activeTab, blacklistRules, whitelistRules, rules]);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return tabRules;
        return tabRules.filter(
            r =>
                r.pattern.toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q) ||
                r.scope.includes(q),
        );
    }, [tabRules, searchTerm]);

    const apiError =
        error instanceof DataHubApiError
            ? formatApiErrorForUi(t, error.message)
            : error instanceof Error
              ? formatApiErrorForUi(t, error.message)
              : null;

    const handleSave = async (
        payload: CreateFilterRulePayload & { is_active: boolean },
    ) => {
        if (modalRule && modalRule.id) {
            await updateMut.mutateAsync({ id: modalRule.id, payload });
        } else {
            await createMut.mutateAsync(payload);
        }
        setModalRule(undefined);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('filter_rule_delete_confirm'))) return;
        await deleteMut.mutateAsync(id);
    };

    const renderRuleRow = (rule: DataHubFilterRule) => (
        <div
            key={rule.id}
            className={`rounded-xl border border-white/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                rule.rule_type === 'blacklist'
                    ? 'bg-gradient-to-r from-red-500/5 to-transparent'
                    : 'bg-gradient-to-r from-emerald-500/5 to-transparent'
            }`}
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            rule.rule_type === 'blacklist'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                    >
                        {t(rule.rule_type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                        {safeDynamicT(t, 'filter_scope_', rule.scope)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {rule.match_type} · {rule.apply_target} · P{rule.priority}
                    </span>
                </div>
                <p className="font-mono text-sm text-foreground mt-1 truncate">{rule.pattern}</p>
                {rule.reason ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{rule.reason}</p>
                ) : null}
            </div>
            <div className="flex gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => setModalRule(rule)}
                    disabled={wg().disabled}
                    title={wg().title}
                    className="text-[11px] px-2 py-1 rounded-full border border-white/10 hover:border-purple-500/50 disabled:opacity-50"
                >
                    {t('edit')}
                </button>
                <button
                    type="button"
                    onClick={() => handleDelete(rule.id)}
                    disabled={wg(deleteMut.isPending).disabled}
                    title={wg(deleteMut.isPending).title}
                    className="text-[11px] px-2 py-1 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                    {t('delete')}
                </button>
            </div>
        </div>
    );

    return (
        <div className={SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground flex items-center gap-2">
                        {t('safety_filtering')}
                        </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('safety_filtering_desc')}
                        </p>
                    </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50"
                >
                    {isLoading ? t('refreshing') : t('refresh')}
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-3">
                    <p className="text-[11px] text-red-300/80 mb-1">{t('blocked_sources')}</p>
                    <p className="text-sm font-semibold text-red-100">{metrics.blockedCount}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3">
                    <p className="text-[11px] text-emerald-300/80 mb-1">{t('trusted_sources')}</p>
                    <p className="text-sm font-semibold text-emerald-100">{metrics.trustedCount}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-3">
                    <p className="text-[11px] text-purple-300/80 mb-1">{t('filtering_rules')}</p>
                    <p className="text-sm font-semibold text-purple-100">{metrics.activeRules}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3">
                    <p className="text-[11px] text-amber-300/80 mb-1">{t('filter_metric_keywords')}</p>
                    <p className="text-sm font-semibold text-amber-100">{metrics.keywordRules}</p>
                </div>
                </div>

            {apiError ? (
                <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {apiError}
                </div>
            ) : null}

            {/* Safety Filtering navigation */}
            <DataHubTabStrip
                className="mb-4"
                wrap
                ariaLabel={t('blacklist_whitelist') || 'Safety filtering'}
                activeId={activeTab}
                onChange={id => setActiveTab(id as typeof activeTab)}
                items={(['blacklist', 'whitelist', 'rules', 'evaluate'] as const).map(tab => ({
                    id: tab,
                    label: safeDynamicT(t, 'safety_tab_', tab),
                    activeVariant: tab === 'evaluate' ? ('warning' as const) : ('default' as const),
                }))}
            />

            {activeTab !== 'evaluate' ? (
                <>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input
                            type="text"
                            placeholder={t('blacklist_search_placeholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-slate-900/60 text-sm text-foreground"
                        />
                        <button
                            type="button"
                            onClick={() => setModalRule(null)}
                            disabled={wg().disabled}
                            title={wg().title}
                            className="text-[11px] px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white whitespace-nowrap disabled:opacity-50"
                        >
                            {t('filter_rule_add')}
                        </button>
                </div>

                    {isLoading ? (
                        <p className="text-[11px] text-muted-foreground py-8 text-center">
                            {t('loading')}
                        </p>
                    ) : filtered.length > 0 ? (
                        <div className="space-y-2">{filtered.map(renderRuleRow)}</div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm font-medium">
                                {activeTab === 'blacklist'
                                    ? t('filter_empty_blacklist')
                                    : activeTab === 'whitelist'
                                      ? t('filter_empty_whitelist')
                                      : t('filter_empty_rules')}
                            </p>
                            <p className="text-[11px] mt-1">{t('filter_empty_hint')}</p>
                    </div>
                )}
                </>
            ) : (
                <div className="space-y-3 max-w-xl">
                    <p className="text-[11px] text-muted-foreground">{t('filter_evaluate_desc')}</p>
                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_evaluate_url')}
                        <input
                            value={evalUrl}
                            onChange={e => setEvalUrl(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
                            placeholder="https://example.com/article"
                        />
                    </label>
                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_evaluate_text')}
                        <textarea
                            value={evalText}
                            onChange={e => setEvalText(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm resize-none"
                        />
                    </label>
                    <label className="block text-[11px] text-muted-foreground">
                        {t('filter_apply_target')}
                        <select
                            value={evalTarget}
                            onChange={e =>
                                setEvalTarget(e.target.value as 'ingestion' | 'publishing')
                            }
                            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                        >
                            <option value="ingestion">{t('filter_target_ingestion')}</option>
                            <option value="publishing">{t('filter_target_publishing')}</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        disabled={evaluateMut.isPending}
                        onClick={() =>
                            evaluateMut.mutate({
                                url: evalUrl || undefined,
                                text: evalText || undefined,
                                apply_target: evalTarget,
                            })
                        }
                        className="text-[11px] px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                    >
                        {evaluateMut.isPending ? t('loading') : t('filter_evaluate_run')}
                    </button>
                    {evaluateMut.data ? (
                        <div
                            className={`rounded-lg border px-3 py-2 text-[11px] ${
                                evaluateMut.data.allowed
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                    : 'border-red-500/30 bg-red-500/10 text-red-200'
                            }`}
                        >
                            <p className="font-semibold">
                                {evaluateMut.data.allowed
                                    ? t('filter_eval_allowed')
                                    : t('filter_eval_blocked')}
                            </p>
                            <p className="mt-1 opacity-80">
                                {evaluateMut.data.reason} · {evaluateMut.data.decision}
                            </p>
                            {evaluateMut.data.matched_rules?.length ? (
                                <p className="mt-1 font-mono opacity-70">
                                    {evaluateMut.data.matched_rules[0]?.pattern}
                                </p>
                            ) : null}
                                    </div>
                    ) : null}
                    {evaluateMut.error instanceof DataHubApiError ? (
                        <p className="text-[11px] text-red-300">
                            {formatApiErrorForUi(t, evaluateMut.error.message)}
                        </p>
                    ) : null}
                    </div>
                )}

            {modalRule !== undefined ? (
                <FilterRuleModal
                    rule={modalRule || undefined}
                    defaultRuleType={
                        activeTab === 'whitelist'
                            ? 'whitelist'
                            : activeTab === 'blacklist'
                              ? 'blacklist'
                              : 'blacklist'
                    }
                    onClose={() => setModalRule(undefined)}
                    onSave={handleSave}
                    isSaving={createMut.isPending || updateMut.isPending}
                    saveDisabled={wg().disabled}
                    saveTitle={wg().title}
                    t={t}
                />
            ) : null}
            </div>
    );
};

export default BlacklistWhitelist;
