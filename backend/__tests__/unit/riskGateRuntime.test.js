/**
 * Risk gate runtime SSOT integration tests
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockGetEffectiveGlobalMode = jest.fn(async () => 'demo');
const mockIsKillSwitchActive = jest.fn(async () => true);

jest.unstable_mockModule('../../database/db.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../../services/risk-agent.js', () => ({
  runRiskAssessment: jest.fn(async () => {
    throw new Error('simulated risk agent failure');
  }),
}));
jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getEffectiveGlobalMode: mockGetEffectiveGlobalMode,
  isKillSwitchActive: mockIsKillSwitchActive,
}));

const RiskGateService = (await import('../../services/risk-gate.js')).default;

describe('RiskGateService runtime SSOT', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockGetEffectiveGlobalMode.mockReset();
    mockIsKillSwitchActive.mockReset();
  });

  it('fail-closed when kill switch active', async () => {
    mockGetEffectiveGlobalMode.mockResolvedValue('demo');
    mockIsKillSwitchActive.mockResolvedValue(true);
    const gate = new RiskGateService({ query: mockQuery });
    const result = await gate.checkRiskGate({ symbol: 'BTC/USDT', side: 'buy', amount: 1, price: 100 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('RISK_GATE_ERROR_FAIL_CLOSED');
  });

  it('fail-closed when runtime SSOT unavailable', async () => {
    mockGetEffectiveGlobalMode.mockRejectedValue(new Error('DB down'));
    mockIsKillSwitchActive.mockRejectedValue(new Error('DB down'));
    const gate = new RiskGateService({ query: mockQuery });
    const result = await gate.checkRiskGate({ symbol: 'BTC/USDT', side: 'buy', amount: 1, price: 100 });
    expect(result.allowed).toBe(false);
  });

  it('fail-open on demo sim when kill switch off and mode demo', async () => {
    mockGetEffectiveGlobalMode.mockResolvedValue('demo');
    mockIsKillSwitchActive.mockResolvedValue(false);
    const gate = new RiskGateService({ query: mockQuery });
    const result = await gate.checkRiskGate({ symbol: 'BTC/USDT', side: 'buy', amount: 1, price: 100 });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('RISK_GATE_ERROR_FAIL_OPEN');
  });

  it('does not read TRADING_MODE env — uses runtime service', async () => {
    process.env.TRADING_MODE = 'live';
    mockGetEffectiveGlobalMode.mockResolvedValue('demo');
    mockIsKillSwitchActive.mockResolvedValue(true);
    const gate = new RiskGateService({ query: mockQuery });
    const result = await gate.checkRiskGate({ symbol: 'BTC/USDT', side: 'buy', amount: 1, price: 100 });
    expect(result.allowed).toBe(false);
    delete process.env.TRADING_MODE;
  });
});
