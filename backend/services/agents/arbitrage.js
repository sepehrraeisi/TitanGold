/**
 * Arbitrage Agent — ARB-WP1A analytical MEXC spot spread monitor
 *
 * Truthful semantics:
 * - Same-market bid/ask monitoring is NOT executable multi-leg arbitrage.
 * - Outputs are Spread Candidates or Rejected Candidates.
 * - Qualified Arbitrage Opportunities remain empty until a proven multi-leg strategy exists.
 * - No realized/captured profit is produced.
 */

import fetch from 'node-fetch';
import { logger } from '../../services/logger.js';
import { circuitBreakerManager } from '../../utils/circuitBreaker.js';
import {
  ARBITRAGE_ANALYTICAL_MODE,
  ARBITRAGE_CONTRACT_VERSION_WP1A,
  ARBITRAGE_STRATEGY_CLASS,
  REJECTION_REASONS,
  annotateCandidatesWithLifecycle,
  aggregateLifecycleMetrics,
} from '../arbitrageScanContract.js';

const mexcCircuitBreaker = circuitBreakerManager.getBreaker('mexc-api', {
  failureThreshold: 5,
  openTimeout: 30000,
  successThreshold: 2,
  timeout: 10000,
});

/**
 * Canonical internal API base — uses process PORT (PM2 sets PORT=5002 on staging).
 * Do not hardcode localhost:5002.
 */
export function getInternalApiBase() {
  if (process.env.INTERNAL_API_BASE) {
    return String(process.env.INTERNAL_API_BASE).replace(/\/$/, '');
  }
  const port = process.env.PORT || 5002;
  return `http://127.0.0.1:${port}`;
}

async function fetchMexcTicker(symbol) {
  return mexcCircuitBreaker.execute(async () => {
    const url = `${getInternalApiBase()}/api/market/mexc/ticker24hr?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'TitanGold-Backend/1.0' },
    });
    if (!response.ok) {
      throw new Error(`MEXC proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.ok || !result.data) {
      throw new Error('Invalid MEXC proxy response');
    }
    return result.data;
  });
}

async function fetchMexcDepth(symbol, limit = 20) {
  return mexcCircuitBreaker.execute(async () => {
    const url = `${getInternalApiBase()}/api/market/mexc/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
    const response = await fetch(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'TitanGold-Backend/1.0' },
    });
    if (!response.ok) {
      throw new Error(`MEXC depth proxy error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.ok || !result.data) {
      throw new Error('Invalid MEXC depth response');
    }
    return result.data;
  });
}

function calculateEffectivePrice(orders, volumeUSDT) {
  let remainingVolume = volumeUSDT;
  let totalCost = 0;
  let totalQty = 0;

  for (const [priceStr, qtyStr] of orders || []) {
    const price = parseFloat(priceStr);
    const qty = parseFloat(qtyStr);
    const orderValue = price * qty;
    if (remainingVolume <= 0) break;
    if (orderValue >= remainingVolume) {
      const neededQty = remainingVolume / price;
      totalCost += remainingVolume;
      totalQty += neededQty;
      remainingVolume = 0;
    } else {
      totalCost += orderValue;
      totalQty += qty;
      remainingVolume -= orderValue;
    }
  }
  if (totalQty === 0) return 0;
  return totalCost / totalQty;
}

function calculateSpread(bid, ask) {
  if (!bid || !ask || ask === 0) return 0;
  return ((ask - bid) / ask) * 100;
}

function calculateNetProfit(spread, volumeUSDT, config) {
  const feeBps = config.feeBps || 10;
  const slippageBps = config.slippageBps || 10;
  const feePercent = feeBps / 100;
  const slippagePercent = slippageBps / 100;
  const netSpread = spread - feePercent - slippagePercent;
  const profitUSDT = (netSpread / 100) * volumeUSDT;
  return {
    grossSpreadPct: spread,
    feePct: feePercent,
    slippagePct: slippagePercent,
    netSpreadPct: netSpread,
    profitUSDT,
    profitBps: netSpread * 100,
  };
}

export { calculateSpread, calculateNetProfit };

