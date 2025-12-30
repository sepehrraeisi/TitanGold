import dotenv from 'dotenv';
import { aiService } from './ai.js';
import { messageQueue } from './messageQueue.js';
import { query } from '../database/db.js';
import { 
  pickProviderInstance, 
  recordProviderSuccess, 
  recordProviderFailure,
  getProviderInstances,
  getQuorum 
} from './providerPool.js';

dotenv.config();

// ============================================================================
// Production++ Utilities (Timeout / Retry / Concurrency)
// ============================================================================

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('unavailable')
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function retry(fn, {
  attempts = 3,
  baseDelayMs = 1000,
  maxDelayMs = 7000,
  label = 'provider'
} = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      const retryable = isRetryableError(e) || (e.message && e.message.includes('retryable'));
      if (!retryable || i === attempts) throw e;

      const delay = Math.min(maxDelayMs, baseDelayMs * (i === 1 ? 1 : i === 2 ? 3 : 7));
      console.warn(`⚠️ ${label}: attempt ${i} failed; retrying in ${delay}ms. reason="${e.message}"`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.current < this.max) { this.current++; return; }
    await new Promise((resolve) => this.queue.push(resolve));
    this.current++;
  }
  release() {
    this.current = Math.max(0, this.current - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

const ORCH_TIMEOUT_MS = Number(process.env.ORCH_TIMEOUT_MS || 25000);
const ORCH_MAX_CONCURRENCY = Number(process.env.ORCH_MAX_CONCURRENCY || 2);
const orchSem = new Semaphore(Number.isFinite(ORCH_MAX_CONCURRENCY) && ORCH_MAX_CONCURRENCY > 0 ? ORCH_MAX_CONCURRENCY : 2);

/**
 * Artemis Orchestrator
 * --------------------
 * این سرویس تصمیم نهایی را با استفاده از چند LLM (Gemini, Claude, OpenAI, DeepSeek, OpenRouter)
 * و استراتژی تعریف شده در ArtemisConfig می‌گیرد.
 *
 * توجه: فعلاً فقط Gemini (internal) به صورت کامل پیاده شده؛
 * بقیه LLMها در صورت تنظیم کلید محیطی استفاده می‌شوند، در غیر این صورت نادیده گرفته می‌شوند.
 */


// ============================================================================
// Provider Pool Integration - DB-driven with Failover
// ============================================================================

/**
 * Call provider with automatic failover to next available key
 * @param {string} provider - Provider name (gemini, openai, etc.)
 * @param {Function} callFn - Async function (instance) => result
 * @param {Object} options - { maxRetries: 2 }
 * @returns {Promise<{ok, provider, instanceId?, result?, error?}>}
 */
async function callProviderWithFailover(provider, callFn, { maxRetries = 2 } = {}) {
  let lastErr = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const inst = await pickProviderInstance(provider);
    if (!inst) {
      const err = new Error(`No healthy instance available for provider=${provider}`);
      err.status = 503;
      lastErr = err;
      break; // No point retrying if no instances
    }

    try {
      const result = await callFn(inst);
      await recordProviderSuccess(inst.id);
      return { ok: true, provider, instanceId: inst.id, result };
    } catch (err) {
      console.log(`⚠️ Provider ${provider} attempt ${attempt + 1} failed:`, err.message);
      lastErr = err;
      await recordProviderFailure(inst.id, err);
      // Circuit breaker applied, continue to next key
    }
  }

  return { ok: false, provider, error: lastErr?.message || 'unknown error' };
}

// ============================================================================
// DEPRECATED: Old env-based KeyPool (removed in favor of DB-driven Provider Pool)
// All provider keys now come from api_integrations table via providerPool.js
// ============================================================================

// ============================================================================
// Provider Call Helpers - DB-driven with Instance
// ============================================================================

/**
 * Call OpenAI-compatible provider (OpenAI, DeepSeek, OpenRouter)
 * @param {Object} inst - Provider instance from DB { api_key_encrypted, base_url, model, provider }
 */
async function callOpenAICompatible(inst, prompt, systemInstruction) {
  if (!inst?.api_key_encrypted) return null;
  
  // Default base_url per provider
  let defaultBaseUrl = 'https://api.openai.com/v1';
  if (inst.provider === 'deepseek') {
    defaultBaseUrl = 'https://api.deepseek.com/v1';
  } else if (inst.provider === 'openrouter') {
    defaultBaseUrl = 'https://openrouter.ai/api/v1';
  }
  
  const baseUrl = inst.base_url || defaultBaseUrl;
  const model = inst.model || 'gpt-4o-mini';
  
  await orchSem.acquire();
  try {
    const result = await retry(async () => {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inst.api_key_encrypted}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      }, ORCH_TIMEOUT_MS);

      if (isRetryableStatus(res.status)) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} retryable: ${txt.slice(0, 200)}`);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`Provider ${inst.provider} API error:`, res.status, text);
        return null;
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }, { attempts: 3, baseDelayMs: 1000, maxDelayMs: 7000, label: inst.provider });

    return result;
  } catch (e) {
    console.error(`${inst.provider} call failed:`, e.message);
    return null;
  } finally {
    orchSem.release();
  }
}

/**
 * Call Gemini provider with DB instance
 */
async function callGeminiWithInstance(inst, prompt, systemInstruction) {
  if (!inst?.api_key_encrypted) return null;
  
  const model = inst.model || 'gemini-2.0-flash';
  
  await orchSem.acquire();
  try {
    const result = await retry(async () => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${inst.api_key_encrypted}`;
      
      const parts = [];
      if (systemInstruction) {
        parts.push({ text: systemInstruction });
      }
      parts.push({ text: prompt });

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }, ORCH_TIMEOUT_MS);

      if (isRetryableStatus(res.status)) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} retryable: ${txt.slice(0, 200)}`);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Gemini API error:', res.status, text);
        return null;
      }

      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }, { attempts: 3, baseDelayMs: 1000, maxDelayMs: 7000, label: 'Gemini' });

    return result;
  } catch (e) {
    console.error('Gemini call failed:', e.message);
    return null;
  } finally {
    orchSem.release();
  }
}

/**
 * Call Anthropic Claude with DB instance
 */
async function callClaudeWithInstance(inst, prompt, systemInstruction) {
  if (!inst?.api_key_encrypted) return null;
  
  const model = inst.model || 'claude-3-5-sonnet-latest';
  
  await orchSem.acquire();
  try {
    const result = await retry(async () => {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': inst.api_key_encrypted,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          system: systemInstruction || '',
          messages: [{ role: 'user', content: prompt }],
        }),
      }, ORCH_TIMEOUT_MS);

      if (isRetryableStatus(res.status)) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} retryable: ${txt.slice(0, 200)}`);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Claude API error:', res.status, text);
        return null;
      }

      const data = await res.json();
      return data?.content?.[0]?.text || null;
    }, { attempts: 3, baseDelayMs: 1000, maxDelayMs: 7000, label: 'Claude' });

    return result;
  } catch (e) {
    console.error('Claude call failed:', e.message);
    return null;
  } finally {
    orchSem.release();
  }
}

