#!/bin/bash
#
# TitanGold Monthly Backup Creator
# Creates monthly backup from latest weekly backup
#
# Usage: Run via cron on 1st of each month at 4 AM
# 0 4 1 * * /usr/local/bin/titangold-monthly-backup.sh
#

set -euo pipefail

# Configuration
WEEKLY_DIR="/var/backups/titangold/weekly"
MONTHLY_DIR="/var/backups/titangold/monthly"
LOG_FILE="/var/log/titangold-backup-rotation.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log "ERROR: This script must be run as root (sudo)"
    exit 1
fi

log "=== Starting Monthly Backup Creation ==="

# Find latest weekly backup
LATEST_WEEKLY=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_WEEKLY" ]; then
    log "ERROR: No weekly backup found in $WEEKLY_DIR"
    exit 1
fi

log "Found latest weekly backup: $(basename "$LATEST_WEEKLY")"

# Create monthly backup filename (first day of current month)
MONTHLY_FILENAME="titangold_monthly_$(date +%Y-%m-01).sql.gpg"
MONTHLY_PATH="$MONTHLY_DIR/$MONTHLY_FILENAME"

# Create monthly directory if not exists
mkdir -p "$MONTHLY_DIR"

# Copy weekly to monthly
if [ -f "$MONTHLY_PATH" ]; then
    log "WARNING: Monthly backup already exists: $MONTHLY_FILENAME (skipping)"
else
    cp "$LATEST_WEEKLY" "$MONTHLY_PATH"
    log "✅ Monthly backup created: $MONTHLY_FILENAME ($(du -h "$MONTHLY_PATH" | cut -f1))"
    
    # Send to syslog
    logger -t titangold-backup "Monthly backup created: $MONTHLY_FILENAME"
fi

log "=== Monthly Backup Creation Completed ==="
exit 0
