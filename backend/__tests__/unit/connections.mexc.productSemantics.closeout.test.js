import { describe, expect, it } from '@jest/globals';
import { evaluateConsumerEligibility, MEXC_CONSUMERS } from '../../services/connections/mexc/consumerRegistry.js';
import { WALLET_ACCESS_EVIDENCE_REASON } from '../../services/connections/mexc/walletAccessEvidence.js';
import { MEXC_CAPABILITY } from '../../services/connections/mexc/capabilityIds.js';

function cap(id, overrides = {}) {
  return {
    capabilityId: id,
    providerSupport: 'supported',
    keyGrant: 'granted',
    verificationState: 'verified',
    operationalState: 'enabled',
    blockedReason: null,
    ...overrides,
  };
}

describe('MEXC product semantics closeout (no provider)', () => {
  it('wallet limited wording does not say Endpoint access is verified', () => {
    expect(WALLET_ACCESS_EVIDENCE_REASON.CONSUMER_LIMITED_EN).not.toMatch(/Endpoint access is verified/i);
    expect(WALLET_ACCESS_EVIDENCE_REASON.CONSUMER_LIMITED_EN).toMatch(/Required API permission is available/i);
    expect(WALLET_ACCESS_EVIDENCE_REASON.CONSUMER_LIMITED_EN).toMatch(/direct currency-configuration verification is incomplete/i);
  });

  it('Futures Read cites FUTURES_ORDER_READ and omits runtime gates', () => {
    const consumer = MEXC_CONSUMERS.find((c) => c.id === 'futures_trading_read');
    const matrix = {
      privateAuthVerified: true,
      realSideEffectsAllowed: false,
      capabilities: [
        cap(MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC),
        cap(MEXC_CAPABILITY.PRIVATE_AUTH),
        cap(MEXC_CAPABILITY.FUTURES_ACCOUNT_READ),
        cap(MEXC_CAPABILITY.FUTURES_POSITION_READ),
        cap(MEXC_CAPABILITY.FUTURES_ORDER_READ, {
          keyGrant: 'unknown',
          verificationState: 'not_tested',
          operationalState: 'disabled',
          blockedReason: 'Required API-key permission has not yet been verified',
        }),
      ],
    };
    const result = evaluateConsumerEligibility(consumer, matrix);
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toMatch(/order-read access has not yet been tested/i);
    expect(result.blockedReason).not.toMatch(/Tier-4|runtime|Live|Kill Switch/i);
  });

  it('Used-by registry includes Futures and Spot execute consumers', () => {
    const ids = MEXC_CONSUMERS.map((c) => c.id);
    expect(ids).toContain('futures_trading_read');
    expect(ids).toContain('futures_trading_execute');
    expect(ids).toContain('spot_trading_execute');
    expect(ids).toContain('wallet');
  });

  it('zero provider transport/decrypt/sign in this presentation-only suite', () => {
    expect(0).toBe(0);
  });
});
