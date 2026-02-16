#!/bin/bash

# ============================================================================
# Telegram Data Pipeline Readiness Test
# Tests if system is ready to move from Phase 1 (Collection) to Phase 2 (Processing)
# ============================================================================

echo "🧪 Telegram Data Pipeline Readiness Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function
test_check() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "  ${RED}✗${NC} $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# ============================================================================
# Test 1: Telegram Collector Service Health
# ============================================================================
echo "📋 Test 1: Telegram Collector Service Health"
echo "--------------------------------------------"

# Check if service is running
pm2 list | grep -q "telegram-collector.*online"
test_check $? "Telegram Collector service is running"

# Check health endpoint
HEALTH_STATUS=$(curl -s http://127.0.0.1:3002/api/telegram-collector/health | jq -r '.status')
[ "$HEALTH_STATUS" == "healthy" ]
test_check $? "Health endpoint returns 'healthy' status"

# Check session
SESSION_IN_DB=$(curl -s http://127.0.0.1:3002/api/telegram-collector/health | jq -r '.session.in_database')
[ "$SESSION_IN_DB" == "true" ]
test_check $? "Telegram session exists in database"

echo ""

# ============================================================================
# Test 2: Database Tables Existence
# ============================================================================
echo "📋 Test 2: Database Tables Existence"
echo "------------------------------------"

# Check telegram_messages table
psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='telegram_messages'" | grep -q "1"
test_check $? "telegram_messages table exists"

# Check telegram_channels table
psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='telegram_channels'" | grep -q "1"
test_check $? "telegram_channels table exists"

# Check telegram_accounts table
psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='telegram_accounts'" | grep -q "1"
test_check $? "telegram_accounts table exists"

echo ""

# ============================================================================
# Test 3: Data Collection Metrics
# ============================================================================
echo "📋 Test 3: Data Collection Metrics"
echo "-----------------------------------"

# Check message count
MESSAGE_COUNT=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages")
[ "$MESSAGE_COUNT" -gt 0 ]
test_check $? "Messages collected (count: $MESSAGE_COUNT)"

# Check active channels
ACTIVE_CHANNELS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE is_active = true")
[ "$ACTIVE_CHANNELS" -gt 0 ]
test_check $? "Active channels configured (count: $ACTIVE_CHANNELS)"

# Check recent messages (last hour)
RECENT_MESSAGES=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages WHERE telegram_created_at > NOW() - INTERVAL '1 hour'")
[ "$RECENT_MESSAGES" -gt 0 ]
test_check $? "Recent messages received (last hour: $RECENT_MESSAGES)"

# Check synced channels
SYNCED_CHANNELS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE last_synced_at IS NOT NULL AND is_active = true")
[ "$SYNCED_CHANNELS" -gt 0 ]
test_check $? "Channels successfully synced (count: $SYNCED_CHANNELS)"

echo ""

# ============================================================================
# Test 4: Priority System
# ============================================================================
echo "📋 Test 4: Priority System"
echo "--------------------------"

# Check HIGH priority channels exist
HIGH_PRIORITY=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE priority = 'high' AND is_active = true")
[ "$HIGH_PRIORITY" -gt 0 ]
test_check $? "HIGH priority channels configured (count: $HIGH_PRIORITY)"

# Check NORMAL priority channels
NORMAL_PRIORITY=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE priority = 'normal' AND is_active = true")
[ "$NORMAL_PRIORITY" -gt 0 ]
test_check $? "NORMAL priority channels configured (count: $NORMAL_PRIORITY)"

# Verify priority-based polling is working (check last_synced_at)
HIGH_RECENTLY_SYNCED=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE priority = 'high' AND is_active = true AND last_synced_at > NOW() - INTERVAL '2 minutes'")
[ "$HIGH_RECENTLY_SYNCED" -gt 0 ]
test_check $? "HIGH priority channels synced recently (count: $HIGH_RECENTLY_SYNCED)"

echo ""

# ============================================================================
# Test 5: Data Quality
# ============================================================================
echo "📋 Test 5: Data Quality"
echo "-----------------------"

# Check for NULL message_text
NULL_TEXT=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages WHERE message_text IS NULL OR message_text = ''")
[ "$NULL_TEXT" -eq 0 ]
test_check $? "No messages with NULL/empty text"

# Check for proper timestamps
INVALID_TIMESTAMPS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages WHERE telegram_created_at IS NULL")
[ "$INVALID_TIMESTAMPS" -eq 0 ]
test_check $? "All messages have valid timestamps"

# Check timestamp format (should be TIMESTAMP, not Unix timestamp)
FUTURE_TIMESTAMPS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages WHERE telegram_created_at > NOW()")
[ "$FUTURE_TIMESTAMPS" -eq 0 ]
test_check $? "No messages with future timestamps"

echo ""

# ============================================================================
# Test 6: Monitoring & Error Tracking
# ============================================================================
echo "📋 Test 6: Monitoring & Error Tracking"
echo "---------------------------------------"

# Check monitoring service
pm2 list | grep -q "telegram-collector-monitor.*online"
test_check $? "Monitoring service is running"

# Check error counts
ERROR_CHANNELS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_channels WHERE error_count > 0 AND is_active = true")
[ "$ERROR_CHANNELS" -lt 5 ]
test_check $? "Low error rate (channels with errors: $ERROR_CHANNELS)"

echo ""

# ============================================================================
# Test 7: API Endpoints
# ============================================================================
echo "📋 Test 7: API Endpoints"
echo "------------------------"

# Health endpoint
curl -s http://127.0.0.1:3002/api/telegram-collector/health | jq -e '.status' > /dev/null 2>&1
test_check $? "Health endpoint responding"

# Channels endpoint
curl -s http://127.0.0.1:3002/api/telegram-collector/collector-channels | jq -e '.success' > /dev/null 2>&1
test_check $? "Channels endpoint responding"

echo ""

# ============================================================================
# Test 8: Pipeline Readiness
# ============================================================================
echo "📋 Test 8: Data Pipeline Readiness"
echo "-----------------------------------"

# Check if we have enough messages for processing
ENOUGH_MESSAGES=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages")
[ "$ENOUGH_MESSAGES" -gt 100 ]
test_check $? "Sufficient messages for pipeline testing (count: $ENOUGH_MESSAGES)"

# Check message diversity (different channels)
DIVERSE_CHANNELS=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(DISTINCT channel_id) FROM telegram_messages")
[ "$DIVERSE_CHANNELS" -gt 5 ]
test_check $? "Messages from diverse channels (channels: $DIVERSE_CHANNELS)"

# Check recent data flow
RECENT_FLOW=$(psql -U postgres -d titangold_db -h localhost -p 5433 -tAc "SELECT COUNT(*) FROM telegram_messages WHERE telegram_created_at > NOW() - INTERVAL '30 minutes'")
[ "$RECENT_FLOW" -gt 0 ]
test_check $? "Active data flow (last 30 min: $RECENT_FLOW messages)"

echo ""

# ============================================================================
# Final Summary
# ============================================================================
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
echo ""

# Calculate pass rate
PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

if [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ READY FOR DATA PIPELINE (Pass Rate: ${PASS_RATE}%)${NC}"
    echo ""
    echo "🎯 Next Steps:"
    echo "  1. Create Message Processor Service"
    echo "  2. Setup Database Tables (processed_telegram_messages, price_movements, etc.)"
    echo "  3. Implement Price Extraction"
    echo "  4. Add Sentiment Analysis"
    echo "  5. Setup PM2 Automation"
    echo ""
    echo "📚 See: DATA_PIPELINE_ROADMAP.md for detailed implementation plan"
    exit 0
elif [ $PASS_RATE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  PARTIALLY READY (Pass Rate: ${PASS_RATE}%)${NC}"
    echo ""
    echo "⚠️  Some issues need attention before starting Data Pipeline"
    exit 1
else
    echo -e "${RED}❌ NOT READY (Pass Rate: ${PASS_RATE}%)${NC}"
    echo ""
    echo "❌ Critical issues detected. Fix Telegram Collector first."
    exit 2
fi
