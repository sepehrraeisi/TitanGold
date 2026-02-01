#!/bin/bash

echo "=== Testing Real Request Logging ==="

# 1. Check current state (should be 0)
echo -e "\n1️⃣ Initial state (should be 0)"
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')
echo "✅ Token received"

curl -s "https://titan.zala.ir/api/monitoring/summary?window=1h" \
  -H "Authorization: Bearer $TOKEN" | jq '{requests, errors}'

# 2. Make some real API calls
echo -e "\n2️⃣ Making real API calls..."

# Call 1: Get security config
curl -s "https://titan.zala.ir/api/config/security" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/security"

# Call 2: Get artemis config
curl -s "https://titan.zala.ir/api/config/artemis" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/artemis"

# Call 3: Get integrations
curl -s "https://titan.zala.ir/api/config/integrations" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/config/integrations"

# Call 4: Invalid endpoint (should create error log)
curl -s "https://titan.zala.ir/api/invalid/endpoint" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Called /api/invalid/endpoint (404)"

# 3. Wait for logs to be written
echo -e "\n3️⃣ Waiting for logs to be written..."
sleep 2

# 4. Check new state
echo -e "\n4️⃣ New state (should have increased)"
curl -s "https://titan.zala.ir/api/monitoring/summary?window=1h" \
  -H "Authorization: Bearer $TOKEN" | jq '{requests, errors, avgLatencyMs}'

# 5. Check error logs
echo -e "\n5️⃣ Recent error logs"
curl -s "https://titan.zala.ir/api/monitoring/errors?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.errors | length'

echo -e "\n✅ Real logging test complete!"
