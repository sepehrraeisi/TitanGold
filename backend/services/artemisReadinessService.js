/**
 * Artemis WP-A — read-only readiness aggregation.
 * Composes existing runtime SSOT + inventory + health + audit counts.
 * Does not create a second mode/capability/connections/Data Hub owner.
 * Never fabricates success zeros for missing data.
 */

import { getRuntimeExecutionState } from './runtimeExecutionStateService.js';
import { buildRuntimeView } from './runtimeExecutionStateService.js';
import { query } from '../database/db.js';
import { logger } from './logger.js';
import {
  LEGACY_ADVISORY_CLASSIFICATION,
  NOT_EXECUTION_ELIGIBLE,
  LEGACY_ADVISORY_STAGE,
} from './artemisDecisionContainment.js';
import { readAnalyticalSchedulerStatus } from './analyticalSchedulerStatus.js';
import { getProviderHealth, getQuorum } from './providerPool.js';
import {
  ARTEMIS_AGENT_CATALOG,
  ARTEMIS_ROLE_GROUPS,
  matchInventoryRow,
} from '../../constants/artemisAgentCatalog.js';

const CONTRACT_VERSION = 'artemis-evidence-1.0.0';
const SCHEMA_VERSION = '1.0.0';

function unavailable(extra = {}) {
  return { truth: 'UNAVAILABLE', ...extra };
}

function asInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function catalogReadiness(key) {
  if (key === 'liquidity') return 'BLOCKED';
  if (key === 'order') return 'NOT_EXECUTION_ELIGIBLE';
  return 'ROLE_MAPPED';
}

function operationalStatus(inventoryRow, catalogKey) {
  if (!inventoryRow) return 'unconfigured';
  const enabled = inventoryRow.enabled !== false && inventoryRow.is_enabled !== false;
  const status = String(inventoryRow.status || '').toLowerCase();
  if (!enabled) return 'disabled';
  if (status === 'active' || status === 'running' || status === 'ok') return 'operational';
  if (status) return 'configured';
  return 'configured';
}

function consumptionEligibility(catalogKey, operational) {
  if (catalogKey === 'liquidity') return 'blocked';
  if (catalogKey === 'order') return 'not_execution_eligible';
  if (operational === 'unconfigured') return 'not_consumable';
  return 'contract_pending';
}

async function safeQuery(sql, params = [], label) {
  try {
    return await query(sql, params);
  } catch (e) {
    logger.warn(`Artemis readiness: ${label} unavailable`, e.message);
    return null;
  }
}

/**
 * @param {{ userId?: string }} [opts]
 */
