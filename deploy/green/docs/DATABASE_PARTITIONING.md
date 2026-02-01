# Database Partitioning - ai_decisions Table

**Task:** DATABASE-001  
**Date:** 2026-01-06  
**Status:** ✅ Implemented  

---

## Table of Contents

1. [Overview](#overview)
2. [Partitioning Strategy](#partitioning-strategy)
3. [Migration Process](#migration-process)
4. [Maintenance Procedures](#maintenance-procedures)
5. [Monitoring](#monitoring)
6. [Query Examples](#query-examples)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedure](#rollback-procedure)

---

## Overview

### Purpose

The `ai_decisions` table stores all AI agent decision logs in TitanGold. As the system scales, this table will grow rapidly, potentially impacting query performance and maintenance operations.

**Partitioning Benefits:**
- ✅ **Improved Query Performance:** Queries with date filters only scan relevant partitions (partition pruning)
- ✅ **Easier Data Management:** Old data can be archived/dropped by partition
- ✅ **Better Maintenance:** Index rebuilds, vacuums operate on smaller partitions
- ✅ **Scalability:** Handle millions of records efficiently

### Architecture

- **Partitioning Type:** RANGE partitioning
- **Partition Key:** `created_at` (TIMESTAMP WITH TIME ZONE)
- **Partition Interval:** Monthly
- **Retention:** Configurable (default: keep all partitions)

---

## Partitioning Strategy

### Partition Naming Convention

```
ai_decisions_YYYY_MM
```

**Examples:**
- `ai_decisions_2026_01` → January 2026 (2026-01-01 to 2026-02-01)
- `ai_decisions_2026_12` → December 2026 (2026-12-01 to 2027-01-01)

### Initial Setup

The migration creates:
- **Historical partitions:** 2025-12 (for existing data)
- **Current year:** 2026-01 through 2026-12 (12 months)
- **Future partitions:** 2027-01 through 2027-12 (12 months ahead)

### Primary Key Adjustment

Partitioned tables require the partition key in the primary key:

```sql
-- Before (non-partitioned)
PRIMARY KEY (id)

-- After (partitioned)
PRIMARY KEY (id, created_at)
```

This ensures uniqueness within each partition while enabling partition pruning.

---

## Migration Process

### Pre-Migration Checklist

1. ✅ Backup database
2. ✅ Verify current table structure
3. ✅ Check data volume and date range
4. ✅ Schedule maintenance window (if needed)
5. ✅ Notify dependent services

### Running the Migration

**Step 1: Apply main migration**

```bash
cd /home/ubuntu/webapp/TitanGold/backend
psql $DATABASE_URL -f database/migrations/006_partition_ai_decisions.sql
```

**Step 2: Install maintenance functions**

```bash
psql $DATABASE_URL -f database/migrations/partition_maintenance.sql
```

**Step 3: Verify migration**

```bash
psql $DATABASE_URL -f database/migrations/test_partition_queries.sql
```

**Step 4: Check partition health**

```bash
node scripts/check_partitions.js
```

### What the Migration Does

1. **Renames** `ai_decisions` → `ai_decisions_old` (backup)
2. **Creates** new partitioned `ai_decisions` table
3. **Creates** monthly partitions (2025-12 through 2027-12)
4. **Recreates** indexes on partitioned table
5. **Migrates** all data from `ai_decisions_old` to partitioned table
6. **Verifies** row counts match

### Post-Migration Steps

1. **Monitor application** for 24-48 hours
2. **Verify queries** work as expected
3. **Check performance** metrics
4. **Drop old table** after verification:

```sql
-- Only after confirming everything works!
DROP TABLE ai_decisions_old CASCADE;
```

---

## Maintenance Procedures

### Automatic Partition Creation

Use the `create_future_partitions()` function to create partitions ahead of time:

```sql
-- Create partitions for next 12 months
SELECT create_future_partitions(12);

-- Create partitions for next 24 months
SELECT create_future_partitions(24);
```

**Output example:**
```
✅ Created 3 new partition(s)
✅ Created: ai_decisions_2027_01 [2027-01-01 to 2027-02-01]
✅ Created: ai_decisions_2027_02 [2027-02-01 to 2027-03-01]
✅ Created: ai_decisions_2027_03 [2027-03-01 to 2027-04-01]
```

### Manual Partition Creation

```sql
CREATE TABLE ai_decisions_2028_01 PARTITION OF ai_decisions 
FOR VALUES FROM ('2028-01-01') TO ('2028-02-01');
```

### Listing Partitions

```sql
-- List all partitions with row counts and sizes
SELECT * FROM list_partitions();
```

**Output:**
```
 partition_name        | start_date | end_date | row_count | size   
-----------------------|------------|----------|-----------|--------
 ai_decisions_2025_12  | ...        | ...      | 100       | 64 kB  
 ai_decisions_2026_01  | ...        | ...      | 483       | 256 kB 
 ai_decisions_2026_02  | ...        | ...      | 0         | 8 kB   
```

### Dropping Old Partitions

For data retention policies, use `drop_old_partitions()`:

```sql
-- Drop partitions older than 24 months
SELECT drop_old_partitions(24);
```

⚠️ **WARNING:** This permanently deletes data! Use with caution.

---

## Monitoring

### Health Check Script

Run the monitoring script regularly (via cron or CI/CD):

```bash
# Check partition health
node scripts/check_partitions.js

# Exit codes:
# 0 = All healthy
# 1 = Missing partitions (auto-created)
# 2 = Error occurred
```

### Cron Job Setup

Add to crontab for daily checks:

```bash
# Check partitions daily at 2 AM
0 2 * * * cd /home/ubuntu/webapp/TitanGold/backend && node scripts/check_partitions.js >> /var/log/partition-check.log 2>&1
```

### Manual Health Check

```sql
-- Check for missing critical partitions
SELECT check_missing_partitions();
```

**Output examples:**

✅ **Healthy:**
```
✅ OK: All critical partitions exist (ai_decisions_2026_01, ai_decisions_2026_02, ai_decisions_2026_03)
```

⚠️ **Warning:**
```
⚠️  WARNING: Missing NEXT month partition: ai_decisions_2026_02
💡 Run: SELECT create_future_partitions(12); to create missing partitions
```

🚨 **Alert:**
```
🚨 ALERT: Missing CURRENT month partition: ai_decisions_2026_01
💡 Run: SELECT create_future_partitions(12); to create missing partitions
```

### Monitoring Alerts

Set up alerts for:
- Missing current/next month partitions
- Partition table size exceeding threshold
- Failed inserts due to missing partitions

---

## Query Examples

### Basic Queries (No Changes Required)

Most queries work unchanged:

```sql
-- Count all decisions
SELECT COUNT(*) FROM ai_decisions;

-- Get recent decisions
SELECT * FROM ai_decisions 
ORDER BY created_at DESC 
LIMIT 100;

-- Filter by agent
SELECT * FROM ai_decisions 
WHERE agent_id = 'some-uuid' 
AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Optimized Queries (With Partition Pruning)

Include `created_at` filters to enable partition pruning:

```sql
-- Query current month only (scans 1 partition)
SELECT * FROM ai_decisions 
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- Query specific date range (scans relevant partitions)
SELECT * FROM ai_decisions 
WHERE created_at >= '2026-01-01' 
AND created_at < '2026-04-01';
```

### Aggregation Queries

```sql
-- Monthly decision counts
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as decisions,
    AVG(confidence) as avg_confidence
FROM ai_decisions 
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

### Verify Partition Pruning

Use `EXPLAIN ANALYZE` to verify only relevant partitions are scanned:

```sql
EXPLAIN ANALYZE
SELECT * FROM ai_decisions 
WHERE created_at >= '2026-01-01' 
AND created_at < '2026-02-01';
```

Look for:
```
Seq Scan on ai_decisions_2026_01
  (Only 1 partition scanned!)
```

---

## Performance Considerations

### Benefits

1. **Partition Pruning:**
   - Queries with date filters only scan relevant partitions
   - Example: Query for Jan 2026 only scans `ai_decisions_2026_01`

2. **Smaller Indexes:**
   - Indexes on partitions are smaller and faster
   - Better cache hit rates

3. **Parallel Queries:**
   - PostgreSQL can scan multiple partitions in parallel
   - Improves performance for range queries

4. **Maintenance:**
   - VACUUM, ANALYZE operate on smaller partitions
   - Less locking, faster operations

### Best Practices

1. **Always include `created_at` in WHERE clauses when possible**
   ```sql
   -- Good (uses partition pruning)
   WHERE created_at >= '2026-01-01' AND agent_id = 'xxx'
   
   -- Less optimal (scans all partitions)
   WHERE agent_id = 'xxx'
   ```

2. **Use date range filters for aggregations**
   ```sql
   -- Limit scope to improve performance
   WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
   ```

3. **Monitor partition sizes**
   ```sql
   SELECT * FROM list_partitions();
   ```

4. **Create partitions proactively**
   - Run `create_future_partitions(12)` monthly
   - Set up cron job for automatic creation

---

## Troubleshooting

### Issue: Insert Fails with "no partition of relation"

**Error:**
```
ERROR: no partition of relation "ai_decisions" found for row
```

**Cause:** Missing partition for the `created_at` value

**Solution:**
```sql
-- Create missing partition
SELECT create_future_partitions(12);
```

### Issue: Slow Queries

**Diagnosis:**
```sql
-- Check if partition pruning is working
EXPLAIN ANALYZE
SELECT * FROM ai_decisions WHERE ...;
```

**Solutions:**
1. Add `created_at` filter to enable partition pruning
2. Ensure indexes exist on partition columns
3. Run ANALYZE on partitions:
   ```sql
   ANALYZE ai_decisions;
   ```

### Issue: Foreign Key Constraints

**Problem:** Foreign keys referencing `ai_decisions(id)` may need adjustment

**Solution:** After migration, recreate foreign key constraints:

```sql
-- Example: Recreate FK from ai_learning_events
ALTER TABLE ai_learning_events 
DROP CONSTRAINT IF EXISTS ai_learning_events_decision_id_fkey;

ALTER TABLE ai_learning_events 
ADD CONSTRAINT ai_learning_events_decision_id_fkey 
FOREIGN KEY (decision_id) REFERENCES ai_decisions(id);
```

### Issue: Data Integrity Check

Verify all data was migrated:

```sql
-- Compare row counts
SELECT 
    (SELECT COUNT(*) FROM ai_decisions_old) as old_count,
    (SELECT COUNT(*) FROM ai_decisions) as new_count,
    (SELECT COUNT(*) FROM ai_decisions_old) = (SELECT COUNT(*) FROM ai_decisions) as match;
```

---

## Rollback Procedure

If issues occur, you can rollback the migration:

### Step 1: Stop Application

Prevent new writes during rollback.

### Step 2: Restore Old Table

```sql
BEGIN;

-- Drop partitioned table
DROP TABLE IF EXISTS ai_decisions CASCADE;

-- Rename old table back
ALTER TABLE ai_decisions_old RENAME TO ai_decisions;

-- Recreate indexes (if needed)
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_id ON ai_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_id ON ai_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created_at ON ai_decisions(created_at);

COMMIT;
```

### Step 3: Recreate Triggers

```sql
-- Recreate any triggers that were dropped
-- (e.g., auto_generate_learning_event trigger)
```

### Step 4: Restart Application

---

## Additional Resources

### SQL Files

- **Migration:** `backend/database/migrations/006_partition_ai_decisions.sql`
- **Maintenance:** `backend/database/migrations/partition_maintenance.sql`
- **Tests:** `backend/database/migrations/test_partition_queries.sql`

### Scripts

- **Health Check:** `backend/scripts/check_partitions.js`

### Functions

- `create_future_partitions(months_ahead)` - Create partitions
- `check_missing_partitions()` - Check partition health
- `list_partitions()` - List all partitions with stats
- `drop_old_partitions(months_to_keep)` - Drop old partitions

---

## Maintenance Schedule

### Daily
- ✅ Run `check_partitions.js` health check
- ✅ Monitor application logs for partition-related errors

### Monthly
- ✅ Review partition sizes: `SELECT * FROM list_partitions()`
- ✅ Create future partitions: `SELECT create_future_partitions(12)`
- ✅ Verify partition health: `SELECT check_missing_partitions()`

### Quarterly
- ✅ Review data retention policy
- ✅ Consider dropping old partitions (if applicable)
- ✅ Analyze query performance trends

### Annually
- ✅ Review partitioning strategy
- ✅ Adjust retention policies if needed
- ✅ Update monitoring thresholds

---

## Conclusion

Partitioning the `ai_decisions` table provides significant performance and maintenance benefits for TitanGold as the system scales. By following the procedures in this document, the database team can effectively manage partitions and ensure optimal performance.

**Key Takeaways:**
- ✅ Partitions are created monthly by `created_at`
- ✅ Maintenance functions automate partition management
- ✅ Monitoring script alerts on missing partitions
- ✅ Queries benefit from partition pruning
- ✅ Rollback procedure available if needed

For questions or issues, refer to the troubleshooting section or contact the database team.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-06  
**Maintained By:** TitanGold Database Team
