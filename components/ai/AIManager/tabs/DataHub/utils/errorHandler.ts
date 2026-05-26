/**
 * Error Handler Utility for DataHub Components
 * Provides user-friendly error messages and categorization
 */

export interface DataHubError {
    type: ErrorType;
    message: string;
    originalError?: any;
    retryable: boolean;
    userMessage: string;
    technicalDetails?: string;
}

export enum ErrorType {
    NETWORK = 'network',
    AUTHENTICATION = 'authentication',
    RATE_LIMIT = 'rate_limit',
    SESSION_EXPIRED = 'session_expired',
    VALIDATION = 'validation',
    CONFLICT = 'conflict',
    DATABASE = 'database',
    TELEGRAM_API = 'telegram_api',
    PERMISSION = 'permission',
    UNKNOWN = 'unknown'
}

/**
 * Parse and categorize error responses
 */
export function parseDataHubError(error: any): DataHubError {
    // Network errors
    if (error.message?.includes('Network') || error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
        return {
            type: ErrorType.NETWORK,
            message: 'Network connection failed',
            originalError: error,
            retryable: true,
            userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
            technicalDetails: error.message
        };
    }

    // Rate limiting (HTTP 429)
    if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('Too Many Requests')) {
        const retryAfter = error.headers?.get('Retry-After') || error.retry_after || 60;
        return {
            type: ErrorType.RATE_LIMIT,
            message: 'Rate limit exceeded',
            originalError: error,
            retryable: true,
            userMessage: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
            technicalDetails: `Rate limit: ${retryAfter}s cooldown`
        };
    }

    // Authentication errors (HTTP 401)
    if (error.status === 401 || error.message?.includes('Unauthorized') || error.message?.includes('authentication')) {
        return {
            type: ErrorType.AUTHENTICATION,
            message: 'Authentication failed',
            originalError: error,
            retryable: false,
            userMessage: 'Your session has expired. Please log in again.',
            technicalDetails: error.message
        };
    }

    // Session expired
    if (error.message?.includes('session') && (error.message?.includes('expired') || error.message?.includes('invalid'))) {
        return {
            type: ErrorType.SESSION_EXPIRED,
            message: 'Session expired',
            originalError: error,
            retryable: false,
            userMessage: 'Your Telegram session has expired. Please reconnect your account.',
            technicalDetails: error.message
        };
    }

    // Not found (HTTP 404)
    if (error.status === 404 || error.message?.includes('Not Found') || error.message?.includes('not found')) {
        return {
            type: ErrorType.VALIDATION,
            message: 'Not found',
            originalError: error,
            retryable: false,
            userMessage: 'The requested resource was not found. It may not be configured on this server yet.',
            technicalDetails: error.message,
        };
    }

    // Permission errors (HTTP 403)
    if (error.status === 403 || error.message?.includes('Forbidden') || error.message?.includes('permission')) {
        return {
            type: ErrorType.PERMISSION,
            message: 'Permission denied',
            originalError: error,
            retryable: false,
            userMessage: 'You don\'t have permission to perform this action.',
            technicalDetails: error.message
        };
    }

    // Conflict (HTTP 409) — duplicate name, FK on hard delete
    if (error.status === 409) {
        return {
            type: ErrorType.CONFLICT,
            message: 'Conflict',
            originalError: error,
            retryable: false,
            userMessage: error.message || 'This action conflicts with existing data. Check duplicates or related records.',
            technicalDetails: error.message,
        };
    }

    // Validation errors (HTTP 400, 422)
    if (error.status === 400 || error.status === 422 || error.message?.includes('validation') || error.message?.includes('invalid')) {
        return {
            type: ErrorType.VALIDATION,
            message: 'Validation failed',
            originalError: error,
            retryable: false,
            userMessage: error.message || 'The provided information is invalid. Please check and try again.',
            technicalDetails: JSON.stringify(error.details || error.errors || error.message)
        };
    }

    // Database errors
    if (error.message?.includes('database') || error.message?.includes('query') || error.message?.includes('PostgreSQL')) {
        return {
            type: ErrorType.DATABASE,
            message: 'Database error',
            originalError: error,
            retryable: true,
            userMessage: 'A database error occurred. Our team has been notified. Please try again later.',
            technicalDetails: error.message
        };
    }

    // Telegram API specific errors
    if (error.message?.includes('Telegram') || error.message?.includes('MTProto') || error.message?.includes('FLOOD_WAIT')) {
        const floodWait = error.message?.match(/FLOOD_WAIT_(\d+)/)?.[1];
        if (floodWait) {
            return {
                type: ErrorType.TELEGRAM_API,
                message: 'Telegram flood wait',
                originalError: error,
                retryable: true,
                userMessage: `Telegram API rate limit reached. Please wait ${floodWait} seconds.`,
                technicalDetails: error.message
            };
        }

        return {
            type: ErrorType.TELEGRAM_API,
            message: 'Telegram API error',
            originalError: error,
            retryable: true,
            userMessage: 'Unable to communicate with Telegram. Please try again later.',
            technicalDetails: error.message
        };
    }

    // Server errors (HTTP 500+)
    if (error.status >= 500) {
        return {
            type: ErrorType.UNKNOWN,
            message: 'Server error',
            originalError: error,
            retryable: true,
            userMessage: 'A server error occurred. Our team has been notified. Please try again later.',
            technicalDetails: error.message
        };
    }

    // Default unknown error
    return {
        type: ErrorType.UNKNOWN,
        message: error.message || 'An unknown error occurred',
        originalError: error,
        retryable: true,
        userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
        technicalDetails: JSON.stringify(error)
    };
}

