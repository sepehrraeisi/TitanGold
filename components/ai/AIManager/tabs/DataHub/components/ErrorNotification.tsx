/**
 * DataHub Error Notification Component
 * User-friendly error display with retry and dismiss actions
 */

import React from 'react';
import { DataHubError, ErrorType, getErrorIcon, getSuggestedAction, getErrorSeverity } from '../utils/errorHandler';
import styles from './ErrorNotification.module.css';

interface ErrorNotificationProps {
    error: DataHubError | null;
    onDismiss: () => void;
    onRetry?: () => void;
    showTechnicalDetails?: boolean;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
    error,
    onDismiss,
    onRetry,
    showTechnicalDetails = false
}) => {
    if (!error) return null;

    const [showDetails, setShowDetails] = React.useState(false);
    const severity = getErrorSeverity(error.type);
    const icon = getErrorIcon(error.type);
    const suggestedAction = getSuggestedAction(error.type);

    return (
        <div className={`error-notification ${severity}`} role="alert">
            <div className="error-header">
                <span className="error-icon">{icon}</span>
                <h4 className="error-title">{error.userMessage}</h4>
                <button 
                    className="dismiss-button" 
                    onClick={onDismiss}
                    aria-label="Dismiss error"
                >
                    ✕
                </button>
            </div>

            <p className="suggested-action">{suggestedAction}</p>

            <div className="error-actions">
                {error.retryable && onRetry && (
                    <button 
                        className="retry-button" 
                        onClick={onRetry}
                    >
                        🔄 Retry
                    </button>
                )}
                
                {showTechnicalDetails && error.technicalDetails && (
                    <button 
                        className="details-toggle" 
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {showDetails ? '▲' : '▼'} Technical Details
                    </button>
                )}
            </div>

            {showDetails && error.technicalDetails && (
                <div className="technical-details">
                    <code>{error.technicalDetails}</code>
                </div>
            )}

            <style jsx>{`
                .error-notification {
                    position: relative;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    animation: slideIn 0.3s ease-out;
                }

                @keyframes slideIn {
                    from {
                        transform: translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .error-notification.error {
                    background: #fee;
                    border-left: 4px solid #e53935;
                }

                .error-notification.warning {
                    background: #fff3cd;
                    border-left: 4px solid #ff9800;
                }

                .error-notification.info {
                    background: #e3f2fd;
                    border-left: 4px solid #2196f3;
                }

                .error-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }

                .error-icon {
                    font-size: 24px;
                }

                .error-title {
                    flex: 1;
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }

                .dismiss-button {
                    background: transparent;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #666;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }

                .dismiss-button:hover {
                    background: rgba(0,0,0,0.1);
                }

                .suggested-action {
                    margin: 8px 0 12px 36px;
                    color: #666;
                    font-size: 14px;
                }

                .error-actions {
                    display: flex;
                    gap: 8px;
                    margin-left: 36px;
                }

                .retry-button,
                .details-toggle {
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .retry-button {
                    background: #2196f3;
                    color: white;
                    border: none;
                }

                .retry-button:hover {
                    background: #1976d2;
                }

                .details-toggle {
                    background: transparent;
                    color: #666;
                    border-color: #ddd;
                }

                .details-toggle:hover {
                    background: rgba(0,0,0,0.05);
                }

                .technical-details {
                    margin-top: 12px;
                    margin-left: 36px;
                    padding: 12px;
                    background: rgba(0,0,0,0.05);
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #333;
                    overflow-x: auto;
                }

                .technical-details code {
                    white-space: pre-wrap;
                    word-break: break-all;
                }
            `}</style>
        </div>
    );
};

export default ErrorNotification;
