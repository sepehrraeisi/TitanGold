/**
 * Outer provider list card — visual consistency with Manage experience.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExchangeProviderListItem,
  MexcCollapsedSummary,
  ProviderIdentityMark,
  publicMarketLabel,
  privateAccessLabel,
  walletDataLabel,
  toneForDisplayStatus,
} from '../../components/settings/connections/ProviderListCard.tsx';
import { buildMexcProviderSummary } from '../../utils/mexcProviderSummary.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const locale = (lang: 'en' | 'fa') => JSON.parse(read(`deploy/blue/locales/${lang}.json`)) as Record<string, string>;
const tEn = (k: string) => locale('en')[k] || k;
const tFa = (k: string) => locale('fa')[k] || k;

const sampleProjection = buildMexcProviderSummary({
  connection: {
    provider: 'MEXC',
    configured: true,
    privateAuthVerified: true,
  },
  summary: {
    provider: 'MEXC',
    connection: {
      configured: true,
      lastVerifiedAt: '2026-07-01T12:00:00.000Z',
    },
    publicMarket: { spot: { available: true } },
    privateAuthentication: { verified: true, state: 'authenticated' },
    overallTruthfulState: { code: 'authenticated_capabilities_partial' },
    capabilityMatrix: {
      capabilities: [
        { capabilityId: 'PRIVATE_AUTH', verificationState: 'verified', operationalState: 'enabled' },
        { capabilityId: 'SPOT_ACCOUNT_READ', verificationState: 'verified', operationalState: 'enabled' },
      ],
    },
    consumers: [
      { consumerId: 'wallet', eligible: true, consumerReadiness: 'limited', limitedByDataContract: true },
    ],
  } as any,
});

describe('Provider list card — source structure', () => {
  it('MultiExchangeSettings delegates to canonical ProviderListCard shell', () => {
    const multi = read('components/settings/MultiExchangeSettings.tsx');
    const card = read('components/settings/connections/ProviderListCard.tsx');
    expect(multi).toMatch(/ExchangeProviderListItem/);
    expect(multi).toMatch(/ProviderListCard/);
    expect(multi).not.toMatch(/EXCHANGE_ICONS/);
    expect(multi).not.toMatch(/border-gray-800 bg-\[#161B22\]/);
    expect(card).toMatch(/ActionButton/);
    expect(card).toMatch(/StatePill/);
    expect(card).toMatch(/provider-list-card-mexc/);
    expect(card).toMatch(/mexc-collapsed-summary/);
    expect(card).not.toMatch(/text-\[11px\].*space-y-0\.5/);
  });

  it('placeholder providers use shared shell without Manage action', () => {
    const card = read('components/settings/connections/ProviderListCard.tsx');
    expect(card).toMatch(/connection-unavailable-/);
    expect(card).toMatch(/statusText && isMexc &&/);
    expect(card).not.toMatch(/connections_configure/);
  });
});

describe('Provider list card — label helpers', () => {
  it('never returns raw enum strings', () => {
    expect(publicMarketLabel('available', tEn)).toBe('Available');
    expect(privateAccessLabel('verified', tEn)).toMatch(/Authenticated/i);
    expect(walletDataLabel('limited', tEn)).toMatch(/Limited/i);
    expect(toneForDisplayStatus('authenticated_capabilities_partial')).toBe('ok');
    expect(publicMarketLabel('available', tEn)).not.toBe('available');
  });

  it('EN/FA parity for summary labels', () => {
    expect(tEn('mexc_card_public_market')).toBeTruthy();
    expect(tFa('mexc_card_public_market')).toBeTruthy();
    expect(tEn('mexc_card_wallet_data')).not.toBe(tFa('mexc_card_wallet_data'));
  });
});

describe('Provider list card — render', () => {
  it('renders collapsed MEXC summary grid and Manage action', () => {
    const onAction = vi.fn();
    render(
      <ExchangeProviderListItem
        exchange="MEXC"
        isMexc
        expanded={false}
        statusText={tEn('mexc_state_authenticated_capabilities_partial')}
        statusTone="ok"
        actionLabel={tEn('connections_manage_mexc')}
        onAction={onAction}
        projection={sampleProjection}
        language="en"
        t={tEn}
      />,
    );

    expect(screen.getByTestId('provider-list-card-mexc')).toBeTruthy();
    expect(screen.getByTestId('provider-mark-MEXC')).toBeTruthy();
    expect(screen.getByTestId('mexc-collapsed-summary')).toBeTruthy();
    expect(screen.getByTestId('mexc-collapsed-last-verified')).toBeTruthy();
    expect(screen.getByTestId('connection-action-MEXC').textContent).toMatch(/Manage/i);
    expect(screen.getByText(String(sampleProjection.verifiedPrivateReadCount))).toBeTruthy();
    expect(screen.queryByText('authenticated_capabilities_partial')).toBeNull();

    fireEvent.click(screen.getByTestId('connection-action-MEXC'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  const FUTURE_PROVIDERS = ['Binance', 'Bybit', 'KuCoin', 'Gate.io'] as const;

  function countVisibleUnavailablePills(card: HTMLElement): number {
    return Array.from(card.querySelectorAll('span.inline-flex.items-center.rounded-md.border')).filter(
      (el) => !el.closest('.sr-only'),
    ).length;
  }

  it.each(FUTURE_PROVIDERS)('renders %s with exactly one visible unavailable badge (EN)', (exchange) => {
    const label = tEn('connections_not_available_yet');
    render(
      <ExchangeProviderListItem
        exchange={exchange}
        isMexc={false}
        expanded={false}
        statusText={label}
        statusTone="neutral"
        actionLabel=""
        onAction={() => {}}
        language="en"
        t={tEn}
      />,
    );

    const card = screen.getByTestId(`provider-list-card-${exchange}`);
    expect(card).toBeTruthy();
    expect(screen.getByTestId(`connection-unavailable-${exchange}`)).toBeTruthy();
    expect(screen.queryByTestId(`connection-status-${exchange}`)).toBeNull();
    expect(countVisibleUnavailablePills(card)).toBe(1);
    expect(card.textContent?.match(new RegExp(label, 'g'))?.length).toBe(2);
    expect(screen.queryByTestId(`connection-action-${exchange}`)).toBeNull();
    expect(screen.queryByTestId('mexc-collapsed-summary')).toBeNull();
  });

  it.each(FUTURE_PROVIDERS)('renders %s with exactly one visible unavailable badge (FA RTL)', (exchange) => {
    const label = tFa('connections_not_available_yet');
    render(
      <ExchangeProviderListItem
        exchange={exchange}
        isMexc={false}
        expanded={false}
        statusText={label}
        statusTone="neutral"
        actionLabel=""
        onAction={() => {}}
        language="fa"
        t={tFa}
        dir="rtl"
      />,
    );

    const card = screen.getByTestId(`provider-list-card-${exchange}`);
    expect(card.getAttribute('dir')).toBe('rtl');
    expect(countVisibleUnavailablePills(card)).toBe(1);
    expect(screen.queryByTestId(`connection-status-${exchange}`)).toBeNull();
    expect(screen.queryByTestId(`connection-action-${exchange}`)).toBeNull();
  });

  it.each(FUTURE_PROVIDERS)('renders %s once on mobile-width layout', (exchange) => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    const label = tEn('connections_not_available_yet');
    render(
      <ExchangeProviderListItem
        exchange={exchange}
        isMexc={false}
        expanded={false}
        statusText={label}
        statusTone="neutral"
        actionLabel=""
        onAction={() => {}}
        language="en"
        t={tEn}
      />,
    );

    const card = screen.getByTestId(`provider-list-card-${exchange}`);
    expect(countVisibleUnavailablePills(card)).toBe(1);
  });

  it('applies RTL direction for FA cards', () => {
    render(
      <ExchangeProviderListItem
        exchange="MEXC"
        isMexc
        expanded={false}
        statusText={tFa('mexc_state_authenticated_capabilities_partial')}
        statusTone="ok"
        actionLabel={tFa('connections_manage_mexc')}
        onAction={() => {}}
        projection={sampleProjection}
        language="fa"
        t={tFa}
        dir="rtl"
      />,
    );
    expect(screen.getByTestId('provider-list-card-mexc').getAttribute('dir')).toBe('rtl');
  });

  it('Manage button exposes accessible name with provider context', () => {
    render(
      <ExchangeProviderListItem
        exchange="MEXC"
        isMexc
        expanded={false}
        statusText={tEn('mexc_state_authenticated_capabilities_partial')}
        statusTone="ok"
        actionLabel={tEn('connections_manage_mexc')}
        onAction={() => {}}
        projection={sampleProjection}
        language="en"
        t={tEn}
      />,
    );
    expect(screen.getByTestId('connection-action-MEXC').getAttribute('aria-label')).toMatch(/MEXC/);
  });

  it('ProviderIdentityMark uses initials not emoji dots', () => {
    render(<ProviderIdentityMark exchange="MEXC" />);
    expect(screen.getByTestId('provider-mark-MEXC').textContent).toBe('MX');
  });

  it('MexcCollapsedSummary preserves canonical values', () => {
    render(
      <MexcCollapsedSummary projection={sampleProjection} language="en" t={tEn} />,
    );
    expect(screen.getByTestId('mexc-collapsed-summary').textContent).toMatch(/Available/);
    expect(screen.getByTestId('mexc-collapsed-summary').textContent).toMatch(/Authenticated/);
    expect(screen.getByTestId('mexc-collapsed-summary').textContent).toMatch(/Limited/);
  });
});

describe('Provider list card — no provider transport', () => {
  it('component source does not call MEXC APIs', () => {
    const card = read('components/settings/connections/ProviderListCard.tsx');
    expect(card).not.toMatch(/fetchMexc|api\.mexc\.com|saveMexcConnection/);
  });
});
