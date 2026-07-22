/**
 * MEXC-E2E final pre-authorization product UX remediation
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyCapabilityReason,
  classifyFromBlockedReasonText,
  selectCapabilityProductReason,
  selectConsumerProductReason,
  productStatusFromCapability,
  MEXC_REASON_I18N,
} from '../../utils/mexcReasonPriority.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function locale(lang: 'en' | 'fa'): Record<string, string> {
  return JSON.parse(read(`deploy/blue/locales/${lang}.json`));
}

describe('Reason priority', () => {
  it('P2P unknown support beats auth-pending wording', () => {
    const kind = selectCapabilityProductReason({
      capabilityId: 'P2P_READ',
      providerSupport: 'unknown',
      operationalState: 'blocked_by_provider_evidence',
      blockedReason: 'PROVIDER SUPPORT NOT VERIFIED',
    });
    expect(kind).toBe('provider_unknown');
    expect(MEXC_REASON_I18N[kind]).toBe('mexc_reason_provider_unknown');
  });

  it('Account Edit uses official use-case unknown reason', () => {
    const kind = selectCapabilityProductReason({
      capabilityId: 'ACCOUNT_EDIT',
      providerSupport: 'unknown',
      blockedReason: 'PROVIDER SUPPORT NOT VERIFIED — no verified official TitanGold endpoint/use case',
    });
    expect(kind).toBe('account_use_case_unknown');
  });

  it('maintenance reason', () => {
    expect(
      selectCapabilityProductReason({
        providerSupport: 'maintenance',
        blockedReason: 'Provider temporarily unavailable (maintenance)',
      }),
    ).toBe('provider_maintenance');
  });

  it('auth-pending for private unverified reads', () => {
    expect(
      selectCapabilityProductReason({
        capabilityId: 'SPOT_ACCOUNT_READ',
        providerSupport: 'supported',
        operationalState: 'disabled',
        blockedReason: 'Not verified — private capability remains disabled until safe verification succeeds',
      }),
    ).toBe('auth_pending');
  });

  it('Tier-4 runtime reason for financial write', () => {
    expect(
      selectCapabilityProductReason({
        capabilityId: 'WITHDRAWAL_EXECUTE',
        providerSupport: 'supported',
        operationalState: 'blocked_by_runtime',
        blockedReason: 'Tier-4 financial/account mutation blocked by runtime (Demo / Kill Switch / Live unavailable)',
      }),
    ).toBe('runtime_tier4');
  });

  it('consumer text prefers provider unknown over auth when present', () => {
    expect(
      classifyFromBlockedReasonText(
        'P2P_READ: provider unknown; PRIVATE_AUTH: Not verified — private capability remains disabled',
      ),
    ).toBe('provider_unknown');
  });

  it('execution consumers default to runtime_tier4', () => {
    expect(
      selectConsumerProductReason({
        eligible: false,
        sideEffectClass: 'financial_write',
        blockedReason: 'SPOT_TRADE_EXECUTE: Not verified; Tier-4 runtime gates: Live side effects impossible',
      }),
    ).toBe('runtime_tier4');
  });

  it('product status maps unknown provider to unavailable', () => {
    expect(productStatusFromCapability({ providerSupport: 'unknown', operationalState: 'blocked' })).toBe(
      'unavailable',
    );
  });
});

describe('Panel defaults and credential scoping', () => {
  it('technical details default closed and groups/consumers start collapsed', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/useState\(false\)/);
    expect(panel).toMatch(/data-technical-default="false"/);
    expect(panel).toMatch(/const \[showTechnical, setShowTechnical\] = useState\(false\)/);
    expect(panel).toMatch(/const \[credentialsOpen, setCredentialsOpen\] = useState\(false\)/);
    expect(panel).toMatch(/const \[expandedGroups, setExpandedGroups\] = useState<Record<string, boolean>>\(\{\}\)/);
    expect(panel).toMatch(/const \[expandedConsumers, setExpandedConsumers\] = useState<Record<string, boolean>>\(\{\}\)/);
  });

  it('credential Rotate/Cancel only render while form expanded', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/data-testid="mexc-credential-actions"/);
    const actionsIdx = panel.indexOf('mexc-credential-actions');
    const credOpenIdx = panel.lastIndexOf('credentialsOpen &&', actionsIdx);
    expect(credOpenIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(credOpenIdx);
    // Save only inside credentials section; danger zone has delete only
    const dangerBlock = panel.slice(
      panel.indexOf('mexc-danger-zone'),
      panel.indexOf('connection-delete-MEXC') + 40,
    );
    expect(dangerBlock).not.toMatch(/connection-save-MEXC/);
  });

  it('technical mode gates raw enums and capability codes', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/showTechnical &&/);
    expect(panel).toMatch(/mexc-cap-code-/);
    expect(panel).not.toMatch(/StatePill label=\{`\$\{t\('mexc_provider'\)}: \$\{cap\.providerSupport\}/);
  });

  it('includes separate read and execution consumers', () => {
    const shared = read('components/settings/connections/mexcPanelShared.tsx');
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/PRIMARY_CONSUMER_IDS/);
    for (const id of [
      'spot_trading_read',
      'spot_trading_execute',
      'futures_trading_read',
      'futures_trading_execute',
      'wallet_withdrawal_execute',
      'wallet_transfer_execute',
    ]) {
      expect(shared).toContain(`'${id}'`);
    }
  });

  it('Manage becomes Collapse when expanded', () => {
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    expect(multi).toMatch(/mexc_collapse_panel/);
  });
});

describe('Wallet truthfulness', () => {
  it('banner separates read/withdraw/transfer and uses keyboard-capable Manage', () => {
    const banner = read('components/settings/wallet/MexcWalletCapabilityBanner.tsx');
    expect(banner).toMatch(/wallet-mexc-withdraw/);
    expect(banner).toMatch(/wallet-mexc-transfer/);
    expect(banner).toMatch(/onKeyDown/);
    expect(banner).toMatch(/buildMexcManageNavigation/);
  });

  it('placeholder wallet controls are disabled with truthful labels', () => {
    const cold = read('components/settings/wallet/ColdWalletWidget.tsx');
    expect(cold).toMatch(/wallet-cold-test-coming-later/);
    expect(cold).toMatch(/wallet-cold-instant-blocked/);
    expect(cold).not.toMatch(/onClick=\{handleInstantTransfer\}/);

    const security = read('components/settings/wallet/SecurityWidget.tsx');
    expect(security).toMatch(/wallet-backup-coming-later/);
    expect(security).not.toMatch(/onClick=\{handleBackupWallets\}/);

    const defi = read('components/settings/wallet/DeFiWidget.tsx');
    expect(defi).toMatch(/wallet-defi-manage-demo-only/);
  });
});

describe('EN/FA reason keys present', () => {
  const keys = Object.values(MEXC_REASON_I18N);
  for (const lang of ['en', 'fa'] as const) {
    it(`${lang} has semantic reason keys`, () => {
      const l = locale(lang);
      for (const key of keys) {
        expect(l[key], key).toBeTruthy();
        expect(l[key]).not.toBe(key);
      }
      expect(l.mexc_collapse_panel).toBeTruthy();
      expect(l.wallet_control_coming_later).toBeTruthy();
    });
  }
});
