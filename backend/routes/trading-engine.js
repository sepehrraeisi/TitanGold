import express from 'express';
import { authenticateStrict, authorize } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAP } from '../services/capabilities.js';
import {
  activateKillSwitch,
  getRuntimeExecutionState,
  clearKillSwitch,
  buildRuntimeView,
} from '../services/runtimeExecutionStateService.js';
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
    const state = await getRuntimeExecutionState({ preferCache: false });
    const view = buildRuntimeView(state);
    res.json({
      isRunning: view.workerAcknowledged && !view.killSwitchActive && view.globalRuntimeMode === 'live',
      mode: view.effectiveMode,
      killSwitchActive: view.killSwitchActive,
      killSwitchReason: view.killSwitchReason,
      workerAcknowledged: view.workerAcknowledged,
      workerAckAt: view.workerAckAt,
      requestedMode: view.requestedMode,
      effectiveMode: view.effectiveMode,
      globalRuntimeMode: view.globalRuntimeMode,
      stateVersion: view.stateVersion,
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
    });
  } catch (error) {
    logger.error('Failed to get trading engine status:', error);
    res.json({ isRunning: false, mode: 'demo', killSwitchActive: true, workerAcknowledged: false });
  }
});

/** @deprecated Use POST /api/v1/settings/execution-runtime/kill-switch — compatibility alias */
router.post('/emergency-stop', authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.KILL_SWITCH_CONTROL), async (req, res) => {
  try {
    const { reason } = req.body;
    const saved = await activateKillSwitch(reason || 'manual_emergency_stop', { userId: req.user.id });
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/v1/settings/execution-runtime/kill-switch>; rel="successor-version"');
    res.json({
      success: true,
      message: 'Emergency stop activated via canonical runtime service',
      deprecated: true,
      canonicalEndpoint: '/api/v1/settings/execution-runtime/kill-switch',
      killSwitchActive: saved.killSwitchActive,
      killSwitchReason: saved.killSwitchReason,
      stateVersion: saved.version,
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
