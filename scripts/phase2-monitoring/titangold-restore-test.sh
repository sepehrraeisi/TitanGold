#!/bin/bash
#
# TitanGold Monthly Restore Test
# Tests backup restoration in an isolated temporary database
# 
# SAFETY RULE: NEVER touches production database!
# Restores only to: titangold_restore_test_YYYYMMDD_HHMMSS
#
# Usage: Run via cron on first Sunday of month at 6:00 AM
# 0 6 * * 0 [ $(date +\%d) -le 7 ] && /usr/local/bin/titangold-restore-test.sh
#

set -euo pipefail

# Configuration
ENV_FILE="/etc/titangold-backup.env"
LOG_FILE="/var/log/titangold-backup-rotation.log"
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"

# PostgreSQL connection details
DB_HOST="localhost"
DB_PORT="5433"
DB_USER="postgres"
PRODUCTION_DB="titangold_db"  # NEVER touch this database!

# GPG passphrase (empty for symmetric encryption with no password)
GPG_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE_TEST] $1" | tee -a "$LOG_FILE"
}

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    log "ERROR: Environment file not found: $ENV_FILE"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log "ERROR: This script must be run as root (sudo)"
    exit 1
fi

log "=== Starting Monthly Restore Test ==="

# Safety check: Ensure we never use production database name
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TEMP_DB="titangold_restore_test_${TIMESTAMP}"

log "🔒 SAFETY: Temporary database will be: $TEMP_DB"
log "🔒 SAFETY: Production database ($PRODUCTION_DB) will NOT be touched"

# Find latest backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    log "🔴 ERROR: No backup files found!"
    
    # Send urgent Telegram alert
    MESSAGE="*🔴 RESTORE TEST FAILED*%0A%0A"
    MESSAGE="${MESSAGE}❌ No backup files found in ${DAILY_DIR}%0A"
    MESSAGE="${MESSAGE}%0A"
    MESSAGE="${MESSAGE}*Action Required:* Check backup system immediately!"
    
    TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    curl -s -X POST "$TELEGRAM_API" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d parse_mode="Markdown" \
        -d text="$MESSAGE" > /dev/null
    
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
log "📦 Testing backup: $BACKUP_NAME ($BACKUP_SIZE)"

# Verify checksum if exists
CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    log "🔐 Verifying SHA256 checksum..."
    EXPECTED_CHECKSUM=$(cat "$CHECKSUM_FILE")
    ACTUAL_CHECKSUM=$(sha256sum "$LATEST_BACKUP" | cut -d' ' -f1)
    
    if [ "$EXPECTED_CHECKSUM" == "$ACTUAL_CHECKSUM" ]; then
        log "✅ Checksum verified: ${ACTUAL_CHECKSUM:0:16}..."
        CHECKSUM_RESULT="✅ PASS"
    else
        log "🔴 ERROR: Checksum mismatch!"
        log "Expected: $EXPECTED_CHECKSUM"
        log "Actual: $ACTUAL_CHECKSUM"
        
        # Send urgent alert
        MESSAGE="*🔴 RESTORE TEST FAILED*%0A%0A"
        MESSAGE="${MESSAGE}❌ Checksum verification failed%0A"
        MESSAGE="${MESSAGE}Backup: \`${BACKUP_NAME}\`%0A"
        MESSAGE="${MESSAGE}%0A"
        MESSAGE="${MESSAGE}*Action Required:* Backup file may be corrupted!"
        
        TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
        curl -s -X POST "$TELEGRAM_API" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d parse_mode="Markdown" \
            -d text="$MESSAGE" > /dev/null
        
        exit 1
    fi
else
    log "⚠️  No checksum file found"
    CHECKSUM_RESULT="⚠️  No checksum"
fi

# Decrypt backup to temporary file
TEMP_SQL_FILE="/tmp/${TEMP_DB}.sql"
log "🔓 Decrypting backup..."

if [ -z "$GPG_PASSPHRASE" ]; then
    # No passphrase (symmetric encryption with default settings)
    if ! gpg --batch --yes --decrypt --output "$TEMP_SQL_FILE" "$LATEST_BACKUP" 2>/dev/null; then
        log "🔴 ERROR: Failed to decrypt backup"
        
        MESSAGE="*🔴 RESTORE TEST FAILED*%0A%0A"
        MESSAGE="${MESSAGE}❌ Decryption failed%0A"
        MESSAGE="${MESSAGE}Backup: \`${BACKUP_NAME}\`%0A"
        
        TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
        curl -s -X POST "$TELEGRAM_API" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d parse_mode="Markdown" \
            -d text="$MESSAGE" > /dev/null
        
        exit 1
    fi
