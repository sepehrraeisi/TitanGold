/**
 * CONNECTIONS PRODUCT redesign — projection, navigation, history, locales
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveConnectionDisplayStatus,
  connectionStatusMessageKey,
  mexcPrimaryActionLabelKey,
} from '../../services/connectionDisplayStatus.ts';
import {
  buildMexcProviderSummary,
  assertSameOverallStatus,
} from '../../utils/mexcProviderSummary.ts';
import {
  normalizeMexcManageSection,
  buildMexcManageNavigation,
  isMexcManageDeepLink,
  MEXC_MANAGE_SECTIONS,
} from '../../utils/settingsNavigation.ts';
import {
  payloadToURLState,
  readStateFromURL,
  writeStateToURL,
  isURLStateEqual,
} from '../../utils/urlSync.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function locale(lang: 'en' | 'fa', color: 'blue' | 'green' = 'blue'): Record<string, string> {
  return JSON.parse(read(`deploy/${color}/locales/${lang}.json`));
}

describe('deriveConnectionDisplayStatus authenticated projection', () => {
  it('never returns configured_not_verified when privateAuthVerified', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: true,
      privateAuthVerified: true,
    });
    expect(status).toBe('authenticated_capabilities_partial');
    expect(status).not.toBe('configured_not_verified');
    expect(connectionStatusMessageKey(status)).toBe('mexc_state_authenticated_capabilities_partial');
    expect(mexcPrimaryActionLabelKey(status)).toBe('connections_manage_mexc');
  });

  it('uses overallStatusCode authenticated marker', () => {
    const status = deriveConnectionDisplayStatus({
      provider: 'MEXC',
      configured: true,
      overallStatusCode: 'authenticated_capabilities_partial',
    });
    expect(status).toBe('authenticated_capabilities_partial');
  });

  it('non-MEXC uses not_available_yet (not coming_soon)', () => {
    const status = deriveConnectionDisplayStatus({ provider: 'Binance', configured: true });
    expect(status).toBe('not_available_yet');
    expect(connectionStatusMessageKey(status)).toBe('connections_not_available_yet');
  });
});

describe('buildMexcProviderSummary + assertSameOverallStatus', () => {
  it('keeps collapsed/overview overallStatus consistent', () => {
    const connection = {
      provider: 'MEXC',
      configured: true,
      privateAuthVerified: true,
      maskedKeyIdentifier: 'mx…1234',
    };
    const summary = {
      provider: 'MEXC',
      connection: {
        configured: true,
        maskedKeyIdentifier: 'mx…1234',
        lastVerifiedAt: '2026-07-01T12:00:00.000Z',
        credentialAgeHint: '2026-06-01T00:00:00.000Z',
        lastRotationAt: '2026-06-15T00:00:00.000Z',
      },
      publicMarket: { spot: { available: true } },
      privateAuthentication: { verified: true, state: 'authenticated' },
      overallTruthfulState: {
        code: 'authenticated_capabilities_partial',
        label: 'Authenticated · Capabilities partial',
      },
      capabilityMatrix: {
        capabilities: [
          {
            capabilityId: 'SPOT_ACCOUNT_READ',
            group: 'Spot',
            providerSupport: 'supported',
            keyGrant: 'granted',
            verificationState: 'verified',
            operationalState: 'enabled',
          },
          {
            capabilityId: 'SPOT_ORDER_READ',
            group: 'Spot',
            providerSupport: 'supported',
            keyGrant: 'granted',
            verificationState: 'verified',
            operationalState: 'enabled',
          },
        ],
      },
      consumers: [
        { consumerId: 'portfolio', displayName: 'Portfolio', eligible: true, requiredCapabilities: [] },
        {
          consumerId: 'wallet',
          displayName: 'Wallet',
          eligible: true,
          consumerReadiness: 'limited',
          limitedByDataContract: true,
          requiredCapabilities: [],
        },
      ],
      runtime: { realSideEffectsAllowed: false, liveImpossible: true },
    } as any;

    const a = buildMexcProviderSummary({ connection, summary });
    const b = buildMexcProviderSummary({ connection, summary });
    expect(a.overallStatus).toBe('authenticated_capabilities_partial');
    expect(a.overallStatusLabelKey).toBe('mexc_state_authenticated_capabilities_partial');
    expect(a.verifiedPrivateReadCount).toBeGreaterThanOrEqual(2);
    expect(a.walletReadiness).toBe('limited');
    expect(a.publicMarketStatus).toBe('available');
    expect(a.privateAuthenticationStatus).toBe('verified');
    expect(assertSameOverallStatus(a, b)).toBe(true);
  });
});

describe('urlSync provider/section roundtrip', () => {
  it('writes and reads provider + section', () => {
    const original = window.location.href;
    const payload = buildMexcManageNavigation('capabilities');
    const state = payloadToURLState(payload);
    writeStateToURL(state, true);
    const read = readStateFromURL();
    expect(read?.provider).toBe('mexc');
    expect(read?.section).toBe('capabilities');
    expect(isURLStateEqual(read, state)).toBe(true);
    history.replaceState(null, '', original);
  });
});

describe('settingsNavigation sections', () => {
  it('normalizes invalid section to overview', () => {
    expect(normalizeMexcManageSection('nope')).toBe('overview');
    expect(normalizeMexcManageSection('history')).toBe('history');
    expect(MEXC_MANAGE_SECTIONS).toContain('danger');
    expect(isMexcManageDeepLink('mexc-manage')).toBe(true);
    expect(isMexcManageDeepLink(undefined, 'mexc')).toBe(true);
  });
});

describe('source containment', () => {
  it('MultiExchangeSettings / panel use section nav and not_available_yet', () => {
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    const panel = read('components/settings/connections/MexcConnectionPanel.tsx');
    const display = read('services/connectionDisplayStatus.ts');
    expect(multi).toMatch(/buildMexcManageNavigation/);
    expect(multi).toMatch(/not_available_yet|connections_not_available_yet|buildMexcProviderSummary/);
    expect(panel).toMatch(/DataHubSubTabBar/);
    expect(panel).toMatch(/mexc_section_overview|normalizeMexcManageSection/);
    expect(panel).toMatch(/apiSecret:\s*['"]['"]/);
    expect(panel).toMatch(/clearDraftSecrets|apiKey:\s*['"]['"]/);
    expect(panel).not.toMatch(/value=\{connection\.apiSecret\}/);
    expect(panel).not.toMatch(/value=\{connection\.apiKey\}/);
    expect(display).toMatch(/not_available_yet/);
    expect(display).not.toMatch(/coming_soon/);
  });

  it('verificationHistoryService exists and route registered', () => {
    const service = read('backend/services/connections/mexc/verificationHistoryService.js');
    const routes = read('backend/routes/connections.js');
    expect(service).toMatch(/listSanitizedVerificationHistory/);
    expect(service).toMatch(/sanitized_reason|sanitizedReason/);
    expect(routes).toMatch(/\/mexc\/verification-history/);
    expect(routes).toMatch(/listSanitizedVerificationHistory/);
  });
});

describe('locale keys EN+FA', () => {
  const required = [
    'connections_not_available_yet',
    'mexc_section_overview',
    'mexc_section_credentials',
    'mexc_section_capabilities',
    'mexc_section_consumers',
    'mexc_section_history',
    'mexc_section_danger',
    'mexc_card_public_market',
    'mexc_card_private_access',
    'mexc_card_verified_reads',
    'mexc_card_wallet_data',
    'mexc_overview_connection',
    'mexc_overview_read_capabilities',
    'mexc_overview_wallet_readiness',
    'mexc_overview_runtime_execution',
    'mexc_history_filter_all',
    'mexc_history_filter_verified',
    'mexc_history_filter_warning',
    'mexc_history_filter_failed',
    'mexc_history_filter_corrected',
    'mexc_history_empty',
    'mexc_history_correction',
    'mexc_last_attempt',
    'mexc_authenticated',
    'mexc_demo_active',
    'mexc_emergency_stop_active',
    'mexc_live_impossible',
    'mexc_execution_unavailable',
    'mexc_sections_nav',
    'mexc_state_authenticated_capabilities_partial',
  ];

  for (const color of ['blue', 'green'] as const) {
    for (const lang of ['en', 'fa'] as const) {
      it(`${color}/${lang} has redesign keys`, () => {
        const l = locale(lang, color);
        for (const key of required) {
          expect(l[key], key).toBeTruthy();
          expect(l[key]).not.toBe(key);
        }
        if (lang === 'en') {
          expect(l.connections_not_available_yet).toBe('Not available yet');
          expect(l.mexc_state_authenticated_capabilities_partial).toMatch(/Authenticated/);
        } else {
          expect(l.connections_not_available_yet).toMatch(/در دسترس/);
          expect(l.mexc_state_authenticated_capabilities_partial).toMatch(/احراز/);
        }
      });
    }
  }
});
