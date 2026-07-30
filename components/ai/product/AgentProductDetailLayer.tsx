import React, { useEffect, useId, useRef } from 'react';
import { BTN_SECONDARY, FOCUS_RING } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AGENT_PRODUCT_LAYERS, AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type AgentProductDetailLayerProps = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  closeTestId?: string;
  layerTestId?: string;
  panelTestId?: string;
  returnFocusTestId?: string;
  returnFocusScopeTestId?: string;
};

/**
 * Nested read-only detail layer inside Agent Product Dialog shell.
 * Covers the full dialog surface (including header) — not a body portal.
 */
export const AgentProductDetailLayer: React.FC<AgentProductDetailLayerProps> = ({
  title,
  closeLabel,
  onClose,
  children,
  closeTestId = 'agent-product-detail-close',
  layerTestId = 'agent-product-detail-layer',
  panelTestId = 'agent-product-detail-panel',
  returnFocusTestId,
  returnFocusScopeTestId = 'agent-product-dialog',
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const scopeRoot = returnFocusScopeTestId
      ? (document.querySelector(
          `[data-testid="${returnFocusScopeTestId}"]`,
        ) as HTMLElement | null)
      : null;

    const resolveReturnTarget = () => {
      if (returnFocusTestId) {
        const scoped = scopeRoot?.querySelector(
          `[data-testid="${returnFocusTestId}"]`,
        ) as HTMLElement | null;
        if (scoped) return scoped;
        return document.querySelector(
          `[data-testid="${returnFocusTestId}"]`,
        ) as HTMLElement | null;
      }
      return null;
    };

    previouslyFocused.current =
      resolveReturnTarget() || (document.activeElement as HTMLElement | null);

    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const getFocusable = () => {
      const root = panelRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
      );
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = getFocusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      const restoreTarget = resolveReturnTarget() || previouslyFocused.current;
      restoreTarget?.focus?.();
      window.requestAnimationFrame(() => restoreTarget?.focus?.());
    };
  }, [onClose, returnFocusTestId, returnFocusScopeTestId]);

  return (
    <div
      className={`${AGENT_PRODUCT_LAYERS.confirmationRoot} items-stretch sm:items-center p-0 sm:p-4`}
      data-testid={layerTestId}
      data-layer-z={AGENT_PRODUCT_LAYERS.confirmationRoot.match(/z-\[(\d+)\]/)?.[1] ?? '30'}
    >
      <div
        className={AGENT_PRODUCT_LAYERS.confirmationBackdrop}
        aria-hidden="true"
        data-testid="agent-product-detail-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={panelTestId}
        data-layer-z={AGENT_PRODUCT_LAYERS.confirmationPanel.match(/z-\[(\d+)\]/)?.[1] ?? '40'}
        className={`${AGENT_PRODUCT_LAYERS.confirmationPanel} ${AGENT_PRODUCT_TOKENS.contentGutter} max-h-full sm:max-h-[min(85vh,100dvh-8rem)] w-full max-w-none sm:max-w-lg flex flex-col`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 py-4 border-b border-white/10 shrink-0 sticky top-0 bg-inherit z-[1]">
          <h3 id={titleId} className={`${AGENT_PRODUCT_TOKENS.titleMd} text-foreground min-w-0 break-words`}>
            {title}
          </h3>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            data-testid={closeTestId}
            className={`${BTN_SECONDARY} ${FOCUS_RING} shrink-0`}
          >
            {closeLabel}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4">{children}</div>
      </div>
    </div>
  );
};

export default AgentProductDetailLayer;
