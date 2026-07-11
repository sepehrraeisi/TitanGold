#!/bin/bash
#
# TitanGold Backup Health Check
# Verifies backup integrity, freshness, size history, SHA256, and GPG decrypt
#

set -euo pipefail

# Configuration
ENV_FILE="/etc/titangold-backup-postgres.env"
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
LOG_FILE="/var/log/titangold-backup-rotation.log"
MAX_AGE_HOURS=48
MEDIAN_SAMPLE_SIZE=5
SIZE_WARNING_RATIO=70
SIZE_CRITICAL_RATIO=50

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_health_failure() {
    local message="$1"
    /usr/local/bin/titangold-telegram-notify.sh error "$message" || true
}

# Load encryption key for decrypt verification (never log secrets)
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck source=/etc/titangold-backup-postgres.env
    source "$ENV_FILE"
    set +a
fi

log "=== Starting Backup Health Check ==="

if [ ! -d "$DAILY_DIR" ]; then
    log "⚠️ ALERT: Daily backup directory not found: $DAILY_DIR"
    send_health_failure "*Health Check FAILED*%0A%0A🔴 Daily backup directory not found: $DAILY_DIR"
    exit 1
fi

LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    log "⚠️ ALERT: No daily backups found in $DAILY_DIR"
    send_health_failure "*Health Check FAILED*%0A%0A🔴 No daily backups found in $DAILY_DIR"
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
BACKUP_SIZE_BYTES=$(stat -c %s "$LATEST_BACKUP")
BACKUP_AGE_SECONDS=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))
BACKUP_AGE_HOURS=$((BACKUP_AGE_SECONDS / 3600))

log "Latest backup: $BACKUP_NAME (Size: $BACKUP_SIZE, Age: ${BACKUP_AGE_HOURS}h)"

if [ "$BACKUP_AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    log "⚠️ ALERT: Latest backup is too old: ${BACKUP_AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"
    MESSAGE="*Health Check FAILED*%0A%0A"
    MESSAGE="${MESSAGE}⚠️ Latest backup is too old%0A"
    MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
    MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE}%0A"
    MESSAGE="${MESSAGE}⏰ Age: ${BACKUP_AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"
    send_health_failure "$MESSAGE"
    exit 1
fi

# Compare latest size against median of recent backups
mapfile -t RECENT_BACKUPS < <(
    find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -n "$MEDIAN_SAMPLE_SIZE" | cut -d' ' -f2-
)

if [ "${#RECENT_BACKUPS[@]}" -ge 2 ]; then
    sizes=()
    for backup_path in "${RECENT_BACKUPS[@]}"; do
        sizes+=("$(stat -c %s "$backup_path")")
    done
    IFS=$'\n' sorted_sizes=($(printf '%s\n' "${sizes[@]}" | sort -n))
    unset IFS
    count="${#sorted_sizes[@]}"
    median_index=$((count / 2))
    median_size="${sorted_sizes[$median_index]}"
    ratio=$((BACKUP_SIZE_BYTES * 100 / median_size))

    log "Size check: latest=${BACKUP_SIZE_BYTES} bytes, median(${count})=${median_size} bytes, ratio=${ratio}%"

    if [ "$ratio" -lt "$SIZE_CRITICAL_RATIO" ]; then
        log "⚠️ ALERT: Latest backup is critically small (${ratio}% of median ${median_size} bytes)"
        MESSAGE="*Health Check FAILED*%0A%0A"
        MESSAGE="${MESSAGE}🔴 Backup size critically below median%0A"
        MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
        MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE} (${ratio}% of median)%0A"
        MESSAGE="${MESSAGE}⚠️ Threshold: ${SIZE_CRITICAL_RATIO}%"
        send_health_failure "$MESSAGE"
        exit 1
    elif [ "$ratio" -lt "$SIZE_WARNING_RATIO" ]; then
        log "⚠️ WARNING: Latest backup is smaller than expected (${ratio}% of median)"
        MESSAGE="*Health Check WARNING*%0A%0A"
        MESSAGE="${MESSAGE}⚠️ Backup size below median%0A"
        MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
        MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE} (${ratio}% of median)%0A"
        MESSAGE="${MESSAGE}⚠️ Threshold: ${SIZE_WARNING_RATIO}%"
        send_health_failure "$MESSAGE"
        exit 1
    fi
