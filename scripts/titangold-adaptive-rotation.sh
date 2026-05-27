#!/bin/bash
#
# TitanGold Adaptive Backup Retention
# Dynamically adjusts retention policy based on database size
#
# Logic:
# - Small DB (<5GB):   Keep 7 daily, 4 weekly, 3 monthly
# - Medium DB (5-20GB): Keep 5 daily, 3 weekly, 3 monthly  
# - Large DB (>20GB):   Keep 3 daily, 2 weekly, 3 monthly
#
# This ensures backup storage scales proportionally with DB growth
#

set -euo pipefail

# Configuration
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
WEEKLY_DIR="${BACKUP_BASE}/weekly"
MONTHLY_DIR="${BACKUP_BASE}/monthly"
LOG_FILE="/var/log/titangold-backup-rotation.log"

# Database size thresholds (GB)
SMALL_DB_THRESHOLD=5
MEDIUM_DB_THRESHOLD=20

# Retention policies
SMALL_DAILY=7
SMALL_WEEKLY=4
SMALL_MONTHLY=3

MEDIUM_DAILY=5
MEDIUM_WEEKLY=3
MEDIUM_MONTHLY=3

LARGE_DAILY=3
LARGE_WEEKLY=2
LARGE_MONTHLY=3

# Alert Configuration
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# ============================================================

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Alert function
alert() {
    local severity="$1"
    local message="$2"
    
    log "[$severity] $message"
    logger -t titangold-backup "[$severity] $message"
    
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
        local emoji="ℹ️"
        [[ "$severity" == "WARNING" ]] && emoji="⚠️"
        [[ "$severity" == "CRITICAL" ]] && emoji="🔴"
        
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d parse_mode="Markdown" \
            -d text="${emoji} *TitanGold Backup*%0A%0A*Severity:* ${severity}%0A*Message:* ${message}" \
            > /dev/null 2>&1 || true
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    alert "CRITICAL" "Adaptive rotation must run as root"
    exit 1
fi

log "=== Starting Adaptive Backup Rotation ==="

# ============================================================
# Step 1: Detect database size
# ============================================================

# Try to get actual DB size from PostgreSQL
if command -v psql &> /dev/null; then
    DB_SIZE_BYTES=$(sudo -u postgres psql -t -c "SELECT pg_database_size('titangold');" 2>/dev/null | xargs || echo "0")
    DB_SIZE_GB=$((DB_SIZE_BYTES / 1024 / 1024 / 1024))
    log "PostgreSQL database size: ${DB_SIZE_GB} GB"
else
    # Fallback: estimate from latest backup size
    LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    if [[ -n "$LATEST_BACKUP" ]]; then
        BACKUP_SIZE_BYTES=$(stat -c %s "$LATEST_BACKUP" 2>/dev/null || echo "0")
        # Compressed backup is typically 20-30% of original, estimate 4x
        DB_SIZE_GB=$((BACKUP_SIZE_BYTES * 4 / 1024 / 1024 / 1024))
        log "Estimated database size from backup: ${DB_SIZE_GB} GB (4x compressed size)"
    else
        log "WARNING: Cannot determine database size, using default 7-4-3 policy"
        DB_SIZE_GB=1
    fi
fi

# ============================================================
# Step 2: Select retention policy based on size
# ============================================================

if [ "$DB_SIZE_GB" -lt "$SMALL_DB_THRESHOLD" ]; then
    POLICY="SMALL"
    DAILY_RETENTION=$SMALL_DAILY
    WEEKLY_RETENTION=$SMALL_WEEKLY
    MONTHLY_RETENTION=$SMALL_MONTHLY
    log "📊 Database category: SMALL (<${SMALL_DB_THRESHOLD}GB) → Retention: ${DAILY_RETENTION}d / ${WEEKLY_RETENTION}w / ${MONTHLY_RETENTION}m"
elif [ "$DB_SIZE_GB" -lt "$MEDIUM_DB_THRESHOLD" ]; then
    POLICY="MEDIUM"
    DAILY_RETENTION=$MEDIUM_DAILY
    WEEKLY_RETENTION=$MEDIUM_WEEKLY
    MONTHLY_RETENTION=$MEDIUM_MONTHLY
    log "📊 Database category: MEDIUM (${SMALL_DB_THRESHOLD}-${MEDIUM_DB_THRESHOLD}GB) → Retention: ${DAILY_RETENTION}d / ${WEEKLY_RETENTION}w / ${MONTHLY_RETENTION}m"
else
    POLICY="LARGE"
    DAILY_RETENTION=$LARGE_DAILY
    WEEKLY_RETENTION=$LARGE_WEEKLY
    MONTHLY_RETENTION=$LARGE_MONTHLY
    log "📊 Database category: LARGE (>${MEDIUM_DB_THRESHOLD}GB) → Retention: ${DAILY_RETENTION}d / ${WEEKLY_RETENTION}w / ${MONTHLY_RETENTION}m"
fi

# ============================================================
# Step 3: Apply retention policy
# ============================================================

# Count before
DAILY_BEFORE=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)
WEEKLY_BEFORE=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)
MONTHLY_BEFORE=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)

