#!/bin/bash
# ============================================================================
# TitanGold Blue-Green Deployment Script (INFRA-010)
# ============================================================================
#
# Purpose: Zero-downtime deployment using blue-green strategy
#
# Features:
#   - Deploy to inactive environment (blue or green)
#   - Run health checks before switching traffic
#   - Atomic traffic switch via nginx/load balancer
#   - Automatic rollback on failure
#   - Deployment history tracking
#
# Usage:
#   ./blue-green-deploy.sh [options]
#   
# Options:
#   --version VERSION    Git tag/branch/commit to deploy (required)
#   --env ENV           Environment (dev/staging/prod, default: prod)
#   --skip-tests        Skip test suite execution
#   --skip-health       Skip health checks (dangerous!)
#   --force             Force deployment even if tests fail
#   --rollback          Rollback to previous version
#
# Example:
#   ./blue-green-deploy.sh --version v1.2.3 --env prod
#   ./blue-green-deploy.sh --rollback
#
# Date: 2026-01-31
# ============================================================================

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_LOG_DIR="${PROJECT_ROOT}/logs/deployments"
STATE_FILE="${SCRIPT_DIR}/.deployment-state.json"

# Default configuration
ENVIRONMENT="${DEPLOY_ENV:-prod}"
BLUE_PORT="${BLUE_PORT:-5002}"
GREEN_PORT="${GREEN_PORT:-5003}"
BLUE_DIR="${BLUE_DIR:-${PROJECT_ROOT}/blue}"
GREEN_DIR="${GREEN_DIR:-${PROJECT_ROOT}/green}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-5}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
NGINX_CONFIG="${NGINX_CONFIG:-/etc/nginx/sites-available/titangold}"

# Parse command line arguments
VERSION=""
SKIP_TESTS=false
SKIP_HEALTH=false
FORCE=false
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-health)
            SKIP_HEALTH=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# Initialize deployment log directory
init_log_dir() {
    mkdir -p "$DEPLOYMENT_LOG_DIR"
}

# Get current active environment from state file
get_active_environment() {
    if [ -f "$STATE_FILE" ]; then
        jq -r '.active' "$STATE_FILE" 2>/dev/null || echo "blue"
    else
        echo "blue"
    fi
}

