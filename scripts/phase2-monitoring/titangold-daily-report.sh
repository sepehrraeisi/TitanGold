#!/bin/bash
#
# TitanGold Daily Morning Report (Plain Text for Reliability)
# Comprehensive system health and backup status report sent via Telegram
#
# Usage: Run via cron daily at 5:05 AM
# 5 5 * * * /usr/local/bin/titangold-daily-report.sh
#

set -euo pipefail

# Configuration
ENV_FILE="/etc/titangold-backup.env"
LOG_FILE="/var/log/titangold-backup-rotation.log"
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
WEEKLY_DIR="${BACKUP_BASE}/weekly"
MONTHLY_DIR="${BACKUP_BASE}/monthly"
GROWTH_TRACKING_FILE="/var/log/titangold-backup-growth.log"
NGINX_ACCESS_LOG="/var/log/nginx/titangold-backup-downloads.log"

# Frontend and Backend URLs
FRONTEND_URL="https://titan.zala.ir"
BACKEND_HEALTH_URL="https://titan.zala.ir/api/health"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DAILY_REPORT] $1" | tee -a "$LOG_FILE"
}

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    log "ERROR: Environment file not found: $ENV_FILE"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

log "=== Starting Daily Morning Report ==="

# Initialize report message (PLAIN TEXT - no Markdown)
REPORT="TitanGold Daily Morning Report%0A"
REPORT="${REPORT}$(date '+%Y-%m-%d %H:%M:%S')%0A"
REPORT="${REPORT}================================%0A%0A"

# ==========================================
# 1. BACKUP STATUS
# ==========================================
REPORT="${REPORT}BACKUP STATUS%0A"

# Get latest backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_BACKUP")
    BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
    BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    
    # Check for checksum
    CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
    if [ -f "$CHECKSUM_FILE" ]; then
        CHECKSUM=$(cat "$CHECKSUM_FILE" | head -c 8)
        CHECKSUM_STATUS="OK"
    else
        CHECKSUM="N/A"
        CHECKSUM_STATUS="MISSING"
    fi
    
    REPORT="${REPORT}  Latest: ${BACKUP_NAME}%0A"
    REPORT="${REPORT}  Size: ${BACKUP_SIZE}%0A"
    REPORT="${REPORT}  Age: ${BACKUP_AGE_HOURS} hours%0A"
    REPORT="${REPORT}  SHA256: ${CHECKSUM_STATUS} (${CHECKSUM}...)%0A"
    
    # Backup growth monitoring
    BACKUP_SIZE_BYTES=$(stat -c%s "$LATEST_BACKUP")
    PREV_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -2 | head -1 | cut -d' ' -f2-)
    
    if [ -n "$PREV_BACKUP" ] && [ "$PREV_BACKUP" != "$LATEST_BACKUP" ]; then
        PREV_SIZE_BYTES=$(stat -c%s "$PREV_BACKUP")
        SIZE_DIFF_BYTES=$((BACKUP_SIZE_BYTES - PREV_SIZE_BYTES))
        SIZE_DIFF_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($SIZE_DIFF_BYTES / $PREV_SIZE_BYTES) * 100}")
        
        # Log growth
        echo "[$(date '+%Y-%m-%d')] $BACKUP_SIZE_BYTES $SIZE_DIFF_BYTES $SIZE_DIFF_PERCENT" >> "$GROWTH_TRACKING_FILE"
        
        # Determine growth status
        GROWTH_STATUS="NORMAL"
        if (( $(echo "$SIZE_DIFF_PERCENT > 50" | bc -l) )); then
            GROWTH_STATUS="CRITICAL GROWTH"
        elif (( $(echo "$SIZE_DIFF_PERCENT > 25" | bc -l) )); then
            GROWTH_STATUS="WARNING GROWTH"
        elif (( $(echo "$SIZE_DIFF_PERCENT < -50" | bc -l) )); then
            GROWTH_STATUS="CRITICAL DROP"
        elif (( $(echo "$SIZE_DIFF_PERCENT < -25" | bc -l) )); then
            GROWTH_STATUS="WARNING DROP"
        fi
        
        REPORT="${REPORT}  Growth: ${GROWTH_STATUS} (${SIZE_DIFF_PERCENT} percent)%0A"
    fi
    
    # Backup counts
    DAILY_COUNT=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" | wc -l)
    WEEKLY_COUNT=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" | wc -l)
    MONTHLY_COUNT=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" | wc -l)
    
    REPORT="${REPORT}  Retention: ${DAILY_COUNT} daily / ${WEEKLY_COUNT} weekly / ${MONTHLY_COUNT} monthly%0A"
