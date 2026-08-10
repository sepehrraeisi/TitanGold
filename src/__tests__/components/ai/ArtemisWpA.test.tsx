import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { ARTEMIS_AGENT_CATALOG } from '../../../../constants/artemisAgentCatalog.js';
import { RAW_ENUM_SCAN, SIMPLE_VIEW_FORBIDDEN } from '../../../../components/ai/AIManager/artemisProductCopy.ts';

const productEn = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../deploy/blue/locales/en.json'), 'utf8'),
) as Record<string, string>;

const catalogAgents = ARTEMIS_AGENT_CATALOG.map((agent) => ({
  key: agent.key,
  registryKey: agent.registryKey,
  nameKey: agent.nameKey,
  group: agent.group,
  authority: agent.key === 'optimization' ? 'not_applicable' : agent.authority,
  readiness: agent.key === 'liquidity'
    ? 'BLOCKED'
    : agent.key === 'order'
      ? 'NOT_EXECUTION_ELIGIBLE'
      : agent.key === 'optimization'
        ? 'NOT_APPLICABLE'
        : agent.key === 'pattern'
          ? 'BLOCKED'
          : 'ROLE_MAPPED',
  operational: 'configured',
  exists: true,
  operationalNow: agent.key !== 'liquidity',
  evidenceCompatible: ['trend', 'arbitrage', 'volume'].includes(agent.key),
  evidenceAvailable: false,
  consumption: agent.key === 'liquidity'
    ? 'blocked'
    : agent.key === 'order'
      ? 'not_execution_eligible'
      : agent.key === 'optimization'
        ? 'not_applicable'
        : agent.key === 'pattern'
          ? 'blocked'
          : ['trend', 'arbitrage', 'volume'].includes(agent.key)
            ? 'evidence_compatible'
            : 'contract_pending',
  limitationKey: agent.key === 'liquidity'
    ? 'artemis_liquidity_stub'
    : agent.key === 'risk'
      ? 'artemis_risk_uuid_debt'
      : agent.key === 'optimization'
        ? 'artemis_optimization_not_sizing_authority'
        : agent.key === 'pattern'
          ? 'artemis_pattern_source_provenance_blocked'
          : null,
  truth: 'CONFIGURED',
}));

