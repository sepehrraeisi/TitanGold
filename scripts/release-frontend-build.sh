#!/usr/bin/env bash
# Safe production frontend *build* (Core Rule §109).
# Writes ONLY to a non-live staging directory. Does not activate, reload nginx,
# mutate PM2/DB/Redis, or write /home/ubuntu/webapp/TitanGold/dist.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMIT="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
RUN_ID="${TITANGOLD_RELEASE_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
STAGING_ROOT="${TITANGOLD_RELEASE_STAGING_ROOT:-/home/ubuntu/releases/titangold}"
OUT_DIR="${TITANGOLD_VITE_OUTDIR:-${STAGING_ROOT}/${COMMIT}/${RUN_ID}/dist}"

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 2; }

case "$OUT_DIR" in
  /home/ubuntu/webapp/TitanGold/dist|/home/ubuntu/webapp/TitanGold/dist/*)
    fail "LIVE_NGINX_ROOT_OUTPUT_FORBIDDEN (release build must not use live dist)"
    ;;
esac

mkdir -p "$OUT_DIR"
export TITANGOLD_RELEASE_BUILD=1
export TITANGOLD_VITE_OUTDIR="$OUT_DIR"

node "$ROOT/scripts/guard-production-build.mjs" --release
npx vite build
[[ -f "$OUT_DIR/index.html" ]] || fail "ARTIFACT_INDEX_MISSING"

LOCK_SHA="$(sha256sum "$ROOT/package-lock.json" | awk '{print $1}')"
TREE_SHA="$( (cd "$OUT_DIR" && find . -type f | sort | xargs -r sha256sum | sha256sum | awk '{print $1}') )"
MANIFEST="$(dirname "$OUT_DIR")/artifact-manifest.json"

COMMIT="$COMMIT" BRANCH="$BRANCH" LOCK_SHA="$LOCK_SHA" TREE_SHA="$TREE_SHA" \
RUN_ID="$RUN_ID" OUT_DIR="$OUT_DIR" python3 - "$MANIFEST" <<'PY'
import json, os, sys
from datetime import datetime, timezone
path = sys.argv[1]
payload = {
  "schemaVersion": 1,
  "sourceCommit": os.environ["COMMIT"],
  "branch": os.environ["BRANCH"],
  "cleanTreeProof": True,
  "packageLockSha256": os.environ["LOCK_SHA"],
  "artifactTreeSha256": os.environ["TREE_SHA"],
  "buildTimestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "runId": os.environ["RUN_ID"],
  "outDir": os.environ["OUT_DIR"],
  "activation": "NOT_PERFORMED",
}
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY

printf '[release-frontend-build] ARTIFACT_READY manifest=%s outDir=%s\n' "$MANIFEST" "$OUT_DIR"
printf '[release-frontend-build] Activation is a SEPARATE command: scripts/activate-frontend-dist.sh\n'
