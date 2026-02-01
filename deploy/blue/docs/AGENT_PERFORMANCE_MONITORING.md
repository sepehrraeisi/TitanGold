# Agent Performance Monitoring Documentation

## Overview

The Agent Performance Monitoring system tracks execution metrics for all AI agents in TitanGold, providing visibility into performance, reliability, and cache effectiveness. This feature integrates with Prometheus for metrics collection and Grafana for visualization.

**Date**: 2026-01-31  
**Task**: BACKEND-021  
**Status**: Production Ready  
**Dependencies**: INFRA-006 (Metrics endpoint)

---

## Table of Contents

1. [Features](#features)
2. [Metrics](#metrics)
3. [Architecture](#architecture)
4. [Integration](#integration)
5. [Grafana Dashboard](#grafana-dashboard)
6. [Alerting](#alerting)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Features

### Core Features (Definition of Done)

1. **✅ Metrics per Agent (DoD #1)**
   - **execution_time**: Duration of agent runs (seconds)
   - **error_rate**: Percentage of failed executions (0-100%)
   - **cache_hit_rate**: Cache effectiveness (0-100%)
   - Additional metrics: active executions, quantiles, totals

2. **✅ Exposed in `/metrics` Endpoint (DoD #2)**
   - Prometheus-compatible format
   - Available at `GET /metrics`
   - Auto-registered with existing metrics infrastructure
   - No authentication required (internal endpoint)

3. **✅ Grafana Dashboard Example (DoD #3)**
   - Pre-built JSON dashboard configuration
   - 10 panels covering all key metrics
   - Real-time updates with 30s refresh
   - Import-ready for Grafana

4. **✅ Alerts for High Error Rate (DoD #4)**
   - Prometheus alerting rules (YAML)
   - Multiple severity levels (info, warning, critical)
   - Configurable thresholds
   - Runbook links for response

5. **✅ Documentation (DoD #5)**
   - Complete monitoring guide (this file)
   - Integration instructions
   - Dashboard setup
   - Alert configuration
   - Best practices

---

## Metrics

### Primary Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `titangold_agent_execution_time_seconds` | Summary | Agent execution duration with quantiles (p50, p90, p95, p99) | `agent_key`, `agent_id` |
| `titangold_agent_error_rate_percent` | Gauge | Current error rate percentage (0-100) | `agent_key`, `agent_id` |
| `titangold_agent_cache_hit_rate_percent` | Gauge | Current cache hit rate percentage (0-100) | `agent_key`, `agent_id` |
| `titangold_agent_last_execution_seconds` | Gauge | Most recent execution time | `agent_key`, `agent_id` |
| `titangold_agent_active_executions` | Gauge | Number of currently running executions | `agent_key`, `agent_id` |

### Counter Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `titangold_agent_success_total` | Counter | Total successful executions | `agent_key`, `agent_id` |
| `titangold_agent_errors_total` | Counter | Total failed executions | `agent_key`, `agent_id`, `error_type` |
| `titangold_agent_cache_hits_total` | Counter | Total cache hits | `agent_key`, `agent_id` |
| `titangold_agent_cache_misses_total` | Counter | Total cache misses | `agent_key`, `agent_id` |

### Error Types

- `timeout`: Execution exceeded time limit
- `validation`: Input validation failed
- `internal`: Internal agent error
- `unknown`: Unclassified error

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent Registry                     │
│  (services/agents/registry.js)                          │
│                                                          │
│  runAgent(agent_key, params)                            │
│    ├─ Start metrics tracking                            │
│    ├─ Execute agent.run()                               │
│    ├─ Detect cache hit/miss                             │
│    ├─ Detect success/failure                            │
│    └─ End metrics tracking                              │
└─────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│            Agent Metrics Middleware                      │
│  (middleware/agentMetrics.js)                           │
│                                                          │
│  • startAgentExecution()                                │
│  • endAgentExecution()                                  │
│  • Calculate rates                                      │
│  • Update Prometheus metrics                            │
└─────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Prometheus Registry                         │
│  (middleware/metrics.js)                                │
│                                                          │
│  • Collect metrics                                      │
│  • Expose at /metrics                                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   Prometheus                            │
│  • Scrape /metrics endpoint every 15s                   │
│  • Evaluate alerting rules                              │
│  • Store time-series data                               │
└─────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                     Grafana                             │
│  • Visualize metrics                                    │
│  • Display dashboards                                   │
│  • Send alert notifications                             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Agent Execution**: Registry calls `startAgentExecution()`
2. **Tracking**: Middleware records start time, increments active count
3. **Completion**: Agent finishes, calls `endAgentExecution()`
4. **Metrics Update**: Middleware updates counters, gauges, summaries
5. **Calculation**: Error rate and cache hit rate calculated
6. **Exposure**: Metrics available at `/metrics` endpoint
7. **Scraping**: Prometheus scrapes metrics every 15s
8. **Visualization**: Grafana displays metrics in dashboards
9. **Alerting**: Prometheus evaluates rules, sends alerts

---

## Integration

### Automatic Integration

The monitoring system is automatically integrated into the agent registry. No additional code is required in individual agent implementations.

**How It Works**:
1. Registry wraps all `runAgent()` calls
2. Metrics tracking starts before execution
3. Metrics tracking ends after execution
4. Success/failure/cache status automatically detected

### Agent Implementation Requirements

**None** - Agents don't need to change!

The system automatically detects:
- **Cache hits**: Checks for `result._meta.cached = true`
- **Errors**: Catches exceptions and classifies error type
- **Execution time**: Measured with `process.hrtime.bigint()`

### Manual Cache Recording (Optional)

If you need to record cache operations outside of agent execution:

```javascript
import { recordAgentCacheHit, recordAgentCacheMiss } from '../middleware/agentMetrics.js';

// Record cache hit
recordAgentCacheHit('technical', 'agent-123');

// Record cache miss
recordAgentCacheMiss('technical', 'agent-123');
```

---

## Grafana Dashboard

### Import Dashboard

1. **Open Grafana**: Navigate to your Grafana instance
2. **Import**: Click "+" → "Import"
3. **Upload JSON**: Upload `backend/monitoring/grafana-agent-dashboard.json`
4. **Select Datasource**: Choose your Prometheus datasource
5. **Import**: Click "Import"

### Dashboard Panels

The dashboard includes 10 panels:

1. **Agent Execution Times (Last 1h)**: Line graph showing p50 and p95 execution times
2. **Agent Error Rates**: Line graph with alert threshold (10%)
3. **Agent Cache Hit Rates**: Line graph showing cache effectiveness
4. **Agent Executions (Rate)**: Success and error rates over time
5. **Active Agent Executions**: Real-time active execution count
6. **Agent Last Execution Time**: Stat panel with color thresholds
7. **Total Agent Executions**: Total successful executions counter
8. **Total Agent Errors**: Total error count with thresholds
9. **Cache Hits**: Total cache hits counter
10. **Cache Misses**: Total cache misses counter

### Customization

**Time Range**: Default 1 hour, adjustable
**Refresh Rate**: Default 30s, adjustable
**Alerts**: Panel 2 (Error Rates) includes built-in alert

---

## Alerting

### Prometheus Alert Rules

Alert rules are defined in `backend/monitoring/prometheus-agent-alerts.yml`.

### Alert Categories

1. **Error Rate Alerts**
   - `AgentHighErrorRate`: > 10% for 5 minutes (warning)
   - `AgentCriticalErrorRate`: > 50% for 2 minutes (critical)

2. **Performance Alerts**
   - `AgentSlowExecution`: > 30s for 5 minutes (warning)
   - `AgentVerySlowExecution`: > 60s for 2 minutes (critical)
   - `AgentHighP95Latency`: P95 > 10s for 5 minutes (warning)

3. **Cache Alerts**
   - `AgentLowCacheHitRate`: < 30% with 10+ ops (warning)

4. **Failure Alerts**
   - `AgentRepeatedFailures`: 5+ failures in 5 minutes (warning)
   - `AgentTimeoutErrors`: Frequent timeouts (warning)
   - `AgentValidationErrors`: Frequent validation errors (info)

5. **Concurrency Alerts**
   - `AgentTooManyActiveExecutions`: > 10 active for 5 minutes (warning)

6. **Inactivity Alerts**
   - `AgentNoRecentExecutions`: No execution in 1 hour (info)

### Configure Prometheus

Add to `prometheus.yml`:

```yaml
rule_files:
  - "/etc/prometheus/rules/titangold-agent-alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'alertmanager:9093'
```

### Alert Notifications

Configure AlertManager to send notifications:

```yaml
receivers:
  - name: 'titangold-team'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#titangold-alerts'
        title: 'TitanGold Agent Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

route:
  group_by: ['alertname', 'agent_key']
  receiver: 'titangold-team'
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
```

---

## API Reference

### `startAgentExecution(agent_key, agent_id)`

Start tracking metrics for an agent execution.

**Parameters**:
- `agent_key` (string): Agent identifier (e.g., 'technical', 'risk')
- `agent_id` (string): Agent database ID

**Returns**: `function` - End function to call when execution completes

**Example**:
```javascript
import { startAgentExecution } from '../middleware/agentMetrics.js';

const endMetrics = startAgentExecution('technical', '123');

try {
  const result = await agent.run(params);
  const cacheHit = result._meta?.cached || false;
  endMetrics(true, null, cacheHit); // success
} catch (error) {
  const errorType = classifyError(error);
  endMetrics(false, errorType, false); // failure
}
```

### `endAgentExecution(success, error_type, cache_hit)`

**Parameters**:
- `success` (boolean): Whether execution succeeded
- `error_type` (string|null): Error type if failed ('timeout', 'validation', 'internal')
- `cache_hit` (boolean): Whether result came from cache

### `getAgentMetrics(agent_key, agent_id)`

Get current statistics for a specific agent.

**Returns**: Object with metrics:
```javascript
{
  agent_key: 'technical',
  agent_id: '123',
  total_executions: 1000,
  successful_executions: 950,
  failed_executions: 50,
  error_rate: '5.00%',
  cache_hits: 750,
  cache_misses: 250,
  cache_hit_rate: '75.00%',
  average_execution_time: '2.345s',
  last_execution_time: '1.234s',
  last_updated: '2026-01-31T12:34:56.789Z'
}
```

### `getAllAgentMetrics()`

Get metrics for all agents.

**Returns**: Array of agent metrics objects

### `getAgentsWithHighErrorRate(threshold, minExecutions)`

Get agents exceeding error rate threshold.

**Parameters**:
- `threshold` (number): Error rate percentage (default: 10)
- `minExecutions` (number): Minimum executions to consider (default: 10)

**Returns**: Array of agents with high error rates, sorted by error rate (descending)

### `getAgentsWithLowCacheHitRate(threshold, minOperations)`

Get agents below cache hit rate threshold.

**Parameters**:
- `threshold` (number): Cache hit rate percentage (default: 50)
- `minOperations` (number): Minimum cache operations to consider (default: 10)

**Returns**: Array of agents with low cache hit rates, sorted by hit rate (ascending)

---

## Best Practices

### For Operators

1. **Monitor Error Rates Daily**
   - Check Grafana dashboard each morning
   - Investigate any error rate > 5%
   - Review logs for error patterns

2. **Set Up Alerts**
   - Configure Slack/email notifications
   - Define on-call rotation
   - Document escalation procedures

3. **Review Cache Hit Rates Weekly**
   - Aim for > 70% cache hit rate
   - Identify agents with poor caching
   - Optimize cache strategies

4. **Track Performance Trends**
   - Monitor P95 latency trends
   - Identify performance degradation early
   - Capacity plan based on trends

5. **Regular Health Checks**
   - Review dashboard weekly
   - Check for stuck executions
   - Verify all agents are active

### For Developers

1. **Return Cache Metadata**
   - Include `_meta.cached = true` in cached results
   - Helps track cache effectiveness
   - Automatic detection by monitoring

2. **Use Appropriate Error Types**
   - Throw specific error types (TimeoutError, ValidationError)
   - Helps classify failures
   - Improves alert accuracy

3. **Optimize Slow Agents**
   - If execution time > 10s, investigate
   - Consider async processing
   - Implement caching where possible

4. **Test Error Scenarios**
   - Test timeout handling
   - Test validation errors
   - Verify metrics are recorded

5. **Monitor During Deployment**
   - Watch error rates after deployment
   - Check for performance regressions
   - Rollback if error rate spikes

---

## Troubleshooting

### High Error Rate

**Symptom**: Agent error rate > 10%

**Possible Causes**:
1. Invalid input parameters
2. External API failures
3. Database connection issues
4. Timeout settings too aggressive
5. Recent code deployment

**Solutions**:
1. Check recent logs for error patterns
2. Verify external dependencies are healthy
3. Review input validation logic
4. Increase timeout if appropriate
5. Consider rollback if related to deployment

---

### Low Cache Hit Rate

**Symptom**: Cache hit rate < 30%

**Possible Causes**:
1. Cache TTL too short
2. High parameter variability
3. Cache eviction too aggressive
4. New features bypassing cache
5. Cache warming not implemented

**Solutions**:
1. Increase cache TTL
2. Normalize cache keys better
3. Increase cache size
4. Implement cache warming
5. Review cache strategy

---

### Slow Execution Times

**Symptom**: P95 latency > 10s

**Possible Causes**:
1. Database query performance
2. External API latency
3. Inefficient algorithms
4. Large data processing
5. Resource contention

**Solutions**:
1. Add database indexes
2. Implement API caching
3. Optimize algorithms
4. Process data in batches
5. Scale horizontally

---

### No Metrics for Agent

**Symptom**: Agent doesn't appear in dashboard

**Possible Causes**:
1. Agent not executed yet
2. Agent not using registry
3. Metrics endpoint not scraped
4. Wrong agent_key or agent_id

**Solutions**:
1. Execute agent at least once
2. Verify agent uses `runAgent()` from registry
3. Check Prometheus is scraping `/metrics`
4. Verify agent_key matches AGENT_MODULES

---

### Metrics Not Updating

**Symptom**: Metrics stuck at old values

**Possible Causes**:
1. Prometheus not scraping
2. Backend server restarted (in-memory stats reset)
3. Network issues
4. Metrics endpoint returning errors

**Solutions**:
1. Check Prometheus targets are "UP"
2. Restart backend (stats will rebuild)
3. Verify network connectivity
4. Check backend logs for errors

---

## Prometheus Queries

### Example Queries

**Agent Error Rate**:
```promql
titangold_agent_error_rate_percent{agent_key="technical"}
```

**Top 5 Slowest Agents**:
```promql
topk(5, titangold_agent_execution_time_seconds{quantile="0.95"})
```

**Error Rate Over Time**:
```promql
rate(titangold_agent_errors_total[5m])
```

**Cache Hit Rate Across All Agents**:
```promql
avg(titangold_agent_cache_hit_rate_percent)
```

**Agents with Errors in Last Hour**:
```promql
increase(titangold_agent_errors_total[1h]) > 0
```

---

## Changelog

### v1.0.0 (2026-01-31) - Initial Release
- ✅ DoD #1: Metrics per agent (execution_time, error_rate, cache_hit_rate)
- ✅ DoD #2: Exposed in `/metrics` endpoint
- ✅ DoD #3: Grafana dashboard example
- ✅ DoD #4: Alerts for high error rate
- ✅ DoD #5: Complete documentation

---

## Support

For issues or questions:
- Check this documentation first
- Review Grafana dashboard for metrics
- Check Prometheus alerts
- Review backend logs
- Contact DevOps team

---

## License

Copyright © 2026 TitanGold. All rights reserved.

---

**End of Documentation**
