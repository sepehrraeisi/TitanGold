import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const bgColor = type === 'success' 
        ? 'bg-green-500/90 border-green-400' 
        : type === 'error' 
        ? 'bg-red-500/90 border-red-400' 
        : 'bg-blue-500/90 border-blue-400';

    const textColor = 'text-white';

    return (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border shadow-lg ${bgColor} ${textColor} min-w-[250px] max-w-[400px] animate-in slide-in-from-top-5`}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{message}</p>
                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

