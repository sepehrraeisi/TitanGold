#!/bin/bash

echo "# TitanGold E2E Smoke Tests"
echo ""
echo "**Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "**Server**: http://localhost:5002"
echo ""
echo "---"
echo ""

# Test 1: Health Endpoint
echo "## Test 1: Health Endpoint"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/health"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/health | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/health)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "200" ]; then
  echo "**Result**: ✅ PASS"
else
  echo "**Result**: ❌ FAIL"
fi
echo ""
echo "---"
echo ""

# Test 2: Ready Endpoint (DB Check)
echo "## Test 2: Ready Endpoint (DB Check)"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/ready"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/ready | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/ready)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "200" ]; then
  echo "**Result**: ✅ PASS"
else
  echo "**Result**: ❌ FAIL"
fi
echo ""
echo "---"
echo ""

# Test 3: Artemis Logs (Protected)
echo "## Test 3: Artemis Logs (Protected Endpoint)"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/artemis/logs"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/artemis/logs | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/artemis/logs)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "401" ]; then
  echo "**Result**: ✅ PASS (Authentication required)"
else
  echo "**Result**: ❌ FAIL (Expected 401)"
fi
echo ""
echo "---"
echo ""

# Test 4: DataHub Stats (Protected)
echo "## Test 4: DataHub Stats (Protected Endpoint)"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/data-sources/stats"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/data-sources/stats | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/data-sources/stats)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "401" ]; then
  echo "**Result**: ✅ PASS (Authentication required)"
else
  echo "**Result**: ❌ FAIL (Expected 401)"
fi
echo ""
echo "---"
echo ""

# Test 5: Scenarios List (Protected)
echo "## Test 5: Scenarios List (Protected Endpoint)"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/scenarios"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/scenarios | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/scenarios)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "401" ]; then
  echo "**Result**: ✅ PASS (Authentication required)"
else
  echo "**Result**: ❌ FAIL (Expected 401)"
fi
echo ""
echo "---"
echo ""

# Test 6: Backtest Results (Protected)
echo "## Test 6: Backtest Results (Protected Endpoint)"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/backtest/results"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/backtest/results | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/backtest/results)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "401" ]; then
  echo "**Result**: ✅ PASS (Authentication required)"
else
  echo "**Result**: ❌ FAIL (Expected 401)"
fi
echo ""
echo "---"
echo ""

# Test 7: Health Status (Detailed)
echo "## Test 7: Health Status Detailed"
echo ""
echo "### Request:"
echo "\`\`\`bash"
echo "curl -s http://localhost:5002/api/health/status"
echo "\`\`\`"
echo ""
echo "### Response:"
echo "\`\`\`json"
curl -s http://localhost:5002/api/health/status | jq '.'
echo "\`\`\`"
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/health/status)
echo "**Status Code**: $STATUS"
if [ "$STATUS" = "200" ]; then
  echo "**Result**: ✅ PASS"
else
  echo "**Result**: ❌ FAIL"
fi
echo ""
echo "---"
echo ""

# Summary
echo "## Test Summary"
echo ""
TEST1=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/health)
TEST2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/ready)
TEST3=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/artemis/logs)
TEST4=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/data-sources/stats)
TEST5=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/scenarios)
TEST6=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/backtest/results)
TEST7=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/api/health/status)

PASS=0
FAIL=0

[ "$TEST1" = "200" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST2" = "200" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST3" = "401" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST4" = "401" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST5" = "401" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST6" = "401" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
[ "$TEST7" = "200" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo "| Test | Endpoint | Expected | Actual | Result |"
echo "|------|----------|----------|--------|--------|"
echo "| 1 | GET /api/health | 200 | $TEST1 | $([ "$TEST1" = "200" ] && echo "✅" || echo "❌") |"
echo "| 2 | GET /api/ready | 200 | $TEST2 | $([ "$TEST2" = "200" ] && echo "✅" || echo "❌") |"
echo "| 3 | GET /api/artemis/logs | 401 | $TEST3 | $([ "$TEST3" = "401" ] && echo "✅" || echo "❌") |"
echo "| 4 | GET /api/data-sources/stats | 401 | $TEST4 | $([ "$TEST4" = "401" ] && echo "✅" || echo "❌") |"
echo "| 5 | GET /api/scenarios | 401 | $TEST5 | $([ "$TEST5" = "401" ] && echo "✅" || echo "❌") |"
echo "| 6 | GET /api/backtest/results | 401 | $TEST6 | $([ "$TEST6" = "401" ] && echo "✅" || echo "❌") |"
echo "| 7 | GET /api/health/status | 200 | $TEST7 | $([ "$TEST7" = "200" ] && echo "✅" || echo "❌") |"
echo ""
echo "**Total**: $PASS passed, $FAIL failed out of 7 tests"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "**Overall Result**: ✅ ALL TESTS PASSED"
else
  echo "**Overall Result**: ❌ SOME TESTS FAILED"
fi
