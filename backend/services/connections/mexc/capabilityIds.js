/**
 * Canonical MEXC capability identifiers — single owner for Connections,
 * Wallet, Agents, Portfolio, Spot Trading, Futures Trading.
 */

export const MEXC_CAPABILITY = Object.freeze({
  MARKET_DATA_SPOT_PUBLIC: 'MARKET_DATA_SPOT_PUBLIC',
  MARKET_DATA_FUTURES_PUBLIC: 'MARKET_DATA_FUTURES_PUBLIC',
  PRIVATE_AUTH: 'PRIVATE_AUTH',
  SPOT_ACCOUNT_READ: 'SPOT_ACCOUNT_READ',
  SPOT_ORDER_READ: 'SPOT_ORDER_READ',
  SPOT_TRADE_HISTORY_READ: 'SPOT_TRADE_HISTORY_READ',
  SPOT_TRADE_TEST: 'SPOT_TRADE_TEST',
  SPOT_TRADE_EXECUTE: 'SPOT_TRADE_EXECUTE',
  SPOT_ORDER_CANCEL: 'SPOT_ORDER_CANCEL',
  FUTURES_ACCOUNT_READ: 'FUTURES_ACCOUNT_READ',
  FUTURES_POSITION_READ: 'FUTURES_POSITION_READ',
  FUTURES_ORDER_READ: 'FUTURES_ORDER_READ',
  FUTURES_TRADE_EXECUTE: 'FUTURES_TRADE_EXECUTE',
  FUTURES_ORDER_CANCEL: 'FUTURES_ORDER_CANCEL',
  FUTURES_POSITION_SETTINGS_WRITE: 'FUTURES_POSITION_SETTINGS_WRITE',
  WALLET_CURRENCY_READ: 'WALLET_CURRENCY_READ',
  DEPOSIT_ADDRESS_READ: 'DEPOSIT_ADDRESS_READ',
  DEPOSIT_ADDRESS_GENERATE: 'DEPOSIT_ADDRESS_GENERATE',
  DEPOSIT_HISTORY_READ: 'DEPOSIT_HISTORY_READ',
  WITHDRAWAL_ADDRESS_READ: 'WITHDRAWAL_ADDRESS_READ',
  WITHDRAWAL_HISTORY_READ: 'WITHDRAWAL_HISTORY_READ',
  WITHDRAWAL_EXECUTE: 'WITHDRAWAL_EXECUTE',
  WITHDRAWAL_CANCEL: 'WITHDRAWAL_CANCEL',
  TRANSFER_READ: 'TRANSFER_READ',
  TRANSFER_EXECUTE: 'TRANSFER_EXECUTE',
  INTERNAL_TRANSFER_READ: 'INTERNAL_TRANSFER_READ',
  INTERNAL_TRANSFER_EXECUTE: 'INTERNAL_TRANSFER_EXECUTE',
  DUST_READ: 'DUST_READ',
  DUST_EXECUTE: 'DUST_EXECUTE',
  SUBACCOUNT_READ: 'SUBACCOUNT_READ',
  SUBACCOUNT_MANAGE: 'SUBACCOUNT_MANAGE',
  P2P_READ: 'P2P_READ',
  P2P_EXECUTE: 'P2P_EXECUTE',
  ACCOUNT_EDIT: 'ACCOUNT_EDIT',
});

export const MEXC_CAPABILITY_IDS = Object.freeze(Object.values(MEXC_CAPABILITY));

export const CAPABILITY_GROUP = Object.freeze({
  MARKET_DATA: 'Market Data',
  SPOT: 'Spot',
  FUTURES: 'Futures',
  WALLET: 'Wallet',
  TRANSFERS: 'Transfers',
  P2P: 'P2P',
  ACCOUNT: 'Account',
  CONSUMERS: 'Consumers',
});

export const PROVIDER_SUPPORT = Object.freeze({
  SUPPORTED: 'supported',
  UNSUPPORTED: 'unsupported',
  UNKNOWN: 'unknown',
  MAINTENANCE: 'maintenance',
});

export const KEY_GRANT = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
});

export const VERIFICATION_STATE = Object.freeze({
  VERIFIED: 'verified',
  FAILED: 'failed',
  NOT_TESTED: 'not_tested',
  NOT_SAFELY_TESTABLE: 'not_safely_testable',
});

export const OPERATIONAL_STATE = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  BLOCKED_BY_RUNTIME: 'blocked_by_runtime',
  BLOCKED_BY_USER: 'blocked_by_user',
  BLOCKED_BY_PERMISSION: 'blocked_by_permission',
  BLOCKED_BY_PROVIDER: 'blocked_by_provider',
});

export const AUTH_STATE = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED_UNVERIFIED: 'configured_unverified',
  AUTHENTICATION_PENDING: 'authentication_pending',
  AUTHENTICATED: 'authenticated',
  FAILED: 'failed',
  REVOKED: 'revoked',
  SECRET_REENTRY_REQUIRED: 'secret_reentry_required',
});

export const PROVIDER_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  MAINTENANCE: 'maintenance',
  UNAVAILABLE: 'unavailable',
  REGION_RESTRICTED: 'region_restricted',
  ACCOUNT_RESTRICTED: 'account_restricted',
});

export const SIDE_EFFECT = Object.freeze({
  NONE: 'none',
  READ_ONLY: 'read_only',
  FINANCIAL_WRITE: 'financial_write',
  ACCOUNT_MUTATION: 'account_mutation',
});

export const RW_CLASS = Object.freeze({
  PUBLIC: 'public',
  PRIVATE_READ: 'private_read',
  PRIVATE_WRITE: 'private_write',
});