const readinessFixture = {
  maturityStage: 'LEGACY_ADVISORY',
  classification: 'LEGACY_ADVISORY_ONLY',
  executionEligible: false,
  executionEligibility: 'NOT_EXECUTION_ELIGIBLE',
  contract: {
    schemaVersion: '1.0.0',
    contractVersion: 'artemis-evidence-1.0.0',
    readiness: 'EVIDENCE_FOUNDATION_IMPLEMENTED',
    implemented: true,
    adaptersRequired: true,
    compatibleAgentCount: 3,
    catalogAgentCount: 15,
    artemisConsumable: false,
    decisionEligible: false,
    executionEligible: false,
    truth: 'MEASURED',
  },
  evidence: {
    readiness: 'ON_READ_PARTIAL',
    reasonKey: 'artemis_evidence_foundation_not_artemis_consumable',
    truth: 'MEASURED',
    artemisConsumable: false,
    decisionEligible: false,
    executionEligible: false,
    compatibleAgentCount: 3,
    availableAgentCount: 0,
  },
  orchestration: {
    readiness: 'LEGACY',
    realAgentCoordination: false,
    reasonKey: 'artemis_orchestration_mock_legacy',
    truth: 'LEGACY',
  },
  controlChain: {
    risk: { authority: 'veto', readiness: 'PARTIAL', truth: 'CONFIGURED', limitationKey: 'artemis_risk_uuid_debt', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'risk' } },
    portfolio: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED' },
    optimization: { authority: 'not_applicable', readiness: 'NOT_APPLICABLE', truth: 'CONFIGURED', limitationKey: 'artemis_optimization_not_sizing_authority' },
    liquidity: { authority: 'feasibility', readiness: 'BLOCKED', truth: 'CONFIGURED', limitationKey: 'artemis_liquidity_stub' },
    runtime: { authority: 'runtime_safety', readiness: 'AVAILABLE', truth: 'MEASURED' },
    order: { authority: 'execution_only', readiness: 'NOT_EXECUTION_ELIGIBLE', truth: 'CONFIGURED' },
  },
  runtime: {
    requestedMode: 'demo',
    effectiveMode: 'demo',
    killSwitchActive: false,
  },
  runtimeTruth: 'MEASURED',
  agents: {
    analyticalEvidence: { keys: ['technical', 'trend'], readiness: 'ROLE_MAPPED' },
    opportunityForecast: { keys: ['arbitrage'], readiness: 'ROLE_MAPPED' },
    control: { keys: ['risk'], readiness: 'ROLE_MAPPED' },
    feasibility: { keys: ['liquidity'], readiness: 'BLOCKED', limitationKey: 'artemis_liquidity_stub' },
    execution: { keys: ['order'], readiness: 'NOT_EXECUTION_ELIGIBLE' },
  },
  catalog: { truth: 'CONFIGURED', agents: catalogAgents },
  inventory: { truth: 'PERSISTED', agents: [], configuredCount: 15, operationalCount: 12 },
  dataHub: { truth: 'PERSISTED', status: 'available', totalSources: 4, activeSources: 3 },
  providers: {
    truth: 'MEASURED',
    ready: true,
    configured: 2,
    healthy: 2,
    activeHealthy: 2,
    activeUsableInstances: 2,
    quorum: 2,
    items: [],
  },
  connections: { truth: 'MEASURED', providerConnected: false, count: 0, status: 'broker_unavailable' },
  scheduler: { truth: 'MEASURED', allowlist: ['arbitrage'], agentsEnabled: true, isRunning: true, stale: false },
  advisory: { truth: 'PERSISTED', count: 0, latestAt: null, recent: [], limit: 50, loadedCount: 0, detailsAvailable: false },
  agentRuns: { truth: 'PERSISTED', count: 0, latestAt: null, recent: [], limit: 50, loadedCount: 0, detailsAvailable: false },
  provenance: { truth: 'MEASURED', runtimeCommit: '32a65e4' },
  pipeline: [
    { id: 'data_foundation', labelKey: 'artemis_pipe_data', ownerKey: 'artemis_owner_data_hub', status: 'AVAILABLE', truth: 'PERSISTED', nav: { view: 'ai', aiTab: 'data_hub' } },
    { id: 'evidence_contract', labelKey: 'artemis_pipe_evidence', ownerKey: 'artemis_nav_evidence', status: 'PARTIAL', truth: 'MEASURED', nav: { artemisSection: 'evidence' }, blockerKey: 'artemis_blocker_evidence_not_connected' },
  ],
  blockers: [
    { code: 'evidence_not_connected', severity: 'high', labelKey: 'artemis_blocker_evidence_not_connected' },
    { code: 'liquidity_unavailable', severity: 'high', labelKey: 'artemis_blocker_liquidity_unavailable' },
  ],
  owners: {
    dataHub: { view: 'ai', aiTab: 'data_hub' },
    decisionEngine: { view: 'settings', settingsTab: 'configuration', settingsSubtab: 'decision-engine' },
    connections: { view: 'settings', settingsTab: 'connections' },
  },
  limitations: ['artemis_evidence_foundation_not_artemis_consumable', 'artemis_decision_legacy_advisory_only', 'artemis_optimization_not_sizing_authority', 'artemis_no_live_automation'],
  dualConfigLimitationKey: 'artemis_dual_decision_engine_config',
  generatedAt: '2026-08-07T00:00:00.000Z',
};

vi.mock('../../../../services/artemisReadinessApi.ts', () => ({
  fetchArtemisReadiness: vi.fn(async () => readinessFixture),
  fetchArtemisAuditBundle: vi.fn(async () => ({ systemLogs: [], decisions: [] })),
  fetchArtemisLegacyDecisionLogs: vi.fn(async () => []),
}));

