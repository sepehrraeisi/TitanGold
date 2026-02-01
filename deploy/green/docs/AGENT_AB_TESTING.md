# Agent A/B Testing Guide

## Overview

TitanGold's A/B Testing framework allows you to run controlled experiments comparing different agent versions or configurations to determine which performs better based on real-world metrics.

**Task ID:** BACKEND-022  
**Status:** Production Ready  
**Last Updated:** 2026-01-31

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Creating Experiments](#creating-experiments)
4. [Running Experiments](#running-experiments)
5. [Analyzing Results](#analyzing-results)
6. [Statistical Significance](#statistical-significance)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Create an Experiment

```bash
# Create experiment comparing two agent versions
curl -X POST http://localhost:3001/api/experiments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Technical Agent v1.2 vs v1.3",
    "description": "Testing improved RSI calculation",
    "agent_key": "technical",
    "variants": [
      {
        "name": "control",
        "description": "Current v1.2 production version",
        "traffic_allocation": 0.5,
        "config": {
          "version": "1.2.0",
          "rsiPeriod": 14
        }
      },
      {
        "name": "treatment",
        "description": "New v1.3 with optimized RSI",
        "traffic_allocation": 0.5,
        "config": {
          "version": "1.3.0",
          "rsiPeriod": 12,
          "useSmoothing": true
        }
      }
    ],
    "target_sample_size": 1000,
    "min_effect_size": 0.05,
    "significance_level": 0.05
  }'
```

### 2. Run Agent with Experiment

Once an experiment is active, users will be automatically assigned to variants when running the agent:

```bash
curl -X POST http://localhost:3001/api/ai-agents/:agent_id/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "symbol": "BTC-USD",
    "timeframe": "1h",
    "experiment": "technical-v1.2-vs-v1.3"
  }'
```

### 3. Check Results

```bash
curl http://localhost:3001/api/experiments/:experiment_id/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Core Concepts

### Experiment

An A/B test comparing 2+ agent configurations or versions. Each experiment includes:
- **Agent Key**: Which agent to test (e.g., `technical`, `risk`)
- **Variants**: Different configurations to compare
- **Traffic Allocation**: Percentage of traffic per variant (must sum to 1.0)
- **Target Sample Size**: Minimum executions needed per variant
- **Statistical Parameters**: Significance level and minimum effect size

### Variant

A specific configuration being tested:
- **Control**: Typically the current production version (baseline)
- **Treatment(s)**: New versions or configurations being evaluated
- **Config Override**: JSON config merged with the agent's base config

### Assignment

Each user is **consistently assigned** to the same variant throughout the experiment duration:
- Uses deterministic hashing (user_id + experiment_id)
- No session-based switching
- Preserves user experience consistency

### Metrics Tracked

For each execution:
- `execution_time_ms`: How long the agent took to run
- `success`: Whether execution completed without errors
- `cache_hit`: Whether result was from cache
- `confidence`: Agent's confidence score (if available)
- `error_type`: Type of error if failed
- `custom_metrics`: Symbol, timeframe, and other context

---

## Creating Experiments

### Basic Experiment

```javascript
const experiment = {
  name: "Risk Agent Threshold Test",
  description: "Compare 5% vs 10% risk threshold",
  agent_key: "risk",
  variants: [
    {
      name: "control",
      description: "Current 5% threshold",
      traffic_allocation: 0.5,
      config: { riskThreshold: 0.05 }
    },
    {
      name: "treatment",
      description: "New 10% threshold",
      traffic_allocation: 0.5,
      config: { riskThreshold: 0.10 }
    }
  ],
  target_sample_size: 500,
  min_effect_size: 0.10,
  significance_level: 0.05
}
```

### Multi-Variant Experiment

You can test more than 2 variants:

```javascript
const experiment = {
  name: "Sentiment Threshold A/B/C Test",
  agent_key: "sentiment",
  variants: [
    {
      name: "conservative",
      traffic_allocation: 0.33,
      config: { sentimentThreshold: 0.7 }
    },
    {
      name: "moderate",
      traffic_allocation: 0.34,
      config: { sentimentThreshold: 0.5 }
    },
    {
      name: "aggressive",
      traffic_allocation: 0.33,
      config: { sentimentThreshold: 0.3 }
    }
  ]
}
```

### Experiment Lifecycle

```
CREATED → ACTIVE → PAUSED → COMPLETED
                   ↓
                 STOPPED
```

- **CREATED**: Experiment defined but not running
- **ACTIVE**: Currently running, assigning users and tracking metrics
- **PAUSED**: Temporarily stopped, can be resumed
- **COMPLETED**: Reached target sample size
- **STOPPED**: Manually terminated

---

## Running Experiments

### Automatic Assignment

When an experiment is active for an agent, users are **automatically assigned** to variants:

```javascript
// No code changes needed in agent execution!
// The routing layer handles assignment transparently

POST /api/ai-agents/:id/run
{
  "symbol": "ETH-USD",
  "timeframe": "4h"
}

// Response includes experiment info:
{
  "ok": true,
  "result": {...},
  "_experiment": {
    "experiment_key": "risk-threshold-test",
    "variant": "treatment",
    "is_new_assignment": false
  }
}
```

### Manual Variant Selection (for testing)

You can optionally force a specific variant:

```bash
curl -X POST http://localhost:3001/api/ai-agents/:agent_id/run \
  -d '{
    "symbol": "BTC-USD",
    "_force_variant": "treatment"
  }'
```

⚠️ **Warning**: Force variant assignments are excluded from statistical analysis.

---

## Analyzing Results

### Get Experiment Results

```bash
GET /api/experiments/:experiment_id/results
```

**Response:**

```json
{
  "experiment": {
    "id": "abc123",
    "name": "Technical Agent v1.2 vs v1.3",
    "status": "ACTIVE",
    "created_at": "2026-01-31T10:00:00Z"
  },
  "variants": [
    {
      "name": "control",
      "sample_size": 523,
      "metrics": {
        "avg_execution_time_ms": 145.3,
        "success_rate": 0.982,
        "avg_confidence": 0.75,
        "cache_hit_rate": 0.15,
        "error_rate": 0.018
      }
    },
    {
      "name": "treatment",
      "sample_size": 498,
      "metrics": {
        "avg_execution_time_ms": 132.7,
        "success_rate": 0.991,
        "avg_confidence": 0.78,
        "cache_hit_rate": 0.14,
        "error_rate": 0.009
      }
    }
  ],
  "statistical_analysis": {
    "success_rate": {
      "control": 0.982,
      "treatment": 0.991,
      "difference": 0.009,
      "p_value": 0.023,
      "is_significant": true,
      "confidence_interval": [0.001, 0.017]
    },
    "execution_time_ms": {
      "control": 145.3,
      "treatment": 132.7,
      "difference": -12.6,
      "p_value": 0.008,
      "is_significant": true,
      "confidence_interval": [-21.2, -4.0]
    }
  },
  "recommendation": {
    "winning_variant": "treatment",
    "confidence": "HIGH",
    "reason": "Treatment variant shows statistically significant improvements in both success rate (+0.9%) and execution time (-12.6ms)"
  }
}
```

### Export Results

```bash
GET /api/experiments/:experiment_id/results?format=csv

# Downloads CSV with full metrics breakdown
```

---

## Statistical Significance

### T-Test for Continuous Metrics

Used for metrics like `execution_time_ms`, `confidence`:

```javascript
// Null hypothesis: μ_treatment = μ_control
// Alternative: μ_treatment ≠ μ_control

const tTest = experiments.calculateTTest(
  controlValues,
  treatmentValues,
  { alpha: 0.05 } // 95% confidence
);

console.log(tTest);
// {
//   t_statistic: -2.43,
//   p_value: 0.016,
//   is_significant: true,
//   effect_size: 0.12,
//   confidence_interval: [-22.1, -3.1]
// }
```

### Chi-Square Test for Proportions

Used for metrics like `success_rate`, `cache_hit_rate`:

```javascript
const chiSquare = experiments.calculateChiSquare(
  { successes: 490, total: 500 }, // control
  { successes: 495, total: 500 }  // treatment
);

console.log(chiSquare);
// {
//   chi_square: 3.92,
//   p_value: 0.048,
//   is_significant: true,
//   effect_size: 0.01
// }
```

### Sample Size Calculator

Determine how many samples needed for reliable results:

```javascript
const requiredSamples = experiments.calculateRequiredSampleSize({
  baseline_rate: 0.95,        // Current success rate
  min_effect_size: 0.02,      // Want to detect 2% improvement
  significance_level: 0.05,   // 95% confidence
  power: 0.80                 // 80% power
});

console.log(requiredSamples); // 1570 per variant
```

### Power Analysis

Check if experiment has enough data:

```javascript
const power = experiments.calculatePower({
  sample_size: 500,
  observed_effect: 0.025,
  significance_level: 0.05
});

console.log(power);
// {
//   power: 0.73,
//   is_adequate: false, // Need power >= 0.80
//   recommended_sample_size: 650
// }
```

---

## API Reference

### Create Experiment

```
POST /api/experiments
```

**Request:**

```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "agent_key": "string (required)",
  "variants": [
    {
      "name": "string (required)",
      "description": "string (optional)",
      "traffic_allocation": 0.5,
      "config": {}
    }
  ],
  "target_sample_size": 1000,
  "min_effect_size": 0.05,
  "significance_level": 0.05
}
```

**Response:**

```json
{
  "ok": true,
  "experiment": {
    "id": "uuid",
    "key": "generated-key",
    "status": "CREATED"
  }
}
```

### Start Experiment

```
POST /api/experiments/:id/start
```

Activates the experiment and begins assigning users.

### Pause Experiment

```
POST /api/experiments/:id/pause
```

Temporarily stops new assignments (existing assignments remain).

### Complete Experiment

```
POST /api/experiments/:id/complete
```

Marks experiment as complete and stops new assignments.

### Get Experiment Results

```
GET /api/experiments/:id/results
```

Query parameters:
- `format`: `json` (default) or `csv`
- `include_raw`: Include raw metric data

### List Experiments

```
GET /api/experiments
```

Query parameters:
- `agent_key`: Filter by agent
- `status`: Filter by status (ACTIVE, COMPLETED, etc.)
- `limit`: Number of results (default 50)
- `offset`: Pagination offset

### Get User Assignment

```
GET /api/experiments/:experiment_key/assignment/:user_id
```

Returns the user's assigned variant.

---

## Best Practices

### 1. Define Clear Hypotheses

❌ **Bad:** "Let's test some config changes"

✅ **Good:** "Hypothesis: Reducing RSI period from 14 to 12 will improve signal accuracy by at least 5% without increasing false positives"

### 2. Choose Appropriate Sample Sizes

Use the sample size calculator based on:
- **Baseline metric value** (current performance)
- **Minimum detectable effect** (smallest improvement worth detecting)
- **Significance level** (typically 0.05 for 95% confidence)
- **Statistical power** (typically 0.80 for 80% power)

```javascript
// Example: Need to detect 3% improvement in 95% success rate
const samples = experiments.calculateRequiredSampleSize({
  baseline_rate: 0.95,
  min_effect_size: 0.03,
  significance_level: 0.05,
  power: 0.80
});
// Result: ~880 samples per variant
```

### 3. Run Experiments Long Enough

Consider:
- **Time of day effects**: Run for full 24h cycles
- **Day of week effects**: Include weekdays and weekends
- **Market conditions**: Include various volatility conditions

Minimum recommended duration: **7 days** or **1000 executions per variant**, whichever is longer.

### 4. Monitor for Novelty Effects

Early results may be skewed by:
- Cache warming
- User behavior changes
- System load differences

Check if results stabilize after the first 10-20% of data.

### 5. Avoid Peeking Too Early

**Multiple testing problem**: Checking results repeatedly increases false positive rate.

Solutions:
- Set a predefined analysis schedule (e.g., weekly)
- Use sequential testing methods
- Apply Bonferroni correction if checking multiple times

### 6. Test One Thing at a Time

❌ **Bad:** Change RSI period, MACD settings, and risk threshold simultaneously

✅ **Good:** Test RSI period change first, then test MACD separately

### 7. Document Everything

For each experiment, record:
- Hypothesis and expected outcome
- Configuration changes
- Start and end dates
- Results and decision rationale
- Rollout plan

### 8. Consider Segmentation

Analyze results by:
- User type (new vs experienced traders)
- Market conditions (volatile vs stable)
- Asset class (crypto, stocks, forex)
- Time of day

```javascript
// Example: Segment by volatility
const highVolatilityResults = experiments.getSegmentedResults(
  experimentId,
  { volatility: 'high' }
);
```

---

## Troubleshooting

### Experiment Not Assigning Users

**Symptom:** Agent runs successfully but no experiment assignment in response

**Causes:**
1. Experiment status is not ACTIVE
2. Agent key mismatch
3. Missing user ID in request

**Solutions:**
```bash
# Check experiment status
curl http://localhost:3001/api/experiments/:id

# Verify agent key matches
curl http://localhost:3001/api/ai-agents/:agent_id | jq '.agent_key'

# Ensure auth token is valid
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/auth/verify
```

### Inconsistent User Assignments

**Symptom:** Same user gets different variants on different calls

**Cause:** Assignment algorithm changed or experiment was recreated

**Solution:** Assignments are deterministic based on `user_id` + `experiment_id`. If experiment is deleted and recreated, users may get different assignments.

### Metrics Not Recording

**Symptom:** Experiment shows 0 samples despite agent executions

**Causes:**
1. Agent execution failing before metrics recorded
2. Database connection issues
3. Experiment metrics table not migrated

**Solutions:**
```bash
# Check agent execution logs
docker logs titangold-backend | grep "Experiment.*metric"

# Verify database migration
cd backend && npm run migrate

# Test metrics recording directly
curl -X POST http://localhost:3001/api/experiments/:id/test-metric
```

### Statistical Tests Show "Not Significant"

**Symptom:** Variants show different metrics but tests aren't significant

**Causes:**
1. Sample size too small
2. Effect size too small to detect reliably
3. High variance in data

**Solutions:**
```javascript
// Check statistical power
const power = experiments.calculatePower({
  sample_size: currentSamples,
  observed_effect: measuredDifference,
  significance_level: 0.05
});

if (power.power < 0.80) {
  console.log(`Need ${power.recommended_sample_size} samples per variant`);
}

// Check confidence intervals
const ci = experiments.getConfidenceInterval(variantData);
console.log(`95% CI: [${ci.lower}, ${ci.upper}]`);
```

### High Cache Hit Rate Affecting Results

**Symptom:** One variant has much higher cache hit rate

**Cause:** Cache keys include config parameters, so variants have separate caches

**Solution:** This is expected behavior. Consider:
- Including cache_hit_rate as a separate metric
- Running a "cache-primed" experiment where both variants warm caches first
- Analyzing non-cached executions separately

---

## Database Schema

### experiments Table

```sql
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  agent_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  target_sample_size INTEGER NOT NULL DEFAULT 1000,
  min_effect_size DECIMAL NOT NULL DEFAULT 0.05,
  significance_level DECIMAL NOT NULL DEFAULT 0.05,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);
```

### experiment_variants Table

```sql
CREATE TABLE experiment_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  traffic_allocation DECIMAL NOT NULL DEFAULT 0.5,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, name)
);
```

### experiment_assignments Table

```sql
CREATE TABLE experiment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, user_id)
);
```

### experiment_metrics Table

```sql
CREATE TABLE experiment_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES ai_agents(id),
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  confidence DECIMAL,
  error_type TEXT,
  error_message TEXT,
  custom_metrics JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiment_metrics_experiment ON experiment_metrics(experiment_id);
