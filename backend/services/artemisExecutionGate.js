/**
 * Production Artemis → Trading Engine eligibility predicate.
 * Shared by tradingEngine.js and WP-A safety tests. Pure. No provider I/O.
 */

const EXECUTABLE_ACTIONS = new Set(['BUY', 'SELL', 'EXECUTE']);

export function isArtemisActionExecutable(action) {
  return EXECUTABLE_ACTIONS.has(String(action || '').toUpperCase());
}

export function isArtemisDecisionExecutionAuthorized(decision) {
  const flagsOk = decision?.executionEligible === true && decision?.approvedForExecution === true;
  return flagsOk && isArtemisActionExecutable(decision?.action);
}
