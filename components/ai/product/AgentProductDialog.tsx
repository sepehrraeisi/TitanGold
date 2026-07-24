import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { AIAgent } from '../../../types.ts';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';
import { AgentProductHeader, type AgentProductHeaderProps } from './AgentProductHeader.tsx';
import { AgentSafetyBanner } from './AgentSafetyBanner.tsx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type AgentProductDialogProps = {
  agent: AIAgent;
  onClose: () => void;
  purpose?: string;
  latestRunAt?: string | null;
  monitoringState?: AgentProductHeaderProps['monitoringState'];
  safetyProductNote?: string;
  actionBar?: React.ReactNode;
  sectionNavigation?: React.ReactNode;
  children: React.ReactNode;
  closeTestId?: string;
  testId?: string;
};

/**
 * Agent Product Template V1 — canonical dialog shell for agent detail experiences.
 */
export const AgentProductDialog: React.FC<AgentProductDialogProps> = ({
  agent,
  onClose,
  purpose,
  latestRunAt,
  monitoringState,
  safetyProductNote,
  actionBar,
  sectionNavigation,
  children,
  closeTestId = 'agent-product-close',
  testId = 'agent-product-dialog',
}) => {
  const { language } = useLanguage();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const isPersian = language === 'fa';
  const panelDir = isPersian ? 'rtl' : 'ltr';
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

  return createPortal(
    <div
      className={`${AGENT_PRODUCT_TOKENS.overlay} ${panelLangClass}`}
      role="presentation"
      lang={language}
      dir={panelDir}
      style={panelFontStyle}
      onClick={onClose}
      data-testid="agent-product-overlay"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        lang={language}
        dir={panelDir}
        data-testid={testId}
        data-agent-key={agent.agent_key}
        data-scroll-owner="agent-product-body"
        className={`${AGENT_PRODUCT_TOKENS.dialogBg} ${AGENT_PRODUCT_TOKENS.dialogBorder} ${AGENT_PRODUCT_TOKENS.dialogRadius} ${AGENT_PRODUCT_TOKENS.mobileFullScreen} ${AGENT_PRODUCT_TOKENS.dialogMaxWidth} ${AGENT_PRODUCT_TOKENS.dialogMaxHeight} w-full overflow-hidden flex flex-col shadow-2xl ${panelLangClass}`}
        style={panelFontStyle}
        onClick={e => e.stopPropagation()}
      >
        <AgentProductHeader
          agent={agent}
          purpose={purpose}
          onClose={onClose}
          closeTestId={closeTestId}
          latestRunAt={latestRunAt}
          monitoringState={monitoringState}
        />
        <AgentSafetyBanner agent={agent} productNote={safetyProductNote} />
        {actionBar}
        {sectionNavigation}
        <div className={AGENT_PRODUCT_TOKENS.scrollOwner} data-testid="agent-product-body">
          <div className={`${AGENT_PRODUCT_TOKENS.contentGutter} py-4`}>{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