log "Before rotation: Daily=$DAILY_BEFORE, Weekly=$WEEKLY_BEFORE, Monthly=$MONTHLY_BEFORE"

# Rotate daily backups
DAILY_DAYS=$((DAILY_RETENTION))
log "Rotating daily backups (keeping last $DAILY_DAYS days)..."
find "$DAILY_DIR" -type f -name "*.sql.gpg" -mtime +$DAILY_DAYS -delete 2>/dev/null || true

# Rotate weekly backups
WEEKLY_DAYS=$((WEEKLY_RETENTION * 7))
log "Rotating weekly backups (keeping last $WEEKLY_DAYS days)..."
find "$WEEKLY_DIR" -type f -name "*.sql.gpg" -mtime +$WEEKLY_DAYS -delete 2>/dev/null || true

# Rotate monthly backups
MONTHLY_DAYS=$((MONTHLY_RETENTION * 30))
log "Rotating monthly backups (keeping last $MONTHLY_DAYS days)..."
find "$MONTHLY_DIR" -type f -name "*.sql.gpg" -mtime +$MONTHLY_DAYS -delete 2>/dev/null || true

# Count after
DAILY_AFTER=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)
WEEKLY_AFTER=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)
MONTHLY_AFTER=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)

DAILY_DELETED=$((DAILY_BEFORE - DAILY_AFTER))
WEEKLY_DELETED=$((WEEKLY_BEFORE - WEEKLY_AFTER))
MONTHLY_DELETED=$((MONTHLY_BEFORE - MONTHLY_AFTER))

log "After rotation: Daily=$DAILY_AFTER, Weekly=$WEEKLY_AFTER, Monthly=$MONTHLY_AFTER"
log "Deleted: Daily=$DAILY_DELETED, Weekly=$WEEKLY_DELETED, Monthly=$MONTHLY_DELETED"

# ============================================================
# Step 4: Calculate storage usage
# ============================================================

DAILY_SIZE=$(du -sh "$DAILY_DIR" 2>/dev/null | cut -f1)
WEEKLY_SIZE=$(du -sh "$WEEKLY_DIR" 2>/dev/null | cut -f1)
MONTHLY_SIZE=$(du -sh "$MONTHLY_DIR" 2>/dev/null | cut -f1)
TOTAL_SIZE=$(du -sh "$BACKUP_BASE" 2>/dev/null | cut -f1)

log "Current backup sizes: Daily=$DAILY_SIZE, Weekly=$WEEKLY_SIZE, Monthly=$MONTHLY_SIZE, Total=$TOTAL_SIZE"

# ============================================================
# Step 5: Storage warning if backup size > 30% of DB size
# ============================================================

TOTAL_SIZE_GB=$(du -sb "$BACKUP_BASE" 2>/dev/null | cut -f1 | awk '{print int($1/1024/1024/1024)}')
BACKUP_RATIO=$((TOTAL_SIZE_GB * 100 / (DB_SIZE_GB + 1)))  # +1 to avoid division by zero

if [ "$BACKUP_RATIO" -gt 30 ]; then
    alert "WARNING" "Backup storage (${TOTAL_SIZE_GB}GB) is ${BACKUP_RATIO}% of database size (${DB_SIZE_GB}GB) - consider offsite archival"
fi

# ============================================================
# Step 6: Policy change notification
# ============================================================

LAST_POLICY_FILE="/var/lib/titangold-backup-policy"
LAST_POLICY=$(cat "$LAST_POLICY_FILE" 2>/dev/null || echo "UNKNOWN")

if [[ "$LAST_POLICY" != "$POLICY" ]]; then
    alert "INFO" "🔄 Backup policy changed: $LAST_POLICY → $POLICY (DB size: ${DB_SIZE_GB}GB, Retention: ${DAILY_RETENTION}d/${WEEKLY_RETENTION}w/${MONTHLY_RETENTION}m)"
    echo "$POLICY" > "$LAST_POLICY_FILE"
fi

# Send to syslog
logger -t titangold-backup "Rotation completed: Policy=$POLICY, DB=${DB_SIZE_GB}GB, Deleted=$DAILY_DELETED daily/$WEEKLY_DELETED weekly/$MONTHLY_DELETED monthly, Total storage=$TOTAL_SIZE"

log "=== Adaptive Backup Rotation Completed Successfully ==="
exit 0
