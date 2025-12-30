#!/bin/bash

echo "=== Monitoring Endpoints Test ==="

# 1. Health (no auth)
echo -e "\n1️⃣ GET /api/monitoring/health (public)"
curl -s "https://titan.zala.ir/api/monitoring/health" | jq '.'

# 2. Login
echo -e "\n2️⃣ Login as admin"
TOKEN=$(curl -s "https://titan.zala.ir/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Token received"

# 3. Summary (1h)
echo -e "\n3️⃣ GET /api/monitoring/summary?window=1h"
curl -s "https://titan.zala.ir/api/monitoring/summary?window=1h" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. Summary (24h)
echo -e "\n4️⃣ GET /api/monitoring/summary?window=24h"
curl -s "https://titan.zala.ir/api/monitoring/summary?window=24h" \
  -H "Authorization: Bearer $TOKEN" | jq '{success, window, requests, errors, avgLatencyMs, p95LatencyMs}'

# 5. Errors
echo -e "\n5️⃣ GET /api/monitoring/errors?limit=5"
curl -s "https://titan.zala.ir/api/monitoring/errors?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.errors | length'

# 6. Requests log
echo -e "\n6️⃣ GET /api/monitoring/requests?limit=5"
curl -s "https://titan.zala.ir/api/monitoring/requests?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.requests | length'

echo -e "\n✅ All monitoring endpoints tested"
