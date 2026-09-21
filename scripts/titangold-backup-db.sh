#!/bin/bash

################################################################################
# TitanGold Database Backup Script — V2 (Streaming) + Ops Upgrade 2026-08-15
#
# Pipeline (no plaintext SQL on disk):
#   pg_dump | gzip -c | gpg --symmetric  >  *.sql.gz.gpg.inprogress
#   verify → SHA256 → atomic rename → ledger
#
# Ops:
#   - flock single-flight (no parallel dumps)
#   - same-day one retry after failure when free disk allows
#   - log once (no tee+cron double-write)
################################################################################

set -euo pipefail

ENV_FILE="/etc/titangold-backup-postgres.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck source=/etc/titangold-backup-postgres.env
    source "$ENV_FILE"
    set +a
fi

DB_NAME="titangold_db"
DB_PORT="5433"
DB_USER="postgres"
BACKUP_BASE_DIR="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE_DIR}/daily"
WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
MONTHLY_DIR="${BACKUP_BASE_DIR}/monthly"
LOG_FILE="/var/log/titangold-backup.log"
LEDGER_FILE="/var/log/titangold-backup-ledger.jsonl"
LOCK_FILE="/var/backups/titangold/.dump.lock"
RETENTION_DAYS=30
ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"
# Streaming peak is ~final file size; keep comfortable margin.
MIN_FREE_GB=14
# Reject suspiciously small outputs (encrypted gzip should be hundreds of MB+)
MIN_BACKUP_BYTES=$((100 * 1024 * 1024))
RETRY_SLEEP_SEC=600
MAX_ATTEMPTS=2

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

LAST_BACKUP_FILE=""
LAST_BACKUP_DURATION=0

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    # Single write to LOG_FILE (cron must not also redirect to this same file).
    printf '%s [%s] %s\n' "${timestamp}" "${level}" "${message}" >> "${LOG_FILE}"
    if [[ -t 1 ]]; then
        case "${level}" in
            ERROR)   printf '%s [%s] %b\n' "${timestamp}" "${level}" "${RED}${message}${NC}" ;;
            SUCCESS) printf '%s [%s] %b\n' "${timestamp}" "${level}" "${GREEN}${message}${NC}" ;;
            WARNING) printf '%s [%s] %b\n' "${timestamp}" "${level}" "${YELLOW}${message}${NC}" ;;
            *)       printf '%s [%s] %s\n' "${timestamp}" "${level}" "${message}" ;;
        esac
    fi
}

log_info()    { log "INFO" "$@"; }
log_error()   { log "ERROR" "$*"; }
log_success() { log "SUCCESS" "$*"; }
log_warning() { log "WARNING" "$*"; }

send_critical_alert() {
    local message="$1"
    log_error "CRITICAL: ${message}"
    if [[ -x /usr/local/bin/titangold-telegram-notify.sh ]]; then
        # Prefer publisher-aware helper (root cron). As postgres user, use runtime cache via notify fallbacks.
        /usr/local/bin/titangold-telegram-notify.sh error "CRITICAL: ${message}" >> "${LOG_FILE}" 2>&1 || true
        return 0
    fi
    # Legacy fallback
    if [[ -f /etc/titangold-telegram-runtime.env ]]; then
        # shellcheck disable=SC1091
        source /etc/titangold-telegram-runtime.env
    fi
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=🔴 CRITICAL: ${message}" >> "${LOG_FILE}" 2>&1 || true
    fi
}

append_ledger() {
    local backup_type="$1"
    local backup_file="$2"
    local duration_sec="$3"
    local sha256_val=""
    local bytes=0
    local disk_pct=0
    if [[ -f "${backup_file}.sha256" ]]; then
        sha256_val=$(awk '{print $1}' "${backup_file}.sha256")
    fi
    if [[ -f "${backup_file}" ]]; then
        bytes=$(stat -c %s "${backup_file}")
    fi
    disk_pct=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    printf '{"ts":"%s","type":"%s","file":"%s","bytes":%s,"sha256":"%s","duration_sec":%s,"disk_pct":%s,"status":"success","format":"sql.gz.gpg"}\n' \
        "$(date -Iseconds)" "${backup_type}" "$(basename "${backup_file}")" \
        "${bytes}" "${sha256_val}" "${duration_sec}" "${disk_pct}" >> "${LEDGER_FILE}" 2>/dev/null || true
}


