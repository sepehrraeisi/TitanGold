import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchArtemisReadiness } from '../../services/artemisReadinessApi.ts';
import { productLabel, productStatus } from '../ai/AIManager/artemisProductCopy.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
    </div>
    <div className="flex-grow mt-2">{children}</div>
  </div>
);

const ArtemisInsightsWidget: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const readiness = await fetchArtemisReadiness();
        if (cancelled) return;
        setStage(readiness.maturityStage);
        setEligible(readiness.executionEligible === true);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'unavailable');
        setStage(null);
        setEligible(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WidgetCard title={t('artemis_insights') || 'Artemis Insights'}>
      <div className="bg-blue-500/10 border-l-4 border-blue-400 p-3 rounded-r-lg" role="status">
        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
          {productLabel(t, 'artemis_readiness_title', 'Artemis readiness')}
        </p>
        {loading ? (
          <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">{t('loading')}</p>
        ) : error ? (
          <>
            <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">
              {productLabel(t, 'unavailable', 'Unavailable')}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
              {productLabel(
                t,
                'artemis_insights_unavailable_reason',
                'Canonical advisory state could not be loaded. No fabricated confidence is shown.',
              )}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">
              {productStatus(stage || 'LEGACY_ADVISORY', t)}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-semibold">
              {productLabel(t, 'execution_eligibility', 'Execution eligibility')}:{' '}
              {eligible ? productLabel(t, 'yes', 'Yes') : productLabel(t, 'no', 'No')}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              {productLabel(
                t,
                'artemis_insights_no_fake_confidence',
                'No hardcoded confidence. Legacy advisory only.',
              )}
            </p>
          </>
        )}
      </div>
    </WidgetCard>
  );
};

export default ArtemisInsightsWidget;
