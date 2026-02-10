import React, { useEffect, useState } from 'react';

interface ErrorAlertProps {
    message: string;
    severity?: 'error' | 'warning' | 'info';
    onRetry?: () => void;
    onDismiss?: () => void;
    autoDismiss?: number;
    className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
    message,
    severity = 'error',
    onRetry,
    onDismiss,
    autoDismiss,
    className = ''
}) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (autoDismiss && autoDismiss > 0) {
            const timer = setTimeout(() => {
                setVisible(false);
                onDismiss?.();
            }, autoDismiss);
            return () => clearTimeout(timer);
        }
    }, [autoDismiss, onDismiss]);

    if (!visible) return null;

    const severityClasses = {
        error: 'bg-red-500/10 border-red-500/50 text-red-400',
        warning: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400',
        info: 'bg-blue-500/10 border-blue-500/50 text-blue-400'
    };

    const severityIcons = {
        error: '⚠️',
        warning: '⚡',
        info: 'ℹ️'
    };

    return (
        <div className={`${severityClasses[severity]} border rounded-lg p-4 mb-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                    <span className="text-xl">{severityIcons[severity]}</span>
                    <div className="flex-1">
                        <p className="text-sm font-medium">{message}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            Retry
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={() => {
                                setVisible(false);
                                onDismiss();
                            }}
                            className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ErrorAlert;