const PROVIDERS = {
  gemini: 'gemini',
  claude: 'claude',
  openai: 'openai',
  deepseek: 'deepseek',
  openrouter: 'openrouter',
};


function parseDecisionJson(raw) {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return JSON.parse(trimmed);
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
  } catch (e) {
    console.error('Artemis orchestrator JSON parse error:', e, 'raw:', raw);
  }
  return null;
}

function aggregateDecisions(decisions, strategy = 'mixture_of_experts') {
  if (!decisions.length) return null;

  // نرمال‌سازی: فقط تصمیم‌های معتبر
  const valid = decisions.filter(d => d && d.action);
  if (!valid.length) return null;

  // رأی‌گیری روی action
  const counts = valid.reduce(
    (acc, d) => {
      acc[d.action] = (acc[d.action] || 0) + 1;
      return acc;
    },
    {}
  );

  let bestAction = 'HOLD';
  let bestCount = 0;
  Object.entries(counts).forEach(([action, count]) => {
    if (count > bestCount) {
      bestCount = count;
      bestAction = action;
    }
  });

  // میانگین confidence
  const avgConfidence =
    valid.reduce((sum, d) => sum + (d.confidence || 0), 0) / valid.length;

  // بهترین reason از بالاترین confidence
  const sortedByConf = [...valid].sort(
    (a, b) => (b.confidence || 0) - (a.confidence || 0)
  );
  const top = sortedByConf[0];

  return {
    action: bestAction,
    confidence: avgConfidence,
    reason: top?.reason || 'Aggregated mixture-of-experts decision',
    providers: valid.map(v => v.provider),
    rawDecisions: valid,
  };
}

