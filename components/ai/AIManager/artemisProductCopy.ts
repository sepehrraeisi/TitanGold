/**
 * Artemis product presentation layer.
 * Internal enums / reason keys / WP names must never render as primary UX.
 */

type TFn = (key: string, options?: { [key: string]: string | number }) => string;

const STATUS_KEYS: Record<string, string> = {
  ROLE_MAPPED: 'artemis_status_role_mapped',
  NOT_EXECUTION_ELIGIBLE: 'artemis_status_execution_unavailable',
  BLOCKED: 'artemis_status_blocked',
  PARTIAL: 'artemis_status_partial',
  AVAILABLE: 'artemis_status_available',
  LEGACY: 'artemis_status_legacy',
  UNAVAILABLE: 'artemis_status_unavailable',
  CONTRACT_FOUNDATION_APPROVED: 'artemis_status_contract_approved',
  LEGACY_ADVISORY: 'artemis_maturity_legacy_advisory',
  LEGACY_ADVISORY_ONLY: 'artemis_class_legacy_advisory',
  configured: 'artemis_op_configured',
  operational: 'artemis_op_operational',
  unconfigured: 'artemis_op_unconfigured',
  disabled: 'artemis_op_disabled',
  contract_pending: 'artemis_op_contract_pending',
  not_consumable: 'artemis_op_not_consumable',
  not_execution_eligible: 'artemis_status_execution_unavailable',
  blocked: 'artemis_status_blocked',
  available: 'artemis_status_available',
  broker_unavailable: 'artemis_dep_broker_unavailable',
  unavailable: 'artemis_status_unavailable',
};

const AUTHORITY_KEYS: Record<string, string> = {
  veto: 'artemis_authority_veto',
  sizing: 'artemis_authority_sizing',
  feasibility: 'artemis_authority_feasibility',
  runtime_safety: 'artemis_authority_runtime_safety',
  execution_only: 'artemis_authority_execution',
  evidence: 'artemis_authority_evidence',
  forecast: 'artemis_authority_forecast',
  control: 'artemis_authority_control',
  execution: 'artemis_authority_execution',
};

const GROUP_KEYS: Record<string, string> = {
  analytical: 'artemis_group_analytical',
  analyticalEvidence: 'artemis_group_analytical',
  opportunity: 'artemis_group_opportunity',
  opportunityForecast: 'artemis_group_opportunity',
  capital_risk: 'artemis_group_capital_risk',
  control: 'artemis_group_capital_risk',
  feasibility: 'artemis_group_feasibility',
  execution: 'artemis_group_execution',
};

const LIMITATION_KEYS: Record<string, string> = {
  artemis_liquidity_stub: 'artemis_blocker_liquidity_unavailable',
  artemis_liquidity_not_control_eligible: 'artemis_blocker_liquidity_unavailable',
  artemis_risk_uuid_debt: 'artemis_blocker_risk_identity',
  artemis_evidence_contract_not_implemented: 'artemis_blocker_evidence_not_connected',
  artemis_contract_not_runtime_implemented: 'artemis_blocker_evidence_not_connected',
  artemis_orchestration_mock_legacy: 'artemis_blocker_orchestration_legacy',
  artemis_agent_coordination_not_real: 'artemis_blocker_orchestration_legacy',
  artemis_om_execution_only_future: 'artemis_blocker_order_execution_only',
  artemis_decision_legacy_advisory_only: 'artemis_blocker_advisory_only',
  artemis_no_live_automation: 'artemis_blocker_no_live',
  artemis_dual_decision_engine_config: 'artemis_blocker_dual_decision_config',
};

const CONTROL_LABEL_KEYS: Record<string, string> = {
  risk: 'artemis_agent_risk',
  portfolio: 'artemis_agent_portfolio',
  optimization: 'artemis_agent_optimization',
  liquidity: 'artemis_agent_liquidity',
  runtime: 'artemis_pipe_runtime',
  order: 'artemis_agent_order',
};

function translate(t: TFn, key: string, fallback: string): string {
  const value = t(key);
  if (!value || value === key) return fallback;
  return value;
}