# Get inactive environment
get_inactive_environment() {
    local active=$(get_active_environment)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Update state file
update_state() {
    local active=$1
    local version=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$STATE_FILE" << EOF
{
  "active": "$active",
  "version": "$version",
  "timestamp": "$timestamp",
  "blue": {
    "port": $BLUE_PORT,
    "directory": "$BLUE_DIR"
  },
  "green": {
    "port": $GREEN_PORT,
    "directory": "$GREEN_DIR"
  }
}
EOF
}

# Get port for environment
get_port() {
    local env=$1
    if [ "$env" = "blue" ]; then
        echo "$BLUE_PORT"
    else
        echo "$GREEN_PORT"
    fi
}

# Get directory for environment
get_directory() {
    local env=$1
    if [ "$env" = "blue" ]; then
        echo "$BLUE_DIR"
    else
        echo "$GREEN_DIR"
    fi
}

# Check if environment is healthy
check_health() {
    local port=$1
    local retries=$2
    local interval=$3
    
    log_info "Checking health on port $port (max $retries attempts, ${interval}s interval)..."
    
    for i in $(seq 1 $retries); do
        log_info "Health check attempt $i/$retries..."
        
        # Make health check request
        response=$(curl -s -w "\n%{http_code}" http://localhost:${port}/health 2>&1 || echo "000")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n-1)
        
        if [ "$http_code" = "200" ]; then
            # Parse response
            status=$(echo "$body" | jq -r '.status' 2>/dev/null || echo "unknown")
            db_status=$(echo "$body" | jq -r '.database' 2>/dev/null || echo "unknown")
            
            if [ "$status" = "healthy" ] && [ "$db_status" = "connected" ]; then
                log_success "Health check passed! Status: $status, Database: $db_status"
                return 0
            else
                log_warning "Health check returned 200 but status is unhealthy: $status, $db_status"
            fi
        else
            log_warning "Health check failed with HTTP $http_code"
        fi
        
        if [ $i -lt $retries ]; then
            log_info "Waiting ${interval}s before retry..."
            sleep $interval
        fi
    done
    
    log_error "Health check failed after $retries attempts"
    return 1
}

# Deploy to target environment
deploy_to_environment() {
    local target_env=$1
    local version=$2
    local target_dir=$(get_directory $target_env)
    local target_port=$(get_port $target_env)
    
    print_header "Deploying version $version to $target_env environment"
    
    # Create directory if it doesn't exist
    log_info "Preparing deployment directory: $target_dir"
    mkdir -p "$target_dir"
    
    # Clone or update repository
    if [ -d "$target_dir/.git" ]; then
        log_info "Updating existing repository..."
        cd "$target_dir"
        git fetch --all --tags
        git checkout "$version"
        git pull origin "$version" 2>/dev/null || true
    else
        log_info "Cloning repository..."
        git clone "${GIT_REPO_URL:-$PROJECT_ROOT}" "$target_dir"
        cd "$target_dir"
        git checkout "$version"
    fi
    
    # Install backend dependencies
    log_info "Installing backend dependencies..."
    cd "$target_dir/backend"
    npm ci --production
    
    # Build frontend
    log_info "Building frontend..."
    cd "$target_dir"
    npm ci
    npm run build
    
    # Run database migrations (if any)
    log_info "Running database migrations..."
    cd "$target_dir/backend"
    npm run migrate 2>/dev/null || log_warning "No migration script found"
    
    # Copy environment configuration
    log_info "Configuring environment..."
    cp "$PROJECT_ROOT/backend/.env" "$target_dir/backend/.env" || log_warning "No .env file to copy"
    
    # Update port in .env
    sed -i "s/^PORT=.*/PORT=$target_port/" "$target_dir/backend/.env"
    
    log_success "Deployment to $target_env completed"
}

# Start environment
start_environment() {
    local env=$1
    local port=$(get_port $env)
    local dir=$(get_directory $env)
    
    log_info "Starting $env environment on port $port..."
    
    # Check if already running
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "$env environment already running on port $port"
        return 0
    fi
    
    # Start using PM2 or systemd
    if command -v pm2 &> /dev/null; then
        cd "$dir/backend"
        pm2 start server.js --name "titangold-$env" -- --port $port
        pm2 save
    else
        # Fallback to systemd service
        sudo systemctl start "titangold-$env" 2>/dev/null || {
            log_warning "No PM2 or systemd service found, starting manually..."
            cd "$dir/backend"
            nohup node server.js > "$DEPLOYMENT_LOG_DIR/$env.log" 2>&1 &
            echo $! > "$dir/.pid"
        }
    fi
    
    # Wait for startup
    log_info "Waiting for $env to start (5s)..."
    sleep 5
    
    log_success "$env environment started"
}

# Stop environment
stop_environment() {
    local env=$1
    local port=$(get_port $env)
    local dir=$(get_directory $env)
    
    log_info "Stopping $env environment..."
    
    # Stop using PM2
    if command -v pm2 &> /dev/null; then
        pm2 delete "titangold-$env" 2>/dev/null || true
    fi
    
    # Stop using systemd
    sudo systemctl stop "titangold-$env" 2>/dev/null || true
    
    # Fallback: kill by port
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        kill $(lsof -t -i:$port) 2>/dev/null || true
    fi
    
    # Kill by PID file
    if [ -f "$dir/.pid" ]; then
        kill $(cat "$dir/.pid") 2>/dev/null || true
        rm "$dir/.pid"
    fi
    
    log_success "$env environment stopped"
}

# Switch traffic to target environment
switch_traffic() {
    local target_env=$1
    local target_port=$(get_port $target_env)
    
    print_header "Switching traffic to $target_env environment (port $target_port)"
    
    # Update nginx configuration
    if [ -f "$NGINX_CONFIG" ]; then
        log_info "Updating nginx configuration..."
        
        # Backup current config
        sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Update upstream server
        sudo sed -i "s/server localhost:[0-9]*;/server localhost:$target_port;/" "$NGINX_CONFIG"
        
        # Test nginx configuration
        if sudo nginx -t; then
            log_success "Nginx configuration is valid"
            
            # Reload nginx
            sudo systemctl reload nginx
            log_success "Nginx reloaded with new configuration"
        else
            log_error "Nginx configuration test failed!"
            # Restore backup
            sudo cp "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONFIG"
            return 1
        fi
    else
        log_warning "Nginx config not found at $NGINX_CONFIG, skipping traffic switch"
        log_info "Manually update your load balancer to point to port $target_port"
    fi
    
    log_success "Traffic switched to $target_env environment"
}

# Run tests
run_tests() {
    local dir=$1
    
    if [ "$SKIP_TESTS" = true ]; then
        log_warning "Skipping tests (--skip-tests flag)"
        return 0
    fi
    
    print_header "Running test suite"
    
    cd "$dir"
    
    # Backend tests
    log_info "Running backend tests..."
    cd "$dir/backend"
    if npm test -- --passWithNoTests; then
        log_success "Backend tests passed"
    else
        if [ "$FORCE" = true ]; then
            log_warning "Backend tests failed but continuing due to --force flag"
        else
            log_error "Backend tests failed! Use --force to deploy anyway"
            return 1
        fi
    fi
    
    # Frontend tests
    log_info "Running frontend tests..."
    cd "$dir"
    if npm test -- --passWithNoTests 2>/dev/null; then
        log_success "Frontend tests passed"
    else
        if [ "$FORCE" = true ]; then
            log_warning "Frontend tests failed but continuing due to --force flag"
        else
            log_error "Frontend tests failed! Use --force to deploy anyway"
            return 1
        fi
    fi
    
    log_success "All tests passed"
}

# Rollback to previous version
do_rollback() {
    print_header "Rolling back deployment"
    
    local current_active=$(get_active_environment)
    local rollback_target=""
    
    if [ "$current_active" = "blue" ]; then
        rollback_target="green"
    else
        rollback_target="blue"
    fi
    
    log_info "Current active: $current_active"
    log_info "Rolling back to: $rollback_target"
    
    # Check if rollback target is healthy
    local rollback_port=$(get_port $rollback_target)
    if ! check_health "$rollback_port" 3 5; then
        log_error "Rollback target environment is not healthy!"
        log_info "Attempting to restart $rollback_target..."
        start_environment "$rollback_target"
        
        if ! check_health "$rollback_port" 3 5; then
            log_error "Failed to start rollback target. Manual intervention required!"
            return 1
        fi
    fi
    
    # Switch traffic
    if switch_traffic "$rollback_target"; then
        update_state "$rollback_target" "previous"
        log_success "Rollback completed successfully!"
        return 0
    else
        log_error "Rollback failed!"
        return 1
    fi
}

# Main deployment flow
main_deployment() {
    local target_env=$(get_inactive_environment)
    local active_env=$(get_active_environment)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_file="$DEPLOYMENT_LOG_DIR/deploy_${timestamp}.log"
    
    print_header "TitanGold Blue-Green Deployment"
    
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Active environment: $active_env"
    log_info "Target environment: $target_env"
    log_info "Deployment log: $log_file"
    
    # Deploy to inactive environment
    if ! deploy_to_environment "$target_env" "$VERSION"; then
        log_error "Deployment failed!"
        return 1
    fi
    
    # Run tests
    local target_dir=$(get_directory $target_env)
    if ! run_tests "$target_dir"; then
        log_error "Tests failed!"
        return 1
    fi
    
    # Start the new environment
    if ! start_environment "$target_env"; then
        log_error "Failed to start $target_env environment!"
        return 1
    fi
    
    # Health checks
    if [ "$SKIP_HEALTH" = false ]; then
        local target_port=$(get_port $target_env)
        if ! check_health "$target_port" "$HEALTH_CHECK_RETRIES" "$HEALTH_CHECK_INTERVAL"; then
            log_error "Health check failed for $target_env environment!"
            log_info "Cleaning up failed deployment..."
            stop_environment "$target_env"
            return 1
        fi
    else
        log_warning "Skipping health checks (--skip-health flag)"
    fi
    
    # Switch traffic
    if ! switch_traffic "$target_env"; then
        log_error "Traffic switch failed!"
        log_info "Rolling back..."
        stop_environment "$target_env"
        return 1
    fi
    
    # Update state
    update_state "$target_env" "$VERSION"
    
    # Wait a bit before stopping old environment
    log_info "Waiting 30s for connections to drain..."
    sleep 30
    
    # Stop old environment
    log_info "Stopping old $active_env environment..."
    stop_environment "$active_env"
    
    print_header "Deployment Completed Successfully!"
    log_success "Version $VERSION is now live on $target_env environment"
    log_info "Previous $active_env environment has been stopped"
    log_info "To rollback: ./blue-green-deploy.sh --rollback"
    
    return 0
}

# ============================================================================
# Main Execution
# ============================================================================

init_log_dir

# Handle rollback
if [ "$ROLLBACK" = true ]; then
    if do_rollback; then
        exit 0
    else
        exit 1
    fi
fi

# Validate version is provided
if [ -z "$VERSION" ]; then
    log_error "Version is required! Use --version flag"
    echo ""
    echo "Usage: $0 --version VERSION [options]"
    echo ""
    echo "Options:"
    echo "  --version VERSION    Git tag/branch/commit to deploy (required)"
    echo "  --env ENV           Environment (dev/staging/prod, default: prod)"
    echo "  --skip-tests        Skip test suite execution"
    echo "  --skip-health       Skip health checks (dangerous!)"
    echo "  --force             Force deployment even if tests fail"
    echo "  --rollback          Rollback to previous version"
    echo ""
    exit 1
fi

# Run deployment
if main_deployment; then
    log_success "Deployment script completed successfully"
    exit 0
else
    log_error "Deployment script failed"
    exit 1
fi
