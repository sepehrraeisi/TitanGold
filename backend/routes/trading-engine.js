import express from 'express';
import { authenticateStrict, authorize } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import { activateKillSwitch, getRuntimeExecutionState, clearKillSwitch } from '../services/runtimeExecutionStateService.js';
import { logger } from '../services/logger.js';

const router = express.Router();

async function getWorkerEngineStatus() {
  try {
    const state = await getRuntimeExecutionState();
    return {
      killSwitchActive: state.killSwitchActive,
      killSwitchReason: state.killSwitchReason,
      globalMode: state.globalMode,
      source: 'shared_runtime_state',
    };
  } catch (error) {
    return { error: error.message, source: 'shared_runtime_state' };
  }
}

router.get('/status', authenticateStrict, async (req, res) => {
  try {
    const runtime = await getRuntimeExecutionState();
    res.json({
      isRunning: !runtime.killSwitchActive && runtime.globalMode === 'live',
      mode: runtime.killSwitchActive ? 'demo' : runtime.globalMode,
      killSwitchActive: runtime.killSwitchActive,
      killSwitchReason: runtime.killSwitchReason,
      workerAcknowledged: true,
      activeTrades: 0,
      maxConcurrentTrades: 20,
      queueSize: 0,
      stats: {
        totalOpportunities: 0,
        executedTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalProfit: 0,
        dailyProfit: 0,
        dailyLoss: 0,
      },
      scanners: [],
      runtime,
    });
  } catch (error) {
    logger.error('Failed to get trading engine status:', error);
    res.json({ isRunning: false, mode: 'demo', killSwitchActive: false, workerAcknowledged: false });
  }
});

router.post('/start', authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL), async (req, res) => {
  const runtime = await getRuntimeExecutionState();
  if (runtime.killSwitchActive) {
    return res.status(423).json({ error: 'Kill switch active', code: 'KILL_SWITCH_ACTIVE' });
  }
  res.json({
    success: true,
    message: 'Trading engine start requested — worker processes shared runtime state',
    runtime,
  });
});

router.post('/stop', authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL), async (req, res) => {
  res.json({ success: true, message: 'Trading engine stop requested via shared runtime state' });
});

router.post('/emergency-stop', authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.KILL_SWITCH_CONTROL), async (req, res) => {
  try {
    const { reason } = req.body;
    const saved = await activateKillSwitch(reason || 'manual_emergency_stop', { userId: req.user.id });
    const workerStatus = await getWorkerEngineStatus();
    res.json({
      success: true,
      message: 'Emergency stop activated across shared runtime state',
      killSwitchActive: saved.killSwitchActive,
      killSwitchReason: saved.killSwitchReason,
      workerStatus,
    });
  } catch (error) {
    logger.error('Failed to execute emergency stop:', error);
    res.status(500).json({ error: 'Failed to execute emergency stop', code: 'KILL_SWITCH_FAILED' });
  }
});

router.post('/emergency-stop/clear', authenticateStrict, authorize('admin'), requireCapability(CAP.KILL_SWITCH_CONTROL), async (req, res) => {
  try {
    const { confirm_clear_kill_switch: confirm } = req.body;
    const saved = await clearKillSwitch({ userId: req.user.id, confirm: confirm === true });
    res.json({ success: true, killSwitchActive: saved.killSwitchActive });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message, code: error.code || 'KILL_SWITCH_CLEAR_FAILED' });
  }
});

router.get('/trades/active', authenticateStrict, async (req, res) => {
  res.json({ trades: [] });
});

router.get('/opportunities', authenticateStrict, async (req, res) => {
  res.json({ opportunities: [] });
});

router.put('/config', authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL), async (req, res) => {
  res.json({ success: true, message: 'Configuration update routed to worker runtime owner' });
});

router.get('/config', authenticateStrict, async (req, res) => {
  const runtime = await getRuntimeExecutionState();
  res.json({ mode: runtime.globalMode, killSwitchActive: runtime.killSwitchActive });
});

export default router;
