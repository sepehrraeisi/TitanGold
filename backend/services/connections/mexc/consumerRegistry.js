/**
 * Canonical MEXC consumer requirements — Agents, Wallet, Portfolio, Spot, Futures.
 * No consumer may create a parallel MEXC client or read credentials directly.
 */

import { MEXC_CAPABILITY, SIDE_EFFECT, RW_CLASS } from './capabilityIds.js';

export const MEXC_CONSUMERS = Object.freeze([
  {
    id: 'portfolio',
    displayName: 'Portfolio',
    owningModule: 'Portfolio',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.SPOT_ACCOUNT_READ],
    optionalCapabilities: [MEXC_CAPABILITY.FUTURES_ACCOUNT_READ, MEXC_CAPABILITY.FUTURES_POSITION_READ],
    fallbackBehavior: 'Show N/A balances; public market widgets continue',
  },
  {
    id: 'arbitrage',
    displayName: 'Arbitrage',
    owningModule: 'Agents / Arbitrage Scanner',
    publicPrivate: 'public',
    rwClass: RW_CLASS.PUBLIC,
    sideEffectClass: SIDE_EFFECT.NONE,
    requiredCapabilities: [MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC],
    optionalCapabilities: [MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC],
    fallbackBehavior: 'Continue on public market data without private credentials',
  },
  {
    id: 'market_data_agents',
    displayName: 'Market Data Agents',
    owningModule: 'Agents',
    publicPrivate: 'public',
    rwClass: RW_CLASS.PUBLIC,
    sideEffectClass: SIDE_EFFECT.NONE,
    requiredCapabilities: [MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC],
    optionalCapabilities: [MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC],
    fallbackBehavior: 'Use public endpoints only',
  },
  {
    id: 'spot_trading',
    displayName: 'Spot Trading',
    owningModule: 'Spot Trading',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.SPOT_ACCOUNT_READ,
    ],
    optionalCapabilities: [
      MEXC_CAPABILITY.SPOT_ORDER_READ,
      MEXC_CAPABILITY.SPOT_TRADE_HISTORY_READ,
      MEXC_CAPABILITY.SPOT_TRADE_TEST,
      MEXC_CAPABILITY.SPOT_TRADE_EXECUTE,
      MEXC_CAPABILITY.SPOT_ORDER_CANCEL,
    ],
    fallbackBehavior: 'Public prices continue; private trading actions stay gated',
  },
  {
    id: 'futures_trading',
    displayName: 'Futures Trading',
    owningModule: 'Futures Trading',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.FUTURES_ACCOUNT_READ,
    ],
    optionalCapabilities: [
      MEXC_CAPABILITY.FUTURES_POSITION_READ,
      MEXC_CAPABILITY.FUTURES_ORDER_READ,
      MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE,
      MEXC_CAPABILITY.FUTURES_ORDER_CANCEL,
      MEXC_CAPABILITY.FUTURES_POSITION_SETTINGS_WRITE,
    ],
    fallbackBehavior: 'Missing Futures permission blocks only Futures consumers; Spot continues',
  },
  {
    id: 'wallet',
    displayName: 'Wallet',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.WALLET_CURRENCY_READ,
    ],
    optionalCapabilities: [
      MEXC_CAPABILITY.DEPOSIT_ADDRESS_READ,
      MEXC_CAPABILITY.DEPOSIT_HISTORY_READ,
      MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ,
      MEXC_CAPABILITY.WITHDRAWAL_EXECUTE,
      MEXC_CAPABILITY.TRANSFER_EXECUTE,
    ],
    fallbackBehavior: 'UI available with fake/disabled Tier-4; no credential form duplication',
  },
  {
    id: 'risk_agents',
    displayName: 'Risk',
    owningModule: 'Agents',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC],
    optionalCapabilities: [MEXC_CAPABILITY.SPOT_ACCOUNT_READ, MEXC_CAPABILITY.FUTURES_POSITION_READ],
    fallbackBehavior: 'Analytical risk continues on public data',
  },
  {
    id: 'other_agents',
    displayName: 'Other Agents',
    owningModule: 'Agents',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PUBLIC,
    sideEffectClass: SIDE_EFFECT.NONE,
    requiredCapabilities: [MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC],
    optionalCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH],
    fallbackBehavior: 'No credential access; use Connections capability owner only',
  },
]);

/**
 * Evaluate consumer eligibility against a capability matrix result.
 */
export function evaluateConsumerEligibility(consumer, matrix) {
  const byId = new Map(matrix.capabilities.map((c) => [c.capabilityId, c]));
  const missingRequired = [];
  const blockedReasons = [];

  for (const capId of consumer.requiredCapabilities) {
    const cap = byId.get(capId);
    if (!cap) {
      missingRequired.push(capId);
      blockedReasons.push(`${capId}: missing from matrix`);
      continue;
    }
    if (cap.operationalState !== 'enabled' && consumer.publicPrivate !== 'public') {
      // Public-only consumers: public caps may be not_tested but still usable
      if (cap.rwClass === 'public') continue;
      missingRequired.push(capId);
      blockedReasons.push(`${capId}: ${cap.blockedReason || cap.operationalState}`);
    }
    if (consumer.publicPrivate === 'public' && cap.rwClass === 'public') {
      // public consumers eligible when provider supports
      if (cap.providerSupport === 'unknown' || cap.providerSupport === 'unsupported') {
        missingRequired.push(capId);
        blockedReasons.push(`${capId}: provider ${cap.providerSupport}`);
      }
    }
  }

  // Public analytical consumers: eligible when public market data supported
  let eligible = missingRequired.length === 0;
  if (consumer.publicPrivate === 'public') {
    const pub = consumer.requiredCapabilities.every((id) => {
      const c = byId.get(id);
      return c && (c.providerSupport === 'supported' || c.operationalState === 'enabled');
    });
    eligible = pub;
  }

  return {
    consumerId: consumer.id,
    displayName: consumer.displayName,
    owningModule: consumer.owningModule,
    requiredCapabilities: consumer.requiredCapabilities,
    optionalCapabilities: consumer.optionalCapabilities,
    publicPrivate: consumer.publicPrivate,
    rwClass: consumer.rwClass,
    sideEffectClass: consumer.sideEffectClass,
    eligible,
    blockedReason: eligible ? null : blockedReasons.join('; ') || 'Required capabilities not operational',
    fallbackBehavior: consumer.fallbackBehavior,
  };
}

export function evaluateAllConsumers(matrix) {
  return MEXC_CONSUMERS.map((c) => evaluateConsumerEligibility(c, matrix));
}
