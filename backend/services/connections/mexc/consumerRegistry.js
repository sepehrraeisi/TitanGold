/**
 * Canonical MEXC consumer requirements — Agents, Wallet, Portfolio, Spot, Futures.
 * No consumer may create a parallel MEXC client or read credentials directly.
 * Unregistered agents are NOT ELIGIBLE.
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
    privateAuthRequired: false,
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
    privateAuthRequired: false,
  },
  {
    id: 'spot_trading_read',
    displayName: 'Spot Trading (read)',
    owningModule: 'Spot Trading',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.SPOT_ACCOUNT_READ,
      MEXC_CAPABILITY.SPOT_ORDER_READ,
    ],
    optionalCapabilities: [MEXC_CAPABILITY.SPOT_TRADE_HISTORY_READ],
    fallbackBehavior: 'Public prices continue; private reads stay gated until verified',
  },
  {
    id: 'spot_trading_execute',
    displayName: 'Spot Trading (execute)',
    owningModule: 'Spot Trading',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.SPOT_ACCOUNT_READ,
      MEXC_CAPABILITY.SPOT_ORDER_READ,
      MEXC_CAPABILITY.SPOT_TRADE_EXECUTE,
    ],
    optionalCapabilities: [MEXC_CAPABILITY.SPOT_ORDER_CANCEL],
    additionalRuntimeGates: [
      'effective_live_mode',
      'emergency_stop_inactive',
      'deployment_engine_enabled',
      'risk_and_confirmation_gates',
    ],
    fallbackBehavior: 'Execution remains Tier-4 blocked until separately authorized',
  },
  {
    id: 'futures_trading_read',
    displayName: 'Futures Trading (read)',
    owningModule: 'Futures Trading',
    publicPrivate: 'mixed',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.FUTURES_ACCOUNT_READ,
      MEXC_CAPABILITY.FUTURES_POSITION_READ,
      MEXC_CAPABILITY.FUTURES_ORDER_READ,
    ],
    optionalCapabilities: [],
    fallbackBehavior: 'Missing Futures permission blocks only Futures consumers; Spot continues',
  },
  {
    id: 'futures_trading_execute',
    displayName: 'Futures Trading (execute)',
    owningModule: 'Futures Trading',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [
      MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC,
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.FUTURES_ACCOUNT_READ,
      MEXC_CAPABILITY.FUTURES_POSITION_READ,
      MEXC_CAPABILITY.FUTURES_ORDER_READ,
      MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE,
    ],
    optionalCapabilities: [MEXC_CAPABILITY.FUTURES_ORDER_CANCEL],
    additionalRuntimeGates: [
      'provider_endpoint_available',
      'effective_live_mode',
      'emergency_stop_inactive',
      'risk_and_confirmation_gates',
    ],
    fallbackBehavior: 'Futures execute remains Tier-4 blocked; Spot credentials do not grant Futures',
  },
  {
    id: 'wallet',
    displayName: 'Wallet',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [
      MEXC_CAPABILITY.PRIVATE_AUTH,
      MEXC_CAPABILITY.WALLET_CURRENCY_READ,
    ],
    optionalCapabilities: [
      MEXC_CAPABILITY.DEPOSIT_ADDRESS_READ,
      MEXC_CAPABILITY.DEPOSIT_HISTORY_READ,
      MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ,
      MEXC_CAPABILITY.TRANSFER_READ,
    ],
    fallbackBehavior:
      'Wallet read experience stays usable when withdrawal/transfer execute are blocked; evaluate functions individually',
  },
  {
    id: 'wallet_deposit_address',
    displayName: 'Wallet · Deposit address',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.DEPOSIT_ADDRESS_READ],
    optionalCapabilities: [],
    fallbackBehavior: 'Deposit address UI disabled until capability verified',
  },
  {
    id: 'wallet_deposit_history',
    displayName: 'Wallet · Deposit history',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.DEPOSIT_HISTORY_READ],
    optionalCapabilities: [],
    fallbackBehavior: 'Deposit history UI disabled until capability verified',
  },
  {
    id: 'wallet_withdrawal_history',
    displayName: 'Wallet · Withdrawal history',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ],
    optionalCapabilities: [],
    fallbackBehavior: 'Withdrawal history remains independent of withdrawal execute',
  },
  {
    id: 'wallet_withdrawal_execute',
    displayName: 'Wallet · Withdrawal execute',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.WITHDRAWAL_EXECUTE],
    optionalCapabilities: [],
    additionalRuntimeGates: ['tier4_runtime_gates'],
    fallbackBehavior: 'Tier-4 blocked; does not disable other Wallet functions',
  },
  {
    id: 'wallet_transfer_read',
    displayName: 'Wallet · Transfer read',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_READ,
    sideEffectClass: SIDE_EFFECT.READ_ONLY,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.TRANSFER_READ],
    optionalCapabilities: [],
    fallbackBehavior: 'Transfer history independent of transfer execute',
  },
  {
    id: 'wallet_transfer_execute',
    displayName: 'Wallet · Transfer execute',
    owningModule: 'Wallet',
    publicPrivate: 'private',
    rwClass: RW_CLASS.PRIVATE_WRITE,
    sideEffectClass: SIDE_EFFECT.FINANCIAL_WRITE,
    requiredCapabilities: [MEXC_CAPABILITY.PRIVATE_AUTH, MEXC_CAPABILITY.TRANSFER_EXECUTE],
    optionalCapabilities: [],
    additionalRuntimeGates: ['tier4_runtime_gates'],
    fallbackBehavior: 'Tier-4 blocked; does not disable Wallet read experience',
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
]);

export const UNREGISTERED_AGENT_STATUS = Object.freeze({
  eligible: false,
  blockedReason: 'NOT REGISTERED — NOT ELIGIBLE',
  code: 'NOT_REGISTERED_NOT_ELIGIBLE',
});

export function evaluateConsumerEligibility(consumer, matrix) {
  if (!consumer) {
    return {
      consumerId: null,
      displayName: 'Unknown',
      owningModule: 'Agents',
      requiredCapabilities: [],
      optionalCapabilities: [],
      publicPrivate: 'unknown',
      rwClass: null,
      sideEffectClass: null,
      eligible: false,
      blockedReason: UNREGISTERED_AGENT_STATUS.blockedReason,
      fallbackBehavior: null,
      registered: false,
    };
  }

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

    if (consumer.publicPrivate === 'public' && cap.rwClass === 'public') {
      if (cap.providerSupport === 'unknown' || cap.providerSupport === 'unsupported') {
        missingRequired.push(capId);
        blockedReasons.push(`${capId}: provider ${cap.providerSupport}`);
      }
      continue;
    }

    if (cap.operationalState !== 'enabled') {
      if (cap.rwClass === 'public' && (cap.providerSupport === 'supported' || cap.operationalState === 'enabled')) {
        continue;
      }
      missingRequired.push(capId);
      blockedReasons.push(`${capId}: ${cap.blockedReason || cap.operationalState}`);
    }
  }

  let eligible = missingRequired.length === 0;
  if (consumer.publicPrivate === 'public') {
    eligible = consumer.requiredCapabilities.every((id) => {
      const c = byId.get(id);
      return c && (c.providerSupport === 'supported' || c.operationalState === 'enabled');
    });
  }

  if (consumer.sideEffectClass === SIDE_EFFECT.FINANCIAL_WRITE || consumer.sideEffectClass === SIDE_EFFECT.ACCOUNT_MUTATION) {
    if (matrix.realSideEffectsAllowed !== true) {
      eligible = false;
      if (!blockedReasons.some((r) => /Tier-4|runtime/i.test(r))) {
        blockedReasons.push('Tier-4 runtime gates: Live side effects impossible in this slice');
      }
    }
  }

  return {
    consumerId: consumer.id,
    displayName: consumer.displayName,
    owningModule: consumer.owningModule,
    requiredCapabilities: consumer.requiredCapabilities,
    optionalCapabilities: consumer.optionalCapabilities || [],
    additionalRuntimeGates: consumer.additionalRuntimeGates || [],
    publicPrivate: consumer.publicPrivate,
    rwClass: consumer.rwClass,
    sideEffectClass: consumer.sideEffectClass,
    eligible,
    blockedReason: eligible ? null : blockedReasons.join('; ') || 'Required capabilities not operational',
    fallbackBehavior: consumer.fallbackBehavior,
    registered: true,
  };
}

export function evaluateAllConsumers(matrix) {
  return MEXC_CONSUMERS.map((c) => evaluateConsumerEligibility(c, matrix));
}

export function resolveAgentConsumerEligibility(matrix, agentConsumerId) {
  const consumer = MEXC_CONSUMERS.find((c) => c.id === agentConsumerId);
  if (!consumer) {
    return {
      consumerId: agentConsumerId || null,
      displayName: agentConsumerId || 'Unknown Agent',
      owningModule: 'Agents',
      eligible: false,
      blockedReason: UNREGISTERED_AGENT_STATUS.blockedReason,
      code: UNREGISTERED_AGENT_STATUS.code,
      registered: false,
      mayReadCredentials: false,
      mayCreateParallelClient: false,
      bypassRuntimeForbidden: true,
    };
  }
  return {
    ...evaluateConsumerEligibility(consumer, matrix),
    code: null,
  };
}

export const LEGACY_CONSUMER_ALIASES = Object.freeze({
  spot_trading: 'spot_trading_read',
  futures_trading: 'futures_trading_read',
  other_agents: null,
});