let currentLanguage: 'en' | 'fa' = 'en';
const tMap: Record<string, string> = {
  artemis: 'Artemis',
  ai_manager_artemis: 'Artemis',
  loading: 'Loading',
  ai_agents: 'Agents',
  ai_training: 'Training',
  ai_analytics: 'Analytics',
  ai_config: 'Configuration',
  ai_integrations: 'Integrations',
  ai_data_hub: 'Data Hub',
  artemis_data_hub: 'Data Hub',
  topic_routing: 'Topic Routing',
  ai_center_title: 'AI Center',
  ai_center_desc: 'Central intelligence, specialized agents, and data foundation',
  ai_center_nav: 'AI Center',
  ai_management_system: 'AI Center',
  ai_management_desc: 'AI Center',
  retry: 'Retry',
  requested_mode: 'Requested mode',
  effective_mode: 'Effective mode',
  emergency_stop: 'Emergency Stop',
  execution_eligibility: 'Execution eligibility',
  inactive: 'Inactive',
  active: 'Active',
  no: 'No',
  yes: 'Yes',
  unavailable: 'Unavailable',
  close: 'Close',
  search: 'Search',
  all: 'All',
  connections: 'Connections',
  decision_engine: 'Decision Engine',
  open_decision_engine_settings: 'Open Decision Engine',
  artemis_insights: 'Artemis Insights',
  artemis_insights_no_fake_confidence: 'No hardcoded confidence. Legacy advisory only.',
  artemis_nav_overview: 'Overview',
  artemis_nav_evidence: 'Evidence',
  artemis_nav_decisions: 'Decisions',
  artemis_nav_orchestration: 'Orchestration',
  artemis_nav_controls: 'Controls',
  artemis_nav_lineage: 'Lineage & Audit',
  artemis_nav_system: 'System & Integrations',
  ...productEn,
};

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => tMap[key] || key,
    language: currentLanguage,
    dir: currentLanguage === 'fa' ? 'rtl' : 'ltr',
  }),
}));

vi.mock('../../../../context/AppContext.tsx', () => ({
  useAppContext: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../../../../components/OfflineIndicator', () => ({
  __esModule: true,
  default: () => null,
  CachedDataBadge: () => null,
  useOnlineStatus: () => true,
}));

vi.mock('../../../../services/api', () => ({
  fetchAIManagerData: vi.fn(async () => ({})),
  fetchAIAgents: vi.fn(async () => []),
}));

vi.mock('../../../../components/ai/AIAgents.tsx', () => ({ default: () => <div>Agents Tab</div> }));
vi.mock('../../../../components/ai/TrainingCenter.tsx', () => ({ default: () => <div>Training Tab</div> }));
vi.mock('../../../../components/ai/AnalyticsDashboard.tsx', () => ({ default: () => <div>Analytics Tab</div> }));
vi.mock('../../../../components/ai/APIConfig.tsx', () => ({ default: () => <div>Config Tab</div> }));
vi.mock('../../../../components/ai/TopicRouting.tsx', () => ({ default: () => <div>Topic Routing Tab</div> }));
vi.mock('../../../../components/ai/DataHubWorkspace.tsx', () => ({
  default: () => (
    <div data-testid="datahub-workspace" data-datahub-owner="canonical">
      Canonical Data Hub
    </div>
  ),
}));

import AIManager from '../../../../components/ai/AIManager/index.tsx';
import AICenter, { readAiTabFromLocation } from '../../../../components/AICenter.tsx';
import ArtemisInsightsWidget from '../../../../components/widgets/ArtemisInsightsWidget.tsx';
import { CANONICAL_SECTIONS } from '../../../../components/ai/AIManager/artemisProductTypes.ts';
import { payloadToURLState, readStateFromURL, writeStateToURL } from '../../../../utils/urlSync.ts';
import { fetchArtemisAuditBundle, fetchArtemisReadiness } from '../../../../services/artemisReadinessApi.ts';
import { resolveRecordWindow } from '../../../../components/ai/AIManager/artemisActivityModel.ts';

function primaryText(): string {
  return document.body.innerText || '';
}

async function waitForHome() {
  await waitFor(() => expect(screen.getByText(/Artemis is analyzing only/i)).toBeInTheDocument());
}