/**
 * Get appropriate icon for error type
 */
export function getErrorIcon(errorType: ErrorType): string {
    const icons = {
        [ErrorType.NETWORK]: '🌐',
        [ErrorType.AUTHENTICATION]: '🔐',
        [ErrorType.RATE_LIMIT]: '⏱️',
        [ErrorType.SESSION_EXPIRED]: '⏰',
        [ErrorType.VALIDATION]: '⚠️',
        [ErrorType.CONFLICT]: '⚡',
        [ErrorType.DATABASE]: '💾',
        [ErrorType.TELEGRAM_API]: '📱',
        [ErrorType.PERMISSION]: '🚫',
        [ErrorType.UNKNOWN]: '❌'
    };
    return icons[errorType] || '❌';
}

/**
 * Get appropriate color/severity for error type
 */
export function getErrorSeverity(errorType: ErrorType): 'error' | 'warning' | 'info' {
    const severity = {
        [ErrorType.NETWORK]: 'warning' as const,
        [ErrorType.AUTHENTICATION]: 'error' as const,
        [ErrorType.RATE_LIMIT]: 'warning' as const,
        [ErrorType.SESSION_EXPIRED]: 'error' as const,
        [ErrorType.VALIDATION]: 'warning' as const,
        [ErrorType.CONFLICT]: 'warning' as const,
        [ErrorType.DATABASE]: 'error' as const,
        [ErrorType.TELEGRAM_API]: 'warning' as const,
        [ErrorType.PERMISSION]: 'error' as const,
        [ErrorType.UNKNOWN]: 'error' as const
    };
    return severity[errorType] || 'error';
}

/**
 * Format error for logging/monitoring
 */
export function formatErrorForLogging(error: DataHubError): string {
    return `[${error.type.toUpperCase()}] ${error.message} - ${error.technicalDetails || 'No details'}`;
}

/**
 * Check if error should trigger alert/notification
 */
export function shouldNotifyUser(errorType: ErrorType): boolean {
    // Don't notify for validation errors (inline validation should handle)
    // Do notify for everything else
    return errorType !== ErrorType.VALIDATION;
}

/**
 * Get suggested action for error
 */
export function getSuggestedAction(errorType: ErrorType): string {
    const actions = {
        [ErrorType.NETWORK]: 'Check your internet connection and try again.',
        [ErrorType.AUTHENTICATION]: 'Please log in again to continue.',
        [ErrorType.RATE_LIMIT]: 'Wait a moment and try again.',
        [ErrorType.SESSION_EXPIRED]: 'Reconnect your Telegram account in Settings.',
        [ErrorType.VALIDATION]: 'Please review your input and try again.',
        [ErrorType.CONFLICT]: 'Resolve the conflict (duplicate name or linked data) and try again.',
        [ErrorType.DATABASE]: 'Try again in a few moments. Contact support if the issue persists.',
        [ErrorType.TELEGRAM_API]: 'Wait a moment and try again. Telegram may be experiencing issues.',
        [ErrorType.PERMISSION]: 'Contact your administrator for access.',
        [ErrorType.UNKNOWN]: 'Try again or contact support if the issue persists.'
    };
    return actions[errorType] || 'Please try again later.';
}

/**
 * Main error handler function
 */
export function handleDataHubError(
    error: any,
    context?: string,
    onRetry?: () => void
): DataHubError {
    const parsedError = parseDataHubError(error);
    
    // Log to console for debugging
    console.error(`[DataHub Error${context ? ` - ${context}` : ''}]:`, formatErrorForLogging(parsedError));
    
    // TODO: Send to monitoring service (e.g., Sentry)
    // if (process.env.NODE_ENV === 'production') {
    //     Sentry.captureException(parsedError.originalError, {
    //         tags: { errorType: parsedError.type, context },
    //         extra: { parsedError }
    //     });
    // }
    
    return parsedError;
}

export default {
    parseDataHubError,
    handleDataHubError,
    getErrorIcon,
    getErrorSeverity,
    formatErrorForLogging,
    shouldNotifyUser,
    getSuggestedAction
};
