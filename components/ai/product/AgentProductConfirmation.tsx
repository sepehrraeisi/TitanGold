import React, { useEffect, useId, useRef } from 'react';
import {
  FOCUS_RING,
  PrimaryButton,
  SecondaryButton,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AGENT_PRODUCT_LAYERS, AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type AgentProductConfirmationProps = {
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  children?: React.ReactNode;
  cancelTestId?: string;
  confirmTestId?: string;
  /** Element to restore focus to when the confirmation closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Alternative: restore focus to the first matching test id inside the agent dialog. */
  returnFocusTestId?: string;
  /** Backdrop click closes confirmation (canonical cancel). */
  closeOnBackdrop?: boolean;
};

/**
 * Nested confirmation layer for Agent Product Template dialogs.
 * Renders above popup content inside the dialog shell — not as a separate body portal.
 */
export const AgentProductConfirmation: React.FC<AgentProductConfirmationProps> = ({
  title,
  description,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  pending = false,
  children,
  cancelTestId = 'agent-product-confirm-cancel',
  confirmTestId = 'agent-product-confirm-run',
  returnFocusRef,
  returnFocusTestId,
  closeOnBackdrop = true,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current =
      (returnFocusRef?.current as HTMLElement | null) ||
      (document.activeElement as HTMLElement | null);

    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);

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
        if (!pending) onCancel();
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
      const restoreTarget =
        returnFocusRef?.current ||
        (returnFocusTestId
          ? (document.querySelector(
              `[data-testid="${returnFocusTestId}"]`,
            ) as HTMLElement | null)
          : null) ||
        previouslyFocused.current;
      restoreTarget?.focus?.();
    };
  }, [onCancel, pending, returnFocusRef, returnFocusTestId]);

  return (
    <div
      className={AGENT_PRODUCT_LAYERS.confirmationRoot}
      data-testid="agent-product-confirmation-layer"
      data-layer-z={AGENT_PRODUCT_LAYERS.confirmationRoot.match(/z-\[(\d+)\]/)?.[1] ?? '30'}
    >
      <div
        className={AGENT_PRODUCT_LAYERS.confirmationBackdrop}
        aria-hidden="true"
        data-testid="agent-product-confirmation-backdrop"
        onClick={closeOnBackdrop && !pending ? onCancel : undefined}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description || children ? descriptionId : undefined}
        data-testid="agent-product-confirmation-panel"
        data-layer-z={AGENT_PRODUCT_LAYERS.confirmationPanel.match(/z-\[(\d+)\]/)?.[1] ?? '40'}
        className={`${AGENT_PRODUCT_LAYERS.confirmationPanel} ${AGENT_PRODUCT_TOKENS.contentGutter}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="py-4 sm:py-5 space-y-3 min-h-0 flex-1 overflow-y-auto">
          <h3 id={titleId} className={`${AGENT_PRODUCT_TOKENS.titleMd} text-foreground`}>
            {title}
          </h3>
          {description ? (
            <p id={descriptionId} className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          ) : null}
          {children ? (
            <div id={description ? undefined : descriptionId} className="text-sm text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 py-4 border-t border-white/10 shrink-0">
          <SecondaryButton
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            disabled={pending}
            data-testid={cancelTestId}
            className={`w-full sm:w-auto ${FOCUS_RING}`}
          >
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid={confirmTestId}
            className="w-full sm:w-auto"
          >
            {pending ? confirmLabel : confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};
