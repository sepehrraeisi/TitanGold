# Agent Version Tracking (BACKEND-017)

**Status**: ✅ COMPLETE  
**Date**: 2026-01-31  
**Component**: Backend / Agent Registry  
**Database Migration**: 010_add_agent_versions.sql  

---

## Overview

Agent version tracking enables TitanGold to track changes to AI agent code, maintain a complete version history, and support rollback capabilities. This is critical for:

- **Debugging**: Identify which agent version caused specific decisions
- **Rollback**: Revert to previous agent versions if issues arise
- **Audit**: Track all changes to agent logic over time
- **Testing**: Compare performance across different agent versions
- **Compliance**: Maintain detailed records of all AI decision-making logic

---

## Database Schema

### 1. `ai_agents` Table Changes

```sql
-- New columns added
ALTER TABLE ai_agents ADD COLUMN version VARCHAR(20) DEFAULT '1.0.0' NOT NULL;
ALTER TABLE ai_agents ADD COLUMN version_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

**Fields**:
- `version`: Semantic version string (e.g., "1.0.0", "1.2.3")
- `version_updated_at`: Timestamp of last version update

### 2. `ai_decisions` Table Changes

```sql
-- Agent version stored with each decision
ALTER TABLE ai_decisions ADD COLUMN agent_version VARCHAR(20);

-- Indexes for efficient queries
CREATE INDEX idx_ai_decisions_agent_version ON ai_decisions(agent_version);
CREATE INDEX idx_ai_decisions_agent_id_version ON ai_decisions(agent_id, agent_version);
```

**Purpose**: Every decision records which agent version made it, enabling version-specific queries.

### 3. `ai_agent_version_history` Table (NEW)

```sql
CREATE TABLE ai_agent_version_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    agent_key VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    previous_version VARCHAR(20),
    change_type VARCHAR(50) DEFAULT 'update', -- 'created', 'update', 'rollback'
    change_description TEXT,
    changed_by VARCHAR(100), -- user ID or 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

**Purpose**: Complete audit trail of all version changes.

---

## Semantic Versioning Strategy

TitanGold uses **Semantic Versioning 2.0.0** for agents:

```
MAJOR.MINOR.PATCH
  |     |     |
  |     |     +--- Bug fixes, minor tweaks
  |     +--------- New features, backward compatible
  +--------------- Breaking changes, algorithm changes
```

### Version Bump Guidelines

| Change Type | Version Bump | Example | When to Use |
|-------------|--------------|---------|-------------|
| **Patch** (0.0.X) | Bug fix, parameter tuning | 1.0.0 → 1.0.1 | Fixed RSI calculation bug |
| **Minor** (0.X.0) | New feature, backward compatible | 1.0.1 → 1.1.0 | Added new indicator |
| **Major** (X.0.0) | Breaking change, algorithm change | 1.1.0 → 2.0.0 | Changed ML model |

### Examples

```javascript
// Patch: Bug fix in technical agent
await incrementAgentVersion('technical', 'Fixed MACD signal calculation');
// 1.0.0 → 1.0.1

// Minor: New feature
await bumpAgentVersion('technical', '1.1.0', 'Added Stochastic RSI indicator');
// 1.0.1 → 1.1.0

// Major: Breaking change
await bumpAgentVersion('risk', '2.0.0', 'Replaced rule-based with ML model');
// 1.5.3 → 2.0.0
```

---

## API Functions

### 1. Get Current Version

```javascript
import { getAgentVersion } from './services/agents/registry.js';

const version = await getAgentVersion('technical');
console.log(version); // "1.0.0"
```

### 2. Bump Version (Manual)

```javascript
import { bumpAgentVersion } from './services/agents/registry.js';

const result = await bumpAgentVersion(
  'technical',
  '1.1.0',
  'Added Bollinger Bands support',
  'user_12345'
);

console.log(result);
/*
{
  success: true,
  agent_key: 'technical',
  previous_version: '1.0.0',
  new_version: '1.1.0',
  change_description: 'Added Bollinger Bands support',
  updated_at: '2026-01-31T14:30:00.000Z'
}
*/
```

### 3. Auto-Increment Version

```javascript
import { incrementAgentVersion } from './services/agents/registry.js';

// Automatically increments patch version
const result = await incrementAgentVersion(
  'risk',
  'Fixed position sizing calculation'
);
// 1.0.0 → 1.0.1
```

### 4. Get Version History

```javascript
import { getAgentVersionHistory } from './services/agents/registry.js';

const history = await getAgentVersionHistory('technical', 5);
console.log(history);
/*
[
  {
    version: '1.1.0',
    previous_version: '1.0.1',
    change_type: 'update',
    change_description: 'Added Bollinger Bands',
    changed_by: 'user_12345',
    created_at: '2026-01-31T14:30:00.000Z'
  },
  {
    version: '1.0.1',
    previous_version: '1.0.0',
    change_type: 'update',
    change_description: 'Fixed MACD calculation',
    changed_by: 'system',
    created_at: '2026-01-30T10:15:00.000Z'
  }
]
*/
```

