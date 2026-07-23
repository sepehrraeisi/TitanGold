import React, { useEffect, useId, useRef } from 'react';
import ActionButton from '../../ui/action-button.tsx';

type Props = {
  open: boolean;
  providerName?: string;
  confirming?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Canonical destructive confirmation for Connections Danger Zone.
 * Does not invoke delete by itself — parent owns the handler.
 */
export default function MexcDeleteConfirmDialog({
  open,
  providerName = 'MEXC',
  confirming = false,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!confirming) onCancel();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, confirming, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="mexc-delete-confirm-dialog">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!confirming) onCancel();
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 shadow-2xl"
      >
        <div className="border-b border-white/10 p-4">
          <h3 id={titleId} className="text-sm font-semibold text-red-100">
            {title}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-slate-300" data-testid="mexc-delete-dialog-provider">
            {providerName}
          </p>
        </div>
        <div className="p-4">
          <p id={descId} className="text-xs leading-relaxed text-slate-300">
            {description}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-white/10 p-4 sm:flex-row sm:justify-end">
          <ActionButton
            ref={cancelRef}
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={confirming}
            data-testid="mexc-delete-cancel"
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant="danger"
            size="md"
            loading={confirming}
            disabled={confirming}
            onClick={onConfirm}
            data-testid="mexc-delete-confirm"
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