CREATE INDEX idx_experiment_metrics_variant ON experiment_metrics(variant_id);
CREATE INDEX idx_experiment_metrics_recorded ON experiment_metrics(recorded_at);
```

---

## Example Workflows

### Workflow 1: Test New Agent Version

```bash
# 1. Create experiment
EXPERIMENT_ID=$(curl -X POST http://localhost:3001/api/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sentiment v2.0 Testing",
    "agent_key": "sentiment",
    "variants": [
      {"name": "v1.9", "traffic_allocation": 0.5, "config": {"version": "1.9"}},
      {"name": "v2.0", "traffic_allocation": 0.5, "config": {"version": "2.0"}}
    ],
    "target_sample_size": 1000
  }' | jq -r '.experiment.id')

# 2. Start experiment
curl -X POST http://localhost:3001/api/experiments/$EXPERIMENT_ID/start

# 3. Wait for data collection (agents run automatically)
sleep 3600  # Wait 1 hour

# 4. Check results
curl http://localhost:3001/api/experiments/$EXPERIMENT_ID/results

# 5. If treatment wins, deploy new version
curl -X POST http://localhost:3001/api/experiments/$EXPERIMENT_ID/complete \
  -d '{"winner": "v2.0", "deploy": true}'
```

### Workflow 2: Optimize Configuration

```bash
# Test 3 risk threshold values
curl -X POST http://localhost:3001/api/experiments \
  -d '{
    "name": "Risk Threshold Optimization",
    "agent_key": "risk",
    "variants": [
      {"name": "conservative", "traffic_allocation": 0.33, "config": {"threshold": 0.03}},
      {"name": "moderate", "traffic_allocation": 0.34, "config": {"threshold": 0.05}},
      {"name": "aggressive", "traffic_allocation": 0.33, "config": {"threshold": 0.07}}
    ],
    "target_sample_size": 1500
  }'