### 5. Rollback to Previous Version

```javascript
import { rollbackAgentVersion } from './services/agents/registry.js';

const result = await rollbackAgentVersion('technical', '1.0.0', 'admin_user');

console.log(result);
/*
{
  success: true,
  agent_key: 'technical',
  previous_version: '1.1.0',
  new_version: '1.0.0',
  rolled_back_at: '2026-01-31T15:00:00.000Z'
}
*/
```

### 6. Query Decisions by Version

```javascript
import { getDecisionsByVersion } from './services/agents/registry.js';

// Get all decisions made by technical agent v1.0.0
const decisions = await getDecisionsByVersion('technical', '1.0.0', 50);

console.log(decisions.length); // 50 decisions
console.log(decisions[0]);
/*
{
  id: 'uuid',
  decision_type: 'BUY',
  input_data: { symbol: 'BTCUSDT', timeframe: '1h' },
  output_data: { signal: 'BUY', confidence: 0.85 },
  confidence: 0.85,
  was_successful: true,
  created_at: '2026-01-30T12:00:00.000Z'
}
*/
```

### 7. Get All Agent Versions

```javascript
import { getAllAgentVersions } from './services/agents/registry.js';

const summary = await getAllAgentVersions();

console.log(summary);
/*
[
  {
    agent_key: 'technical',
    name: 'Technical Analysis Agent',
    current_version: '1.1.0',
    version_updated_at: '2026-01-31T14:30:00.000Z',
    total_versions: 3,
    previous_version: '1.0.1',
    decisions_on_current_version: 127,
    all_decision_versions: ['1.1.0', '1.0.1', '1.0.0']
  },
  // ... other agents
]
*/
```

### 8. Record Decision Version (Auto)

```javascript
import { recordDecisionVersion } from './services/agents/registry.js';

// Called automatically when agent makes a decision
const decision = {
  id: 'decision-uuid',
  agent_id: 'agent-uuid',
  // ... other fields
};

const version = await recordDecisionVersion(decision);
console.log(version); // "1.1.0" - version is auto-recorded
```

---

## Database Functions

### 1. `get_decisions_by_version()`

**Purpose**: Query decisions made by a specific agent version.

```sql
-- Get last 100 decisions from technical agent v1.0.0
SELECT * FROM get_decisions_by_version('technical', '1.0.0', 100);
```

### 2. `rollback_agent_version()`

**Purpose**: Rollback an agent to a previous version.

```sql
-- Rollback technical agent to v1.0.0
SELECT rollback_agent_version('technical', '1.0.0', 'admin_user');

-- Returns JSON:
{
  "success": true,
  "agent_key": "technical",
  "previous_version": "1.1.0",
  "new_version": "1.0.0",
  "rolled_back_at": "2026-01-31T15:00:00.000Z"
}
```

---

## Database Triggers

### Auto-Update Trigger

```sql
CREATE TRIGGER trigger_update_agent_version_timestamp
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_version_timestamp();
```

**Behavior**:
1. Detects when `version` column changes
2. Updates `version_updated_at` to NOW()
3. Inserts entry into `ai_agent_version_history`
4. All automatic—no manual tracking needed!

---

## Views

### `agent_version_summary` View

**Purpose**: High-level version status for all agents.

```sql
SELECT * FROM agent_version_summary;
```

**Returns**:
- Current version
- Previous version
- Total number of versions
- Decisions on current version
- All versions used in decisions

---

## Workflow Examples

### Example 1: Update Agent Code and Bump Version

```javascript
// 1. Make code changes to technical.js
// ... edit technical.js ...

// 2. Test the changes
// ... run tests ...

// 3. Bump version
import { incrementAgentVersion } from './services/agents/registry.js';

await incrementAgentVersion('technical', 'Fixed RSI oversold threshold');
// 1.0.0 → 1.0.1

// 4. Deploy changes
// The next decision will automatically use v1.0.1
```

### Example 2: Rollback After Issue

```javascript
// 1. Issue detected with v1.1.0
// Users report incorrect signals

// 2. Query decisions from problematic version
import { getDecisionsByVersion } from './services/agents/registry.js';

const problematic = await getDecisionsByVersion('technical', '1.1.0', 100);
console.log(`Found ${problematic.length} decisions from v1.1.0`);

// 3. Rollback to previous stable version
import { rollbackAgentVersion } from './services/agents/registry.js';

await rollbackAgentVersion('technical', '1.0.1', 'admin_incident_123');

// 4. Agent now uses v1.0.1 for new decisions
// v1.1.0 decisions remain in history for analysis
```

### Example 3: Compare Version Performance

```javascript
// Get decisions from two versions
const v1_decisions = await getDecisionsByVersion('technical', '1.0.0', 1000);
const v2_decisions = await getDecisionsByVersion('technical', '1.1.0', 1000);

// Calculate success rates
const v1_success = v1_decisions.filter(d => d.was_successful).length / v1_decisions.length;
const v2_success = v2_decisions.filter(d => d.was_successful).length / v2_decisions.length;

console.log(`v1.0.0 success rate: ${(v1_success * 100).toFixed(2)}%`);
console.log(`v1.1.0 success rate: ${(v2_success * 100).toFixed(2)}%`);

// Decide whether to keep v1.1.0 or rollback
if (v2_success < v1_success) {
  await rollbackAgentVersion('technical', '1.0.0', 'performance_analysis');
  console.log('Rolled back due to performance degradation');
}
```

