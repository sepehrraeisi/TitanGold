import React from 'react';
import { MetricCard } from '../shell/agentsShellUi.ts';

export type AgentMetricItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'red';
  valueState?: 'loaded' | 'unavailable' | 'zero' | 'loading';
  title?: string;
};

export const AgentMetricGrid: React.FC<{
  metrics: AgentMetricItem[];
  columns?: '2' | '3' | '4';
  testId?: string;
}> = ({ metrics, columns = '4', testId = 'agent-metric-grid' }) => {
  const gridClass =
    columns === '2'
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === '3'
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-3`} data-testid={testId}>
      {metrics.map(metric => (
        <MetricCard
          key={metric.id}
          label={metric.label}
          value={metric.value}
          color={metric.color || 'blue'}
          valueState={metric.valueState || 'loaded'}
          title={metric.title}
        />
      ))}
    </div>
  );
};
