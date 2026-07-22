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
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(multi).not.toMatch(/testMexcConnectionCanonical/);
    expect(multi).not.toMatch(/handleTestConnection/);
    expect(panel).toMatch(/mexc-verification-locked|mexc_verification_locked_title/);
    expect(panel).toMatch(/mexc_verification_locked_detail|mexc_verification_gated/);
    expect(panel).toMatch(/save_changes|mexc_rotate_credentials/);
    expect(panel).toMatch(/cancel/);
    expect(panel).toMatch(/\bdelete\b/);
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
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    expect(multi).toMatch(/openMexcPanel/);
    expect(panel).toMatch(/apiKey: '', apiSecret: ''/);
    expect(panel).not.toMatch(/value=\{connection\.(apiKey|apiSecret)/);
    expect(multi).toMatch(/connectionStatusMessageKey/);
  });
});
