# Telegram Collector - Phase 2: Priority & Error Tracking System

## 📋 Overview

**Status**: ✅ Deployed  
**Date**: 2026-02-16  
**Git Commits**:
- Backend & Monitoring: `7cf740d`
- UI Updates: `aed229a`

Phase 2 implements comprehensive priority management and error tracking for Telegram channels, from database schema to user interface.

---

## 🎯 Features Implemented

### 1. Database Schema Enhancement

**Migration**: `20260216_add_priority_error_tracking.sql`

#### New Columns in `telegram_channels`
```sql
priority                    VARCHAR(20) DEFAULT 'normal'
last_error                  TEXT
last_error_at              TIMESTAMPTZ
error_count                INTEGER DEFAULT 0
consecutive_success_count  INTEGER DEFAULT 0
```

#### Indexes Created
- `idx_telegram_channels_priority` - Fast priority filtering
- `idx_telegram_channels_error_count` - Error analysis queries
- `idx_telegram_channels_priority_errors` - Combined priority + error monitoring

#### Initial Configuration
6 high-priority channels configured:
- BBCPersian (`bbcpersian`)
- Iran International (`IranintlTV`)
- IndyPersian (`Indypersian`)
- آخرین خبر (`akharinkhabar`)
- DIRHAM_RATE (`Dirham_rate`)
- تحلیل دلار (`PishbiniTalaa`)

---

### 2. Error Tracking System

**File**: `telegram-collector/dist/utils/errorTracking.js`

#### Core Functions

##### `recordChannelError(channelId, error)`
Records polling errors with automatic categorization:
```javascript
// Automatically extracts error message
// Increments error_count
// Resets consecutive_success_count
// Updates last_error and last_error_at timestamp
// Categories: auth, timeout, flood, network, telegram_api, unknown
```

##### `recordChannelSuccess(channelId)`
Tracks successful polling attempts:
```javascript
// Resets error_count to 0
// Increments consecutive_success_count
// Clears last_error fields
```

##### `categorizeError(error)`
Intelligent error classification:
- **auth**: Session expired, invalid session, authentication errors
- **timeout**: REQUEST_TIMEOUT, connection timeout
- **flood**: FLOOD_WAIT, FloodWaitError, rate limit
- **network**: Network errors, connection failures
- **telegram_api**: Telegram-specific errors
- **unknown**: Unclassified errors

---

### 3. API Enhancement

**Endpoint**: `GET /api/telegram-collector/collector-channels`

#### Extended Response Fields
```json
{
  "success": true,
  "count": 44,
  "channels": [
    {
      "id": "uuid",
      "channelId": "-1001234567890",
      "username": "bbcpersian",
      "title": "BBCPersian",
      "priority": "high",
      "errorCount": 0,
      "lastError": null,
      "lastErrorAt": null,
      "consecutiveSuccessCount": 5,
      // ... other fields
    }
  ]
}
```

#### Query Parameters
- `account_id` - Filter by Telegram account
- `status` - Filter by active/disabled status
- `priority` (implicit via ORDER BY) - Results ordered: high → normal → low

---

### 4. Enhanced Monitoring Service

**File**: `telegram-collector/scripts/telegram-collector-monitor.js`

#### New Alert Types

##### High-Priority Stale Channel Alert
```
Severity: critical
Trigger: High-priority channel not synced for >10 minutes
Threshold: STALE_THRESHOLD_MIN_HIGH = 10 (vs 30 for normal)
```

##### Persistent Error Alert
```
Severity: error
Trigger: error_count >= 3 consecutive failures
Message: "Channel has 3+ consecutive errors"
Includes: Last error message and timestamp
```

#### Priority Statistics
Monitoring output now includes:
```
Priority distribution: high=6, normal=38, low=0
Error tracking: 0 channels with errors
```

