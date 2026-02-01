# TitanGold Production++ Guide
**Date**: 2025-12-28  
**Status**: Optional Enhancements for Production Excellence  
**Version**: 1.0

---

## Overview

This guide covers **optional but recommended** enhancements beyond the core Production-Ready setup. These improvements follow Linux best practices and provide additional robustness.

---

## 🎯 Production++ Features

### **Current Status**: ✅ Production-Ready (Bulletproof v2.0)
- Cron-based monitoring: ✅ Working
- Flock locks: ✅ Preventing overlap
- ENV-based targets: ✅ Configurable
- bash -lc rotation: ✅ Safe date formatting

### **Production++ Enhancements**:
1. **Logrotate Integration** — Replace cron rotation with Linux standard
2. **Separate Boot Log** — Cleaner log organization
3. **PM2 Startup Script** — systemd integration (future)
4. **Grafana Dashboard** — Real-time monitoring UI (future)

---

## 📦 Feature 1: Logrotate Integration

### **Why?**
- **Standard Linux Practice**: Uses OS-native log management
- **Better Compression**: Automatic gzip with `delaycompress`
- **Safer Rotation**: Atomic operations, no cron quoting issues
- **Centralized Config**: Single file in `/etc/logrotate.d/`

### **Current Setup** (Cron-based):
```cron
0 0 * * 0 bash -lc 'DATE=$(date +\%F); mv /home/ubuntu/monitoring/pm2_health.log ...'
```
**Works**: ✅ Yes  
**Risk**: Low (but cron-specific edge cases possible)

### **Production++ Setup** (Logrotate):

#### **Step 1: Create Logrotate Config**
```bash
sudo tee /etc/logrotate.d/titangold-monitoring > /dev/null << 'EOF'
# TitanGold Monitoring Logs Rotation
# Managed by logrotate (Linux standard)
/home/ubuntu/monitoring/pm2_health.log
/home/ubuntu/monitoring/health_check.log
/home/ubuntu/monitoring/boot.log
/home/ubuntu/monitoring/pm2_watchdog.log
{
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
    dateext
    dateformat -%Y-%m-%d
    sharedscripts
    postrotate
        # Optional: reload PM2 logs
        # /usr/lib/node_modules/pm2/bin/pm2 reloadLogs
    endscript
}
EOF
```

#### **Step 2: Test Configuration**
```bash
# Dry-run (see what would happen)
sudo logrotate -d /etc/logrotate.d/titangold-monitoring

# Force rotation (test)
sudo logrotate -f /etc/logrotate.d/titangold-monitoring
```

#### **Step 3: Remove Cron Rotation Line**
```bash
# Edit crontab and remove:
# 0 0 * * 0 bash -lc 'DATE=$(date +\%F); mv /home/ubuntu/monitoring/...'

crontab -e
# Delete the rotation line (keep monitoring jobs)
```

#### **Step 4: Verify Logrotate Schedule**
```bash
# Logrotate runs daily via /etc/cron.daily/logrotate
cat /etc/cron.daily/logrotate

# Check logs
grep "titangold-monitoring" /var/log/syslog
```

### **Logrotate Config Explanation**

| Directive | Meaning |
|-----------|---------|
| `weekly` | Rotate once per week |
| `rotate 4` | Keep 4 weeks of backups (1 month) |
| `compress` | Gzip old logs |
| `delaycompress` | Compress on next rotation (keeps last backup uncompressed) |
| `missingok` | Don't error if log file is missing |
| `notifempty` | Don't rotate empty logs |
| `create 0644 ubuntu ubuntu` | Create new log with permissions and owner |
| `dateext` | Append date to rotated files (e.g., `pm2_health.log-2025-12-28`) |
| `sharedscripts` | Run postrotate once for all logs |
| `postrotate` | Commands to run after rotation |

