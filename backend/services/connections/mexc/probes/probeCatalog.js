/**
 * Ordered safe capability probes (increasing risk).
 * Real private probes remain gated; financial writes never included.
 *
 * Checkpoint read-only private probes (1–9) — definitions only until authorization:
 * 1 private_account  2 spot_open_orders  3 spot_my_trades
 * 4 wallet_currency_config  5 deposit_history  6 withdraw_history
 * 7 transfer_history  8 futures_assets  9 futures_open_positions
 *
 * SPOT_TRADE_TEST / Test New Order is EXCLUDED from this checkpoint.
 */

import { MEXC_CAPABILITY } from '../capabilityIds.js';

export const PROBE_RISK = Object.freeze({
  PUBLIC: 1,
  PRIVATE_READ: 2,
  TEST_ORDER: 3,
  WRITE: 99,
});

/** Memory-only fields — never written to Connection metadata */
export const MEMORY_ONLY_PROBE_FIELDS = Object.freeze([
  'balances',
  'positions',
  'orderDetails',
  'tradePayload',
  'address',
  'memo',
  'txId',
  'amount',
  'rawProviderBody',
  'completeCurrencyConfig',
]);

/** Safe metadata allowed in Connection capability state / verification history */
export const SAFE_PERSIST_FIELDS = Object.freeze([
  'lastVerifiedAt',
  'verificationState',
  'keyGrant',
  'lastFailureCode',
  'sanitizedReason',
  'latencyMs',
  'probeSafeSymbol',
  'countCategory',
  'providerAvailability',
]);

