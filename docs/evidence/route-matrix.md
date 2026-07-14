# Route Enforcement Matrix

Generated: 2026-07-14T08:49:09.759Z

| Status | Count |
|--------|-------|
| pass | 65 |
| fail | 0 |
| blocked | 0 |
| deprecated | 0 |
| notApplicable | 0 |

## Routes

| Method | Path | Status | Auth | Capability | Side Effect | Unit Test | Integration Test |
|--------|------|--------|------|------------|-------------|-----------|------------------|
| POST | `/api/v1/ai-agents/chat` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/run-v2` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/run` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/ai-agents/:id/command` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_EXECUTE_SAFE) | CAP.AI_AGENT_EXECUTE_SAFE | execution | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/ai-agents/:id/config` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_CONFIGURE) | CAP.AI_AGENT_CONFIGURE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/:id/details` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/manager-overview` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/ai-agents/:id` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/ai-agents/:id` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_ENABLE_DISABLE, CAP.AI_AGENT_CONFIGURE) | CAP.AI_AGENT_ENABLE_DISABLE, CAP.AI_AGENT_CONFIGURE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/status` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/agents/liquidity/run` | PASS | authenticate | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/runs/latest` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/runs` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/metrics` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/agents/liquidity/settings` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/agents/liquidity/settings` | PASS | authenticate | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/health` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/state` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/state` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_STATE_WRITE) | CAP.ARTEMIS_STATE_WRITE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/scenarios` | PASS | authenticate, authenticateStrict, requireCapability(CAP.ARTEMIS_DECISION_EXECUTE) | CAP.ARTEMIS_DECISION_EXECUTE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/artemis/decision` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_DECISION_EXECUTE) | CAP.ARTEMIS_DECISION_EXECUTE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/config/decision-engine` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_STATE_WRITE) | CAP.ARTEMIS_STATE_WRITE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/logs` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/artemis/logs` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/artemis/config` | PASS | authenticateStrict, requireCapability(CAP.ARTEMIS_STATE_WRITE) | CAP.ARTEMIS_STATE_WRITE | execution_or_mutation | agentExecutionPolicy.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/learning` | PASS | authenticate | NONE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PATCH | `/api/v1/artemis/learning/mistake/:id/mark-learned` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/artemis/learning/event` | PASS | authenticate, authorize('admin'), authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/artemis/orchestration` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/autopilot/status` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/enable` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/disable` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/autopilot/suggestions` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/approve` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/reject` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/suggestions/:id/rollback` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/autopilot/run-once` | PASS | authenticateStrict, requireCapability(CAP.AUTOPILOT_CONTROL) | CAP.AUTOPILOT_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/settings/trading-mode` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/trading-mode` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/settings/execution-runtime` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ), requireCapability(CAP.RUNTIME_MODE_WRITE) | CAP.AI_AGENT_READ, CAP.RUNTIME_MODE_WRITE | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/execution-runtime/mode` | PASS | authenticateStrict, requireCapability(CAP.RUNTIME_MODE_WRITE), requireCapability(CAP.KILL_SWITCH_CONTROL) | CAP.RUNTIME_MODE_WRITE, CAP.KILL_SWITCH_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/settings/execution-runtime/kill-switch` | PASS | authenticateStrict, requireCapability(CAP.KILL_SWITCH_CONTROL), requireCapability(CAP.AI_AGENT_READ) | CAP.KILL_SWITCH_CONTROL, CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/settings` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/settings/:key` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/settings/:key` | PASS | authenticateStrict, authorize('admin'), requireCapability(CAP.AI_AGENT_CONFIGURE), requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_CONFIGURE, CAP.AI_AGENT_READ | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/settings/bulk` | PASS | authenticate, authorize('admin') | NONE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/settings/:key` | PASS | authenticate, authorize('admin'), authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/scheduler/status` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ), requireCapability(CAP.SCHEDULER_CONTROL) | CAP.AI_AGENT_READ, CAP.SCHEDULER_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/scheduler/start` | PASS | authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL) | CAP.SCHEDULER_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| POST | `/api/v1/scheduler/stop` | PASS | authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL) | CAP.SCHEDULER_CONTROL | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| PUT | `/api/v1/scheduler/config/:section` | PASS | authenticateStrict, requireCapability(CAP.SCHEDULER_CONTROL), requireCapability(CAP.AI_AGENT_READ) | CAP.SCHEDULER_CONTROL, CAP.AI_AGENT_READ | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/scheduler/config` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | system_control | agentExecutionPolicy.test.js | schedulerWorkerSafety.integration.test.js |
| GET | `/api/v1/trading-engine/status` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/trading-engine/emergency-stop` | PASS | authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.KILL_SWITCH_CONTROL), authorize('admin') | CAP.KILL_SWITCH_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| POST | `/api/v1/trading-engine/emergency-stop/clear` | PASS | authenticateStrict, authorize('admin'), requireCapability(CAP.KILL_SWITCH_CONTROL), requireCapability(CAP.AI_AGENT_READ), authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL) | CAP.KILL_SWITCH_CONTROL, CAP.AI_AGENT_READ, CAP.TRADING_ENGINE_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/trades/active` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ), authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL) | CAP.AI_AGENT_READ, CAP.TRADING_ENGINE_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/opportunities` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ), authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL) | CAP.AI_AGENT_READ, CAP.TRADING_ENGINE_CONTROL | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| PUT | `/api/v1/trading-engine/config` | PASS | authenticateStrict, authorize('admin', 'trader'), requireCapability(CAP.TRADING_ENGINE_CONTROL), requireCapability(CAP.AI_AGENT_READ) | CAP.TRADING_ENGINE_CONTROL, CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/trading-engine/config` | PASS | authenticateStrict, requireCapability(CAP.AI_AGENT_READ) | CAP.AI_AGENT_READ | runtime_control | runtimeExecutionState.test.js | killSwitchReliability.integration.test.js |
| GET | `/api/v1/topic-routing` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ), requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_READ, CAP.TOPIC_ROUTING_WRITE | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| POST | `/api/v1/topic-routing` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| PUT | `/api/v1/topic-routing/:id` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| DELETE | `/api/v1/topic-routing/:id` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_WRITE) | CAP.TOPIC_ROUTING_WRITE | mutation | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |
| GET | `/api/v1/topic-routing/logs` | PASS | authenticateStrict, requireCapability(CAP.TOPIC_ROUTING_READ) | CAP.TOPIC_ROUTING_READ | read | authFailClosed.test.js | runtimeSafetyAuth.integration.test.js |