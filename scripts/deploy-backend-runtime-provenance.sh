#!/usr/bin/env bash
#
# Assign TitanGold backend runtime provenance at deploy time.
#
# Writes a generated (untracked) manifest and restarts only titan-backend with
# TITAN_RUNTIME_COMMIT injected into the process environment.
#
# Usage:
#   ./scripts/deploy-backend-runtime-provenance.sh [<implementation-commit>]
#
# Examples:
#   ./scripts/deploy-backend-runtime-provenance.sh
#   ./scripts/deploy-backend-runtime-provenance.sh 864f95e
#
# Does NOT write a literal commit into tracked ecosystem.config.json.
# Does NOT restart titan-engine-worker / Scheduler / frontend.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$ROOT/backend}"
RUNTIME_DIR="${RUNTIME_BACKEND_DIR:-/home/ubuntu/webapp/TitanGold/backend}"
MANIFEST_NAME="runtime-provenance.json"
ENV_FILE_NAME=".runtime-provenance.env"
HEALTH_URL="${TITAN_BACKEND_HEALTH_URL:-http://127.0.0.1:5002/api/v1/health}"
INTENDED_NODE_ENV="${TITAN_NODE_ENV:-development}"
INTENDED_DEPLOY_ENV="${TITAN_DEPLOY_ENV:-staging}"

if [[ "${1:-}" != "" ]]; then
  IMPL_COMMIT="$1"
else
  IMPL_COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
fi

if ! [[ "$IMPL_COMMIT" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "ERROR: invalid implementation commit: $IMPL_COMMIT" >&2
  exit 1
fi

IMPL_COMMIT="$(echo "$IMPL_COMMIT" | tr '[:upper:]' '[:lower:]')"
DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ENVIRONMENT="$INTENDED_DEPLOY_ENV"

write_manifest() {
  local dest_dir="$1"
  mkdir -p "$dest_dir"
  cat >"$dest_dir/$MANIFEST_NAME" <<EOF
{
  "implementationCommit": "$IMPL_COMMIT",
  "deployedAt": "$DEPLOYED_AT",
  "environment": "$ENVIRONMENT",
  "sourcePath": "$dest_dir"
}
EOF
  cat >"$dest_dir/$ENV_FILE_NAME" <<EOF
TITAN_RUNTIME_COMMIT=$IMPL_COMMIT
TITAN_DEPLOY_ENV=$INTENDED_DEPLOY_ENV
NODE_ENV=$INTENDED_NODE_ENV
EOF
  chmod 0640 "$dest_dir/$ENV_FILE_NAME" || true
}

# Write into the clean source tree (for verification) and the live runtime tree.
write_manifest "$BACKEND_DIR"
if [[ "$RUNTIME_DIR" != "$BACKEND_DIR" ]]; then
  write_manifest "$RUNTIME_DIR"
fi

echo "Wrote runtime provenance manifest: implementationCommit=$IMPL_COMMIT"

# Fail-closed preflight — never inherit Jest/test shell pollution into PM2.
export NODE_ENV="$INTENDED_NODE_ENV"
export TITAN_DEPLOY_ENV="$INTENDED_DEPLOY_ENV"
export TITAN_RUNTIME_COMMIT="$IMPL_COMMIT"

echo "Running deploy environment preflight..."
RUNTIME_ENV_FILE="${RUNTIME_DIR}/.env"
export TITAN_BACKEND_ENV_FILE="$RUNTIME_ENV_FILE"
if ! node "$BACKEND_DIR/scripts/validateDeployEnvironment.js"; then
  echo "ERROR: deploy preflight failed — titan-backend was not restarted." >&2
  exit 1
fi

# Preserve Staging CORS from runtime .env — PM2 --update-env must not drop browser login origins.
CORS_FROM_ENV=""
if [[ -f "$RUNTIME_ENV_FILE" ]]; then
  CORS_FROM_ENV="$(grep -E '^CORS_ALLOWED_ORIGINS=' "$RUNTIME_ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/^["'\'' ]//; s/["'\'' ]$//' || true)"
fi

# Inject canonical Staging env into PM2 (explicit values, not ambient shell).
cd "$RUNTIME_DIR"
DEPLOY_CMD=(env NODE_ENV="$INTENDED_NODE_ENV" TITAN_DEPLOY_ENV="$INTENDED_DEPLOY_ENV" TITAN_RUNTIME_COMMIT="$IMPL_COMMIT")
if [[ -n "$CORS_FROM_ENV" ]]; then
  DEPLOY_CMD+=(CORS_ALLOWED_ORIGINS="$CORS_FROM_ENV")
fi
"${DEPLOY_CMD[@]}" pm2 restart titan-backend --update-env

pm2 save >/dev/null

echo "Restarted titan-backend with guarded environment (Scheduler untouched)."

# Post-restart health verification (allow slow cold start)
sleep 5
if ! curl -sf "$HEALTH_URL" >/dev/null; then
  sleep 3
  if ! curl -sf "$HEALTH_URL" >/dev/null; then
    echo "ERROR: backend health check failed after restart: $HEALTH_URL" >&2
    exit 1
  fi
fi

HEALTH_JSON="$(curl -sf "$HEALTH_URL")"
PROVENANCE_OK="$(echo "$HEALTH_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(d.get('provenanceVerified', False)).lower())" 2>/dev/null || echo 'false')"
RUNTIME_MARKER="$(echo "$HEALTH_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('runtimeCommit',''))" 2>/dev/null || echo '')"

