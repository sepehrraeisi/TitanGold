import React from 'react';

interface SummaryCardProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: string;
    variant?: 'default' | 'success' | 'warning' | 'error';
    className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
    label,
    value,
    icon,
    trend,
    variant = 'default',
    className = ''
}) => {
    const variantClasses = {
        default: 'bg-secondary/40',
        success: 'bg-green-500/10 border-green-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        error: 'bg-red-500/10 border-red-500/30'
    };

    const trendColor = trend?.startsWith('+')
        ? 'text-green-400'
        : trend?.startsWith('-')
            ? 'text-red-400'
            : 'text-muted-foreground';

    return (
        <div className={`${variantClasses[variant]} rounded-lg p-4 border border-border ${className}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {label}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                        {value}
                    </p>
                    {trend && (
                        <p className={`text-xs mt-1 font-medium ${trendColor}`}>
                            {trend}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="text-muted-foreground opacity-60 ml-3">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SummaryCard;