else
    REPORT="${REPORT}  ERROR: NO BACKUPS FOUND%0A"
fi

REPORT="${REPORT}%0A"

# ==========================================
# 2. SYSTEM RESOURCES
# ==========================================
REPORT="${REPORT}SYSTEM RESOURCES%0A"

# Disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
DISK_USED=$(df -h / | awk 'NR==2 {print $3}')
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_STATUS="OK"
DISK_USAGE_NUM=$(echo "$DISK_USAGE" | sed 's/%//')
if [ "$DISK_USAGE_NUM" -gt 80 ]; then
    DISK_STATUS="CRITICAL"
elif [ "$DISK_USAGE_NUM" -gt 70 ]; then
    DISK_STATUS="WARNING"
fi

REPORT="${REPORT}  Disk: ${DISK_STATUS} - ${DISK_USED} / ${DISK_TOTAL} (${DISK_USAGE})%0A"

# RAM usage
RAM_TOTAL=$(free -h | awk 'NR==2 {print $2}')
RAM_USED=$(free -h | awk 'NR==2 {print $3}')
RAM_PERCENT=$(free | awk 'NR==2 {printf "%.0f", ($3/$2)*100}')
RAM_STATUS="OK"
if [ "$RAM_PERCENT" -gt 90 ]; then
    RAM_STATUS="CRITICAL"
elif [ "$RAM_PERCENT" -gt 80 ]; then
    RAM_STATUS="WARNING"
fi

REPORT="${REPORT}  RAM: ${RAM_STATUS} - ${RAM_USED} / ${RAM_TOTAL} (${RAM_PERCENT} percent)%0A"

# CPU load average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | sed 's/^ //' | sed 's/ //g')
REPORT="${REPORT}  CPU Load: ${LOAD_AVG}%0A"

# System uptime
UPTIME=$(uptime -p | sed 's/up //')
REPORT="${REPORT}  Uptime: ${UPTIME}%0A"

REPORT="${REPORT}%0A"

# ==========================================
# 3. SERVICE STATUS
# ==========================================
REPORT="${REPORT}SERVICE STATUS%0A"

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    PG_STATUS="RUNNING"
else
    PG_STATUS="STOPPED"
fi
REPORT="${REPORT}  PostgreSQL: ${PG_STATUS}%0A"

# Nginx
if systemctl is-active --quiet nginx; then
    NGINX_STATUS="RUNNING"
else
    NGINX_STATUS="STOPPED"
fi
REPORT="${REPORT}  Nginx: ${NGINX_STATUS}%0A"

# Backend (PM2)
BACKEND_PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="titan-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
if [ "$BACKEND_PM2_STATUS" == "online" ]; then
    BACKEND_STATUS="ONLINE"
else
    BACKEND_STATUS="OFFLINE"
fi
REPORT="${REPORT}  Backend: ${BACKEND_STATUS}%0A"

# Docker (if used)
if command -v docker &> /dev/null; then
    DOCKER_RUNNING=$(docker ps -q 2>/dev/null | wc -l || echo "0")
    if [ "$DOCKER_RUNNING" -gt 0 ]; then
        REPORT="${REPORT}  Docker: ${DOCKER_RUNNING} containers%0A"
    fi
fi

REPORT="${REPORT}%0A"

# ==========================================
# 4. WEBSITE & API HEALTH
# ==========================================
REPORT="${REPORT}WEBSITE AND API HEALTH%0A"

# Frontend check
FRONTEND_HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")
FRONTEND_RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "timeout")
if [ "$FRONTEND_HTTP_CODE" == "200" ]; then
    FRONTEND_STATUS="OK"