### **Benefits Over Cron**:
- ✅ Standard Linux practice (audit-friendly)
- ✅ Better compression (automatic gzip)
- ✅ No cron quoting issues
- ✅ Centralized config (`/etc/logrotate.d/`)
- ✅ Automatic cleanup (via `rotate N`)
- ✅ More robust error handling

---

## 📁 Feature 2: Separate Boot Log

### **Why?**
- **Cleaner Organization**: Boot events separate from runtime monitoring
- **Easier Debugging**: Check reboot history without noise
- **Better Audit Trail**: Clear separation of concerns

### **Current Setup**:
```cron
@reboot ... >> /home/ubuntu/monitoring/pm2_health.log ...
```
**Issue**: Boot logs mixed with health snapshots

### **Production++ Setup**:

#### **Updated Cron Entry**:
```cron
# 1) PM2 Auto-Start on Reboot (Primary Recovery)
@reboot sleep 30 && PM2_HOME=/home/ubuntu/.pm2 /usr/lib/node_modules/pm2/bin/pm2 resurrect >> /home/ubuntu/monitoring/boot.log 2>&1 && echo "===== Boot: $(date -Is) =====" >> /home/ubuntu/monitoring/boot.log && /usr/lib/node_modules/pm2/bin/pm2 list >> /home/ubuntu/monitoring/boot.log 2>&1
```

#### **Benefits**:
- ✅ Dedicated boot log (`/home/ubuntu/monitoring/boot.log`)
- ✅ Clear reboot history
- ✅ No mixing with runtime snapshots
- ✅ Easier to check: `cat /home/ubuntu/monitoring/boot.log`

#### **Add to Logrotate**:
Already included in the logrotate config above (`/home/ubuntu/monitoring/boot.log`)

---

## 📊 Feature 3: Enhanced Restart Metrics

### **Current Tracking**:
- `pm2 list` shows total `restarts` count
- Manual restarts included (validation, deployments, etc.)

### **Production++ Metric**:
Track **unexpected restarts** separately:

```bash
# Get unstable_restarts (crashes only)
pm2 jlist | jq -r '.[] | select(.name == "titan-engine-worker") | .pm2_env.unstable_restarts'
```

### **Updated pm2_snapshot.sh**:
Add unstable_restarts to JSON metrics:

```bash
"$PM2_BIN" jlist 2>/dev/null | jq -r '.[] | "\(.name) pid=\(.pid) status=\(.pm2_env.status) restart=\(.pm2_env.restart_time) unstable=\(.pm2_env.unstable_restarts) mem=\(.monit.memory) cpu=\(.monit.cpu)"' >> "$LOGFILE" 2>&1
```

**Output Example**:
```
titan-backend pid=1356 status=online restart=0 unstable=0 mem=52428800 cpu=0%
titan-engine-worker pid=2057 status=online restart=1 unstable=0 mem=48234496 cpu=0%
```

**Interpretation**:
- `restart=1` — Total restarts (includes manual)
- `unstable=0` — Unexpected crashes only ✅

---

## 🔍 Feature 4: Health Check Enhancements

### **Current Setup**:
```bash
# health_check.sh
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API is healthy (HTTP 200)"
else
  echo "❌ API unhealthy (HTTP $HTTP_CODE)"
fi
```

### **Production++ Enhancements**:

#### **A) Response Time Tracking**:
```bash
# Measure response time
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" http://localhost:5002/api/health)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1 | head -n 1)
RESPONSE_TIME=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API healthy (HTTP 200, ${RESPONSE_TIME}s)"
else
  echo "❌ API unhealthy (HTTP $HTTP_CODE)"
fi
```

#### **B) Alert on Slow Response**:
```bash
# Alert if response time > 5 seconds
if (( $(echo "$RESPONSE_TIME > 5.0" | bc -l) )); then
  echo "⚠️ Slow response: ${RESPONSE_TIME}s (threshold: 5s)"
fi
```

