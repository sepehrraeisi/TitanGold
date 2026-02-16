# Telegram Collector Health Monitoring - Phase 1

**Date**: 2026-02-16  
**Status**: ✅ **DEPLOYED**  
**Version**: 1.0

---

## 🎯 Overview

Phase 1 implements a **standalone health monitoring service** that continuously monitors the Telegram Collector and sends alerts when issues are detected. This ensures that **no important messages are missed** due to undetected failures.

### Key Features

1. **Automatic Health Checks** - Runs every 5 minutes (configurable)
2. **Alert System** - Detects and logs issues with appropriate severity levels
3. **Cooldown Protection** - Prevents alert spam with 15-minute cooldown per issue
4. **Multiple Check Types**:
   - Stale channels (not synced recently)
   - Never-synced channels (active but never polled)
   - Low overall sync rates
   - Collector down/unresponsive

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Telegram Collector Monitor                     │
│                                                                 │
│  ┌──────────────┐      ┌──────────────────────────────┐       │
│  │              │      │                              │       │
│  │   PM2        │─────▶│  Monitor Script              │       │
│  │   (daemon)   │      │  (every 5 min)               │       │
│  │              │      │                              │       │
│  └──────────────┘      └──────────────────────────────┘       │
│                                     │                          │
│                                     ▼                          │
│                        ┌────────────────────────┐             │
│                        │  Health Check APIs     │             │
│                        │  - GET /health         │             │
│                        │  - GET /channels       │             │
│                        └────────────────────────┘             │
│                                     │                          │
│                                     ▼                          │
│                        ┌────────────────────────┐             │
│                        │  Alert Detection       │             │
│                        │  - Stale channels      │             │
│                        │  - Never synced        │             │
│                        │  - Low sync rate       │             │
│                        └────────────────────────┘             │
│                                     │                          │
│                                     ▼                          │
│                        ┌────────────────────────┐             │
│                        │  Alert Output          │             │
│                        │  - PM2 logs            │             │
│                        │  - (Future: DB, notif) │             │
│                        └────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment

### Files Created

```
telegram-collector/
└── scripts/
    └── telegram-collector-monitor.js   # Standalone monitoring script
```

### PM2 Configuration

Service is now running as part of the PM2 ecosystem:

```bash
$ pm2 list
┌────┬───────────────────────────────┬─────────┬───────────┐
│ id │ name                          │ mode    │ status    │
├────┼───────────────────────────────┼─────────┼───────────┤
│ 14 │ telegram-collector-monitor    │ fork    │ online    │
│ 13 │ telegram-collector            │ fork    │ online    │
│ 11 │ titan-backend                 │ cluster │ online    │
│ 12 │ titan-backend                 │ cluster │ online    │
└────┴───────────────────────────────┴─────────┴───────────┘
```

### Start/Stop/Restart

```bash
# Start monitoring service
pm2 start telegram-collector/scripts/telegram-collector-monitor.js --name "telegram-collector-monitor"

# Restart
pm2 restart telegram-collector-monitor

# Stop
pm2 stop telegram-collector-monitor

# View logs
pm2 logs telegram-collector-monitor

# View recent logs (non-streaming)
pm2 logs telegram-collector-monitor --lines 50 --nostream
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Monitoring interval (default: 300 = 5 minutes)
MONITOR_INTERVAL_SEC=300

# Stale threshold (default: 30 minutes)
STALE_THRESHOLD_MIN=30

# Critical threshold (default: 60 minutes)
CRITICAL_THRESHOLD_MIN=60

# Alert cooldown (default: 15 minutes)
ALERT_COOLDOWN_MIN=15
```

### Adjusting Intervals

To change the check interval:

```bash
# Stop monitoring
pm2 stop telegram-collector-monitor

# Start with custom interval (check every 2 minutes)
MONITOR_INTERVAL_SEC=120 pm2 start telegram-collector/scripts/telegram-collector-monitor.js \
  --name "telegram-collector-monitor"

# Save configuration
pm2 save
```

---

## 🔍 Alert Types

