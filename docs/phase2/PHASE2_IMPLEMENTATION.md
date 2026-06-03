# TitanGold Backup System - Phase 2 Implementation

## Overview

Phase 2 adds comprehensive monitoring, validation, and alerting capabilities to the TitanGold backup system. This phase focuses on proactive monitoring and automated validation to ensure backups are reliable and the system is healthy.

## Date Implemented
**June 3, 2026**

## Components Implemented

### 1. Daily Morning Report System
**Script:** `/usr/local/bin/titangold-daily-report.sh`  
**Schedule:** Daily at 5:00 AM  
**Purpose:** Comprehensive system health and backup status report

**Features:**
- 📦 **Backup Status**
  - Latest backup info (name, size, age)
  - SHA256 checksum verification status
  - Backup growth monitoring (25%/50% thresholds)
  - Retention counts (Daily/Weekly/Monthly)

- 💻 **System Resources**
  - Disk usage with color-coded alerts (70%/80% thresholds)
  - RAM usage with alerts (80%/90% thresholds)
  - CPU load average
  - System uptime

- 🔧 **Service Status**
  - PostgreSQL status
  - Nginx status
  - Backend PM2 status
  - Docker containers (if used)

- 🌐 **Website & API Health**
  - Frontend HTTPS check (HTTP 200 validation)
  - Backend API health endpoint check
  - Response time monitoring
  - SSL certificate expiration tracking

- 📊 **Download Analytics (24h)**
  - Backup download count
  - Unique IP addresses
  - Last download timestamp

- ⚠️ **Recent Errors**
  - ERROR/CRITICAL/FAILED log entries summary
  - Log file location for detailed review

### 2. Monthly Restore Test System
**Script:** `/usr/local/bin/titangold-restore-test.sh`  
**Schedule:** First Sunday of each month at 6:00 AM  
**Purpose:** Validate backups are restorable in isolated environment

**CRITICAL SAFETY FEATURES:**
- ✅ **NEVER touches production database** (`titangold_db`)
- ✅ **Only creates temporary databases:** `titangold_restore_test_YYYYMMDD_HHMMSS`
- ✅ **Automatic cleanup** - drops temporary database after validation
- ✅ **Multiple safety checks** before any restore operation

**Validation Process:**
1. **SHA256 Checksum Verification**
   - Verifies backup file integrity
   - Fails fast if checksum doesn't match
   - Sends urgent Telegram alert on failure

2. **Decryption Test**
   - Tests GPG decryption with passphrase
   - Validates encrypted backup can be opened
   - Uses passphrase from BACKUP_ENCRYPTION_KEY env variable

3. **Restore to Temporary Database**
   - Creates isolated temporary database
   - Restores full backup to temporary DB
   - Measures restore duration

4. **Database Validation**
   - Tests database connection
   - Counts tables in schema
   - Counts rows in key tables (users, sessions, agents, conversations, messages)
   - Measures restored database size

5. **Cleanup**
   - Drops temporary database
   - Removes temporary SQL file
   - Confirms no traces left behind

6. **Telegram Report**
   - Success report with all validation metrics
   - Failure alert with specific error details
   - Confirmation that production DB was untouched

### 3. SHA256 Integrity Monitoring
**Implementation:** Integrated into `titangold-backup-rotation.sh`

**Features:**
- Automatic SHA256 generation for all new backups
- Checksum files stored alongside backup files (`.sha256` extension)
- Verification during health checks and restore tests
- Short hash displayed in Telegram messages (first 8 characters)

### 4. Backup Growth Monitoring
**Log File:** `/var/log/titangold-backup-growth.log`

**Thresholds:**
- ✅ **NORMAL:** < 25% change
- ⚠️ **WARNING:** 25-50% change
- 🔴 **CRITICAL:** > 50% change

**Tracked Metrics:**
- Daily backup size in bytes
- Size difference from previous backup
- Percentage change
- Historical trend data

### 5. Download Analytics
**Log Source:** `/var/log/nginx/titangold-backup-downloads.log`

**Metrics:**
- Download count (last 24 hours)
- Unique IP addresses (privacy-preserved count)
- Last download timestamp
- Download patterns

### 6. Enhanced Temporary Download Links
**Directory:** `/var/www/titangold-temp-backups/`

**Security Features:**
- 32-character random token in filename
- 24-hour automatic expiration
- No directory listing (autoindex off)
- Only .gpg file downloads allowed
- Hourly cleanup cron job
- HTTPS-only (enforced via Nginx)