#### **C) Check Critical Endpoints**:
```bash
# Check multiple endpoints
for ENDPOINT in /api/health /api/artemis/state /api/dashboard/overview; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002$ENDPOINT)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ $ENDPOINT (HTTP 200)"
  else
    echo "❌ $ENDPOINT (HTTP $HTTP_CODE)"
  fi
done
```

---

## 🚨 Feature 5: Alerting (Future)

### **Telegram/Slack Notifications**:

```bash
# In pm2_watchdog.sh (when resurrection fails)
if [ "$BACKEND_AFTER" -lt "$BACKEND_TARGET" ]; then
  # Send alert
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=🚨 TitanGold Backend Down - Resurrection Failed"
fi
```

---

## 📈 Feature 6: Grafana Dashboard (Future)

### **Data Source**: PM2 JSON metrics
- Scrape `pm2 jlist` every minute
- Push to Prometheus/InfluxDB
- Visualize in Grafana

### **Metrics to Track**:
- Memory usage (per process)
- CPU usage
- Restart count (total + unstable)
- Uptime
- API response time
- Queue size (circuit breaker)

---

## 🎯 Implementation Priority

### **Now (Already Done)**:
- ✅ Cron-based monitoring
- ✅ Flock locks
- ✅ ENV-based targets
- ✅ bash -lc rotation

### **Short-term (Optional)**:
1. **Logrotate Integration** (15 minutes)
2. **Separate Boot Log** (5 minutes)
3. **Enhanced Restart Metrics** (10 minutes)

### **Medium-term (Nice to Have)**:
1. Health check response time tracking
2. Multi-endpoint health checks
3. Telegram/Slack alerting

### **Long-term (Advanced)**:
1. Grafana dashboard
2. systemd integration (replace cron)
3. Distributed monitoring (multi-server)

---

## 📝 Decision Matrix

| Feature | Benefit | Effort | Risk | Recommended? |
|---------|---------|--------|------|--------------|
| **Logrotate** | High (standard practice) | Low (15min) | None | ✅ Yes |
| **Separate Boot Log** | Medium (cleaner logs) | Low (5min) | None | ✅ Yes |
| **Enhanced Metrics** | Medium (better insights) | Low (10min) | None | ✅ Yes |
| **Response Time** | Medium (performance tracking) | Medium (30min) | Low | 🟡 Optional |
| **Multi-endpoint Check** | Medium (coverage) | Medium (30min) | Low | 🟡 Optional |
| **Alerting** | High (proactive) | Medium (1h) | Low | 🟡 Optional |
| **Grafana** | High (visualization) | High (4h) | Medium | 🔵 Future |
| **systemd** | High (robust) | High (2h) | Medium | 🔵 Future |

---

## 🚀 Quick Implementation Guide

### **If you want Production++ now (30 minutes)**:

#### **Step 1: Logrotate** (15 min)
```bash
# Create config
sudo tee /etc/logrotate.d/titangold-monitoring > /dev/null < /tmp/titangold-monitoring

# Test
sudo logrotate -d /etc/logrotate.d/titangold-monitoring

# Remove cron rotation line
crontab -e  # Delete line 50
```

#### **Step 2: Separate Boot Log** (5 min)
```bash
# Update crontab
crontab -e
# Replace @reboot line with boot.log version (from /tmp/titangold_cron_optimized.txt)
```

#### **Step 3: Enhanced Metrics** (10 min)
```bash
# Update pm2_snapshot.sh
# Add unstable_restarts to jq output (see above)
```

---

## ✅ Summary

**Current Status**: ✅ Production-Ready (Bulletproof v2.0)  
**Production++ Features**: 6 enhancements available  
**Recommended Now**: Logrotate + Boot Log + Enhanced Metrics (30 min)  
**Optional Later**: Response Time + Alerting + Grafana  

---

**Decision Point**: Continue with current setup (already production-grade) or implement Production++ features?

**Engineer**: Sepehr Raeisi  
**Automation/Assistant**: Claude AI (Anthropic)