function calculateRiskScore(spread, volume24h, depth, config) {
  let risk = 0;
  if (spread > 2.0) risk += 30;
  else if (spread > 1.0) risk += 20;
  else if (spread > 0.5) risk += 10;

  const minVolumeUSDT = config.minVolumeUSDT || 100000;
  if (volume24h < minVolumeUSDT * 2) risk += 20;
  else if (volume24h < minVolumeUSDT * 5) risk += 10;

  const totalDepth = (depth.bids?.length || 0) + (depth.asks?.length || 0);
  if (totalDepth < 20) risk += 20;
  else if (totalDepth < 40) risk += 10;
  if (spread > 1.0) risk += 10;
  return Math.min(risk, 100);
}

function getRiskLevel(riskScore) {
  if (riskScore >= 75) return 'high';
  if (riskScore >= 50) return 'medium';
  return 'low';
}

function getMinProfitBps(config) {
  const strategies = Array.isArray(config.strategies) ? config.strategies : [];
  const spot = strategies.find((s) => s && (s.type === 'spot' || s.type === 'mexc_spot_spread_monitor'));
  if (spot && Number.isFinite(Number(spot.minProfitBps))) return Number(spot.minProfitBps);
  if (Number.isFinite(Number(config.opportunityThresholdBps))) return Number(config.opportunityThresholdBps);
  // Convert minSpreadPct roughly: if set, use as bps * 100? minSpreadPct is percent → bps = pct * 100
  if (Number.isFinite(Number(config.minSpreadPct))) return Number(config.minSpreadPct) * 100;
  return 20;
}

function listUnsupportedStrategies(config) {
  const strategies = Array.isArray(config.strategies) ? config.strategies : [];
  const unsupported = [];
  for (const s of strategies) {
    const type = String(s?.type || '');
    if (!s?.enabled) continue;
    if (type === 'triangle' || type === 'triangular') {
      unsupported.push({ type: 'triangle', reason: REJECTION_REASONS.UNSUPPORTED_STRATEGY });
    } else if (type === 'cross_exchange') {
      unsupported.push({ type: 'cross_exchange', reason: REJECTION_REASONS.UNSUPPORTED_STRATEGY });
    } else if (type === 'spot_vs_perp') {
      unsupported.push({ type: 'spot_vs_perp', reason: REJECTION_REASONS.UNSUPPORTED_STRATEGY });
    }
  }
  // Futures market toggle is not implemented in this analytical monitor
  const exchanges = Array.isArray(config.exchanges) ? config.exchanges : [];
  for (const ex of exchanges) {
    const markets = Array.isArray(ex?.markets) ? ex.markets : [];
    if (ex?.enabled && markets.includes('futures')) {
      unsupported.push({ type: 'mexc_futures', reason: REJECTION_REASONS.UNSUPPORTED_STRATEGY });
    }
  }
  return unsupported;
}

function buildCandidateBase({
  symbol,
  spread,
  profitCalc,
  testVolume,
  volume24h,
  bestBid,
  bestAsk,
  effectiveBuyPrice,
  effectiveSellPrice,
  riskScore,
  depth,
}) {
  return {
    id: `${symbol}-${Date.now()}`,
    symbol,
    exchange: 'mexc',
    market: 'spot',
    classification: 'spread_candidate',
    strategy: ARBITRAGE_STRATEGY_CLASS,
    strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
    analytical: true,
    executableArbitrage: false,
    timestamp: new Date().toISOString(),
    path: [`Observe bid ${symbol}`, `Observe ask ${symbol}`],
    lastPrice: null,
    bidPrice: bestBid,
    askPrice: bestAsk,
    effectiveBuyPrice,
    effectiveSellPrice,
    spreadPct: spread,
    netSpreadPct: profitCalc.netSpreadPct,
    estimatedProfitUSDT: profitCalc.profitUSDT,
    netProfitUSDT: profitCalc.profitUSDT,
    profitBps: profitCalc.profitBps,
    expectedProfitBps: profitCalc.profitBps,
    volume24hUSDT: volume24h,
    testVolumeUSDT: testVolume,
    bidDepth: depth.bids ? depth.bids.length : 0,
    askDepth: depth.asks ? depth.asks.length : 0,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    executionTimeMs: null,
    fees: {
      feePct: profitCalc.feePct,
      slippagePct: profitCalc.slippagePct,
    },
  };
}