**Security Headers:**
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Content-Disposition "attachment";
```

## Cron Schedule

```cron
# TitanGold Backup System (Production Grade 7-4-3 Policy)
# Daily backup rotation at 3:00 AM
0 3 * * * /usr/local/bin/titangold-backup-rotation.sh >> /var/log/titangold-backup-rotation.log 2>&1

# Monthly backup on 1st of month at 4:00 AM
0 4 1 * * /usr/local/bin/titangold-monthly-backup.sh >> /var/log/titangold-backup-rotation.log 2>&1

# TitanGold Monitoring & Alerts (Phase 2)
# Daily morning report at 5:00 AM (includes health check)
0 5 * * * /usr/local/bin/titangold-daily-report.sh >> /var/log/titangold-backup-rotation.log 2>&1

# Monthly restore test - First Sunday of each month at 6:00 AM
0 6 * * 0 [ $(date +\%d) -le 7 ] && /usr/local/bin/titangold-restore-test.sh >> /var/log/titangold-backup-rotation.log 2>&1

# TitanGold Temp Backup Cleanup (delete files older than 24 hours)
0 * * * * find /var/www/titangold-temp-backups -type f -mmin +1440 -delete
```

## Configuration Files

### Environment Variables
**File:** `/etc/titangold-backup.env` (600 permissions, root only)

```bash
TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
BACKUP_BASE_URL="https://titan.zala.ir"
BACKUP_LINK_TTL_HOURS="24"
```

**⚠️ SECURITY:** This file is NEVER committed to GitHub - it exists only on production server!

### Nginx Configuration
**File:** `/etc/nginx/sites-available/titan-zala`

```nginx
# Temporary Backup Downloads (Secure)
location /temp-backups/ {
    alias /var/www/titangold-temp-backups/;
    autoindex off;
    
    # Only allow GET and HEAD
    limit_except GET HEAD {
        deny all;
    }
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Content-Disposition "attachment";
    
    # Access logs
    access_log /var/log/nginx/titangold-backup-downloads.log;
}
```

## Testing & Validation

### Manual Testing Commands

```bash
# Test daily report
sudo /usr/local/bin/titangold-daily-report.sh

# Test restore (SAFE - uses temporary database only)
sudo /usr/local/bin/titangold-restore-test.sh

# Check logs
sudo tail -f /var/log/titangold-backup-rotation.log

# Verify cron jobs
sudo crontab -l | grep titangold

# Check backup growth log
cat /var/log/titangold-backup-growth.log

# Check download analytics
tail -20 /var/log/nginx/titangold-backup-downloads.log

# Verify temporary databases (should show only production DB)
sudo -u postgres psql -h localhost -p 5433 -c "\l" | grep titangold
```

### Safety Verification

**Production Database Protection:**
```bash
# This should ONLY show titangold_db (production)
# Any titangold_restore_test_* databases should be cleaned up automatically
sudo -u postgres psql -h localhost -p 5433 -c "\l" | grep "titangold"
```

**Expected Output:**
```
 titangold_db    | postgres | UTF8 | en_US.UTF-8 | en_US.UTF-8 |
```

## Telegram Notifications

### Daily Morning Report Format
```
🌅 TitanGold Daily Morning Report
2026-06-03 05:00:00

📦 Backup Status
  Latest: titangold_daily_2026-06-03.sql.gpg
  Size: 905M
  Age: 3h
  SHA256: ✅ 092f4ea6...
  Growth: ✅ NORMAL 1.8%
  Retention: 7D / 4W / 2M

💻 System Resources
  Disk: ✅ 42G / 97G (43%)
  RAM: ✅ 3.7G / 7.6G (48%)
  CPU Load: 0.15, 0.20, 0.18
  Uptime: 45 days, 12 hours

🔧 Service Status
  PostgreSQL: ✅ Running
  Nginx: ✅ Running
  Backend: 🔴 Offline

🌐 Website and API Health
  Frontend: ✅ HTTP 200 (0.234s)
  API: 🔴 HTTP 404 (timeout)
  SSL: Valid until 2027-06-03

📊 Download Analytics (24h)
  Downloads: 3
  Unique IPs: 2
  Last: 03/Jun/2026:14:23:45

⚠️ Recent Errors
  Found 12 errors in log
  Check /var/log/titangold-backup-rotation.log
```

### Monthly Restore Test Format
```
✅ Monthly Restore Test PASSED

📦 Backup: titangold_daily_2026-06-03.sql.gpg
📊 Size: 905M

Validation Results:
✅ PASS
✅ Decryption: 5.0G
✅ Restore: 127s
✅ Connection: OK
✅ Tables: 28
✅ Total rows: 145,892
✅ DB Size: 4.8GB
✅ Cleanup: Complete

