#!/usr/bin/env bash
# Disposable PostgreSQL test harness — never touches Staging/Production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
CONTAINER="${TITAN_TEST_PG_CONTAINER:-titangold-test-pg-$$}"
PORT="${TITAN_TEST_PG_PORT:-55432}"
DATABASE_URL="postgresql://postgres@127.0.0.1:${PORT}/titangold_test"
export DATABASE_URL NODE_ENV=test

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▶ Starting disposable PostgreSQL ($CONTAINER on :$PORT)"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_DB=titangold_test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p "${PORT}:5432" \
  postgres:15 >/dev/null

for _ in $(seq 1 45); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres

echo "▶ Applying base schema"
node "$BACKEND/scripts/ci_apply_base_schema.js"

echo "▶ Registering migrations"
(cd "$BACKEND" && npm run migrate:setup >/dev/null)
(cd "$BACKEND" && npm run migrate:up)

PATTERN="${1:-agentStatusProjection|arbitrage|schedulerOwnership|schedulerWorkerSafety|analyticalSchedulerFoundation|legacyAgentContainment|agentStatusParity}"
echo "▶ Running backend tests: $PATTERN"
(cd "$BACKEND" && npm test -- --testPathPattern="$PATTERN" --forceExit --detectOpenHandles)

echo "✅ Disposable PostgreSQL test run complete"
