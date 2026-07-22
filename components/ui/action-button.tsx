import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Canonical TitanGold action button — including filled destructive (danger).
 * Prefer this over ad-hoc red outline styles for product delete actions.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const variantClasses = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border-indigo-600',
      secondary: 'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 border-slate-700',
      success: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border-emerald-600',
      danger: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-red-600 shadow-sm',
      ghost: 'bg-transparent hover:bg-white/5 active:bg-white/10 text-foreground border-transparent',
    };

    const sizeClasses = {
      sm: 'min-h-8 text-xs px-3 py-1.5',
      md: 'min-h-9 text-sm px-4 py-2',
      lg: 'min-h-11 text-base px-6 py-3',
    };

    const isDisabled = disabled || loading;
    const focusRing =
      variant === 'danger'
        ? 'focus-visible:ring-white/80 focus-visible:ring-offset-slate-950'
        : 'focus-visible:ring-indigo-400/70 focus-visible:ring-offset-slate-950';

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-variant={variant}
        data-loading={loading ? 'true' : 'false'}
        className={[
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg border transition-colors',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          focusRing,
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].filter(Boolean).join(' ')}
      >
        {loading ? (
          <svg
            className="h-4 w-4 shrink-0 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            data-testid="action-button-spinner"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          icon
        )}
        {children}
      </button>
    );
  },
);

ActionButton.displayName = 'ActionButton';

export default ActionButton;
