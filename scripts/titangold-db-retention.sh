#!/bin/bash
#
# TitanGold DB retention (60-day) — batched prune for large tables
# Cron (recommended): 30 3 * * * /usr/local/bin/titangold-db-retention.sh
#
# Deletes:
#   - telegram_messages older than N days (CASCADE → processed + impacts)
#   - collected_data older than N days
#   - request_logs older than N days
#   - plus other categories via prune_logs()
#

set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/titangold-db-retention.log}"
RETENTION_DAYS="${RETENTION_DAYS:-60}"
# Per-run caps (catch-up may need several cron runs / manual loops)
MSG_BATCHES="${MSG_BATCHES:-800}"
COLLECTED_BATCHES="${COLLECTED_BATCHES:-800}"
REQUEST_BATCHES="${REQUEST_BATCHES:-400}"
BATCH_SIZE_MSG="${BATCH_SIZE_MSG:-3000}"
BATCH_SIZE_COLLECTED="${BATCH_SIZE_COLLECTED:-5000}"
BATCH_SIZE_REQUEST="${BATCH_SIZE_REQUEST:-8000}"
RUN_VACUUM="${RUN_VACUUM:-1}"
NOTIFY="${NOTIFY:-1}"

log() {
    printf '%s %s\n' "[$(date '+%Y-%m-%d %H:%M:%S')]" "$*" | tee -a "$LOG_FILE"
}

if [ "${EUID}" -ne 0 ]; then
    echo "ERROR: must run as root" >&2
    exit 1
fi

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 640 "$LOG_FILE" 2>/dev/null || true

log "=== Starting DB retention (${RETENTION_DAYS}d) ==="

# Ensure policies exist / stay at configured days
sudo -u postgres psql -d titangold_db -v ON_ERROR_STOP=1 <<SQL
INSERT INTO log_retention_policies (category, retention_days, description) VALUES
('telegram_messages', ${RETENTION_DAYS}, 'Raw telegram messages (cascades to processed/impacts)'),
('request_logs', ${RETENTION_DAYS}, 'HTTP/API request logs'),
('collected_data', ${RETENTION_DAYS}, 'Raw and normalized data from sources')
ON CONFLICT (category) DO UPDATE SET
  retention_days = EXCLUDED.retention_days,
  is_enabled = TRUE,
  updated_at = NOW();
SQL

# Heavy tables first via batched helper (statement_timeout off for this session)
RESULT=$(sudo -u postgres psql -d titangold_db -v ON_ERROR_STOP=1 -At <<SQL
SET statement_timeout = 0;
SET lock_timeout = '30s';
SELECT 'telegram_messages=' || prune_table_by_age('telegram_messages', 'created_at', ${RETENTION_DAYS}, ${BATCH_SIZE_MSG}, ${MSG_BATCHES});
SELECT 'collected_data=' || prune_table_by_age('collected_data', 'collected_at', ${RETENTION_DAYS}, ${BATCH_SIZE_COLLECTED}, ${COLLECTED_BATCHES});
SELECT 'request_logs=' || prune_table_by_age('request_logs', 'created_at', ${RETENTION_DAYS}, ${BATCH_SIZE_REQUEST}, ${REQUEST_BATCHES});
SELECT 'summary=' || run_log_retention_maintenance()::text;
SQL
)

while IFS= read -r line; do
    [ -n "$line" ] && log "$line"
done <<< "$RESULT"

if [ "$RUN_VACUUM" = "1" ]; then
    log "Running VACUUM (ANALYZE) on pruned tables (non-blocking reclaim inside PG)..."
    sudo -u postgres psql -d titangold_db -v ON_ERROR_STOP=1 <<'SQL'
SET statement_timeout = 0;
VACUUM (ANALYZE) telegram_messages;
VACUUM (ANALYZE) processed_telegram_messages;
VACUUM (ANALYZE) telegram_agent_impacts;
VACUUM (ANALYZE) collected_data;
VACUUM (ANALYZE) request_logs;
SQL
    log "VACUUM done"
fi

SIZE=$(sudo -u postgres psql -d titangold_db -Atc "SELECT pg_size_pretty(pg_database_size('titangold_db'));")
log "Database size now: ${SIZE}"
log "=== DB retention completed ==="

if [ "$NOTIFY" = "1" ] && [ -x /usr/local/bin/titangold-telegram-notify.sh ]; then
    /usr/local/bin/titangold-telegram-notify.sh success "*DB Retention 60d*%0A%0A✅ Prune run finished%0A📊 DB size: ${SIZE}" || true
fi

exit 0