/**
 * Scan MEXC spot order books and classify analytical spread candidates.
 */
export async function detectOpportunities(params) {
  const { config } = params;
  const symbols = config.symbols || ['BTCUSDT', 'ETHUSDT'];
  const minSpreadPct = config.minSpreadPct || 0.20;
  const maxSpreadPct = config.maxSpreadPct || 5.00;
  const minVolumeUSDT = config.minVolumeUSDT || 100000;
  const orderbookDepth = config.orderbookDepth || 20;
  const minProfitBps = getMinProfitBps(config);
  const minDepthLevels = config.riskControls?.minDepthUSD ? 10 : 10;

  const candidates = [];
  const rejectedCandidates = [];

  logger.info(`🔍 Analytical spread monitor: scanning ${symbols.length} MEXC spot symbols...`);

  for (const symbol of symbols) {
    try {
      const [ticker, depth] = await Promise.all([
        fetchMexcTicker(symbol),
        fetchMexcDepth(symbol, orderbookDepth),
      ]);

      const volume24h = parseFloat(ticker.quoteVolume || ticker.volume);
      const bestBid = depth.bids?.[0] ? parseFloat(depth.bids[0][0]) : null;
      const bestAsk = depth.asks?.[0] ? parseFloat(depth.asks[0][0]) : null;

      if (!bestBid || !bestAsk) {
        rejectedCandidates.push({
          id: `${symbol}-missing-${Date.now()}`,
          symbol,
          classification: 'rejected_candidate',
          strategy: ARBITRAGE_STRATEGY_CLASS,
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          analytical: true,
          executableArbitrage: false,
          rejectionReason: REJECTION_REASONS.MISSING_QUOTE,
          timestamp: new Date().toISOString(),
          expectedProfitBps: null,
          netProfitUSDT: null,
          riskScore: null,
        });
        continue;
      }

      if (!Number.isFinite(volume24h) || volume24h < minVolumeUSDT) {
        rejectedCandidates.push({
          id: `${symbol}-vol-${Date.now()}`,
          symbol,
          classification: 'rejected_candidate',
          strategy: ARBITRAGE_STRATEGY_CLASS,
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          analytical: true,
          executableArbitrage: false,
          rejectionReason: REJECTION_REASONS.VOLUME_TOO_LOW,
          timestamp: new Date().toISOString(),
          volume24hUSDT: volume24h,
          expectedProfitBps: null,
          netProfitUSDT: null,
          riskScore: null,
        });
        continue;
      }

      const spread = calculateSpread(bestBid, bestAsk);
      if (spread < minSpreadPct || spread > maxSpreadPct) {
        rejectedCandidates.push({
          id: `${symbol}-spread-${Date.now()}`,
          symbol,
          classification: 'rejected_candidate',
          strategy: ARBITRAGE_STRATEGY_CLASS,
          strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
          analytical: true,
          executableArbitrage: false,
          rejectionReason: REJECTION_REASONS.SPREAD_OUT_OF_RANGE,
          timestamp: new Date().toISOString(),
          spreadPct: spread,
          expectedProfitBps: null,
          netProfitUSDT: null,
          riskScore: null,
        });
        continue;
      }

      const totalDepth = (depth.bids?.length || 0) + (depth.asks?.length || 0);
      const testVolume = Math.min(volume24h * 0.01, 10000);
      const effectiveBuyPrice = calculateEffectivePrice(depth.asks, testVolume);
      const effectiveSellPrice = calculateEffectivePrice(depth.bids, testVolume);
      const profitCalc = calculateNetProfit(spread, testVolume, config);
      const riskScore = calculateRiskScore(spread, volume24h, depth, config);

      const base = buildCandidateBase({
        symbol,
        spread,
        profitCalc,
        testVolume,
        volume24h,
        bestBid,
        bestAsk,
        effectiveBuyPrice,
        effectiveSellPrice,
        riskScore,
        depth,
      });
      base.lastPrice = parseFloat(ticker.lastPrice);

      if (totalDepth < minDepthLevels) {
        rejectedCandidates.push({
          ...base,
          classification: 'rejected_candidate',
          rejectionReason: REJECTION_REASONS.INSUFFICIENT_DEPTH,
        });
        continue;
      }

      if (riskScore >= 75) {
        rejectedCandidates.push({
          ...base,
          classification: 'rejected_candidate',
          rejectionReason: REJECTION_REASONS.RISK_LIMIT,
        });
        continue;
      }

      if (!Number.isFinite(profitCalc.profitUSDT) || profitCalc.profitUSDT <= 0) {
        rejectedCandidates.push({
          ...base,
          classification: 'rejected_candidate',
          rejectionReason: REJECTION_REASONS.NON_POSITIVE_NET,
        });
        continue;
      }

      if (profitCalc.profitBps < minProfitBps) {
        rejectedCandidates.push({
          ...base,
          classification: 'rejected_candidate',
          rejectionReason: REJECTION_REASONS.BELOW_MIN_PROFIT,
        });
        continue;
      }

      // Same-market bid/ask is never a Qualified Arbitrage Opportunity in WP1A.
      // Positive analytical spread monitors remain Spread Candidates only.
      candidates.push({
        ...base,
        classification: 'spread_candidate',
        notes: 'NOT_EXECUTABLE_MULTI_LEG',
      });
    } catch (error) {
      logger.error(`❌ Error scanning ${symbol}:`, error.message);
      rejectedCandidates.push({
        id: `${symbol}-err-${Date.now()}`,
        symbol,
        classification: 'rejected_candidate',
        strategy: ARBITRAGE_STRATEGY_CLASS,
        strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
        analytical: true,
        executableArbitrage: false,
        rejectionReason: REJECTION_REASONS.INCOMPLETE_LEGS,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
        expectedProfitBps: null,
        netProfitUSDT: null,
        riskScore: null,
      });
    }
  }

  return { candidates, rejectedCandidates, qualifiedOpportunities: [] };
}