```

---

## Performance Considerations

### Overhead

A/B testing adds minimal overhead:
- **Assignment lookup**: ~1-2ms (cached after first call)
- **Metrics recording**: ~3-5ms (async, doesn't block response)
- **Config merging**: <1ms

Total overhead: **~5-10ms per request** (< 5% for typical agent execution)

### Scalability

- Experiments table: Small (< 1000 rows typically)
- Variants table: Small (2-5 per experiment)
- Assignments table: Grows with users (indexed on experiment_id, user_id)
- Metrics table: Grows with executions (partitioned by month recommended for high volume)

### Optimization Tips

1. **Partition metrics table** by month:
```sql
CREATE TABLE experiment_metrics_2026_01 PARTITION OF experiment_metrics
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

2. **Archive completed experiments**:
```bash
npm run archive-experiments --older-than=90days
```

3. **Use read replicas** for analytics queries

---

## Integration Examples

### React Frontend

```typescript
import { useExperiment } from '@/hooks/useExperiment';

function TradingDashboard() {
  const { variant, experimentInfo } = useExperiment('technical');
  
  return (
    <div>
      {experimentInfo && (
        <div className="experiment-badge">
          🧪 Testing: {experimentInfo.name} (Variant: {variant})
        </div>
      )}
      
      <TechnicalAnalysisWidget agentKey="technical" />
    </div>
  );
}
```

