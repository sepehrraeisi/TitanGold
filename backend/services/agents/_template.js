// Agent Template - Copy this for new agents
export async function run({ userId, symbol, timeframe, config }) {
  return {
    agent_key: 'AGENT_KEY',
    symbol,
    result: 'MVP stub',
    confidence: 0.5,
    timestamp: new Date().toISOString(),
    _meta: { source: 'mock', version: '1.0.0' }
  };
}

export async function getDetails({ userId }) {
  return {
    agent_key: 'AGENT_KEY',
    name: 'AGENT_NAME',
    status: 'active',
    lastRun: null
  };
}

export function defaultConfig() {
  return {};
}

export default { run, getDetails, defaultConfig };