/**
 * ورودی:
 *   - opportunity, signals, context  (همان چیزی که /api/artemis/decision دریافت می‌کند)
 *   - decisionConfig از ArtemisConfig.decisionEngine
 */

/**
 * getMixtureDecision - DB-driven MoA with Quorum + Degraded Mode
 * Coordinates multiple providers with failover and circuit breaker
 */
export async function getMixtureDecision(input, decisionConfig = {}) {
  const {
    opportunity,
    signals,
    context,
  } = input;
  const {
    strategy = 'mixture_of_experts',
    activeModel = 'hybrid',
  } = decisionConfig;

  const systemInstruction =
    'You are Artemis, the master AI orchestrator of the TitanGold trading system. ' +
    'You receive candidate trade opportunities plus signals from 15 specialized agents. ' +
    'You must decide whether to EXECUTE (BUY/SELL) or HOLD, considering risk, context and agent signals. ' +
    'Respond in strict JSON only.';

  const basePrompt = `Trade Opportunity:
symbol: ${opportunity.symbol}
type: ${opportunity.type}
side: ${opportunity.side}
price: ${opportunity.price}
confidence: ${opportunity.confidence}

Context:
activeTrades: ${context?.activeTrades}
maxTrades: ${context?.maxTrades}
portfolioValue: ${context?.portfolioValue}
dailyProfit: ${context?.dailyProfit}
dailyLoss: ${context?.dailyLoss}

Agent Signals:
${JSON.stringify(signals || [], null, 2)}

You MUST return ONLY JSON with this schema:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number,
  "reason": string
}`;

  // انتخاب Providerها بر اساس activeModel
  const providersToUse = [];
  if (activeModel === 'internal' || activeModel === 'gemini' || activeModel === 'hybrid') {
    providersToUse.push('gemini');
  }
  if (activeModel === 'claude' || activeModel === 'hybrid') {
    providersToUse.push('anthropic');
  }
  if (activeModel === 'openai' || activeModel === 'hybrid') {
    providersToUse.push('openai');
  }
  if (activeModel === 'deepseek' || activeModel === 'hybrid') {
    providersToUse.push('deepseek');
  }
  if (activeModel === 'openrouter' || activeModel === 'hybrid') {
    providersToUse.push('openrouter');
  }
  if (!providersToUse.length) {
    providersToUse.push('gemini'); // Default
  }

  // Fetch DB instances
  const allInstances = await getProviderInstances();
  const quorum = getQuorum(allInstances.length);

  // Filter: فقط providerهایی که حداقل یک instance سالم دارند
  // Note: getProviderInstances() already filters WHERE enabled=true
  const availableProviders = providersToUse.filter(p =>
    allInstances.some(inst => inst.provider === p)
  );

  if (availableProviders.length === 0) {
    console.error('[getMixtureDecision] No healthy providers available');
    return null;
  }

  console.log(`[getMixtureDecision] Calling ${availableProviders.length} providers with quorum=${quorum}`);

  // Parallel calls با callProviderWithFailover
  const calls = availableProviders.map(async provider => {
    return callProviderWithFailover(provider, async (inst) => {
      let raw = null;
      
      if (provider === 'gemini') {
        raw = await callGeminiWithInstance(inst, basePrompt, systemInstruction);
      } else if (provider === 'anthropic') {
        raw = await callClaudeWithInstance(inst, basePrompt, systemInstruction);
      } else if (provider === 'openai') {
        raw = await callOpenAICompatible(inst, basePrompt, systemInstruction);
      } else if (provider === 'deepseek') {
        raw = await callOpenAICompatible(inst, basePrompt, systemInstruction);
      } else if (provider === 'openrouter') {
        raw = await callOpenAICompatible(inst, basePrompt, systemInstruction);
      }

      const parsed = parseDecisionJson(raw);
      if (!parsed) throw new Error('Parse failed');

      return {
        provider,
        action: parsed.action || 'HOLD',
        confidence: parsed.confidence ?? opportunity.confidence ?? 0,
        reason: parsed.reason || '',
      };
    }, { maxRetries: 2 });
  });

  const results = (await Promise.all(calls)).filter(r => r.ok).map(r => r.result);

  // Quorum check
  const ready = results.length >= quorum;
  const degraded = !ready && results.length > 0;

  if (results.length === 0) {
    console.error('[getMixtureDecision] All providers failed');
    return null;
  }

  if (degraded) {
    console.warn(`[getMixtureDecision] DEGRADED MODE: ${results.length}/${quorum} providers responded (need ${quorum})`);
  }

  // Aggregate decisions
  const aggregated = aggregateDecisions(results, strategy);
  
  return {
    ...aggregated,
    quorum: {
      required: quorum,
      received: results.length,
      total: availableProviders.length,
      ready,
      degraded,
    },
    providers: results.map(r => ({
      provider: r.provider,
      action: r.action,
      confidence: r.confidence,
    })),
  };
}

