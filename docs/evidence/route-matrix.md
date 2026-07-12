# Route Enforcement Matrix

Generated: 2026-07-12T17:29:42.702Z

| Status | Count |
|--------|-------|
| pass | 35 |
| fail | 13 |
| blocked | 10 |
| deprecated | 8 |
| notApplicable | 0 |

## Routes

| Method | Path | Status | Auth | Capability | Side Effect | Unit Test | Integration Test |
|--------|------|--------|------|------------|-------------|-----------|------------------|
| POST | `/api/v1/ai-agents/chat` | FAIL | authenticate | NONE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/run-v2` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/run` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/run-OLD` | DEPRECATED AND DISABLED | authenticate | NONE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/command` | DEPRECATED AND DISABLED | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/ai-agents/:id/config` | DEPRECATED AND DISABLED | authenticateStrict, requireCapability(CAP.AI_AGENT_CONFIGURE) | CAP.AI_AGENT_CONFIGURE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/:id/details` | DEPRECATED AND DISABLED | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/manager-overview` | DEPRECATED AND DISABLED | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents` | DEPRECATED AND DISABLED | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/:id` | DEPRECATED AND DISABLED | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/ai-agents/:id` | DEPRECATED AND DISABLED | authenticateStrict, requireCapability(CAP.AI_AGENT_ENABLE_DISABLE, CAP.AI_AGENT_CONFIGURE) | CAP.AI_AGENT_ENABLE_DISABLE, CAP.AI_AGENT_CONFIGURE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/status` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/agents/liquidity/run` | PASS | authenticate | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/runs/latest` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/runs` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/metrics` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/settings` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/agents/liquidity/settings` | PASS | authenticate | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/health` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/state` | FAIL | authenticate | NONE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/state` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_STATE_WRITE) | CAP.ARTEMIS_STATE_WRITE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/scenarios` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/artemis/decision` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_DECISION_EXECUTE) | CAP.ARTEMIS_DECISION_EXECUTE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/config/decision-engine` | FAIL | authenticate, authorize('admin') | NONE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/logs` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/artemis/logs` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/artemis/config` | FAIL | authenticate, authorize('admin') | NONE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/learning` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/learning/mistake/:id/mark-learned` | PASS | authenticate | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/artemis/learning/event` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/orchestration` | FAIL | authenticate | NONE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/autopilot/status` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/enable` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/disable` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/autopilot/suggestions` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/approve` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/reject` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/rollback` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/run-once` | FAIL | NONE | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/settings/trading-mode` | BLOCKED | authenticate | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/trading-mode` | BLOCKED | authenticate | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/settings/execution-runtime` | BLOCKED | authenticateStrict | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/execution-runtime/mode` | PASS | authenticateStrict, requireCapability(CAP.RUNTIME_MODE_WRITE) | CAP.RUNTIME_MODE_WRITE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/execution-runtime/kill-switch` | PASS | authenticateStrict, requireCapability(CAP.KILL_SWITCH_CONTROL) | CAP.KILL_SWITCH_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/settings` | BLOCKED | NONE | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/settings/:key` | BLOCKED | NONE | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/settings/:key` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/settings/bulk` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/settings/:key` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/scheduler/status` | BLOCKED | authenticate | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/scheduler/start` | PASS | authenticate, authorize('admin', 'trader') | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/scheduler/stop` | PASS | authenticate, authorize('admin', 'trader') | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| PUT | `/api/v1/scheduler/config/:section` | PASS | authenticate, authorize('admin', 'trader') | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/scheduler/config` | BLOCKED | authenticate | NONE | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/trading-engine/status` | BLOCKED | authenticateStrict | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/trading-engine/emergency-stop` | PASS | authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.KILL_SWITCH_CONTROL) | CAP.KILL_SWITCH_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/trading-engine/emergency-stop/clear` | PASS | authenticateStrict, authorize('admin'), requireCapability(CAP.KILL_SWITCH_CONTROL) | CAP.KILL_SWITCH_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/trades/active` | BLOCKED | authenticateStrict, authenticateStrict | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/opportunities` | PASS | authenticateStrict, authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL) | CAP.TRADING_ENGINE_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| PUT | `/api/v1/trading-engine/config` | PASS | authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL), authenticateStrict | CAP.TRADING_ENGINE_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/config` | BLOCKED | authenticateStrict | NONE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/topic-routing` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ) | CAP.TOPIC_ROUTING_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/topic-routing` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/topic-routing/:id` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/topic-routing/:id` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/topic-routing/logs` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ) | CAP.TOPIC_ROUTING_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |