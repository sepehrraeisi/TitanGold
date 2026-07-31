import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArbitrageIntegrationsSection } from '../../../../components/ai/arbitrage/ArbitrageIntegrationsSection.tsx';
import en from '../../../../deploy/blue/locales/en.json';
import fa from '../../../../deploy/blue/locales/fa.json';
import type { ArbitrageCoreIntegrationsResponse } from '../../../../services/api.ts';
import { isRawLocaleKey } from '../../../../utils/integrationsPresentation.ts';

const tEn = (key: string) => (en as Record<string, string>)[key] ?? key;
const tFa = (key: string) => (fa as Record<string, string>)[key] ?? key;

const sampleData: ArbitrageCoreIntegrationsResponse = {
  productId: 'arbitrage',
  generatedAt: '2026-07-24T10:00:00.000Z',
  dataContractVersion: '1.0',
  overallState: 'ready',
  overallReasonCode: 'monitoring_ready',
  publicDataReady: true,
  schedulingReady: true,
  persistenceReady: true,
  notificationDeliveryReady: false,
  executionReady: false,
  executionSupported: false,
  executionEligible: false,
  dataSources: ['MEXC spot (public market data)'],
  limitations: [
    { code: 'execution_not_supported', labelKey: 'arb_int_limit_execution_not_supported' },
  ],
  availableActions: [
    { id: 'open_settings', labelKey: 'arb_int_action_open_settings', target: 'settings' },
    { id: 'view_scan_history', labelKey: 'arb_int_action_view_history', target: 'history' },
    {
      id: 'manage_connections',
      labelKey: 'arb_int_action_manage_connections',
      target: 'connections',
      contextual: true,
    },
  ],
  items: [
    {
      id: 'mexc_public_market_data',
      productLabelKey: 'arb_int_item_mexc_public',
      category: 'data_pipeline',
      configured: true,
      operationalState: 'operational',
      verificationState: 'verified',
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: 'mexc-public-market-data',
      dependency: 'MEXC spot public ticker and depth via internal proxy',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: '2026-07-24T10:04:00.000Z',
      evidenceSource: 'ai_decisions.latest_scan',
      reasonCode: 'public_spot_no_credentials',
      consumerImpact: 'analytical_scan_market_observations',
      technicalDetails: {
        credentialRequired: false,
        privateAccountIntegration: false,
        authorizesExecution: false,
      },
    },
    {
      id: 'scheduler',
      productLabelKey: 'arb_int_item_scheduler',
      category: 'runtime_orchestration',
      configured: true,
      operationalState: 'operational',
      verificationState: 'verified',
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: 'titan-engine-worker',
      dependency: 'analytical_scheduler_status',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: '2026-07-24T10:04:00.000Z',
      evidenceSource: 'scheduler_status_cache',
      reasonCode: 'scheduler_owner_worker',
      consumerImpact: 'scheduled_analytical_scans',
      technicalDetails: {
        dimensions: {
          owner: 'titan-engine-worker',
          registered: true,
          enabled: true,
          allowlisted: true,
          scheduled: true,
          monitoringState: 'active',
          lastTickAt: '2026-07-24T10:05:00.000Z',
          lastSuccessfulArbitrageRunAt: '2026-07-24T10:04:00.000Z',
        },
      },
    },
    {
      id: 'redis_scan_lock',
      productLabelKey: 'arb_int_item_redis_lock',
      category: 'runtime_orchestration',
      configured: true,
      operationalState: 'degraded',
      verificationState: 'unverified',
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'arbitrage-scan-lock',
      dependency: 'titan:arbitrage:scan_lock:',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: null,
      evidenceSource: 'runtime_redis_client',
      reasonCode: 'redis_configured',
      consumerImpact: 'duplicate_scan_protection',
      technicalDetails: { fallback: 'memory' },
    },
    {
      id: 'notification_preference',
      productLabelKey: 'arb_int_item_notification_preference',
      category: 'notifications',
      configured: true,
      operationalState: 'operational',
      verificationState: 'verified',
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'arbitrage_settings',
      dependency: 'agent.config.autoActions.notifyOnOpportunity',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: '2026-07-24T10:00:00.000Z',
      evidenceSource: 'settings_dto',
      reasonCode: 'notification_preference_stored',
      consumerImpact: 'stores_user_preference_only',
    },
    {
      id: 'notification_delivery',
      productLabelKey: 'arb_int_item_notification_delivery',
      category: 'notifications',
      configured: false,
      operationalState: 'unavailable',
      verificationState: 'verified',
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'notification_platform',
      dependency: 'delivery_pipeline',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: null,
      evidenceSource: 'product_contract',
      reasonCode: 'notification_delivery_disabled',
      consumerImpact: 'no_outbound_alerts_for_analytical_scans',
    },
    {
      id: 'financial_execution',
      productLabelKey: 'arb_int_item_execution',
      category: 'execution',
      configured: false,
      operationalState: 'blocked',
      verificationState: 'verified',
      requiredForMonitoring: false,
      requiredForExecution: true,
      owner: 'runtime_execution_policy',
      dependency: 'global_execution_runtime',
      lastCheckedAt: '2026-07-24T10:00:00.000Z',
      lastSuccessfulAt: null,
      evidenceSource: 'runtime_execution_state',
      reasonCode: 'execution_not_supported',
      consumerImpact: 'no_orders_settlement_or_transfers',
      technicalDetails: {
        blockedReasons: ['execution_not_supported', 'execution_demo_runtime', 'execution_emergency_stop'],
      },
    },
  ],
};

