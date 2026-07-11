#!/usr/bin/env bash
# Canonical production frontend deployment for TitanGold.
# nginx serves /home/ubuntu/webapp/TitanGold/dist — NOT the PM2 Vite dev server on :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
NGINX_ROOT="${NGINX_ROOT:-/home/ubuntu/webapp/TitanGold/dist}"
PRODUCTION_URL="${PRODUCTION_URL:-https://titan.zala.ir}"
SMOKE_MARKER="${SMOKE_MARKER:-publisher_delivery_mode_title}"
OLD_MARKER="${OLD_MARKER:-publish_dry_run_safe}"
RELOAD_NGINX="${RELOAD_NGINX:-true}"

log() { printf '[deploy-frontend] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

INDEX_BEFORE=""
if [[ -f "$DIST/index.html" ]]; then
  INDEX_BEFORE="$(stat -c '%Y' "$DIST/index.html" 2>/dev/null || stat -f '%m' "$DIST/index.html")"
fi

log "Running production build..."
cd "$ROOT"
npm run build

[[ -f "$DIST/index.html" ]] || fail "dist/index.html missing after build"

INDEX_AFTER="$(stat -c '%Y' "$DIST/index.html" 2>/dev/null || stat -f '%m' "$DIST/index.html")"
if [[ -n "$INDEX_BEFORE" && "$INDEX_AFTER" == "$INDEX_BEFORE" ]]; then
  fail "dist/index.html mtime unchanged — build may not have refreshed output"
fi

DATAHUB_BUNDLE="$(find "$DIST/assets" -maxdepth 1 -name 'DataHubTab-*.js' -print -quit 2>/dev/null || true)"
if [[ -z "$DATAHUB_BUNDLE" ]]; then
  DATAHUB_BUNDLE="$(grep -rl "$SMOKE_MARKER" "$DIST/assets/"*.js 2>/dev/null | head -1 || true)"
fi
[[ -n "$DATAHUB_BUNDLE" ]] || fail "Could not locate DataHub bundle containing smoke marker"

BUNDLE_FILE="$(basename "$DATAHUB_BUNDLE")"
[[ -f "$DIST/assets/$BUNDLE_FILE" ]] || fail "Bundle file missing: assets/$BUNDLE_FILE"

if ! grep -q "$SMOKE_MARKER" "$DIST/assets/$BUNDLE_FILE"; then
  fail "Built bundle assets/$BUNDLE_FILE does not contain expected marker: $SMOKE_MARKER"
fi
if grep -q "$OLD_MARKER" "$DIST/assets/$BUNDLE_FILE" && ! grep -q 'publisher_btn_publish_dry_run' "$DIST/assets/$BUNDLE_FILE"; then
  fail "Built bundle still looks pre-refactor (old-only publish label)"
fi

log "Build OK — bundle assets/$BUNDLE_FILE contains $SMOKE_MARKER"

if [[ "$NGINX_ROOT" != "$DIST" ]]; then
  log "NGINX_ROOT ($NGINX_ROOT) differs from repo dist ($DIST) — sync manually if required"
fi

if [[ "$RELOAD_NGINX" == "true" ]] && command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx || sudo nginx -s reload
    log "nginx reloaded"
  else
    fail "nginx config test failed"
  fi
fi

log "Fetching production index from $PRODUCTION_URL"
PROD_HTML="$(curl -skL "$PRODUCTION_URL/" || true)"
[[ -n "$PROD_HTML" ]] || fail "Could not fetch production homepage"

PROD_INDEX_JS="$(printf '%s' "$PROD_HTML" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
[[ -n "$PROD_INDEX_JS" ]] || fail "Production index.js bundle not found"

PROD_INDEX_FILE="${PROD_INDEX_JS#assets/}"
LOCAL_INDEX_JS="$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DIST/index.html" | head -1 || true)"
LOCAL_INDEX_FILE="${LOCAL_INDEX_JS#assets/}"

if [[ "$PROD_INDEX_FILE" != "$LOCAL_INDEX_FILE" ]]; then
  fail "Production still serves old index bundle ($PROD_INDEX_FILE != $LOCAL_INDEX_FILE). Hard-refresh/CDN cache may be stale."
fi

PROD_DATAHUB="$(curl -skL "$PRODUCTION_URL/assets/$PROD_INDEX_FILE" | grep -oE 'DataHubTab-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [[ -n "$PROD_DATAHUB" ]]; then
  PROD_CHUNK_TMP="$(mktemp)"
  trap 'rm -f "$PROD_CHUNK_TMP"' EXIT
  curl -skL "$PRODUCTION_URL/assets/$PROD_DATAHUB" -o "$PROD_CHUNK_TMP"
  if ! grep -a -q "$SMOKE_MARKER" "$PROD_CHUNK_TMP"; then
    fail "Production DataHub chunk assets/$PROD_DATAHUB missing marker $SMOKE_MARKER"
  fi
  if [[ "$PROD_DATAHUB" != "$BUNDLE_FILE" ]]; then
    log "WARN: production DataHub chunk name differs from local ($PROD_DATAHUB vs $BUNDLE_FILE) — marker check passed"
  fi
else
  log "WARN: could not resolve lazy DataHub chunk from production index; index hash match passed"
fi

if [[ -f "$ROOT/backend/.env" ]] && command -v node >/dev/null 2>&1; then
  log "Authenticated runtime-mode API smoke..."
  (cd "$ROOT/backend" && node --input-type=module <<'SMOKE') || fail "Authenticated API smoke failed"
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();
const secret = process.env.JWT_SECRET;
if (!secret) process.exit(0);
const adminId = process.env.DEPLOY_SMOKE_ADMIN_ID || 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const apiBase = process.env.DEPLOY_SMOKE_API_BASE || 'http://127.0.0.1:5002';
const token = jwt.sign({ userId: adminId, role: 'admin' }, secret, { expiresIn: '10m' });
const res = await fetch(`${apiBase}/api/v1/data-hub/telegram-publishers/runtime-mode`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error('runtime-mode HTTP', res.status);
  process.exit(1);
}
const body = await res.json();
if (!body.configuredMode || !body.effectiveMode) {
  console.error('runtime-mode payload missing mode fields', body);
  process.exit(1);
}
console.log('runtime-mode OK', body.configuredMode, body.effectiveMode);
SMOKE
fi

log "SUCCESS"
log "  dist/index.html mtime: $INDEX_AFTER"
log "  local DataHub bundle: assets/$BUNDLE_FILE"
log "  production index: assets/$PROD_INDEX_FILE"
log "  production URL: $PRODUCTION_URL"
log "  marker: $SMOKE_MARKER"
