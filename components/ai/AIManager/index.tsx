import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { OnNavigateHandler } from '../../../types/navigation.ts';
import { fetchArtemisReadiness, fetchArtemisLegacyDecisionLogs } from '../../../services/artemisReadinessApi.ts';
import {
  CANONICAL_SECTIONS,
  type ArtemisReadiness,
  type ArtemisSectionId,
} from './artemisProductTypes.ts';
import { StatusPill } from './components/ArtemisUi.tsx';
import {
  OverviewSection,
  EvidenceSection,
  DecisionsSection,
  OrchestrationSection,
  ControlsSection,
  LineageSection,
  SystemSection,
} from './tabs/canonical/ArtemisSections.tsx';

const AutopilotTab = lazy(() => import('./tabs/AutopilotTab.tsx'));

type Props = {
  onNavigate?: OnNavigateHandler;
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-card border border-border rounded-lg p-4 ${className || ''}`}>{children}</div>
);

function readSectionFromLocation(): ArtemisSectionId {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('artemisSection') || params.get('subtab') || 'overview';
    const allowed = new Set(CANONICAL_SECTIONS.map((s) => s.id));
    if (raw === 'autopilot' || raw === 'legacy_admin') return 'legacy_admin';
    if (allowed.has(raw as ArtemisSectionId)) return raw as ArtemisSectionId;
  } catch {
    /* ignore */
  }
  return 'overview';
}

const AIManager: React.FC<Props> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [activeSection, setActiveSection] = useState<ArtemisSectionId>(readSectionFromLocation);
  const [readiness, setReadiness] = useState<ArtemisReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLegacyAdmin, setShowLegacyAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setReadinessError(null);
    try {
      const [ready, legacyLogs] = await Promise.all([
        fetchArtemisReadiness(),
        fetchArtemisLegacyDecisionLogs(25),
      ]);
      setReadiness(ready);
      setLogs(legacyLogs);
    } catch (e) {
      setReadiness(null);
      setReadinessError(e instanceof Error ? e.message : 'Failed to load Artemis readiness');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('artemisSection', activeSection === 'legacy_admin' ? 'legacy_admin' : activeSection);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  }, [activeSection]);

  const dir = language === 'fa' ? 'rtl' : 'ltr';

  const sectionBody = useMemo(() => {
    const common = { t, readiness, readinessError, onNavigate, logs };
    switch (activeSection) {
      case 'evidence':
        return <EvidenceSection {...common} />;
      case 'decisions':
        return <DecisionsSection {...common} />;
      case 'orchestration':
        return <OrchestrationSection {...common} />;
      case 'controls':
        return <ControlsSection {...common} />;
      case 'lineage':
        return <LineageSection {...common} />;
      case 'system':
        return <SystemSection {...common} />;
      case 'legacy_admin':
        return showLegacyAdmin ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold">{t('artemis_legacy_admin_banner') || 'Legacy Administrative'}</p>
              <p className="mt-1 text-muted-foreground">
                {t('artemis_legacy_admin_not_ready') ||
                  'Not Automated-Trading Ready · Not Live Authorization · Contained Autopilot UI'}
              </p>
            </div>
            <Suspense fallback={<div className="p-6 text-center">{t('loading')}</div>}>
              <AutopilotTab t={t} onRefresh={load} Card={Card} />
            </Suspense>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-6 space-y-3">
            <p className="font-semibold">{t('artemis_autopilot_hidden') || 'Autopilot is hidden from normal Artemis navigation'}</p>
            <p className="text-sm text-muted-foreground">
              {t('artemis_autopilot_hidden_reason') ||
                'Current maturity does not support autonomous trading controls in the product nav.'}
            </p>
            <button
              type="button"
              className="text-sm underline text-amber-700 dark:text-amber-300"
              onClick={() => setShowLegacyAdmin(true)}
            >
              {t('artemis_open_legacy_admin') || 'Open legacy administrative Autopilot (not Live authorization)'}
            </button>
          </div>
        );
      case 'overview':
      default:
        return <OverviewSection {...common} />;
    }
  }, [activeSection, t, readiness, readinessError, onNavigate, logs, showLegacyAdmin, load]);

  return (
    <div className="space-y-4" dir={dir} data-artemis-shell="canonical-wpa">
      <header className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('artemis') || 'Artemis'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('artemis_central_intelligence') || 'Central Intelligence — legacy advisory maturity'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label={t('artemis_status') || 'Artemis status'}>
            <StatusPill label={t('artemis_stage_legacy_advisory') || 'LEGACY ADVISORY'} tone="warning" />
            <StatusPill label={t('artemis_not_execution_eligible') || 'NOT EXECUTION ELIGIBLE'} tone="danger" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('requested_mode') || 'Requested Mode'}</p>
            <p className="font-semibold">
              {readiness?.runtime?.requestedMode?.toUpperCase() || (t('unavailable') || 'Unavailable')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('effective_mode') || 'Effective Mode'}</p>
            <p className="font-semibold">
              {readiness?.runtime?.effectiveMode?.toUpperCase() || (t('unavailable') || 'Unavailable')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('emergency_stop') || 'Emergency Stop'}</p>
            <p className="font-semibold">
              {readiness?.runtime
                ? readiness.runtime.killSwitchActive
                  ? t('active') || 'Active'
                  : t('inactive') || 'Inactive'
                : t('unavailable') || 'Unavailable'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('execution_eligibility') || 'Execution Eligibility'}</p>
            <p className="font-semibold text-red-600 dark:text-red-300">{t('no') || 'No'}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('artemis_no_one_click_live') ||
            'Artemis does not provide one-click Live automation. Runtime mode is owned by canonical settings/runtime controls.'}
        </p>
      </header>

      <nav
        className="bg-card border border-border rounded-lg p-2 overflow-x-auto"
        aria-label={t('artemis_sections') || 'Artemis sections'}
      >
        <div className="flex min-w-max gap-1">
          {CANONICAL_SECTIONS.map((section) => {
            const selected = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                data-artemis-tab={section.id}
                data-artemis-section={section.id}
                aria-current={selected ? 'page' : undefined}
                onClick={() => setActiveSection(section.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {t(section.labelKey) !== section.labelKey ? t(section.labelKey) : section.fallback}
              </button>
            );
          })}
          <button
            type="button"
            data-artemis-section="legacy_admin"
            className="px-3 py-2 rounded-md text-xs text-amber-700 dark:text-amber-300 whitespace-nowrap"
            onClick={() => {
              setShowLegacyAdmin(false);
              setActiveSection('legacy_admin');
            }}
          >
            {t('artemis_legacy_admin_nav') || 'Legacy Admin'}
          </button>
        </div>
      </nav>

      {loading ? (
        <div className="text-center p-10" role="status">
          {t('loading')}
        </div>
      ) : (
        <div className="min-h-[320px]">{sectionBody}</div>
      )}
    </div>
  );
};

export default AIManager;
