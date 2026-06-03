# Database Backup and Restore Documentation

**Task**: INFRA-003  
**Date**: 2026-01-06  
**Status**: ✅ COMPLETE

## Overview

This document describes the automated database backup and restore system for the TitanGold trading platform. The system implements a comprehensive backup strategy with encryption, automated retention, and well-documented restore procedures.

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Backup Schedule](#backup-schedule)
3. [Backup Encryption](#backup-encryption)
4. [Retention Policy](#retention-policy)
5. [Backup Script Usage](#backup-script-usage)
6. [Restore Process](#restore-process)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Recovery Objectives](#recovery-objectives)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Backup Strategy

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│                 titangold_db (port 5433)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼ pg_dump
┌─────────────────────────────────────────────────────────────┐
│                    Backup Script                            │
│              scripts/backup-db.sh                           │
│                                                             │
│  1. Determine backup type (daily/weekly)                   │
│  2. Perform pg_dump (plain SQL format)                     │
│  3. Encrypt with GPG (AES256)                              │
│  4. Store in appropriate directory                         │
│  5. Clean up old backups (30-day retention)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐        ┌────────────────┐
│ Daily Backups │        │ Weekly Backups │
│               │        │                │
│ /var/backups/ │        │ /var/backups/  │
│ titangold/    │        │ titangold/     │
│ daily/        │        │ weekly/        │
│               │        │                │
│ Retention:    │        │ Retention:     │
│ 30 days       │        │ 30 days        │
└───────────────┘        └────────────────┘
```

### Backup Types

1. **Daily Backups**
   - Run every day at 2:00 AM
   - Stored in `/var/backups/titangold/daily/`
   - Filename format: `titangold_daily_YYYY-MM-DD.sql.gpg`
   - One backup per day (overwrites same-day backup)
   - Encrypted with GPG (AES256)

2. **Weekly Backups**
   - Run every Sunday at 2:00 AM (same schedule, different storage)
   - Stored in `/var/backups/titangold/weekly/`
   - Filename format: `titangold_weekly_YYYY-MM-DD_HH-MM-SS.sql.gpg`
   - Multiple backups per week (timestamped)
   - Encrypted with GPG (AES256)

### Database Information

- **Database Name**: titangold_db
- **Database Port**: 5433
- **Database Size**: ~147 MB (as of 2026-01-06)
- **Backup Size**: ~20 MB (compressed and encrypted)
- **Backup Format**: Plain SQL (pg_dump format)

---

## Backup Schedule

### Automated Schedule (Cron)

The backup system runs automatically via cron jobs configured for the `postgres` user:

```cron
# Daily database backup (Sunday becomes weekly automatically)
0 2 * * * /home/ubuntu/webapp/TitanGold/scripts/backup-db.sh >> /var/log/titangold-backup.log 2>&1

# Log rotation to prevent log files from growing too large
0 0 1 * * find /var/log/titangold-*.log -size +100M -exec truncate -s 50M {} \;
```

**Schedule Details:**
- **Daily Backups**: Every day at 2:00 AM UTC
- **Weekly Backups**: Every Sunday at 2:00 AM UTC (automatically detected)
- **Log Rotation**: First day of each month at midnight

### Viewing Cron Schedule

```bash
# View current cron jobs for postgres user
sudo crontab -u postgres -l

# Edit cron jobs (if needed)
sudo crontab -u postgres -e
```

---

## Backup Encryption

### Encryption Method

All backups are encrypted using **GPG (GNU Privacy Guard)** with the following settings:

- **Algorithm**: AES256 (symmetric encryption)
- **Cipher**: AES256
- **Passphrase**: Stored in environment variable `BACKUP_ENCRYPTION_KEY`
- **Default Passphrase**: `YOUR_ENCRYPTION_KEY_HERE` (change in production!)

### Security Considerations

⚠️ **IMPORTANT**: The default encryption passphrase is for development/testing only. In production:

1. **Change the passphrase** to a strong, unique key
2. **Store securely** in environment variables or secrets manager
3. **Document location** of passphrase (secure location only)
4. **Backup the passphrase** separately from backups
5. **Rotate regularly** (recommended: every 90 days)

### Setting Custom Encryption Key

```bash
# Set environment variable for backup script
export BACKUP_ENCRYPTION_KEY="your-strong-passphrase-here"

# Or add to postgres user's environment
sudo -u postgres bash -c 'echo "export BACKUP_ENCRYPTION_KEY=\"your-key\"" >> ~/.bashrc'
```

### Manual Encryption/Decryption

```bash
# Encrypt a backup manually
gpg --symmetric --cipher-algo AES256 --output backup.sql.gpg backup.sql

# Decrypt a backup manually
gpg --decrypt --output backup.sql backup.sql.gpg
```

---

## Retention Policy

### 30-Day Retention

The backup system automatically implements a **30-day retention policy**:

- **Daily Backups**: Kept for 30 days, then automatically deleted
- **Weekly Backups**: Kept for 30 days, then automatically deleted
- **Cleanup**: Runs after each backup operation

### Storage Calculation

With current database size (147 MB → 20 MB encrypted):

- **Daily Backups**: ~30 files × 20 MB = ~600 MB
- **Weekly Backups**: ~4-5 files × 20 MB = ~100 MB
- **Total Storage**: ~700 MB (approximate)

### Manual Cleanup

To manually clean up old backups:

```bash
# Remove backups older than 30 days
sudo find /var/backups/titangold/daily -name "*.sql*" -type f -mtime +30 -delete
sudo find /var/backups/titangold/weekly -name "*.sql*" -type f -mtime +30 -delete
```

---

## Backup Script Usage

### Manual Backup

To manually trigger a backup:

```bash
# Run as postgres user
sudo -u postgres /home/ubuntu/webapp/TitanGold/scripts/backup-db.sh

# Or run as root
sudo /home/ubuntu/webapp/TitanGold/scripts/backup-db.sh
```

### Backup Process

The script performs the following steps:

1. **Check Prerequisites**
   - Verify pg_dump is available
   - Verify GPG is available
   - Check backup directories exist

2. **Determine Backup Type**
   - Check day of week (Sunday = weekly, others = daily)

3. **Perform Database Dump**
   - Use pg_dump to export database
   - Plain SQL format for maximum compatibility
   - Options: `--no-owner`, `--no-privileges`, `--clean`, `--if-exists`

4. **Encrypt Backup**
   - Use GPG with AES256 encryption
   - Remove unencrypted backup file

5. **Verify Backup**
   - Check file exists and has content
   - Log success or failure

6. **Cleanup Old Backups**
   - Remove backups older than 30 days

7. **Display Statistics**
   - Show backup counts and sizes

### Monitoring Backups

```bash
# View backup log
sudo tail -f /var/log/titangold-backup.log

# View last backup
sudo tail -50 /var/log/titangold-backup.log

# Check backup sizes
sudo du -sh /var/backups/titangold/{daily,weekly}

# List recent backups
sudo ls -lht /var/backups/titangold/daily/ | head -10
sudo ls -lht /var/backups/titangold/weekly/ | head -10
```

---

## Restore Process

### Restore Script

The restore script (`scripts/restore-db.sh`) provides a safe, documented restore process.

### List Available Backups

```bash
# List all available backups
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh --list
```

### Restore from Specific File

```bash
# Restore from a specific backup file
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh \
  --file /var/backups/titangold/daily/titangold_daily_2026-01-06.sql.gpg

# With auto-confirmation (skip prompt)
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh \
  --file /var/backups/titangold/daily/titangold_daily_2026-01-06.sql.gpg \
  --yes
```

### Restore from Date

```bash
# Restore from a specific date (auto-select backup)
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh --date 2026-01-06
```

### Restore Process Steps

The restore script performs the following steps:

1. **Verify Prerequisites**
   - Check database connection
   - Verify backup file exists

2. **Confirm Restore Action**
   - Display warning and confirmation prompt
   - User must type "yes" to continue

3. **Stop Services**
   - Stop PM2 services (titan-backend, titan-engine-worker)
   - Prevent active connections during restore

4. **Create Safety Backup**
   - Backup current database to `/tmp/titangold_pre_restore_*.sql`
   - Keep this file until restore is verified

5. **Decrypt Backup**
   - Decrypt GPG backup file
   - Create temporary unencrypted file

6. **Terminate Database Connections**
   - Force disconnect all active sessions

7. **Restore Database**
   - Run psql with backup file
   - This may take several minutes

8. **Verify Restore**
   - Basic verification (check tables exist)

9. **Start Services**
   - Restart PM2 services

10. **Cleanup**
    - Remove temporary decrypted file
    - Log completion

### Recovery Time

- **Small Database** (< 100 MB): 1-2 minutes
- **Medium Database** (100 MB - 1 GB): 5-10 minutes
- **Large Database** (> 1 GB): 15-30 minutes

---

## Monitoring and Alerts

### Log Files

**Backup Log**: `/var/log/titangold-backup.log`
```bash
# Monitor backup operations
sudo tail -f /var/log/titangold-backup.log
```

**Restore Log**: `/var/log/titangold-restore.log`
```bash
# Monitor restore operations
sudo tail -f /var/log/titangold-restore.log
```

### Success Indicators

✅ **Successful Backup Indicators:**
- Log contains `[SUCCESS] Backup process completed successfully`
- Backup file exists in target directory
- File size is reasonable (> 1 MB)
- Encrypted file ends with `.gpg`

❌ **Failed Backup Indicators:**
- Log contains `[ERROR] Backup process failed`
- `[ERROR] Database dump failed`
- `[ERROR] Encryption failed`
- No backup file created

### Alert System

The backup script includes alert functions for monitoring integration:

```bash
# Alert function (currently logs to file)
send_alert() {
    local message="$1"
    log_error "ALERT: ${message}"
    # TODO: MONITORING-004 - Integrate with monitoring service
}
```

**Future Integration (MONITORING-004):**
- Email notifications (SMTP)
- Slack/Discord webhooks
- PagerDuty integration
- Prometheus metrics
- Grafana dashboards

### Manual Monitoring

```bash
# Check backup health (run daily)
#!/bin/bash

# Check if backup ran today
TODAY=$(date +%Y-%m-%d)
BACKUP_FILE="/var/backups/titangold/daily/titangold_daily_${TODAY}.sql.gpg"

if [[ -f "${BACKUP_FILE}" ]]; then
    echo "✅ Backup exists for today"
    echo "   Size: $(du -h ${BACKUP_FILE} | cut -f1)"
    echo "   Modified: $(stat -c %y ${BACKUP_FILE})"
else
    echo "❌ WARNING: No backup found for today!"
fi

# Check last backup log entry
echo ""
echo "Last backup log entries:"
sudo tail -20 /var/log/titangold-backup.log | grep -E "SUCCESS|ERROR|ALERT"
```

---

## Recovery Objectives

### Recovery Point Objective (RPO)

**RPO: 24 hours**

- Daily backups run at 2:00 AM
- Maximum data loss: 24 hours
- Most recent backup is always available

**To Reduce RPO:**
- Increase backup frequency (e.g., every 6 hours)
- Implement continuous backup (WAL archiving)
- Use PostgreSQL streaming replication

### Recovery Time Objective (RTO)

**RTO: 4 hours**

- Restore process is well-documented
- Automated restore script available
- Tested restore procedures

**Restore Time Breakdown:**
1. Identify issue: 30 minutes
2. Locate backup: 15 minutes
3. Run restore script: 5-10 minutes
4. Verify restore: 30 minutes
5. Test application: 1 hour
6. Total: ~2-3 hours (well within 4-hour RTO)

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Backup Script Fails with "Permission Denied"

**Symptoms:**
```
[ERROR] Database dump failed
tee: /var/log/titangold-backup.log: Permission denied
```

**Solution:**
```bash
# Create log files with correct permissions
sudo touch /var/log/titangold-backup.log
sudo chown postgres:postgres /var/log/titangold-backup.log
sudo chmod 664 /var/log/titangold-backup.log

# Verify backup directory permissions
sudo chown -R postgres:postgres /var/backups/titangold
```

#### Issue: Encryption Fails

**Symptoms:**
```
[ERROR] Encryption failed. Keeping unencrypted backup.
[WARNING] Backup NOT encrypted (GPG not available)
```

**Solution:**
```bash
# Install GPG
sudo apt-get update
sudo apt-get install -y gnupg

# Verify GPG is available
gpg --version

# Test encryption
echo "test" | gpg --symmetric --cipher-algo AES256 --output test.gpg
gpg --decrypt test.gpg
```

#### Issue: Restore Fails - Cannot Connect

**Symptoms:**
```
[ERROR] Cannot connect to database
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify port 5433 is listening
sudo netstat -tulpn | grep 5433

# Test connection manually
sudo -u postgres psql -p 5433 -d titangold_db -c "SELECT 1;"

# Check pg_hba.conf for localhost access
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

#### Issue: Restore Fails - Decryption Error

**Symptoms:**
```
[ERROR] Failed to decrypt backup. Check passphrase.
```

**Solution:**
```bash
# Verify encryption passphrase
echo $BACKUP_ENCRYPTION_KEY

# Set correct passphrase
export BACKUP_ENCRYPTION_KEY="YOUR_ENCRYPTION_KEY_HERE"

# Test decryption manually
echo "YOUR_ENCRYPTION_KEY_HERE" | gpg --batch --passphrase-fd 0 --decrypt backup.sql.gpg
```

#### Issue: Disk Space Full

**Symptoms:**
```
No space left on device
```

**Solution:**
```bash
# Check disk space
df -h /var/backups

# Remove old backups manually
sudo find /var/backups/titangold -type f -mtime +30 -delete

# Increase retention cleanup frequency
# Edit backup script to reduce retention from 30 to 14 days
```

#### Issue: Cron Job Not Running

**Symptoms:**
- No new backups being created
- Last backup is old

**Solution:**
```bash
# Check cron is running
sudo systemctl status cron

# Verify crontab is installed
sudo crontab -u postgres -l

# Check cron logs
sudo grep CRON /var/log/syslog | tail -20

# Test script manually
sudo -u postgres /home/ubuntu/webapp/TitanGold/scripts/backup-db.sh

# Reinstall crontab
sudo crontab -u postgres /home/ubuntu/webapp/TitanGold/scripts/postgres-crontab
```

---

## Best Practices

### 1. Regular Testing

**Test restores regularly** (recommended: monthly):

```bash
# Create a test database
sudo -u postgres createdb -p 5433 titangold_test

# Restore to test database
sudo -u postgres psql -p 5433 -d titangold_test -f /path/to/backup.sql

# Verify test database
sudo -u postgres psql -p 5433 -d titangold_test -c "\dt"

# Drop test database
sudo -u postgres dropdb -p 5433 titangold_test
```

### 2. Monitor Backup Success

Set up a daily check (via cron):

```bash
# Add to crontab
0 9 * * * /home/ubuntu/webapp/TitanGold/scripts/check-backup-health.sh
```

### 3. Off-Site Backup Storage

**Current**: Local storage only  
**Recommended**: Implement off-site backup (INFRA-006)

Options:
- AWS S3
- Backblaze B2
- DigitalOcean Spaces
- Rsync to remote server
- Cloud backup service

### 4. Encryption Key Management

- **Change default key** immediately in production
- **Store securely** (secrets manager, not in code)
- **Document location** (secure wiki, not public)
- **Test decryption** before rotating keys
- **Rotate regularly** (every 90 days)

### 5. Backup Verification

Implement automated backup verification:

```bash
# Verify backup integrity
gpg --decrypt backup.sql.gpg > /dev/null 2>&1
if [[ $? -eq 0 ]]; then
    echo "✅ Backup file is valid"
else
    echo "❌ Backup file is corrupted"
fi
```

### 6. Database Growth Monitoring

Monitor database size and adjust retention:

```bash
# Check database size
sudo -u postgres psql -p 5433 -d titangold_db -c \
  "SELECT pg_size_pretty(pg_database_size('titangold_db'));"

# Check backup directory size
du -sh /var/backups/titangold

# If backups grow too large:
# - Reduce retention period
# - Implement differential backups
# - Compress more aggressively
```

### 7. Documentation Updates

Keep this document updated when:
- Changing backup schedule
- Modifying encryption settings
- Updating retention policy
- Moving to new storage location
- Changing database configuration

---

## Migration Path: Local to Cloud Storage

**Current**: Local storage (`/var/backups/titangold/`)  
**Future**: Cloud storage (AWS S3, etc.)

### Migration Plan (INFRA-006)

1. **Choose Cloud Provider**
   - AWS S3 (most popular)
   - Backblaze B2 (cost-effective)
   - DigitalOcean Spaces (simple)

2. **Update Backup Script**
   - Add cloud upload after local backup
   - Use AWS CLI or s3cmd
   - Encrypt before upload (double encryption)

3. **Update Restore Script**
   - Add cloud download functionality
   - Verify file integrity after download

4. **Test Migration**
   - Test upload/download
   - Verify restore from cloud

5. **Update Documentation**
   - Document cloud credentials
   - Update restore procedures

### Example Cloud Upload (AWS S3)

```bash
# Install AWS CLI
sudo apt-get install -y awscli

# Configure credentials
aws configure

# Upload backup to S3
aws s3 cp /var/backups/titangold/daily/backup.sql.gpg \
  s3://titangold-backups/daily/

# Download from S3
aws s3 cp s3://titangold-backups/daily/backup.sql.gpg \
  /tmp/restore.sql.gpg
```

---

## Disaster Recovery Scenarios

### Scenario 1: Accidental Data Deletion

**Impact**: Medium  
**Recovery Time**: 1-2 hours

**Steps:**
1. Stop application to prevent further changes
2. List available backups
3. Identify most recent backup before deletion
4. Restore database
5. Verify data is recovered
6. Restart application

### Scenario 2: Database Corruption

**Impact**: High  
**Recovery Time**: 2-3 hours

**Steps:**
1. Stop all services
2. Attempt database repair (pg_resetwal, pg_dump)
3. If repair fails, restore from backup
4. Verify database integrity
5. Restart services
6. Monitor for issues

### Scenario 3: Server Failure

**Impact**: Critical  
**Recovery Time**: 4-8 hours

**Steps:**
1. Provision new server
2. Install PostgreSQL
3. Copy backups to new server (or download from cloud)
4. Restore database
5. Update application configuration
6. Test thoroughly
7. Update DNS/load balancer

### Scenario 4: Ransomware Attack

**Impact**: Critical  
**Recovery Time**: 8-24 hours

**Steps:**
1. Isolate affected systems
2. Verify backups are not encrypted
3. Provision clean server
4. Restore from oldest unaffected backup
5. Apply transaction logs if available
6. Verify data integrity
7. Implement additional security measures

---

## Appendix

### A. File Locations

| Item | Path |
|------|------|
| Backup Script | `/home/ubuntu/webapp/TitanGold/scripts/backup-db.sh` |
| Restore Script | `/home/ubuntu/webapp/TitanGold/scripts/restore-db.sh` |
| Daily Backups | `/var/backups/titangold/daily/` |
| Weekly Backups | `/var/backups/titangold/weekly/` |
| Backup Log | `/var/log/titangold-backup.log` |
| Restore Log | `/var/log/titangold-restore.log` |
| Cron Jobs | `sudo crontab -u postgres -l` |

### B. Commands Reference

```bash
# Backup Commands
sudo -u postgres /home/ubuntu/webapp/TitanGold/scripts/backup-db.sh
sudo tail -f /var/log/titangold-backup.log

# Restore Commands
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh --list
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh --date 2026-01-06
sudo /home/ubuntu/webapp/TitanGold/scripts/restore-db.sh --file /path/to/backup.sql.gpg

# Monitoring Commands
sudo ls -lht /var/backups/titangold/daily/ | head -10
sudo du -sh /var/backups/titangold
sudo tail -50 /var/log/titangold-backup.log

# Database Commands
sudo -u postgres psql -p 5433 -d titangold_db
sudo -u postgres pg_dump -p 5433 titangold_db > manual_backup.sql
sudo systemctl status postgresql

# Cron Commands
sudo crontab -u postgres -l
sudo crontab -u postgres -e
grep CRON /var/log/syslog | tail -20
```

### C. Environment Variables

```bash
# Backup encryption key (REQUIRED)
export BACKUP_ENCRYPTION_KEY="YOUR_ENCRYPTION_KEY_HERE"

# Add to postgres user profile
sudo -u postgres bash -c 'echo "export BACKUP_ENCRYPTION_KEY=\"your-key\"" >> ~/.bashrc'
```

### D. Follow-Up Tasks

**High Priority:**
- **INFRA-006**: Implement cloud backup storage (AWS S3/Backblaze B2)
- **MONITORING-004**: Set up backup monitoring and alerts
- **SECURITY-003**: Implement encryption key rotation

**Medium Priority:**
- **INFRA-007**: Implement PostgreSQL WAL archiving for point-in-time recovery
- **DOCS-003**: Create disaster recovery runbook
- **TESTING-002**: Implement automated restore testing

**Low Priority:**
- **INFRA-008**: Set up database replication for high availability
- **MONITORING-005**: Create backup metrics dashboard (Grafana)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-06 | 1.0 | Initial documentation for INFRA-003 | TitanGold Team |

---

## Support

For issues or questions about the backup system:

1. Check this documentation first
2. Review log files (`/var/log/titangold-*.log`)
3. Test scripts manually
4. Contact DevOps team
5. Create issue in project tracker

---

**Last Updated**: 2026-01-06  
**Review Cycle**: Quarterly  
**Owner**: Infrastructure Team
