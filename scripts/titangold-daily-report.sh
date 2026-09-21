#!/bin/bash
#
# TitanGold Daily Morning Report (Improved Readability)
# Comprehensive system health and backup status report sent via Telegram
#
# Usage: Run via cron after dump window (default 06:45)
# 45 6 * * * /usr/local/bin/titangold-daily-report.sh
# Ops 2026-08-15: in-progress awareness, orphan scoped, burn-in close
#

set -euo pipefail

# Configuration
ENV_FILE="/etc/titangold-backup.env"
LOG_FILE="/var/log/titangold-backup-rotation.log"
BACKUP_BASE="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE}/daily"
WEEKLY_DIR="${BACKUP_BASE}/weekly"
MONTHLY_DIR="${BACKUP_BASE}/monthly"
BACKUP_LOG="/var/log/titangold-backup.log"
LEDGER_FILE="/var/log/titangold-backup-ledger.jsonl"
GROWTH_TRACKING_FILE="/var/log/titangold-backup-growth.log"
NGINX_ACCESS_LOG="/var/log/nginx/titangold-backup-downloads.log"
BURNIN_START_FILE="/var/log/titangold-burn-in-start.date"
BURNIN_DAYS=7
BURNIN_TEMP_DIR="/var/www/titangold-temp-backups"
POSTGRES_ENV="/etc/titangold-backup-postgres.env"

# Frontend and Backend URLs
FRONTEND_URL="https://titan.zala.ir"
BACKEND_HEALTH_URL="http://localhost:5002/health"

# Thresholds
BACKUP_AGE_CRITICAL_HOURS=48
BACKUP_AGE_WARNING_HOURS=30
BURNIN_CLOSED_FILE="/var/log/titangold-burn-in-closed.date"

backup_is_running() {
    # True only when dump holds /var/backups/titangold/.dump.lock
    local lock=/var/backups/titangold/.dump.lock
    local rc=0
    [ -e "$lock" ] || return 1
    flock -n "$lock" true
    rc=$?
    if [ "$rc" -eq 0 ]; then
        return 1
    fi
    if [ "$rc" -eq 1 ]; then
        return 0
    fi
    pgrep -u postgres -f '/usr/local/bin/titangold-backup-db\.sh' >/dev/null 2>&1 && return 0
    pgrep -u postgres -f 'pg_dump.*titangold_db' >/dev/null 2>&1 && return 0
    return 1
}

count_orphans_safe() {
    # Only under backup base. Do not count live .inprogress while dump runs.
    local count=0
    local f
    while IFS= read -r -d '' f; do
        base=$(basename "$f")
        if [[ "$base" == *.inprogress ]]; then
            if backup_is_running; then
                continue
            fi
            # fresh inprogress (<6h) is not an orphan
            if [[ -z "$(find "$f" -type f -mmin +360 2>/dev/null)" ]]; then
                continue
            fi
        fi
        count=$((count + 1))
    done < <(find "$BACKUP_BASE" -type f \( -name '*.sql' ! -name '*.sql.gpg' ! -name '*.sql.gz.gpg' -o -name '*.inprogress' \) -print0 2>/dev/null)
    echo "$count"
}

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
LATEST_BACKUP=$(find "$BACKUP_BASE/daily" "$BACKUP_BASE/weekly" "$BACKUP_BASE/monthly" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_BACKUP")
    BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
    BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    
    # Determine backup status based on age (soft when dump in progress)
    BACKUP_IN_PROGRESS=0
    if backup_is_running; then
        BACKUP_IN_PROGRESS=1
        BACKUP_STATUS="⏳ In progress"
        BACKUP_EMOJI="ℹ️"
        if [ "$OVERALL_STATUS" == "OK" ]; then
            OVERALL_STATUS="INFO"
        fi
    elif [ -n "$BACKUP_AGE_HOURS" ] && [ "$((BACKUP_AGE_HOURS))" -ge "$BACKUP_AGE_CRITICAL_HOURS" ]; then
        BACKUP_STATUS="🔴 Failed"
        BACKUP_EMOJI="🔴"
        OVERALL_STATUS="CRITICAL"
        CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
    elif [ -n "$BACKUP_AGE_HOURS" ] && [ "$((BACKUP_AGE_HOURS))" -ge "$BACKUP_AGE_WARNING_HOURS" ]; then
        BACKUP_STATUS="⚠️ Warning"
        BACKUP_EMOJI="⚠️"
        if [ "$OVERALL_STATUS" == "OK" ]; then
            OVERALL_STATUS="WARNING"
        fi
        WARNING_COUNT=$((WARNING_COUNT + 1))
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
    DAILY_COUNT=$(find "$DAILY_DIR" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) 2>/dev/null | wc -l)
    WEEKLY_COUNT=$(find "$WEEKLY_DIR" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) 2>/dev/null | wc -l || echo "0")
    MONTHLY_COUNT=$(find "$MONTHLY_DIR" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) 2>/dev/null | wc -l || echo "0")
    
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
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
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
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
elif [ "$DISK_USAGE" -gt 70 ]; then
    DISK_EMOJI="⚠️"
    WARNING_COUNT=$((WARNING_COUNT + 1))
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
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
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
        WARNING_COUNT=$((WARNING_COUNT + 1))
        if [ "$OVERALL_STATUS" == "OK" ]; then
            OVERALL_STATUS="WARNING"
        fi
    fi
