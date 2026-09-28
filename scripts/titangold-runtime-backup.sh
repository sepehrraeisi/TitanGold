#!/bin/bash
#
# TitanGold Runtime DR bundle (small): config + secrets + Cursor restore playbook.
# Code stays on GitHub. Database stays in the existing V2 dump on B2.
#
set -euo pipefail

OFFSITE_ENV="/etc/titangold-offsite.env"
POSTGRES_ENV="/etc/titangold-backup-postgres.env"
BACKUP_ENV="/etc/titangold-backup.env"
LOG_FILE="/var/log/titangold-offsite.log"
RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/titangold-rclone.conf}"
APP_ROOT="/home/ubuntu/webapp/TitanGold"
REMOTE_NAME="b2tg"
KEEP_RUNTIME="${B2_RUNTIME_KEEP:-3}"

log() { printf '%s %s\n' "[$(date '+%Y-%m-%d %H:%M:%S')]" "$*" | tee -a "$LOG_FILE"; }

if [ "${EUID}" -ne 0 ]; then
    echo "ERROR: runtime backup must run as root" >&2
    exit 1
fi

set -a
[ -f "$OFFSITE_ENV" ] && source "$OFFSITE_ENV"
[ -f "$POSTGRES_ENV" ] && source "$POSTGRES_ENV"
[ -f "$BACKUP_ENV" ] && source "$BACKUP_ENV"
set +a

PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"
if [ -z "$PASSPHRASE" ]; then
    log "ERROR: BACKUP_ENCRYPTION_KEY empty — refusing unencrypted runtime bundle"
    return 1 2>/dev/null || exit 1
fi

B2_BUCKET="${B2_BUCKET:-titangold-zala-backups}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/titangold-rclone.conf}"
STAMP=$(date '+%Y-%m-%d_%H-%M-%S')
STAGE=$(mktemp -d /tmp/titangold-runtime.XXXXXX)
chmod 700 "$STAGE"
ROOT="$STAGE/titangold-runtime"
mkdir -p "$ROOT"/{usr-local-bin,etc/nginx/sites-available,etc/ssl,crontabs,pm2,app-env,letsencrypt}

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

