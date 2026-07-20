/**
 * MEXC-E2E Human-QA — Settings deep-link contract
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMexcManageNavigation,
  isMexcManageDeepLink,
  MEXC_MANAGE_SUBTAB,
  SETTINGS_TAB_CONNECTIONS,
} from '../../utils/settingsNavigation.ts';
import { payloadToURLState, readStateFromURL } from '../../utils/urlSync.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function locale(lang: 'en' | 'fa'): Record<string, string> {
  return JSON.parse(read(`deploy/blue/locales/${lang}.json`));
}

describe('MEXC manage deep-link contract', () => {
  it('builds canonical Settings → Connections → MEXC Manage payload', () => {
    expect(buildMexcManageNavigation()).toEqual({
      view: 'settings',
      settingsTab: SETTINGS_TAB_CONNECTIONS,
      settingsSubtab: MEXC_MANAGE_SUBTAB,
    });
    expect(isMexcManageDeepLink(MEXC_MANAGE_SUBTAB)).toBe(true);
    expect(isMexcManageDeepLink('other')).toBe(false);
  });

  it('serializes to URL query params', () => {
    const urlState = payloadToURLState(buildMexcManageNavigation());
    expect(urlState).toEqual({
      view: 'settings',
      settingsTab: 'connections',
      settingsSubtab: 'mexc-manage',
    });
  });

  it('accepts legacy tab alias when reading URL', () => {
    const original = window.location.href;
    history.replaceState(null, '', '/?view=settings&tab=wallet');
    expect(readStateFromURL()?.settingsTab).toBe('wallet');
    history.replaceState(null, '', '/?view=settings&settingsTab=connections&settingsSubtab=mexc-manage');
    expect(readStateFromURL()).toEqual({
      view: 'settings',
      settingsTab: 'connections',
      settingsSubtab: 'mexc-manage',
    });
    history.replaceState(null, '', original);
  });
});

describe('Wallet Manage MEXC wiring', () => {
  it('banner uses onNavigate instead of dead hash link', () => {
    const banner = read('components/settings/wallet/MexcWalletCapabilityBanner.tsx');
    expect(banner).toMatch(/buildMexcManageNavigation/);
    expect(banner).not.toMatch(/href="#settings-connections"/);
    expect(banner).toMatch(/onNavigate\?: OnNavigateHandler/);
  });

  it('Settings passes deep-link subtab to ConnectionsSettings', () => {
    const settings = read('components/Settings.tsx');
    expect(settings).toMatch(/ConnectionsSettings[\s\S]*initialSubtab/);
    expect(settings).toMatch(/WalletSettings onNavigate/);
  });

  it('MultiExchangeSettings auto-expands MEXC for mexc-manage subtab', () => {
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    expect(multi).toMatch(/isMexcManageDeepLink\(initialSubtab\)/);
    expect(multi).toMatch(/setExpandedExchange\('MEXC'\)/);
  });

  it('Dashboard passes onNavigate to Settings', () => {
    const dash = read('components/Dashboard.tsx');
    expect(dash).toMatch(/onNavigate=\{handleNavigation\}/);
  });
});

describe('Wallet and MEXC i18n completeness', () => {
  const walletKeys = [
    'trading_mode',
    'demo_mode_desc',
    'virtual_wallet',
    'reset_wallet',
    'demo_mode_notice',
    'demo_mode_notice_desc',
    'no_transactions',
    'no_transactions_for_wallet',
    'mexc_manage_connection',
    'mexc_blocked_generic_reason',
  ];

  for (const lang of ['en', 'fa'] as const) {
    it(`${lang} locale has wallet and MEXC display keys`, () => {
      const l = locale(lang);
      for (const key of walletKeys) {
        expect(l[key], key).toBeTruthy();
        expect(l[key]).not.toBe(key);
      }
    });
  }
});

describe('MEXC panel UX containment', () => {
  it('verification remains gated and delete is in danger zone', () => {
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(panel).toMatch(/mexc-test-connection-disabled/);
    expect(panel).toMatch(/mexc-danger-zone/);
    expect(panel).toMatch(/mexc-credentials-toggle/);
    expect(panel).not.toMatch(/testMexcConnection/);
  });
});
