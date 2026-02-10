import React from 'react';

interface StatusBadgeProps {
    status: 'success' | 'warning' | 'error' | 'info' | 'neutral' | string;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    pulse?: boolean;
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    label,
    size = 'md',
    pulse = false,
    className = ''
}) => {
    const statusClasses = {
        success: 'bg-green-500/20 text-green-400 border-green-500/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        error: 'bg-red-500/20 text-red-400 border-red-500/30',
        info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };

    const sizeClasses = {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5'
    };

    const statusClass = statusClasses[status as keyof typeof statusClasses] || statusClasses.neutral;
    const sizeClass = sizeClasses[size];

    return (
        <span
            className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold border
        ${statusClass} ${sizeClass} ${className}
        ${pulse ? 'animate-pulse' : ''}
      `}
        >
            {pulse && (
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                </span>
            )}
            {label || status}
        </span>
    );
};

export default StatusBadge;
