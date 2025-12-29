/**
 * Provider Defaults & Health for Artemis Mixture-of-Agents
 * 
 * Centralizes configuration for all AI providers:
 * - Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter
 * 
 * Provides:
 * - Default models
 * - API key validation
 * - Health checks
 * - Fallback strategies
 */

export const PROVIDER_DEFAULTS = {
  gemini: {
    name: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',
    availableModels: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.5-flash',
      'gemini-2.5-pro'
    ],
    timeout: 12000,
    weight: 1.2, // Higher weight for production stability
    baseURL: 'https://generativelanguage.googleapis.com'
  },
  
  openai: {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    availableModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ],
    timeout: 15000,
    weight: 1.5, // Highest weight
    baseURL: 'https://api.openai.com/v1'
  },
  
  anthropic: {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-3-5-sonnet-latest',
    availableModels: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest'
    ],
    timeout: 15000,
    weight: 1.5,
    baseURL: 'https://api.anthropic.com/v1'
  },
  
  deepseek: {
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    availableModels: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    timeout: 12000,
    weight: 1.0,
    baseURL: 'https://api.deepseek.com/v1'
  },
  
  openrouter: {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    availableModels: [
      'anthropic/claude-3.5-sonnet',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-70b-instruct'
    ],
    timeout: 15000,
    weight: 0.8, // Lower weight (aggregator)
    baseURL: 'https://openrouter.ai/api/v1'
  }
};

/**
 * Get provider configuration with runtime env
 */
export function getProviderConfig(providerKey) {
  const defaults = PROVIDER_DEFAULTS[providerKey];
  if (!defaults) {
    throw new Error(`Unknown provider: ${providerKey}`);
  }

  const apiKey = process.env[defaults.envKey];
  const model = process.env[defaults.modelEnv] || defaults.defaultModel;

  return {
    ...defaults,
    apiKey,
    model,
    enabled: Boolean(apiKey),
    reason: apiKey ? null : `${defaults.envKey} not set`
  };
}

/**
 * Get all providers health status
 */
export function getProvidersHealth() {
  const health = {};
  
  for (const [key, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    const config = getProviderConfig(key);
    health[key] = {
      name: defaults.name,
      enabled: config.enabled,
      model: config.model,
      ok: config.enabled,
      reason: config.reason,
      weight: defaults.weight
    };
  }
  
  return health;
}

/**
 * Get active providers for mixture
 */
export function getActiveProviders() {
  const active = [];
  
  for (const key of Object.keys(PROVIDER_DEFAULTS)) {
    const config = getProviderConfig(key);
    if (config.enabled) {
      active.push({
        key,
        ...config
      });
    }
  }
  
  return active;
}

/**
 * Calculate quorum (minimum responses needed)
 */
export function getQuorum(totalProviders) {
  // Quorum = at least 40% or minimum 2
  return Math.max(2, Math.ceil(totalProviders * 0.4));
}

/**
 * Normalize provider response for mixture
 */
export function normalizeProviderResponse(providerKey, rawResponse) {
  // Each provider returns different format
  // Normalize to: { signal, confidence, reasoning, raw }
  
  return {
    provider: providerKey,
    signal: rawResponse.signal || 'NEUTRAL',
    confidence: rawResponse.confidence || 50,
    reasoning: rawResponse.reasoning || rawResponse.analysis || '',
    raw: rawResponse,
    timestamp: new Date().toISOString()
  };
}

/**
 * Weighted vote across providers
 */
export function calculateWeightedVote(responses) {
  const votes = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  let totalWeight = 0;
  let totalConfidence = 0;
  
  for (const resp of responses) {
    const config = PROVIDER_DEFAULTS[resp.provider];
    const weight = config?.weight || 1.0;
    
    votes[resp.signal] += weight;
    totalWeight += weight;
    totalConfidence += resp.confidence * weight;
  }
  
  // Find winner
  let winner = 'NEUTRAL';
  let maxVotes = 0;
  
  for (const [signal, votes_] of Object.entries(votes)) {
    if (votes_ > maxVotes) {
      maxVotes = votes_;
      winner = signal;
    }
  }
  
  return {
    signal: winner,
    confidence: Math.round(totalConfidence / totalWeight),
    votes,
    totalWeight,
    consensus: Math.round((maxVotes / totalWeight) * 100)
  };
}
