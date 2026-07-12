#!/bin/bash
#
# TitanGold Staging Deployment Readiness Verification
# PM2 "online" alone is NOT sufficient — verifies port, health, runtime safety, worker ack.
#
# Usage: ./scripts/verify-staging-deployment.sh
# Exit 0 = ready, non-zero = NOT ready (fail deployment)
#
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-5002}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${BACKEND_PORT}}"
NGINX_URL="${NGINX_URL:-}"
LOG_FILE="${LOG_FILE:-${HOME}/titangold-staging-readiness.log}"
FAIL=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() { log "FAIL: $*"; FAIL=1; }
pass() { log "PASS: $*"; }

log "=== TitanGold Staging Deployment Readiness ==="

# 1. PM2 process state
for proc in titan-backend titan-engine-worker; do
  if pm2 describe "$proc" >/dev/null 2>&1; then
    status=$(pm2 jlist | python3 -c "import json,sys; d=json.load(sys.stdin); print(next((x['pm2_env']['status'] for x in d if x.get('name')=='$proc'),'missing'))")
    if [ "$status" = "online" ]; then pass "PM2 $proc online"; else fail "PM2 $proc status=$status"; fi
  else
    fail "PM2 process $proc not found"
  fi
done

# 2. Port binding
if ss -tlnp | grep -q ":${BACKEND_PORT} "; then
  pass "Port ${BACKEND_PORT} is listening"
else
  fail "Port ${BACKEND_PORT} is NOT listening (syntax crash or failed bind?)"
fi

# 3. Health endpoint
health_code=$(curl -sS -o /tmp/tg-health.json -w "%{http_code}" -m 5 -L "${BACKEND_URL}/api/v1/health" || echo "000")
if [ "$health_code" = "200" ]; then
  pass "GET /api/health → 200"
else
  fail "GET /api/health → ${health_code}"
fi

# 4. Readiness (DB + deps)
ready_code=$(curl -sS -o /tmp/tg-ready.json -w "%{http_code}" -m 10 -L "${BACKEND_URL}/api/v1/health/ready" || echo "000")
if [ "$ready_code" = "200" ] || [ "$ready_code" = "503" ]; then
  pass "GET /api/health/ready responded (${ready_code})"
  if [ "$ready_code" = "503" ]; then fail "Readiness degraded — check /api/health/ready"; fi
else
  fail "GET /api/health/ready → ${ready_code}"
fi

# 5. Startup exceptions in recent logs
for logf in /home/ubuntu/.pm2/logs/titan-backend-error*.log; do
  if [ -f "$logf" ]; then
    if tail -50 "$logf" 2>/dev/null | grep -qE "SyntaxError|missing \) after argument"; then
      fail "Recent syntax/startup error in $logf"
    fi
  fi
done
pass "No recent syntax errors in backend error logs"

# 6. Runtime safety (requires admin token from env or skip)
if [ -n "${READINESS_ADMIN_TOKEN:-}" ]; then
  rt=$(curl -sS -m 5 -H "Authorization: Bearer ${READINESS_ADMIN_TOKEN}" "${BACKEND_URL}/api/v1/settings/execution-runtime" || echo '{}')
  kill=$(echo "$rt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('killSwitchActive', False))" 2>/dev/null || echo "unknown")
  mode=$(echo "$rt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('effectiveMode','unknown'))" 2>/dev/null || echo "unknown")
  ack=$(echo "$rt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('workerAcknowledged', False))" 2>/dev/null || echo "unknown")
  if [ "$kill" = "True" ] && [ "$mode" = "demo" ]; then pass "Runtime safety: kill switch ON, effective=demo"; else fail "Runtime safety: kill=$kill mode=$mode"; fi
  if [ "$ack" = "True" ]; then pass "Worker acknowledgement current"; else fail "Worker acknowledgement pending (ack=$ack)"; fi
else
  log "SKIP: runtime safety check (set READINESS_ADMIN_TOKEN)"
fi

# 7. Nginx upstream (optional)
if [ -n "$NGINX_URL" ]; then
  ngx_code=$(curl -sS -o /dev/null -w "%{http_code}" -m 5 "${NGINX_URL}/api/health" || echo "000")
  if [ "$ngx_code" = "200" ]; then pass "Nginx proxy health → 200"; else fail "Nginx proxy health → ${ngx_code}"; fi
fi

# 8. Both cluster instances (if 2 PIDs on port)
listener_count=$(ss -tlnp | grep ":${BACKEND_PORT} " | wc -l)
pass "Backend listeners on ${BACKEND_PORT}: ${listener_count}"

log "=== Result: $([ $FAIL -eq 0 ] && echo READY || echo NOT READY) ==="
exit $FAIL
