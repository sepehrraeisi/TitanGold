import React, { useMemo, useState } from 'react';
import type { ArbitrageCoreIntegrationsResponse } from '../../../services/api.ts';
import { SecondaryButton, StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AgentTechnicalLtr } from '../shell/AgentControlShell.tsx';
import {
  AgentEmptyState,
  AgentErrorState,
  AgentLoadingState,
  AgentMetricGrid,
  AgentSectionHeader,
  AgentListRow,
  type AgentMetricItem,
} from '../product/index.ts';
import {
  findIntegrationItem,
  operationalStateVariant,
  presentActionLabel,
  presentBoolean,
  presentConsumerImpact,
  presentOperationalState,
  presentOverallState,
  presentReadinessDimension,
  presentReasonCode,
  presentSchedulerDimensionLabel,
  presentTimestamp,
  presentVerificationState,
  resolveIntegrationLabel,
  type TranslateFn,
} from '../../../utils/integrationsPresentation.ts';

export type ArbitrageIntegrationsSectionProps = {
  data: ArbitrageCoreIntegrationsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onViewScanHistory: () => void;
  onManageConnections?: () => void;
  t: TranslateFn;
  locale?: string;
};

const IntegrationsCard: React.FC<{ title: string; children: React.ReactNode; testId?: string }> = ({
  title,
  children,
  testId,
}) => (
  <section
    className="rounded-lg border border-gray-800 bg-gray-950/60 p-4 space-y-3"
    data-testid={testId}
  >
    <h3 className="text-sm font-medium text-gray-200">{title}</h3>
    {children}
  </section>
);

function buildReadinessMetrics(data: ArbitrageCoreIntegrationsResponse, t: TranslateFn): AgentMetricItem[] {
  const dimensions = [
    {
      id: 'market_data',
      ready: data.publicDataReady,
      key: 'market_data' as const,
    },
    {
      id: 'scheduling',
      ready: data.schedulingReady,
      key: 'scheduling' as const,
    },
    {
      id: 'scan_lock',
      ready: findIntegrationItem(data, 'redis_scan_lock')?.operationalState !== 'unavailable',
      key: 'scan_lock' as const,
    },
    {
      id: 'persistence',
      ready: data.persistenceReady,
      key: 'persistence' as const,
    },
    {
      id: 'notifications',
      ready: data.notificationDeliveryReady,
      key: 'notifications' as const,
    },
    {
      id: 'execution',
      ready: data.executionReady,
      key: 'execution' as const,
    },
  ];

  return dimensions.map(dim => {
    const presented = presentReadinessDimension(dim.key, dim.ready, t);
    return {
      id: dim.id,
      label: presented.label,
      value: (
        <StatusPill
          label={presentOperationalState(dim.ready ? 'operational' : dim.key === 'execution' ? 'blocked' : 'degraded', t)}
          variant={presented.tone === 'success' ? 'success' : presented.tone === 'danger' ? 'warning' : 'info'}
        />
      ),
      hint: presented.explanation,
      valueState: dim.ready ? 'loaded' : 'unavailable',
    };
  });
}

const IntegrationDetailRow: React.FC<{
  label: string;
  value: React.ReactNode;
  testId?: string;
}> = ({ label, value, testId }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 py-1.5" data-testid={testId}>
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs text-foreground sm:text-right break-words">{value}</span>
  </div>
);

