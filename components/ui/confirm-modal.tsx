import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface ConfirmModalProps {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'danger' | 'info';
    /** Element to restore focus to on close (e.g. preference toggle). */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Viewport-centered confirm dialog via portal.
 * Does not use document-scroll coordinates.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    message,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    type = 'warning',
    returnFocusRef,
}) => {
    const { t } = useLanguage();
    const titleId = useId();
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocused.current =
            (returnFocusRef?.current as HTMLElement | null) ||
            (document.activeElement as HTMLElement | null);

        const dialog = dialogRef.current;
        const focusables = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE);
        const first = focusables?.[0];
        const last = focusables?.[focusables.length - 1];
        // Prefer Cancel as initial focus for safer default
        const cancelBtn = dialog?.querySelector<HTMLElement>('[data-confirm-cancel]');
        (cancelBtn || first)?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
                return;
            }
            if (e.key !== 'Tab' || !focusables || focusables.length === 0) return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.body.style.overflow = prevOverflow;
            const restoreTarget =
                returnFocusRef?.current || previouslyFocused.current;
            if (restoreTarget && typeof restoreTarget.focus === 'function') {
                restoreTarget.focus();
            }
        };
    }, [isOpen, onCancel, returnFocusRef]);

    if (!isOpen || typeof document === 'undefined') return null;

    const bgColor = type === 'danger'
        ? 'bg-red-500/20 border-red-500/50'
        : type === 'info'
        ? 'bg-blue-500/20 border-blue-500/50'
        : 'bg-yellow-500/20 border-yellow-500/50';

    const buttonColor = type === 'danger'
        ? 'bg-red-500 hover:bg-red-600'
        : type === 'info'
        ? 'bg-blue-500 hover:bg-blue-600'
        : 'bg-yellow-500 hover:bg-yellow-600';

    return createPortal(
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onCancel}
            role="presentation"
            data-testid="confirm-modal-overlay"
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-testid="confirm-modal"
                className={`bg-card border rounded-lg shadow-xl p-6 max-w-md w-full ${bgColor} relative max-h-[min(90vh,640px)] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4">
                    <h3 id={titleId} className="text-lg font-semibold text-foreground mb-2">
                        {t('confirm_action') || 'Confirm Action'}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
                </div>
                <div className="flex gap-3 justify-end flex-wrap">
                    <button
                        type="button"
                        data-confirm-cancel
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                        {cancelText || t('cancel') || 'Cancel'}
                    </button>
                    <button
                        type="button"
                        data-confirm-ok
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-md text-white ${buttonColor} transition-colors`}
                    >
                        {confirmText || t('confirm') || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default ConfirmModal;