reclaim_disk_for_backup() {
    local need_gb="${MIN_FREE_GB}"
    local avail_kb avail_gb
    avail_kb=$(df -k / | awk 'NR==2 {print $4}')
    avail_gb=$((avail_kb / 1024 / 1024))
    if [[ "${avail_gb}" -ge "${need_gb}" ]]; then
        return 0
    fi
    log_warning "Disk free ${avail_gb}GB < ${need_gb}GB — reclaiming old backups before circuit breaker"

    mkdir -p "${MONTHLY_DIR}" "${DAILY_DIR}" "${WEEKLY_DIR}"

    while IFS= read -r -d '' f; do
        log_warning "Reclaim delete monthly: $(basename "$f")"
        rm -f "$f" "${f}.sha256"
    done < <(find "${MONTHLY_DIR}" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -print0 2>/dev/null)

    avail_kb=$(df -k / | awk 'NR==2 {print $4}')
    avail_gb=$((avail_kb / 1024 / 1024))
    [[ "${avail_gb}" -ge "${need_gb}" ]] && return 0

    mapfile -t dailies < <(find "${DAILY_DIR}" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-)
    if ((${#dailies[@]} > 3)); then
        for oldf in "${dailies[@]:3}"; do
            log_warning "Reclaim delete daily: $(basename "$oldf")"
            rm -f "$oldf" "${oldf}.sha256"
        done
    fi

    avail_kb=$(df -k / | awk 'NR==2 {print $4}')
    avail_gb=$((avail_kb / 1024 / 1024))
    [[ "${avail_gb}" -ge "${need_gb}" ]] && return 0

    local newest_weekly newest_daily
    newest_weekly=$(find "${WEEKLY_DIR}" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    newest_daily=$(find "${DAILY_DIR}" -type f \( -name '*.sql.gz.gpg' -o -name '*.sql.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    if [[ -n "${newest_weekly}" && -n "${newest_daily}" ]]; then
        if [[ "$(stat -c %Y "$newest_weekly")" -ge "$(stat -c %Y "$newest_daily")" ]]; then
            log_warning "Reclaim delete daily (weekly newer/equal): $(basename "$newest_daily")"
            rm -f "$newest_daily" "${newest_daily}.sha256"
        fi
    fi

    rm -rf /tmp/ci-root /tmp/ci-be /tmp/pm2-logrotate /tmp/gitleaks /tmp/titangold-* 2>/dev/null || true
    if command -v docker >/dev/null 2>&1; then
        docker volume prune -f >/dev/null 2>&1 || true
        docker image prune -af >/dev/null 2>&1 || true
    fi
    find /home/ubuntu/.pm2/logs -type f -name '*.log' -size +20M -exec truncate -s 0 {} \; 2>/dev/null || true
}


check_disk_budget() {
    local avail_kb avail_gb
    reclaim_disk_for_backup
    avail_kb=$(df -k / | awk 'NR==2 {print $4}')
    avail_gb=$((avail_kb / 1024 / 1024))
    log_info "Disk free before backup (V2 streaming): ${avail_gb}GB (minimum required: ${MIN_FREE_GB}GB)"
    if [[ "${avail_gb}" -lt "${MIN_FREE_GB}" ]]; then
        send_critical_alert "Backup V2 aborted: only ${avail_gb}GB free (need ${MIN_FREE_GB}GB)."
        return 1
    fi
    return 0
}

cleanup_inprogress() {
    local base="$1"
    rm -f "${base}.inprogress" "${base}.inprogress.sha256" "${base}.partial"
}

check_prerequisites() {
    log_info "Checking prerequisites (Backup V2 streaming)..."

    if [[ $EUID -ne 0 ]] && [[ $(whoami) != "postgres" ]]; then
        log_error "This script must be run as postgres user or root"
        exit 1
    fi

    if ! command -v pg_dump >/dev/null || ! command -v gzip >/dev/null || ! command -v gpg >/dev/null; then
        log_error "Required tools missing: pg_dump, gzip, and gpg are all required for V2"
        exit 1
    fi

    if [[ -z "${ENCRYPTION_PASSPHRASE}" ]]; then
        log_error "BACKUP_ENCRYPTION_KEY is empty — refusing unencrypted streaming backup"
        exit 1
    fi

    mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"
    touch "${LEDGER_FILE}" 2>/dev/null || true
    chmod 664 "${LEDGER_FILE}" 2>/dev/null || true

    log_success "Prerequisites check passed"
}

get_backup_type() {
    local day_of_week
    day_of_week=$(date +%u)
    if [[ "${day_of_week}" == "7" ]]; then
        echo "weekly"
    else
        echo "daily"
    fi
}

# Verify encrypted stream contains gzip'd PostgreSQL dump (header only — no full restore)
verify_backup_stream() {
    local gpg_file="$1"
    local ok=0
    local old_opts
    old_opts=$(set +o)
    set +e
    set +o pipefail

    export GNUPGHOME
    GNUPGHOME=$(mktemp -d)

    # Decrypt → gunzip → sample first bytes. head closes early (SIGPIPE OK).
    if echo "${ENCRYPTION_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 \
        --pinentry-mode loopback --quiet --decrypt "${gpg_file}" 2>/dev/null \
        | gzip -dc 2>/dev/null \
        | head -c 4096 \
        | grep -qiE 'PostgreSQL|pg_dump database dump|CREATE TABLE|DROP TABLE|SET statement_timeout'; then
        ok=1
    fi

    rm -rf "${GNUPGHOME}"
    eval "${old_opts}"

    if [[ "${ok}" -ne 1 ]]; then
        log_error "Stream verify failed — header not recognized as PostgreSQL dump"
        return 1
    fi
    log_success "Stream verification passed (PostgreSQL dump header via gpg|gunzip)"
    return 0
}

perform_backup() {
    local backup_type=$1
    local timestamp day_label backup_dir final_file inprogress_file
    timestamp=$(date '+%Y-%m-%d_%H-%M-%S')
    day_label=$(date '+%Y-%m-%d')

    if [[ "${backup_type}" == "weekly" ]]; then
        backup_dir="${WEEKLY_DIR}"
        final_file="${backup_dir}/titangold_weekly_${timestamp}.sql.gz.gpg"
    else
        backup_dir="${DAILY_DIR}"
        final_file="${backup_dir}/titangold_daily_${day_label}.sql.gz.gpg"
    fi
    inprogress_file="${final_file}.inprogress"

    log_info "Starting ${backup_type} backup (V2 stream) for database: ${DB_NAME}"
    log_info "Target file: ${final_file}"

    # Remove any leftover in-progress from a previous crash of THIS target only
    rm -f "${inprogress_file}" "${final_file}.inprogress.sha256"

    local start_time
    start_time=$(date +%s)
    local pipe_status

    # Passphrase on FD 3 so stdin of pipeline stays free for pg_dump data path via gpg --passphrase-fd 3
    # Pipeline: pg_dump → gzip → gpg → inprogress file
    set +e
    if [[ $(whoami) == "postgres" ]]; then
        # Use local Unix socket (no -h). Since S2C-20260824, TCP to postgres@127.0.0.1 requires scram password.
        pg_dump -p "${DB_PORT}" -U "${DB_USER}" \
            --format=plain --no-owner --no-privileges --clean --if-exists \
            "${DB_NAME}" 2>>"${LOG_FILE}" \
          | gzip -c \
          | gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback \
                --symmetric --cipher-algo AES256 \
                --compress-algo none \
                --output "${inprogress_file}" \
                3<<<"${ENCRYPTION_PASSPHRASE}" 2>>"${LOG_FILE}"
        pipe_status=("${PIPESTATUS[@]}")
    else
        sudo -u postgres pg_dump -p "${DB_PORT}" -U "${DB_USER}" \
            --format=plain --no-owner --no-privileges --clean --if-exists \
            "${DB_NAME}" 2>>"${LOG_FILE}" \
          | gzip -c \
          | gpg --batch --yes --passphrase-fd 3 --pinentry-mode loopback \
                --symmetric --cipher-algo AES256 \
                --compress-algo none \
                --output "${inprogress_file}" \
                3<<<"${ENCRYPTION_PASSPHRASE}" 2>>"${LOG_FILE}"
        pipe_status=("${PIPESTATUS[@]}")
    fi
    set -e

    # PIPESTATUS: [0]=pg_dump [1]=gzip [2]=gpg
    if [[ "${pipe_status[0]}" -ne 0 ]]; then
        log_error "pg_dump failed in stream (exit=${pipe_status[0]})"
        cleanup_inprogress "${final_file}"
        rm -f "${inprogress_file}"
        send_critical_alert "Backup V2 failed: pg_dump exit ${pipe_status[0]}. Partial files removed."
        return 1
    fi
    if [[ "${pipe_status[1]}" -ne 0 ]]; then
        log_error "gzip failed in stream (exit=${pipe_status[1]})"
        rm -f "${inprogress_file}"
        send_critical_alert "Backup V2 failed: gzip exit ${pipe_status[1]}. Partial files removed."
        return 1
    fi
    if [[ "${pipe_status[2]}" -ne 0 ]]; then
        log_error "gpg encrypt failed in stream (exit=${pipe_status[2]})"
        rm -f "${inprogress_file}"
        send_critical_alert "Backup V2 failed: gpg exit ${pipe_status[2]}. Partial files removed."
        return 1
    fi

    if [[ ! -f "${inprogress_file}" ]]; then
        send_critical_alert "Backup V2 failed: inprogress file missing after stream."
        return 1
    fi

    local bytes
    bytes=$(stat -c %s "${inprogress_file}")
    if [[ "${bytes}" -lt "${MIN_BACKUP_BYTES}" ]]; then
        log_error "Backup too small: ${bytes} bytes (min ${MIN_BACKUP_BYTES})"
        rm -f "${inprogress_file}"
        send_critical_alert "Backup V2 failed: output too small (${bytes} bytes). File removed."
        return 1
    fi

    log_success "Stream write completed (Size: $(du -h "${inprogress_file}" | cut -f1))"

    if ! verify_backup_stream "${inprogress_file}"; then
        rm -f "${inprogress_file}"
        send_critical_alert "Backup V2 failed: stream verification failed. Partial file removed."
        return 1
    fi

    log_info "Generating SHA256 checksum..."
    if ! sha256sum "${inprogress_file}" | awk '{print $1}' > "${inprogress_file}.sha256"; then
        rm -f "${inprogress_file}" "${inprogress_file}.sha256"
        send_critical_alert "Backup V2 failed: SHA256 generation failed. Files removed."
        return 1
    fi

    # Atomic publish
    mv -f "${inprogress_file}" "${final_file}"
    mv -f "${inprogress_file}.sha256" "${final_file}.sha256"
    chmod 644 "${final_file}" "${final_file}.sha256" 2>/dev/null || true
    chown postgres:postgres "${final_file}" "${final_file}.sha256" 2>/dev/null || true

    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))

    log_success "${backup_type^} V2 backup completed in ${duration} seconds"
    log_info "Backup location: ${final_file}"
    log_success "Backup verification passed"

    LAST_BACKUP_FILE="${final_file}"
    LAST_BACKUP_DURATION="${duration}"
    return 0
}

cleanup_old_backups() {
    log_info "Starting cleanup (retention: ${RETENTION_DAYS} days) + orphan sweep..."
    local deleted_count=0

    while IFS= read -r -d '' file; do
        rm -f "${file}"
        log_info "Deleted old daily: $(basename "${file}")"
        deleted_count=$((deleted_count + 1))
    done < <(find "${DAILY_DIR}" -type f \( -name 'titangold_daily_*.sql.gpg' -o -name 'titangold_daily_*.sql.gz.gpg' -o -name 'titangold_daily_*.sha256' \) -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

    while IFS= read -r -d '' file; do
        rm -f "${file}"
        log_info "Deleted old weekly: $(basename "${file}")"
        deleted_count=$((deleted_count + 1))
    done < <(find "${WEEKLY_DIR}" -type f \( -name 'titangold_weekly_*.sql.gpg' -o -name 'titangold_weekly_*.sql.gz.gpg' -o -name 'titangold_weekly_*.sha256' \) -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

    # Orphans / crash leftovers — never delete fresh inprogress (age < 6h)
    while IFS= read -r -d '' orphan; do
        local obase
        obase=$(basename "${orphan}")
        if [[ "${obase}" == *.inprogress ]]; then
            if [[ -n "$(find "${orphan}" -type f -mmin +360 2>/dev/null)" ]]; then
                log_warning "Removing stale inprogress: ${obase}"
                rm -f "${orphan}" "${orphan}.sha256" 2>/dev/null || true
                deleted_count=$((deleted_count + 1))
            else
                log_info "Keeping fresh inprogress: ${obase}"
            fi
            continue
        fi
        log_warning "Removing leftover: ${obase}"
        rm -f "${orphan}"
        deleted_count=$((deleted_count + 1))
    done < <(find "${BACKUP_BASE_DIR}" -type f \( -name '*.inprogress' -o -name '*.sql' ! -name '*.sql.gpg' ! -name '*.sql.gz.gpg' \) -print0 2>/dev/null)

    if [[ ${deleted_count} -eq 0 ]]; then
        log_info "No old backups to delete"
    else
        log_success "Cleaned up ${deleted_count} file(s)"
    fi
}

display_backup_stats() {
    log_info "=== Backup Statistics (V2) ==="
    local daily_count weekly_count daily_size weekly_size total_size
    daily_count=$(find "${DAILY_DIR}" -type f \( -name '*.sql.gpg' -o -name '*.sql.gz.gpg' \) 2>/dev/null | wc -l)
    weekly_count=$(find "${WEEKLY_DIR}" -type f \( -name '*.sql.gpg' -o -name '*.sql.gz.gpg' \) 2>/dev/null | wc -l)
    daily_size=$(du -sh "${DAILY_DIR}" 2>/dev/null | cut -f1)
    weekly_size=$(du -sh "${WEEKLY_DIR}" 2>/dev/null | cut -f1)
    total_size=$(du -sh "${BACKUP_BASE_DIR}" 2>/dev/null | cut -f1)
    log_info "Daily backups: ${daily_count} files (${daily_size})"
    log_info "Weekly backups: ${weekly_count} files (${weekly_size})"
    log_info "Total backup size: ${total_size}"
    log_info "========================="
}

acquire_lock_or_exit() {
    mkdir -p "$(dirname "${LOCK_FILE}")"
    # Writable by postgres (dump) and root (rotation/report flock probes)
    touch "${LOCK_FILE}" 2>/dev/null || true
    chmod 666 "${LOCK_FILE}" 2>/dev/null || true
    # FD 200 held for process lifetime
    exec 200>"${LOCK_FILE}"
    if ! flock -n 200; then
        log_warning "Another TitanGold backup is already running (lock: ${LOCK_FILE}) — skipping"
        exit 0
    fi
    printf '%s\n' "$$" 1>&200 || true
}

free_gb() {
    df -k / | awk 'NR==2 {printf "%d", $4/1024/1024}'
}

main() {
    # Ensure log file exists early (before flock message)
    touch "${LOG_FILE}" 2>/dev/null || true

    acquire_lock_or_exit

    log_info "=========================================="
    log_info "TitanGold Database Backup V2 Starting (streaming)"
    log_info "=========================================="

    check_prerequisites

    if ! check_disk_budget; then
        log_error "Backup process aborted by disk circuit breaker"
        log_info "=========================================="
        exit 1
    fi

    local backup_type
    backup_type=$(get_backup_type)
    log_info "Backup type: ${backup_type}"

    LAST_BACKUP_FILE=""
    LAST_BACKUP_DURATION=0

    local attempt=1
    local ok=0
    while [[ "${attempt}" -le "${MAX_ATTEMPTS}" ]]; do
        log_info "Backup attempt ${attempt}/${MAX_ATTEMPTS}"
        if perform_backup "${backup_type}"; then
            ok=1
            break
        fi
        if [[ "${attempt}" -ge "${MAX_ATTEMPTS}" ]]; then
            break
        fi
        local avail
        avail=$(free_gb)
        if [[ "${avail}" -lt "${MIN_FREE_GB}" ]]; then
            log_error "Skipping same-day retry — only ${avail}GB free (need ${MIN_FREE_GB}GB)"
            break
        fi
        log_warning "Same-day retry scheduled in ${RETRY_SLEEP_SEC}s (free=${avail}GB)"
        sleep "${RETRY_SLEEP_SEC}"
        if ! check_disk_budget; then
            log_error "Retry aborted by disk circuit breaker"
            break
        fi
        attempt=$((attempt + 1))
    done

    if [[ "${ok}" -eq 1 ]]; then
        log_success "Backup process completed successfully"
        if [[ -n "${LAST_BACKUP_FILE}" ]]; then
            append_ledger "${backup_type}" "${LAST_BACKUP_FILE}" "${LAST_BACKUP_DURATION}"
        fi
        cleanup_old_backups
        display_backup_stats
        log_info "=========================================="
        log_info "Backup process finished successfully"
        log_info "=========================================="
        exit 0
    else
        log_error "Backup process failed"
        log_info "=========================================="
        exit 1
    fi
}

main "$@"