/**
 * Agent Coordination Logic
 * ------------------------
 * هماهنگی بین 15 AI Agent مختلف برای اجرای Sequential و Parallel
 * با استفاده از Message Queue برای ارتباط بین Agent ها
 */

// Agent Dependency Graph - مشخص می‌کند که هر Agent به کدام Agent های دیگر وابسته است
const AGENT_DEPENDENCIES = {
  'agent-1': [], // Technical Analysis - No dependencies
  'agent-2': ['agent-1'], // Risk Management - depends on Technical Analysis
  'agent-3': ['agent-1'], // Pattern Recognition - depends on Technical Analysis
  'agent-4': [], // Sentiment Analysis - No dependencies (can run in parallel)
  'agent-5': ['agent-4'], // Market Intelligence - depends on Sentiment
  'agent-6': ['agent-1', 'agent-4'], // Price Prediction - depends on Technical & Sentiment
  'agent-7': ['agent-1', 'agent-2'], // Trend Analysis - depends on Technical & Risk
  'agent-8': ['agent-1', 'agent-6'], // Timing - depends on Technical & Price Prediction
  'agent-9': ['agent-2'], // Risk Management (advanced) - depends on Risk
  'agent-10': ['agent-1', 'agent-7'], // Volume Analysis - depends on Technical & Trend
  'agent-11': ['agent-1', 'agent-6', 'agent-7'], // Portfolio Allocation - depends on multiple
  'agent-12': ['agent-1', 'agent-6'], // Liquidity - depends on Technical & Price
  'agent-13': ['agent-1', 'agent-3'], // Arbitrage - depends on Technical & Pattern
  'agent-14': ['agent-1', 'agent-2', 'agent-6'], // Optimization - depends on multiple
  'agent-15': ['agent-1', 'agent-6', 'agent-8'], // Timing (advanced) - depends on multiple
};

/**
 * Coordinate multiple AI agents to analyze a trading opportunity
 * @param {string} userId - User ID
 * @param {Object} context - Trading context (symbol, timeframe, etc.)
 * @returns {Promise<Object>} Aggregated agent results
 */
