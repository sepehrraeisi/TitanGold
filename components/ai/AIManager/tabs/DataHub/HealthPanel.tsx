import React from 'react';
import * as api from '../../../../../services/api';
import { DataHubState } from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import ApiWrapper from '../../../../common/ApiWrapper';

interface HealthPanelProps {
    t: (key: string) => string;
    health: DataHubState['health'];
    handleCheckHealth: () => void;
    isLoading: boolean;
    error: string | null;
    setError: (err: string | null) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const HealthPanel: React.FC<HealthPanelProps> = ({ t, health, handleCheckHealth, isLoading, error, setError, Card }) => {
    return (
        <ApiWrapper
            error={error}
            setError={setError}
            isLoading={isLoading && !health}
        >
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('health_monitoring') || 'Health Monitoring'}</h3>
                    <button
                        onClick={handleCheckHealth}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isLoading ? t('checking') || 'Checking...' : t('check_health') || 'Check Health'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('active_connections') || 'Active Connections'}</p>
                        {isLoading ? <SkeletonLoader width="40px" height="1.75rem" /> : <p className="text-lg font-bold text-green-400">{health.activeConnections}</p>}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('failed_connections') || 'Failed Connections'}</p>
                        {isLoading ? <SkeletonLoader width="40px" height="1.75rem" /> : <p className="text-lg font-bold text-red-400">{health.failedConnections}</p>}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('avg_response_time') || 'Avg Response Time'}</p>
                        {isLoading ? <SkeletonLoader width="60px" height="1.75rem" /> : <p className="text-lg font-bold text-foreground">{health.averageResponseTime.toFixed(0)}ms</p>}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('cache_hit_rate') || 'Cache Hit Rate'}</p>
                        {isLoading ? <SkeletonLoader width="60px" height="1.75rem" /> : <p className="text-lg font-bold text-purple-400">{health.cacheHitRate.toFixed(1)}%</p>}
                    </div>
                </div>
            </Card>
        </ApiWrapper>
    );
};

export default HealthPanel;
