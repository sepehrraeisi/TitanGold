#!/bin/bash
# ============================================================================
# TitanGold Backend Health Check Script (INFRA-009)
# ============================================================================
#
# Purpose: Monitor backend instance health for load balancer
#
# Usage:
#   ./health-check.sh <backend_url>
#   ./health-check.sh http://localhost:5002
#
# Exit codes:
#   0 - Backend is healthy
#   1 - Backend is unhealthy
#
# Date: 2026-01-31
# ============================================================================

set -e

# Configuration
BACKEND_URL="${1:-http://localhost:5002}"
HEALTH_ENDPOINT="/health"
TIMEOUT=5
MAX_RETRIES=3
RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check health
check_health() {
    local url="$1"
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Checking health of ${url}${HEALTH_ENDPOINT} (attempt $((retry_count + 1))/${MAX_RETRIES})"
        
        # Make HTTP request
        response=$(curl -s -w "\n%{http_code}" --connect-timeout $TIMEOUT "${url}${HEALTH_ENDPOINT}" 2>&1)
        
        # Extract HTTP status code (last line)
        http_code=$(echo "$response" | tail -n1)
        
        # Extract response body (all but last line)
        body=$(echo "$response" | head -n-1)
        
        # Check if request succeeded
        if [ "$http_code" -eq 200 ]; then
            # Parse JSON response
            status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            db_status=$(echo "$body" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
            
            if [ "$status" = "healthy" ] && [ "$db_status" = "connected" ]; then
                echo -e "${GREEN}✓ Backend is healthy${NC}"
                echo "  Status: $status"
                echo "  Database: $db_status"
                return 0
            else
                echo -e "${YELLOW}⚠ Backend status: $status, Database: $db_status${NC}"
            fi
        else
            echo -e "${RED}✗ Health check failed with HTTP $http_code${NC}"
        fi
        
        retry_count=$((retry_count + 1))
        
        if [ $retry_count -lt $MAX_RETRIES ]; then
            echo "  Retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    echo -e "${RED}✗ Backend is unhealthy after ${MAX_RETRIES} attempts${NC}"
    return 1
}

# Main
echo "========================================"
echo "TitanGold Backend Health Check"
echo "========================================"
echo ""

if check_health "$BACKEND_URL"; then
    echo ""
    echo -e "${GREEN}Health check passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}Health check failed!${NC}"
    exit 1
fi