export async function coordinateAgents(userId, context = {}) {
  const { symbol = 'BTC/USDT', timeframe = '1h', useMessageQueue = true } = context;
  
  // Get active agents from database
  let activeAgents = [];
  try {
    const result = await query(
      `SELECT id, name, type, status, config FROM ai_agents 
       WHERE is_enabled = true AND status IN ('active', 'idle')
       ORDER BY name`
    );
    activeAgents = result.rows || [];
  } catch (error) {
    console.warn('⚠️ Could not fetch agents from database, using default list:', error.message);
    // Fallback: use default agent IDs
    activeAgents = Array.from({ length: 15 }, (_, i) => ({
      id: `agent-${i + 1}`,
      name: `Agent ${i + 1}`,
      type: 'analysis',
      status: 'active',
    }));
  }

  // Build execution plan based on dependencies
  const executionPlan = buildExecutionPlan(activeAgents);
  
  const agentResults = {};
  const executionMetrics = {
    startTime: Date.now(),
    agentsExecuted: 0,
    agentsFailed: 0,
    totalExecutionTime: 0,
  };

  // Execute sequential agents first (those with dependencies)
  // Each layer waits for previous layer to complete
  for (let layerIndex = 0; layerIndex < executionPlan.sequential.length; layerIndex++) {
    const agentGroup = executionPlan.sequential[layerIndex];
    const layerStartTime = Date.now();
    
    console.log(`📊 Executing agent layer ${layerIndex + 1}/${executionPlan.sequential.length} with ${agentGroup.length} agents`);
    
    // Execute all agents in this layer in parallel
    const groupResults = await Promise.allSettled(
      agentGroup.map(agent => executeAgent(agent, symbol, timeframe, useMessageQueue))
    );
    
    // Process results
    groupResults.forEach((result, index) => {
      const agent = agentGroup[index];
      if (result.status === 'fulfilled') {
        agentResults[agent.id] = result.value;
        executionMetrics.agentsExecuted++;
      } else {
        console.error(`❌ Agent ${agent.id} failed:`, result.reason);
        agentResults[agent.id] = {
          agentId: agent.id,
          error: result.reason?.message || 'Unknown error',
          status: 'error',
        };
        executionMetrics.agentsFailed++;
      }
    });
    
    const layerExecutionTime = Date.now() - layerStartTime;
    executionMetrics.totalExecutionTime += layerExecutionTime;
    console.log(`✅ Layer ${layerIndex + 1} completed in ${layerExecutionTime}ms`);
  }

  // Execute parallel agents (independent agents) - all at once
  if (executionPlan.parallel.length > 0) {
    const parallelStartTime = Date.now();
    const parallelAgents = executionPlan.parallel.flat();
    console.log(`📊 Executing ${parallelAgents.length} independent agents in parallel`);
    
    const parallelResults = await Promise.allSettled(
      parallelAgents.map(agent => 
        executeAgent(agent, symbol, timeframe, useMessageQueue)
      )
    );

    parallelResults.forEach((result, index) => {
      const agent = parallelAgents[index];
      if (result.status === 'fulfilled') {
        agentResults[agent.id] = result.value;
        executionMetrics.agentsExecuted++;
      } else {
        console.error(`❌ Agent ${agent.id} failed:`, result.reason);
        agentResults[agent.id] = {
          agentId: agent.id,
          error: result.reason?.message || 'Unknown error',
          status: 'error',
        };
        executionMetrics.agentsFailed++;
      }
    });
    
    const parallelExecutionTime = Date.now() - parallelStartTime;
    executionMetrics.totalExecutionTime += parallelExecutionTime;
    console.log(`✅ Parallel agents completed in ${parallelExecutionTime}ms`);
  }

  // Aggregate all results
  executionMetrics.totalExecutionTime = Date.now() - executionMetrics.startTime;
  
  return {
    agents: agentResults,
    summary: aggregateAgentResults(agentResults),
    executionTime: executionMetrics.totalExecutionTime,
    executionMetrics: {
      ...executionMetrics,
      agentsTotal: activeAgents.length,
      successRate: executionMetrics.agentsExecuted / activeAgents.length * 100,
      averageTimePerAgent: executionMetrics.agentsExecuted > 0 
        ? executionMetrics.totalExecutionTime / executionMetrics.agentsExecuted 
        : 0,
    },
  };
}

