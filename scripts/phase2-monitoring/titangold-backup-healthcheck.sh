#!/bin/bash
#
# TitanGold Backup Health Check
# Verifies backup integrity and freshness
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

log "=== Starting Backup Health Check ==="

# Check if daily backup directory exists
if [ ! -d "$DAILY_DIR" ]; then
    log "⚠️ ALERT: Daily backup directory not found: $DAILY_DIR"
    /usr/local/bin/titangold-telegram-notify.sh error "*Health Check FAILED*%0A%0A🔴 Daily backup directory not found: $DAILY_DIR" || true
    exit 1
fi

# Find latest daily backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    log "⚠️ ALERT: No daily backups found in $DAILY_DIR"
    /usr/local/bin/titangold-telegram-notify.sh error "*Health Check FAILED*%0A%0A🔴 No daily backups found in $DAILY_DIR" || true
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
BACKUP_AGE_SECONDS=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))
BACKUP_AGE_HOURS=$((BACKUP_AGE_SECONDS / 3600))

log "Latest backup: $BACKUP_NAME (Size: $BACKUP_SIZE, Age: ${BACKUP_AGE_HOURS}h)"

# Check backup age
if [ "$BACKUP_AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    log "⚠️ ALERT: Latest backup is too old: ${BACKUP_AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"
    MESSAGE="*Health Check FAILED*%0A%0A"
    MESSAGE="${MESSAGE}⚠️ Latest backup is too old%0A"
    MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
    MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE}%0A"
    MESSAGE="${MESSAGE}⏰ Age: ${BACKUP_AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"
    /usr/local/bin/titangold-telegram-notify.sh error "$MESSAGE" || true
    exit 1
fi

# Check backup size (should be > 10KB, adjust based on your DB size)
BACKUP_SIZE_BYTES=$(stat -c %s "$LATEST_BACKUP")
MIN_SIZE_BYTES=$((10 * 1024))  # 10 KB minimum

if [ "$BACKUP_SIZE_BYTES" -lt "$MIN_SIZE_BYTES" ]; then
    log "⚠️ ALERT: Latest backup is suspiciously small: $BACKUP_SIZE (${BACKUP_SIZE_BYTES} bytes)"
    MESSAGE="*Health Check FAILED*%0A%0A"
    MESSAGE="${MESSAGE}⚠️ Latest backup is too small%0A"
    MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
    MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE}%0A"
    MESSAGE="${MESSAGE}⚠️ Expected: > 10 KB"
    /usr/local/bin/titangold-telegram-notify.sh error "$MESSAGE" || true
    exit 1
fi

log "✅ Backup health check passed: $BACKUP_NAME (${BACKUP_AGE_HOURS}h old, $BACKUP_SIZE)"

# Verify SHA256 checksum if available
CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
SHA256_STATUS="N/A"
if [ -f "$CHECKSUM_FILE" ]; then
    log "Verifying SHA256 checksum..."
    STORED_CHECKSUM=$(cat "$CHECKSUM_FILE" | cut -d" " -f1)
    CURRENT_CHECKSUM=$(sha256sum "$LATEST_BACKUP" | cut -d' ' -f1)
    
    if [ "$STORED_CHECKSUM" = "$CURRENT_CHECKSUM" ]; then
        log "✅ SHA256 checksum verified: ${STORED_CHECKSUM:0:8}..."
        SHA256_STATUS="${STORED_CHECKSUM:0:8}... ✅"
    else
        log "⚠️ ALERT: SHA256 checksum mismatch!"
        MESSAGE="*Health Check WARNING*%0A%0A"
        MESSAGE="${MESSAGE}⚠️ SHA256 checksum mismatch%0A"
        MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
        MESSAGE="${MESSAGE}Expected: \`${STORED_CHECKSUM:0:16}...\`%0A"
        MESSAGE="${MESSAGE}Found: \`${CURRENT_CHECKSUM:0:16}...\`"
        /usr/local/bin/titangold-telegram-notify.sh error "$MESSAGE" || true
        exit 1
    fi
else
    log "⚠️ No SHA256 checksum found, will be generated on next rotation"
    SHA256_STATUS="Not found"
fi

logger -t titangold-backup "Health check passed: $BACKUP_NAME"

# Send success notification to Telegram
MESSAGE="*Health Check Passed* ✅%0A%0A"
MESSAGE="${MESSAGE}📁 Latest backup: \`${BACKUP_NAME}\`%0A"
MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE}%0A"
MESSAGE="${MESSAGE}⏰ Age: ${BACKUP_AGE_HOURS}h%0A"
MESSAGE="${MESSAGE}🔒 SHA256: ${SHA256_STATUS}"

/usr/local/bin/titangold-telegram-notify.sh success "$MESSAGE" "$LATEST_BACKUP" || true

log "=== Backup Health Check Completed ==="
exit 0
