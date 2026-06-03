#!/bin/bash

################################################################################
# TitanGold Database Restore Script
# Task: INFRA-003
# Description: Restore PostgreSQL database from encrypted backup
################################################################################

set -euo pipefail

# Configuration
DB_NAME="titangold_db"
DB_PORT="5433"
DB_USER="postgres"
BACKUP_BASE_DIR="/var/backups/titangold"
LOG_FILE="/var/log/titangold-restore.log"
ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    log "INFO" "${BLUE}$@${NC}"
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

# Function to display usage
usage() {
    cat << EOF
${GREEN}TitanGold Database Restore Script${NC}

Usage: $0 [OPTIONS]

Options:
    -f, --file PATH         Path to backup file (required)
    -t, --type TYPE         Backup type: daily or weekly (optional, auto-detect)
    -d, --date DATE         Date of backup in YYYY-MM-DD format (for auto-selection)
    -l, --list              List available backups
    -y, --yes               Skip confirmation prompt
    -h, --help              Display this help message

Examples:
    # Restore from specific file
    $0 --file /var/backups/titangold/daily/titangold_daily_2026-01-06.sql.gpg
    
    # Restore from date (auto-select daily backup)
    $0 --date 2026-01-06
    
    # List available backups
    $0 --list
    
    # Restore with auto-confirmation
    $0 --file /path/to/backup.sql.gpg --yes

EOF
    exit 0
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if running as postgres user or root
    if [[ $EUID -ne 0 ]] && [[ $(whoami) != "postgres" ]]; then
        log_error "This script must be run as postgres user or root"
        exit 1
    fi
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        log_error "psql not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to list available backups
list_backups() {
    log_info "=== Available Backups ==="
    
    echo ""
    echo -e "${YELLOW}Daily Backups:${NC}"
    if [[ -d "${BACKUP_BASE_DIR}/daily" ]]; then
        find "${BACKUP_BASE_DIR}/daily" -name "titangold_daily_*.sql*" -type f -exec stat -c '%Y %n' {} \; | sort -rn | head -20 | while read timestamp file; do
            local size=$(du -h "${file}" | cut -f1)
            local date=$(date -d "@${timestamp}" '+%Y-%m-%d %H:%M:%S')
            echo "  $(basename ${file}) - ${size} - ${date}"
        done
    else
        echo "  No daily backups found"
    fi
    
    echo ""
    echo -e "${YELLOW}Weekly Backups:${NC}"
    if [[ -d "${BACKUP_BASE_DIR}/weekly" ]]; then
        find "${BACKUP_BASE_DIR}/weekly" -name "titangold_weekly_*.sql*" -type f -exec stat -c '%Y %n' {} \; | sort -rn | head -10 | while read timestamp file; do
            local size=$(du -h "${file}" | cut -f1)
            local date=$(date -d "@${timestamp}" '+%Y-%m-%d %H:%M:%S')
            echo "  $(basename ${file}) - ${size} - ${date}"
        done
    else
        echo "  No weekly backups found"
    fi
    
    echo ""
    log_info "========================="
}

# Function to find backup by date
find_backup_by_date() {
    local date=$1
    local backup_file=""
    
    # Try daily backup first
    local daily_unencrypted="${BACKUP_BASE_DIR}/daily/titangold_daily_${date}.sql"
    local daily_encrypted="${BACKUP_BASE_DIR}/daily/titangold_daily_${date}.sql.gpg"
    
    if [[ -f "${daily_encrypted}" ]]; then
        backup_file="${daily_encrypted}"
    elif [[ -f "${daily_unencrypted}" ]]; then
        backup_file="${daily_unencrypted}"
    else
        # Try weekly backup
        local weekly_pattern="${BACKUP_BASE_DIR}/weekly/titangold_weekly_${date}_*.sql*"
        backup_file=$(find "${BACKUP_BASE_DIR}/weekly" -name "titangold_weekly_${date}_*.sql*" -type f | head -1)
    fi
    
    if [[ -z "${backup_file}" ]] || [[ ! -f "${backup_file}" ]]; then
        log_error "No backup found for date: ${date}"
        return 1
    fi
    
    echo "${backup_file}"
    return 0
}

# Function to decrypt backup if needed
decrypt_backup() {
    local backup_file=$1
    local decrypted_file="${backup_file%.gpg}"
    
    # Check if file is encrypted
    if [[ "${backup_file}" == *.gpg ]]; then
        log_info "Decrypting backup file..."
        
        if ! command -v gpg &> /dev/null; then
            log_error "GPG not found. Cannot decrypt backup."
            exit 1
        fi
        
        if echo "${ENCRYPTION_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 \
            --decrypt --output "${decrypted_file}" \
            "${backup_file}" 2>> "${LOG_FILE}"; then
            
            log_success "Backup decrypted successfully"
            echo "${decrypted_file}"
            return 0
        else
            log_error "Failed to decrypt backup. Check passphrase."
            exit 1
        fi
    else
        # File is not encrypted
        echo "${backup_file}"
        return 0
    fi
}

# Function to verify database connection
verify_connection() {
    log_info "Verifying database connection..."
    
    if [[ $(whoami) == "postgres" ]]; then
        psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" > /dev/null 2>&1
        local result=$?
    else
        sudo -u postgres psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" > /dev/null 2>&1
        local result=$?
    fi
    
    if [[ ${result} -eq 0 ]]; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Cannot connect to database"
        return 1
    fi
}

# Function to backup current database before restore
backup_before_restore() {
    log_warning "Creating safety backup of current database before restore..."
    
    local safety_backup="/tmp/titangold_pre_restore_$(date +%Y%m%d_%H%M%S).sql"
    
    if [[ $(whoami) == "postgres" ]]; then
        pg_dump -h localhost -p "${DB_PORT}" -U "${DB_USER}" --format=plain "${DB_NAME}" > "${safety_backup}" 2>> "${LOG_FILE}"
        local result=$?
    else
        sudo -u postgres pg_dump -h localhost -p "${DB_PORT}" -U "${DB_USER}" --format=plain "${DB_NAME}" > "${safety_backup}" 2>> "${LOG_FILE}"
        local result=$?
    fi
    
    if [[ ${result} -eq 0 ]]; then
        log_success "Safety backup created: ${safety_backup}"
        log_warning "Keep this file until you verify the restore was successful"
        return 0
    else
        log_error "Failed to create safety backup"
        return 1
    fi
}

# Function to stop dependent services
stop_services() {
    log_warning "Stopping TitanGold services..."
    
    # Stop backend services
    if command -v pm2 &> /dev/null; then
        pm2 stop titan-backend 2>/dev/null || true
        pm2 stop titan-engine-worker 2>/dev/null || true
        log_info "PM2 services stopped"
    fi
    
    # Give services time to shut down
    sleep 3
    
    log_success "Services stopped"
}

# Function to start dependent services
start_services() {
    log_info "Starting TitanGold services..."
    
    if command -v pm2 &> /dev/null; then
        pm2 start titan-backend 2>/dev/null || true
        pm2 start titan-engine-worker 2>/dev/null || true
        log_info "PM2 services started"
    fi
    
    # Give services time to start
    sleep 3
    
    log_success "Services started"
}

# Function to terminate database connections
terminate_connections() {
    log_warning "Terminating active database connections..."
    
    if [[ $(whoami) == "postgres" ]]; then
        psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d postgres << EOF > /dev/null 2>&1
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();
EOF
    else
        sudo -u postgres psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d postgres << EOF > /dev/null 2>&1
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();
EOF
    fi
    
    log_success "Connections terminated"
}

# Function to restore database
restore_database() {
    local restore_file=$1
    
    log_info "Starting database restore from: ${restore_file}"
    
    # Verify file exists
    if [[ ! -f "${restore_file}" ]]; then
        log_error "Restore file not found: ${restore_file}"
        exit 1
    fi
    
    # Verify file has content
    if [[ ! -s "${restore_file}" ]]; then
        log_error "Restore file is empty: ${restore_file}"
        exit 1
    fi
    
    local file_size=$(du -h "${restore_file}" | cut -f1)
    log_info "Restore file size: ${file_size}"
    
    # Start timing
    local start_time=$(date +%s)
    
    # Perform restore
    log_info "Restoring database (this may take several minutes)..."
    
    if [[ $(whoami) == "postgres" ]]; then
        psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${restore_file}" > /dev/null 2>> "${LOG_FILE}"
        local result=$?
    else
        sudo -u postgres psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${restore_file}" > /dev/null 2>> "${LOG_FILE}"
        local result=$?
    fi
    
    if [[ ${result} -eq 0 ]]; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Database restore completed in ${duration} seconds"
        return 0
    else
        log_error "Database restore failed. Check log: ${LOG_FILE}"
        return 1
    fi
}

# Function to verify restore
verify_restore() {
    log_info "Verifying database restore..."
    
    # Check if database exists and is accessible
    if [[ $(whoami) == "postgres" ]]; then
        psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1
        local result=$?
    else
        sudo -u postgres psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1
        local result=$?
    fi
    
    if [[ ${result} -eq 0 ]]; then
        log_success "Database restore verification passed"
        return 0
    else
        log_warning "Could not verify all tables. Manual verification recommended."
        return 0
    fi
}

# Function to confirm restore action
confirm_restore() {
    local backup_file=$1
    
    echo ""
    log_warning "=========================================="
    log_warning "DATABASE RESTORE CONFIRMATION"
    log_warning "=========================================="
    log_warning "You are about to restore the database from:"
    log_warning "  ${backup_file}"
    log_warning ""
    log_warning "This will:"
    log_warning "  1. Stop all TitanGold services"
    log_warning "  2. Create a safety backup of current database"
    log_warning "  3. REPLACE all current database data"
    log_warning "  4. Restart TitanGold services"
    log_warning ""
    log_warning "This action CANNOT be undone!"
    log_warning "=========================================="
    echo ""
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [[ "${confirmation}" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
}

# Main execution
main() {
    local backup_file=""
    local backup_date=""
    local skip_confirmation=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                backup_file="$2"
                shift 2
                ;;
            -d|--date)
                backup_date="$2"
                shift 2
                ;;
            -l|--list)
                list_backups
                exit 0
                ;;
            -y|--yes)
                skip_confirmation=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    
    # Find backup file if date is provided
    if [[ -n "${backup_date}" ]] && [[ -z "${backup_file}" ]]; then
        backup_file=$(find_backup_by_date "${backup_date}")
        if [[ $? -ne 0 ]]; then
            log_error "Could not find backup for date: ${backup_date}"
            list_backups
            exit 1
        fi
        log_info "Found backup: ${backup_file}"
    fi
    
    # Validate backup file
    if [[ -z "${backup_file}" ]]; then
        log_error "No backup file specified"
        usage
    fi
    
    if [[ ! -f "${backup_file}" ]]; then
        log_error "Backup file not found: ${backup_file}"
        list_backups
        exit 1
    fi
    
    log_info "=========================================="
    log_info "TitanGold Database Restore Starting"
    log_info "=========================================="
    
    # Confirm restore action
    if [[ "${skip_confirmation}" != "true" ]]; then
        confirm_restore "${backup_file}"
    fi
    
    # Verify connection
    if ! verify_connection; then
        exit 1
    fi
    
    # Decrypt backup if needed
    local decrypted_file=$(decrypt_backup "${backup_file}")
    local cleanup_decrypted=false
    
    if [[ "${decrypted_file}" != "${backup_file}" ]]; then
        cleanup_decrypted=true
    fi
    
    # Stop services
    stop_services
    
    # Create safety backup
    if ! backup_before_restore; then
        log_error "Failed to create safety backup. Aborting restore."
        start_services
        exit 1
    fi
    
    # Terminate connections
    terminate_connections
    
    # Restore database
    if restore_database "${decrypted_file}"; then
        # Verify restore
        verify_restore
        
        # Cleanup decrypted file if it was created
        if [[ "${cleanup_decrypted}" == "true" ]]; then
            rm -f "${decrypted_file}"
            log_info "Cleaned up decrypted temporary file"
        fi
        
        # Start services
        start_services
        
        log_success "=========================================="
        log_success "Database restore completed successfully!"
        log_success "=========================================="
        log_info "Please verify your application is working correctly"
        exit 0
    else
        log_error "Database restore failed"
        
        # Cleanup decrypted file
        if [[ "${cleanup_decrypted}" == "true" ]]; then
            rm -f "${decrypted_file}"
        fi
        
        # Start services
        start_services
        
        log_error "=========================================="
        log_error "Restore process failed. Check logs."
        log_error "=========================================="
        exit 1
    fi
}

# Run main function
main "$@"