/**
 * Build execution plan based on agent dependencies
 */
function buildExecutionPlan(agents) {
  const executed = new Set();
  const sequential = [];
  const parallel = [];
  const remaining = [...agents];

  // First, identify agents with no dependencies (can run in parallel)
  const independent = remaining.filter(agent => {
    const deps = AGENT_DEPENDENCIES[agent.id] || [];
    return deps.length === 0;
  });

  if (independent.length > 0) {
    parallel.push(independent);
    independent.forEach(a => executed.add(a.id));
    remaining.splice(0, remaining.length, ...remaining.filter(a => !executed.has(a.id)));
  }

  // Then execute agents in layers based on dependencies
  while (remaining.length > 0) {
    const currentLayer = remaining.filter(agent => {
      const deps = AGENT_DEPENDENCIES[agent.id] || [];
      return deps.every(depId => executed.has(depId));
    });

    if (currentLayer.length === 0) {
      // Circular dependency or missing dependency - add remaining as parallel
      parallel.push([...remaining]);
      break;
    }

    sequential.push(currentLayer);
    currentLayer.forEach(a => executed.add(a.id));
    remaining.splice(0, remaining.length, ...remaining.filter(a => !executed.has(a.id)));
  }

  return { sequential, parallel };
}

/**
 * Execute a single agent
 */
async function executeAgent(agent, symbol, timeframe, useMessageQueue) {
  try {
    const task = {
      agentId: agent.id,
      symbol,
      timeframe,
      timestamp: Date.now(),
    };

    if (useMessageQueue && messageQueue.isConnected) {
      // Use message queue if available
      await messageQueue.publishAgentTask(task);
      
      // For now, still call agent directly (in future, consumer will handle it)
      return await callAgentAPI(agent.id, symbol, timeframe);
    } else {
      // Direct API call
      return await callAgentAPI(agent.id, symbol, timeframe);
    }
  } catch (error) {
    console.error(`Error executing agent ${agent.id}:`, error);
    return {
      agentId: agent.id,
      error: error.message,
      status: 'error',
    };
  }
}

/**
 * Call agent API endpoint
 */
