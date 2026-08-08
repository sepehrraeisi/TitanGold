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
  readExplainerDismissed,
  readPresentationMode,
  writeExplainerDismissed,
  writePresentationMode,
  type ArtemisPresentationMode,
} from './artemisPresentation.ts';
import {
  ARTEMIS_SHELL,
  ARTEMIS_TAB_ACTIVE,
  ARTEMIS_TAB_ITEM,
  ARTEMIS_TAB_STRIP,
  EmptyState,
  FirstVisitExplainer,
  HelpTip,
  LinkAction,
  PresentationToggle,
} from './components/ArtemisUi.tsx';
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
  const [presentation, setPresentation] = useState<ArtemisPresentationMode>(() => readPresentationMode());
  const [explainerDismissed, setExplainerDismissed] = useState(() => readExplainerDismissed());

  const load = useCallback(async () => {
    setLoading(true);
    setReadinessError(null);
    try {
      const [ready, bundle] = await Promise.all([fetchArtemisReadiness(), fetchArtemisAuditBundle(50)]);
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
    presentation,
    onRetry: load,
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
  }, [activeSection, t, language, readiness, readinessError, onNavigate, audit, presentation]);

  const changePresentation = (mode: ArtemisPresentationMode) => {
    setPresentation(mode);
    writePresentationMode(mode);
  };

  return (
    <div className="space-y-4" dir={dir} data-artemis-shell="canonical-wpa" data-artemis-view={presentation}>
      <header className={ARTEMIS_SHELL} data-artemis-header="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h1 className="text-sm md:text-base font-semibold text-foreground">
              {t('artemis') !== 'artemis' ? t('artemis') : 'Artemis'}
              <HelpTip label={productLabel(t, 'artemis_help_artemis_label', 'What is Artemis?')}>
                {productLabel(
                  t,
                  'artemis_help_artemis',
                  'Artemis is TitanGold’s central intelligence. It combines Agent insights, checks safety, and turns them into recommendations.',
                )}
              </HelpTip>
            </h1>
            <p className="text-xs text-foreground mt-2">
              {productLabel(
                t,
                'artemis_product_sentence',
                "Artemis combines insights from TitanGold's AI Agents, checks safety and risk, and turns them into understandable recommendations.",
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {productLabel(
                t,
                'artemis_now_sentence',
                'Right now Artemis can analyze and advise, but automated trading is not enabled.',
              )}
            </p>
          </div>
          <PresentationToggle
            mode={presentation}
            onChange={changePresentation}
            simpleLabel={productLabel(t, 'artemis_view_simple', 'Simple')}
            advancedLabel={productLabel(t, 'artemis_view_advanced', 'Advanced')}
          />
        </div>
      </header>

      {!explainerDismissed ? (
        <FirstVisitExplainer
          title={productLabel(t, 'artemis_explainer_title', 'New to Artemis?')}
          steps={[
            productLabel(t, 'artemis_explainer_step_1', 'Agents analyze the market.'),
            productLabel(t, 'artemis_explainer_step_2', 'Artemis combines their intelligence.'),
            productLabel(t, 'artemis_explainer_step_3', 'Safety checks must approve before execution is possible.'),
          ]}
          gotItLabel={productLabel(t, 'artemis_explainer_got_it', 'Got it')}
          learnMoreLabel={productLabel(t, 'artemis_explainer_learn_more', 'Learn more')}
          onGotIt={() => {
            writeExplainerDismissed();
            setExplainerDismissed(true);
          }}
          onLearnMore={() => setActiveSection('overview')}
        />
      ) : null}

      <nav
        className={ARTEMIS_TAB_STRIP}
        aria-label={productLabel(t, 'artemis_sections', 'Artemis sections')}
        data-artemis-nav="true"
      >
        <div className="flex min-w-max gap-1.5">
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
                className={`${ARTEMIS_TAB_ITEM} ${selected ? ARTEMIS_TAB_ACTIVE : ''}`}
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
      ) : readinessError ? (
        <div className="min-h-[320px]" data-artemis-readiness-error="true">
          <EmptyState
            title={productLabel(t, 'artemis_readiness_error', 'Artemis status unavailable')}
            body={readinessError}
            action={<LinkAction onClick={load}>{productLabel(t, 'retry', 'Retry')}</LinkAction>}
          />
        </div>
      ) : (
        <div className="min-h-[320px]">{sectionBody}</div>
      )}
    </div>
  );
};

export default AIManager;
