#!/bin/bash
#
# TitanGold Telegram Notification Helper
# Sends Telegram messages with backup status and secure download links
#
# Credentials Source of Truth (2026-08-26):
#   DataHub telegram_publishers via titangold-telegram-resolve-creds.sh
#   Fallback: /etc/titangold-telegram-runtime.env then /etc/titangold-backup.env
#
# Usage: titangold-telegram-notify.sh <type> <message> [backup_file]
#   type: success, error, warning, info, report, plain
#   message: notification text
#   backup_file: optional path to backup file for creating download link
#
# Disk safety (2026-07-15):
#   Single-slot temp downloads — never keep more than one file in
#   /var/www/titangold-temp-backups (prevents ~6GB daily growth).
#

set -euo pipefail

# Configuration
ENV_FILE="/etc/titangold-backup.env"
RUNTIME_ENV="/etc/titangold-telegram-runtime.env"
RESOLVE_CREDS="/usr/local/bin/titangold-telegram-resolve-creds.sh"
LOG_FILE="/var/log/titangold-backup-rotation.log"
TEMP_DOWNLOAD_DIR="/var/www/titangold-temp-backups"
# Refuse to create download copy if free disk would fall near circuit-breaker floor
MIN_FREE_AFTER_COPY_GB=28

# Logging function
log() {
    local line="[$(date '+%Y-%m-%d %H:%M:%S')] [TELEGRAM] $1"
    if [ -w "$LOG_FILE" ] || [ -w "$(dirname "$LOG_FILE")" ]; then
        echo "$line" | tee -a "$LOG_FILE" >/dev/null
        echo "$line"
    else
        echo "$line"
    fi
}

# Non-secret backup settings (URL, TTL, etc.) — may be root-only (600)
if [ -f "$ENV_FILE" ] && [ -r "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

load_telegram_creds() {
    # Clear possibly-stale tokens from backup.env before publisher resolve
    unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID TELEGRAM_PUBLISHER_ID TELEGRAM_PUBLISHER_NAME || true

    if [ -x "$RESOLVE_CREDS" ]; then
        # Do not log resolver stdout (contains token)
        set +e
        CREDS_OUT=$("$RESOLVE_CREDS" 2>/tmp/titangold-telegram-resolve.err)
        RC=$?
        set -e
        if [ "$RC" -eq 0 ] && [ -n "${CREDS_OUT:-}" ]; then
            eval "$CREDS_OUT"
            if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
                log "Credentials loaded from Telegram Publisher (${TELEGRAM_PUBLISHER_ID:-unknown})"
                return 0
            fi
        fi
        if [ -s /tmp/titangold-telegram-resolve.err ]; then
            log "WARNING: publisher resolve failed — $(head -c 200 /tmp/titangold-telegram-resolve.err | tr '\n' ' ')"
        fi
        rm -f /tmp/titangold-telegram-resolve.err
    fi

    if [ -f "$RUNTIME_ENV" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$RUNTIME_ENV"
        set +a
        if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
            log "Credentials loaded from runtime cache"
            return 0
        fi
    fi

    # Last resort: re-read legacy tokens from backup.env (if readable)
    if [ -f "$ENV_FILE" ] && [ -r "$ENV_FILE" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        set +a
        if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
            log "WARNING: using legacy /etc/titangold-backup.env Telegram credentials"
            return 0
        fi
    fi

    log "ERROR: Telegram credentials unavailable (publisher + cache + backup.env)"
    return 1
}

if ! load_telegram_creds; then
    exit 1
fi

NOTIFICATION_TYPE="${1:-info}"
MESSAGE="${2:-No message provided}"
BACKUP_FILE="${3:-}"

PARSE_MODE="Markdown"
case "$NOTIFICATION_TYPE" in
    success) EMOJI="✅" ;;
    error)   EMOJI="🔴" ;;
    warning) EMOJI="⚠️" ;;
    info)    EMOJI="ℹ️" ;;
    report|plain)
        EMOJI=""
        PARSE_MODE=""
        ;;
    *)       EMOJI="📋" ;;
