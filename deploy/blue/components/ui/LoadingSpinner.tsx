import React from 'react';
import { cn } from '../../lib/utils';

/**
 * LoadingSpinner Component
 * 
 * A standardized loading spinner component used throughout the TitanGold application.
 * 
 * @component
 * @example
 * // Basic usage
 * <LoadingSpinner />
 * 
 * @example
 * // With custom size
 * <LoadingSpinner size="lg" />
 * 
 * @example
 * // With message
 * <LoadingSpinner message="Loading agents..." />
 * 
 * @example
 * // Centered in container
 * <LoadingSpinner centered />
 */

export interface LoadingSpinnerProps {
  /** Size variant of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional loading message to display below spinner */
  message?: string;
  /** Whether to center the spinner in its container */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'accent';
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
  xl: 'w-16 h-16 border-4',
};

const variantClasses = {
  primary: 'border-blue-500 border-t-transparent',
  secondary: 'border-gray-400 border-t-transparent',
  accent: 'border-yellow-500 border-t-transparent',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  centered = false,
  className,
  variant = 'primary',
}) => {
  const spinnerElement = (
    <div className={cn('inline-flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin rounded-full',
          sizeClasses[size],
          variantClasses[variant]
        )}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-sm text-gray-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center min-h-[200px] w-full">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

/**
 * AgentLoadingSpinner Component
 * 
 * Specialized loading spinner for agent control panels.
 * Pre-configured with appropriate size and messaging for agent contexts.
 * 
 * @component
 * @example
 * <AgentLoadingSpinner agentName="Technical Analysis" />
 */
export interface AgentLoadingSpinnerProps {
  /** Name of the agent being loaded */
  agentName?: string;
  /** Whether to center the spinner */
  centered?: boolean;
}

export const AgentLoadingSpinner: React.FC<AgentLoadingSpinnerProps> = ({
  agentName,
  centered = true,
}) => {
  const message = agentName 
    ? `Loading ${agentName} Agent...` 
    : 'Loading agent...';

  return (
    <LoadingSpinner 
      size="lg" 
      message={message}
      centered={centered}
      variant="primary"
    />
  );
};

/**
 * InlineLoadingSpinner Component
 * 
 * Small inline spinner for use within buttons, inputs, or other inline contexts.
 * 
 * @component
 * @example
 * <button disabled>
 *   <InlineLoadingSpinner /> Processing...
 * </button>
 */
export const InlineLoadingSpinner: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <LoadingSpinner 
      size="sm" 
      className={cn('inline-block', className)}
      variant="secondary"
    />
  );
};

export default LoadingSpinner;