export async function buildArtemisReadiness(opts = {}) {
  const { userId } = opts;

  let runtimeView = null;
  let runtimeTruth = 'UNAVAILABLE';
  try {
    const state = await getRuntimeExecutionState({ preferCache: false });
    let requestedMode = 'demo';
    let providerConnected = false;
    let connectionCount = null;
    if (userId) {
      const pref = await safeQuery(
        `SELECT preferences->'trading'->>'mode' AS mode FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE LIMIT 1`,
        [userId],
        'requested mode',
      );
      requestedMode = pref?.rows?.[0]?.mode === 'live' ? 'live' : 'demo';
      const broker = await safeQuery(
        `SELECT COUNT(*)::int AS c FROM exchange_connections WHERE user_id = $1 AND is_active = TRUE AND api_key IS NOT NULL`,
        [userId],
        'provider connection',
      );
      if (broker) {
        connectionCount = asInt(broker.rows[0]?.c);
        providerConnected = (connectionCount || 0) > 0;
      }
    }
    runtimeView = buildRuntimeView(state, { requestedMode, providerConnected });
    runtimeTruth = 'MEASURED';
    if (runtimeView && connectionCount != null) {
      runtimeView = { ...runtimeView, connectionCount };
    }
  } catch (e) {
    logger.warn('Artemis readiness: runtime SSOT unavailable', e.message);
  }

  const agentsLegacy = {
    analyticalEvidence: {
      keys: ARTEMIS_AGENT_CATALOG.filter((a) => a.group === 'analytical').map((a) => a.key),
      readiness: 'ROLE_MAPPED',
    },
    opportunityForecast: {
      keys: ARTEMIS_AGENT_CATALOG.filter((a) => a.group === 'opportunity').map((a) => a.key),
      readiness: 'ROLE_MAPPED',
    },
    control: {
      keys: ARTEMIS_AGENT_CATALOG.filter((a) => a.group === 'capital_risk').map((a) => a.key),
      readiness: 'ROLE_MAPPED',
    },
    feasibility: {
      keys: ['liquidity'],
      readiness: 'BLOCKED',
      limitationKey: 'artemis_liquidity_stub',
    },
    execution: {
      keys: ['order'],
      readiness: 'NOT_EXECUTION_ELIGIBLE',
      limitationKey: 'artemis_om_execution_only_future',
    },
  };

  let inventoryTruth = 'UNAVAILABLE';
  let inventoryAgents = [];
  const inv = await safeQuery(
    `SELECT id, agent_key, name, type, status, is_enabled
       FROM ai_agents
      ORDER BY name`,
    [],
    'ai_agents inventory',
  );
  if (inv) {
    inventoryTruth = 'PERSISTED';
    inventoryAgents = inv.rows.map((row) => ({
      id: row.id,
      agentKey: row.agent_key || null,
      name: row.name || null,
      type: row.type || null,
      status: row.status || null,
      enabled: row.is_enabled !== false,
    }));
  }

  const catalogAgents = ARTEMIS_AGENT_CATALOG.map((entry) => {
    const invRow = matchInventoryRow(entry, inventoryAgents);
    const operational = operationalStatus(invRow, entry.key);
    const readiness = catalogReadiness(entry.key);
    return {
      key: entry.key,
      registryKey: entry.registryKey,
      nameKey: entry.nameKey,
      group: entry.group,
      authority: entry.authority,
      readiness,
      operational,
      exists: Boolean(invRow),
      operationalNow: operational === 'operational',
      evidenceCompatible: false,
      evidenceAvailable: false,
      consumption: consumptionEligibility(entry.key, operational),
      inventoryId: invRow?.id || null,
      inventoryName: invRow?.name || null,
      inventoryStatus: invRow?.status || null,
      limitationKey:
        entry.key === 'liquidity'
          ? 'artemis_liquidity_stub'
          : entry.key === 'order'
            ? 'artemis_om_execution_only_future'
            : entry.key === 'risk'
              ? 'artemis_risk_uuid_debt'
              : null,
      truth: invRow ? 'PERSISTED' : inventoryTruth === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONFIGURED',
    };
  });

  let advisory = unavailable({ count: null, latestAt: null });
  const adv = await safeQuery(
    `SELECT COUNT(*)::int AS c, MAX(created_at) AS latest
       FROM system_logs
      WHERE category = 'artemis_decision'`,
    [],
    'advisory logs',
  );
  if (adv) {
    advisory = {
      truth: 'PERSISTED',
      count: asInt(adv.rows[0]?.c) || 0,
      latestAt: adv.rows[0]?.latest ? new Date(adv.rows[0].latest).toISOString() : null,
    };
  }

  let agentRuns = unavailable({ count: null, latestAt: null, recent: [] });
  const runs = await safeQuery(
    `SELECT d.id, d.agent_id, d.was_successful, d.confidence, d.created_at, d.input, d.output,
            a.agent_key, a.name AS agent_name
       FROM ai_decisions d
  LEFT JOIN ai_agents a ON a.id = d.agent_id
      ORDER BY d.created_at DESC
      LIMIT 12`,
    [],
    'ai_decisions recent',
  );
  const runCount = await safeQuery(
    `SELECT COUNT(*)::int AS c, MAX(created_at) AS latest FROM ai_decisions`,
    [],
    'ai_decisions count',
  );
  if (runCount) {
    agentRuns = {
      truth: 'PERSISTED',
      count: asInt(runCount.rows[0]?.c) || 0,
      latestAt: runCount.rows[0]?.latest ? new Date(runCount.rows[0].latest).toISOString() : null,
      recent: (runs?.rows || []).map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        agentKey: row.agent_key || null,
        agentName: row.agent_name || null,
        successful: row.was_successful === true,
        recordedScore: typeof row.confidence === 'number' ? row.confidence : null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        symbol:
          row.input?.symbol ||
          row.input?.pair ||
          row.output?.symbol ||
          null,
        action: row.output?.action || row.output?.decision || null,
      })),
    };
  }

  let dataHub = unavailable({ totalSources: null, activeSources: null, status: 'unavailable' });
  const dh = await safeQuery(
    `SELECT
        (SELECT COUNT(*)::int FROM data_sources) AS total_sources,
        (SELECT COUNT(*)::int FROM data_sources WHERE is_active = true) AS active_sources`,
    [],
    'data hub summary',
  );
  if (dh) {
    dataHub = {
      truth: 'PERSISTED',
      totalSources: asInt(dh.rows[0]?.total_sources) || 0,
      activeSources: asInt(dh.rows[0]?.active_sources) || 0,
      status: 'available',
    };
  }

  let providers = unavailable({ ready: null, activeHealthy: null, quorum: null, items: [] });
  try {
    const healthSummary = await getProviderHealth();
    const items = (healthSummary || []).map((row) => ({
      id: row.provider,
      healthyKeys: asInt(row.healthy_keys) || 0,
      enabledKeys: asInt(row.enabled_keys) || 0,
      totalKeys: asInt(row.total_keys) || 0,
      ok: (asInt(row.healthy_keys) || 0) > 0,
    }));
    const activeHealthy = items.reduce((sum, item) => sum + (item.ok ? 1 : 0), 0);
    const totalHealthyKeys = items.reduce((sum, item) => sum + item.healthyKeys, 0);
    providers = {
      truth: 'MEASURED',
      ready: totalHealthyKeys > 0,
      activeHealthy,
      quorum: getQuorum(Math.max(totalHealthyKeys, items.length)),
      items,
    };
  } catch (e) {
    logger.warn('Artemis readiness: provider health unavailable', e.message);
  }

  let scheduler = unavailable({
    allowlist: [],
    agentsEnabled: null,
    isRunning: null,
    stale: true,
    owner: null,
  });
  try {
    const remote = await readAnalyticalSchedulerStatus();
    if (remote?.status) {
      scheduler = {
        truth: remote.stale ? 'LEGACY' : 'MEASURED',
        allowlist: Array.isArray(remote.status.allowlist) ? remote.status.allowlist : [],
        agentsEnabled: remote.status.agentsEnabled === true,
        isRunning: remote.status.isRunning === true,
        stale: remote.stale === true,
        owner: remote.status.owner || 'titan-engine-worker',
        lastTickAt: remote.status.lastTickAt || null,
      };
    } else {
      scheduler = {
        truth: 'UNAVAILABLE',
        allowlist: [],
        agentsEnabled: null,
        isRunning: null,
        stale: true,
        owner: 'titan-engine-worker',
        lastTickAt: null,
      };
    }
  } catch (e) {
    logger.warn('Artemis readiness: scheduler status unavailable', e.message);
  }

  let dualConfig = false;
  const artemisCfg = await safeQuery(
    `SELECT config FROM artemis_state ORDER BY created_at DESC LIMIT 1`,
    [],
    'artemis_state config',
  );
  const sysCfg = await safeQuery(
    `SELECT value FROM system_config WHERE key IN ('decision_engine', 'decisionEngine', 'artemis.decision_engine') LIMIT 1`,
    [],
    'system_config decision engine',
  );
  if (artemisCfg?.rows?.[0]?.config?.decisionEngine && sysCfg?.rows?.length) {
    dualConfig = true;
  } else if (artemisCfg?.rows?.[0]?.config?.decisionEngine) {
    dualConfig = false;
  }

  const runtimeCommit = process.env.TITAN_RUNTIME_COMMIT || process.env.TITAN_COMMIT || null;
  const provenance = runtimeCommit
    ? { truth: 'MEASURED', runtimeCommit: String(runtimeCommit).slice(0, 12) }
    : unavailable({ runtimeCommit: null });

  const connections = userId
    ? {
        truth: runtimeView && runtimeView.connectionCount != null ? 'MEASURED' : runtimeTruth,
        providerConnected: runtimeView?.providerConnected === true,
        count: runtimeView?.connectionCount ?? null,
        status: runtimeView?.providerConnected ? 'available' : 'broker_unavailable',
      }
    : unavailable({ providerConnected: null, count: null, status: 'unavailable' });

  const blockers = [
    { code: 'evidence_not_connected', severity: 'high', labelKey: 'artemis_blocker_evidence_not_connected' },
    { code: 'orchestration_not_active', severity: 'high', labelKey: 'artemis_blocker_orchestration_legacy' },
    { code: 'liquidity_unavailable', severity: 'high', labelKey: 'artemis_blocker_liquidity_unavailable' },
    { code: 'execution_unavailable', severity: 'high', labelKey: 'artemis_blocker_execution_unavailable' },
    { code: 'advisory_only', severity: 'medium', labelKey: 'artemis_blocker_advisory_only' },
  ];
  if (dualConfig) {
    blockers.push({
      code: 'dual_decision_config',
      severity: 'medium',
      labelKey: 'artemis_blocker_dual_decision_config',
    });
  }

  const pipeline = [
    { id: 'data_foundation', labelKey: 'artemis_pipe_data', ownerKey: 'artemis_owner_data_hub', status: dataHub.status === 'available' ? 'AVAILABLE' : 'UNAVAILABLE', truth: dataHub.truth, nav: { view: 'ai', aiTab: 'data_hub' }, blockerKey: dataHub.status === 'available' ? null : 'artemis_blocker_datahub_unread' },
    { id: 'analytical_agents', labelKey: 'artemis_pipe_analytical', ownerKey: 'artemis_owner_agents', status: 'ROLE_MAPPED', truth: inventoryTruth === 'UNAVAILABLE' ? 'CONFIGURED' : 'DERIVED', nav: { view: 'ai', aiTab: 'agents' }, blockerKey: null },
    { id: 'evidence_contract', labelKey: 'artemis_pipe_evidence', ownerKey: 'artemis_nav_evidence', status: 'UNAVAILABLE', truth: 'UNAVAILABLE', nav: { artemisSection: 'evidence' }, blockerKey: 'artemis_blocker_evidence_not_connected' },
    { id: 'orchestration', labelKey: 'artemis_pipe_orchestration', ownerKey: 'artemis_nav_orchestration', status: 'LEGACY', truth: 'LEGACY', nav: { artemisSection: 'orchestration' }, blockerKey: 'artemis_blocker_orchestration_legacy' },
    { id: 'risk', labelKey: 'artemis_pipe_risk', ownerKey: 'artemis_agent_risk', status: 'PARTIAL', truth: 'CONFIGURED', nav: { view: 'ai', aiTab: 'agents', agentId: 'risk' }, blockerKey: 'artemis_blocker_risk_identity' },
    { id: 'portfolio', labelKey: 'artemis_pipe_portfolio', ownerKey: 'artemis_agent_portfolio', status: 'PARTIAL', truth: 'CONFIGURED', nav: { view: 'ai', aiTab: 'agents', agentId: 'portfolio' }, blockerKey: null },
    { id: 'optimization', labelKey: 'artemis_pipe_optimization', ownerKey: 'artemis_agent_optimization', status: 'PARTIAL', truth: 'CONFIGURED', nav: { view: 'ai', aiTab: 'agents', agentId: 'optimization' }, blockerKey: null },
    { id: 'liquidity', labelKey: 'artemis_pipe_liquidity', ownerKey: 'artemis_agent_liquidity', status: 'BLOCKED', truth: 'CONFIGURED', nav: { view: 'ai', aiTab: 'agents', agentId: 'liquidity' }, blockerKey: 'artemis_blocker_liquidity_unavailable' },
    { id: 'runtime_safety', labelKey: 'artemis_pipe_runtime', ownerKey: 'artemis_owner_runtime', status: runtimeView ? 'AVAILABLE' : 'UNAVAILABLE', truth: runtimeTruth, nav: { view: 'settings', settingsTab: 'configuration' }, blockerKey: runtimeView ? null : 'artemis_blocker_runtime_unread' },
    { id: 'order_management', labelKey: 'artemis_pipe_order', ownerKey: 'artemis_agent_order', status: 'NOT_EXECUTION_ELIGIBLE', truth: 'CONFIGURED', nav: { view: 'ai', aiTab: 'agents', agentId: 'order' }, blockerKey: 'artemis_blocker_order_execution_only' },
  ];

  return {
    maturityStage: LEGACY_ADVISORY_STAGE,
    classification: LEGACY_ADVISORY_CLASSIFICATION,
    executionEligible: false,
    executionEligibility: NOT_EXECUTION_ELIGIBLE,
    contract: {
      schemaVersion: SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      readiness: 'CONTRACT_FOUNDATION_APPROVED',
      implemented: false,
      adaptersRequired: true,
      compatibleAgentCount: 0,
      catalogAgentCount: ARTEMIS_AGENT_CATALOG.length,
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
      risk: { authority: 'veto', readiness: 'PARTIAL', truth: 'CONFIGURED', limitationKey: 'artemis_risk_uuid_debt', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'risk' } },
      portfolio: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'portfolio' } },
      optimization: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'optimization' } },
      liquidity: { authority: 'feasibility', readiness: 'BLOCKED', truth: 'CONFIGURED', limitationKey: 'artemis_liquidity_stub', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'liquidity' } },
      runtime: { authority: 'runtime_safety', readiness: runtimeView ? 'AVAILABLE' : 'UNAVAILABLE', truth: runtimeTruth, ownerNav: { view: 'settings', settingsTab: 'configuration' } },
      order: { authority: 'execution_only', readiness: 'NOT_EXECUTION_ELIGIBLE', truth: 'CONFIGURED', ownerNav: { view: 'ai', aiTab: 'agents', agentId: 'order' } },
    },
    runtime: runtimeView,
    runtimeTruth,
    agents: agentsLegacy,
    catalog: {
      truth: 'CONFIGURED',
      groups: ARTEMIS_ROLE_GROUPS,
      agents: catalogAgents,
    },
    inventory: {
      truth: inventoryTruth,
      agents: inventoryAgents,
      configuredCount: inventoryTruth === 'UNAVAILABLE' ? null : inventoryAgents.length,
      operationalCount:
        inventoryTruth === 'UNAVAILABLE'
          ? null
          : inventoryAgents.filter((a) => a.enabled && String(a.status || '').toLowerCase() === 'active').length,
    },
    providers,
    connections,
    dataHub,
    scheduler,
    advisory,
    agentRuns,
    provenance,
    pipeline,
    blockers,
    owners: {
      dataHub: { view: 'ai', aiTab: 'data_hub' },
      agents: { view: 'ai', aiTab: 'agents' },
      decisionEngine: { view: 'settings', settingsTab: 'configuration', settingsSubtab: 'decision-engine' },
      connections: { view: 'settings', settingsTab: 'connections' },
      monitoring: { view: 'settings', settingsTab: 'configuration', settingsSubtab: 'monitoring' },
    },
    limitations: [
      'artemis_contract_not_runtime_implemented',
      'artemis_agent_coordination_not_real',
      'artemis_decision_legacy_advisory_only',
      'artemis_liquidity_not_control_eligible',
      'artemis_no_live_automation',
    ],
    dualConfigLimitationKey: dualConfig ? 'artemis_dual_decision_engine_config' : undefined,
    generatedAt: new Date().toISOString(),
  };
}

export default { buildArtemisReadiness };
