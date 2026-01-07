# Prometheus Metrics Documentation - INFRA-006

## Overview

TitanGold backend exposes Prometheus metrics at the `/metrics` endpoint for monitoring and observability. The metrics include both default Node.js process metrics and custom application-specific metrics.

## Metrics Endpoint

**URL**: `http://localhost:5002/metrics`  
**Method**: `GET`  
**Format**: Prometheus exposition format (plain text)  
**Content-Type**: `text/plain; version=0.0.4`

## Available Metrics

### 1. Default Node.js Metrics

These metrics are automatically collected by `prom-client` and provide insights into the Node.js process:

#### Process CPU Usage
- **`titangold_process_cpu_user_seconds_total`**: Total user CPU time spent in seconds
- **`titangold_process_cpu_system_seconds_total`**: Total system CPU time spent in seconds

#### Memory Usage
- **`titangold_process_resident_memory_bytes`**: Resident memory size in bytes (RSS)
- **`titangold_process_heap_bytes`**: Process heap size in bytes
- **`titangold_nodejs_heap_size_total_bytes`**: Total heap size
- **`titangold_nodejs_heap_size_used_bytes`**: Used heap size
- **`titangold_nodejs_external_memory_bytes`**: External memory usage

#### Event Loop & Performance
- **`titangold_nodejs_eventloop_lag_seconds`**: Event loop lag in seconds
- **`titangold_nodejs_eventloop_lag_min_seconds`**: Minimum event loop lag
- **`titangold_nodejs_eventloop_lag_max_seconds`**: Maximum event loop lag
- **`titangold_nodejs_eventloop_lag_mean_seconds`**: Mean event loop lag

#### Garbage Collection
- **`titangold_nodejs_gc_duration_seconds`**: Garbage collection duration by GC type
  - Labels: `gctype` (e.g., `major`, `minor`, `incremental`, `weakcb`)

#### Other Process Metrics
- **`titangold_nodejs_version_info`**: Node.js version information
- **`titangold_process_start_time_seconds`**: Start time of the process since unix epoch

### 2. HTTP Request Metrics

#### Request Duration Histogram
**`titangold_http_request_duration_seconds`**
- **Type**: Histogram
- **Description**: Duration of HTTP requests in seconds
- **Labels**:
  - `method`: HTTP method (GET, POST, PUT, DELETE, etc.)
  - `route`: Normalized route path (e.g., `/api/v1/users/:id`)
  - `status_code`: HTTP status code (200, 404, 500, etc.)
- **Buckets**: 0.005s, 0.01s, 0.025s, 0.05s, 0.1s, 0.25s, 0.5s, 1s, 2.5s, 5s, 10s

**Example Query (PromQL)**:
```promql
# 95th percentile response time for all routes
histogram_quantile(0.95, sum(rate(titangold_http_request_duration_seconds_bucket[5m])) by (le, route))

# Average response time by status code
rate(titangold_http_request_duration_seconds_sum[5m]) / rate(titangold_http_request_duration_seconds_count[5m])
```

#### Request Counter
**`titangold_http_requests_total`**
- **Type**: Counter
- **Description**: Total number of HTTP requests
- **Labels**: `method`, `route`, `status_code`

**Example Query**:
```promql
# Request rate per second
rate(titangold_http_requests_total[5m])

# Error rate (5xx status codes)
rate(titangold_http_requests_total{status_code=~"5.."}[5m])
```

#### Active Requests Gauge
**`titangold_http_active_requests`**
- **Type**: Gauge
- **Description**: Number of HTTP requests currently being processed
- **Labels**: `method`, `route`

**Example Query**:
```promql
# Current active requests
sum(titangold_http_active_requests) by (route)
```

### 3. AI Agent Metrics

#### Agent Execution Duration
**`titangold_agent_execution_duration_seconds`**
- **Type**: Histogram
- **Description**: Duration of AI agent executions in seconds
- **Labels**:
  - `agent_type`: Type of agent (e.g., `technical`, `sentiment`, `arbitrage`)
  - `agent_id`: Unique agent identifier
  - `status`: Execution status (`success`, `error`, `timeout`)
- **Buckets**: 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s, 60s, 120s

**Example Query**:
```promql
# 99th percentile agent execution time
histogram_quantile(0.99, sum(rate(titangold_agent_execution_duration_seconds_bucket[5m])) by (le, agent_type))

# Average execution time by agent type
rate(titangold_agent_execution_duration_seconds_sum[5m]) / rate(titangold_agent_execution_duration_seconds_count[5m])
```

#### Agent Execution Counter
**`titangold_agent_executions_total`**
- **Type**: Counter
- **Description**: Total number of AI agent executions
- **Labels**: `agent_type`, `agent_id`, `status`

**Example Query**:
```promql
# Agent execution rate
rate(titangold_agent_executions_total[5m])

# Agent error rate
rate(titangold_agent_executions_total{status="error"}[5m]) / rate(titangold_agent_executions_total[5m])
```

### 4. Cache Metrics