const ItemDisclosure: React.FC<{
  itemId: string;
  title: string;
  summary: string;
  state: string;
  t: TranslateFn;
  children: React.ReactNode;
}> = ({ itemId, title, summary, state, t, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-800/80 bg-gray-950/40" data-testid={`arb-int-item-${itemId}`}>
      <button
        type="button"
        className="w-full px-3 py-2.5 text-left flex flex-wrap items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-lg"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        data-testid={`arb-int-disclosure-${itemId}`}
      >
        <span className="text-sm font-medium text-gray-100">{title}</span>
        <StatusPill
          label={presentOperationalState(state, t)}
          variant={operationalStateVariant(state) === 'success' ? 'success' : operationalStateVariant(state) === 'danger' ? 'warning' : 'info'}
        />
      </button>
      <div className="px-3 pb-3 space-y-2">
        <p className="text-xs text-muted-foreground">{summary}</p>
        {open ? (
          <div className="pt-2 border-t border-gray-800/80 space-y-1" data-testid={`arb-int-technical-${itemId}`}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const ArbitrageIntegrationsSection: React.FC<ArbitrageIntegrationsSectionProps> = ({
  data,
  loading,
  error,
  onRefresh,
  onOpenSettings,
  onViewScanHistory,
  onManageConnections,
  t,
}) => {
  const metrics = useMemo(() => (data ? buildReadinessMetrics(data, t) : []), [data, t]);

  if (loading && !data) {
    return (
      <AgentLoadingState
        message={resolveIntegrationLabel('loading', t) || 'Loading…'}
        testId="arb-int-loading"
      />
    );
  }

  if (error && !data) {
    return (
      <AgentErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('retry') || 'Retry'}
        testId="arb-int-error"
      />
    );
  }

  if (!data) {
    return (
      <AgentEmptyState
        message={resolveIntegrationLabel('arb_int_empty', t) || 'Integration status unavailable.'}
        testId="arb-int-empty"
      />
    );
  }

  const mexc = findIntegrationItem(data, 'mexc_public_market_data');
  const proxy = findIntegrationItem(data, 'internal_market_proxy');
  const scheduler = findIntegrationItem(data, 'scheduler');
  const redis = findIntegrationItem(data, 'redis_scan_lock');
  const database = findIntegrationItem(data, 'database_persistence');
  const notifyPref = findIntegrationItem(data, 'notification_preference');
  const notifyDelivery = findIntegrationItem(data, 'notification_delivery');
  const connections = findIntegrationItem(data, 'connections_private_mexc');
  const execution = findIntegrationItem(data, 'financial_execution');
  const schedulerDims = (scheduler?.technicalDetails?.dimensions || {}) as Record<string, unknown>;

  return (
    <div className="space-y-5 min-w-0" data-testid="arb-integrations-section">
      <AgentSectionHeader
        title={resolveIntegrationLabel('arb_int_title', t) || 'Integrations'}
        subtitle={resolveIntegrationLabel('arb_int_subtitle', t) || ''}
        actions={
          <SecondaryButton type="button" data-testid="arb-int-refresh" onClick={onRefresh}>
            {resolveIntegrationLabel('refresh', t) || 'Refresh'}
          </SecondaryButton>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="arb-int-overall">
        {resolveIntegrationLabel('arb_int_overall_label', t)}:{' '}
        <span className="text-foreground">{presentOverallState(data.overallState, t)}</span>
      </p>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_readiness_summary', t) || 'Integration readiness'}
        testId="arb-int-readiness"
      >
        <AgentMetricGrid metrics={metrics} testId="arb-int-readiness-grid" />
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_data_pipeline', t) || 'Data pipeline'}
        testId="arb-int-data-pipeline"
      >
        <div className="space-y-3">
          {mexc ? (
            <ItemDisclosure
              itemId="mexc"
              title={resolveIntegrationLabel(mexc.productLabelKey, t) || 'MEXC public market data'}
              summary={presentReasonCode(mexc.reasonCode, t) || resolveIntegrationLabel('arb_int_mexc_summary', t) || ''}
              state={mexc.operationalState}
              t={t}
            >
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_verification', t) || 'Verification'}
                value={presentVerificationState(mexc.verificationState, t)}
              />
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_last_success', t) || 'Last successful evidence'}
                value={<AgentTechnicalLtr>{presentTimestamp(mexc.lastSuccessfulAt, t)}</AgentTechnicalLtr>}
              />
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_impact', t) || 'Impact'}
                value={presentConsumerImpact(mexc.consumerImpact, t) || '—'}
              />
              <p className="text-[11px] text-amber-200/90 pt-1">
                {resolveIntegrationLabel('arb_int_mexc_no_credentials', t)}
              </p>
            </ItemDisclosure>
          ) : null}
          {proxy ? (
            <ItemDisclosure
              itemId="proxy"
              title={resolveIntegrationLabel(proxy.productLabelKey, t) || 'Internal market proxy'}
              summary={presentReasonCode(proxy.reasonCode, t) || resolveIntegrationLabel('arb_int_proxy_summary', t) || ''}
              state={proxy.operationalState}
              t={t}
            >
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_endpoint', t) || 'Endpoint'}
                value={
                  <AgentTechnicalLtr>
                    {String(proxy.technicalDetails?.basePath || '/api/market/mexc')}
                  </AgentTechnicalLtr>
                }
              />
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_last_success', t) || 'Last successful evidence'}
                value={<AgentTechnicalLtr>{presentTimestamp(proxy.lastSuccessfulAt, t)}</AgentTechnicalLtr>}
              />
              <IntegrationDetailRow
                label={resolveIntegrationLabel('arb_int_field_impact', t) || 'Impact'}
                value={presentConsumerImpact(proxy.consumerImpact, t) || '—'}
              />
            </ItemDisclosure>
          ) : null}
        </div>
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_runtime', t) || 'Runtime orchestration'}
        testId="arb-int-runtime"
      >
        {scheduler ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['owner', 'registered', 'enabled', 'allowlisted', 'scheduled', 'monitoringState'] as const).map(key => (
                <AgentStatusRow
                  key={key}
                  label={presentSchedulerDimensionLabel(key, t)}
                  value={
                    key === 'owner' ? (
                      <AgentTechnicalLtr>{String(schedulerDims[key] || 'titan-engine-worker')}</AgentTechnicalLtr>
                    ) : key === 'monitoringState' ? (
                      resolveIntegrationLabel(
                        schedulerDims.monitoringState === 'paused' ? 'monitoring_paused' : 'monitoring_active',
                        t,
                      )
                    ) : (
                      presentBoolean(Boolean(schedulerDims[key]), t)
                    )
                  }
                  testId={`arb-int-scheduler-${key}`}
                />
              ))}
            </div>
            <IntegrationDetailRow
              label={presentSchedulerDimensionLabel('lastTickAt', t)}
              value={<AgentTechnicalLtr>{presentTimestamp(String(schedulerDims.lastTickAt || ''), t)}</AgentTechnicalLtr>}
              testId="arb-int-scheduler-last-tick"
            />
            <IntegrationDetailRow
              label={presentSchedulerDimensionLabel('lastSuccessfulArbitrageRunAt', t)}
              value={
                <AgentTechnicalLtr>
                  {presentTimestamp(String(schedulerDims.lastSuccessfulArbitrageRunAt || ''), t)}
                </AgentTechnicalLtr>
              }
              testId="arb-int-scheduler-last-run"
            />
          </div>
        ) : null}
        {redis ? (
          <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2" data-testid="arb-int-redis">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-200">
                {resolveIntegrationLabel(redis.productLabelKey, t) || 'Redis scan lock'}
              </span>
              <StatusPill
                label={presentOperationalState(redis.operationalState, t)}
                variant={operationalStateVariant(redis.operationalState) === 'success' ? 'success' : 'info'}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {presentReasonCode(redis.reasonCode, t) || presentConsumerImpact(redis.consumerImpact, t)}
            </p>
            <IntegrationDetailRow
              label={resolveIntegrationLabel('arb_int_field_fallback', t) || 'Fallback'}
              value={<AgentTechnicalLtr>{String(redis.technicalDetails?.fallback || 'memory')}</AgentTechnicalLtr>}
            />
          </div>
        ) : null}
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_persistence', t) || 'Persistence'}
        testId="arb-int-persistence"
      >
        {database ? (
          <div className="space-y-2">
            <IntegrationDetailRow
              label={resolveIntegrationLabel('arb_int_field_state', t) || 'State'}
              value={
                <StatusPill
                  label={presentOperationalState(database.operationalState, t)}
                  variant={operationalStateVariant(database.operationalState) === 'success' ? 'success' : 'info'}
                />
              }
            />
            <IntegrationDetailRow
              label={resolveIntegrationLabel('arb_int_field_last_persisted_run', t) || 'Last persisted run'}
              value={<AgentTechnicalLtr>{presentTimestamp(database.lastSuccessfulAt, t)}</AgentTechnicalLtr>}
            />
            <IntegrationDetailRow
              label={resolveIntegrationLabel('arb_int_field_impact', t) || 'Impact'}
              value={presentConsumerImpact(database.consumerImpact, t) || '—'}
            />
          </div>
        ) : null}
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_notifications', t) || 'Notifications'}
        testId="arb-int-notifications"
      >
        <div className="space-y-3">
          {notifyPref ? (
            <AgentListRow testId="arb-int-notification-preference">
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <span>{resolveIntegrationLabel(notifyPref.productLabelKey, t)}</span>
                <StatusPill label={presentOperationalState(notifyPref.operationalState, t)} variant="info" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {presentReasonCode(notifyPref.reasonCode, t)}
              </p>
            </AgentListRow>
          ) : null}
          {notifyDelivery ? (
            <AgentListRow testId="arb-int-notification-delivery">
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <span>{resolveIntegrationLabel(notifyDelivery.productLabelKey, t)}</span>
                <StatusPill label={presentOperationalState(notifyDelivery.operationalState, t)} variant="warning" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {presentReasonCode(notifyDelivery.reasonCode, t)}
              </p>
            </AgentListRow>
          ) : null}
        </div>
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_execution', t) || 'Execution and private account dependencies'}
        testId="arb-int-execution"
      >
        {connections ? (
          <p className="text-xs text-muted-foreground mb-3" data-testid="arb-int-connections-note">
            {presentReasonCode(connections.reasonCode, t)}
          </p>
        ) : null}
        {execution ? (
          <div className="space-y-2" data-testid="arb-int-execution-blocked">
            <StatusPill label={presentOperationalState(execution.operationalState, t)} variant="warning" />
            <p className="text-xs text-muted-foreground">
              {resolveIntegrationLabel('arb_int_execution_blocked_explanation', t)}
            </p>
            <ul className="text-xs text-muted-foreground list-disc ps-5 space-y-1">
              {(execution.technicalDetails?.blockedReasons as string[] | undefined)?.map(code => {
                const text = presentReasonCode(code, t);
                if (!text) return null;
                return <li key={code}>{text}</li>;
              })}
            </ul>
          </div>
        ) : null}
      </IntegrationsCard>

      <IntegrationsCard
        title={resolveIntegrationLabel('arb_int_section_limitations', t) || 'Limitations and next actions'}
        testId="arb-int-limitations"
      >
        <ul className="text-xs text-muted-foreground list-disc ps-5 space-y-1 mb-4">
          {data.limitations?.map(limit => {
            const text = resolveIntegrationLabel(limit.labelKey, t);
            if (!text || text === limit.labelKey) return null;
            return <li key={limit.code}>{text}</li>;
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {data.availableActions?.map(action => {
            const label = presentActionLabel(action, t);
            if (!label) return null;
            const onClick =
              action.target === 'settings'
                ? onOpenSettings
                : action.target === 'history'
                  ? onViewScanHistory
                  : action.target === 'connections'
                    ? onManageConnections
                    : undefined;
            if (!onClick) return null;
            return (
              <SecondaryButton
                key={action.id}
                type="button"
                data-testid={`arb-int-action-${action.id}`}
                onClick={onClick}
              >
                {label}
              </SecondaryButton>
            );
          })}
        </div>
      </IntegrationsCard>
    </div>
  );
};

const AgentStatusRow: React.FC<{
  label: string;
  value: React.ReactNode;
  testId?: string;
}> = ({ label, value, testId }) => (
  <div
    className="rounded-md border border-gray-800/70 bg-gray-900/40 px-3 py-2 min-w-0"
    data-testid={testId}
  >
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-xs font-medium mt-0.5 truncate">{value}</p>
  </div>
);
