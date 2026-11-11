import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EMERGENCY_STOP_DECISIONS,
  createOperationalEmergencyStop,
} from '../src/operationalEmergencyStop.js';
import { createInjectedClock as createClock } from '../src/operationalResourceLeaseAuthority.js';

describe('S2 operationalEmergencyStop offline contract', () => {
  it('1) default inactive allows; activation is sticky', () => {
    const clock = createClock(1_000);
    const stop = createOperationalEmergencyStop({ clock, ttlMs: 10_000 });
    assert.equal(stop.assertNotStopped().ok, true);
    const activated = stop.activate({ reason: 'OWNER_KILL' });
    assert.equal(activated.ok, true);
    assert.equal(activated.sticky, true);
    assert.equal(stop.isStopped().decision, EMERGENCY_STOP_DECISIONS.DENY_ACTIVE);
    assert.equal(stop.assertNotStopped().ok, false);
  });

  it('2) untrusted reset is denied while sticky', () => {
    const clock = createClock(1_000);
    const stop = createOperationalEmergencyStop({ clock });
    stop.activate({ reason: 'STOP' });
    const reset = stop.attemptReset({ actor: 'worker', privileged: true });
    assert.equal(reset.ok, false);
    assert.equal(reset.decision, EMERGENCY_STOP_DECISIONS.DENY_UNTRUSTED_RESET);
    assert.equal(stop.isStopped().ok, false);
  });

  it('3) no Worker/MCP side-effect flags', () => {
    const stop = createOperationalEmergencyStop();
    assert.equal(stop.workerSideEffects, false);
    assert.equal(stop.mcpSideEffects, false);
    assert.equal(stop.processLocal, true);
  });

  it('4) lifetime expiry clears sticky stop via clock', () => {
    const clock = createClock(1_000);
    const stop = createOperationalEmergencyStop({ clock, ttlMs: 5_000 });
    stop.activate({});
    clock.setNowMs(7_000);
    assert.equal(stop.isStopped().ok, true);
  });
});
