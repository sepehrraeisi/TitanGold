/**
 * Canonical MEXC capability gates for Spot / Futures / Wallet consumers.
 * No module may invent a parallel permission matrix.
 */

import { MEXC_CAPABILITY } from './capabilityIds.js';
import { assertTier4Blocked } from './connectionCapabilityService.js';

export function evaluateSpotTradingGates(matrixCapabilities = []) {
  const byId = new Map(matrixCapabilities.map((c) => [c.capabilityId, c]));
  const pub = byId.get(MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC);
  const auth = byId.get(MEXC_CAPABILITY.PRIVATE_AUTH);
  const account = byId.get(MEXC_CAPABILITY.SPOT_ACCOUNT_READ);
  const orders = byId.get(MEXC_CAPABILITY.SPOT_ORDER_READ);
  const history = byId.get(MEXC_CAPABILITY.SPOT_TRADE_HISTORY_READ);
  const testOrder = byId.get(MEXC_CAPABILITY.SPOT_TRADE_TEST);
  const execute = byId.get(MEXC_CAPABILITY.SPOT_TRADE_EXECUTE);
  const cancel = byId.get(MEXC_CAPABILITY.SPOT_ORDER_CANCEL);

  return {
    publicPriceData: pub?.providerSupport === 'supported',
    accountBalances: account?.operationalState === 'enabled',
    openOrders: orders?.operationalState === 'enabled',
    orderHistory: orders?.operationalState === 'enabled',
    tradeHistory: history?.operationalState === 'enabled',
    commissionInfo: account?.operationalState === 'enabled',
    tradingEligibility: auth?.verificationState === 'verified' && account?.keyGrant === 'granted',
    dryRunValidation: true,
    testOrderEligibility: false, // requires separate approval
    realOrderGated: assertTier4Blocked('spot_order_execute'),
    cancellationGated: assertTier4Blocked('spot_order_cancel'),
    testOrderCapability: testOrder,
    executeCapability: execute,
    cancelCapability: cancel,
  };
}

export function evaluateFuturesTradingGates(matrixCapabilities = []) {
  const byId = new Map(matrixCapabilities.map((c) => [c.capabilityId, c]));
  const pub = byId.get(MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC);
  const account = byId.get(MEXC_CAPABILITY.FUTURES_ACCOUNT_READ);
  const positions = byId.get(MEXC_CAPABILITY.FUTURES_POSITION_READ);
  const orders = byId.get(MEXC_CAPABILITY.FUTURES_ORDER_READ);
  const execute = byId.get(MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE);
  const cancel = byId.get(MEXC_CAPABILITY.FUTURES_ORDER_CANCEL);

  return {
    publicMarketData: pub?.providerSupport === 'supported',
    accountOverview: account?.operationalState === 'enabled',
    positions: positions?.operationalState === 'enabled',
    orders: orders?.operationalState === 'enabled',
    providerMaintenance:
      execute?.providerSupport === 'maintenance' || cancel?.providerSupport === 'maintenance',
    maintenanceNote:
      'Official MEXC Contract docs mark Futures Order / Cancel endpoints as Under maintenance',
    documentationVerifiedAt: '2026-07-19',
    tradingEligibility: false,
    realOrderGated: assertTier4Blocked('futures_order_execute'),
    positionSettingsGated: assertTier4Blocked('futures_position_settings'),
    // Spot credentials must not imply Futures grant
    spotAuthDoesNotGrantFutures: true,
  };
}

export function evaluateWalletGates(matrixCapabilities = []) {
  const byId = new Map(matrixCapabilities.map((c) => [c.capabilityId, c]));
  return {
    currencyConfig: byId.get(MEXC_CAPABILITY.WALLET_CURRENCY_READ),
    depositAddressRead: byId.get(MEXC_CAPABILITY.DEPOSIT_ADDRESS_READ),
    depositHistory: byId.get(MEXC_CAPABILITY.DEPOSIT_HISTORY_READ),
    withdrawalHistory: byId.get(MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ),
    depositUiReady: true,
    withdrawalUiReady: true,
    transferUiReady: true,
    withdrawalExecute: assertTier4Blocked('withdrawal_execute'),
    transferExecute: assertTier4Blocked('transfer_execute'),
    internalTransferExecute: assertTier4Blocked('internal_transfer_execute'),
    dustExecute: assertTier4Blocked('dust_execute'),
    usesCanonicalConnection: true,
    duplicateCredentialFormForbidden: true,
  };
}