🔒 Production DB (titangold_db) was not touched
```

## Monitoring Metrics

### Health Check Thresholds

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Disk Usage | < 70% | 70-80% | > 80% |
| RAM Usage | < 80% | 80-90% | > 90% |
| Backup Age | < 24h | 24-48h | > 48h |
| Backup Growth | < 25% | 25-50% | > 50% |
| HTTP Status | 200 | 3xx | 4xx/5xx |

### Alert Triggers

**Urgent Alerts (Immediate Telegram):**
- Backup restore test failure
- Checksum verification failure
- Decryption failure
- No backups found
- Backup age > 48 hours
- Critical backup growth (> 50%)

**Warning Alerts (Daily Report):**
- Backup growth 25-50%
- Disk usage 70-80%
- RAM usage 80-90%
- Recent errors in logs

## Future Enhancements (Phase 3)

### Telegram Bot Commands
Interactive status bot:
- `/status` - Current system status
- `/backup` - Latest backup info
- `/health` - Service health check
- `/logs` - Recent log entries

### Offsite Backup Sync
- Automatic cloud storage sync (S3, Google Drive, rclone)
- 3-2-1 backup rule compliance
- Geographic redundancy

### Advanced Monitoring
- Grafana dashboard integration
- Prometheus metrics export
- Email alert fallback
- Discord webhook integration

## Files Modified/Created

### Production Server Files
- `/usr/local/bin/titangold-daily-report.sh` - Daily report script
- `/usr/local/bin/titangold-restore-test.sh` - Monthly restore test
- `/var/log/titangold-backup-growth.log` - Growth tracking log
- `/etc/titangold-backup.env` - Telegram credentials (NOT in Git)
- Root crontab - Updated schedule

### Repository Files
- `scripts/phase2-monitoring/titangold-daily-report.sh`
- `scripts/phase2-monitoring/titangold-restore-test.sh`
- `docs/phase2/PHASE2_IMPLEMENTATION.md` (this file)
- `docs/phase2/PHASE2_TESTING_GUIDE.md`
- `docs/phase2/PHASE2_SAFETY_CHECKLIST.md`

## Rollback Plan

If Phase 2 causes issues:

1. **Remove cron jobs:**
```bash
sudo crontab -l | grep -v "daily-report\|restore-test" | sudo crontab -
```

2. **Stop running scripts:**
```bash
sudo pkill -f titangold-daily-report
sudo pkill -f titangold-restore-test
```

3. **Check for temporary databases:**
```bash
sudo -u postgres psql -h localhost -p 5433 -c "\l" | grep restore_test
# If any exist, drop them:
sudo -u postgres psql -h localhost -p 5433 -c "DROP DATABASE IF EXISTS titangold_restore_test_XXXXXXXX_XXXXXX;"
```

4. **Phase 1 continues working normally** - backup rotation and Telegram notifications remain functional.

## Success Criteria

- ✅ Daily reports sent successfully at 5:00 AM
- ✅ Monthly restore tests pass validation
- ✅ Production database never touched during restore tests
- ✅ Temporary databases automatically cleaned up
- ✅ SHA256 checksums generated for all backups
- ✅ Download analytics tracking working
- ✅ Backup growth monitoring operational
- ✅ All Telegram notifications delivered successfully
- ✅ No secrets committed to GitHub

## Support & Troubleshooting

### Common Issues

**Issue:** Daily report not received  
**Check:** `sudo tail -50 /var/log/titangold-backup-rotation.log | grep DAILY_REPORT`

**Issue:** Restore test failed  
**Check:** `sudo tail -100 /var/log/titangold-backup-rotation.log | grep RESTORE_TEST`

**Issue:** Temporary database not cleaned up  
**Fix:** `sudo -u postgres psql -h localhost -p 5433 -c "DROP DATABASE titangold_restore_test_XXXXXXXX_XXXXXX;"`

**Issue:** Download links not working  
**Check:** `sudo nginx -t && sudo systemctl reload nginx`

### Log Files

- `/var/log/titangold-backup-rotation.log` - All backup system logs
- `/var/log/titangold-backup-growth.log` - Growth tracking history
- `/var/log/nginx/titangold-backup-downloads.log` - Download analytics
- `/var/log/nginx/error.log` - Nginx errors

## Conclusion

Phase 2 transforms TitanGold backup from a passive system into an active monitoring and validation platform. The system now proactively checks its own health, validates backups are restorable, and provides comprehensive daily status reports - all while maintaining strict safety protocols to protect production data.

**Next Steps:** Consider implementing Phase 3 (Interactive Telegram Bot & Offsite Sync) for even more robust disaster recovery capabilities.