esac

if [ "$NOTIFICATION_TYPE" = "report" ] || [ "$NOTIFICATION_TYPE" = "plain" ]; then
    TELEGRAM_MESSAGE="${MESSAGE}"
else
    TELEGRAM_MESSAGE="${EMOJI} *TitanGold Backup*%0A%0A${MESSAGE}"
fi

# If backup file provided, create secure download link (single slot)
if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    FILENAME=$(basename "$BACKUP_FILE")
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
    NEED_BYTES=$(stat -c %s "$BACKUP_FILE")

    mkdir -p "$TEMP_DOWNLOAD_DIR"

    # Single-slot: wipe previous download copies first to reclaim space
    OLD_COUNT=$(find "$TEMP_DOWNLOAD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "${OLD_COUNT:-0}" -gt 0 ]; then
        log "Single-slot cleanup: removing ${OLD_COUNT} previous temp download file(s)"
        find "$TEMP_DOWNLOAD_DIR" -type f -delete
    fi

    AVAIL_KB=$(df -k / | awk 'NR==2 {print $4}')
    AVAIL_AFTER_KB=$((AVAIL_KB - NEED_BYTES / 1024))
    AVAIL_AFTER_GB=$((AVAIL_AFTER_KB / 1024 / 1024))

    if [ "$AVAIL_AFTER_GB" -lt "$MIN_FREE_AFTER_COPY_GB" ]; then
        log "WARNING: Skipping download link copy — free after copy would be ~${AVAIL_AFTER_GB}GB (min ${MIN_FREE_AFTER_COPY_GB}GB)"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}📁 *File:* \`${FILENAME}\`%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}📊 *Size:* ${FILESIZE}%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}🕐 *Time:* ${TIMESTAMP}%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}💾 *Disk Usage:* ${DISK_USAGE}%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A"
        TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}⚠️ _Download link skipped to protect disk space_"
    else
        RANDOM_TOKEN=$(openssl rand -hex 16)
        TEMP_FILENAME="${RANDOM_TOKEN}_${FILENAME}"
        TEMP_FILEPATH="${TEMP_DOWNLOAD_DIR}/${TEMP_FILENAME}"

        log "Creating temporary download link for: $FILENAME (single-slot)"
        if cp "$BACKUP_FILE" "$TEMP_FILEPATH"; then
            chmod 644 "$TEMP_FILEPATH"
            chown www-data:www-data "$TEMP_FILEPATH" 2>/dev/null || true

            DOWNLOAD_URL="${BACKUP_BASE_URL}/temp-backups/${TEMP_FILENAME}"

            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}📁 *File:* \`${FILENAME}\`%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}📊 *Size:* ${FILESIZE}%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}🕐 *Time:* ${TIMESTAMP}%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}💾 *Disk Usage:* ${DISK_USAGE}%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}🔗 *Download Link:*%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}\`${DOWNLOAD_URL}\`%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}⏰ _Link expires in ${BACKUP_LINK_TTL_HOURS:-24} hours_"

            log "Download link created: $DOWNLOAD_URL"
        else
            log "ERROR: Failed to create temporary download link"
            TELEGRAM_MESSAGE="${TELEGRAM_MESSAGE}%0A%0A⚠️ _Download link creation failed_"
        fi
    fi
fi

log "Sending Telegram notification..."

TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

if [ -n "$PARSE_MODE" ]; then
    RESPONSE=$(curl -s -X POST "$TELEGRAM_API" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d parse_mode="$PARSE_MODE" \
        -d text="$TELEGRAM_MESSAGE" \
        2>&1)
else
    RESPONSE=$(curl -s -X POST "$TELEGRAM_API" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="$TELEGRAM_MESSAGE" \
        2>&1)
fi

if echo "$RESPONSE" | grep -q '"ok":true'; then
    log "✅ Telegram notification sent successfully"
    exit 0
else
    log "ERROR: Telegram notification failed"
    log "Response: $RESPONSE"
    exit 0
fi
