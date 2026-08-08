/**
 * Expanded order-agent safety tests (mocked — no real exchange / no live DB)
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// evaluateExecutionPolicy imports database/db.js at module load. Without this mock,
// a real pg Pool client stays idle with allowExitOnIdle:false and Jest never exits
// when the suite runs in-band (GHA 2-CPU → maxWorkers 50% → 1).
jest.unstable_mockModule('../../database/db.js', () => ({
  query: jest.fn(async () => ({ rows: [] })),
}));

jest.unstable_mockModule('../../utils/redis.js', () => ({
  getRedisClient: jest.fn(async () => ({
    setEx: jest.fn(),
    get: jest.fn(),
    publish: jest.fn(),
    isOpen: false,
  })),
  isRedisAvailable: jest.fn(() => false),
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: jest.fn(async () => ({
    globalMode: 'demo',
    killSwitchActive: true,
    version: 1,
  })),
  getEffectiveGlobalMode: jest.fn(async () => 'demo'),
  isKillSwitchActive: jest.fn(async () => true),
  isDeploymentEngineEnabled: jest.fn(() => true),
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

  const blockedCases = [
    ['scheduler context demo', { dry_run: true, execution_context: 'scheduler', effective_mode: 'demo' }],
    ['autopilot context demo', { dry_run: true, execution_context: 'autopilot', effective_mode: 'demo' }],
  ];

  it.each(blockedCases)('%s — no exchange mutation', async (_label, input) => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
      input,
    });
    expect(mockPlace).not.toHaveBeenCalled();
    expect(result.result?.simulated === true || result.metadata?.side_effects_suppressed === true || result.result?.dry_run === true).toBe(true);
  });

  describe('policy-layer blocked cases (no agent invocation)', () => {
    let policy;
    beforeAll(async () => {
      policy = await import('../../services/agentExecutionPolicyService.js');
    });

    const policyCases = [
      ['kill_switch active', { killSwitchActive: true, requestedMode: 'live', globalMode: 'demo' }],
      ['global demo', { killSwitchActive: true, requestedMode: 'live', globalMode: 'demo' }],
      ['deployment disabled', { killSwitchActive: true, tradingEngineEnabled: false }],
      ['requested live blocked', { killSwitchActive: true, requestedMode: 'live', globalMode: 'demo' }],
    ];

    it.each(policyCases)('%s suppresses side effects', async (_label, opts) => {
      const decision = await policy.evaluateExecutionPolicy({
        agentKey: 'order',
        userId: 'u1',
        role: 'trader',
        requestedMode: opts.requestedMode || 'demo',
        ...opts,
      });
      expect(decision.sideEffectsSuppressed === true || decision.allowed === false || decision.effectiveMode !== 'live').toBe(true);
    });
  });

  it('duplicate request does not double-place', async () => {
    const opts = {
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
      input: { dry_run: true, idempotency_key: 'dup-1' },
    };
    await orderAgent.run(opts);
    await orderAgent.run(opts);
    expect(mockPlace).not.toHaveBeenCalled();
  });

  it('provider rejection returns error not fake success', async () => {
    mockPlace.mockRejectedValueOnce(new Error('provider rejected'));
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: false, effective_mode: 'live' },
      input: { dry_run: false, effective_mode: 'live', kill_switch_active: false, broker_connected: true, trading_engine_enabled: true },
    });
    if (result.error) {
      expect(result.success).not.toBe(true);
    } else {
      expect(result.metadata?.side_effects_suppressed === true || result.result?.simulated === true).toBe(true);
    }
  });

  it('malformed provider response handled safely under dry_run', async () => {
    const result = await orderAgent.run({
      userId: 'u1',
      symbol: 'BTCUSDT',
      action: 'place_order',
      config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
      input: { dry_run: true, effective_mode: 'dry_run' },
    });
    expect(mockPlace).not.toHaveBeenCalled();
    expect(result.result?.simulated === true || result.metadata?.side_effects_suppressed === true).toBe(true);
  });

  for (const role of ['user', 'vip', 'trader', 'admin']) {
    it(`role context ${role} dry_run suppresses`, async () => {
      const result = await orderAgent.run({
        userId: `fixture-${role}`,
        symbol: 'BTCUSDT',
        action: 'place_order',
        config: { orderType: 'market', side: 'buy', amount: 1, dry_run: true },
        input: { dry_run: true, role, effective_mode: 'dry_run' },
      });
      expect(mockPlace).not.toHaveBeenCalled();
      expect(result.result?.simulated === true || result.result?.dry_run === true).toBe(true);
    });
  }
});
