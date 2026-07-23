/**
 * Canonical MEXC client ownership enforcement (MEXC-E2E remediation).
 * Private credentials may only be decrypted inside exchangeConnectionService.
 * Legacy mexc.js / ccxt must not execute Tier-4 or bypass the Capability Matrix.
 */

export const MEXC_CLIENT_OWNER = Object.freeze({
  CANONICAL_CONNECTION: 'exchangeConnectionService + connections/mexc/*',
  PUBLIC_MARKET_PROXY: 'routes/market-proxy.js',
  LEGACY_CCXT: 'services/mexc.js (public-only after remediation)',
});

export const MEXC_PATH_CLASS = Object.freeze({
  PUBLIC_ONLY: 'PUBLIC_ONLY',
  CANONICAL_PRIVATE: 'CANONICAL_PRIVATE',
  LEGACY_PRIVATE: 'LEGACY_PRIVATE',
  UNUSED: 'UNUSED',
  UNSAFE: 'UNSAFE',
});

export class MexcCanonicalGateError extends Error {
  constructor(code, message, httpStatus = 403) {
    super(message);
    this.name = 'MexcCanonicalGateError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const TIER4_OPERATIONS = Object.freeze([
  'createOrder',
  'createSystemOrder',
  'cancelOrder',
  'withdraw',
  'transfer',
  'internalTransfer',
  'dustConvert',
  'depositAddressGenerate',
  'futuresOrderSubmit',
  'futuresPositionSettingsWrite',
]);

export function assertTier4Impossible(operation) {
  throw new MexcCanonicalGateError(
    'MEXC_TIER4_BLOCKED',
    `Tier-4 operation "${operation}" is blocked. Use the canonical Connections capability owner; Live side effects are impossible in this slice.`,
    403,
  );
}

export function assertNoLegacyPrivateBypass(operation) {
  throw new MexcCanonicalGateError(
    'MEXC_LEGACY_PRIVATE_BLOCKED',
    `Legacy private path "${operation}" is fail-closed. Private Spot/Futures reads must use the canonical MEXC Connection owner and Capability Matrix.`,
    403,
  );
}

export const MEXC_CONSUMER_PATH_MAP = Object.freeze([
  { path: 'backend/routes/market-proxy.js', class: MEXC_PATH_CLASS.PUBLIC_ONLY, notes: 'Arbitrage + public market' },
  { path: 'backend/services/agents/arbitrage.js', class: MEXC_PATH_CLASS.PUBLIC_ONLY, notes: 'Uses market proxy' },
  { path: 'backend/services/connections/*', class: MEXC_PATH_CLASS.CANONICAL_PRIVATE, notes: 'SoT owner' },
  { path: 'backend/services/exchangeConnectionService.js', class: MEXC_PATH_CLASS.CANONICAL_PRIVATE, notes: 'Credential decrypt owner' },
  { path: 'backend/services/mexc.js#public', class: MEXC_PATH_CLASS.PUBLIC_ONLY, notes: 'ccxt without credentials after remediation' },
  { path: 'backend/services/mexc.js#private', class: MEXC_PATH_CLASS.LEGACY_PRIVATE, notes: 'Fail-closed; no Tier-4' },
  { path: 'backend/services/orderExecutor.js', class: MEXC_PATH_CLASS.UNSAFE, notes: 'Fail-closed at mexc.createOrder' },
  { path: 'backend/services/manualTrading.js', class: MEXC_PATH_CLASS.UNSAFE, notes: 'Fail-closed at mexc.createOrder' },
  { path: 'backend/engine/tradingEngine.js', class: MEXC_PATH_CLASS.UNSAFE, notes: 'Fail-closed at createSystemOrder' },
  { path: 'backend/routes/wallet.js#getBalance', class: MEXC_PATH_CLASS.LEGACY_PRIVATE, notes: 'Fail-closed; use Connections capability' },
  { path: 'backend/services/agents/* OHLCV', class: MEXC_PATH_CLASS.PUBLIC_ONLY, notes: 'Must use public ccxt path' },
  { path: 'env MEXC_ACCESS_KEY/MEXC_SECRET_KEY private inject', class: MEXC_PATH_CLASS.UNSAFE, notes: 'Removed from public/private legacy paths' },
  { path: 'direct api.mexc.com private', class: MEXC_PATH_CLASS.CANONICAL_PRIVATE, notes: 'Only via connections adapters' },
  { path: 'direct contract.mexc.com private', class: MEXC_PATH_CLASS.CANONICAL_PRIVATE, notes: 'Only via Futures adapter' },
]);