else
    if ! echo "$GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 --decrypt --output "$TEMP_SQL_FILE" "$LATEST_BACKUP" 2>/dev/null; then
        log "🔴 ERROR: Failed to decrypt backup"
        exit 1
    fi
fi

DECRYPTED_SIZE=$(du -h "$TEMP_SQL_FILE" | cut -f1)
log "✅ Decrypted successfully: $DECRYPTED_SIZE"

# Create temporary database
log "🗄️  Creating temporary database: $TEMP_DB"
if ! sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $TEMP_DB;" 2>&1 | tee -a "$LOG_FILE"; then
    log "🔴 ERROR: Failed to create temporary database"
    rm -f "$TEMP_SQL_FILE"
    exit 1
fi

# Restore backup to temporary database
log "📥 Restoring backup to temporary database..."
RESTORE_START=$(date +%s)

if ! sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -f "$TEMP_SQL_FILE" > /dev/null 2>&1; then
    log "🔴 ERROR: Failed to restore backup"
    
    # Cleanup
    sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $TEMP_DB;" > /dev/null 2>&1
    rm -f "$TEMP_SQL_FILE"
    
    MESSAGE="*🔴 RESTORE TEST FAILED*%0A%0A"
    MESSAGE="${MESSAGE}❌ Restore failed%0A"
    MESSAGE="${MESSAGE}Backup: \`${BACKUP_NAME}\`%0A"
    
    TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    curl -s -X POST "$TELEGRAM_API" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d parse_mode="Markdown" \
        -d text="$MESSAGE" > /dev/null
    
    exit 1
fi

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
log "✅ Restore completed in ${RESTORE_DURATION}s"

# Validate restored database
log "🔍 Validating restored database..."

# Test connection
if ! sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    log "🔴 ERROR: Cannot connect to restored database"
    sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $TEMP_DB;" > /dev/null 2>&1
    rm -f "$TEMP_SQL_FILE"
    exit 1
fi
log "✅ Database connection successful"

# Get table count
TABLE_COUNT=$(sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
log "📊 Table count: $TABLE_COUNT"

# Get total row count from key tables (if they exist)
TOTAL_ROWS=0
for table in users sessions agents conversations messages; do
    ROW_COUNT=$(sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs || echo "0")
    if [ "$ROW_COUNT" != "0" ]; then
        log "  ↳ $table: $ROW_COUNT rows"
        TOTAL_ROWS=$((TOTAL_ROWS + ROW_COUNT))
    fi
done

# Get database size
DB_SIZE=$(sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -t -c "SELECT pg_size_pretty(pg_database_size('$TEMP_DB'));" 2>/dev/null | xargs)
log "💾 Restored DB size: $DB_SIZE"

# Cleanup: Drop temporary database
log "🧹 Cleaning up: Dropping temporary database $TEMP_DB"
if ! sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE $TEMP_DB;" > /dev/null 2>&1; then
    log "⚠️  WARNING: Failed to drop temporary database (manual cleanup required)"
else
    log "✅ Temporary database dropped successfully"
fi

# Remove temporary SQL file
rm -f "$TEMP_SQL_FILE"
log "✅ Temporary files cleaned up"

# Final result
log "=== Restore Test Complete: SUCCESS ==="

# Send success report to Telegram
MESSAGE="*✅ Monthly Restore Test PASSED*%0A%0A"
MESSAGE="${MESSAGE}📦 *Backup:* \`${BACKUP_NAME}\`%0A"
MESSAGE="${MESSAGE}📊 *Size:* ${BACKUP_SIZE}%0A"
MESSAGE="${MESSAGE}%0A"
MESSAGE="${MESSAGE}*Validation Results:*%0A"
MESSAGE="${MESSAGE}${CHECKSUM_RESULT}%0A"
MESSAGE="${MESSAGE}✅ Decryption: ${DECRYPTED_SIZE}%0A"
MESSAGE="${MESSAGE}✅ Restore: ${RESTORE_DURATION}s%0A"
MESSAGE="${MESSAGE}✅ Connection: OK%0A"
MESSAGE="${MESSAGE}✅ Tables: ${TABLE_COUNT}%0A"
MESSAGE="${MESSAGE}✅ Total rows: ${TOTAL_ROWS}%0A"
MESSAGE="${MESSAGE}✅ DB Size: ${DB_SIZE}%0A"
MESSAGE="${MESSAGE}✅ Cleanup: Complete%0A"
MESSAGE="${MESSAGE}%0A"
MESSAGE="${MESSAGE}_🔒 Production DB ($PRODUCTION_DB) was not touched_"

TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
curl -s -X POST "$TELEGRAM_API" \
    -d chat_id="$TELEGRAM_CHAT_ID" \
    -d parse_mode="Markdown" \
    -d text="$MESSAGE" > /dev/null

log "✅ Success report sent to Telegram"