---

## Best Practices

### 1. **Always Include Change Descriptions**

```javascript
// ❌ Bad: No description
await incrementAgentVersion('technical');

// ✅ Good: Clear description
await incrementAgentVersion('technical', 'Fixed MACD signal line calculation bug');
```

### 2. **Bump Version After Code Changes**

```javascript
// Workflow:
// 1. Edit agent code
// 2. Run tests
// 3. Bump version BEFORE deploying
// 4. Deploy

// This ensures all decisions are properly tracked
```

### 3. **Use Semantic Versioning Correctly**

```javascript
// Patch: Bug fixes only
await bumpAgentVersion('technical', '1.0.1', 'Fixed RSI calculation');

// Minor: New features
await bumpAgentVersion('technical', '1.1.0', 'Added Bollinger Bands indicator');

// Major: Breaking changes
await bumpAgentVersion('technical', '2.0.0', 'Replaced rule-based with ML model');
```

### 4. **Test Before Bumping Major Versions**

```javascript
// Major version changes should be tested thoroughly
// Consider A/B testing before full rollout

// 1. Deploy v2.0.0 to test environment
// 2. Run alongside v1.x.x
// 3. Compare results
// 4. Only then bump production
```

### 5. **Document Breaking Changes**

```javascript
await bumpAgentVersion(
  'technical',
  '2.0.0',
  'BREAKING: Changed indicator weights - RSI now 30%, MACD 40% (was 20%/25%)',
  'user_admin'
);
```

---

## Monitoring & Analytics

### Version Distribution Query

```sql
-- See which versions are being used in recent decisions
SELECT 
  agent_version,
  COUNT(*) as decision_count,
  AVG(confidence) as avg_confidence,
  SUM(CASE WHEN was_successful THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
FROM ai_decisions
WHERE agent_id = (SELECT id FROM ai_agents WHERE agent_key = 'technical')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_version
ORDER BY decision_count DESC;
```

### Version History Report

```sql
-- Full version history for an agent
SELECT 
  version,
  previous_version,
  change_type,
  change_description,
  changed_by,
  created_at
FROM ai_agent_version_history
WHERE agent_key = 'technical'
ORDER BY created_at DESC;
```

---

## Migration Guide

### Running the Migration

```bash
# Navigate to backend directory
cd backend

# Run migration script
npm run migrate

# Or manually with psql
psql -U postgres -d titangold_db -f database/migrations/010_add_agent_versions.sql
```

### Verification

```sql
-- Check version column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_agents' AND column_name = 'version';

-- Check version history table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'ai_agent_version_history';

-- Check agent_version column in decisions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_decisions' AND column_name = 'agent_version';
```

---

## Troubleshooting

### Issue: Decisions Missing agent_version

**Symptom**: Some decisions have NULL agent_version.

**Solution**: Run backfill query:

```sql
UPDATE ai_decisions d
SET agent_version = a.version
FROM ai_agents a
WHERE d.agent_id = a.id
AND d.agent_version IS NULL;
```

### Issue: Version Not Auto-Updating

**Symptom**: Trigger not firing when version changes.

**Solution**: Check trigger exists:

```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_agent_version_timestamp';
```

If missing, re-run migration.

### Issue: Rollback Failed

**Symptom**: `rollback_agent_version()` returns success: false.

**Solution**: Check version exists in history:

```sql
SELECT * FROM ai_agent_version_history 
WHERE agent_key = 'technical' 
AND version = '1.0.0';
```

---

## Future Enhancements (Not in Scope)

### Planned

- **Automated Version Bumping**: Auto-detect code changes via git hooks
- **A/B Testing**: Deploy multiple versions simultaneously
- **Performance Comparison**: Auto-compare version performance
- **Version Tagging**: Add tags like "stable", "beta", "experimental"

### Not Planned

- Git integration (agents are not necessarily in git)
- Automatic rollback on failures (requires policy definition)
- Version scheduling (e.g., deploy v2.0.0 at specific time)

---

## Summary

✅ **Definition of Done - All Met**

- [x] `version` column in `ai_agents` table
- [x] Version bumped on agent code change (via API functions)
- [x] Decisions store agent version
- [x] Can query results by version (via `get_decisions_by_version()`)
- [x] Documentation: versioning strategy (this document)

**Files Modified**: 2  
**Files Created**: 2  
**Total Lines Changed**: ~400  
**Production Ready**: ✅ YES  

**Related Tasks**:
- Builds on: BACKEND-015 (Agent Health Checks)
- Supports: Agent lifecycle management

---

**Last Updated**: 2026-01-31  
**Task**: BACKEND-017  
**Status**: COMPLETE ✅
