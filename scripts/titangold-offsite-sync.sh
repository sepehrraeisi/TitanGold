#!/bin/bash
#
# TitanGold Offsite Backup Sync (3-2-1 Rule Compliance)
# Syncs monthly backups to offsite storage (S3, Backblaze B2, Hetzner Storage Box)
#
# Usage: Run weekly via cron at 7 AM every Sunday
# 0 7 * * 0 /usr/local/bin/titangold-offsite-sync.sh
#
# CRITICAL: Configure at least ONE offsite destination for disaster recovery
#

set -euo pipefail

# Configuration
BACKUP_BASE="/var/backups/titangold"
MONTHLY_DIR="${BACKUP_BASE}/monthly"
WEEKLY_DIR="${BACKUP_BASE}/weekly"  # Also sync latest weekly as extra safety
LOG_FILE="/var/log/titangold-backup-rotation.log"

# Offsite Storage Configuration (enable at least one)
# ============================================================

# Option 1: Hetzner Storage Box (recommended for EU)
HETZNER_ENABLED="${HETZNER_ENABLED:-false}"
HETZNER_USER="${HETZNER_USER:-u123456}"
HETZNER_HOST="${HETZNER_HOST:-u123456.your-storagebox.de}"
HETZNER_PATH="${HETZNER_PATH:-/titangold-backups}"
# Setup: Add SSH key to Hetzner Storage Box first
# ssh-copy-id -p 23 u123456@u123456.your-storagebox.de

# Option 2: AWS S3 / Wasabi / DigitalOcean Spaces
S3_ENABLED="${S3_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-s3://my-backup-bucket/titangold}"
S3_REGION="${S3_REGION:-us-east-1}"
# Requires: aws-cli configured with credentials
# aws configure set aws_access_key_id YOUR_KEY
# aws configure set aws_secret_access_key YOUR_SECRET

# Option 3: Backblaze B2
B2_ENABLED="${B2_ENABLED:-false}"
B2_BUCKET="${B2_BUCKET:-titangold-backups}"
B2_ACCOUNT_ID="${B2_ACCOUNT_ID:-}"
B2_APPLICATION_KEY="${B2_APPLICATION_KEY:-}"
# Requires: b2 command-line tool
# pip install b2

# Option 4: Rclone (supports 40+ providers)
RCLONE_ENABLED="${RCLONE_ENABLED:-false}"
RCLONE_REMOTE="${RCLONE_REMOTE:-remote:titangold-backups}"
# Requires: rclone configured
# rclone config

# Alert Configuration
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

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
    logger -t titangold-offsite "[$severity] $message"
    
    # Telegram
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
        local emoji="ℹ️"
        [[ "$severity" == "WARNING" ]] && emoji="⚠️"
        [[ "$severity" == "CRITICAL" ]] && emoji="🔴"
        
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d parse_mode="Markdown" \
            -d text="${emoji} *TitanGold Offsite Backup*%0A%0A*Severity:* ${severity}%0A*Message:* ${message}" \
            > /dev/null 2>&1 || true
    fi
    
    # Discord
    if [[ -n "$DISCORD_WEBHOOK_URL" ]]; then
        local color="3447003"
        [[ "$severity" == "WARNING" ]] && color="16776960"
        [[ "$severity" == "CRITICAL" ]] && color="15158332"
        
        curl -s -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"TitanGold Offsite Backup\",\"description\":\"${message}\",\"color\":${color}}]}" \
            > /dev/null 2>&1 || true
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    alert "CRITICAL" "Offsite sync must run as root"
    exit 1
fi

log "=== Starting Offsite Backup Sync ==="

# Check if any offsite storage is enabled
if [[ "$HETZNER_ENABLED" == "false" && "$S3_ENABLED" == "false" && "$B2_ENABLED" == "false" && "$RCLONE_ENABLED" == "false" ]]; then
    alert "WARNING" "No offsite storage enabled - 3-2-1 backup rule NOT satisfied"
    log "Please enable at least one offsite destination in script configuration"
    exit 0
fi

# Count files to sync
MONTHLY_COUNT=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l)
LATEST_WEEKLY=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

log "Files to sync: $MONTHLY_COUNT monthly backups + 1 latest weekly"

if [ "$MONTHLY_COUNT" -eq 0 ]; then
    alert "WARNING" "No monthly backups found to sync"
fi

# ============================================================
# Sync to Hetzner Storage Box
# ============================================================
if [[ "$HETZNER_ENABLED" == "true" ]]; then
    log "Syncing to Hetzner Storage Box ($HETZNER_HOST)..."
    
    # Create remote directory if not exists
    ssh -p 23 -o StrictHostKeyChecking=no "$HETZNER_USER@$HETZNER_HOST" "mkdir -p $HETZNER_PATH/monthly $HETZNER_PATH/weekly" 2>/dev/null || true
    
    # Sync monthly backups
    if rsync -avz --progress -e "ssh -p 23" \
        "$MONTHLY_DIR/" \
        "$HETZNER_USER@$HETZNER_HOST:$HETZNER_PATH/monthly/" \
        >> "$LOG_FILE" 2>&1; then
        log "✅ Hetzner sync successful (monthly)"
    else
        alert "CRITICAL" "Hetzner monthly sync failed"
    fi
    
    # Sync latest weekly
    if [[ -n "$LATEST_WEEKLY" ]]; then
        if rsync -avz --progress -e "ssh -p 23" \
            "$LATEST_WEEKLY" \
            "$HETZNER_USER@$HETZNER_HOST:$HETZNER_PATH/weekly/" \
            >> "$LOG_FILE" 2>&1; then
            log "✅ Hetzner sync successful (latest weekly)"
        else
            alert "WARNING" "Hetzner weekly sync failed"
        fi
    fi
