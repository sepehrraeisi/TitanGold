import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    className = '',
    ...props
}) => {
    const variantClasses = {
        primary: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
        secondary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
        success: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
        danger: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
        ghost: 'bg-transparent hover:bg-secondary/50 text-foreground border-border'
    };

    const sizeClasses = {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3'
    };

    const isDisabled = disabled || loading;

    return (
        <button
            {...props}
            disabled={isDisabled}
            className={`
        inline-flex items-center justify-center gap-2 
        font-semibold rounded-lg border transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
        >
            {loading ? (
                <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            ) : icon}
            {children}
        </button>
    );
};

export default ActionButton;