### 1. Stale Channel (Warning)

**Trigger**: Channel not synced for 30+ minutes  
**Severity**: ⚠️ Warning  
**Example**:
```
[2026-02-16T16:14:41.465Z] ⚠️ [WARNING] Channel "BBCPersian" has not synced for 39 minutes
  Details: {
    "channelId": "485d4b10-235f-414e-a284-2132557d8de9",
    "channelHandle": "bbcpersian",
    "lastSyncedAt": "2026-02-16T15:34:44.200Z",
    "minutesSinceSync": 39,
    "threshold": 30
  }
```

**Action**: Investigate why channel hasn't been polled recently

---

### 2. Stale Channel (Critical)

**Trigger**: Channel not synced for 60+ minutes  
**Severity**: 🔴 Critical  
**Action**: Immediate attention required - possible polling failure

---

### 3. Never-Synced Channel (Error)

**Trigger**: Channel active for 15+ minutes but never synced  
**Severity**: ❌ Error  
**Example**:
```
[2026-02-16T16:14:41.773Z] ❌ [ERROR] Channel "Indypersian" has never synced (active for 42 minutes)
  Details: {
    "channelId": "bbb5e2fa-0423-4d6c-a355-fe2da85dcd3c",
    "channelHandle": "Indypersian",
    "createdAt": "2026-02-10T16:21:35.680Z",
    "minutesSinceCreation": 42
  }
```

**Action**: Check if channel credentials are valid or if polling is stuck

---

### 4. Low Sync Rate (Warning)

**Trigger**: Less than 70% of channels synced  
**Severity**: ⚠️ Warning  
**Example**:
```
[2026-02-16T16:14:41.465Z] ⚠️ [WARNING] Low sync rate: 34% of channels synced (15/44)
  Details: {
    "totalChannels": 44,
    "syncedChannels": 15,
    "neverSyncedChannels": 29,
    "syncRate": 0.34
  }
```

**Action**: Investigate if polling service is slow or stuck

---

### 5. Too Many Never-Synced (Error)

**Trigger**: More than 50% of channels never synced  
**Severity**: ❌ Error  
**Action**: Critical - check if collector is running properly

---

## 📈 Current Status

### Latest Health Check Results

```
🔍 Starting health check at 2026-02-16T16:14:41.465Z
======================================================================
✅ Collector is healthy: healthy
📊 Found 44 channels

📢 7 alert(s) detected:
  ⚠️  5 stale channel warnings (30-60 min)
  ⚠️  1 low sync rate warning (34%)
  ❌  1 too many never-synced error (66%)

📈 Summary:
  Total channels: 44
  Synced: 15 (34%)
  Never synced: 29
  Alerts: 7

✅ Health check complete (27ms)
======================================================================
```

**Interpretation**:
- Collector is running and healthy
- 15/44 channels (34%) have been synced at least once
- 29 channels (66%) have never been synced
- This is **expected** shortly after deployment
- Within 10-15 minutes, expect 90%+ sync rate

---

## 🧪 Testing & Verification

### Manual Test (One-Time Check)

```bash
cd /home/ubuntu/webapp/TitanGold/telegram-collector
node scripts/telegram-collector-monitor.js --once
```

### Verify Monitoring is Running

```bash
# Check PM2 status
pm2 status telegram-collector-monitor

# Watch live logs
pm2 logs telegram-collector-monitor --lines 0

# Check recent logs
pm2 logs telegram-collector-monitor --lines 100 --nostream
```

### Check Collector API Directly

```bash
# Health check
curl http://127.0.0.1:3002/api/telegram-collector/health | jq

# Channels status
curl http://127.0.0.1:3002/api/telegram-collector/collector-channels | jq '{
  total: .channels | length,
  synced: [.channels[] | select(.lastSyncedAt != null)] | length
}'
```

---

## 🔧 Troubleshooting

### Problem: Monitor not detecting issues