describe('Artemis WP-A UI', () => {
  beforeEach(() => {
    currentLanguage = 'en';
    window.history.replaceState({}, '', '/?view=ai');
    localStorage.clear();
    vi.mocked(fetchArtemisReadiness).mockResolvedValue(readinessFixture as never);
    vi.mocked(fetchArtemisAuditBundle).mockResolvedValue({ systemLogs: [], decisions: [], loadFailed: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('AI Center uses Artemis visible label for manager id', async () => {
    render(<AICenter />);
    expect(await screen.findByRole('button', { name: 'Artemis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI Manager' })).not.toBeInTheDocument();
  });

  it('AI Center has first-class Data Hub navigation and keeps primary products reachable', async () => {
    render(<AICenter />);
    expect(await screen.findByRole('button', { name: 'Artemis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data Hub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Training' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Topic Routing' })).toBeInTheDocument();
    expect(document.querySelector('[aria-label="AI Center"]')?.className).toMatch(/overflow-x-auto/);

    fireEvent.click(screen.getByRole('button', { name: 'Data Hub' }));
    expect(await screen.findByTestId('datahub-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('datahub-workspace').getAttribute('data-datahub-owner')).toBe('canonical');

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }));
    expect(await screen.findByText('Agents Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Training' }));
    expect(await screen.findByText('Training Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
    expect(await screen.findByText('Analytics Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Artemis' }));
    await waitFor(() => expect(screen.getAllByText(/Artemis is analyzing only|Advisory only/i).length).toBeGreaterThan(0));
  });

  it('legacy Artemis data_hub deep links open AI Center Data Hub', () => {
    window.history.replaceState({}, '', '/?view=ai&subtab=data_hub');
    expect(readAiTabFromLocation()).toBe('data_hub');
    window.history.replaceState({}, '', '/?view=ai&artemisSection=data_hub');
    expect(readAiTabFromLocation()).toBe('data_hub');
    window.history.replaceState({}, '', '/?view=ai&aiTab=data_hub');
    expect(readAiTabFromLocation()).toBe('data_hub');
    window.history.replaceState({}, '', '/?view=ai&artemisSection=overview');
    expect(readAiTabFromLocation()).toBe('manager');
  });

  it('renders canonical Data Hub from legacy subtab without mounting a second owner', async () => {
    window.history.replaceState({}, '', '/?view=ai&subtab=data_hub');
    render(<AICenter />);
    expect(await screen.findByTestId('datahub-workspace')).toBeInTheDocument();
    expect(screen.queryAllByTestId('datahub-workspace')).toHaveLength(1);
  });

  it('Artemis System Open Data Hub navigates to AI Center Data Hub', async () => {
    const onNavigate = vi.fn();
    render(<AIManager onNavigate={onNavigate} />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'System Health' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Data Hub' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'ai', aiTab: 'data_hub' });
  });

  it('urlSync preserves aiTab deep links', () => {
    writeStateToURL(payloadToURLState({ view: 'ai', aiTab: 'data_hub' }), true);
    expect(readStateFromURL()?.aiTab).toBe('data_hub');
    expect(window.location.search).toContain('aiTab=data_hub');
  });

  it('keeps a single Data Hub UI owner', () => {
    const root = path.resolve(__dirname, '../../../..');
    const aiManager = fs.readFileSync(path.join(root, 'components/ai/AIManager/index.tsx'), 'utf8');
    const aiCenter = fs.readFileSync(path.join(root, 'components/AICenter.tsx'), 'utf8');
    expect(aiManager).not.toMatch(/DataHubTab/);
    expect(aiManager).not.toMatch(/DataHubWorkspace/);
    expect(aiCenter).toMatch(/DataHubWorkspace/);
  });

  it('renders canonical Artemis sections without Legacy Admin or Autopilot in product nav', async () => {
    render(<AIManager />);
    await waitForHome();
    for (const section of CANONICAL_SECTIONS) {
      expect(screen.getByRole('button', { name: tMap[section.labelKey] })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI Inputs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recommendations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coordination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Safety & Approval' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History & Audit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System Health' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Autopilot$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Legacy Admin/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Advisory only/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Automated trading is unavailable/i).length).toBeGreaterThan(0);
  });

  it('Overview shows runtime, blockers and owner links without fake metrics', async () => {
    const onNavigate = vi.fn();
    render(<AIManager onNavigate={onNavigate} />);
    await waitForHome();
    expect(screen.getAllByText(/Connect Agent intelligence/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/87%/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Agents' })[0]);
    expect(onNavigate).toHaveBeenCalledWith({ view: 'ai', aiTab: 'agents' });
  });

  it('Evidence renders 15 Agents by role without fake envelopes', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'AI Inputs' }));
    expect(await screen.findByText(/Artemis receives intelligence from 15 specialized AI Agents/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Market Analysis/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Order Management/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'View all Agents' }));
    expect(screen.getAllByText(/Technical Analysis/i).length).toBeGreaterThan(0);
    expect(primaryText()).not.toMatch(/WP-B|WP-D/);
  });

  it('Decisions shows true empty recommendations without claiming records exist', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Recommendations' }));
    expect(await screen.findByText(/No recommendations have been generated yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/advisory only/i).length).toBeGreaterThan(0);
    expect(primaryText()).not.toMatch(/No advisory records exist/i);
  });

  it('Orchestration shows truthful topology, not mock coordination', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Coordination' }));
    expect(await screen.findByText(/Current coordination/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not active/i).length).toBeGreaterThan(0);
    expect(primaryText()).not.toMatch(/agent-1|UUID mismatch/i);
  });

  it('Controls shows Risk veto, liquidity limitation and order boundary', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Safety & Approval' }));
    expect(await screen.findByText(/Why execution is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Protects the portfolio from unacceptable risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Makes sure an order could realistically be executed/i)).toBeInTheDocument();
    expect(screen.getByText(/Only executes an intent after every required approval/i)).toBeInTheDocument();
    expect(screen.queryByText(/^veto$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/execution_only/)).not.toBeInTheDocument();
  });

  it('Lineage keeps audit sources separated', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'History & Audit' }));
    expect((await screen.findAllByText(/Recent Artemis recommendations/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recent Agent activity/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No Artemis recommendations or Agent activity have been recorded yet/i)).toBeInTheDocument();
  });

  it('System shows dependency statuses and canonical links', async () => {
    const onNavigate = vi.fn();
    render(<AIManager onNavigate={onNavigate} />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'System Health' }));
    expect(await screen.findByText(/AI Providers/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Data Hub' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'ai', aiTab: 'data_hub' });
    expect(screen.getByText(/Administrative tools|Administrative \/ legacy tools/i)).toBeInTheDocument();
    expect(screen.queryByText(/Enable Autopilot/i)).not.toBeInTheDocument();
  });

  it('writes artemisSection deep link', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Recommendations' }));
    await waitFor(() => {
      expect(window.location.search).toContain('artemisSection=decisions');
    });
  });

  it('Insights widget has no hardcoded confidence 87', async () => {
    render(<ArtemisInsightsWidget />);
    await waitFor(() => expect(screen.getAllByText(/Advisory only/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/87%/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/No hardcoded confidence/i).length).toBeGreaterThan(0);
  });

  it('supports FA RTL shell direction', async () => {
    currentLanguage = 'fa';
    const { container } = render(<AIManager />);
    await waitFor(() => expect(container.querySelector('[data-artemis-shell]')).toBeTruthy());
    expect(container.querySelector('[data-artemis-shell]')?.getAttribute('dir')).toBe('rtl');
  });

  it('AI Center supports FA RTL navigation', async () => {
    currentLanguage = 'fa';
    const { container } = render(<AICenter />);
    await waitFor(() => expect(container.querySelector('[data-ai-center]')).toBeTruthy());
    expect(container.querySelector('[data-ai-center]')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('button', { name: 'Data Hub' })).toBeInTheDocument();
  });

  it('primary Artemis copy has no raw enums or translation keys', async () => {
    render(<AIManager />);
    await waitForHome();
    const text = primaryText();
    for (const token of RAW_ENUM_SCAN) {
      expect(text).not.toContain(token);
    }
    expect(text).not.toMatch(/artemis_[a-z_]+/);
  });

  it('Simple view forbids engineering tokens until Advanced is opened', async () => {
    const { container } = render(<AIManager />);
    await waitForHome();
    const text = primaryText();
    for (const token of SIMPLE_VIEW_FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(String(token).toLowerCase());
    }
    expect(container.querySelector('[data-artemis-view="simple"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(container.querySelector('[data-artemis-view="advanced"]')).toBeTruthy();
  });

  it('A: advisory count > 0 with empty logs does not say no records exist', async () => {
    vi.mocked(fetchArtemisReadiness).mockResolvedValue({
      ...readinessFixture,
      advisory: {
        truth: 'PERSISTED',
        count: 7,
        latestAt: '2026-08-08T07:31:00.000Z',
        recent: [],
        limit: 50,
        loadedCount: 0,
        detailsAvailable: false,
      },
    } as never);
    vi.mocked(fetchArtemisAuditBundle).mockResolvedValue({ systemLogs: [], decisions: [], loadFailed: true });
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Recommendations' }));
    expect(await screen.findByText(/7 advisory records exist, but their details could not be loaded/i)).toBeInTheDocument();
    expect(primaryText()).not.toMatch(/No advisory records exist/i);
    expect(primaryText()).not.toMatch(/No recommendations have been generated yet/i);
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History & Audit' }));
    expect(await screen.findByText(/7 Artemis advisory records exist, but their details could not be loaded/i)).toBeInTheDocument();
    expect(primaryText()).not.toMatch(/Showing latest/i);
    expect(primaryText()).not.toMatch(/Showing latest 50/i);
  });

  it('B: agent run count > 0 with empty recent window stays truthful', async () => {
    vi.mocked(fetchArtemisReadiness).mockResolvedValue({
      ...readinessFixture,
      agentRuns: {
        truth: 'PERSISTED',
        count: 6051,
        latestAt: '2026-08-08T07:31:00.000Z',
        recent: [],
        limit: 50,
        loadedCount: 0,
        detailsAvailable: false,
      },
    } as never);
    vi.mocked(fetchArtemisAuditBundle).mockResolvedValue({ systemLogs: [], decisions: [], loadFailed: true });
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'History & Audit' }));
    expect(await screen.findByText(/6[,.]?051 Agent runs recorded, but recent details could not be loaded/i)).toBeInTheDocument();
    expect(primaryText()).not.toMatch(/No audit records/i);
    expect(primaryText()).not.toMatch(/Showing latest/i);
    expect(primaryText()).not.toMatch(/Showing latest 50/i);
  });

  it('History loaded window may say Showing latest 50', async () => {
    const recentRuns = Array.from({ length: 50 }, (_, index) => ({
      id: `run-${index}`,
      agentId: 'a1',
      agentKey: 'technical',
      agentName: 'Technical',
      successful: true,
      recordedScore: 0.5,
      createdAt: '2026-08-08T07:31:00.000Z',
      symbol: 'BTC/USDT',
      action: 'HOLD',
    }));
    vi.mocked(fetchArtemisReadiness).mockResolvedValue({
      ...readinessFixture,
      agentRuns: {
        truth: 'PERSISTED',
        count: 6051,
        latestAt: '2026-08-08T07:31:00.000Z',
        recent: recentRuns,
        limit: 50,
        loadedCount: 50,
        detailsAvailable: true,
      },
    } as never);
    vi.mocked(fetchArtemisAuditBundle).mockResolvedValue({
      systemLogs: [],
      decisions: recentRuns,
      loadFailed: false,
    } as never);
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'History & Audit' }));
    expect(await screen.findByText(/Showing latest 50/i)).toBeInTheDocument();
    expect(document.querySelector('[data-artemis-history-run-count="6051"]')).toBeTruthy();
  });

  it('C: Orchestration distinguishes Agent operational from Artemis connected', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Coordination' }));
    await waitFor(() => expect(document.querySelector('[data-artemis-coord-agent="trend"]')).toBeTruthy());
    const card = document.querySelector('[data-artemis-coord-agent="trend"]');
    expect(card?.textContent).toMatch(/Operational|Working/i);
    expect(card?.textContent).toMatch(/Not connected/i);
  });

  it('D: Liquidity never shows a misleading Available badge', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Coordination' }));
    await waitFor(() => expect(document.querySelector('[data-artemis-coord-agent="liquidity"]')).toBeTruthy());
    const card = document.querySelector('[data-artemis-coord-agent="liquidity"]');
    expect(card?.textContent).toMatch(/Blocked|Unavailable|Not connected/i);
    expect(card?.textContent).not.toMatch(/\bAvailable\b/);
  });

  it('E: Order operational is not execution eligible', async () => {
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Coordination' }));
    await waitFor(() => expect(document.querySelector('[data-artemis-coord-agent="order"]')).toBeTruthy());
    const card = document.querySelector('[data-artemis-coord-agent="order"]');
    expect(card?.textContent).toMatch(/Operational|Working/i);
    expect(card?.textContent).toMatch(/Unavailable|Not connected|Blocked/i);
    expect(card?.textContent).not.toMatch(/\bAvailable\b/);
  });

  it('record window helper never treats empty loaded rows as true empty when count > 0', () => {
    const unavailable = resolveRecordWindow({ persistedCount: 7, primaryRecords: [], fallbackRecords: [] });
    expect(unavailable.kind).toBe('details_unavailable');
    const trueEmpty = resolveRecordWindow({ persistedCount: 0, primaryRecords: [], fallbackRecords: [] });
    expect(trueEmpty.kind).toBe('true_empty');
    const windowed = resolveRecordWindow({
      persistedCount: 6051,
      primaryRecords: Array.from({ length: 50 }, (_, i) => ({ id: i })),
    });
    expect(windowed.showingPartialWindow).toBe(true);
    expect(windowed.kind).toBe('loaded');
  });

  it('responsive shell keeps section nav usable', async () => {
    const { container } = render(<AIManager />);
    await waitFor(() => expect(container.querySelector('[data-artemis-shell]')).toBeTruthy());
    expect(container.querySelector('nav')?.className).toMatch(/overflow-x-auto/);
    expect(container.querySelector('[data-artemis-page="overview"]')).toBeTruthy();
  });

  it('Artemis primitives follow DataHub design tokens', async () => {
    const { container } = render(<AIManager />);
    await waitForHome();
    const header = container.querySelector('[data-artemis-header]');
    expect(header?.className).toMatch(/bg-gradient-to-br/);
    expect(header?.className).toMatch(/from-slate-950/);
    expect(header?.className).toMatch(/border-white\/5/);
    expect(container.querySelector('[data-artemis-nav]')?.className).toMatch(/overflow-x-auto/);
    const selected = container.querySelector('[aria-current="page"]');
    expect(selected?.className).toMatch(/purple/);
    expect(selected?.className).not.toMatch(/bg-blue-600(?!\/)/);
    const pill = container.querySelector('[data-artemis-pill]');
    expect(pill?.className).toMatch(/rounded-full/);
    expect(pill?.className).toMatch(/text-\[10px\]/);
    const metric = container.querySelector('[data-artemis-metric]');
    expect(metric?.className).toMatch(/border-white\/5/);
    expect(metric?.className).toMatch(/bg-gradient-to-br/);
    const explainer = container.querySelector('[data-artemis-explainer]');
    expect(explainer?.className).toMatch(/from-purple-500\/10/);
    expect(explainer?.className).not.toMatch(/border-blue-500/);
    const primary = container.querySelector('[data-artemis-primary-action]');
    expect(primary?.className).toMatch(/rounded-full/);
    expect(primary?.className).toMatch(/bg-purple-600/);
    fireEvent.click(screen.getByRole('button', { name: 'History & Audit' }));
    const filter = container.querySelector('select');
    expect(filter?.className).toMatch(/bg-slate-900/);
    expect(filter?.className).toMatch(/border-slate-700/);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const tech = container.querySelector('[data-artemis-technical]');
    expect(tech).toBeTruthy();
    expect((tech as HTMLDetailsElement | null)?.open).toBe(false);
  });

  it('recommendation drawer uses canonical overlay and panel', async () => {
    vi.mocked(fetchArtemisReadiness).mockResolvedValue({
      ...readinessFixture,
      advisory: {
        truth: 'PERSISTED',
        count: 1,
        latestAt: '2026-08-08T07:31:00.000Z',
        recent: [{
          id: 9,
          created_at: '2026-08-08T07:31:00.000Z',
          timestamp: '2026-08-08T07:31:00.000Z',
          message: 'Hold BTCUSDT',
          action: 'HOLD',
          symbol: 'BTCUSDT',
          classification: 'LEGACY_ADVISORY_ONLY',
          executionEligible: false,
          advisoryOnly: true,
        }],
        limit: 50,
        loadedCount: 1,
        detailsAvailable: true,
      },
    } as never);
    vi.mocked(fetchArtemisAuditBundle).mockResolvedValue({
      systemLogs: [{
        id: 9,
        created_at: '2026-08-08T07:31:00.000Z',
        timestamp: '2026-08-08T07:31:00.000Z',
        message: 'Hold BTCUSDT',
        action: 'HOLD',
        symbol: 'BTCUSDT',
        classification: 'LEGACY_ADVISORY_ONLY',
        executionEligible: false,
        advisoryOnly: true,
      }],
      decisions: [],
      loadFailed: false,
    } as never);
    const { container } = render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'Recommendations' }));
    fireEvent.click(await screen.findByRole('button', { name: /BTCUSDT/i }));
    const drawer = container.querySelector('[data-artemis-drawer]');
    expect(drawer).toBeTruthy();
    expect(drawer?.innerHTML).toMatch(/bg-black\/60/);
    expect(drawer?.innerHTML).toMatch(/backdrop-blur-sm/);
    expect(drawer?.innerHTML).toMatch(/from-slate-950\/95/);
    expect(drawer?.innerHTML).toMatch(/border-white\/10/);
    expect(drawer?.innerHTML).toMatch(/rounded-xl/);
    expect(drawer?.innerHTML).toMatch(/shadow-2xl/);
    expect(drawer?.innerHTML).not.toMatch(/"metadata"/);
    expect(drawer?.innerHTML).not.toMatch(/portfolioValue/);
    expect(drawer?.innerHTML).not.toMatch(/dailyLoss/);
    expect(drawer?.innerHTML).not.toMatch(/opportunity/);
  });

  it('readiness failure on System Health deep link is unavailable, not fabricated setup', async () => {
    window.history.replaceState({}, '', '/?view=ai&artemisSection=system');
    vi.mocked(fetchArtemisReadiness).mockRejectedValue(new Error('Failed to build Artemis readiness'));
    render(<AIManager />);
    expect(await screen.findByText(/Readiness unavailable|Artemis status unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to build Artemis readiness/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(document.querySelector('[data-artemis-readiness-error="true"]')).toBeTruthy();
    expect(document.querySelector('[data-artemis-header]')).toBeTruthy();
    expect(document.querySelector('[data-artemis-nav]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Simple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
    expect(primaryText()).not.toMatch(/Needs setup/i);
    expect(primaryText()).not.toMatch(/Broker is not connected/i);
    expect(primaryText()).not.toMatch(/Partially ready/i);
    expect(document.querySelector('[data-artemis-page="system"]')).toBeNull();
  });

  it('readiness failure shell guard covers non-Home sections', async () => {
    window.history.replaceState({}, '', '/?view=ai&artemisSection=system');
    vi.mocked(fetchArtemisReadiness).mockRejectedValue(new Error('Failed to build Artemis readiness'));
    render(<AIManager />);
    await screen.findByText(/Failed to build Artemis readiness/i);
    fireEvent.click(screen.getByRole('button', { name: 'Recommendations' }));
    expect(screen.getByText(/Readiness unavailable|Artemis status unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(document.querySelector('[data-artemis-page="decisions"]')).toBeNull();
    expect(document.querySelector('[data-artemis-page="system"]')).toBeNull();
    expect(primaryText()).not.toMatch(/Needs setup/i);
    expect(primaryText()).not.toMatch(/Broker is not connected/i);
    expect(primaryText()).not.toMatch(/Partially ready/i);
    fireEvent.click(screen.getByRole('button', { name: 'Coordination' }));
    expect(document.querySelector('[data-artemis-readiness-error="true"]')).toBeTruthy();
    expect(document.querySelector('[data-artemis-page="orchestration"]')).toBeNull();
  });

  it('System Health shows Partially ready when usable providers are below quorum', async () => {
    vi.mocked(fetchArtemisReadiness).mockResolvedValue({
      ...readinessFixture,
      providers: {
        truth: 'MEASURED',
        ready: false,
        configured: 1,
        healthy: 1,
        activeHealthy: 1,
        activeUsableInstances: 1,
        quorum: 2,
        items: [{ id: 'openai', healthyKeys: 1, enabledKeys: 1, totalKeys: 1, ok: true }],
      },
    } as never);
    render(<AIManager />);
    await waitForHome();
    fireEvent.click(screen.getByRole('button', { name: 'System Health' }));
    const card = document.querySelector('[data-artemis-dependency="providers"]');
    expect(card?.textContent).toMatch(/Partially ready/i);
    expect(card?.textContent).not.toMatch(/\bReady\b/);
  });

  it('Artemis UI does not import Data Hub business components', () => {
    const root = path.resolve(__dirname, '../../../..');
    const ui = fs.readFileSync(path.join(root, 'components/ai/AIManager/components/ArtemisUi.tsx'), 'utf8');
    const tokens = fs.readFileSync(path.join(root, 'components/ai/AIManager/artemisDesignTokens.ts'), 'utf8');
    const manager = fs.readFileSync(path.join(root, 'components/ai/AIManager/index.tsx'), 'utf8');
    expect(ui).not.toMatch(/tabs\/DataHub/);
    expect(tokens).not.toMatch(/tabs\/DataHub/);
    expect(manager).not.toMatch(/tabs\/DataHub/);
    expect(tokens).toMatch(/from-slate-950\/90/);
    expect(tokens).toMatch(/border-white\/5/);
    expect(tokens).toMatch(/bg-purple-600/);
  });
});
