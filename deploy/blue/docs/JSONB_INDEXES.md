# JSONB Indexes Documentation

**Task:** DATABASE-002  
**Date:** 2026-01-06  
**Status:** ✅ Implemented  
**Purpose:** Performance optimization for JSONB column queries

---

## Table of Contents

1. [Overview](#overview)
2. [Indexes Created](#indexes-created)
3. [When Indexes Are Used](#when-indexes-are-used)
4. [Query Examples](#query-examples)
5. [Performance Impact](#performance-impact)
6. [Verification](#verification)
7. [Best Practices](#best-practices)
8. [Limitations](#limitations)
9. [Troubleshooting](#troubleshooting)

---

## Overview

GIN (Generalized Inverted Index) indexes have been added to all JSONB columns in the TitanGold database to improve query performance when filtering or searching within JSON data structures.

**Why GIN Indexes?**
- Optimized for JSONB containment queries (@>, <@, ?, ?|, ?&)
- Significantly faster than sequential scans for large datasets
- Automatically used by PostgreSQL query planner when beneficial
- Minimal maintenance overhead

---

## Indexes Created

| Table | Column | Index Name | Size | Purpose |
|-------|--------|------------|------|---------|
| `ai_agents` | `config` | `idx_ai_agents_config_gin` | 32 kB | Fast agent configuration queries |
| `ai_agents` | `metadata` | `idx_ai_agents_metadata_gin` | 40 kB | Fast agent metadata queries |
| `ai_decisions` | `input_data` | `idx_ai_decisions_input_data_gin` | Inherited | Fast decision input queries |
| `ai_decisions` | `output_data` | `idx_ai_decisions_output_data_gin` | Inherited | Fast decision output queries |

**Note:** ai_decisions is a partitioned table, so these indexes are automatically inherited by all partition tables (ai_decisions_2025_12, ai_decisions_2026_01, etc.).

---

## When Indexes Are Used

### Automatic Index Usage

GIN indexes are automatically used by PostgreSQL when you use these JSONB operators:

- **`@>` (contains)** - Most common, check if JSONB contains another JSONB
- **`<@` (is contained by)** - Check if JSONB is contained within another JSONB
- **`?` (key exists)** - Check if a key exists in JSONB
- **`?|` (any key exists)** - Check if any of the specified keys exist
- **`?&` (all keys exist)** - Check if all specified keys exist

### Query Planner Decisions

PostgreSQL's query planner automatically chooses between:
- **Index Scan:** For large tables or selective queries
- **Sequential Scan:** For small tables (<1000 rows typically) where seq scan is faster

**Important:** Even if a seq scan is chosen for current data size, the index will automatically be used as the table grows.

---

## Query Examples

### 1. Containment Query (@>) ✅ Most Efficient

```sql
-- Find all decisions where input contains symbol BTCUSDT
SELECT * FROM ai_decisions
WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb;

-- Find agents with specific config
SELECT * FROM ai_agents
WHERE config @> '{"enabled": true, "timeframe": "1h"}'::jsonb;

-- Complex containment with multiple keys
SELECT * FROM ai_decisions
WHERE output_data @> '{"signal": "BUY", "confidence": 0.9}'::jsonb;
```

### 2. Key Existence Query (?)

```sql
-- Find decisions that have a 'confidence' key in output
SELECT * FROM ai_decisions
WHERE output_data ? 'confidence';

-- Find agents with version metadata
SELECT * FROM ai_agents
WHERE metadata ? 'version';
```

### 3. Multiple Key Query (?&)

```sql
-- Find decisions with all required keys
SELECT * FROM ai_decisions
WHERE output_data ?& ARRAY['signal', 'confidence', 'reasoning'];

-- Find agents with required config keys
SELECT * FROM ai_agents
WHERE config ?& ARRAY['enabled', 'threshold', 'timeframe'];
```

### 4. Any Key Query (?|)

```sql
-- Find decisions with any of the specified keys
SELECT * FROM ai_decisions
WHERE input_data ?| ARRAY['symbol', 'pair', 'ticker'];
```

### 5. Path Query (->) ⚠️ May Not Use Index

```sql
-- Extract specific JSON path (may not use GIN index for deep paths)
SELECT * FROM ai_decisions
WHERE input_data->'params'->>'timeframe' = '1h';

-- Better approach: Use containment if possible
WHERE input_data @> '{"params": {"timeframe": "1h"}}'::jsonb;
```

---

## Performance Impact

### Expected Performance

| Dataset Size | Before GIN | After GIN | Improvement |
|--------------|------------|-----------|-------------|
| < 1,000 rows | ~0.5ms | ~0.5ms | 0% (seq scan faster) |
| 1,000 - 10,000 rows | ~50ms | ~5ms | 90% faster |
| 10,000 - 100,000 rows | ~500ms | ~10ms | 98% faster |
| > 100,000 rows | ~5000ms | ~20ms | 99.6% faster |

### Current TitanGold Dataset

- **ai_decisions:** 584 rows → Sequential scan currently faster
- **ai_agents:** 15 rows → Sequential scan currently faster

**As data grows, indexes will automatically be used.**

### Verified Index Usage

```sql
-- Example query plan showing index usage (for partition with 561 rows):
EXPLAIN SELECT * FROM ai_decisions 
WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb;

-- Result shows:
-- Bitmap Index Scan on ai_decisions_2026_01_input_data_idx
-- (Index IS being used for partitions with sufficient data)
```

---

## Verification

### Check if Indexes Exist

```sql
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE indexname IN (
    'idx_ai_agents_config_gin',
    'idx_ai_agents_metadata_gin',
    'idx_ai_decisions_input_data_gin',
    'idx_ai_decisions_output_data_gin'
);
```

### Check Index Sizes

```sql
SELECT 
    relname as table,
    indexrelname as index,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%_gin'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Verify Index Usage in Query Plans

```sql
-- Use EXPLAIN to see if index is used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ai_decisions
WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb;

-- Look for:
-- - "Bitmap Index Scan" or "Index Scan" = Index is being used ✅
-- - "Seq Scan" = Sequential scan (faster for small tables) ⚠️
```

### Monitor Index Usage

```sql
-- Check index usage statistics
SELECT 
    schemaname,
    relname,
    indexrelname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%_gin'
ORDER BY idx_scan DESC;
```

---

## Best Practices

### 1. Use Containment Operator (@>) When Possible

```sql
-- ✅ BEST: Uses GIN index efficiently
WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb

-- ❌ AVOID: Doesn't use GIN index
WHERE input_data->>'symbol' = 'BTCUSDT'
```

### 2. Combine with Other Filters

```sql
-- Combine JSONB filter with date filter for partition pruning
SELECT * FROM ai_decisions
WHERE created_at >= '2026-01-01'  -- Partition pruning
AND input_data @> '{"symbol": "BTCUSDT"}'::jsonb;  -- GIN index
```

### 3. Avoid Deep Path Queries

```sql
-- ❌ SLOW: Deep path traversal
WHERE data->'level1'->'level2'->'level3'->>'key' = 'value'

-- ✅ BETTER: Use containment
WHERE data @> '{"level1": {"level2": {"level3": {"key": "value"}}}}'::jsonb

-- ✅ BEST: Denormalize frequently accessed paths to columns
```

### 4. Keep JSONB Structure Consistent

```sql
-- ✅ GOOD: Consistent structure enables efficient queries
{"symbol": "BTCUSDT", "timeframe": "1h"}
{"symbol": "ETHUSDT", "timeframe": "1h"}

-- ❌ BAD: Inconsistent structure
{"symbol": "BTCUSDT", "timeframe": "1h"}
{"pair": "ETHUSDT", "interval": "1h"}  -- Different keys
```

### 5. Update Statistics Regularly

```sql
-- Update table statistics for query planner
ANALYZE ai_decisions;
ANALYZE ai_agents;
```

---

## Limitations

### 1. Small Table Performance

**Issue:** For tables with <1,000 rows, sequential scan is often faster than index scan due to overhead.

**Solution:** This is normal PostgreSQL behavior. Indexes will automatically be used as tables grow.

### 2. Deep JSON Path Queries

**Issue:** GIN indexes don't help with deep path queries like `->` `->>` chains.

**Solution:** Use containment queries (@>) or consider denormalizing frequently accessed paths.

### 3. Range Queries on JSON Values

**Issue:** GIN indexes don't help with range queries on JSONB values.

```sql
-- This won't use GIN index efficiently
WHERE (output_data->>'confidence')::numeric > 0.8
```

**Solution:** Consider expression indexes for specific paths:
```sql
CREATE INDEX idx_output_confidence 
ON ai_decisions ((output_data->>'confidence')::numeric);
```

### 4. Write Performance Overhead

**Impact:** ~5-10% slower INSERT/UPDATE operations due to index maintenance.

**Trade-off:** Much faster reads (90%+ improvement for large datasets) justify the write overhead.

---

## Troubleshooting

### Index Not Being Used?

**Check 1: Query uses supported operators**
```sql
-- ✅ Uses index
WHERE data @> '{"key": "value"}'::jsonb

-- ❌ Doesn't use index
WHERE data->>'key' = 'value'
```

**Check 2: Statistics are up to date**
```sql
ANALYZE ai_decisions;
ANALYZE ai_agents;
```

**Check 3: Table is large enough**
```sql
-- Check row count
SELECT COUNT(*) FROM ai_decisions;
-- If <1000 rows, seq scan may be faster (this is expected)
```

**Check 4: Force index usage (for testing)**
```sql
-- Temporarily disable seq scans to test index
SET enable_seqscan = OFF;
EXPLAIN SELECT * FROM ai_decisions WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb;
SET enable_seqscan = ON;
```

### Slow Queries Still?

**Option 1: Expression indexes for specific paths**
```sql
CREATE INDEX idx_input_symbol 
ON ai_decisions ((input_data->>'symbol'));
```

**Option 2: Partial indexes for common filters**
```sql
CREATE INDEX idx_buy_signals 
ON ai_decisions USING gin(output_data)
WHERE output_data @> '{"signal": "BUY"}'::jsonb;
```

**Option 3: Denormalize frequently accessed fields**
```sql
-- Add column for frequently queried JSON field
ALTER TABLE ai_decisions ADD COLUMN symbol VARCHAR(20);
UPDATE ai_decisions SET symbol = input_data->>'symbol';
CREATE INDEX idx_symbol ON ai_decisions(symbol);
```

---

## Maintenance

### Automatic Maintenance

GIN indexes are automatically maintained by PostgreSQL:
- **INSERT:** Index updated automatically
- **UPDATE:** Index updated if JSONB column changes
- **DELETE:** Index updated automatically
- **VACUUM:** Reclaims space from deleted entries

### Manual Maintenance (Rarely Needed)

```sql
-- Rebuild index if corrupted (very rare)
REINDEX INDEX idx_ai_agents_config_gin;

-- Check for index bloat
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_gin';
```

---

## Performance Testing Scripts

### Baseline Test (Before Indexes)
```bash
node scripts/test_jsonb_performance_before.js
```

### Performance Test (After Indexes)
```bash
node scripts/test_jsonb_performance.js
```

### Apply Migration
```bash
node scripts/apply_jsonb_migration.js
```

---

## References

- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [JSONB Operators](https://www.postgresql.org/docs/current/functions-json.html)
- [JSONB Indexing Strategies](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)

---

## Follow-Up Tasks

### Recommended

- **DATABASE-003:** Add expression indexes for frequently used JSON paths (e.g., `input_data->>'symbol'`)
- **MONITORING-001:** Set up index usage monitoring dashboard in Grafana
- **OPTIMIZATION-001:** Analyze and optimize complex JSONB queries with EXPLAIN ANALYZE

### Optional (As Data Grows)

- Create partial GIN indexes for common filter combinations
- Implement JSONB path denormalization for hot paths
- Set up alerting for index bloat (>50% unused space)

---

**Last Updated:** 2026-01-06  
**Maintained By:** TitanGold Database Team  
**Migration File:** `backend/database/migrations/007_add_jsonb_indexes.sql`
