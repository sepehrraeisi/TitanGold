import React from 'react';
import type { DiagnoseCollectorCheck } from '../../../../../../services/telegramCollectorErrors.ts';
import { DATAHUB_INNER_LIST, StatusPill } from '../dataHubUi';
import { diagnoseCheckLabel } from './telegramCollectorLabels';

type Props = {
    t: (key: string) => string;
    checks: DiagnoseCollectorCheck[];
};

const CollectorDiagnoseCards: React.FC<Props> = ({ t, checks }) => {
    if (!checks.length) return null;

    return (
        <div className={`${DATAHUB_INNER_LIST} grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3`}>
            {checks.map(check => (
                <div
                    key={check.key}
                    className="rounded-lg border border-white/5 bg-slate-950/50 p-3 space-y-1"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-foreground">
                            {diagnoseCheckLabel(check.key, t)}
                        </span>
                        <StatusPill
                            label={check.ok ? 'OK' : t('collector_diag_check_failed')}
                            variant={check.ok ? 'success' : 'error'}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        HTTP {check.status ?? '—'} · {check.latencyMs != null ? `${check.latencyMs}ms` : '—'} ·{' '}
                        {check.responseKind || 'unknown'}
                    </p>
                    {!check.ok && (
                        <p className="text-[10px] text-amber-200/90">
                            {check.errorKey ? t(check.errorKey) || check.errorKey : check.safeError}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CollectorDiagnoseCards;