export function productLabel(t: TFn, key: string, fallback: string): string {
  return translate(t, key, fallback);
}

export function productStatus(code: string | undefined | null, t: TFn): string {
  if (!code) return translate(t, 'artemis_status_unavailable', 'Unavailable');
  const mapped = STATUS_KEYS[code] || STATUS_KEYS[String(code).toLowerCase()];
  if (mapped) return translate(t, mapped, humanFallback(code));
  return translate(t, 'artemis_status_unavailable', 'Unavailable');
}

export function productAuthority(code: string | undefined | null, t: TFn): string {
  if (!code) return translate(t, 'artemis_status_unavailable', 'Unavailable');
  const mapped = AUTHORITY_KEYS[code];
  if (mapped) return translate(t, mapped, humanFallback(code));
  return translate(t, 'artemis_status_unavailable', 'Unavailable');
}

export function productGroup(code: string | undefined | null, t: TFn): string {
  if (!code) return translate(t, 'artemis_group_analytical', 'Analytical intelligence');
  const mapped = GROUP_KEYS[code];
  if (mapped) return translate(t, mapped, humanFallback(code));
  return translate(t, 'artemis_group_analytical', 'Analytical intelligence');
}

export function productLimitation(key: string | undefined | null, t: TFn): string {
  if (!key) return '';
  const mapped = LIMITATION_KEYS[key] || key;
  return translate(t, mapped, translate(t, 'artemis_status_unavailable', 'Unavailable'));
}

export function productControlName(id: string, t: TFn): string {
  const mapped = CONTROL_LABEL_KEYS[id];
  if (mapped) return translate(t, mapped, humanFallback(id));
  return humanFallback(id);
}

export function productMode(mode: string | undefined | null, t: TFn): string {
  const value = String(mode || '').toLowerCase();
  if (value === 'demo') return translate(t, 'mode_demo_short', 'Demo');
  if (value === 'live' || value === 'real') return translate(t, 'mode_live_short', 'Live');
  if (value === 'paper') return translate(t, 'mode_paper_short', 'Paper');
  return translate(t, 'artemis_status_unavailable', 'Unavailable');
}

export function statusTone(
  code: string | undefined | null,
): 'neutral' | 'warning' | 'danger' | 'info' | 'ok' {
  const value = String(code || '').toUpperCase();
  if (['AVAILABLE', 'OPERATIONAL', 'OK'].includes(value)) return 'ok';
  if (['PARTIAL', 'ROLE_MAPPED', 'LEGACY', 'CONTRACT_PENDING', 'CONFIGURED'].includes(value)) return 'warning';
  if (['BLOCKED', 'NOT_EXECUTION_ELIGIBLE', 'UNAVAILABLE', 'DISABLED'].includes(value)) return 'danger';
  if (['MEASURED', 'PERSISTED'].includes(value)) return 'info';
  return 'neutral';
}

/** Last-resort readable fallback — never underscore-split as product copy. */
function humanFallback(code: string): string {
  const known: Record<string, string> = {
    ROLE_MAPPED: 'Role mapped',
    NOT_EXECUTION_ELIGIBLE: 'Execution unavailable',
    BLOCKED: 'Blocked',
    PARTIAL: 'Partially ready',
    AVAILABLE: 'Available',
    LEGACY: 'Legacy',
    UNAVAILABLE: 'Unavailable',
    veto: 'Veto',
    sizing: 'Sizing',
    feasibility: 'Feasibility',
    runtime_safety: 'Runtime safety',
    execution_only: 'Execution authority',
  };
  return known[code] || known[code.toUpperCase()] || 'Unavailable';
}

export const RAW_ENUM_SCAN = [
  'analyticalEvidence',
  'opportunityForecast',
  'ROLE_MAPPED',
  'NOT_EXECUTION_ELIGIBLE',
  'runtime_safety',
  'execution_only',
  'artemis_decision',
  'ai_decisions',
  'system_logs',
  'WP-B',
  'WP-C',
  'WP-D',
  'stub',
  '/api/v1/artemis/health',
];
