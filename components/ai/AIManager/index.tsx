import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { OnNavigateHandler } from '../../../types/navigation.ts';
import { fetchArtemisAuditBundle, fetchArtemisReadiness } from '../../../services/artemisReadinessApi.ts';
import {
  CANONICAL_SECTIONS,
  type ArtemisAuditBundle,
  type ArtemisReadiness,
  type ArtemisSectionId,
} from './artemisProductTypes.ts';
import { productLabel } from './artemisProductCopy.ts';
import {
  OverviewSection,
  EvidenceSection,
  DecisionsSection,
  OrchestrationSection,
  ControlsSection,
  LineageSection,
  SystemSection,
} from './tabs/canonical/ArtemisSections.tsx';

type Props = {
  onNavigate?: OnNavigateHandler;
};

function readSectionFromLocation(): Exclude<ArtemisSectionId, 'legacy_admin'> {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('artemisSection') || params.get('subtab') || 'overview';
    const allowed = new Set(CANONICAL_SECTIONS.map((s) => s.id));
    if (raw === 'data_hub' || raw === 'datahub') return 'overview';
    if (raw === 'autopilot' || raw === 'legacy_admin') return 'system';
    if (allowed.has(raw as (typeof CANONICAL_SECTIONS)[number]['id'])) {
      return raw as (typeof CANONICAL_SECTIONS)[number]['id'];
    }
  } catch {
    /* ignore */
  }
  return 'overview';
}

const AIManager: React.FC<Props> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [activeSection, setActiveSection] = useState<Exclude<ArtemisSectionId, 'legacy_admin'>>(readSectionFromLocation);
  const [readiness, setReadiness] = useState<ArtemisReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [audit, setAudit] = useState<ArtemisAuditBundle>({ systemLogs: [], decisions: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setReadinessError(null);
    try {
      const [ready, bundle] = await Promise.all([fetchArtemisReadiness(), fetchArtemisAuditBundle(40)]);
      setReadiness(ready);
      setAudit(bundle);
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
      url.searchParams.set('artemisSection', activeSection);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  }, [activeSection]);

  const dir = language === 'fa' ? 'rtl' : 'ltr';
  const common = {
    t,
    language,
    readiness,
    readinessError,
    onNavigate,
    audit,
    onOpenSection: (id: ArtemisSectionId) => {
      if (id === 'legacy_admin') {
        setActiveSection('system');
        return;
      }
      setActiveSection(id);
    },
  };

  const sectionBody = useMemo(() => {
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
      case 'overview':
      default:
        return <OverviewSection {...common} />;
    }
  }, [activeSection, t, language, readiness, readinessError, onNavigate, audit]);

  return (
    <div className="space-y-4" dir={dir} data-artemis-shell="canonical-wpa">
      <header className="bg-card border border-border rounded-lg p-4">
        <h1 className="text-xl font-bold text-foreground">{t('artemis') !== 'artemis' ? t('artemis') : 'Artemis'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {productLabel(t, 'artemis_central_intelligence', 'Central intelligence — advisory maturity')}
        </p>
      </header>

      <nav className="bg-card border border-border rounded-lg p-2 overflow-x-auto" aria-label={productLabel(t, 'artemis_sections', 'Artemis sections')}>
        <div className="flex min-w-max gap-1">
          {CANONICAL_SECTIONS.map((section) => {
            const selected = activeSection === section.id;
            const label = t(section.labelKey) !== section.labelKey ? t(section.labelKey) : section.fallback;
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
                {label}
              </button>
            );
          })}
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
