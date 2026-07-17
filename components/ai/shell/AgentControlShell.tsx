import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { AIAgent } from '../../../types.ts';
import {
  effectiveExecutionModeLabelKey,
  formatLastRun,
  getAgentExecutionKind,
  mapAgentOperationalState,
  shellOperationalStatusLabelKey,
} from './agentCardMeta.ts';
import { useAgentExecutionGate } from '../../../hooks/useAgentExecutionGate.ts';
import { SecondaryButton } from '../AIManager/tabs/DataHub/dataHubUi.tsx';

export interface AgentControlShellProps {
  agent: AIAgent;
  onClose: () => void;
  purpose?: string;
  primaryAction?: React.ReactNode;
  /** Optional status / toolbar row rendered under the header, outside the body scroll. */
  belowHeader?: React.ReactNode;
  summary?: React.ReactNode;
  results?: React.ReactNode;
  history?: React.ReactNode;
  settings?: React.ReactNode;
  integrations?: React.ReactNode;
  safetyExtra?: React.ReactNode;
  children?: React.ReactNode;
  /** When true, render only chrome + children (agent owns tabs). */
  embedChildren?: boolean;
  /** Test id for the shared Close control (default: agent-shell-close). */
  closeTestId?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Local LTR isolation for technical tokens (symbols, ISO times, IDs).
 * Do not wrap whole cards — only the value that must stay Latin-ordered.
 */
export const AgentTechnicalLtr: React.FC<{
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}> = ({ children, className, 'data-testid': testId }) => (
  <span dir="ltr" className={className} data-testid={testId || 'agent-technical-ltr'}>
    {children}
  </span>
);

/**
 * Shared Control Panel shell — consistent modal chrome for agent panels.
 * Owns overlay, viewport-safe frame, Escape, focus trap/restoration, and body scroll.
 * Individual agents keep their own business tabs and state.
 *
 * Portal root receives canonical lang/dir/typography from LanguageContext because
 * createPortal(document.body) sits outside the Dashboard RTL/font wrapper.
 */
export const AgentControlShell: React.FC<AgentControlShellProps> = ({
  agent,
  onClose,
  purpose,
  primaryAction,
  belowHeader,
  summary,
  results,
  history,
  settings,
  integrations,
  safetyExtra,
  children,
  embedChildren = true,
  closeTestId = 'agent-shell-close',
}) => {
  const { t, language } = useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { killSwitchActive, effectiveMode, liveBlockReason, runtime } = useAgentExecutionGate();

  const kind = getAgentExecutionKind(agent.agent_key);
  const state = mapAgentOperationalState(agent.status);
  const operationalLabelKey = shellOperationalStatusLabelKey(state);
  const effectiveModeKey = effectiveExecutionModeLabelKey(effectiveMode);
  const brokerConnected = runtime?.providerConnected === true;
  const isPersian = language === 'fa';
  const panelDir = isPersian ? 'rtl' : 'ltr';
  // Match Dashboard SoT: class `rtl` + IRANSans stack (also covered by index.html [dir=rtl] rules).
  const panelLangClass = isPersian ? 'rtl' : '';
  const panelFontStyle = isPersian
    ? ({ fontFamily: 'IRANSans, Vazir, Tahoma, sans-serif' } as React.CSSProperties)
    : undefined;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const initialClose = panelRef.current?.querySelector(
      `[data-testid="${closeTestId}"]`,
    ) as HTMLButtonElement | null;
    initialClose?.focus();

    const getFocusable = () => {
      const root = panelRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = getFocusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose, closeTestId]);

  if (typeof document === 'undefined') return null;

  // Safety strip: Emergency Stop + Broker once; short Live-block line without repeating ES.
  const safetyDetail =
    killSwitchActive
      ? t('live_side_effects_blocked') || 'Live side effects are blocked.'
      : liveBlockReason
        ? t(`execution_blocked_${liveBlockReason.toLowerCase()}`)
        : null;