async function callAgentAPI(agentId, symbol, timeframe) {
  try {
    // For now, return a mock result structure
    // In production, this would call the actual agent API endpoint
    return {
      agentId,
      symbol,
      timeframe,
      signal: 'NEUTRAL',
      confidence: 50 + Math.random() * 30, // 50-80
      status: 'success',
      timestamp: Date.now(),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Aggregate results from all agents
 */
function aggregateAgentResults(results) {
  const signals = Object.values(results)
    .filter(r => r && !r.error && r.signal)
    .map(r => r.signal);

  const confidences = Object.values(results)
    .filter(r => r && !r.error && r.confidence !== undefined)
    .map(r => r.confidence);

  const buySignals = signals.filter(s => s === 'BUY').length;
  const sellSignals = signals.filter(s => s === 'SELL').length;
  const neutralSignals = signals.filter(s => s === 'NEUTRAL').length;

  let overallSignal = 'NEUTRAL';
  if (buySignals > sellSignals && buySignals > neutralSignals) {
    overallSignal = 'BUY';
  } else if (sellSignals > buySignals && sellSignals > neutralSignals) {
    overallSignal = 'SELL';
  }

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  return {
    overallSignal,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    buySignals,
    sellSignals,
    neutralSignals,
    totalAgents: Object.keys(results).length,
    successfulAgents: Object.values(results).filter(r => r && !r.error).length,
  };
}

/**
 * Auto-training Scheduler
 * ------------------------
 * بررسی می‌کند که آیا Agent ها نیاز به training دارند یا نه
 * و به صورت خودکار training sessions را schedule می‌کند
 */

let decisionCount = 0;
let lastTrainingDate = new Date();

/**
 * Schedule automatic training based on decision count and time
 */
export async function scheduleAutomaticTraining(userId = null) {
  try {
    decisionCount++;
    
    // Check if training is needed (every 100 decisions or weekly)
    const shouldTrain = 
      decisionCount >= 100 || 
      (Date.now() - lastTrainingDate.getTime()) > (7 * 24 * 60 * 60 * 1000); // 7 days
    
    if (!shouldTrain) {
      return { scheduled: false, reason: 'Training not needed yet' };
    }
    
    // Get agents with low accuracy
    let agentsNeedingTraining = [];
    try {
      const result = await query(
        `SELECT id, name, accuracy, total_decisions 
         FROM ai_agents 
         WHERE is_enabled = true 
         AND (accuracy < 60 OR total_decisions < 50)
         ORDER BY accuracy ASC
         LIMIT 5`
      );
      agentsNeedingTraining = result.rows || [];
    } catch (error) {
      console.warn('⚠️ Could not fetch agents for training:', error.message);
      return { scheduled: false, reason: 'Could not fetch agents' };
    }
    
    if (agentsNeedingTraining.length === 0) {
      // Reset counter if no agents need training
      decisionCount = 0;
      return { scheduled: false, reason: 'No agents need training' };
    }
    
    // Schedule training for each agent
    const trainingSessions = [];
    for (const agent of agentsNeedingTraining) {
      try {
        const sessionResult = await query(
          `INSERT INTO ai_training_sessions 
           (agent_id, session_name, mode, status, dataset_size, epochs)
           VALUES ($1, $2, $3, 'pending', 1000, 10)
           RETURNING *`,
          [
            agent.id,
            `Auto-training ${new Date().toISOString()}`,
            'supervised'
          ]
        );
        trainingSessions.push(sessionResult.rows[0]);
      } catch (error) {
        console.error(`Failed to schedule training for agent ${agent.id}:`, error);
      }
    }
    
    // Reset counters
    decisionCount = 0;
    lastTrainingDate = new Date();
    
    return {
      scheduled: true,
      sessionsCreated: trainingSessions.length,
      agents: agentsNeedingTraining.map(a => a.name),
    };
  } catch (error) {
    console.error('Error in scheduleAutomaticTraining:', error);
    return { scheduled: false, reason: error.message };
  }
}

/**
 * Check if weekly training is due
 */
function weeklyTrainingDue() {
  const now = new Date();
  const daysSinceLastTraining = (now.getTime() - lastTrainingDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastTraining >= 7;
}

/**
 * Trigger a training session
 */
export async function triggerTrainingSession(agentIds = null, mode = 'supervised') {
  try {
    let agentsToTrain = [];
    
    if (agentIds && agentIds.length > 0) {
      // Train specific agents
      const result = await query(
        `SELECT id, name FROM ai_agents WHERE id = ANY($1) AND is_enabled = true`,
        [agentIds]
      );
      agentsToTrain = result.rows || [];
    } else {
      // Train all agents with low accuracy
      const result = await query(
        `SELECT id, name FROM ai_agents 
         WHERE is_enabled = true AND accuracy < 70
         ORDER BY accuracy ASC
         LIMIT 5`
      );
      agentsToTrain = result.rows || [];
    }
    
    const sessions = [];
    for (const agent of agentsToTrain) {
      try {
        const sessionResult = await query(
          `INSERT INTO ai_training_sessions 
           (agent_id, session_name, mode, status, dataset_size, epochs)
           VALUES ($1, $2, $3, 'pending', 1000, 10)
           RETURNING *`,
          [
            agent.id,
            `Training Session ${new Date().toISOString()}`,
            mode
          ]
        );
        sessions.push(sessionResult.rows[0]);
      } catch (error) {
        console.error(`Failed to create training session for ${agent.id}:`, error);
      }
    }
    
    return {
      success: true,
      sessionsCreated: sessions.length,
      sessions,
    };
  } catch (error) {
    console.error('Error triggering training session:', error);
    throw error;
  }
}