#### Cache Operations Counter
**`titangold_cache_operations_total`**
- **Type**: Counter
- **Description**: Total number of cache operations
- **Labels**:
  - `operation`: Operation type (`get`, `set`, `delete`)
  - `result`: Operation result (`hit`, `miss`, `success`)

**Example Query**:
```promql
# Cache hit rate
rate(titangold_cache_operations_total{operation="get",result="hit"}[5m]) / 
rate(titangold_cache_operations_total{operation="get"}[5m])
```

#### Cache Hit Rate Gauge
**`titangold_cache_hit_rate_percent`**
- **Type**: Gauge
- **Description**: Cache hit rate as a percentage (0-100)
- **Labels**: None

**Example Query**:
```promql
# Current cache hit rate
titangold_cache_hit_rate_percent
```

**Usage in Code**:
```javascript
import { recordCacheHit, recordCacheMiss, recordCacheSet } from '../middleware/metrics.js';

// Record cache hit
const cachedValue = await redis.get(key);
if (cachedValue) {
  recordCacheHit();
  return JSON.parse(cachedValue);
} else {
  recordCacheMiss();
  const value = await fetchFromDB();
  await redis.set(key, JSON.stringify(value), 'EX', 3600);
  recordCacheSet();
  return value;
}
```

### 5. Database Metrics

