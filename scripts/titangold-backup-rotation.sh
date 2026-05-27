#!/bin/bash
#
# TitanGold Backup Rotation Script (7-4-3 Policy)
# Professional backup retention: 7 daily, 4 weekly, 3 monthly
#
# Usage: Run via cron daily at 3 AM
# 0 3 * * * /usr/local/bin/titangold-backup-rotation.sh
#

set -euo pipefail

# Configuration
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
WEEKLY_DIR="${BACKUP_BASE}/weekly"
MONTHLY_DIR="${BACKUP_BASE}/monthly"
LOG_FILE="/var/log/titangold-backup-rotation.log"

# Retention periods
DAILY_RETENTION=7    # Keep last 7 days
WEEKLY_RETENTION=28  # Keep last 4 weeks (4*7=28 days)
MONTHLY_RETENTION=90 # Keep last 3 months (~90 days)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log "ERROR: This script must be run as root (sudo)"
    exit 1
fi

log "=== Starting TitanGold Backup Rotation ==="

# Count before
DAILY_BEFORE=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" | wc -l)
WEEKLY_BEFORE=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" | wc -l)
MONTHLY_BEFORE=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" | wc -l)

log "Before rotation: Daily=$DAILY_BEFORE, Weekly=$WEEKLY_BEFORE, Monthly=$MONTHLY_BEFORE"

# Rotate daily backups (keep last 7 days)
log "Rotating daily backups (keeping last $DAILY_RETENTION days)..."
find "$DAILY_DIR" -type f -name "*.sql.gpg" -mtime +$DAILY_RETENTION -delete
DAILY_DELETED=$((DAILY_BEFORE - $(find "$DAILY_DIR" -type f -name "*.sql.gpg" | wc -l)))

# Rotate weekly backups (keep last 4 weeks)
log "Rotating weekly backups (keeping last $WEEKLY_RETENTION days)..."
find "$WEEKLY_DIR" -type f -name "*.sql.gpg" -mtime +$WEEKLY_RETENTION -delete
WEEKLY_DELETED=$((WEEKLY_BEFORE - $(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" | wc -l)))

# Rotate monthly backups (keep last 3 months)
log "Rotating monthly backups (keeping last $MONTHLY_RETENTION days)..."
find "$MONTHLY_DIR" -type f -name "*.sql.gpg" -mtime +$MONTHLY_RETENTION -delete
MONTHLY_DELETED=$((MONTHLY_BEFORE - $(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" | wc -l)))

# Count after
DAILY_AFTER=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" | wc -l)
WEEKLY_AFTER=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" | wc -l)
MONTHLY_AFTER=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" | wc -l)

log "After rotation: Daily=$DAILY_AFTER, Weekly=$WEEKLY_AFTER, Monthly=$MONTHLY_AFTER"
log "Deleted: Daily=$DAILY_DELETED, Weekly=$WEEKLY_DELETED, Monthly=$MONTHLY_DELETED"

# Calculate space usage
DAILY_SIZE=$(du -sh "$DAILY_DIR" 2>/dev/null | cut -f1)
WEEKLY_SIZE=$(du -sh "$WEEKLY_DIR" 2>/dev/null | cut -f1)
MONTHLY_SIZE=$(du -sh "$MONTHLY_DIR" 2>/dev/null | cut -f1)
TOTAL_SIZE=$(du -sh "$BACKUP_BASE" 2>/dev/null | cut -f1)

log "Current backup sizes: Daily=$DAILY_SIZE, Weekly=$WEEKLY_SIZE, Monthly=$MONTHLY_SIZE, Total=$TOTAL_SIZE"

# Send to syslog for monitoring integration
logger -t titangold-backup "Rotation completed: $DAILY_DELETED daily, $WEEKLY_DELETED weekly, $MONTHLY_DELETED monthly deleted. Total: $TOTAL_SIZE"

log "=== Backup Rotation Completed Successfully ==="
exit 0
