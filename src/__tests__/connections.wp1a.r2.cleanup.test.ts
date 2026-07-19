/**
 * CONNECTIONS-WP1A-R2 — wallet removal + Test Connection containment
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function locale(color: 'blue' | 'green', lang: 'en' | 'fa'): Record<string, string> {
  return JSON.parse(read(`deploy/${color}/locales/${lang}.json`));
}

describe('CONNECTIONS-WP1A-R2 wallet removal', () => {
  it('ConnectionsSettings no longer renders Wallet Connections UI', () => {
    const src = read('components/settings/ConnectionsSettings.tsx');
    expect(src).toMatch(/MultiExchangeSettings/);
    for (const forbidden of [
      'MetaMask',
      'WalletConnect',
      'Cold Wallet',
      'Browser Extension',
      'Mobile Wallets',
      'Hardware Wallets',
      'wallet_connections',
      'connectMetaMask',
      'connectWalletConnect',
      'fetchWalletConnections',
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });

  it('EN and FA locale owners keep wallet labels only for non-Connections surfaces', () => {
    // Connections page must not surface these strings via ConnectionsSettings;
    // wallet tab may still use related APIs elsewhere — assert Connections source only.
    const connections = read('components/settings/ConnectionsSettings.tsx');
    expect(connections).not.toMatch(/Wallet Connections|اتصالات کیف پول/i);
    for (const color of ['blue', 'green'] as const) {
      const en = locale(color, 'en');
      const fa = locale(color, 'fa');
      expect(en.connections_private_verification_unavailable).toBe(
        'Private credential verification is not available yet.',
      );
      expect(fa.connections_private_verification_unavailable).toBe(
        'تأیید اعتبارنامه خصوصی هنوز در دسترس نیست.',
      );
      expect(en.connections_private_verification_unavailable).not.toMatch(/WP\d|CONNECTIONS-WP/i);
      expect(fa.connections_private_verification_unavailable).not.toMatch(/WP\d|CONNECTIONS-WP/i);
    }
  });
});

describe('CONNECTIONS-WP1A-R2 Test Connection containment', () => {
  it('removes active Test Connection control and API invocation from Manage panel', () => {
    const src = read('components/settings/MultiExchangeSettings.tsx');
    expect(src).not.toMatch(/testMexcConnectionCanonical/);
    expect(src).not.toMatch(/handleTestConnection/);
    expect(src).not.toMatch(/t\('test_connection'\)/);
    expect(src).not.toMatch(/testingExchange/);
    expect(src).toMatch(/connections_private_verification_unavailable/);
    expect(src).toMatch(/connections-private-verification-unavailable/);
    expect(src).toMatch(/save_changes/);
    expect(src).toMatch(/cancel/);
    expect(src).toMatch(/\bdelete\b/);
  });

  it('does not include internal work-package names in verification copy', () => {
    for (const color of ['blue', 'green'] as const) {
      for (const lang of ['en', 'fa'] as const) {
        const l = locale(color, lang);
        const text = l.connections_private_verification_unavailable || '';
        expect(text).not.toMatch(/CONNECTIONS-WP|WP1A|WP2|Work Package/i);
      }
    }
  });
});

describe('CONNECTIONS-WP1A-R2 Manage workflow regression (source)', () => {
  it('keeps Manage panel credential draft clearing and no secret prefill pattern', () => {
    const src = read('components/settings/MultiExchangeSettings.tsx');
    expect(src).toMatch(/clearDraft/);
    expect(src).toMatch(/openMexcPanel/);
    expect(src).toMatch(/drafts\[exchange\] \|\| \{ apiKey: '', apiSecret: '' \}/);
    expect(src).not.toMatch(/value=\{connection\.(apiKey|apiSecret)/);
    expect(src).toMatch(/Configured|connections_configured_not_verified|connectionStatusMessageKey/);
  });
});
