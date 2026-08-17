#!/usr/bin/env bash
# Build a deterministic, hash-locked C2 runner capsule archive.
# CI-only npm ci --ignore-scripts. No production path. No 052 content.
set -euo pipefail

umask 022

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SRC_ROOT}/../.." && pwd)"

if [[ "${SRC_ROOT}" == /home/ubuntu/webapp/TitanGold* ]]; then
  echo "C2_CAPSULE_SELF_TEST_FAILED: refusing to build inside production application path" >&2
  exit 1
fi

SOURCE_COMMIT="${SOURCE_COMMIT:-}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-}"
if [[ -z "${SOURCE_COMMIT}" ]]; then
  SOURCE_COMMIT="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
fi
if [[ -z "${SOURCE_DATE_EPOCH}" ]]; then
  SOURCE_DATE_EPOCH="$(git -C "${REPO_ROOT}" log -1 --format=%ct)"
fi
export SOURCE_COMMIT SOURCE_DATE_EPOCH

OUT_DIR="${OUT_DIR:-$(mktemp -d /tmp/c2-capsule-out-XXXXXX)}"
mkdir -p "${OUT_DIR}"
STAGE="$(mktemp -d /tmp/c2-capsule-stage-XXXXXX)"
TOP="titangold-c2-runner"
WORKDIR="${STAGE}/${TOP}"
mkdir -p "${WORKDIR}/bin"

cp -a "${SRC_ROOT}/package.json" "${WORKDIR}/package.json"
cp -a "${SRC_ROOT}/package-lock.json" "${WORKDIR}/package-lock.json"
cp -a "${SRC_ROOT}/README.md" "${WORKDIR}/README.md"
cp -a "${SRC_ROOT}/bin/c2-migrate.mjs" "${WORKDIR}/bin/c2-migrate.mjs"
cp -a "${SRC_ROOT}/bin/c2-self-test.mjs" "${WORKDIR}/bin/c2-self-test.mjs"

# Never copy migrations, env, or git into the capsule.
if [[ -e "${WORKDIR}/.env" || -d "${WORKDIR}/.git" ]]; then
  echo "C2_CAPSULE_SELF_TEST_FAILED: forbidden metadata in stage" >&2
  exit 1
fi

node "${SRC_ROOT}/scripts/inventory.mjs" --validate-lock "${WORKDIR}/package-lock.json"

(
  cd "${WORKDIR}"
  npm ci --ignore-scripts
)

# Drop npm noise that is not required at runtime.
rm -rf "${WORKDIR}/node_modules/.cache" "${WORKDIR}/node_modules/.package-lock.json"

node "${SRC_ROOT}/scripts/inventory.mjs" --write "${WORKDIR}"

if find "${WORKDIR}" -name '052_telegram_messages_channel_message_id_index.js' | grep -q .; then
  echo "C2_CAPSULE_SELF_TEST_FAILED: capsule contains canonical 052" >&2
  exit 1
fi

# Normalize metadata for a reproducible archive.
find "${WORKDIR}" -print0 | xargs -0 touch -d "@${SOURCE_DATE_EPOCH}"
find "${WORKDIR}" -type d -exec chmod 0755 {} +
find "${WORKDIR}" -type f -exec chmod 0644 {} +
chmod 0755 "${WORKDIR}/bin/c2-migrate.mjs" "${WORKDIR}/bin/c2-self-test.mjs"
if [[ -e "${WORKDIR}/node_modules/.bin/node-pg-migrate" ]]; then
  chmod 0755 "${WORKDIR}/node_modules/.bin/node-pg-migrate" || true
fi

ARCHIVE_NAME="titangold-c2-runner-linux-x64-node20.19.5.tar.gz"
ARCHIVE_PATH="${OUT_DIR}/${ARCHIVE_NAME}"

tar \
  --sort=name \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  --mtime="@${SOURCE_DATE_EPOCH}" \
  --mode='u=rwX,g=rX,o=rX' \
  --format=gnu \
  -C "${STAGE}" \
  -cf - \
  "${TOP}" \
  | gzip -n > "${ARCHIVE_PATH}"

ARCHIVE_SHA256="$(sha256sum "${ARCHIVE_PATH}" | awk '{print $1}')"
ARCHIVE_BYTES="$(wc -c < "${ARCHIVE_PATH}" | tr -d ' ')"
echo "${ARCHIVE_SHA256}  ${ARCHIVE_NAME}" > "${OUT_DIR}/${ARCHIVE_NAME}.sha256"

rm -rf "${STAGE}"

echo "ARCHIVE_PATH=${ARCHIVE_PATH}"
echo "ARCHIVE_SHA256=${ARCHIVE_SHA256}"
echo "ARCHIVE_BYTES=${ARCHIVE_BYTES}"
echo "SOURCE_COMMIT=${SOURCE_COMMIT}"
echo "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"
