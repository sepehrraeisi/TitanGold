import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // Log error to error tracking service (e.g., Sentry)
        // if (window.Sentry) {
        //     window.Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
        // }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorFallback
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onReset={this.handleReset}
                />
            );
        }

        return this.props.children;
    }
}

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo: ErrorInfo | null;
    onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, errorInfo, onReset }) => {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0D111C] p-4">
            <div className="max-w-2xl w-full bg-[#161B22] border border-red-500/30 rounded-xl p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {t('error_boundary_title') || 'Something went wrong'}
                        </h1>
                        <p className="text-gray-400 mt-1">
                            {t('error_boundary_desc') || 'An unexpected error occurred. Please try again.'}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm font-semibold text-red-400 mb-2">
                            {t('error_message') || 'Error Message:'}
                        </p>
                        <p className="text-sm text-gray-300 font-mono break-all">
                            {error.message || 'Unknown error'}
                        </p>
                        {error.stack && (
                            <details className="mt-3">
                                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                                    {t('show_stack_trace') || 'Show Stack Trace'}
                                </summary>
                                <pre className="mt-2 text-xs text-gray-400 overflow-auto max-h-40 font-mono">
                                    {error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                )}

                {errorInfo && errorInfo.componentStack && (
                    <details className="mb-6">
                        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
                            {t('show_component_stack') || 'Show Component Stack'}
                        </summary>
                        <pre className="text-xs text-gray-500 overflow-auto max-h-40 font-mono bg-gray-900/50 p-3 rounded">
                            {errorInfo.componentStack}
                        </pre>
                    </details>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onReset}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        {t('try_again') || 'Try Again'}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                        {t('reload_page') || 'Reload Page'}
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                        {t('go_home') || 'Go Home'}
                    </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                    <p className="text-xs text-gray-500 text-center">
                        {t('error_boundary_help') || 'If this problem persists, please contact support with the error details above.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ErrorBoundary;