else
    BACKEND_STATUS="🔴 Offline"
    BACKEND_DETAIL="HTTP ${BACKEND_HTTP_CODE}"
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
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
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
    if [ "$OVERALL_STATUS" == "OK" ]; then
        OVERALL_STATUS="CRITICAL"
    fi
fi

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    REPORT="${REPORT}PostgreSQL: ✅ Running%0A"
else
    REPORT="${REPORT}PostgreSQL: 🔴 Stopped%0A"
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
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
    
    DOWNLOAD_COUNT=$(echo "$DOWNLOAD_COUNT" | sed "s/^0*//" | grep -v "^$" || echo "0"); if [ "$DOWNLOAD_COUNT" -gt 0 ] 2>/dev/null; then
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
# 5. BURN-IN STATUS (7-day stability watch — log/ledger only)
# ==========================================
set +e
if [ ! -f "$BURNIN_START_FILE" ]; then
    date '+%Y-%m-%d' > "$BURNIN_START_FILE" 2>/dev/null
fi
BURNIN_START=$(cat "$BURNIN_START_FILE" 2>/dev/null || date '+%Y-%m-%d')
TODAY_DATE=$(date '+%Y-%m-%d')
BURNIN_DAY=$(( ( $(date -d "$TODAY_DATE" +%s) - $(date -d "$BURNIN_START" +%s) ) / 86400 + 1 ))
if [ "$BURNIN_DAY" -lt 1 ]; then BURNIN_DAY=1; fi
if [ "$BURNIN_DAY" -gt "$BURNIN_DAYS" ]; then BURNIN_DAY=$BURNIN_DAYS; fi

burnin_failures=""
BURNIN_ALERT=0

mark_burnin_fail() {
    local label="$1"
    local detail="${2:-}"
    BURNIN_ALERT=1
    if [ -n "$detail" ]; then
        burnin_failures="${burnin_failures}- ${label}: ${detail}%0A"
    else
        burnin_failures="${burnin_failures}- ${label}%0A"
    fi
}

log_has() {
    grep -q "$1" "$2" 2>/dev/null
}

# Backup: ledger entry in last 36h OR backup.log success
BI_BACKUP="✅"
YESTERDAY_DATE=$(date -d '1 day ago' '+%Y-%m-%d')
if [ "${BACKUP_IN_PROGRESS:-0}" -eq 1 ]; then
    BI_BACKUP="⏳"
elif [ -f "$LEDGER_FILE" ]; then
    if ! grep -qE "\"ts\":\"${TODAY_DATE}|\"ts\":\"${YESTERDAY_DATE}" "$LEDGER_FILE" 2>/dev/null; then
        if ! log_has "${TODAY_DATE}.*Backup process finished successfully" "$BACKUP_LOG" \
           && ! log_has "${YESTERDAY_DATE}.*Backup process finished successfully" "$BACKUP_LOG"; then
            BI_BACKUP="❌"
            mark_burnin_fail "Backup" "no ledger/log success in 36h"
        fi
    fi
else
    if ! log_has "${TODAY_DATE}.*Backup process finished successfully" "$BACKUP_LOG" \
       && ! log_has "${YESTERDAY_DATE}.*Backup process finished successfully" "$BACKUP_LOG"; then
        BI_BACKUP="❌"
        mark_burnin_fail "Backup" "no successful backup in last 36h"
    fi
fi