export async function run(params) {
  const { config } = params;
  logger.info('🤖 Arbitrage Agent: Starting analytical MEXC spot spread scan...');

  try {
    const unsupportedStrategies = listUnsupportedStrategies(config || {});
    const { candidates, rejectedCandidates, qualifiedOpportunities } = await detectOpportunities({
      config: config || {},
    });

    candidates.sort((a, b) => (b.expectedProfitBps || 0) - (a.expectedProfitBps || 0));

    const lifecycleCtx = { demoMode: true, killSwitchActive: true };
    const annotatedCandidates = annotateCandidatesWithLifecycle(candidates, lifecycleCtx);
    const annotatedRejected = annotateCandidatesWithLifecycle(rejectedCandidates, lifecycleCtx);
    const lifecycleMetrics = aggregateLifecycleMetrics(candidates, rejectedCandidates, lifecycleCtx);

    const scored = [...candidates, ...rejectedCandidates].filter((c) => Number.isFinite(c.riskScore));
    const avgRiskScore =
      scored.length > 0 ? scored.reduce((s, c) => s + c.riskScore, 0) / scored.length : null;

    const summary = {
      totalCandidates: candidates.length + rejectedCandidates.length,
      spreadCandidates: candidates.length,
      rejectedCandidates: rejectedCandidates.length,
      qualifiedOpportunities: 0,
      // Legacy field kept only for read-time normalizers; must not mean realized profit
      totalOpportunities: 0,
      totalProfitUSDT: null,
      avgSpreadPct:
        candidates.length > 0
          ? parseFloat(
              (candidates.reduce((s, c) => s + (c.spreadPct || 0), 0) / candidates.length).toFixed(2),
            )
          : null,
      avgRiskScore: avgRiskScore == null ? null : parseFloat(avgRiskScore.toFixed(0)),
      riskAlertCount: rejectedCandidates.filter((c) => c.rejectionReason === REJECTION_REASONS.RISK_LIMIT)
        .length,
    };

    logger.info(
      `✅ Analytical scan complete: ${candidates.length} spread candidates, ${rejectedCandidates.length} rejected, 0 qualified`,
    );

    return {
      agent_key: 'arbitrage',
      decision_type: 'arbitrage_scan',
      timestamp: new Date().toISOString(),
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      strategyClassification: ARBITRAGE_STRATEGY_CLASS,
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
      dryRun: true,
      legacy: false,
      summary,
      candidateStats: {
        total: candidates.length + rejectedCandidates.length,
        rejected: rejectedCandidates.length,
        spreadCandidates: candidates.length,
        qualified: 0,
      },
      qualifiedStats: {
        total: 0,
        bestProfitBps: null,
        expectedNetProfitUSDT: null,
      },
      riskStats: {
        averageScore: summary.avgRiskScore,
        unit: 'score_0_100',
      },
      candidates: annotatedCandidates.slice(0, 25),
      rejectedCandidates: annotatedRejected.slice(0, 50),
      qualifiedOpportunities: [],
      lifecycleMetrics,
      unsupportedStrategies,
      // Intentionally empty — same-market spreads are not opportunities
      opportunities: [],
      riskAlerts: rejectedCandidates
        .filter((c) => c.rejectionReason === REJECTION_REASONS.RISK_LIMIT)
        .map((c) => ({
          symbol: c.symbol,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          reason: c.rejectionReason,
        })),
      execution: { supported: false, realizedProfitUSDT: null },
      config: {
        symbols: config?.symbols || ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: config?.minSpreadPct || 0.20,
        maxSpreadPct: config?.maxSpreadPct || 5.00,
        minVolumeUSDT: config?.minVolumeUSDT || 100000,
        feeBps: config?.feeBps || 10,
        slippageBps: config?.slippageBps || 10,
        minProfitBps: getMinProfitBps(config || {}),
      },
      confidence:
        candidates.length > 0 ? Math.min(0.5 + candidates.length * 0.05, 0.85) : 0.1,
      _meta: {
        source: 'real',
        version: ARBITRAGE_CONTRACT_VERSION_WP1A,
        dataProvider: 'mexc',
        analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      },
    };
  } catch (error) {
    logger.error('❌ Arbitrage scan error:', error);
    return {
      agent_key: 'arbitrage',
      decision_type: 'arbitrage_scan',
      timestamp: new Date().toISOString(),
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      strategyClassification: ARBITRAGE_STRATEGY_CLASS,
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
      dryRun: true,
      legacy: false,
      error: true,
      errorMessage: error.message,
      summary: {
        totalCandidates: 0,
        spreadCandidates: 0,
        rejectedCandidates: 0,
        qualifiedOpportunities: 0,
        totalOpportunities: 0,
        totalProfitUSDT: null,
        avgSpreadPct: null,
        avgRiskScore: null,
        riskAlertCount: 0,
      },
      candidateStats: { total: 0, rejected: 0, spreadCandidates: 0, qualified: 0 },
      qualifiedStats: { total: 0, bestProfitBps: null, expectedNetProfitUSDT: null },
      riskStats: { averageScore: null, unit: 'score_0_100' },
      candidates: [],
      rejectedCandidates: [],
      qualifiedOpportunities: [],
      opportunities: [],
      unsupportedStrategies: [],
      riskAlerts: [],
      execution: { supported: false, realizedProfitUSDT: null },
      confidence: 0,
      _meta: { source: 'error', version: ARBITRAGE_CONTRACT_VERSION_WP1A, error: error.message },
    };
  }
}

export async function getDetails() {
  return {
    agent_key: 'arbitrage',
    name: 'Arbitrage Agent',
    description:
      'Analytical MEXC spot bid/ask spread monitor. Does not execute trades or claim multi-exchange arbitrage.',
    status: 'active',
    analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
    executionSupported: false,
  };
}

export function defaultConfig() {
  return {
    enabled: true,
    exchanges: ['mexc'],
    symbols: ['BTCUSDT', 'ETHUSDT'],
    minSpreadPct: 0.20,
    maxSpreadPct: 5.00,
    minVolumeUSDT: 100000,
    scanIntervalSec: 10,
    feeBps: 10,
    slippageBps: 10,
    orderbookDepth: 20,
    mode: 'spot',
    autoTrade: false,
  };
}

export default { run, getDetails, defaultConfig, getInternalApiBase, detectOpportunities };
