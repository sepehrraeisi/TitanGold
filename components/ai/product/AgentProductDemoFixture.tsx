/**
 * Visual/test harness for Agent Product Template V1.
 * Covers desktop/mobile shell slots — not mounted in production routes.
 */
import React from 'react';
import {
  AgentActionBar,
  AgentContentSurface,
  AgentEmptyState,
  AgentErrorState,
  AgentLoadingState,
  AgentMetricGrid,
  AgentPrimaryAction,
  AgentProductDialog,
  AgentSecondaryAction,
  AgentSectionHeader,
  AgentSectionNavigation,
} from './index.ts';
import type { AIAgent } from '../../../types.ts';

export type AgentProductDemoFixtureProps = {
  locale?: 'en' | 'fa';
  longTitle?: boolean;
  loading?: boolean;
  error?: boolean;
};

const demoAgent: AIAgent = {
  id: 'demo-agent',
  name: 'Demo Arbitrage Agent With A Very Long Product Title For Layout QA',
  status: 'active',
  agent_key: 'arbitrage',
  role: 'Analytical MEXC spot spread monitor',
} as AIAgent;

export const AgentProductDemoFixture: React.FC<AgentProductDemoFixtureProps> = ({
  longTitle = false,
  loading = false,
  error = false,
}) => {
  const agent = longTitle ? demoAgent : ({ ...demoAgent, name: 'Arbitrage Agent' } as AIAgent);
  const [tab, setTab] = React.useState('overview');

  return (
    <AgentProductDialog
      agent={agent}
      onClose={() => {}}
      purpose="Template demo fixture"
      latestRunAt="2026-07-24T12:00:00.000Z"
      monitoringState="active"
      safetyProductNote="Analytical mode only. No live orders."
      actionBar={
        <AgentActionBar>
          <AgentPrimaryAction label="Run analytical scan" onClick={() => {}} testId="demo-run" />
          <AgentSecondaryAction label="Pause monitoring" onClick={() => {}} testId="demo-pause" />
        </AgentActionBar>
      }
      sectionNavigation={
        <AgentSectionNavigation
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'candidates', label: 'Candidates' },
            { id: 'history', label: 'History' },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          ariaLabel="Demo tabs"
        />
      }
    >
      <AgentContentSurface>
        <AgentSectionHeader title="Operational summary" subtitle="Demo content surface" />
        {loading ? (
          <AgentLoadingState message="Loading overview..." />
        ) : error ? (
          <AgentErrorState message="Failed to load overview." onRetry={() => {}} retryLabel="Retry" />
        ) : tab === 'overview' ? (
          <AgentMetricGrid
            metrics={[
              { id: 'a', label: 'Qualified', value: 0, color: 'emerald', valueState: 'zero' },
              { id: 'b', label: 'Rejected', value: 7, color: 'amber' },
              { id: 'c', label: 'Total scans', value: 1753, color: 'blue' },
            ]}
          />
        ) : (
          <AgentEmptyState message="Select another section in the harness." />
        )}
      </AgentContentSurface>
    </AgentProductDialog>
  );
};

export default AgentProductDemoFixture;