#### Environment Variables
```bash
MONITOR_INTERVAL_SEC=300          # Check every 5 minutes
STALE_THRESHOLD_MIN=30            # Normal channel stale warning
STALE_THRESHOLD_MIN_HIGH=10       # High-priority channel stale warning
CRITICAL_THRESHOLD_MIN=60         # Critical alert threshold
ALERT_COOLDOWN_MIN=15             # Alert cooldown period
```

---

### 5. UI Enhancements

**File**: `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx`

#### Type System Updates
```typescript
type CollectorChannel = {
  // ... existing fields
  priority?: 'high' | 'normal' | 'low';
  errorCount?: number;
  lastError?: string | null;
  lastErrorAt?: string | null;
  consecutiveSuccessCount?: number;
};
```

#### New UI Components

##### 1. Priority Badge
**Location**: Next to channel title

**Rendering Logic**:
```tsx
renderPriorityBadge(priority)
  high  → Red badge: "HIGH" (bg-red-500/20, text-red-200)
  low   → Blue badge: "LOW" (bg-blue-500/20, text-blue-200)
  normal → No badge (default)
```

**Visual Design**:
- Uppercase text
- Small, compact badge
- Border for visibility
- Inline with channel title

##### 2. Error Indicator
**Location**: Below channel username

**Rendering Logic**:
```tsx
renderErrorIndicator(ch)
  errorCount >= 3 → Red: "⚠ X errors" (critical)
  errorCount 1-2  → Amber: "⚠ X errors" (warning)
  errorCount = 0  → No indicator
```

**Features**:
- Hover tooltip shows last error message
- Color-coded severity
- Warning icon (⚠)
- Error count display

##### 3. Priority Filter
**Location**: Channel controls toolbar

**Options**:
- All Priorities (default)
- 🔴 High
- Normal
- Low

**Behavior**:
- Combines with existing search and status filters
- Real-time filtering using `useMemo`
- Updates `priorityFilter` state

---

## 📊 Current Statistics

**As of last monitoring cycle:**
```
Total Channels:     44
Synced:             25 (57%)
Never Synced:       19 (43%)

Priority Distribution:
  High:             6
  Normal:           38
  Low:              0

Error Tracking:
  Channels with errors: 0
  Highest error count:  0

Alerts:               17
  - Stale channel warnings (high-priority)
  - Never-synced warnings
  - Low sync rate warning
```

---

## 🧪 Testing & Verification

### 1. Database Migration
```bash
psql "postgresql://postgres@localhost:5433/titangold_db" \
  -f backend/database/migrations/20260216_add_priority_error_tracking.sql

# Verify columns
psql "postgresql://postgres@localhost:5433/titangold_db" \
  -c "SELECT priority, error_count FROM telegram_channels LIMIT 3;"
```

### 2. API Verification
```bash
# Test collector-channels endpoint
curl -s http://127.0.0.1:3002/api/telegram-collector/collector-channels \
  | jq '.channels[:3] | .[] | {username, priority, errorCount}'

# Filter by high priority
curl -s http://127.0.0.1:3002/api/telegram-collector/collector-channels \
  | jq '.channels[] | select(.priority=="high") | {username, priority, errorCount}'
```

### 3. Monitoring Service
```bash
# Check monitoring logs
pm2 logs telegram-collector-monitor --lines 50 --nostream

# Run monitoring script once
cd /home/ubuntu/webapp/TitanGold
node telegram-collector/scripts/telegram-collector-monitor.js --once
```

### 4. UI Testing
1. Open https://titan.zala.ir/?view=ai
2. Navigate to AI Center → Data Hub → Telegram Collector
3. Verify:
   - ✅ Priority badges display on high-priority channels
   - ✅ Priority filter dropdown appears
   - ✅ Filtering by priority works
   - ✅ Error indicators show (when errors present)
   - ✅ Tooltip displays error message on hover

---

## 🔧 Configuration

### Setting Channel Priority
```sql
-- Set a channel to high priority
UPDATE telegram_channels
SET priority = 'high'
WHERE username = 'channelname';

-- Reset to normal
UPDATE telegram_channels
SET priority = 'normal'
WHERE username = 'channelname';
```