#### Query Duration Histogram
**`titangold_db_query_duration_seconds`**
- **Type**: Histogram
- **Description**: Duration of database queries in seconds
- **Labels**: `query_type` (e.g., `SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- **Buckets**: 0.001s, 0.005s, 0.01s, 0.05s, 0.1s, 0.5s, 1s, 5s

**Example Query**:
```promql
# 95th percentile query duration
histogram_quantile(0.95, sum(rate(titangold_db_query_duration_seconds_bucket[5m])) by (le, query_type))
```

#### Connection Pool Metrics
- **`titangold_db_pool_active_connections`**: Number of active database connections
- **`titangold_db_pool_idle_connections`**: Number of idle database connections
- **`titangold_db_pool_waiting_requests`**: Number of requests waiting for a connection

**Example Query**:
```promql
# Database connection pool usage
titangold_db_pool_active_connections / (titangold_db_pool_active_connections + titangold_db_pool_idle_connections)
```

### 6. Trading Engine Metrics

#### Trade Execution Counter
**`titangold_trades_executed_total`**
- **Type**: Counter
- **Description**: Total number of trades executed
- **Labels**:
  - `exchange`: Exchange name (e.g., `binance`, `coinbase`)
  - `symbol`: Trading pair (e.g., `BTC/USDT`)
  - `side`: Trade side (`buy`, `sell`)
  - `status`: Execution status (`success`, `error`)

**Example Query**:
```promql
# Trade execution rate
rate(titangold_trades_executed_total[5m])

# Trade success rate
rate(titangold_trades_executed_total{status="success"}[5m]) / rate(titangold_trades_executed_total[5m])
```

#### Trade Execution Duration
**`titangold_trade_execution_duration_seconds`**
- **Type**: Histogram
- **Description**: Duration of trade execution in seconds
- **Labels**: `exchange`, `symbol`
- **Buckets**: 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s

### 7. WebSocket Metrics

#### Active WebSocket Connections
**`titangold_websocket_connections_active`**
- **Type**: Gauge
- **Description**: Number of active WebSocket connections
- **Labels**: `type` (e.g., `notifications`, `favorites`, `trades`)

**Example Query**:
```promql
# Total active WebSocket connections
sum(titangold_websocket_connections_active)
```

## Configuration

### Environment Variables

```bash
# Enable/disable metrics collection (default: enabled)
METRICS_ENABLED=true

# Metrics endpoint path (default: /metrics)
METRICS_PATH=/metrics
```

## Prometheus Configuration

### Scrape Configuration

Add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'titangold-backend'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /metrics
    static_configs:
      - targets: ['localhost:5002']
        labels:
          service: 'titangold-backend'
          environment: 'production'
```

### Recording Rules

Useful recording rules for Prometheus:

```yaml
groups:
  - name: titangold_recording_rules
    interval: 30s
    rules:
      # Request rate
      - record: titangold:http_requests:rate5m
        expr: rate(titangold_http_requests_total[5m])
      
      # Error rate
      - record: titangold:http_requests:error_rate5m
        expr: rate(titangold_http_requests_total{status_code=~"5.."}[5m])
      
      # P95 response time
      - record: titangold:http_request_duration:p95
        expr: histogram_quantile(0.95, sum(rate(titangold_http_request_duration_seconds_bucket[5m])) by (le, route))
      
      # Cache hit rate
      - record: titangold:cache:hit_rate
        expr: |
          rate(titangold_cache_operations_total{operation="get",result="hit"}[5m]) /
          rate(titangold_cache_operations_total{operation="get"}[5m])
```

### Alert Rules

Example alert rules:

```yaml
groups:
  - name: titangold_alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(titangold_http_requests_total{status_code=~"5.."}[5m]) /
          rate(titangold_http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
      
      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, sum(rate(titangold_http_request_duration_seconds_bucket[5m])) by (le, route)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time on {{ $labels.route }}"
          description: "P95 response time is {{ $value }}s (threshold: 2s)"
      
      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: titangold_cache_hit_rate_percent < 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}% (threshold: 50%)"
      
      # High event loop lag
      - alert: HighEventLoopLag
        expr: titangold_nodejs_eventloop_lag_mean_seconds > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High event loop lag"
          description: "Event loop lag is {{ $value }}s (threshold: 0.1s)"
      
      # High memory usage
      - alert: HighMemoryUsage
        expr: titangold_process_resident_memory_bytes / 1024 / 1024 / 1024 > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanize }}GB (threshold: 2GB)"
```

## Grafana Dashboard

### Example Dashboard Panels

#### 1. Request Rate
```promql
sum(rate(titangold_http_requests_total[5m])) by (route)
```

#### 2. Error Rate
```promql
sum(rate(titangold_http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(titangold_http_requests_total[5m]))
```

#### 3. P95 Response Time
```promql
histogram_quantile(0.95, sum(rate(titangold_http_request_duration_seconds_bucket[5m])) by (le, route))
```

#### 4. Active Requests
```promql
sum(titangold_http_active_requests)
```

#### 5. Cache Hit Rate
```promql
titangold_cache_hit_rate_percent
```

#### 6. Agent Execution Rate
```promql
sum(rate(titangold_agent_executions_total[5m])) by (agent_type)
```

#### 7. Memory Usage
```promql
titangold_process_resident_memory_bytes / 1024 / 1024
```

#### 8. Event Loop Lag
```promql
titangold_nodejs_eventloop_lag_mean_seconds * 1000
```

### Sample Grafana Dashboard JSON

A complete Grafana dashboard JSON is available at:
`backend/docs/grafana-dashboard-example.json` (see below)

## Testing Metrics

### View Metrics Endpoint
```bash
curl http://localhost:5002/metrics
```

### Specific Metric Queries

#### Check HTTP request duration
```bash
curl -s http://localhost:5002/metrics | grep titangold_http_request_duration_seconds
```

#### Check cache hit rate
```bash
curl -s http://localhost:5002/metrics | grep titangold_cache_hit_rate_percent
```

#### Check active requests
```bash
curl -s http://localhost:5002/metrics | grep titangold_http_active_requests
```

## Integration Examples

### Recording Agent Execution Time

```javascript
import { agentExecutionDuration, agentExecutionCounter } from '../middleware/metrics.js';

async function executeAgent(agentType, agentId, config) {
  const startTime = Date.now();
  let status = 'success';
  
  try {
    const result = await agent.run(config);
    return result;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record metrics
    agentExecutionDuration.observe(
      { agent_type: agentType, agent_id: agentId, status },
      duration
    );
    
    agentExecutionCounter.inc({
      agent_type: agentType,
      agent_id: agentId,
      status,
    });
  }
}
```

### Recording Database Queries

```javascript
import { dbQueryDuration } from '../middleware/metrics.js';

async function queryDatabase(sql, params) {
  const startTime = Date.now();
  const queryType = sql.trim().split(' ')[0].toUpperCase(); // SELECT, INSERT, etc.
  
  try {
    const result = await pool.query(sql, params);
    return result;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    dbQueryDuration.observe({ query_type: queryType }, duration);
  }
}
```

### Recording Trade Executions

```javascript
import { tradeExecutionCounter, tradeExecutionDuration } from '../middleware/metrics.js';

async function executeTrade(exchange, symbol, side, amount) {
  const startTime = Date.now();
  let status = 'success';
  
  try {
    const trade = await exchange.createOrder(symbol, 'market', side, amount);
    return trade;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    
    tradeExecutionDuration.observe({ exchange, symbol }, duration);
    tradeExecutionCounter.inc({ exchange, symbol, side, status });
  }
}
```

## Troubleshooting

### Metrics endpoint returns 500
- Check logs for errors: `grep "Failed to generate metrics" logs/combined-*.log`
- Verify prom-client is installed: `npm list prom-client`

### Metrics not updating
- Ensure metricsMiddleware is applied before routes
- Check that metric recording functions are being called
- Verify no errors in the metrics collection code

### High memory usage from metrics
- Reduce cardinality by normalizing label values
- Avoid high-cardinality labels (e.g., user IDs, timestamps)
- Use recording rules in Prometheus instead of storing raw metrics

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client GitHub](https://github.com/siimon/prom-client)
- [Grafana Prometheus Integration](https://grafana.com/docs/grafana/latest/datasources/prometheus/)
- [Best Practices for Naming Metrics](https://prometheus.io/docs/practices/naming/)

## Change Log

- **2026-01-07**: Initial implementation (INFRA-006)
  - Added prom-client integration
  - Exposed /metrics endpoint
  - Added default Node.js metrics (CPU, memory, event loop lag)
  - Added custom metrics: HTTP requests, agent execution, cache hit rate
  - Created documentation with examples and Grafana dashboard