else
    log "Size history check skipped: fewer than 2 backups available"
fi

CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
SHA256_STATUS="N/A"
if [ -f "$CHECKSUM_FILE" ]; then
    log "Verifying SHA256 checksum..."
    STORED_CHECKSUM=$(awk '{print $1}' "$CHECKSUM_FILE")
    CURRENT_CHECKSUM=$(sha256sum "$LATEST_BACKUP" | awk '{print $1}')

    if [ "$STORED_CHECKSUM" = "$CURRENT_CHECKSUM" ]; then
        log "✅ SHA256 checksum verified: ${STORED_CHECKSUM:0:8}..."
        SHA256_STATUS="${STORED_CHECKSUM:0:8}... ✅"
    else
        log "⚠️ ALERT: SHA256 checksum mismatch!"
        MESSAGE="*Health Check FAILED*%0A%0A"
        MESSAGE="${MESSAGE}🔴 SHA256 checksum mismatch%0A"
        MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
        MESSAGE="${MESSAGE}Expected: \`${STORED_CHECKSUM:0:16}...\`%0A"
        MESSAGE="${MESSAGE}Found: \`${CURRENT_CHECKSUM:0:16}...\`"
        send_health_failure "$MESSAGE"
        exit 1
    fi
else
    log "⚠️ ALERT: No SHA256 checksum file for latest backup"
    send_health_failure "*Health Check FAILED*%0A%0A🔴 Missing SHA256 checksum for \`${BACKUP_NAME}\`"
    exit 1
fi

# GPG decrypt test (stdout discarded; never restore to database)
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    log "⚠️ ALERT: BACKUP_ENCRYPTION_KEY not configured; cannot verify decrypt"
    send_health_failure "*Health Check FAILED*%0A%0A🔴 Encryption key unavailable for decrypt test"
    exit 1
fi

log "Running GPG decrypt verification..."
export GNUPGHOME=$(mktemp -d)
decrypt_err=$(mktemp)
if ! echo "${BACKUP_ENCRYPTION_KEY}" | gpg --batch --yes --passphrase-fd 0 \
    --pinentry-mode loopback --quiet --decrypt "$LATEST_BACKUP" >/dev/null 2>"$decrypt_err"; then
    log "⚠️ ALERT: GPG decrypt test failed for $BACKUP_NAME"
    err_line=$(head -1 "$decrypt_err" || echo "unknown error")
    MESSAGE="*Health Check FAILED*%0A%0A"
    MESSAGE="${MESSAGE}🔴 GPG decrypt test failed%0A"
    MESSAGE="${MESSAGE}📁 File: \`${BACKUP_NAME}\`%0A"
    MESSAGE="${MESSAGE}Error: ${err_line}"
    rm -f "$decrypt_err"
    rm -rf "$GNUPGHOME"
    send_health_failure "$MESSAGE"
    exit 1
fi
rm -f "$decrypt_err"
rm -rf "$GNUPGHOME"
log "✅ GPG decrypt verification passed"

log "✅ Backup health check passed: $BACKUP_NAME (${BACKUP_AGE_HOURS}h old, $BACKUP_SIZE)"

logger -t titangold-backup "Health check passed: $BACKUP_NAME"

MESSAGE="*Health Check Passed* ✅%0A%0A"
MESSAGE="${MESSAGE}📁 Latest backup: \`${BACKUP_NAME}\`%0A"
MESSAGE="${MESSAGE}📊 Size: ${BACKUP_SIZE}%0A"
MESSAGE="${MESSAGE}⏰ Age: ${BACKUP_AGE_HOURS}h%0A"
MESSAGE="${MESSAGE}🔒 SHA256: ${SHA256_STATUS}%0A"
MESSAGE="${MESSAGE}🔓 GPG decrypt: ✅ verified"

/usr/local/bin/titangold-telegram-notify.sh success "$MESSAGE" "$LATEST_BACKUP" || true

log "=== Backup Health Check Completed ==="
exit 0
