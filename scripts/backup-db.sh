#!/bin/bash

################################################################################
# TitanGold Database Backup Script
# Task: INFRA-003
# Description: Automated PostgreSQL backup with encryption and retention
################################################################################

set -euo pipefail

# Configuration
DB_NAME="titangold_db"
DB_PORT="5433"
DB_USER="postgres"
BACKUP_BASE_DIR="/var/backups/titangold"
DAILY_DIR="${BACKUP_BASE_DIR}/daily"
WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
LOG_FILE="/var/log/titangold-backup.log"
RETENTION_DAYS=30
ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-TitanGold_Backup_Key_2026}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "$@"
}

log_error() {
    log "ERROR" "${RED}$@${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$@${NC}"
}

log_warning() {
    log "WARNING" "${YELLOW}$@${NC}"
}

# Function to send alert (placeholder for future monitoring integration)
send_alert() {
    local message="$1"
    log_error "ALERT: ${message}"
    # TODO: MONITORING-004 - Integrate with monitoring service (email, Slack, PagerDuty)
    # Example: curl -X POST "https://monitoring.example.com/alert" -d "{\"message\": \"${message}\"}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if running as postgres user or root
    if [[ $EUID -ne 0 ]] && [[ $(whoami) != "postgres" ]]; then
        log_error "This script must be run as postgres user or root"
        exit 1
    fi
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Check if gpg is available for encryption
    if ! command -v gpg &> /dev/null; then
        log_warning "GPG not found. Backups will NOT be encrypted. Install gpg for encryption support."
        USE_ENCRYPTION=false
    else
        USE_ENCRYPTION=true
    fi
    
    # Check if backup directories exist
    if [[ ! -d "${DAILY_DIR}" ]] || [[ ! -d "${WEEKLY_DIR}" ]]; then
        log_error "Backup directories not found. Creating them..."
        mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"
        chown -R postgres:postgres "${BACKUP_BASE_DIR}"
    fi
    
    log_success "Prerequisites check passed"
}

# Function to determine backup type (daily or weekly)
get_backup_type() {
    local day_of_week=$(date +%u)  # 1=Monday, 7=Sunday
    
    # Weekly backup on Sunday (day 7)
    if [[ "${day_of_week}" == "7" ]]; then
        echo "weekly"
    else
        echo "daily"
    fi
}

# Function to perform database backup
perform_backup() {
    local backup_type=$1
    local timestamp=$(date '+%Y-%m-%d_%H-%M-%S')
    local day_label=$(date '+%Y-%m-%d')
    
    if [[ "${backup_type}" == "weekly" ]]; then
        local backup_dir="${WEEKLY_DIR}"
        local backup_file="${backup_dir}/titangold_weekly_${timestamp}.sql"
    else
        local backup_dir="${DAILY_DIR}"
        local backup_file="${backup_dir}/titangold_daily_${day_label}.sql"
    fi
    
    log_info "Starting ${backup_type} backup for database: ${DB_NAME}"
    log_info "Backup file: ${backup_file}"
    
    # Start timing
    local start_time=$(date +%s)
    
    # Perform pg_dump (run directly if already postgres user, otherwise use sudo)
    if [[ $(whoami) == "postgres" ]]; then
        pg_dump -h localhost -p "${DB_PORT}" -U "${DB_USER}" \
            --format=plain \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            "${DB_NAME}" > "${backup_file}" 2>> "${LOG_FILE}"
        local dump_result=$?
    else
        sudo -u postgres pg_dump -h localhost -p "${DB_PORT}" -U "${DB_USER}" \
            --format=plain \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            "${DB_NAME}" > "${backup_file}" 2>> "${LOG_FILE}"
        local dump_result=$?
    fi
    
    if [[ ${dump_result} -eq 0 ]]; then
        
        local dump_size=$(du -h "${backup_file}" | cut -f1)
        log_success "Database dump completed successfully (Size: ${dump_size})"
        
        # Encrypt the backup if GPG is available
        if [[ "${USE_ENCRYPTION}" == "true" ]]; then
            log_info "Encrypting backup..."
            
            if echo "${ENCRYPTION_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 \
                --symmetric --cipher-algo AES256 \
                --output "${backup_file}.gpg" \
                "${backup_file}" 2>> "${LOG_FILE}"; then
                
                # Remove unencrypted file
                rm -f "${backup_file}"
                backup_file="${backup_file}.gpg"
                
                local encrypted_size=$(du -h "${backup_file}" | cut -f1)
                log_success "Backup encrypted successfully (Size: ${encrypted_size})"
            else
                log_error "Encryption failed. Keeping unencrypted backup."
                send_alert "Backup encryption failed for ${DB_NAME}"
            fi
        else
            log_warning "Backup NOT encrypted (GPG not available)"
        fi
        
        # Calculate backup duration
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "${backup_type^} backup completed in ${duration} seconds"
        log_info "Backup location: ${backup_file}"
        
        # Verify backup file exists and has content
        if [[ -f "${backup_file}" ]] && [[ -s "${backup_file}" ]]; then
            log_success "Backup verification passed"
            return 0
        else
            log_error "Backup verification failed: File is empty or doesn't exist"
            send_alert "Backup verification failed for ${DB_NAME}"
            return 1
        fi
    else
        log_error "Database dump failed"
        send_alert "Database backup failed for ${DB_NAME}"
        return 1
    fi
}