/** Approved fake/public + proposed read-only private probe definitions */
export const MEXC_PROBE_CATALOG = Object.freeze([
  {
    id: 'spot_ping',
    capabilityId: MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
    risk: PROBE_RISK.PUBLIC,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/ping',
    auth: 'none',
    timeoutMs: 5000,
    maxResponseBytes: 4096,
    persistFields: ['lastVerifiedAt', 'verificationState', 'latencyMs'],
    memoryOnlyFields: [],
  },
  {
    id: 'spot_time',
    capabilityId: MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
    risk: PROBE_RISK.PUBLIC,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/time',
    auth: 'none',
    timeoutMs: 5000,
    maxResponseBytes: 4096,
    persistFields: ['lastVerifiedAt', 'verificationState', 'latencyMs'],
    memoryOnlyFields: [],
  },
  {
    id: 'spot_exchange_info',
    capabilityId: MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC,
    risk: PROBE_RISK.PUBLIC,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/exchangeInfo',
    auth: 'none',
    timeoutMs: 8000,
    maxResponseBytes: 2_000_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'latencyMs', 'probeSafeSymbol'],
    memoryOnlyFields: ['rawProviderBody'],
    purpose: 'Public Spot exchange information + safe-symbol selection input',
  },
  {
    id: 'futures_ping',
    capabilityId: MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC,
    risk: PROBE_RISK.PUBLIC,
    method: 'GET',
    host: 'https://contract.mexc.com',
    path: '/api/v1/contract/ping',
    auth: 'none',
    timeoutMs: 5000,
    maxResponseBytes: 4096,
    persistFields: ['lastVerifiedAt', 'verificationState', 'latencyMs'],
    memoryOnlyFields: [],
  },
  // --- Checkpoint private probes 1–9 (gated; no real call until authorized) ---
  {
    id: 'private_account',
    checkpointOrder: 1,
    capabilityId: MEXC_CAPABILITY.PRIVATE_AUTH,
    alsoEvidenceFor: [MEXC_CAPABILITY.SPOT_ACCOUNT_READ],
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/account',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['timestamp', 'recvWindow'],
    officialPermission: 'SPOT_ACCOUNT_READ',
    purpose: 'Authenticate; verify SPOT_ACCOUNT_READ; collect safe capability evidence',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs'],
    memoryOnlyFields: ['balances', 'rawProviderBody'],
    doNotInferGranularPermissionsFrom: ['canTrade', 'canWithdraw', 'canDeposit'],
    requiresLiveGate: true,
  },
  {
    id: 'spot_open_orders',
    checkpointOrder: 2,
    capabilityId: MEXC_CAPABILITY.SPOT_ORDER_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/openOrders',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['symbol', 'timestamp', 'recvWindow'],
    symbolSource: 'selected_safe_public_symbol',
    officialPermission: 'SPOT_DEAL_READ',
    purpose: 'Verify open-orders read permission for selected safe symbol',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'countCategory', 'probeSafeSymbol'],
    memoryOnlyFields: ['orderDetails', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'spot_my_trades',
    checkpointOrder: 3,
    capabilityId: MEXC_CAPABILITY.SPOT_TRADE_HISTORY_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/myTrades',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['symbol', 'limit', 'timestamp', 'recvWindow'],
    fixedParams: { limit: 1 },
    symbolSource: 'selected_safe_public_symbol',
    officialPermission: 'SPOT_ACCOUNT_READ',
    purpose: 'Verify trade-history read; limit=1; no trade payload persistence',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'probeSafeSymbol'],
    memoryOnlyFields: ['tradePayload', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'wallet_currency_config',
    checkpointOrder: 4,
    capabilityId: MEXC_CAPABILITY.WALLET_CURRENCY_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/capital/config/getall',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['timestamp', 'recvWindow'],
    officialPermission: 'SPOT_WITHDRAW_READ',
    purpose: 'Wallet currency/network config availability evidence only',
    timeoutMs: 8000,
    maxResponseBytes: 1_000_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'providerAvailability'],
    memoryOnlyFields: ['completeCurrencyConfig', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'deposit_history',
    checkpointOrder: 5,
    capabilityId: MEXC_CAPABILITY.DEPOSIT_HISTORY_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/capital/deposit/hisrec',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['limit', 'timestamp', 'recvWindow'],
    fixedParams: { limit: 1 },
    boundedRecentWindow: true,
    officialPermission: 'SPOT_WITHDRAW_READ',
    purpose: 'Deposit history permission evidence; no address/memo/txId/amount persistence',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'countCategory'],
    memoryOnlyFields: ['address', 'memo', 'txId', 'amount', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'withdraw_history',
    checkpointOrder: 6,
    capabilityId: MEXC_CAPABILITY.WITHDRAWAL_HISTORY_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/capital/withdraw/history',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['limit', 'timestamp', 'recvWindow'],
    fixedParams: { limit: 1 },
    boundedRecentWindow: true,
    officialPermission: 'SPOT_WITHDRAW_READ',
    purpose: 'Withdrawal history permission evidence; no address/memo/txId/amount persistence',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'countCategory'],
    memoryOnlyFields: ['address', 'memo', 'txId', 'amount', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'transfer_history',
    checkpointOrder: 7,
    capabilityId: MEXC_CAPABILITY.TRANSFER_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://api.mexc.com',
    path: '/api/v3/capital/transfer',
    auth: 'spot_v3_hmac',
    headers: ['X-MEXC-APIKEY'],
    requiredParams: ['fromAccountType', 'toAccountType', 'page', 'size', 'timestamp', 'recvWindow'],
    fixedParams: {
      fromAccountType: 'SPOT',
      toAccountType: 'FUTURES',
      page: 1,
      size: 1,
    },
    officialPermission: 'SPOT_TRANSFER_READ',
    purpose: 'Transfer history permission; successful empty response is sufficient; never execute transfer',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'countCategory'],
    memoryOnlyFields: ['rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'futures_assets',
    checkpointOrder: 8,
    capabilityId: MEXC_CAPABILITY.FUTURES_ACCOUNT_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://contract.mexc.com',
    path: '/api/v1/private/account/assets',
    auth: 'futures_contract_signature',
    headers: ['ApiKey', 'Request-Time', 'Signature', 'Content-Type'],
    requiredParams: [],
    officialPermission: 'Trade reading permission',
    purpose: 'Futures assets read via Futures-specific signer; do not persist balances',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs'],
    memoryOnlyFields: ['balances', 'rawProviderBody'],
    requiresLiveGate: true,
  },
  {
    id: 'futures_open_positions',
    checkpointOrder: 9,
    capabilityId: MEXC_CAPABILITY.FUTURES_POSITION_READ,
    risk: PROBE_RISK.PRIVATE_READ,
    method: 'GET',
    host: 'https://contract.mexc.com',
    path: '/api/v1/private/position/open_positions',
    auth: 'futures_contract_signature',
    headers: ['ApiKey', 'Request-Time', 'Signature', 'Content-Type'],
    requiredParams: [],
    officialPermission: 'Trade reading permission',
    purpose: 'Futures open positions via Futures-specific signer; do not persist position details',
    timeoutMs: 8000,
    maxResponseBytes: 256_000,
    persistFields: ['lastVerifiedAt', 'verificationState', 'keyGrant', 'lastFailureCode', 'sanitizedReason', 'latencyMs', 'countCategory'],
    memoryOnlyFields: ['positions', 'rawProviderBody'],
    requiresLiveGate: true,
  },
]);

