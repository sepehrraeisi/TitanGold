#!/bin/bash
# API Versioning Test Script
# Task: API-001
# Tests API versioning implementation

echo "🧪 Testing API Versioning (API-001)..."
echo ""

API_URL="${API_URL:-http://localhost:5002}"

echo "Test 1: Versioned endpoint returns X-API-Version header"
echo "────────────────────────────────────────────────────────"
response=$(curl -s -I "${API_URL}/api/v1/health")
if echo "$response" | grep -q "X-API-Version: 1"; then
  echo "✅ PASS: X-API-Version header present"
else
  echo "❌ FAIL: X-API-Version header missing"
fi
echo ""

echo "Test 2: Legacy endpoint redirects to versioned endpoint"
echo "────────────────────────────────────────────────────────"
response=$(curl -s -I "${API_URL}/api/health")
status=$(echo "$response" | grep "HTTP" | awk '{print $2}')
location=$(echo "$response" | grep -i "Location:" | awk '{print $2}' | tr -d '\r')

if [ "$status" = "301" ] || [ "$status" = "308" ]; then
  echo "✅ PASS: Redirect status code: $status"
else
  echo "❌ FAIL: Expected 301/308, got: $status"
fi

if echo "$location" | grep -q "/api/v1/health"; then
  echo "✅ PASS: Redirects to /api/v1/health"
else
  echo "❌ FAIL: Redirect location: $location"
fi
echo ""

echo "Test 3: Query parameters preserved in redirect"
echo "────────────────────────────────────────────────────────"
response=$(curl -s -I "${API_URL}/api/users?limit=10")
location=$(echo "$response" | grep -i "Location:" | awk '{print $2}' | tr -d '\r')

if echo "$location" | grep -q "limit=10"; then
  echo "✅ PASS: Query parameters preserved"
else
  echo "❌ FAIL: Query parameters lost in redirect"
fi
echo ""

echo "Test 4: Health endpoint remains unversioned"
echo "────────────────────────────────────────────────────────"
response=$(curl -s -I "${API_URL}/health")
status=$(echo "$response" | grep "HTTP" | awk '{print $2}')

if [ "$status" = "200" ] || [ "$status" = "503" ]; then
  echo "✅ PASS: /health endpoint works without version"
else
  echo "❌ FAIL: /health endpoint returned: $status"
fi
echo ""

echo "Test 5: API docs remain unversioned"
echo "────────────────────────────────────────────────────────"
response=$(curl -s -I "${API_URL}/api/docs")
status=$(echo "$response" | grep "HTTP" | awk '{print $2}')

if [ "$status" = "301" ]; then
  echo "❌ FAIL: /api/docs should not redirect"
else
  echo "✅ PASS: /api/docs remains unversioned (status: $status)"
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Note: These tests should pass after server restart"
echo "Current server is running old code - restart required"
echo ""
echo "To restart the server:"
echo "  1. Stop: pm2 stop titan-api (or kill processes)"
echo "  2. Start: npm start"
echo ""
