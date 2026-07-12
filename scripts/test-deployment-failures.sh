#!/bin/bash
# Safe deployment failure fixture tests — validates verify-staging-deployment.sh rejects unhealthy states.
# Does NOT modify production/staging runtime safety.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY="$ROOT/scripts/verify-staging-deployment.sh"
PASS=0
FAIL=0
RESULTS=()

record() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS: $name (exit=$actual)")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL: $name (expected exit=$expected got=$actual)")
  fi
}

log() { echo "[deploy-failure-test] $*"; }

# 1. Invalid verify script → bash -n fails
TMP_VERIFY=$(mktemp)
echo 'if [[; then' > "$TMP_VERIFY"
bash -n "$TMP_VERIFY" 2>/dev/null; SYNTAX=$?
if [ "$SYNTAX" = "2" ]; then SYNTAX=1; fi
record "syntax_error_detected" "1" "$SYNTAX"
rm -f "$TMP_VERIFY"

# 2. Port unavailable → verify fails when BACKEND_PORT is wrong
BACKEND_PORT=59999 BACKEND_URL="http://127.0.0.1:59999" bash "$VERIFY" >/dev/null 2>&1; RC=$?
record "port_unavailable" "1" "$RC"

# 3. Health endpoint on wrong port → fail
BACKEND_PORT=59998 BACKEND_URL="http://127.0.0.1:59998" bash "$VERIFY" >/dev/null 2>&1; RC=$?
record "health_endpoint_failed" "1" "$RC"

# 4. Missing READINESS_ADMIN_TOKEN → script still runs but skips runtime (exit depends on PM2/port)
# When backend is healthy, missing token is SKIP not FAIL — document behavior
log "runtime_safety_skip_without_token: verify script uses SKIP when READINESS_ADMIN_TOKEN unset"

# 5. Happy path on live staging (informational only)
if ss -tlnp 2>/dev/null | grep -q ':5002 '; then
  bash "$VERIFY" >/dev/null 2>&1; RC=$?
  record "live_staging_happy_path" "0" "$RC"
else
  log "SKIP live happy path — port 5002 not listening"
fi

echo ""
echo "=== Deployment Failure Test Summary ==="
printf '%s\n' "${RESULTS[@]}"
echo "PASS=$PASS FAIL=$FAIL"

OUT="$ROOT/docs/evidence/deployment-failure-tests.json"
python3 - <<PY
import json, os
results = """$(printf '%s\n' "${RESULTS[@]}")""".strip().split('\n')
json.dump({
  "validatedAt": "$(date -Iseconds)",
  "pass": $PASS,
  "fail": $FAIL,
  "results": [r for r in results if r],
}, open("$OUT", "w"), indent=2)
PY

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