/** Explicitly excluded from orchestrator forever in this program without separate approval */
export const FORBIDDEN_PROBES = Object.freeze([
  { path: '/api/v3/order/test', method: 'POST', reason: 'Test New Order — excluded from read-only checkpoint' },
  { path: '/api/v3/order', method: 'POST', reason: 'Real spot New Order' },
  { path: '/api/v3/order', method: 'DELETE', reason: 'Order Cancel' },
  { path: '/api/v3/capital/deposit/address', method: 'POST', reason: 'Deposit Address Generate' },
  { path: '/api/v3/capital/withdraw', method: 'POST', reason: 'Withdrawal execute' },
  { path: '/api/v3/capital/withdraw', method: 'DELETE', reason: 'Withdrawal Cancel' },
  { path: '/api/v3/capital/transfer', method: 'POST', reason: 'Transfer Execute' },
  { path: '/api/v3/capital/sub-account/universalTransfer', method: 'POST', reason: 'Internal Transfer Execute' },
  { path: '/api/v3/capital/convert/dust', method: 'POST', reason: 'Dust Execute' },
  { path: '/api/v1/private/order/submit', reason: 'Futures order' },
  { path: '/api/v1/private/position/change_margin', reason: 'Position setting changes' },
  { path: '/api/v1/private/account/change', reason: 'Account edits' },
  { path: 'p2p', reason: 'P2P actions' },
]);

/** Nine authorized checkpoint private probes (definitions only) */
export function getCheckpointReadOnlyProbes() {
  return MEXC_PROBE_CATALOG
    .filter((p) => p.checkpointOrder != null)
    .sort((a, b) => a.checkpointOrder - b.checkpointOrder);
}

export function listProbesByRisk(maxRisk = PROBE_RISK.PUBLIC) {
  return MEXC_PROBE_CATALOG.filter((p) => p.risk <= maxRisk);
}

export function getProposedRealReadOnlyProbes() {
  return MEXC_PROBE_CATALOG.filter((p) => p.requiresLiveGate);
}

/**
 * Build Spot private query params for a probe (deterministic; no live call).
 */
export function buildSpotProbeQueryParams(probe, { timestamp, recvWindow, safeSymbol } = {}) {
  const params = { ...(probe.fixedParams || {}) };
  if (probe.symbolSource === 'selected_safe_public_symbol') {
    if (!safeSymbol) {
      throw new Error(`Probe ${probe.id} requires selected safe public symbol`);
    }
    params.symbol = safeSymbol;
  }
  params.timestamp = timestamp;
  params.recvWindow = recvWindow;
  for (const req of probe.requiredParams || []) {
    if (params[req] == null || params[req] === '') {
      throw new Error(`Probe ${probe.id} missing required param: ${req}`);
    }
  }
  return params;
}
