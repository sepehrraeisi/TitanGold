#!/usr/bin/env bash
# Verify a C2 runner capsule archive before trusting extracted executables.
# No DB connection. No npm/npx.
set -euo pipefail

ARCHIVE="${1:-}"
EXPECTED_SHA="${2:-}"
EXTRACT_ROOT="${3:-}"

if [[ -z "${ARCHIVE}" ]]; then
  echo "C2_CAPSULE_SHA_MISMATCH: usage: verify-artifact.sh <archive> [expected-sha] [extract-dir]" >&2
  exit 1
fi

if [[ ! -f "${ARCHIVE}" || -L "${ARCHIVE}" ]]; then
  echo "C2_CAPSULE_SHA_MISMATCH: archive must be a regular file" >&2
  exit 1
fi

ACTUAL_SHA="$(sha256sum "${ARCHIVE}" | awk '{print $1}')"
if [[ -n "${EXPECTED_SHA}" && "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]]; then
  echo "C2_CAPSULE_SHA_MISMATCH: expected ${EXPECTED_SHA} got ${ACTUAL_SHA}" >&2
  exit 1
fi

if [[ -z "${EXTRACT_ROOT}" ]]; then
  EXTRACT_ROOT="$(mktemp -d /tmp/c2-capsule-extract-XXXXXX)"
fi
if [[ -e "${EXTRACT_ROOT}" && "$(ls -A "${EXTRACT_ROOT}" 2>/dev/null || true)" != "" ]]; then
  echo "C2_CAPSULE_UNSAFE_SYMLINK: extract directory must be empty" >&2
  exit 1
fi
mkdir -p "${EXTRACT_ROOT}"

python3 - "${ARCHIVE}" "${EXTRACT_ROOT}" <<'PY'
import os
import sys
import tarfile

archive, dest = sys.argv[1], sys.argv[2]
unsafe = []

def fail(code, detail):
    print(f"{code}: {detail}", file=sys.stderr)
    sys.exit(1)

with tarfile.open(archive, "r:gz") as tf:
    members = tf.getmembers()
    if not members:
        fail("C2_CAPSULE_MANIFEST_MISMATCH", "empty archive")
    tops = {m.name.split("/")[0] for m in members if m.name and m.name != "."}
    if tops != {"titangold-c2-runner"}:
        fail("C2_CAPSULE_MANIFEST_MISMATCH", f"top-level members {sorted(tops)}")
    names = set()
    for m in members:
        name = m.name
        if name.startswith("/") or name.startswith("\\"):
            fail("C2_CAPSULE_UNSAFE_SYMLINK", f"absolute member {name}")
        if name.startswith("../") or "/../" in f"/{name}/" or name.endswith("/.."):
            fail("C2_CAPSULE_UNSAFE_SYMLINK", f"traversal member {name}")
        if os.path.isabs(name) or os.path.normpath(name).startswith(".."):
            fail("C2_CAPSULE_UNSAFE_SYMLINK", f"normalized escape {name}")
        if m.issym() or m.islnk():
            link = m.linkname or ""
            if os.path.isabs(link) or link.startswith("/"):
                fail("C2_CAPSULE_UNSAFE_SYMLINK", f"unsafe link {name} -> {link}")
            link_resolved = os.path.normpath(os.path.join(os.path.dirname(name), link))
            if link_resolved.startswith("..") or not (
                link_resolved == "titangold-c2-runner"
                or link_resolved.startswith("titangold-c2-runner/")
            ):
                fail("C2_CAPSULE_UNSAFE_SYMLINK", f"link escape {name} -> {link}")
        if m.isdev() or m.isfifo() or (hasattr(m, "issocket") and m.issocket()):
            fail("C2_CAPSULE_UNSAFE_SYMLINK", f"device/fifo/socket {name}")
        mode = m.mode or 0
        if mode & 0o4000 or mode & 0o2000:
            fail("C2_CAPSULE_UNSAFE_SYMLINK", f"setuid/setgid {name}")
        if m.isfile() and name.endswith("052_telegram_messages_channel_message_id_index.js"):
            fail("C2_CAPSULE_SELF_TEST_FAILED", "archive contains canonical 052")
        names.add(name)
    tf.extractall(dest, numeric_owner=True)

print("EXTRACT_OK members={0}".format(len(members)))
PY

CAPSULE="${EXTRACT_ROOT}/titangold-c2-runner"
if [[ ! -d "${CAPSULE}" ]]; then
  echo "C2_CAPSULE_MANIFEST_MISMATCH: extracted capsule root missing" >&2
  exit 1
fi

if [[ -n "${NODE_PATH:-}" ]]; then
  echo "C2_CAPSULE_MODULE_ESCAPE: NODE_PATH must be unset during verify" >&2
  exit 1
fi

unset NODE_PATH || true

node "${CAPSULE}/bin/c2-self-test.mjs"

echo "VERIFY_OK"
echo "EXTRACT_DIR=${EXTRACT_ROOT}"
echo "CAPSULE_DIR=${CAPSULE}"
echo "ARCHIVE_SHA256=${ACTUAL_SHA}"
