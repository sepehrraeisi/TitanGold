#!/bin/bash
# ============================================================================
# Archive Old Decisions Script
# Task: DATABASE-003
# Date: 2026-01-07
# Purpose: Monthly cron job to archive old ai_decisions (>90 days)
# ============================================================================
#
# Usage:
#   ./archive-old-decisions.sh                 # Archive decisions >90 days
#   ARCHIVE_DAYS_OLD=120 ./archive-old-decisions.sh  # Custom threshold
#
# Cron setup (monthly on 1st at 2 AM):
#   0 2 1 * * /path/to/archive-old-decisions.sh
#
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ============================================================================
# Configuration
# ============================================================================

DAYS_OLD="${ARCHIVE_DAYS_OLD:-90}"
LOG_DIR="${ARCHIVE_LOG_DIR:-/var/log/titangold}"
LOG_FILE="${LOG_DIR}/archive-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="${ARCHIVE_LOCK_FILE:-/var/run/titangold-archive.lock}"

# Database connection from environment or .env file
if [ -z "${DATABASE_URL:-}" ]; then
    # Try to load from .env file
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="${SCRIPT_DIR}/../.env"
    
    if [ -f "$ENV_FILE" ]; then
        # Source .env and construct DATABASE_URL
        set -a
        source "$ENV_FILE"
        set +a
        
        if [ -n "${DB_HOST:-}" ]; then
            DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        fi
    fi
fi

# Verify DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not set. Set it via environment or .env file."
    exit 1
fi

# ============================================================================
# Functions
# ============================================================================

# Ensure log directory exists
ensure_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR" 2>/dev/null || {
            # If can't create system log dir, use temp
            LOG_DIR="/tmp/titangold-logs"
            mkdir -p "$LOG_DIR"
            LOG_FILE="${LOG_DIR}/archive-$(date +%Y%m%d-%H%M%S).log"
        }
    fi
}

# Log message to file and stdout
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Check for lock file (prevent concurrent runs)
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
        log "ERROR: Archive job already running (PID: $pid, lock: $LOCK_FILE)"
        exit 1
    fi
}

# Create lock file
create_lock() {
    echo $$ > "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT INT TERM
}

# Run archival SQL function
run_archival() {
    log "Executing: archive_old_decisions($DAYS_OLD)"
    
    local result
    result=$(psql "$DATABASE_URL" -t -c "SELECT * FROM archive_old_decisions($DAYS_OLD);" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log "Archival SQL executed successfully"
        log "Result: $result"
        return 0
    else
        log "ERROR: Archival SQL failed (exit code: $exit_code)"
        log "Output: $result"
        return 1
    fi
}

# Check archive health after run
check_health() {
    log "Checking archive health..."
    
    local health
    health=$(psql "$DATABASE_URL" -t -c "SELECT status FROM check_archive_health();" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log "Health check: $health"
        return 0
    else
        log "WARNING: Health check failed"
        log "Output: $health"
        return 1
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    ensure_log_dir
    
    log "========================================="
    log "TitanGold Archive Job Starting"
    log "========================================="
    log "Days threshold: $DAYS_OLD"
    log "Log file: $LOG_FILE"
    log "Lock file: $LOCK_FILE"
    log ""
    
    check_lock
    create_lock
    
    log "🔒 Lock acquired (PID: $$)"
    log ""
    
    # Run archival
    if run_archival; then
        log ""
        log "✅ Archival completed successfully"
        
        # Check health
        check_health
        
        log ""
        log "========================================="
        log "Archive Job Completed Successfully"
        log "========================================="
        exit 0
    else
        log ""
        log "❌ Archival failed"
        log "========================================="
        log "Archive Job Failed"
        log "========================================="
        exit 1
    fi
}

# Run main function
main "$@"
