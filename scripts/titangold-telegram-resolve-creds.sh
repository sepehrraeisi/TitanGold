#!/bin/bash
#
# Resolve Telegram credentials from DataHub telegram_publishers (canonical).
# Uses:
#   1) publisher row from PostgreSQL (peer auth as postgres)
#   2) MASTER_KEY from the live titan-backend PM2 process (same key used to encrypt)
#
# stdout = shell assignments. Do not tee/log stdout (contains bot token).
#
set -euo pipefail

APP_ROOT="${TITANGOLD_APP_ROOT:-/home/ubuntu/webapp/TitanGold}"
BACKUP_ENV="/etc/titangold-backup.env"
DECRYPT_JS="${APP_ROOT}/backend/scripts/titangold-telegram-decrypt-token.mjs"
RUNTIME_ENV="/etc/titangold-telegram-runtime.env"
PG_PORT="${TITANGOLD_PG_PORT:-5433}"
PG_DB="${TITANGOLD_PG_DB:-titangold_db}"

if [ ! -f "$DECRYPT_JS" ]; then
    echo "ERROR: decrypt helper missing: $DECRYPT_JS" >&2
    exit 1
fi

if [ -z "${TELEGRAM_PUBLISHER_ID:-}" ] && [ -f "$BACKUP_ENV" ]; then
    PIN=$(grep -E '^TELEGRAM_PUBLISHER_ID=' "$BACKUP_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "${PIN:-}" ]; then
        TELEGRAM_PUBLISHER_ID="$PIN"
    fi
fi

# Fetch encrypted publisher fields (no secrets decrypted yet)
if [ -n "${TELEGRAM_PUBLISHER_ID:-}" ]; then
    if ! [[ "$TELEGRAM_PUBLISHER_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
        echo "ERROR: TELEGRAM_PUBLISHER_ID is not a UUID" >&2
        exit 1
    fi
    ROW_JSON=$(sudo -u postgres psql -p "$PG_PORT" -d "$PG_DB" -v ON_ERROR_STOP=1 -At -F $'\t' -c \
        "SELECT id::text, coalesce(name,''), coalesce(channel_id,''), coalesce(bot_token_encrypted,'')
         FROM telegram_publishers
         WHERE id = '${TELEGRAM_PUBLISHER_ID}'::uuid AND is_active = true
         LIMIT 1")
else
    ROW_JSON=$(sudo -u postgres psql -p "$PG_PORT" -d "$PG_DB" -v ON_ERROR_STOP=1 -At -F $'\t' -c \
        "SELECT id::text, coalesce(name,''), coalesce(channel_id,''), coalesce(bot_token_encrypted,'')
         FROM telegram_publishers
         WHERE is_active = true
           AND bot_token_encrypted IS NOT NULL
           AND length(bot_token_encrypted) > 0
           AND channel_id IS NOT NULL
           AND channel_id !~ '^-100[0-9]\$'
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1")
fi

if [ -z "${ROW_JSON:-}" ]; then
    echo "ERROR: No active Telegram Publisher with bot token found" >&2
    exit 1
fi

PUB_ID=$(printf '%s' "$ROW_JSON" | cut -f1)
PUB_NAME=$(printf '%s' "$ROW_JSON" | cut -f2)
CHAT_ID=$(printf '%s' "$ROW_JSON" | cut -f3)
ENC=$(printf '%s' "$ROW_JSON" | cut -f4)

if [ -z "$ENC" ] || [ -z "$CHAT_ID" ]; then
    echo "ERROR: Publisher row incomplete (missing token or channel_id)" >&2
    exit 1
fi

# Live crypto keys from running backend (PM2). File .env may be stale vs process.
read_pm2_crypto_env() {
    # PM2 is owned by the app user (ubuntu), not root.
    local pm2_user="${TITANGOLD_PM2_USER:-ubuntu}"
    local helper="${APP_ROOT}/scripts/titangold-pm2-crypto-env.py"
    if [ ! -f "$helper" ]; then
        echo "ERROR: missing $helper" >&2
        return 1
    fi
    python3 "$helper" "$pm2_user"
}

CRYPTO_OUT=$(read_pm2_crypto_env) || exit 1
eval "$CRYPTO_OUT"

PAYLOAD=$(ENC="$ENC" CHAT_ID="$CHAT_ID" PUB_ID="$PUB_ID" PUB_NAME="$PUB_NAME" python3 - <<'PY'
import json, os
print(json.dumps({
  "encrypted": os.environ["ENC"],
  "chatId": os.environ["CHAT_ID"],
  "publisherId": os.environ["PUB_ID"],
  "publisherName": os.environ.get("PUB_NAME", ""),
}))
PY
)

cd "${APP_ROOT}/backend"
OUT=$(printf '%s' "$PAYLOAD" | MASTER_KEY="$MASTER_KEY" \
    MASTER_KEY_PREVIOUS="${MASTER_KEY_PREVIOUS:-}" \
    MASTER_KEY_WRITE_MODE="${MASTER_KEY_WRITE_MODE:-}" \
    node "$DECRYPT_JS") || exit 1

# Refresh shared runtime cache for postgres/root consumers
umask 077
TMP=$(mktemp)
printf '%s\n' "$OUT" > "$TMP"
if [ "$(id -u)" -eq 0 ]; then
    install -m 640 -o root -g postgres "$TMP" "$RUNTIME_ENV"
elif command -v sudo >/dev/null 2>&1; then
    sudo install -m 640 -o root -g postgres "$TMP" "$RUNTIME_ENV" 2>/dev/null || true
fi
rm -f "$TMP"

printf '%s\n' "$OUT"