fi

# ============================================================
# Sync to S3-compatible storage (AWS, Wasabi, DigitalOcean)
# ============================================================
if [[ "$S3_ENABLED" == "true" ]]; then
    log "Syncing to S3 ($S3_BUCKET)..."
    
    if command -v aws &> /dev/null; then
        # Sync monthly backups
        if aws s3 sync "$MONTHLY_DIR/" "$S3_BUCKET/monthly/" \
            --region "$S3_REGION" \
            --storage-class GLACIER_IR \
            >> "$LOG_FILE" 2>&1; then
            log "✅ S3 sync successful (monthly)"
        else
            alert "CRITICAL" "S3 monthly sync failed"
        fi
        
        # Sync latest weekly
        if [[ -n "$LATEST_WEEKLY" ]]; then
            if aws s3 cp "$LATEST_WEEKLY" "$S3_BUCKET/weekly/" \
                --region "$S3_REGION" \
                >> "$LOG_FILE" 2>&1; then
                log "✅ S3 sync successful (latest weekly)"
            else
                alert "WARNING" "S3 weekly sync failed"
            fi
        fi
    else
        alert "CRITICAL" "aws-cli not installed (required for S3 sync)"
    fi
fi

# ============================================================
# Sync to Backblaze B2
# ============================================================
if [[ "$B2_ENABLED" == "true" ]]; then
    log "Syncing to Backblaze B2 ($B2_BUCKET)..."
    
    if command -v b2 &> /dev/null; then
        # Authorize B2
        b2 authorize-account "$B2_ACCOUNT_ID" "$B2_APPLICATION_KEY" > /dev/null 2>&1 || true
        
        # Sync monthly backups
        if b2 sync --replaceNewer "$MONTHLY_DIR/" "b2://$B2_BUCKET/monthly/" \
            >> "$LOG_FILE" 2>&1; then
            log "✅ B2 sync successful (monthly)"
        else
            alert "CRITICAL" "B2 monthly sync failed"
        fi
        
        # Sync latest weekly
        if [[ -n "$LATEST_WEEKLY" ]]; then
            if b2 upload-file "$B2_BUCKET" "$LATEST_WEEKLY" "weekly/$(basename "$LATEST_WEEKLY")" \
                >> "$LOG_FILE" 2>&1; then
                log "✅ B2 sync successful (latest weekly)"
            else
                alert "WARNING" "B2 weekly sync failed"
            fi
        fi
    else
        alert "CRITICAL" "b2 command-line tool not installed (required for B2 sync)"
    fi
fi

# ============================================================
# Sync via Rclone (universal)
# ============================================================
if [[ "$RCLONE_ENABLED" == "true" ]]; then
    log "Syncing via Rclone ($RCLONE_REMOTE)..."
    
    if command -v rclone &> /dev/null; then
        # Sync monthly backups
        if rclone sync "$MONTHLY_DIR/" "$RCLONE_REMOTE/monthly/" \
            --progress \
            --log-file="$LOG_FILE" \
            --log-level INFO; then
            log "✅ Rclone sync successful (monthly)"
        else
            alert "CRITICAL" "Rclone monthly sync failed"
        fi
        
        # Sync latest weekly
        if [[ -n "$LATEST_WEEKLY" ]]; then
            if rclone copy "$LATEST_WEEKLY" "$RCLONE_REMOTE/weekly/" \
                --progress \
                --log-file="$LOG_FILE" \
                --log-level INFO; then
                log "✅ Rclone sync successful (latest weekly)"
            else
                alert "WARNING" "Rclone weekly sync failed"
            fi
        fi
    else
        alert "CRITICAL" "rclone not installed (required for Rclone sync)"
    fi
fi

# ============================================================
# Summary
# ============================================================
SYNCED_DESTINATIONS=0
[[ "$HETZNER_ENABLED" == "true" ]] && ((SYNCED_DESTINATIONS++))
[[ "$S3_ENABLED" == "true" ]] && ((SYNCED_DESTINATIONS++))
[[ "$B2_ENABLED" == "true" ]] && ((SYNCED_DESTINATIONS++))
[[ "$RCLONE_ENABLED" == "true" ]] && ((SYNCED_DESTINATIONS++))

if [ "$SYNCED_DESTINATIONS" -gt 0 ]; then
    alert "INFO" "✅ Offsite sync completed: $MONTHLY_COUNT monthly + 1 weekly to $SYNCED_DESTINATIONS destination(s)"
else
    alert "WARNING" "No offsite destinations configured"
fi

log "=== Offsite Backup Sync Completed ==="
exit 0
