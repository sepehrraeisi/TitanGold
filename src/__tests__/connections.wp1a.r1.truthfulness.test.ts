/**
 * CONNECTIONS-WP1A-R1 — truthful status ownership and UI containment tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveConnectionDisplayStatus,
  connectionStatusMessageKey,
  mexcPrimaryActionLabelKey,
} from '../../services/connectionDisplayStatus.ts';

describe('connectionDisplayStatus ownership', () => {
  it('canonical encrypted/configured row → configured_not_verified + Manage', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: true,
      secretReentryRequired: false,
      envCredentialsPresent: true,
      publicMarketReachable: true,
      legacyBrowserKeyPresent: true,
    });
    expect(status).toBe('configured_not_verified');
    expect(connectionStatusMessageKey(status)).toBe('connections_configured_not_verified');
    expect(mexcPrimaryActionLabelKey(status)).toBe('connections_manage_mexc');
  });

  it('zero canonical row → not_configured + Configure', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: false,
      envCredentialsPresent: true,
      publicMarketReachable: true,
      legacyBrowserKeyPresent: true,
    });
    expect(status).toBe('not_configured');
    expect(connectionStatusMessageKey(status)).toBe('connections_not_configured');
    expect(mexcPrimaryActionLabelKey(status)).toBe('connections_configure_mexc');
  });

  it('ENV / public market / legacy browser key cannot create configured status', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: false,
      envCredentialsPresent: true,
      publicMarketReachable: true,
      legacyBrowserKeyPresent: true,
    });
    expect(status).toBe('not_configured');
  });

  it('unsupported providers are coming_soon without configure action semantics', () => {
    for (const provider of ['Binance', 'Bybit', 'KuCoin', 'Gate.io']) {
      const status = deriveConnectionDisplayStatus({
        provider,
        configured: true, // even if somehow true, UI treats non-MEXC as coming soon
      });
      expect(status).toBe('coming_soon');
      expect(connectionStatusMessageKey(status)).toBe('connections_coming_soon');
    }
  });

  it('stale frontend flags cannot override missing backend configured metadata', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      // configured omitted / undefined
      legacyBrowserKeyPresent: true,
      envCredentialsPresent: true,
      publicMarketReachable: true,
    });
    expect(status).toBe('not_configured');
  });
});

describe('product copy and i18n', () => {
  it('EN/FA Connections copy has no internal Work-Package terminology', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    for (const locale of ['en', 'fa']) {
      const raw = fs.readFileSync(
        path.join(process.cwd(), `deploy/blue/locales/${locale}.json`),
        'utf8',
      );
      const data = JSON.parse(raw);
      const desc = String(data.exchange_connections_desc || '');
      expect(desc).not.toMatch(/CONNECTIONS-WP/i);
      expect(desc).not.toMatch(/Work Package/i);
      expect(desc).not.toMatch(/WP1A|WP2|WP3/);
      expect(data.settings_configuration).toBeTruthy();
      expect(data.clear_cache).toBeTruthy();
      expect(data.settings_configuration).not.toBe('settings_configuration');
      expect(data.clear_cache).not.toBe('clear_cache');
      expect(data.connections_configured_not_verified).toMatch(/Not verified|تأیید نشده/);
      expect(data.connections_coming_soon).toBeTruthy();
      expect(data.connections_manage_mexc).toBeTruthy();
      expect(data.connections_configure_mexc).toBeTruthy();
    }
  });

  it('MultiExchangeSettings source has no bare + affordance and no token key', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'components/settings/MultiExchangeSettings.tsx'),
      'utf8',
    );
    const helper = fs.readFileSync(
      path.join(process.cwd(), 'services/connectionDisplayStatus.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/localStorage\.getItem\(['"]token['"]\)/);
    expect(src).toMatch(/mexcPrimaryActionLabelKey/);
    expect(src).toMatch(/deriveConnectionDisplayStatus/);
    expect(helper).toMatch(/coming_soon/);
    expect(helper).toMatch(/connections_coming_soon/);
    expect(src).not.toMatch(/>\s*\+\s*</); // no bare + text node
    expect(src).not.toMatch(/CONNECTIONS-WP/);
  });
});

describe('WP1A security regression smoke', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('maps Invalid token to APP_SESSION_EXPIRED', async () => {
    const { mapConnectionApiError } = await import('../../services/connectionsApi.ts');
    const mapped = mapConnectionApiError(401, { error: 'Invalid token', code: 'INVALID_TOKEN' });
    expect(mapped.code).toBe('APP_SESSION_EXPIRED');
  });

  it('legacy key detection does not create configured status', async () => {
    localStorage.setItem('titan_mexc_settings', 'OPAQUE');
    const { detectLegacyInsecureCredentialKeys } = await import('../../services/connectionsApi.ts');
    expect(detectLegacyInsecureCredentialKeys()).toEqual(['titan_mexc_settings']);
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: false,
      legacyBrowserKeyPresent: true,
    });
    expect(status).toBe('not_configured');
  });
});
