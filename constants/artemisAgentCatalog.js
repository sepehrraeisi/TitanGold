/**
 * Canonical 15-Agent Artemis catalog.
 * Shared by backend readiness aggregation and Artemis product UI.
 * Does not replace the Agent registry or ai_agents table.
 */

export const ARTEMIS_ROLE_GROUPS = [
  { id: 'analytical', labelKey: 'artemis_group_analytical', authority: 'evidence' },
  { id: 'opportunity', labelKey: 'artemis_group_opportunity', authority: 'forecast' },
  { id: 'capital_risk', labelKey: 'artemis_group_capital_risk', authority: 'control' },
  { id: 'feasibility', labelKey: 'artemis_group_feasibility', authority: 'feasibility' },
  { id: 'execution', labelKey: 'artemis_group_execution', authority: 'execution' },
];

export const ARTEMIS_AGENT_CATALOG = [
  { key: 'technical', aliases: ['technical', 'technical_analysis'], registryKey: 'technical', nameKey: 'artemis_agent_technical', group: 'analytical', authority: 'evidence' },
  { key: 'trend', aliases: ['trend', 'trend_detection'], registryKey: 'trend', nameKey: 'artemis_agent_trend', group: 'analytical', authority: 'evidence' },
  { key: 'pattern', aliases: ['pattern', 'pattern_recognition'], registryKey: 'pattern', nameKey: 'artemis_agent_pattern', group: 'analytical', authority: 'evidence' },
  { key: 'volume', aliases: ['volume', 'volume_analysis'], registryKey: 'volume', nameKey: 'artemis_agent_volume', group: 'analytical', authority: 'evidence' },
  { key: 'sentiment', aliases: ['sentiment', 'sentiment_analysis'], registryKey: 'sentiment', nameKey: 'artemis_agent_sentiment', group: 'analytical', authority: 'evidence' },
  { key: 'fundamental', aliases: ['fundamental', 'fundamental_analysis'], registryKey: 'fundamental', nameKey: 'artemis_agent_fundamental', group: 'analytical', authority: 'evidence' },
  { key: 'market_intelligence', aliases: ['market_intelligence'], registryKey: 'market_intelligence', nameKey: 'artemis_agent_market_intelligence', group: 'analytical', authority: 'evidence' },
  { key: 'price_prediction', aliases: ['price_prediction'], registryKey: 'price_prediction', nameKey: 'artemis_agent_price_prediction', group: 'opportunity', authority: 'forecast' },
  { key: 'timing', aliases: ['timing', 'market_timing'], registryKey: 'timing', nameKey: 'artemis_agent_timing', group: 'opportunity', authority: 'forecast' },
  { key: 'arbitrage', aliases: ['arbitrage'], registryKey: 'arbitrage', nameKey: 'artemis_agent_arbitrage', group: 'opportunity', authority: 'forecast' },
  { key: 'risk', aliases: ['risk', 'risk_management'], registryKey: 'risk', nameKey: 'artemis_agent_risk', group: 'capital_risk', authority: 'veto' },
  { key: 'portfolio', aliases: ['portfolio', 'portfolio_allocation', 'portfolio_management'], registryKey: 'portfolio', nameKey: 'artemis_agent_portfolio', group: 'capital_risk', authority: 'sizing' },
  { key: 'optimization', aliases: ['optimization'], registryKey: 'optimization', nameKey: 'artemis_agent_optimization', group: 'capital_risk', authority: 'not_applicable' },
  { key: 'liquidity', aliases: ['liquidity', 'liquidity_analysis'], registryKey: 'liquidity', nameKey: 'artemis_agent_liquidity', group: 'feasibility', authority: 'feasibility' },
  { key: 'order', aliases: ['order', 'order_management'], registryKey: 'order', nameKey: 'artemis_agent_order', group: 'execution', authority: 'execution' },
];

export function normalizeAgentKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const hit = ARTEMIS_AGENT_CATALOG.find(
    (row) => row.key === raw || row.aliases.includes(raw) || row.registryKey === raw,
  );
  return hit ? hit.key : raw;
}

export function matchInventoryRow(catalogRow, inventory = []) {
  const aliases = new Set(catalogRow.aliases.map((a) => a.toLowerCase()));
  return inventory.find((row) => {
    const key = String(row.agentKey || row.agent_key || '').toLowerCase();
    const type = String(row.type || '').toLowerCase();
    const name = String(row.name || '').toLowerCase().replace(/\s+/g, '_');
    return aliases.has(key) || aliases.has(type) || aliases.has(name);
  }) || null;
}

export default { ARTEMIS_ROLE_GROUPS, ARTEMIS_AGENT_CATALOG, normalizeAgentKey, matchInventoryRow };