  const purposeText = purpose || agent.role;
  const operationalLabel = t(operationalLabelKey) || (state === 'ready' ? 'Active' : state);
  const effectiveModeLabel =
    t(effectiveModeKey) ||
    (effectiveModeKey === 'execution_mode_dry_run'
      ? 'Dry Run'
      : effectiveModeKey === 'execution_mode_live'
        ? 'Live'
        : 'Demo');
  const brokerValue = brokerConnected
    ? t('online') || 'Online'
    : t('offline') || 'Offline';
  const lastRunLabel = t('never_run') || 'Never';
  const lastRunValue = formatLastRun(agent.lastUpdate, lastRunLabel);
  const lastRunIsTechnical = Boolean(agent.lastUpdate) && lastRunValue !== lastRunLabel;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 ${panelLangClass}`}
      role="presentation"
      lang={language}
      dir={panelDir}
      style={panelFontStyle}
      onClick={onClose}
      data-testid="agent-control-shell-overlay"
      data-shell-lang={language}
      data-shell-dir={panelDir}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        lang={language}
        dir={panelDir}
        data-testid="agent-control-shell"
        data-agent-key={agent.agent_key}
        data-scroll-owner="agent-control-shell-body"
        data-shell-lang={language}
        data-shell-dir={panelDir}
        className={`bg-[#12161c] border border-border rounded-xl w-full max-w-6xl max-h-[min(92vh,100dvh-1.5rem)] overflow-hidden flex flex-col shadow-2xl ${panelLangClass}`}
        style={panelFontStyle}
        onClick={e => e.stopPropagation()}
      >
        <header className="shrink-0 z-10 bg-[#12161c]/95 border-b border-border px-4 sm:px-6 py-4 flex flex-wrap gap-3 items-start justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-white truncate">
              {agent.name}
            </h2>
            <p id={descriptionId} className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {purposeText}
            </p>
            <div
              className="flex flex-wrap gap-2 text-[10px] sm:text-[11px]"
              data-testid="agent-shell-status-row"
            >
              <span
                className="px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                data-testid="agent-shell-status"
              >
                {operationalLabel}
              </span>
              <span
                className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-100"
                data-testid="agent-shell-effective-mode"
              >
                {effectiveModeLabel}
              </span>
              <span
                className="px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                data-testid="agent-shell-execution-kind"
              >
                {t(`execution_kind_${kind}`) || kind}
              </span>
              <span
                className="px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                data-testid="agent-shell-last-run"
              >
                {t('last_run')}:{' '}
                {lastRunIsTechnical ? (
                  <AgentTechnicalLtr>{lastRunValue}</AgentTechnicalLtr>
                ) : (
                  lastRunValue
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {primaryAction}
            <SecondaryButton
              type="button"
              data-testid={closeTestId}
              data-variant="neutral"
              onClick={onClose}
              aria-label={t('close') || 'Close'}
            >
              {t('close') || 'Close'}
            </SecondaryButton>
          </div>
        </header>

        {(killSwitchActive || kind === 'live_capable') && (
          <div
            className="shrink-0 px-4 sm:px-6 py-2 text-xs border-b border-red-500/20 bg-red-500/10 text-red-100/90 space-y-1"
            role="status"
            data-testid="agent-shell-safety"
          >
            <p data-testid="agent-shell-safety-primary">
              {t('emergency_stop')}: {killSwitchActive ? t('active') : t('inactive')}
              {' · '}
              {t('broker_label') || 'Broker'}: {brokerValue}
            </p>
            {safetyDetail && (
              <p data-testid="agent-shell-safety-detail">{safetyDetail}</p>
            )}
            {safetyExtra}
          </div>
        )}

        {belowHeader && (
          <div className="shrink-0 border-b border-border bg-[#0B1017]" data-testid="agent-shell-below-header">
            {belowHeader}
          </div>
        )}

        {/* Scroll owner: single intentional body region for tab content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          data-testid="agent-control-shell-body"
        >
          {embedChildren ? (
            children
          ) : (
            <div className="p-4 sm:p-6 space-y-6">
              {summary && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('summary') || 'Summary'}</h3>
                  {summary}
                </section>
              )}
              {results && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('results') || 'Results'}</h3>
                  {results}
                </section>
              )}
              {history && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('history') || 'History'}</h3>
                  {history}
                </section>
              )}
              {settings && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{t('settings') || 'Settings'}</h3>
                  {settings}
                </section>
              )}
              {integrations && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {t('integrations') || 'Integrations'}
                  </h3>
                  {integrations}
                </section>
              )}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AgentControlShell;
