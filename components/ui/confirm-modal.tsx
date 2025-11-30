import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface ConfirmModalProps {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'danger' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    message,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    type = 'warning'
}) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
            <div className={`bg-card border rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${bgColor}`} onClick={e => e.stopPropagation()}>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        {type === 'danger' ? '⚠️' : type === 'info' ? 'ℹ️' : '⚠️'} {t('confirm_action') || 'Confirm Action'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                    >
                        {cancelText || t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-md text-white ${buttonColor} transition-colors`}
                    >
                        {confirmText || t('confirm') || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