if [[ "$PROVENANCE_OK" != "true" ]]; then
  echo "ERROR: provenanceVerified is not true after deploy." >&2
  exit 1
fi

if [[ -n "$RUNTIME_MARKER" && "$RUNTIME_MARKER" != "$IMPL_COMMIT" && "$RUNTIME_MARKER" != *"$IMPL_COMMIT"* ]]; then
  echo "ERROR: runtime marker ($RUNTIME_MARKER) does not match deployed commit ($IMPL_COMMIT)." >&2
  exit 1
fi

PM2_NODE_ENV="$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
procs=json.load(sys.stdin)
for p in procs:
  if p.get('name')=='titan-backend':
    env=p.get('pm2_env',{}).get('env',{})
    print(env.get('NODE_ENV',''))
    break
" 2>/dev/null || echo '')"

if [[ "$PM2_NODE_ENV" == "test" ]]; then
  echo "ERROR: PM2 titan-backend still has NODE_ENV=test after deploy." >&2
  exit 1
fi

PM2_CORS_HAS_STAGING="$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
procs=json.load(sys.stdin)
for p in procs:
  if p.get('name')=='titan-backend':
    env=p.get('pm2_env',{}).get('env',{})
    cors=str(env.get('CORS_ALLOWED_ORIGINS',''))
    deploy=str(env.get('TITAN_DEPLOY_ENV',''))
    print('yes' if ('titan.zala.ir' in cors or deploy=='staging') else 'no')
    break
else:
  print('no')
" 2>/dev/null || echo 'no')"

if [[ "$PM2_CORS_HAS_STAGING" != "yes" ]]; then
  echo "ERROR: PM2 titan-backend missing Staging browser CORS readiness." >&2
  exit 1
fi

# Post-deploy authentication readiness — CORS preflight for browser login origin.
CORS_PROBE_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$HEALTH_URL" \
  -H 'Origin: https://titan.zala.ir' \
  -H 'Access-Control-Request-Method: POST' || echo '000')"
if [[ "$CORS_PROBE_STATUS" != "200" && "$CORS_PROBE_STATUS" != "204" ]]; then
  echo "ERROR: Staging CORS preflight failed for https://titan.zala.ir (HTTP $CORS_PROBE_STATUS)." >&2
  exit 1
fi

echo "Deploy verification OK: health=pass provenanceVerified=true NODE_ENV=${PM2_NODE_ENV:-$INTENDED_NODE_ENV} auth_cors=pass"
