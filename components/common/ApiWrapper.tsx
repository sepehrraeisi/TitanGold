
import React from 'react';
import { ErrorAlert } from '../ui/error-alert';
import LoadingSpinner from '../ui/LoadingSpinner';

interface ApiWrapperProps {
    error: string | null;
    setError: (error: string | null) => void;
    isLoading?: boolean;
    children: React.ReactNode;
    className?: string;
}

/**
 * ApiWrapper Component
 * 
 * Standardizes error display and loading states for API-driven components within 
 * the Advanced Features section.
 */
export const ApiWrapper: React.FC<ApiWrapperProps> = ({
    error,
    setError,
    isLoading,
    children,
    className = ""
}) => {
    return (
        <div className={`relative ${className}`}>
            {/* Error Overlay/Alert */}
            {error && (
                <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ErrorAlert
                        message={error}
                        onDismiss={() => setError(null)}
                    />
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
                    <div className="bg-popover/80 p-4 rounded-full shadow-lg border border-border">
                        <LoadingSpinner size="lg" />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
                {children}
            </div>
        </div>
    );
};

export default ApiWrapper;
