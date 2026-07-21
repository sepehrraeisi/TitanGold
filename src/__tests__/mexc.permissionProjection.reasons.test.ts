import { describe, expect, it } from 'vitest';
import {
  classifyCapabilityReason,
  selectCapabilityProductReason,
  selectConsumerProductReason,
} from '../../utils/mexcReasonPriority.ts';

describe('MEXC permission projection reason selection', () => {
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

  it('wallet consumer limited reason', () => {
    expect(selectConsumerProductReason({
      eligible: true,
      consumerReadiness: 'limited',
      limitedByDataContract: true,
      blockedReason: 'Endpoint access is verified, but some provider records are not yet supported',
    })).toBe('wallet_consumer_limited');
  });
});
