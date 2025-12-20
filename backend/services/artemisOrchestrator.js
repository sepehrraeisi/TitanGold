import dotenv from 'dotenv';
import { aiService } from './ai.js';
import { messageQueue } from './messageQueue.js';
import { query } from '../database/db.js';

dotenv.config();

/**
 * Artemis Orchestrator
 * --------------------
 * این سرویس تصمیم نهایی را با استفاده از چند LLM (Gemini, Claude, OpenAI, DeepSeek)
 * و استراتژی تعریف شده در ArtemisConfig می‌گیرد.
 *
 * توجه: فعلاً فقط Gemini (internal) به صورت کامل پیاده شده؛
 * بقیه LLMها در صورت تنظیم کلید محیطی استفاده می‌شوند، در غیر این صورت نادیده گرفته می‌شوند.
 */

const PROVIDERS = {
  gemini: 'gemini',
  claude: 'claude',
  openai: 'openai',
  deepseek: 'deepseek',
};

async function callGemini(prompt, systemInstruction) {
  // از aiService موجود استفاده می‌کنیم
  const response = await aiService.askArtemis(prompt, systemInstruction);
  return response;
}

async function callClaude(prompt, systemInstruction) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;

  const body = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  };
  if (systemInstruction) {
    body.system = systemInstruction;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Claude API error:', res.status, text);
    return null;
  }

  const data = await res.json();
  const first = data?.content?.[0]?.text;
  return first || null;
}

async function callOpenAI(prompt, systemInstruction) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) return null;

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('OpenAI API error:', res.status, text);
    return null;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

async function callDeepSeek(prompt, systemInstruction) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('DeepSeek API error:', res.status, text);
    return null;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

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

  const basePrompt = `
Trade Opportunity:
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
}
`;

  // انتخاب Providerها بر اساس activeModel
  const providersToUse = [];
  if (activeModel === 'internal' || activeModel === 'gemini' || activeModel === 'hybrid') {
    providersToUse.push(PROVIDERS.gemini);
  }
  if (activeModel === 'claude' || activeModel === 'hybrid') {
    providersToUse.push(PROVIDERS.claude);
  }
  if (activeModel === 'openai' || activeModel === 'hybrid') {
    providersToUse.push(PROVIDERS.openai);
  }
  if (activeModel === 'deepseek' || activeModel === 'hybrid') {
    providersToUse.push(PROVIDERS.deepseek);
  }

  if (!providersToUse.length) {
    // پیش‌فرض: فقط internal
    providersToUse.push(PROVIDERS.gemini);
  }

  const calls = providersToUse.map(async provider => {
    try {
      let raw = null;
      if (provider === PROVIDERS.gemini) {
        raw = await callGemini(basePrompt, systemInstruction);
      } else if (provider === PROVIDERS.claude) {
        raw = await callClaude(basePrompt, systemInstruction);
      } else if (provider === PROVIDERS.openai) {
        raw = await callOpenAI(basePrompt, systemInstruction);
      } else if (provider === PROVIDERS.deepseek) {
        raw = await callDeepSeek(basePrompt, systemInstruction);
      }

      const parsed = parseDecisionJson(raw);
      if (!parsed) return null;
      return {
        provider,
        action: parsed.action || 'HOLD',
        confidence: parsed.confidence ?? opportunity.confidence ?? 0,
        reason: parsed.reason || '',
      };
    } catch (e) {
      console.error(`Artemis orchestrator provider ${provider} error:`, e);
      return null;
    }
  });

  const results = (await Promise.all(calls)).filter(Boolean);

  if (!results.length) {
    return null;
  }

  return aggregateDecisions(results, strategy);
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