GIT_SHA="unknown"
GIT_BRANCH="unknown"
if [ -d "$APP_ROOT/.git" ]; then
    GIT_SHA=$(git -C "$APP_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
    GIT_BRANCH=$(git -C "$APP_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
fi

{
    echo "product=TitanGold"
    echo "created=$(date -Iseconds)"
    echo "hostname=$(hostname)"
    echo "git_remote=git@github.com:sepehrraeisi/TitanGold.git"
    echo "git_branch=${GIT_BRANCH}"
    echo "git_sha=${GIT_SHA}"
    echo "app_root=${APP_ROOT}"
    echo "db_name=titangold_db"
    echo "db_port=5433"
    echo "db_user=postgres"
    echo "backend_port=5002"
    echo "domain=titan.zala.ir"
    echo "b2_bucket=${B2_BUCKET}"
    echo "b2_db_prefix=latest"
    echo "b2_runtime_prefix=runtime"
} > "$ROOT/MANIFEST.txt"

# Cursor playbook — no secrets
cat > "$ROOT/RESTORE_FOR_CURSOR.md" << 'PLAYBOOK'
# TitanGold one-shot restore (for Cursor)

User prompt to use:

> این پوشه بسته بازیابی TitanGold است. طبق RESTORE_FOR_CURSOR.md و MANIFEST.txt سرور را برگردان تا سایت titan.zala.ir و دیتابیس و بک‌آپ دوباره کار کنند. Secret را در چت چاپ نکن.

## What this bundle is

- Runtime: nginx, TitanGold backup scripts, crontabs, PM2 dump, encrypted env files, Cloudflare origin cert.
- NOT the application source (clone GitHub).
- NOT the database (download latest `*.sql.gz.gpg` from B2 prefix `latest/`).

## Human must provide (not in Git)

1. This decrypted runtime folder
2. GitHub access to `sepehrraeisi/TitanGold`
3. B2 application key (or rclone.conf already in this bundle after decrypt)
4. `BACKUP_ENCRYPTION_KEY` to decrypt the database dump (same key that opened this bundle)

## Steps (new Ubuntu server)

1. Install: nginx, postgresql-14, node 20, pm2, rclone, gpg, git.
2. Create postgres DB `titangold_db` on port **5433**.
3. Restore files from this bundle:
   - `/usr/local/bin/titangold-*.sh`
   - `/etc/nginx/sites-available/titan-zala` (+ enable)
   - `/etc/titangold-*.env` and `/etc/titangold-rclone.conf` (mode 600)
   - origin cert/key under `/etc/ssl/cloudflare/`
   - crontabs for root and postgres
4. `git clone git@github.com:sepehrraeisi/TitanGold.git /home/ubuntu/webapp/TitanGold`
   - checkout `git_sha` from MANIFEST.txt
5. Copy `app-env/` files back to:
   - `/home/ubuntu/webapp/TitanGold/.env`
   - `/home/ubuntu/webapp/TitanGold/backend/.env`
6. `npm ci` in repo and backend; production frontend build; serve via nginx `dist`.
7. Download newest `b2:BUCKET/latest/*.sql.gz.gpg` with rclone (config in this bundle).
8. Decrypt+gunzip stream into `psql` on port 5433. Do not restore over a live DB without confirmation.
9. `pm2 start` from backend ecosystem / resurrect dump.pm2 if compatible.
10. nginx test + reload. Check:
    - `curl -sS http://127.0.0.1:5002/health`
    - `https://titan.zala.ir` login
11. Point DNS at the new server if the IP changed.

## Do not

- Print JWT, API keys, B2 keys, or origin private key
- `git add` env files
- Restore onto production without a dry-run list of paths
PLAYBOOK

install -m 755 /usr/local/bin/titangold-*.sh "$ROOT/usr-local-bin/" 2>/dev/null || true
cp -a /etc/nginx/nginx.conf "$ROOT/etc/nginx/" 2>/dev/null || true
cp -a /etc/nginx/sites-available/titan-zala "$ROOT/etc/nginx/sites-available/" 2>/dev/null || true
ls -1 /etc/nginx/sites-enabled > "$ROOT/etc/nginx/sites-enabled.list" 2>/dev/null || true

cp -a /etc/titangold-backup.env /etc/titangold-backup-postgres.env \
      /etc/titangold-offsite.env /etc/titangold-rclone.conf \
      "$ROOT/etc/" 2>/dev/null || true

if [ -d /etc/ssl/cloudflare ]; then
    mkdir -p "$ROOT/etc/ssl/cloudflare"
    cp -a /etc/ssl/cloudflare/zala.ir.origin.pem "$ROOT/etc/ssl/cloudflare/" 2>/dev/null || true
    cp -a /etc/ssl/cloudflare/zala.ir.origin.key "$ROOT/etc/ssl/cloudflare/" 2>/dev/null || true
fi

crontab -l > "$ROOT/crontabs/root" 2>/dev/null || true
crontab -u postgres -l > "$ROOT/crontabs/postgres" 2>/dev/null || true
[ -f /home/ubuntu/.pm2/dump.pm2 ] && cp -a /home/ubuntu/.pm2/dump.pm2 "$ROOT/pm2/"
[ -f "$APP_ROOT/.env" ] && cp -a "$APP_ROOT/.env" "$ROOT/app-env/root.env"
[ -f "$APP_ROOT/backend/.env" ] && cp -a "$APP_ROOT/backend/.env" "$ROOT/app-env/backend.env"

OUT_PLAIN="$STAGE/titangold_runtime_${STAMP}.tar.gz"
tar -C "$STAGE" -czf "$OUT_PLAIN" titangold-runtime
OUT_GPG="${OUT_PLAIN}.gpg"

echo "$PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 --pinentry-mode loopback \
    --symmetric --cipher-algo AES256 --compress-algo none \
    --output "$OUT_GPG" "$OUT_PLAIN"
rm -f "$OUT_PLAIN"
sha256sum "$OUT_GPG" | awk '{print $1}' > "${OUT_GPG}.sha256"
BYTES=$(stat -c %s "$OUT_GPG")
SIZE=$(du -h "$OUT_GPG" | cut -f1)
log "Runtime bundle created: $(basename "$OUT_GPG") (${SIZE})"

emit_runtime_vars() {
    echo "RUNTIME_NAME=$(basename "$OUT_GPG")"
    echo "RUNTIME_SIZE=${SIZE}"
    echo "RUNTIME_COUNT=${1:-0}"
}

if ! command -v rclone >/dev/null 2>&1 || [ ! -f "$RCLONE_CONFIG" ]; then
    log "WARNING: rclone missing — runtime bundle not uploaded"
    emit_runtime_vars 0
    trap - EXIT
    exit 1
fi

REMOTE="${REMOTE_NAME}:${B2_BUCKET}/runtime"
RCLONE=(rclone --config "$RCLONE_CONFIG" --retries 8 --low-level-retries 20 --stats-one-line --log-level INFO)

rclone_copy_retry() {
    local src="$1" dest="$2" attempts="${3:-3}"
    local attempt rc err
    for attempt in $(seq 1 "$attempts"); do
        err=$(mktemp)
        set +e
        "${RCLONE[@]}" copy "$src" "$dest" --no-traverse --retries 8 --low-level-retries 20 2>"$err"
        rc=$?
        set -e
        if [ "$rc" -eq 0 ]; then
            rm -f "$err"
            return 0
        fi
        log "Runtime upload attempt ${attempt}/${attempts} failed (rc=${rc}) for $(basename "$src")"
        if [ -s "$err" ]; then
            head -c 2000 "$err" | sed 's/key=[^ ]*/key=***/g; s/Authorization: .*/Authorization: ***/g' | while IFS= read -r line; do
                log "rclone: $line"
            done
        fi
        rm -f "$err"
        "${RCLONE[@]}" backend cleanup "${REMOTE_NAME}:${B2_BUCKET}" >/dev/null 2>&1 || true
        if [ "$attempt" -lt "$attempts" ]; then
            log "Waiting 30s before runtime upload retry"
            sleep 30
        fi
    done
    return 1
}

if ! rclone_copy_retry "$OUT_GPG" "${REMOTE}/"; then
    log "ERROR: runtime bundle upload failed"
    emit_runtime_vars 0
    exit 1
fi
rclone_copy_retry "${OUT_GPG}.sha256" "${REMOTE}/" || log "WARNING: runtime sha256 sidecar upload failed"

mapfile -t RT_SORTED < <("${RCLONE[@]}" lsjson "${REMOTE}/" 2>/dev/null | python3 -c '
import json,sys
try:
    items=json.load(sys.stdin)
except Exception:
    sys.exit(0)
files=[i for i in items if i.get("Name","").endswith(".tar.gz.gpg")]
files.sort(key=lambda i: i.get("ModTime") or "", reverse=True)
for i in files:
    print(i["Name"])
')
if ((${#RT_SORTED[@]} > KEEP_RUNTIME)); then
    for old in "${RT_SORTED[@]:$KEEP_RUNTIME}"; do
        log "Deleting old runtime remote: $old"
        "${RCLONE[@]}" deletefile "${REMOTE}/${old}" || true
        "${RCLONE[@]}" deletefile "${REMOTE}/${old}.sha256" >/dev/null 2>&1 || true
    done
fi

RT_COUNT=$("${RCLONE[@]}" lsf "${REMOTE}/" --files-only 2>/dev/null | grep -cE '\.tar\.gz\.gpg$' || true)
RT_COUNT=${RT_COUNT:-0}
log "Runtime remote copies: ${RT_COUNT}"
emit_runtime_vars "$RT_COUNT"
