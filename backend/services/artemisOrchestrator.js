import dotenv from 'dotenv';
import { aiService } from './ai.js';

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