**Check**:
1. Verify collector is responding: `curl http://127.0.0.1:3002/api/telegram-collector/health`
2. Check monitor logs: `pm2 logs telegram-collector-monitor --lines 50`
3. Run manual check: `node scripts/telegram-collector-monitor.js --once`

### Problem: Too many alerts

**Solution**: Adjust thresholds
```bash
pm2 stop telegram-collector-monitor

# Increase thresholds (check every 10 min, alert after 60 min)
MONITOR_INTERVAL_SEC=600 STALE_THRESHOLD_MIN=60 \
  pm2 start telegram-collector/scripts/telegram-collector-monitor.js \
  --name "telegram-collector-monitor"
```

### Problem: Alerts not visible

**Solution**: Alerts are currently logged to PM2 logs. To view:
```bash
# Real-time logs
pm2 logs telegram-collector-monitor --lines 0 | grep -E "(WARNING|ERROR|CRITICAL)"

# Recent alerts only
pm2 logs telegram-collector-monitor --lines 200 --nostream | grep -E "🔴|❌|⚠️"
```

---

## 📝 Alert Cooldown

To prevent alert spam, each alert type has a cooldown period (default 15 minutes). This means:

- Once an alert is sent for a channel, it won't be sent again for the same issue within 15 minutes
- After 15 minutes, if the issue persists, the alert will be sent again
- Different issues on the same channel are tracked separately

**Example**:
```
16:00 - Alert: Channel "BBCPersian" stale (30 min)
16:05 - No alert (cooldown active)
16:10 - No alert (cooldown active)
16:15 - Alert: Channel "BBCPersian" stale (45 min) ← cooldown expired
```

---

## 🎯 Next Steps (Future Phases)

### Phase 2: Priority & Error Tracking
- Add `priority` field to telegram_channels (high/normal/low)
- Add `last_error` and `error_count` fields
- Alert on persistent errors
- UI badges for priority channels

### Phase 3: On-Demand Sync
- Implement `POST /api/telegram-collector/channels/:id/force-sync`
- UI "Sync Now" button for priority channels
- Manual override for stuck channels

### Phase 4: Enhanced Error Handling
- Better error categorization (AUTH, TIMEOUT, NETWORK, etc.)
- Display errors in UI with red indicators
- Error recovery suggestions

### Phase 5: End-to-End Testing
- Automated E2E tests (login → poll → verify → UI)
- Scheduled test runs
- Alerts on test failures

---

## 📊 Monitoring Commands Quick Reference

```bash
# View monitoring status
pm2 status telegram-collector-monitor

# View live alerts
pm2 logs telegram-collector-monitor --lines 0

# View recent summary
pm2 logs telegram-collector-monitor --lines 50 --nostream | tail -20

# Check sync progress
curl -s http://127.0.0.1:3002/api/telegram-collector/collector-channels | \
  jq '{total: .channels|length, synced: [.channels[]|select(.lastSyncedAt!=null)]|length}'

# Run manual check
cd /home/ubuntu/webapp/TitanGold/telegram-collector
node scripts/telegram-collector-monitor.js --once

# Restart monitor
pm2 restart telegram-collector-monitor

# Stop monitor
pm2 stop telegram-collector-monitor
```

---

## ✅ Success Criteria

Phase 1 is considered successful when:

- [x] Monitoring service runs continuously without crashes
- [x] Alerts are generated for stale channels (30+ min)
- [x] Alerts are generated for never-synced channels (15+ min)
- [x] Alert cooldown prevents spam
- [x] Service auto-restarts with PM2 on crash
- [ ] 90%+ of channels synced within 10-15 minutes (monitoring)
- [ ] No false-positive alerts for normally-synced channels

**Current Status**: ✅ **5/7 criteria met** (2 in progress)

---

## 📚 Related Documentation

- `TELEGRAM_LAST_SYNCED_STATUS.md` - Last Synced fix deployment
- `TELEGRAM_COLLECTOR_DATA_FLOW.md` - Collector architecture
- `TELEGRAM_LOGIN_GUIDE.md` - Authentication troubleshooting

---

*Last Updated: 2026-02-16 16:20 UTC*