describe('ArbitrageIntegrationsSection', () => {
  it('renders readiness summary and categories without duplicate Integrations heading', () => {
    render(
      <ArbitrageIntegrationsSection
        data={sampleData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onViewScanHistory={vi.fn()}
        onManageConnections={vi.fn()}
        t={tEn}
      />,
    );

    expect(screen.getByTestId('arb-integrations-section')).toBeTruthy();
    expect(screen.getByTestId('arb-int-readiness')).toBeTruthy();
    expect(screen.getByTestId('arb-int-data-pipeline')).toBeTruthy();
    expect(screen.getByTestId('arb-int-runtime')).toBeTruthy();
    expect(screen.getByTestId('arb-int-notifications')).toBeTruthy();
    expect(screen.getByTestId('arb-int-execution-blocked')).toBeTruthy();

    const headings = screen.getAllByRole('heading', { name: /Integrations/i });
    expect(headings.length).toBe(1);
  });

  it('does not render raw locale keys or reason codes in normal view', () => {
    render(
      <ArbitrageIntegrationsSection
        data={sampleData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onViewScanHistory={vi.fn()}
        t={tEn}
      />,
    );

    const section = screen.getByTestId('arb-integrations-section');
    const text = section.textContent || '';
    expect(text).not.toMatch(/\barb_int_[a-z0-9_]+\b/);
    expect(text).not.toContain('public_spot_no_credentials');
    expect(text).not.toContain('execution_not_supported');
    expect(text).not.toContain('Data unavailable');
  });

  it('renders FA labels and scheduler owner LTR in RTL mode', () => {
    render(
      <ArbitrageIntegrationsSection
        data={sampleData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onViewScanHistory={vi.fn()}
        t={tFa}
        locale="fa-IR"
      />,
    );

    expect(screen.getByText('یکپارچه‌سازی‌ها')).toBeTruthy();
    expect(screen.getByText('titan-engine-worker')).toBeTruthy();
    const sectionText = screen.getByTestId('arb-integrations-section').textContent || '';
    expect(sectionText).toMatch(/داده بازار|زمان‌بندی/);
    expect(isRawLocaleKey('arb_int_title')).toBe(true);
    expect(sectionText.includes('arb_int_')).toBe(false);
  });

  it('opens technical disclosure without native alert', () => {
    render(
      <ArbitrageIntegrationsSection
        data={sampleData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onViewScanHistory={vi.fn()}
        t={tEn}
      />,
    );

    fireEvent.click(screen.getByTestId('arb-int-disclosure-mexc'));
    expect(screen.getByTestId('arb-int-technical-mexc')).toBeTruthy();
    expect(screen.getByText(/Private credentials are not required/i)).toBeTruthy();
  });

  it('wires deep link actions', () => {
    const onOpenSettings = vi.fn();
    const onViewScanHistory = vi.fn();
    const onManageConnections = vi.fn();

    render(
      <ArbitrageIntegrationsSection
        data={sampleData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenSettings={onOpenSettings}
        onViewScanHistory={onViewScanHistory}
        onManageConnections={onManageConnections}
        t={tEn}
      />,
    );

    fireEvent.click(screen.getByTestId('arb-int-action-open_settings'));
    fireEvent.click(screen.getByTestId('arb-int-action-view_scan_history'));
    fireEvent.click(screen.getByTestId('arb-int-action-manage_connections'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onViewScanHistory).toHaveBeenCalledTimes(1);
    expect(onManageConnections).toHaveBeenCalledTimes(1);
  });
});
