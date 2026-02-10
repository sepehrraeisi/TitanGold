import React, { Component, ReactNode, ErrorInfo } from 'react';

/**
 * Error Boundary Component
 * TASK-FE-002: Add error boundaries
 * 
 * Catches React errors in child components and displays a friendly error message
 * with retry functionality and backend error logging.
 */

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo
        });

        // Log error to backend
        this.logErrorToBackend(error, errorInfo);

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        if (import.meta.env.DEV) {
            console.error('Error caught by ErrorBoundary:', error, errorInfo);
        }
    }

    logErrorToBackend = async (error: Error, errorInfo: ErrorInfo) => {
        try {
            const token = localStorage.getItem('titan_token') || localStorage.getItem('token');
            if (!token) {
                console.warn('Cannot log error to backend: No auth token found.');
                return;
            }

            // Using a standard logging endpoint pattern
            await fetch('/api/v1/monitoring/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    context: 'ReactErrorBoundary',
                    message: error.message,
                    stack: error.stack,
                    meta: {
                        componentStack: errorInfo.componentStack,
                        userAgent: navigator.userAgent,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (logError) {
            console.error('Failed to log error to backend:', logError);
        }
    };

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-white">
                    <div className="text-6xl mb-6">⚠️</div>
                    <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
                    <p className="text-slate-400 text-center max-w-md mb-8">
                        We're sorry, but something unexpected happened. The error has been logged and our team will look into it.
                    </p>

                    {import.meta.env.DEV && this.state.error && (
                        <div className="w-full max-w-2xl mb-8">
                            <details className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                                <summary className="p-4 cursor-pointer font-semibold text-rose-400 hover:bg-slate-900 transition-colors">
                                    Error Details (Development Only)
                                </summary>
                                <div className="p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                                        {this.state.error.toString()}
                                        {"\n\n"}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </div>
                            </details>
                        </div>
                    )}

                    <button
                        onClick={this.handleRetry}
                        className="px-8 py-3 bg-rose-600 hover:bg-rose-500 active:transform active:scale-95 text-white font-bold rounded-lg shadow-lg shadow-rose-900/20 transition-all"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
