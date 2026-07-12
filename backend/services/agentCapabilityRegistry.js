/**
 * Canonical side-effect classification for registered AI agents.
 * Unknown agents default to safest policy (no live side effects).
 */

export const SIDE_EFFECT_CLASS = Object.freeze({
  READ_ONLY: 'read_only',
  ANALYSIS: 'analysis',
  DB_WRITE: 'db_write',
  WEBSOCKET: 'websocket',
  WEBHOOK: 'webhook',
  EXTERNAL_READ: 'external_read',
  EXTERNAL_DELIVERY: 'external_delivery',
  PORTFOLIO_MUTATION: 'portfolio_mutation',
  ORDER_LIVE: 'order_live',
  UNCLASSIFIED: 'unclassified',
});

/** @type {Record<string, { sideEffectClass: string, liveCapable: boolean, description: string }>} */
export const AGENT_CAPABILITIES = {
  technical: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Technical indicator analysis' },
  risk: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Risk assessment' },
  sentiment: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Sentiment analysis' },
  pattern: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Pattern recognition' },
  price_prediction: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Price prediction' },
  arbitrage: { sideEffectClass: SIDE_EFFECT_CLASS.EXTERNAL_READ, liveCapable: false, description: 'Arbitrage scan (market read)' },
  portfolio: { sideEffectClass: SIDE_EFFECT_CLASS.PORTFOLIO_MUTATION, liveCapable: true, description: 'Portfolio allocation recommendations' },
  liquidity: { sideEffectClass: SIDE_EFFECT_CLASS.EXTERNAL_READ, liveCapable: false, description: 'Liquidity analysis' },
  trend: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Trend analysis' },
  optimization: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Parameter optimization' },
  order: { sideEffectClass: SIDE_EFFECT_CLASS.ORDER_LIVE, liveCapable: true, description: 'Order placement/cancellation via exchange API' },
  fundamental: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Fundamental analysis' },
  market_intelligence: { sideEffectClass: SIDE_EFFECT_CLASS.EXTERNAL_READ, liveCapable: false, description: 'Market intelligence aggregation' },
  volume: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Volume analysis' },
  timing: { sideEffectClass: SIDE_EFFECT_CLASS.ANALYSIS, liveCapable: false, description: 'Entry/exit timing' },
  artemis_decision: { sideEffectClass: SIDE_EFFECT_CLASS.PORTFOLIO_MUTATION, liveCapable: true, description: 'Artemis trading decision execution' },
};

export function getAgentCapability(agentKey) {
  const key = String(agentKey || '').toLowerCase();
  return AGENT_CAPABILITIES[key] || {
    sideEffectClass: SIDE_EFFECT_CLASS.UNCLASSIFIED,
    liveCapable: false,
    description: 'Unclassified agent — safest policy applied',
  };
}

export function isLiveCapableAgent(agentKey) {
  return getAgentCapability(agentKey).liveCapable === true;
}

export function listRegisteredAgentKeys() {
  return Object.keys(AGENT_CAPABILITIES);
}
