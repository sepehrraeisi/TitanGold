/**
 * Safe public Spot symbol selection for private openOrders / myTrades probes.
 * Never guesses a symbol; never derives from private balances.
 */

export const SAFE_SPOT_SYMBOL_CANDIDATES = Object.freeze([
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'BNBUSDT',
]);

export function selectSafeSpotProbeSymbol(exchangeInfo, candidates = SAFE_SPOT_SYMBOL_CANDIDATES) {
  const evaluated = [];
  const symbols = Array.isArray(exchangeInfo?.symbols) ? exchangeInfo.symbols : [];
  const byName = new Map(symbols.map((s) => [String(s.symbol || '').toUpperCase(), s]));

  for (const candidate of candidates) {
    const key = String(candidate).toUpperCase();
    evaluated.push(key);
    const row = byName.get(key);
    if (!row) continue;

    const status = String(row.status || '').toUpperCase();
    const isSpot = row.isSpotTradingAllowed !== false;
    const apiEnabled = row.isApiTradingAllowed !== false;

    const active = status === '1' || status === 'ENABLED' || status === 'TRADING' || status === '';
    if (active && isSpot && apiEnabled !== false) {
      return {
        symbol: key,
        reason: 'selected_from_public_exchange_info_allowlist',
        evaluated,
      };
    }
  }

  return {
    symbol: null,
    reason: 'no_allowlisted_active_api_enabled_symbol',
    evaluated,
  };
}

export function buildSafeSymbolPersistMeta(selection) {
  if (!selection?.symbol) {
    return {
      probeSafeSymbol: null,
      probeSafeSymbolSource: 'public_exchange_info',
      probeSafeSymbolStatus: 'unavailable',
      probeSafeSymbolReason: selection?.reason || 'unavailable',
    };
  }
  return {
    probeSafeSymbol: selection.symbol,
    probeSafeSymbolSource: 'public_exchange_info',
    probeSafeSymbolStatus: 'selected',
    probeSafeSymbolReason: selection.reason,
  };
}
