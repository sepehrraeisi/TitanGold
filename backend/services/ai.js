import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  pickProviderInstance, 
  recordProviderSuccess, 
  recordProviderFailure 
} from './providerPool.js';

// ============================================================================
// Production++ Utilities (Timeout / Retry / Concurrency)
// ============================================================================

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout(promise, ms, label = 'AI operation') {
  let t;
  const timeoutPromise = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(t);
  }
}

function isRetryableError(err) {
  const msg = (err?.message || '').toLowerCase();
  // Gemini SDK errors can be vague; treat network/rate-limit-ish as retryable
  return (
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('too many') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('unavailable')
  );
}

async function retry(fn, {
  attempts = 3,
  baseDelayMs = 1000,
  maxDelayMs = 7000,
  label = 'AI retry'
} = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      const retryable = isRetryableError(e);
      if (!retryable || i === attempts) throw e;

      // exponential-ish backoff: 1s -> 3s -> 7s (cap)
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
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.current++;
  }

  release() {
    this.current = Math.max(0, this.current - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

// ============================================================================
// AI Service (Gemini wrapper) — Production++
// ============================================================================
class AIService {
  constructor() {
    const key = process.env.GEMINI_API_KEY;

    this.enabled = Boolean(key);
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    // Concurrency limit (safe default)
    const maxConc = Number(process.env.AI_MAX_CONCURRENCY || 2);
    this.sem = new Semaphore(Number.isFinite(maxConc) && maxConc > 0 ? maxConc : 2);

    // Timeouts
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS || 25000);

    if (!this.enabled) {
      console.warn('⚠️ Gemini API Key not provided (GEMINI_API_KEY). AI features may return fallback responses.');
      this.genAI = null;
      return;
    }

    this.genAI = new GoogleGenerativeAI(key);
  }

  async askGemini(prompt) {
    if (!this.enabled || !this.genAI) {
      // Keep behavior simple for routes/orchestrator
      return 'AI Service not configured';
    }

    await this.sem.acquire();
    try {
      const run = async () => {
        const model = this.genAI.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        // Gemini SDK shape: result.response.text()
        return result?.response?.text?.() || '';
      };

      // Retry + Timeout applied
      const text = await retry(
        () => withTimeout(run(), this.timeoutMs, 'Gemini generateContent'),
        { attempts: 3, baseDelayMs: 1000, maxDelayMs: 7000, label: 'Gemini' }
      );

      return text || '';
    } finally {
      this.sem.release();
    }
  }

  // Artemis with Provider Pool + Failover
  // Tries Gemini first, falls back to other providers if needed
  async askArtemis(message, context) {
    const prompt = this.buildPrompt(message, context);
    
    // Try Gemini first (primary provider)
    try {
      const inst = await pickProviderInstance('gemini');
      if (inst) {
        try {
          const genAI = new GoogleGenerativeAI(inst.api_key_encrypted);
          const model = genAI.getGenerativeModel({ 
            model: inst.model || 'gemini-2.0-flash' 
          });
          
          const result = await withTimeout(
            model.generateContent(prompt),
            this.timeoutMs,
            'Gemini askArtemis'
          );
          
          const text = result.response?.text?.() || '';
          await recordProviderSuccess(inst.id);
          return text;
        } catch (err) {
          console.error('⚠️ Gemini failed, trying fallback:', err.message);
          await recordProviderFailure(inst.id, err);
          // Continue to fallback
        }
      }
    } catch (err) {
      console.warn('⚠️ No Gemini instance available');
    }
    
    // Fallback: try other providers (simplified - in production use full MoA)
    try {
      const providers = ['openai', 'deepseek', 'openrouter'];
      for (const provider of providers) {
        const inst = await pickProviderInstance(provider);
        if (!inst) continue;
        
        try {
          // For now, return placeholder (full implementation in Step 4)
          console.log(`📝 Fallback to ${provider} (placeholder)`);
          await recordProviderSuccess(inst.id);
          return 'AI Service temporarily using fallback provider';
        } catch (err) {
          await recordProviderFailure(inst.id, err);
        }
      }
    } catch (err) {
      console.error('❌ All providers failed:', err.message);
    }
    
    return 'AI Service error: all providers unavailable';
  }

  buildPrompt(message, context) {
    // Context can be string/obj; keep safe and bounded
    let ctx = '';
    try {
      if (context) {
        const raw = typeof context === 'string' ? context : JSON.stringify(context);
        // bound context size
        ctx = raw.length > 4000 ? raw.slice(0, 4000) + '…' : raw;
      }
    } catch {
      ctx = '';
    }

    if (ctx) {
      return `You are Artemis AI (trading assistant). Context:\n${ctx}\n\nUser:\n${message}\n\nAnswer:`;
    }
    return `You are Artemis AI (trading assistant).\n\nUser:\n${message}\n\nAnswer:`;
  }
}

export const aiService = new AIService();
