import { describe, expect, it } from 'vitest';
import {
  classifyCapabilityReason,
  formatUsedBySummary,
  selectCapabilityProductReason,
  selectConsumerProductReason,
  selectGroupProductReason,
  translateReasonKind,
} from '../../utils/mexcReasonPriority.ts';
import { getConsumerLabel } from '../../utils/mexcDisplayLabels.ts';
import en from '../../deploy/blue/locales/en.json';
import fa from '../../deploy/blue/locales/fa.json';

const tEn = (k: string) => (en as Record<string, string>)[k] || k;
const tFa = (k: string) => (fa as Record<string, string>)[k] || k;

describe('MEXC final product semantics', () => {
  it('auth verified + not_tested → not_tested / key permission unverified', () => {
    const kind = selectCapabilityProductReason({
      capabilityId: 'DEPOSIT_ADDRESS_READ',
      providerSupport: 'supported',
      keyGrant: 'unknown',
      verificationState: 'not_tested',
      operationalState: 'disabled',
      blockedReason: 'Required API-key permission has not yet been verified',
      privateAuthVerified: true,
    });
    expect(['not_tested', 'key_permission_unverified']).toContain(kind);
    expect(kind).not.toBe('auth_pending');
  });

  it('auth unverified + not_tested → auth_pending', () => {
    expect(selectCapabilityProductReason({
      capabilityId: 'SPOT_ORDER_READ',
      keyGrant: 'unknown',
      verificationState: 'not_tested',
      operationalState: 'disabled',
      blockedReason: 'Private authentication has not been verified',
      privateAuthVerified: false,
    })).toBe('auth_pending');
  });

  it('explicit permission denied', () => {
    expect(classifyCapabilityReason({
      keyGrant: 'denied',
      verificationState: 'failed',
      operationalState: 'blocked_by_permission',
      blockedReason: 'API key permission denied',
      privateAuthVerified: true,
    })).toBe('key_denied');
  });

  it('endpoint verification error without grant', () => {
    expect(selectCapabilityProductReason({
      capabilityId: 'WALLET_CURRENCY_READ',
      keyGrant: 'unknown',
      verificationState: 'verification_error',
      operationalState: 'disabled',
      blockedReason: 'Verification could not be completed safely',
      privateAuthVerified: true,
    })).toBe('wallet_verification_incomplete');
  });

  it('shared permission granted + endpoint verification error', () => {
    expect(selectCapabilityProductReason({
      capabilityId: 'WALLET_CURRENCY_READ',
      keyGrant: 'granted',
      verificationState: 'verification_error',
      operationalState: 'disabled',
      directEndpointVerified: false,
      dataContractState: 'warning',
      privateAuthVerified: true,
    })).toBe('wallet_permission_available_incomplete');
  });

  it('wallet consumer limited reason does not claim endpoint access verified', () => {
    const kind = selectConsumerProductReason({
      consumerId: 'wallet',
      eligible: true,
      consumerReadiness: 'limited',
      limitedByDataContract: true,
      blockedReason: 'Required API permission is available, but direct currency-configuration verification is incomplete.',
    });
    expect(kind).toBe('wallet_consumer_limited');
    const enText = translateReasonKind(kind, tEn);
    const faText = translateReasonKind(kind, tFa);
    expect(enText).not.toMatch(/Endpoint access is verified/i);
    expect(faText).not.toMatch(/دسترسی API تأیید شده/);
    expect(enText).toMatch(/Required API permission is available/i);
    expect(enText).toMatch(/direct currency-configuration verification remains incomplete/i);
    expect(faText).toMatch(/مجوز موردنیاز API در دسترس است/);
  });

  it('Spot group cites explicit authorization for SPOT_TRADE_TEST', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'SPOT_ACCOUNT_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
        keyGrant: 'granted',
      },
      {
        capabilityId: 'SPOT_TRADE_TEST',
        verificationState: 'deferred_private_non_executing_probe',
        operationalState: 'disabled_pending_explicit_authorization',
        keyGrant: 'unknown',
        privateAuthVerified: true,
      },
      {
        capabilityId: 'SPOT_TRADE_EXECUTE',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_runtime',
        blockedReason: 'Tier-4 runtime gates',
        privateAuthVerified: true,
      },
    ]);
    expect(kind).toBe('spot_trade_test_authorization');
    expect(translateReasonKind(kind!, tEn)).toMatch(/separate explicit authorization/i);
    expect(translateReasonKind(kind!, tFa)).toMatch(/مجوز صریح جداگانه/);
  });

  it('Futures group prefers pending FUTURES_ORDER_READ over provider-unavailable execute', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'FUTURES_ORDER_READ',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        keyGrant: 'unknown',
        privateAuthVerified: true,
      },
      {
        capabilityId: 'FUTURES_TRADE_EXECUTE',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_provider',
        providerSupport: 'maintenance',
        blockedReason: 'Temporarily unavailable from the provider',
      },
    ]);
    expect(kind).toBe('futures_order_read_pending');
  });

  it('Futures group cites FUTURES_ORDER_READ when not tested', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'FUTURES_ACCOUNT_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
        keyGrant: 'granted',
      },
      {
        capabilityId: 'FUTURES_POSITION_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
        keyGrant: 'granted',
      },
      {
        capabilityId: 'FUTURES_ORDER_READ',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        keyGrant: 'unknown',
        privateAuthVerified: true,
        blockedReason: 'Required API-key permission has not yet been verified',
      },
      {
        capabilityId: 'FUTURES_TRADE_EXECUTE',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_runtime',
        blockedReason: 'Tier-4 runtime gates',
      },
    ]);
    expect(kind).toBe('futures_order_read_pending');
    expect(translateReasonKind(kind!, tEn)).toMatch(/order-read access has not yet been tested/i);
    expect(translateReasonKind(kind!, tFa)).not.toMatch(/توقف اضطراری|Live|اجرا/);
  });

  it('Futures Read consumer cites order-read and omits runtime gates', () => {
    const caps = {
      FUTURES_ACCOUNT_READ: {
        capabilityId: 'FUTURES_ACCOUNT_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
      },
      FUTURES_POSITION_READ: {
        capabilityId: 'FUTURES_POSITION_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
      },
      FUTURES_ORDER_READ: {
        capabilityId: 'FUTURES_ORDER_READ',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        keyGrant: 'unknown',
        privateAuthVerified: true,
      },
    };
    const kind = selectConsumerProductReason({
      consumerId: 'futures_trading_read',
      displayName: 'Futures Trading (read)',
      eligible: false,
      sideEffectClass: 'read_only',
      requiredCapabilities: [
        'MARKET_DATA_FUTURES_PUBLIC',
        'PRIVATE_AUTH',
        'FUTURES_ACCOUNT_READ',
        'FUTURES_POSITION_READ',
        'FUTURES_ORDER_READ',
      ],
      blockedReason: 'Account and position access are verified; order-read access has not yet been tested.',
    }, caps);
    expect(kind).toBe('futures_read_partial');
    const enText = translateReasonKind(kind, tEn);
    expect(enText).toMatch(/order-read access has not yet been tested/i);
    expect(enText).not.toMatch(/Live|Kill Switch|runtime|Financial execution/i);
    expect(translateReasonKind(kind, tFa)).not.toMatch(/توقف اضطراری|اجرای مالی/);
  });

  it('group reason derives from actual unresolved capability (Transfers)', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'TRANSFER_READ',
        verificationState: 'verified',
        operationalState: 'enabled',
        keyGrant: 'granted',
      },
      {
        capabilityId: 'INTERNAL_TRANSFER_READ',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        keyGrant: 'unknown',
        privateAuthVerified: true,
        blockedReason: 'Required API-key permission has not yet been verified',
      },
      {
        capabilityId: 'TRANSFER_EXECUTE',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_runtime',
        blockedReason: 'Tier-4 runtime gates',
      },
    ]);
    expect(kind).toBe('internal_transfer_read_pending');
    expect(kind).not.toBe('auth_pending');
    expect(kind).not.toBe('runtime_tier4');
    expect(translateReasonKind(kind!, tEn)).toMatch(/Internal-transfer read access has not yet been tested/i);
    expect(translateReasonKind(kind!, tFa)).toMatch(/انتقال‌های داخلی/);
  });

  it('Wallet group prefers currency-config incomplete over sibling key-permission unverified', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'WALLET_CURRENCY_READ',
        keyGrant: 'granted',
        verificationState: 'verification_error',
        operationalState: 'disabled',
        directEndpointVerified: false,
        dataContractState: 'warning',
        privateAuthVerified: true,
      },
      {
        capabilityId: 'DEPOSIT_ADDRESS_READ',
        keyGrant: 'unknown',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        privateAuthVerified: true,
        blockedReason: 'Required API-key permission has not yet been verified',
      },
      {
        capabilityId: 'WITHDRAWAL_EXECUTE',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_runtime',
        blockedReason: 'Tier-4 runtime gates',
      },
    ]);
    expect(kind).toBe('wallet_permission_available_incomplete');
    expect(translateReasonKind(kind!, tEn)).toMatch(/Required API permission is available/i);
    expect(translateReasonKind(kind!, tEn)).not.toMatch(/API-key permission has not yet been verified/i);
    expect(translateReasonKind(kind!, tFa)).toMatch(/مجوز موردنیاز API در دسترس است/);
  });

  it('Account group cites SUBACCOUNT_READ pending', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'PRIVATE_AUTH',
        verificationState: 'verified',
        operationalState: 'enabled',
        keyGrant: 'granted',
      },
      {
        capabilityId: 'SUBACCOUNT_READ',
        verificationState: 'not_tested',
        operationalState: 'disabled',
        keyGrant: 'unknown',
        privateAuthVerified: true,
        blockedReason: 'Required API-key permission has not yet been verified',
      },
      {
        capabilityId: 'ACCOUNT_EDIT',
        providerSupport: 'unknown',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_provider_evidence',
        blockedReason: 'PROVIDER SUPPORT NOT VERIFIED',
      },
    ]);
    expect(kind).toBe('subaccount_read_pending');
    expect(translateReasonKind(kind!, tEn)).toMatch(/Sub-account read access has not yet been tested/i);
    expect(translateReasonKind(kind!, tFa)).toMatch(/حساب‌های فرعی/);
  });

  it('P2P group keeps provider support unverified', () => {
    const kind = selectGroupProductReason([
      {
        capabilityId: 'P2P_READ',
        providerSupport: 'unknown',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_provider_evidence',
        blockedReason: 'PROVIDER SUPPORT NOT VERIFIED',
      },
      {
        capabilityId: 'P2P_EXECUTE',
        providerSupport: 'unknown',
        verificationState: 'not_safely_testable',
        operationalState: 'blocked_by_provider_evidence',
        blockedReason: 'PROVIDER SUPPORT NOT VERIFIED',
      },
    ]);
    expect(kind).toBe('provider_unknown');
    expect(translateReasonKind(kind!, tEn)).toMatch(/Official provider API support has not been verified/i);
  });

  it('Used-by summary follows canonical consumer registry labels and collapses', () => {
    const consumers = [
      { consumerId: 'portfolio', displayName: 'Portfolio' },
      { consumerId: 'arbitrage', displayName: 'Arbitrage' },
      { consumerId: 'market_data_agents', displayName: 'Market Data Agents' },
      { consumerId: 'spot_trading_read', displayName: 'Spot Trading (read)' },
      { consumerId: 'spot_trading_execute', displayName: 'Spot Trading (execute)' },
      { consumerId: 'futures_trading_read', displayName: 'Futures Trading (read)' },
      { consumerId: 'futures_trading_execute', displayName: 'Futures Trading (execute)' },
      { consumerId: 'wallet', displayName: 'Wallet' },
      { consumerId: 'wallet_withdrawal_execute', displayName: 'Wallet · Withdrawal execute' },
      { consumerId: 'risk_agents', displayName: 'Risk' },
    ];
    const summary = formatUsedBySummary(consumers, tEn, getConsumerLabel, 8);
    expect(summary.total).toBe(10);
    expect(summary.text).toMatch(/\+2 more/);
    expect(summary.text).toMatch(/Futures/);
    expect(summary.text).toMatch(/Spot/);
    expect(summary.labelKey).toBe('mexc_used_by');
  });

  it('EN/FA wallet permission copy has semantic parity', () => {
    expect(tEn('mexc_reason_wallet_consumer_limited')).toMatch(/permission is available/i);
    expect(tFa('mexc_reason_wallet_consumer_limited')).toMatch(/مجوز موردنیاز API در دسترس است/);
    expect(tEn('mexc_currency_verification_attempt_incomplete')).toMatch(/incomplete/i);
    expect(tFa('mexc_currency_verification_attempt_incomplete')).toMatch(/کامل نشد/);
    expect(tEn('mexc_reason_wallet_consumer_limited')).not.toMatch(/Endpoint access is verified/i);
    expect(tFa('mexc_reason_wallet_consumer_limited')).not.toMatch(/دسترسی API تأیید شده/);
  });

  it('raw failure codes are not present in normal-mode product copy keys', () => {
    for (const key of [
      'mexc_reason_wallet_consumer_limited',
      'mexc_currency_verification_attempt_incomplete',
      'mexc_reason_wallet_permission_available_incomplete',
      'mexc_wallet_structures_unsupported',
    ]) {
      expect(tEn(key)).not.toMatch(/MEXC_RESPONSE_COMPRESSED_TOO_LARGE|MEXC_WALLET_NETWORK_ITEM_INVALID/);
      expect(tFa(key)).not.toMatch(/MEXC_RESPONSE_COMPRESSED_TOO_LARGE|MEXC_WALLET_NETWORK_ITEM_INVALID/);
      expect(tEn(key)).not.toMatch(/verification_error|blocked_by_runtime/);
    }
  });
});