### Python Analytics

```python
import requests

# Fetch experiment results
response = requests.get(
    'http://localhost:3001/api/experiments/abc123/results',
    headers={'Authorization': f'Bearer {token}'}
)

results = response.json()

# Analyze with pandas
import pandas as pd

df = pd.DataFrame(results['raw_metrics'])
df.groupby('variant_name').agg({
    'execution_time_ms': ['mean', 'std'],
    'success': 'mean',
    'confidence': 'mean'
})
```

---

## Compliance and Ethics

### User Consent

Ensure your Terms of Service cover:
- A/B testing for service improvement
- Transparent data usage
- Right to opt-out (if required by jurisdiction)

### Data Privacy

- Experiment metrics are anonymized
- User IDs are hashed in analytics exports
- Comply with GDPR, CCPA as applicable

### Fairness

- Ensure variants don't disadvantage users
- Monitor for unintended bias
- Provide opt-out mechanism if needed

---

## References

- [Statistical Significance Testing](https://en.wikipedia.org/wiki/Statistical_significance)
- [A/B Testing Best Practices](https://www.optimizely.com/optimization-glossary/ab-testing/)
- [Multiple Comparisons Problem](https://en.wikipedia.org/wiki/Multiple_comparisons_problem)
- [Power Analysis](https://en.wikipedia.org/wiki/Power_of_a_test)

---

## Support

- **Documentation**: `/docs/AGENT_AB_TESTING.md`
- **API Reference**: `/docs/API_REFERENCE.md#experiments`
- **GitHub Issues**: [TitanGold Issues](https://github.com/sepehrraeisi/TitanGold/issues)

---

**Last Updated:** 2026-01-31  
**Version:** 1.0.0  
**Task ID:** BACKEND-022