else
    FRONTEND_STATUS="FAILED"
fi
REPORT="${REPORT}  Frontend: ${FRONTEND_STATUS} - HTTP ${FRONTEND_HTTP_CODE} (${FRONTEND_RESPONSE_TIME}s)%0A"

# Backend API health check
BACKEND_HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000")
BACKEND_RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "timeout")
if [ "$BACKEND_HTTP_CODE" == "200" ]; then
    BACKEND_API_STATUS="OK"
else
    BACKEND_API_STATUS="FAILED"
fi
REPORT="${REPORT}  API Health: ${BACKEND_API_STATUS} - HTTP ${BACKEND_HTTP_CODE} (${BACKEND_RESPONSE_TIME}s)%0A"

# SSL/HTTPS check
SSL_EXPIRY=$(echo | openssl s_client -servername titan.zala.ir -connect titan.zala.ir:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2 || echo "Unknown")
SSL_DATE=$(date -d "$SSL_EXPIRY" '+%Y-%m-%d' 2>/dev/null || echo 'N/A')
REPORT="${REPORT}  SSL: Valid until ${SSL_DATE}%0A"

REPORT="${REPORT}%0A"

# ==========================================
# 5. DOWNLOAD ANALYTICS
# ==========================================
REPORT="${REPORT}DOWNLOAD ANALYTICS (24h)%0A"

if [ -f "$NGINX_ACCESS_LOG" ]; then
    # Count downloads in last 24 hours
    YESTERDAY=$(date -d '1 day ago' '+%d/%b/%Y')
    TODAY=$(date '+%d/%b/%Y')
    
    DOWNLOAD_COUNT=$(grep -E "($YESTERDAY|$TODAY)" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l || echo "0")
    
    if [ "$DOWNLOAD_COUNT" -gt 0 ]; then
        # Get unique IPs (masked)
        UNIQUE_IPS=$(grep -E "($YESTERDAY|$TODAY)" "$NGINX_ACCESS_LOG" 2>/dev/null | awk '{print $1}' | sort -u | wc -l || echo "0")
        
        # Get last download time
        LAST_DOWNLOAD=$(grep -E "($YESTERDAY|$TODAY)" "$NGINX_ACCESS_LOG" 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/\[//' || echo "N/A")
        
        REPORT="${REPORT}  Downloads: ${DOWNLOAD_COUNT}%0A"
        REPORT="${REPORT}  Unique IPs: ${UNIQUE_IPS}%0A"
        REPORT="${REPORT}  Last: ${LAST_DOWNLOAD}%0A"
    else
        REPORT="${REPORT}  No downloads in last 24h%0A"
    fi
else
    REPORT="${REPORT}  Log file not found%0A"
fi

REPORT="${REPORT}%0A"

# ==========================================
# 6. RECENT ERRORS (if any)
# ==========================================
RECENT_ERRORS=$(grep -i "ERROR\|CRITICAL\|FAILED" "$LOG_FILE" 2>/dev/null | tail -3 || echo "")
if [ -n "$RECENT_ERRORS" ]; then
    REPORT="${REPORT}RECENT ERRORS%0A"
    ERROR_COUNT=$(grep -i "ERROR\|CRITICAL\|FAILED" "$LOG_FILE" 2>/dev/null | wc -l || echo "0")
    REPORT="${REPORT}  Found ${ERROR_COUNT} errors in log%0A"
    REPORT="${REPORT}  Check /var/log/titangold-backup-rotation.log%0A"
fi

# ==========================================
# SEND REPORT (PLAIN TEXT)
# ==========================================
log "Sending daily report to Telegram..."

TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

# Send as plain text (no parse_mode)
RESPONSE=$(curl -s -X POST "$TELEGRAM_API" \
    -d chat_id="$TELEGRAM_CHAT_ID" \
    -d text="$REPORT" \
    2>&1)

if echo "$RESPONSE" | grep -q '"ok":true'; then
    log "✅ Daily report sent successfully"
else
    log "ERROR: Failed to send daily report"
    log "Response: $RESPONSE"
fi

log "=== Daily Morning Report Complete ==="
