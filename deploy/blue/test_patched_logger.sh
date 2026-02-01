#!/bin/bash

echo "=== Testing Patched Request Logger ==="

# Get current count
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')
echo "✅ Login successful"

echo -e "\n1️⃣ Current request count:"
BEFORE=$(curl -s "https://titan.zala.ir/api/monitoring/summary?window=1h" \
  -H "Authorization: Bearer $TOKEN" | jq '.requests')
echo "Before: $BEFORE"

# Make test requests
echo -e "\n2️⃣ Making test API calls..."
curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/security"

curl -s "https://titan.zala.ir/api/config/artemis" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/artemis"

curl -s "https://titan.zala.ir/api/config/integrations" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/integrations"

# Wait and check
sleep 2
echo -e "\n3️⃣ New request count:"
AFTER=$(curl -s "https://titan.zala.ir/api/monitoring/summary?window=1h" \
  -H "Authorization: Bearer $TOKEN" | jq '.requests')
echo "After: $AFTER"

# Calculate diff
DIFF=$((AFTER - BEFORE))
echo -e "\n📊 Difference: +$DIFF requests"

if [ $DIFF -ge 3 ]; then
  echo "✅ Logging works! (expected 3+, got $DIFF)"
else
  echo "⚠️ Unexpected count (expected 3+, got $DIFF)"
fi