if [ "${BACKUP_IN_PROGRESS:-0}" -eq 1 ]; then
    BI_BACKUP="⏳"
elif [ -n "${LATEST_BACKUP:-}" ] && [ "${BACKUP_AGE_HOURS:-999}" -ge 48 ]; then
    BI_BACKUP="❌"
    mark_burnin_fail "Backup age" "${BACKUP_AGE_HOURS}h (threshold 48h)"
fi

# Rotation / healthcheck from logs (safe grep, no pipes)
BI_ROTATION="✅"
if ! log_has "${TODAY_DATE}.*Backup Rotation Completed Successfully" "$LOG_FILE"; then
    BI_ROTATION="❌"
    mark_burnin_fail "Rotation" "not completed today"
fi

BI_HEALTH="✅"
if ! log_has "${TODAY_DATE}.*Backup health check passed" "$LOG_FILE" \
   && ! log_has "${TODAY_DATE}.*GPG decrypt verification passed" "$LOG_FILE"; then
    BI_HEALTH="❌"
    mark_burnin_fail "Healthcheck" "not passed today (check 05:00 log)"
fi

BI_REPORT="✅"

BI_DISK="✅"
if [ "$DISK_USAGE" -gt 80 ]; then
    BI_DISK="❌"
    mark_burnin_fail "Disk" "${DISK_USAGE}% (threshold 80%)"
elif [ "$DISK_USAGE" -gt 75 ]; then
    BI_DISK="⚠️"
    mark_burnin_fail "Disk watch" "${DISK_USAGE}% (threshold 75%)"
fi

ORPHAN_COUNT=$(count_orphans_safe | tr -d ' ')

PARTIAL_GPG_COUNT=0
if [ -n "${LATEST_BACKUP:-}" ]; then
    mapfile -t _pgp_sizes < <(find "$DAILY_DIR" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%s\n' 2>/dev/null | sort -n)
    if [ "${#_pgp_sizes[@]}" -ge 2 ]; then
        _pgp_median="${_pgp_sizes[$(( ${#_pgp_sizes[@]} / 2 ))]}"
        _pgp_threshold=$(( _pgp_median * 50 / 100 ))
        while IFS= read -r _gpg; do
            _sz=$(stat -c %s "$_gpg" 2>/dev/null)
            if [ -n "$_sz" ] && [ "$_sz" -lt "$_pgp_threshold" ]; then
                PARTIAL_GPG_COUNT=$((PARTIAL_GPG_COUNT + 1))
            fi
        done < <(find "$DAILY_DIR" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) 2>/dev/null)
    fi
fi

if [ "${ORPHAN_COUNT:-0}" -gt 0 ]; then
    mark_burnin_fail "Orphan SQL" "${ORPHAN_COUNT} file(s)"
fi
if [ "${PARTIAL_GPG_COUNT:-0}" -gt 0 ]; then
    mark_burnin_fail "Partial GPG" "${PARTIAL_GPG_COUNT} file(s)"
fi

STALE_TEMP=$(find "$BURNIN_TEMP_DIR" -type f -mmin +1500 2>/dev/null | wc -l | tr -d ' ')
if [ "${STALE_TEMP:-0}" -gt 0 ]; then
    mark_burnin_fail "Temp cleanup" "${STALE_TEMP} stale file(s)"
fi

# Close burn-in after a clean day at/after Day N
if [ ! -f "$BURNIN_CLOSED_FILE" ] && [ "$BURNIN_ALERT" -eq 0 ] && [ "$BURNIN_DAY" -ge "$BURNIN_DAYS" ] \
   && [ "${BI_BACKUP}" = "✅" ] && [ "${BI_ROTATION}" = "✅" ] && [ "${BI_HEALTH}" = "✅" ] \
   && [ "${BI_DISK}" = "✅" ] && [ "${ORPHAN_COUNT:-0}" -eq 0 ] && [ "${PARTIAL_GPG_COUNT:-0}" -eq 0 ]; then
    date '+%Y-%m-%d' > "$BURNIN_CLOSED_FILE" 2>/dev/null || true
    log "Burn-in CLOSED after clean Day ${BURNIN_DAY}/${BURNIN_DAYS}"
fi

