/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.unstable_mockModule('../../services/orderExecutor.js', () => ({
  placeMarketOrder: jest.fn(),
  placeLimitOrder: jest.fn(),
  placeStopLossOrder: jest.fn(),
  placeTakeProfitOrder: jest.fn(),
  cancelOrder: jest.fn(),
  modifyOrder: jest.fn(),
  OrderType: { MARKET: 'market' },
  OrderSide: { BUY: 'buy' },
  OrderStatus: {},
}));

jest.unstable_mockModule('../../services/orderTracker.js', () => ({
  startTracking: jest.fn(),
  stopTracking: jest.fn(),
  fetchOrderStatus: jest.fn(),
  getOpenOrders: jest.fn(async () => []),
  getOrderHistory: jest.fn(async () => []),
  monitorOrderUntilComplete: jest.fn(),
  checkPartialFills: jest.fn(),
  getAllTrackedOrders: jest.fn(() => []),
}));

const orderAgent = await import('../../services/agents/order.js');
const { placeMarketOrder } = await import('../../services/orderExecutor.js');

describe('order agent dry-run safety', () => {
  it('suppresses place_order when dry_run is true', async () => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
      input: { dry_run: true, effective_mode: 'dry_run' },
    });
    expect(result.result.simulated).toBe(true);
    expect(result.metadata.side_effects_suppressed).toBe(true);
    expect(placeMarketOrder).not.toHaveBeenCalled();
  });

  it('suppresses cancel_order in dry run', async () => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'cancel_order',
      config: {},
      input: { dry_run: true },
    });
    expect(result.result.dry_run).toBe(true);
  });
});
