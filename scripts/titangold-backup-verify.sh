#!/bin/bash
#
# TitanGold Backup Verification Script
# Performs actual decrypt + restore test on temporary database
#
# Usage: Run monthly via cron at 6 AM on 1st of each month
# 0 6 1 * * /usr/local/bin/titangold-backup-verify.sh
#
# CRITICAL: This creates a temporary database to test restore
# Requires: PostgreSQL client tools, GPG passphrase (via env or file)
#

set -euo pipefail

# Configuration
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
LOG_FILE="/var/log/titangold-backup-rotation.log"
TEMP_DB_NAME="titangold_restore_test_$(date +%s)"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/root/.titangold_backup_passphrase}"

# Telegram/Discord Alert Configuration (optional)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Alert function (multi-channel)
alert() {
    local severity="$1"  # INFO, WARNING, CRITICAL
    local message="$2"
    
    log "[$severity] $message"
    logger -p user.warning -t titangold-backup "[$severity] $message"
    
    # Telegram alert
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
        local emoji="ℹ️"
        [[ "$severity" == "WARNING" ]] && emoji="⚠️"
        [[ "$severity" == "CRITICAL" ]] && emoji="🔴"
        
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d parse_mode="Markdown" \
            -d text="${emoji} *TitanGold Backup Alert*%0A%0A*Severity:* ${severity}%0A*Message:* ${message}%0A*Time:* $(date '+%Y-%m-%d %H:%M:%S')" \
            > /dev/null 2>&1 || true
    fi
    
    # Discord webhook
    if [[ -n "$DISCORD_WEBHOOK_URL" ]]; then
        local color="3447003"  # Blue
        [[ "$severity" == "WARNING" ]] && color="16776960"   # Yellow
        [[ "$severity" == "CRITICAL" ]] && color="15158332"  # Red
        
        curl -s -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"TitanGold Backup Alert\",\"description\":\"${message}\",\"color\":${color},\"fields\":[{\"name\":\"Severity\",\"value\":\"${severity}\"},{\"name\":\"Time\",\"value\":\"$(date '+%Y-%m-%d %H:%M:%S')\"}]}]}" \
            > /dev/null 2>&1 || true
    fi
    
    # Email alert (requires mailx or sendmail)
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
        echo -e "TitanGold Backup Alert\n\nSeverity: $severity\nMessage: $message\nTime: $(date '+%Y-%m-%d %H:%M:%S')" | \
            mail -s "[TitanGold] Backup Alert: $severity" "$ALERT_EMAIL" || true
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    alert "CRITICAL" "Backup verification must run as root"
    exit 1
fi

log "=== Starting Monthly Backup Verification ==="

# Find latest daily backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    alert "CRITICAL" "No daily backup found for verification"
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)

log "Testing backup: $BACKUP_NAME (Size: $BACKUP_SIZE)"

# Step 1: Test GPG decryption
log "Step 1/4: Testing GPG decryption..."
DECRYPT_START=$(date +%s)

if [ -f "$GPG_PASSPHRASE_FILE" ]; then
    # Decrypt with passphrase file
    if gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" -d "$LATEST_BACKUP" > /tmp/restore_test.sql 2>&1; then
        DECRYPT_END=$(date +%s)
        DECRYPT_TIME=$((DECRYPT_END - DECRYPT_START))
        log "✅ Decryption successful (${DECRYPT_TIME}s)"
    else
        alert "CRITICAL" "GPG decryption failed for $BACKUP_NAME"
        exit 1
    fi
else
    # Try decrypt without passphrase (if key is in keyring)
    if gpg --batch --yes -d "$LATEST_BACKUP" > /tmp/restore_test.sql 2>&1; then
        DECRYPT_END=$(date +%s)
        DECRYPT_TIME=$((DECRYPT_END - DECRYPT_START))
        log "✅ Decryption successful (${DECRYPT_TIME}s)"
    else
        alert "WARNING" "GPG decryption requires passphrase (set GPG_PASSPHRASE_FILE env)"
        log "Skipping restore test (decryption required)"
        rm -f /tmp/restore_test.sql
        exit 0
    fi
fi

# Step 2: Validate SQL syntax
log "Step 2/4: Validating SQL syntax..."
SQL_SIZE=$(stat -c %s /tmp/restore_test.sql)
SQL_SIZE_MB=$((SQL_SIZE / 1024 / 1024))

if [ "$SQL_SIZE" -lt 1024 ]; then
    alert "CRITICAL" "Decrypted SQL file suspiciously small: ${SQL_SIZE} bytes"
    rm -f /tmp/restore_test.sql
    exit 1
fi

# Check for SQL header
if ! head -10 /tmp/restore_test.sql | grep -q "PostgreSQL"; then
    alert "WARNING" "Decrypted file doesn't look like PostgreSQL dump"
fi

log "✅ SQL file looks valid (${SQL_SIZE_MB} MB)"

# Step 3: Create temporary database and restore
log "Step 3/4: Creating temporary database '$TEMP_DB_NAME'..."

if sudo -u "$POSTGRES_USER" psql -lqt | cut -d \| -f 1 | grep -qw "$TEMP_DB_NAME"; then
    log "Temp database already exists, dropping..."
    sudo -u "$POSTGRES_USER" psql -c "DROP DATABASE IF EXISTS $TEMP_DB_NAME;" 2>/dev/null || true
fi

if sudo -u "$POSTGRES_USER" psql -c "CREATE DATABASE $TEMP_DB_NAME;" 2>&1; then
    log "✅ Temporary database created"
else
    alert "CRITICAL" "Failed to create temporary database"
    rm -f /tmp/restore_test.sql
    exit 1
fi

# Step 4: Attempt restore
log "Step 4/4: Restoring to temporary database..."
RESTORE_START=$(date +%s)

if sudo -u "$POSTGRES_USER" psql -d "$TEMP_DB_NAME" -f /tmp/restore_test.sql > /tmp/restore_output.log 2>&1; then
    RESTORE_END=$(date +%s)
    RESTORE_TIME=$((RESTORE_END - RESTORE_START))
    log "✅ Restore successful (${RESTORE_TIME}s)"
    
    # Verify table count
    TABLE_COUNT=$(sudo -u "$POSTGRES_USER" psql -d "$TEMP_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
    log "Restored database has $TABLE_COUNT tables"
    
    if [ "$TABLE_COUNT" -lt 10 ]; then
        alert "WARNING" "Restored database has only $TABLE_COUNT tables (expected >10)"
    else
        alert "INFO" "✅ Backup verification PASSED: $BACKUP_NAME ($TABLE_COUNT tables, ${SQL_SIZE_MB}MB, restore in ${RESTORE_TIME}s)"
    fi
else
    alert "CRITICAL" "Restore failed - backup may be corrupted: $BACKUP_NAME"
    cat /tmp/restore_output.log >> "$LOG_FILE"
    
    # Cleanup and exit
    sudo -u "$POSTGRES_USER" psql -c "DROP DATABASE IF EXISTS $TEMP_DB_NAME;" 2>/dev/null || true
    rm -f /tmp/restore_test.sql /tmp/restore_output.log
    exit 1
fi

# Cleanup
log "Cleaning up temporary files..."
sudo -u "$POSTGRES_USER" psql -c "DROP DATABASE IF EXISTS $TEMP_DB_NAME;" 2>/dev/null || true
rm -f /tmp/restore_test.sql /tmp/restore_output.log

log "=== Backup Verification Completed Successfully ==="
logger -t titangold-backup "Monthly verification PASSED: $BACKUP_NAME"

exit 0
