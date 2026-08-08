import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const readinessFixture = {
  maturityStage: 'LEGACY_ADVISORY',
  classification: 'LEGACY_ADVISORY_ONLY',
  executionEligible: false,
  executionEligibility: 'NOT_EXECUTION_ELIGIBLE',
  contract: {
    schemaVersion: '1.0.0',
    contractVersion: 'artemis-evidence-1.0.0',
    readiness: 'CONTRACT_FOUNDATION_APPROVED',
    implemented: false,
    truth: 'CONFIGURED',
  },
  evidence: {
    readiness: 'UNAVAILABLE',
    reasonKey: 'artemis_evidence_contract_not_implemented',
    truth: 'UNAVAILABLE',
  },
  orchestration: {
    readiness: 'LEGACY',
    realAgentCoordination: false,
    reasonKey: 'artemis_orchestration_mock_legacy',
    truth: 'LEGACY',
  },
  controlChain: {
    risk: { authority: 'veto', readiness: 'PARTIAL', truth: 'CONFIGURED' },
    portfolio: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED' },
    optimization: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED' },
    liquidity: { authority: 'feasibility', readiness: 'BLOCKED', truth: 'CONFIGURED' },
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
  limitations: ['artemis_decision_legacy_advisory_only', 'artemis_no_live_automation'],
  dualConfigLimitationKey: 'artemis_dual_decision_engine_config',
  generatedAt: '2026-08-07T00:00:00.000Z',
};

vi.mock('../../../../services/artemisReadinessApi.ts', () => ({
  fetchArtemisReadiness: vi.fn(async () => readinessFixture),
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
  artemis_open_data_hub: 'Open Data Hub',
  artemis_datahub_status: 'Status',
  artemis_datahub_status_available: 'Available as AI Center product',
  artemis_datahub_role: 'Role: Market / external-data foundation',
  artemis_current_capability: 'Current capability',
  artemis_nav_overview: 'Overview',
  artemis_nav_evidence: 'Evidence',
  artemis_nav_decisions: 'Decisions',
  artemis_nav_orchestration: 'Orchestration',
  artemis_nav_controls: 'Controls',
  artemis_nav_lineage: 'Lineage & Audit',
  artemis_nav_system: 'System & Integrations',
  artemis_central_intelligence: 'Central Intelligence — legacy advisory maturity',
  artemis_stage_legacy_advisory: 'LEGACY ADVISORY',
  artemis_not_execution_eligible: 'NOT EXECUTION ELIGIBLE',
  artemis_legacy_admin_nav: 'Legacy Admin',
  artemis_autopilot_hidden: 'Autopilot is hidden from normal Artemis navigation',
  artemis_readiness_title: 'Artemis Readiness',
  artemis_overview_purpose: 'What can Artemis truthfully do right now?',
  artemis_runtime_safety: 'Runtime Safety',
  artemis_control_chain: 'Control Chain',
  artemis_intelligence_inputs: 'Intelligence Inputs',
  artemis_limitations: 'Current Limitations',
  artemis_evidence_not_ready: 'Canonical evidence contract not implemented yet',
  artemis_legacy_advisory: 'Legacy Advisory',
  artemis_not_execution_approval: 'NOT EXECUTION APPROVAL',
  artemis_legacy_orchestration: 'Legacy Orchestration',
  artemis_canonical_orchestration_unavailable: 'Canonical orchestration unavailable',
  artemis_controls_title: 'Controls',
  artemis_lineage_title: 'Lineage & Audit',
  artemis_system_title: 'System & Integrations',
  requested_mode: 'Requested Mode',
  effective_mode: 'Effective Mode',
  emergency_stop: 'Emergency Stop',
  execution_eligibility: 'Execution Eligibility',
  inactive: 'Inactive',
  no: 'No',
  unavailable: 'Unavailable',
  artemis_no_one_click_live: 'Artemis does not provide one-click Live automation.',
  artemis_sections: 'Artemis sections',
  artemis_insights: 'Artemis Insights',
  artemis_insights_no_fake_confidence: 'No hardcoded confidence. Legacy advisory only.',
  artemis_decision_legacy_advisory_only: 'legacy decision advisory only',
  artemis_no_live_automation: 'no live automation',
};

vi.mock('../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({
    t: (key: string) => tMap[key] || key,
    language: currentLanguage,
    dir: currentLanguage === 'fa' ? 'rtl' : 'ltr',
  }),
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
import fs from 'node:fs';
import path from 'node:path';

describe('Artemis WP-A UI', () => {
  beforeEach(() => {
    currentLanguage = 'en';
    window.history.replaceState({}, '', '/?view=ai');
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
    expect(screen.getByTestId('datahub-workspace').getAttribute('data-datahub-owner')).toBe(
      'canonical',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }));
    expect(await screen.findByText('Agents Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Training' }));
    expect(await screen.findByText('Training Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
    expect(await screen.findByText('Analytics Tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Artemis' }));
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
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
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'System & Integrations' }));
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
    expect(aiCenter.match(/DataHubWorkspace/g)?.length).toBeGreaterThan(0);
  });

  it('renders canonical Artemis sections without Autopilot in product nav', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));

    for (const section of CANONICAL_SECTIONS) {
      expect(screen.getByRole('button', { name: tMap[section.labelKey] })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^Autopilot$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/one-click Live/i)).toBeInTheDocument();
    expect(screen.getAllByText('Requested Mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Effective Mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NOT EXECUTION ELIGIBLE').length).toBeGreaterThan(0);
  });

  it('does not show synthetic overview percentages', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/87%/)).not.toBeInTheDocument();
  });

  it('Evidence and Orchestration show truthful unavailable states', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }));
    expect(
      await screen.findByText(/Canonical evidence contract not implemented yet/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Orchestration' }));
    expect(await screen.findByText(/Canonical orchestration unavailable/i)).toBeInTheDocument();
  });

  it('Controls section shows Risk veto authority', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Controls' }));
    expect(await screen.findByText('veto')).toBeInTheDocument();
    expect(screen.getByText('feasibility')).toBeInTheDocument();
    expect(screen.getByText('execution_only')).toBeInTheDocument();
  });

  it('writes artemisSection deep link', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Decisions' }));
    await waitFor(() => {
      expect(window.location.search).toContain('artemisSection=decisions');
    });
  });

  it('Insights widget has no hardcoded confidence 87', async () => {
    render(<ArtemisInsightsWidget />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
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

  it('legacy admin gate does not auto-open Autopilot', async () => {
    render(<AIManager />);
    await waitFor(() => expect(screen.getAllByText(/LEGACY ADVISORY/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Legacy Admin' }));
    expect(
      await screen.findByText(/Autopilot is hidden from normal Artemis navigation/i),
    ).toBeInTheDocument();
  });
});
