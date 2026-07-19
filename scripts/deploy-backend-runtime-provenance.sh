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
ENVIRONMENT="${TITAN_DEPLOY_ENV:-staging}"

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
EOF
  chmod 0640 "$dest_dir/$ENV_FILE_NAME" || true
}

# Write into the clean source tree (for verification) and the live runtime tree.
write_manifest "$BACKEND_DIR"
if [[ "$RUNTIME_DIR" != "$BACKEND_DIR" ]]; then
  write_manifest "$RUNTIME_DIR"
fi

echo "Wrote runtime provenance manifest: implementationCommit=$IMPL_COMMIT"

# Inject into PM2 process env without tracking a hash in ecosystem.config.json.
export TITAN_RUNTIME_COMMIT="$IMPL_COMMIT"
cd "$RUNTIME_DIR"
pm2 restart titan-backend --update-env
# Persist PM2 process list (env lives in PM2 dump, not in tracked ecosystem).
pm2 save >/dev/null

echo "Restarted titan-backend with TITAN_RUNTIME_COMMIT (not printed beyond short SHA above)."
echo "Verify: curl -sS http://127.0.0.1:5002/api/v1/health | python3 -m json.tool"
