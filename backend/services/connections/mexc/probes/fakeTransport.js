/**
 * Deterministic fake MEXC transport for automated tests and Browser QA.
 * Never contacts real MEXC.
 */

export function createFakeMexcTransport(scenario = 'success') {
  const calls = [];

  async function transport(request) {
    calls.push({
      method: request.method,
      path: request.path,
      host: request.host,
      at: Date.now(),
    });

    if (scenario === 'network_error') {
      const err = new Error('Network unavailable');
      err.code = 'MEXC_NETWORK_ERROR';
      throw err;
    }
    if (scenario === 'timeout') {
      const err = new Error('Timeout');
      err.code = 'MEXC_TIMEOUT';
      throw err;
    }
    if (scenario === 'permission_denied') {
      return {
        ok: false,
        status: 400,
        json: { code: 700007, msg: 'No permission to access the endpoint' },
        latencyMs: 12,
      };
    }
    if (scenario === 'auth_failed') {
      return {
        ok: false,
        status: 400,
        json: { code: 700002, msg: 'Signature for this request is not valid' },
        latencyMs: 10,
      };
    }

    // success defaults by path
    const path = request.path || '';
    const jsonOk = (json, latencyMs = 10) => ({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/json' },
      contentType: 'application/json',
      json,
      bodyText: JSON.stringify(json),
      latencyMs,
    });

    if (path.includes('/api/v3/ping') || path.includes('/api/v3/time')) {
      return jsonOk(path.includes('time') ? { serverTime: Date.now() } : {}, 5);
    }
    if (path.includes('/api/v3/exchangeInfo')) {
      return jsonOk({
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'ENABLED',
            isSpotTradingAllowed: true,
            isApiTradingAllowed: true,
            permissions: ['SPOT'],
          },
          {
            symbol: 'ETHUSDT',
            status: 'ENABLED',
            isSpotTradingAllowed: true,
            isApiTradingAllowed: true,
            permissions: ['SPOT'],
          },
        ],
      }, 8);
    }
    if (path.includes('/api/v1/contract/ping') || path.includes('/api/v1/contract/detail')) {
      return jsonOk({ success: true, code: 0, data: [] }, 8);
    }
    if (path.includes('/api/v3/account')) {
      return jsonOk({
        canTrade: true,
        canWithdraw: false,
        canDeposit: true,
        accountType: 'SPOT',
        balances: [],
      }, 15);
    }
    if (path.includes('/api/v3/openOrders') || path.includes('/api/v3/myTrades') || path.includes('/api/v3/allOrders')) {
      return jsonOk([], 12);
    }
    if (path.includes('/api/v3/capital/config/getall')) {
      return jsonOk([{ coin: 'USDT', networkList: [] }], 14);
    }
    if (path.includes('/api/v3/capital/deposit') || path.includes('/api/v3/capital/withdraw/history') || path.includes('/api/v3/capital/transfer')) {
      return jsonOk([], 14);
    }
    if (path.includes('/api/v1/private/account/assets') || path.includes('/api/v1/private/position/open_positions')) {
      return jsonOk({ success: true, code: 0, data: [] }, 16);
    }

    return jsonOk({ success: true }, 10);
  }

  transport.calls = calls;
  transport.scenario = scenario;
  return transport;
}
