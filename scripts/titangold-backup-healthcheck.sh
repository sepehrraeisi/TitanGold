#!/bin/bash
#
# TitanGold Backup Health Check
# Verifies backup integrity and freshness
#
# Usage: Run via cron daily at 5 AM
# 0 5 * * * /usr/local/bin/titangold-backup-healthcheck.sh
#

set -euo pipefail

# Configuration
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
LOG_FILE="/var/log/titangold-backup-rotation.log"
MAX_AGE_HOURS=48  # Alert if latest backup is older than 48 hours

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Alert function (can be extended to send email/Telegram)
alert() {
    log "⚠️ ALERT: $1"
    logger -p user.warning -t titangold-backup "ALERT: $1"
    # TODO: Send Telegram/Email notification
}

log "=== Starting Backup Health Check ==="

# Check if daily backup directory exists
if [ ! -d "$DAILY_DIR" ]; then
    alert "Daily backup directory not found: $DAILY_DIR"
    exit 1
fi

# Find latest daily backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    alert "No daily backups found in $DAILY_DIR"
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
BACKUP_AGE_SECONDS=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))
BACKUP_AGE_HOURS=$((BACKUP_AGE_SECONDS / 3600))

log "Latest backup: $BACKUP_NAME (Size: $BACKUP_SIZE, Age: ${BACKUP_AGE_HOURS}h)"

# Check backup age
if [ "$BACKUP_AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    alert "Latest backup is too old: ${BACKUP_AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"
    exit 1
fi

# Check backup size (should be > 10KB, adjust based on your DB size)
BACKUP_SIZE_BYTES=$(stat -c %s "$LATEST_BACKUP")
MIN_SIZE_BYTES=$((10 * 1024))  # 10 KB minimum

if [ "$BACKUP_SIZE_BYTES" -lt "$MIN_SIZE_BYTES" ]; then
    alert "Latest backup is suspiciously small: $BACKUP_SIZE (${BACKUP_SIZE_BYTES} bytes)"
    exit 1
fi

# Check GPG integrity (optional, requires passphrase)
# if ! gpg --list-packets "$LATEST_BACKUP" > /dev/null 2>&1; then
#     alert "GPG integrity check failed for: $BACKUP_NAME"
#     exit 1
# fi

log "✅ Backup health check passed: $BACKUP_NAME (${BACKUP_AGE_HOURS}h old, $BACKUP_SIZE)"
logger -t titangold-backup "Health check passed: $BACKUP_NAME"

log "=== Backup Health Check Completed ==="
exit 0
