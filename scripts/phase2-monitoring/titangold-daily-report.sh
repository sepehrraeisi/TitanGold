#!/bin/bash
#
# TitanGold Daily Morning Report (Improved Readability)
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
BACKEND_HEALTH_URL="http://localhost:5002/health"

# Thresholds
BACKUP_AGE_CRITICAL_HOURS=48
BACKUP_AGE_WARNING_HOURS=30

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

# Initialize overall status
OVERALL_STATUS="OK"
CRITICAL_COUNT=0
WARNING_COUNT=0

# Initialize report message (PLAIN TEXT with emojis)
REPORT="🌅 TitanGold Daily Report%0A"
REPORT="${REPORT}Date: $(date '+%Y-%m-%d %H:%M')%0A%0A"

# ==========================================
# 1. BACKUP STATUS
# ==========================================
BACKUP_STATUS="OK"
BACKUP_EMOJI="✅"

# Get latest backup
LATEST_BACKUP=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_BACKUP")
    BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
    BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    
    # Determine backup status based on age
    if [ -n "$BACKUP_AGE_HOURS" ] && [ "$((BACKUP_AGE_HOURS))" -ge "$BACKUP_AGE_CRITICAL_HOURS" ]; then
        BACKUP_STATUS="🔴 Failed"
        BACKUP_EMOJI="🔴"
        OVERALL_STATUS="CRITICAL"
        ((CRITICAL_COUNT++))
    elif [ -n "$BACKUP_AGE_HOURS" ] && [ "$((BACKUP_AGE_HOURS))" -ge "$BACKUP_AGE_WARNING_HOURS" ]; then
        BACKUP_STATUS="⚠️ Warning"
        BACKUP_EMOJI="⚠️"
        if [ "$OVERALL_STATUS" == "OK" ]; then
            OVERALL_STATUS="WARNING"
        fi
        ((WARNING_COUNT++))
    else
        BACKUP_STATUS="✅ OK"
        BACKUP_EMOJI="✅"
    fi
    
    # Check for checksum
    CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
    if [ -f "$CHECKSUM_FILE" ]; then
        CHECKSUM=$(cat "$CHECKSUM_FILE" | head -c 8)
        SHA256_STATUS="✅ OK"
    else
        SHA256_STATUS="⚠️ Missing"
    fi
    
    # Backup counts
    DAILY_COUNT=$(find "$DAILY_DIR" -type f -name "*.sql.gpg" | wc -l)
    WEEKLY_COUNT=$(find "$WEEKLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l || echo "0")
    MONTHLY_COUNT=$(find "$MONTHLY_DIR" -type f -name "*.sql.gpg" 2>/dev/null | wc -l || echo "0")
    
    REPORT="${REPORT}📦 Backup%0A"
    REPORT="${REPORT}Status: ${BACKUP_STATUS}%0A"
    REPORT="${REPORT}Latest: ${BACKUP_NAME}%0A"
    REPORT="${REPORT}Age: ${BACKUP_AGE_HOURS}h%0A"
    REPORT="${REPORT}Size: ${BACKUP_SIZE}%0A"
    REPORT="${REPORT}SHA256: ${SHA256_STATUS}%0A"
    REPORT="${REPORT}Retention: ${DAILY_COUNT}D / ${WEEKLY_COUNT}W / ${MONTHLY_COUNT}M%0A"
else
    BACKUP_STATUS="🔴 Failed"
    BACKUP_EMOJI="🔴"
    OVERALL_STATUS="CRITICAL"
    ((CRITICAL_COUNT++))
    REPORT="${REPORT}📦 Backup%0A"
    REPORT="${REPORT}Status: ${BACKUP_STATUS}%0A"
    REPORT="${REPORT}Error: No backups found%0A"
fi

REPORT="${REPORT}%0A"

# ==========================================
# 2. SYSTEM RESOURCES
# ==========================================
REPORT="${REPORT}🖥 Server%0A"

# Disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_USED=$(df -h / | awk 'NR==2 {print $3}')
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_EMOJI="✅"
if [ "$DISK_USAGE" -gt 80 ]; then
    DISK_EMOJI="🔴"
    ((CRITICAL_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
elif [ "$DISK_USAGE" -gt 70 ]; then
    DISK_EMOJI="⚠️"
    ((WARNING_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="WARNING"
    fi
fi

REPORT="${REPORT}Disk: ${DISK_EMOJI} ${DISK_USED} / ${DISK_TOTAL} (${DISK_USAGE}%)%0A"

# RAM usage
RAM_TOTAL=$(free -h | awk 'NR==2 {print $2}')
RAM_USED=$(free -h | awk 'NR==2 {print $3}')
RAM_PERCENT=$(free | awk 'NR==2 {printf "%.0f", ($3/$2)*100}')
RAM_EMOJI="✅"
if [ "$RAM_PERCENT" -gt 90 ]; then
    RAM_EMOJI="🔴"
elif [ "$RAM_PERCENT" -gt 80 ]; then
    RAM_EMOJI="⚠️"
fi

REPORT="${REPORT}RAM: ${RAM_EMOJI} ${RAM_USED} / ${RAM_TOTAL} (${RAM_PERCENT}%)%0A"

# CPU load
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | sed 's/^ //' | sed 's/ //g')
LOAD_1MIN=$(echo "$LOAD_AVG" | cut -d',' -f1)
LOAD_EMOJI="✅"
if (( $(echo "$LOAD_1MIN > 8" | bc -l) )); then
    LOAD_EMOJI="🔴"
elif (( $(echo "$LOAD_1MIN > 4" | bc -l) )); then
    LOAD_EMOJI="⚠️"
fi

REPORT="${REPORT}CPU Load: ${LOAD_EMOJI} ${LOAD_AVG}%0A"

# Uptime
UPTIME=$(uptime -p | sed 's/up //')
REPORT="${REPORT}Uptime: ${UPTIME}%0A"

REPORT="${REPORT}%0A"

# ==========================================
# 3. APPLICATION STATUS
# ==========================================
REPORT="${REPORT}🌐 Application%0A"

# Frontend check (HTTP 200 = Online)
FRONTEND_HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")
FRONTEND_RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "timeout")
if [ "$FRONTEND_HTTP_CODE" == "200" ]; then
    FRONTEND_STATUS="✅ Online"
    FRONTEND_DETAIL="HTTP ${FRONTEND_HTTP_CODE}"
else
    FRONTEND_STATUS="🔴 Offline"
    FRONTEND_DETAIL="HTTP ${FRONTEND_HTTP_CODE}"
    ((CRITICAL_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
fi

REPORT="${REPORT}Frontend: ${FRONTEND_STATUS} ${FRONTEND_DETAIL}%0A"

# Backend API health check (HTTP 200 + DB connected = Online)
BACKEND_HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "000")
BACKEND_RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$BACKEND_HEALTH_URL" 2>/dev/null || echo "timeout")
if [ "$BACKEND_HTTP_CODE" == "200" ]; then
    DB_STATUS=$(curl -s --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null | jq -r '.database' 2>/dev/null || echo "unknown")
    if [ "$DB_STATUS" == "connected" ]; then
        BACKEND_STATUS="✅ Online"
        BACKEND_DETAIL="HTTP ${BACKEND_HTTP_CODE}"
    else
        BACKEND_STATUS="⚠️ Online"
        BACKEND_DETAIL="HTTP ${BACKEND_HTTP_CODE}, DB ${DB_STATUS}"
        ((WARNING_COUNT++))
        if [ "$OVERALL_STATUS" == "OK" ]; then
            OVERALL_STATUS="WARNING"
        fi
    fi
else
    BACKEND_STATUS="🔴 Offline"
    BACKEND_DETAIL="HTTP ${BACKEND_HTTP_CODE}"
    ((CRITICAL_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
fi

REPORT="${REPORT}Backend API: ${BACKEND_STATUS} ${BACKEND_DETAIL}%0A"

# Database status from API
if [ "$BACKEND_HTTP_CODE" == "200" ]; then
    if [ "$DB_STATUS" == "connected" ]; then
        REPORT="${REPORT}Database: ✅ Connected%0A"
    else
        REPORT="${REPORT}Database: 🔴 ${DB_STATUS}%0A"
    fi
else
    REPORT="${REPORT}Database: ⚠️ Unknown%0A"
fi

# Nginx
if systemctl is-active --quiet nginx; then
    REPORT="${REPORT}Nginx: ✅ Running%0A"
else
    REPORT="${REPORT}Nginx: 🔴 Stopped%0A"
    ((CRITICAL_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
fi

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    REPORT="${REPORT}PostgreSQL: ✅ Running%0A"
else
    REPORT="${REPORT}PostgreSQL: 🔴 Stopped%0A"
    ((CRITICAL_COUNT++))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
fi

# SSL Certificate
SSL_EXPIRY=$(echo | openssl s_client -servername titan.zala.ir -connect titan.zala.ir:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2 || echo "Unknown")
SSL_DATE=$(date -d "$SSL_EXPIRY" '+%Y-%m-%d' 2>/dev/null || echo 'N/A')
if [ "$SSL_DATE" != "N/A" ]; then
    REPORT="${REPORT}SSL: ✅ Valid until ${SSL_DATE}%0A"
else
    REPORT="${REPORT}SSL: ⚠️ Unable to verify%0A"
fi

REPORT="${REPORT}%0A"

# ==========================================
# 4. DOWNLOAD ANALYTICS
# ==========================================
REPORT="${REPORT}📥 Downloads%0A"

if [ -f "$NGINX_ACCESS_LOG" ]; then
    YESTERDAY=$(date -d '1 day ago' '+%d/%b/%Y')
    TODAY=$(date '+%d/%b/%Y')
    
    DOWNLOAD_COUNT=$(grep -E "($YESTERDAY|$TODAY)" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l || echo "0")
    
    if [ "$((DOWNLOAD_COUNT))" -gt 0 ]; then
        UNIQUE_IPS=$(grep -E "($YESTERDAY|$TODAY)" "$NGINX_ACCESS_LOG" 2>/dev/null | awk '{print $1}' | sort -u | wc -l || echo "0")
        REPORT="${REPORT}Last 24h: ${DOWNLOAD_COUNT}%0A"
        REPORT="${REPORT}Unique IPs: ${UNIQUE_IPS}%0A"
    else
        REPORT="${REPORT}Last 24h: 0%0A"
        REPORT="${REPORT}Unique IPs: 0%0A"
    fi
else
    REPORT="${REPORT}Last 24h: Log not found%0A"
fi

REPORT="${REPORT}%0A"

# ==========================================
# 5. OVERALL STATUS AND NOTES
# ==========================================
# Add overall status at the top
OVERALL_EMOJI="✅"
if [ "$OVERALL_STATUS" == "CRITICAL" ]; then
    OVERALL_EMOJI="🔴"
elif [ "$OVERALL_STATUS" == "WARNING" ]; then
    OVERALL_EMOJI="⚠️"
fi

# Prepend overall status
FINAL_REPORT="🌅 TitanGold Daily Report%0A"
FINAL_REPORT="${FINAL_REPORT}Date: $(date '+%Y-%m-%d %H:%M')%0A%0A"
FINAL_REPORT="${FINAL_REPORT}${OVERALL_EMOJI} Overall: ${OVERALL_STATUS}%0A%0A"
FINAL_REPORT="${FINAL_REPORT}${REPORT#*%0A%0A}"

# Add notes if there are issues
if [ -n "$BACKUP_AGE_HOURS" ] && [ "$((BACKUP_AGE_HOURS))" -ge "$BACKUP_AGE_CRITICAL_HOURS" ]; then
    FINAL_REPORT="${FINAL_REPORT}⚠️ Notes%0A"
    FINAL_REPORT="${FINAL_REPORT}- Latest backup is too old: ${BACKUP_AGE_HOURS}h%0A"
fi

# ==========================================
# SEND REPORT
# ==========================================
log "Sending daily report to Telegram..."

TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

# Send as plain text (no parse_mode)
RESPONSE=$(curl -s -X POST "$TELEGRAM_API" \
    -d chat_id="$TELEGRAM_CHAT_ID" \
    -d text="$FINAL_REPORT" \
    2>&1)

if echo "$RESPONSE" | grep -q '"ok":true'; then
    log "✅ Daily report sent successfully"
else
    log "ERROR: Failed to send daily report"
    log "Response: $RESPONSE"
fi

log "=== Daily Morning Report Complete ==="