if [ -f "$BURNIN_CLOSED_FILE" ]; then
    BURNIN_CLOSED_ON=$(cat "$BURNIN_CLOSED_FILE" 2>/dev/null || echo unknown)
    BURNIN_SECTION="🔥 Burn-in Status%0A"
    BURNIN_SECTION="${BURNIN_SECTION}CLOSED on ${BURNIN_CLOSED_ON}%0A%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Backup: ${BI_BACKUP}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Rotation: ${BI_ROTATION}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Healthcheck: ${BI_HEALTH}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Daily Report: ${BI_REPORT}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Disk Stable: ${BI_DISK}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Orphan Files: ${ORPHAN_COUNT:-0}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Partial GPG: ${PARTIAL_GPG_COUNT:-0}%0A"
    # No burn-in Telegram alerts after close (operational metrics remain in daily report)
elif [ "$BURNIN_ALERT" -eq 1 ]; then
    BURNIN_SECTION="🔥 Burn-in Status%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Day ${BURNIN_DAY} / ${BURNIN_DAYS}%0A%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Backup: ${BI_BACKUP}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Rotation: ${BI_ROTATION}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Healthcheck: ${BI_HEALTH}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Daily Report: ${BI_REPORT}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Disk Stable: ${BI_DISK}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Orphan Files: ${ORPHAN_COUNT:-0}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Partial GPG: ${PARTIAL_GPG_COUNT:-0}%0A"
    log "Burn-in check FAILED — sending immediate Telegram warning"
    BURNIN_WARN_MSG="Burn-in Alert Day ${BURNIN_DAY}/${BURNIN_DAYS}%0A%0A${burnin_failures}"
    /usr/local/bin/titangold-telegram-notify.sh warning "$BURNIN_WARN_MSG" || true
else
    BURNIN_SECTION="🔥 Burn-in Status%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Day ${BURNIN_DAY} / ${BURNIN_DAYS}%0A%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Backup: ${BI_BACKUP}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Rotation: ${BI_ROTATION}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Healthcheck: ${BI_HEALTH}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Daily Report: ${BI_REPORT}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Disk Stable: ${BI_DISK}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Orphan Files: ${ORPHAN_COUNT:-0}%0A"
    BURNIN_SECTION="${BURNIN_SECTION}Partial GPG: ${PARTIAL_GPG_COUNT:-0}%0A"
fi
set -e

# ==========================================
# 6. OVERALL STATUS AND NOTES
# ==========================================
# Add overall status at the top
OVERALL_EMOJI="✅"
if [ "$OVERALL_STATUS" == "CRITICAL" ]; then
    OVERALL_EMOJI="🔴"
elif [ "$OVERALL_STATUS" == "WARNING" ]; then
    OVERALL_EMOJI="⚠️"
elif [ "$OVERALL_STATUS" == "INFO" ]; then
    OVERALL_EMOJI="ℹ️"
fi

# Prepend overall status
FINAL_REPORT="🌅 TitanGold Daily Report%0A"
FINAL_REPORT="${FINAL_REPORT}Date: $(date '+%Y-%m-%d %H:%M')%0A%0A"
FINAL_REPORT="${FINAL_REPORT}${OVERALL_EMOJI} Overall: ${OVERALL_STATUS}%0A%0A"
FINAL_REPORT="${FINAL_REPORT}${REPORT#*%0A%0A}"

# Add notes if there are issues
if [ "${BACKUP_IN_PROGRESS:-0}" -eq 1 ]; then
    FINAL_REPORT="${FINAL_REPORT}ℹ️ Notes%0A"
    FINAL_REPORT="${FINAL_REPORT}- Backup dump still running; age check deferred%0A"
elif [ -n "${BACKUP_AGE_HOURS:-}" ] && [ "${BACKUP_AGE_HOURS}" -ge "$BACKUP_AGE_CRITICAL_HOURS" ] 2>/dev/null; then
    FINAL_REPORT="${FINAL_REPORT}⚠️ Notes%0A"
    FINAL_REPORT="${FINAL_REPORT}- Latest backup is too old: ${BACKUP_AGE_HOURS}h%0A"
fi

FINAL_REPORT="${FINAL_REPORT}%0A${BURNIN_SECTION}"

# ==========================================
# SEND REPORT
# ==========================================
log "Sending daily report to Telegram..."

# Route through publisher-aware notify helper (plain/report = no Markdown wrapper)
if /usr/local/bin/titangold-telegram-notify.sh report "$FINAL_REPORT"; then
    log "✅ Daily report sent successfully"
else
    log "ERROR: Failed to send daily report via notify helper"
fi

log "=== Daily Morning Report Complete ==="
