/**
 * Expanded order-agent safety tests (mocked — no real exchange)
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockPlace = jest.fn();
const mockCancel = jest.fn();
const mockModify = jest.fn();

jest.unstable_mockModule('../../services/orderExecutor.js', () => ({
  placeMarketOrder: mockPlace,
  placeLimitOrder: jest.fn(),
  placeStopLossOrder: jest.fn(),
  placeTakeProfitOrder: jest.fn(),
  cancelOrder: mockCancel,
  modifyOrder: mockModify,
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

describe('order agent safety matrix', () => {
  beforeEach(() => {
    mockPlace.mockReset();
    mockCancel.mockReset();
    mockModify.mockReset();
  });

  const cases = [
    ['place_order dry_run', { action: 'place_order', input: { dry_run: true, effective_mode: 'dry_run' } }],
    ['cancel_order dry_run', { action: 'cancel_order', input: { dry_run: true }, config: {} }],
    ['modify_order dry_run', { action: 'modify_order', input: { dry_run: true }, config: { orderId: '1' } }],
    ['place_order kill_switch metadata', { action: 'place_order', input: { dry_run: true, kill_switch_active: true } }],
    ['place_order global demo', { action: 'place_order', input: { dry_run: true, effective_mode: 'demo' } }],
  ];

  it.each(cases)('%s suppresses exchange calls', async (_label, opts) => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      ...opts,
      config: opts.config || { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
    });
    expect(mockPlace).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockModify).not.toHaveBeenCalled();
    expect(result.result?.simulated === true || result.result?.dry_run === true).toBe(true);
  });

  it('returns stable metadata on suppression', async () => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
      input: { dry_run: true, effective_mode: 'dry_run' },
    });
    expect(result.metadata?.side_effects_suppressed).toBe(true);
  });
});