### Adjusting Monitoring Thresholds
Edit `telegram-collector/scripts/telegram-collector-monitor.js`:
```javascript
const STALE_THRESHOLD_MIN = process.env.STALE_THRESHOLD_MIN || 30;
const STALE_THRESHOLD_MIN_HIGH = process.env.STALE_THRESHOLD_MIN_HIGH || 10;
const CRITICAL_THRESHOLD_MIN = process.env.CRITICAL_THRESHOLD_MIN || 60;
const ALERT_COOLDOWN_MIN = process.env.ALERT_COOLDOWN_MIN || 15;
```

Then restart the monitor:
```bash
pm2 restart telegram-collector-monitor
```

---

## 📈 Benefits & Impact

### 1. Proactive Error Detection
- Automatic identification of failing channels
- Early warning for authentication issues
- Network timeout detection

### 2. Priority-Based Monitoring
- Critical channels monitored more strictly (10 min vs 30 min)
- Visual priority indicators in UI
- Alert differentiation by priority

### 3. Improved Debugging
- Error categorization helps identify root causes
- Last error message stored for analysis
- Consecutive success tracking shows reliability

### 4. Better User Experience
- Visual feedback on channel health
- Priority filtering for focused management
- Error indicators show issues at a glance

---

## 🚀 Next Steps (Phase 3+)

### Phase 3: Force-Sync API
- [ ] Implement `POST /api/telegram-collector/channels/:id/force-sync`
- [ ] Add "Sync Now" button in UI for priority channels
- [ ] On-demand message fetching
- [ ] Manual retry for error channels

### Phase 4: Enhanced Error Handling
- [ ] Display full error text in UI modal
- [ ] Degraded collector status indicator
- [ ] Error history timeline
- [ ] Auto-retry mechanism for transient errors

### Phase 5: Automated E2E Testing
- [ ] Scheduled health checks
- [ ] Login → Poll → Verify pipeline
- [ ] Alert on test failures
- [ ] Performance metrics tracking

---

## 🐛 Troubleshooting

### Priority Not Showing in UI
1. Check API response includes `priority` field
2. Verify browser cache cleared (hard refresh)
3. Check frontend build includes latest changes

### Error Count Not Updating
1. Verify `recordChannelError()` is called in catch blocks
2. Check `errorTracking.js` functions are imported
3. Restart telegram-collector service:
   ```bash
   pm2 restart telegram-collector
   ```

### Monitoring Alerts Not Firing
1. Check monitoring service is running:
   ```bash
   pm2 list | grep monitor
   ```
2. Verify environment variables set correctly
3. Check logs for script errors:
   ```bash
   pm2 logs telegram-collector-monitor --err
   ```

---

## 📚 Related Documentation

- **Phase 1**: `TELEGRAM_MONITORING_PHASE1.md` - Basic monitoring system
- **Last Synced Fix**: `TELEGRAM_LAST_SYNCED_FIX.md` - Timestamp update logic
- **Data Flow**: `TELEGRAM_COLLECTOR_DATA_FLOW.md` - System architecture
- **Login Guide**: `TELEGRAM_LOGIN_GUIDE.md` - Multi-account setup

---

## 🔗 Resources

**Repository**: https://github.com/sepehrraeisi/TitanGold  
**Production URL**: https://titan.zala.ir/?view=ai  
**Collector API**: http://127.0.0.1:3002 (internal)

**Git Commits**:
- Phase 2 Backend: `7cf740d`
- Phase 2 UI: `aed229a`

**PM2 Services**:
- `telegram-collector` (id: 13) - Main collector service
- `telegram-collector-monitor` (id: 14) - Health monitoring

---

**Phase 2 Status**: ✅ **FULLY DEPLOYED**  
**Next Phase**: Phase 3 - Force-Sync API Implementation
