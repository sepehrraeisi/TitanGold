/**
 * CONNECTIONS product final polish — presentation, group reasons, a11y source guards.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectGroupProductReason,
  translateReasonKind,
} from '../../utils/mexcReasonPriority.ts';
import {
  credentialStatusProductLabel,
  summarizePrimaryConsumers,
  PRIMARY_CONSUMER_IDS,
} from '../../components/settings/connections/mexcPanelShared.tsx';
import { connectionStatusMessageKey } from '../../services/connectionDisplayStatus.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const locale = (lang: 'en' | 'fa') => JSON.parse(read(`deploy/blue/locales/${lang}.json`)) as Record<string, string>;
const tEn = (k: string, opts?: Record<string, string | number>) => {
  let s = locale('en')[k] || k;
  if (opts) {
    for (const [ok, ov] of Object.entries(opts)) s = s.replace(new RegExp(`\\{${ok}\\}`, 'g'), String(ov));
  }
  return s;
};
const tFa = (k: string) => locale('fa')[k] || k;

describe('Connections polish — placeholders and credentials', () => {
  it('future-provider status key is not_available_yet once', () => {
    expect(connectionStatusMessageKey('not_available_yet')).toBe('connections_not_available_yet');
    const list = read('components/settings/MultiExchangeSettings.tsx');
    expect(list).toMatch(/connection-unavailable/);
    // subtitle status only for MEXC
    expect(list).toMatch(/!expanded && isMexc/);
    expect(list).not.toMatch(/Coming soon/);
  });

  it('credential status never renders raw authenticated enum', () => {
    expect(credentialStatusProductLabel('authenticated', true, tEn)).toBe('Authenticated');
    expect(credentialStatusProductLabel('authenticated', true, tFa)).toMatch(/احراز هویت/);
    expect(credentialStatusProductLabel('authenticated', true, tEn)).not.toBe('authenticated');
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/mexc-credential-status-row/);
    expect(panel).toMatch(/credentialStatusProductLabel/);
    expect(panel).not.toMatch(/\{connection\.credentialStatus \|\| connection\.status/);
  });

  it('Test Connection is absent from Credentials and locked in Overview only', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    const credStart = panel.indexOf("activeSection === 'credentials'");
    const capStart = panel.indexOf("activeSection === 'capabilities'");
    const credBlock = panel.slice(credStart, capStart);
    expect(credBlock).not.toMatch(/mexc-test-connection-disabled/);
    expect(credBlock).not.toMatch(/mexc_test_connection/);
    expect(panel).toMatch(/mexc-verification-locked/);
    expect(panel).toMatch(/mexc_verification_locked_title/);
    expect(panel).not.toMatch(/mexc-test-connection-disabled/);
  });
});

describe('Connections polish — Overview consumers and history', () => {
  it('primary consumer summary matches canonical registry counts', () => {
    const summary = summarizePrimaryConsumers([
      { consumerId: 'portfolio', eligible: true },
      { consumerId: 'arbitrage', eligible: true },
      { consumerId: 'market_data_agents', eligible: true },
      { consumerId: 'spot_trading_read', eligible: true },
      { consumerId: 'spot_trading_execute', eligible: false, sideEffectClass: 'financial_write' },
      { consumerId: 'futures_trading_read', eligible: false, sideEffectClass: 'read_only' },
      { consumerId: 'futures_trading_execute', eligible: false, sideEffectClass: 'financial_write' },
      { consumerId: 'wallet', eligible: true, consumerReadiness: 'limited' },
      { consumerId: 'wallet_withdrawal_execute', eligible: false, sideEffectClass: 'financial_write' },
      { consumerId: 'wallet_transfer_execute', eligible: false, sideEffectClass: 'financial_write' },
      { consumerId: 'risk_agents', eligible: true },
      { consumerId: 'wallet_deposit_address', eligible: false }, // not in primary registry
    ]);
    expect(PRIMARY_CONSUMER_IDS).toHaveLength(11);
    expect(summary).toEqual({ registered: 11, eligible: 5, limited: 2, blocked: 4 });
    expect(tEn('mexc_overview_consumers_summary', summary)).toBe(
      '11 registered · 5 eligible · 2 limited · 4 blocked',
    );
  });

  it('View consumers navigation target is encoded in panel source', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/mexc-view-consumers/);
    expect(panel).toMatch(/navigateSection\('consumers'\)/);
    expect(panel).not.toMatch(/mexc-used-by/);
  });

  it('History current-state summary keys exist and history list remains separate', () => {
    expect(tEn('mexc_history_current_wallet_title')).toMatch(/Current Wallet state/i);
    expect(tEn('mexc_history_current_wallet_summary')).toMatch(/Permission available/i);
    expect(tFa('mexc_history_current_wallet_title')).toMatch(/وضعیت فعلی کیف پول/);
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/mexc-history-current-wallet/);
    expect(panel).toMatch(/mexc-history-list/);
  });
});

describe('Connections polish — group reasons and a11y', () => {
  it('Wallet / Transfers / Account / P2P group reasons', () => {
    expect(
      selectGroupProductReason([
        {
          capabilityId: 'WALLET_CURRENCY_READ',
          keyGrant: 'granted',
          verificationState: 'verification_error',
          operationalState: 'disabled',
          directEndpointVerified: false,
          dataContractState: 'warning',
        },
        {
          capabilityId: 'DEPOSIT_ADDRESS_READ',
          keyGrant: 'unknown',
          verificationState: 'not_tested',
          operationalState: 'disabled',
          privateAuthVerified: true,
        },
      ]),
    ).toBe('wallet_permission_available_incomplete');

    expect(
      selectGroupProductReason([
        { capabilityId: 'TRANSFER_READ', verificationState: 'verified', operationalState: 'enabled' },
        {
          capabilityId: 'INTERNAL_TRANSFER_READ',
          verificationState: 'not_tested',
          operationalState: 'disabled',
          keyGrant: 'unknown',
          privateAuthVerified: true,
        },
      ]),
    ).toBe('internal_transfer_read_pending');

    expect(
      selectGroupProductReason([
        {
          capabilityId: 'SUBACCOUNT_READ',
          verificationState: 'not_tested',
          operationalState: 'disabled',
          keyGrant: 'unknown',
          privateAuthVerified: true,
        },
      ]),
    ).toBe('subaccount_read_pending');

    expect(
      selectGroupProductReason([
        {
          capabilityId: 'P2P_READ',
          providerSupport: 'unknown',
          operationalState: 'blocked_by_provider_evidence',
        },
      ]),
    ).toBe('provider_unknown');
  });

  it('section nav exposes ARIA tab semantics', () => {
    const shared = read('components/settings/connections/mexcPanelShared.tsx');
    expect(shared).toMatch(/role="tablist"/);
    expect(shared).toMatch(/aria-selected/);
    expect(shared).toMatch(/aria-controls/);
    expect(shared).toMatch(/ArrowRight/);
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/role="tabpanel"/);
    expect(panel).toMatch(/ConnectionsSectionNav/);
  });

  it('EN/FA locked verification and group copy parity', () => {
    expect(tEn('mexc_verification_locked_title')).toMatch(/Controlled verification is currently unavailable/);
    expect(tFa('mexc_verification_locked_title')).toMatch(/تأیید کنترل‌شده/);
    expect(translateReasonKind('internal_transfer_read_pending', tEn)).toMatch(/Internal-transfer/);
    expect(translateReasonKind('subaccount_read_pending', tFa)).toMatch(/حساب‌های فرعی/);
    expect(translateReasonKind('wallet_permission_available_incomplete', tEn)).not.toMatch(
      /API-key permission has not yet been verified/i,
    );
  });
});
