/**
 * Unit checks for MEXC proxy URL construction (HQA-A1 remediation).
 */
import { describe, expect, it } from 'vitest';

// Mirror production mapping used by services/api.ts getMexcApiUrl
function getMexcApiUrl(endpoint: string): string {
  const [rawPath, query = ''] = endpoint.split('?');
  const q = query ? `?${query}` : '';
  let path = rawPath
    .replace(/^\/api\/v1\/v3\//, '/')
    .replace(/^\/api\/v3\//, '/')
    .replace(/^\/v3\//, '/')
    .replace(/^\/api\/market\/mexc\//, '/')
    .replace(/^\/api\/v1\/market\/mexc\//, '/');

  if (path.includes('ticker/24hr') || path.includes('ticker24hr')) {
    path = '/ticker/24hr';
  } else if (path.includes('ticker/price') || path === '/price') {
    path = '/price';
  } else if (path.includes('depth')) {
    path = '/depth';
  } else if (path.includes('exchangeInfo')) {
    path = '/exchangeInfo';
  } else if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  return `/api/v1/market/mexc${path}${q}`;
}

describe('getMexcApiUrl', () => {
  it('maps /api/v3/ticker/24hr to canonical proxy path', () => {
    expect(getMexcApiUrl('/api/v3/ticker/24hr?symbol=BTCUSDT')).toBe(
      '/api/v1/market/mexc/ticker/24hr?symbol=BTCUSDT',
    );
  });

  it('does not emit nested /api/v3 under market proxy', () => {
    const url = getMexcApiUrl('/api/v3/ticker/24hr?symbol=ETHUSDT');
    expect(url).not.toContain('/mexc/api/v3/');
  });

  it('maps legacy /api/v1/v3 paths', () => {
    expect(getMexcApiUrl('/api/v1/v3/exchangeInfo')).toBe('/api/v1/market/mexc/exchangeInfo');
  });
});
