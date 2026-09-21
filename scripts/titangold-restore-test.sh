#!/bin/bash
#
# TitanGold Backup Integrity Test (disk-safe)
# On constrained root volume: verify latest backup via SHA256 + streamed gpg|gunzip header.
# Full psql restore to titangold_restore_test_* only when free >= 40GB.
#
set -euo pipefail

ENV_FILE="/etc/titangold-backup.env"
LOG_FILE="/var/log/titangold-backup-rotation.log"
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
DB_HOST="localhost"
DB_PORT="5433"
PRODUCTION_DB="titangold_db"
FULL_RESTORE_MIN_FREE_GB=40

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RESTORE_TEST] $1" | tee -a "$LOG_FILE"; }

if [ ! -f "$ENV_FILE" ]; then
    log "ERROR: Environment file not found: $ENV_FILE"; exit 1
fi
set -a; source "$ENV_FILE"; set +a
GPG_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"

if [ "$EUID" -ne 0 ]; then
    log "ERROR: This script must be run as root (sudo)"; exit 1
fi

log "=== Starting Backup Integrity / Restore Test ==="
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TEMP_DB="titangold_restore_test_${TIMESTAMP}"
log "🔒 SAFETY: Production database ($PRODUCTION_DB) will NOT be touched"

LATEST_BACKUP=$(find "$DAILY_DIR" "$BACKUP_BASE/weekly" "$BACKUP_BASE/monthly" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
if [ -z "${LATEST_BACKUP:-}" ]; then
    log "🔴 ERROR: No backup files found!"
    /usr/local/bin/titangold-telegram-notify.sh error "*🔴 RESTORE TEST FAILED*%0A%0A❌ No backup files found under ${BACKUP_BASE}" || true
    exit 1
fi

BACKUP_NAME=$(basename "$LATEST_BACKUP")
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
log "📦 Testing backup: $BACKUP_NAME ($BACKUP_SIZE)"

CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    EXPECTED=$(tr -d ' \n' < "$CHECKSUM_FILE" | cut -c1-64)
    ACTUAL=$(sha256sum "$LATEST_BACKUP" | awk '{print $1}')
    if [ "$EXPECTED" != "$ACTUAL" ]; then
        log "🔴 ERROR: Checksum mismatch!"
        /usr/local/bin/titangold-telegram-notify.sh error "*🔴 RESTORE TEST FAILED*%0A%0A❌ Checksum mismatch%0ABackup: \`${BACKUP_NAME}\`" || true
        exit 1
    fi
    log "✅ Checksum verified: ${ACTUAL:0:16}..."
    CHECKSUM_RESULT="PASS"
else
    CHECKSUM_RESULT="NO_CHECKSUM"
    log "⚠️  No checksum file found"
fi

# Stream header verify (V2: gpg|gunzip, V1: gpg)
HEADER=""
if [[ "$BACKUP_NAME" == *.sql.gz.gpg ]]; then
    HEADER=$(gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback --decrypt \
        3<<<"${GPG_PASSPHRASE}" "$LATEST_BACKUP" 2>/dev/null | gzip -dc 2>/dev/null | head -c 2048 || true)
else
    HEADER=$(gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback --decrypt \
        3<<<"${GPG_PASSPHRASE}" "$LATEST_BACKUP" 2>/dev/null | head -c 2048 || true)
fi

if ! echo "$HEADER" | grep -qE 'PostgreSQL database dump|pg_dump'; then
    log "🔴 ERROR: Stream header verification failed"
    /usr/local/bin/titangold-telegram-notify.sh error "*🔴 RESTORE TEST FAILED*%0A%0A❌ Stream header verify failed%0ABackup: \`${BACKUP_NAME}\`" || true
    exit 1
fi
log "✅ Stream header verification passed"

avail_gb=$(df -BG / | awk 'NR==2{gsub(/G/,"",$4); print $4}')
if [[ "${avail_gb}" -lt "${FULL_RESTORE_MIN_FREE_GB}" ]]; then
    log "ℹ️  Skipping full psql restore (only ${avail_gb}GB free; need ${FULL_RESTORE_MIN_FREE_GB}GB)"
    /usr/local/bin/titangold-telegram-notify.sh success "*✅ Backup Integrity Test Passed*%0A%0A📁 \`${BACKUP_NAME}\`%0A📊 ${BACKUP_SIZE}%0A🔐 SHA256: ${CHECKSUM_RESULT}%0A🔓 Stream header: ✅%0A⚠️ Full DB restore skipped (disk ${avail_gb}GB < ${FULL_RESTORE_MIN_FREE_GB}GB)" || true
    log "=== Integrity test completed (stream-only) ==="
    exit 0
fi

# Full restore path (only when ample disk)
TEMP_SQL_FILE="/tmp/${TEMP_DB}.sql"
trap 'rm -f "$TEMP_SQL_FILE"; sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $TEMP_DB;" >/dev/null 2>&1 || true' EXIT

log "🔓 Decrypting for full restore (ample disk)..."
if [[ "$BACKUP_NAME" == *.sql.gz.gpg ]]; then
    gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback --decrypt \
        3<<<"${GPG_PASSPHRASE}" "$LATEST_BACKUP" 2>/dev/null | gzip -dc > "$TEMP_SQL_FILE"
else
    gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback --decrypt \
        3<<<"${GPG_PASSPHRASE}" --output "$TEMP_SQL_FILE" "$LATEST_BACKUP" 2>/dev/null
fi

sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $TEMP_DB;"
sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -f "$TEMP_SQL_FILE" >/dev/null
TABLE_COUNT=$(sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$TEMP_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $TEMP_DB;" >/dev/null
rm -f "$TEMP_SQL_FILE"
trap - EXIT

/usr/local/bin/titangold-telegram-notify.sh success "*✅ Full Restore Test Passed*%0A%0A📁 \`${BACKUP_NAME}\`%0A📊 Tables: ${TABLE_COUNT}%0A🗄 Temp DB dropped" || true
log "=== Full restore test completed ==="
exit 0
