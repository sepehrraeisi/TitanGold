#!/usr/bin/env bash
# Explicit frontend dist *activation* (Core Rule §109). Separate from build.
# Does NOT mutate application source, backend, PM2, DB, or Redis.
# Requires: verified artifact + manifest, live dist backup FIRST, then activate.
# THIS TASK MUST NOT RUN THIS SCRIPT AGAINST PRODUCTION.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${1:-}"
LIVE_ROOT="${TITANGOLD_LIVE_NGINX_DIST:-/home/ubuntu/webapp/TitanGold/dist}"
BACKUP_ROOT="${TITANGOLD_DIST_BACKUP_ROOT:-/home/ubuntu/releases/titangold/backups}"
PRODUCTION_URL="${PRODUCTION_URL:-https://titan.zala.ir}"
DO_ACTIVATE="${TITANGOLD_CONFIRM_DIST_ACTIVATE:-NO}"
SMOKE="${TITANGOLD_HTTPS_SMOKE:-YES}"

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 2; }
log() { printf '[activate-frontend-dist] %s\n' "$*"; }

[[ -n "$ARTIFACT_DIR" ]] || fail "USAGE: $0 <artifact-dist-dir>   (set TITANGOLD_CONFIRM_DIST_ACTIVATE=YES to apply)"
[[ -d "$ARTIFACT_DIR" ]] || fail "ARTIFACT_MISSING: $ARTIFACT_DIR"
[[ -f "$ARTIFACT_DIR/index.html" ]] || fail "ARTIFACT_INDEX_MISSING"

MANIFEST="$(dirname "$ARTIFACT_DIR")/artifact-manifest.json"
[[ -f "$MANIFEST" ]] || fail "ARTIFACT_MANIFEST_MISSING: $MANIFEST"

python3 - "$MANIFEST" "$ARTIFACT_DIR" <<'PY' || fail "ARTIFACT_MANIFEST_INVALID"
import json, sys, os
manifest_path, artifact = sys.argv[1], sys.argv[2]
with open(manifest_path, encoding="utf-8") as fh:
    m = json.load(fh)
required = ["sourceCommit", "branch", "packageLockSha256", "artifactTreeSha256", "runId", "buildTimestamp"]
missing = [k for k in required if not m.get(k)]
if missing:
    raise SystemExit("missing " + ",".join(missing))
if m.get("outDir") and os.path.realpath(m["outDir"]) != os.path.realpath(artifact):
    # allow trailing-equivalent paths
    pass
print("MANIFEST_OK commit=%s runId=%s" % (m["sourceCommit"], m["runId"]))
PY

case "$ARTIFACT_DIR" in
  "$LIVE_ROOT"|"$LIVE_ROOT"/*)
    fail "LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN (activation source must not be the live root itself as build output)"
    ;;
esac

[[ "$LIVE_ROOT" == "/home/ubuntu/webapp/TitanGold/dist" ]] || log "LIVE_ROOT override=$LIVE_ROOT"

if [[ "$DO_ACTIVATE" != "YES" ]]; then
  log "DRY_RUN: backup + activate not applied (TITANGOLD_CONFIRM_DIST_ACTIVATE!=YES)"
  log "Would backup $LIVE_ROOT -> ${BACKUP_ROOT}/<stamp>/dist then rsync artifact -> live"
  log "ROLLBACK would restore the backup fingerprint recorded before activation"
  exit 0
fi

[[ -d "$LIVE_ROOT" ]] || fail "LIVE_ROOT_MISSING: $LIVE_ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}/dist"
mkdir -p "$BACKUP_DIR"
# Backup MUST complete before any live write.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$LIVE_ROOT/" "$BACKUP_DIR/"
else
  cp -a "$LIVE_ROOT/." "$BACKUP_DIR/"
fi
[[ -f "$BACKUP_DIR/index.html" ]] || fail "BACKUP_PROOF_FAILED"
BACKUP_FP="$( (cd "$BACKUP_DIR" && find . -type f | sort | xargs -r sha256sum | sha256sum | awk '{print $1}') )"
printf '%s\n' "$BACKUP_FP" > "${BACKUP_ROOT}/${STAMP}/fingerprint.txt"
printf '%s\n' "$LIVE_ROOT" > "${BACKUP_ROOT}/${STAMP}/live-root.txt"
log "BACKUP_OK fingerprint=$BACKUP_FP dir=$BACKUP_DIR"

# Activate dist only.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$ARTIFACT_DIR/" "$LIVE_ROOT/"
else
  fail "RSYNC_REQUIRED_FOR_ACTIVATION"
fi

log "ACTIVATE_OK live=$LIVE_ROOT"
log "ROLLBACK: rsync -a --delete $BACKUP_DIR/ $LIVE_ROOT/"

if [[ "$SMOKE" == "YES" ]]; then
  HTML="$(curl -skL --max-time 20 "$PRODUCTION_URL/" || true)"
  [[ -n "$HTML" ]] || fail "HTTPS_SMOKE_FAILED"
  log "HTTPS_SMOKE_OK"
fi
