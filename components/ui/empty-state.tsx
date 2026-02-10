import React from 'react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
            {icon && (
                <div className="text-muted-foreground opacity-40 mb-4 scale-150">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {description}
                </p>
            )}
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
};

export default EmptyState;