# Function to cleanup old backups (30-day retention)
cleanup_old_backups() {
    log_info "Starting cleanup of old backups (retention: ${RETENTION_DAYS} days)..."
    
    local deleted_count=0
    
    # Clean up daily backups older than retention period
    if [[ -d "${DAILY_DIR}" ]]; then
        log_info "Cleaning up daily backups..."
        while IFS= read -r -d '' file; do
            rm -f "${file}"
            log_info "Deleted old daily backup: $(basename ${file})"
            ((deleted_count++))
        done < <(find "${DAILY_DIR}" -name "titangold_daily_*.sql*" -type f -mtime +${RETENTION_DAYS} -print0)
    fi
    
    # Clean up weekly backups older than retention period
    if [[ -d "${WEEKLY_DIR}" ]]; then
        log_info "Cleaning up weekly backups..."
        while IFS= read -r -d '' file; do
            rm -f "${file}"
            log_info "Deleted old weekly backup: $(basename ${file})"
            ((deleted_count++))
        done < <(find "${WEEKLY_DIR}" -name "titangold_weekly_*.sql*" -type f -mtime +${RETENTION_DAYS} -print0)
    fi
    
    if [[ ${deleted_count} -eq 0 ]]; then
        log_info "No old backups to delete"
    else
        log_success "Cleaned up ${deleted_count} old backup(s)"
    fi
}

# Function to display backup statistics
display_backup_stats() {
    log_info "=== Backup Statistics ==="
    
    # Count backups
    local daily_count=$(find "${DAILY_DIR}" -name "titangold_daily_*.sql*" -type f 2>/dev/null | wc -l)
    local weekly_count=$(find "${WEEKLY_DIR}" -name "titangold_weekly_*.sql*" -type f 2>/dev/null | wc -l)
    
    # Calculate total size
    local daily_size=$(du -sh "${DAILY_DIR}" 2>/dev/null | cut -f1)
    local weekly_size=$(du -sh "${WEEKLY_DIR}" 2>/dev/null | cut -f1)
    local total_size=$(du -sh "${BACKUP_BASE_DIR}" 2>/dev/null | cut -f1)
    
    log_info "Daily backups: ${daily_count} files (${daily_size})"
    log_info "Weekly backups: ${weekly_count} files (${weekly_size})"
    log_info "Total backup size: ${total_size}"
    log_info "========================="
}

# Main execution
main() {
    log_info "=========================================="
    log_info "TitanGold Database Backup Starting"
    log_info "=========================================="
    
    # Check prerequisites
    check_prerequisites
    
    # Determine backup type
    local backup_type=$(get_backup_type)
    log_info "Backup type: ${backup_type}"
    
    # Perform backup
    if perform_backup "${backup_type}"; then
        log_success "Backup process completed successfully"
        
        # Cleanup old backups
        cleanup_old_backups
        
        # Display statistics
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

# Run main function
main "$@"
