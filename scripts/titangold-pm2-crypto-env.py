#!/usr/bin/env python3
"""Print MASTER_KEY* shell assignments from live titan-backend PM2 env. Do not log stdout."""
import json
import subprocess
import sys


def esc(value: str) -> str:
    return value.replace("'", "'\"'\"'")


def main() -> int:
    pm2_user = sys.argv[1] if len(sys.argv) > 1 else "ubuntu"
    try:
        raw = subprocess.check_output(
            ["sudo", "-u", pm2_user, "-H", "bash", "-lc", "pm2 jlist"],
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(f"ERROR: pm2 jlist failed ({exc.returncode})\n")
        return 1

    try:
        processes = json.loads(raw)
    except json.JSONDecodeError:
        sys.stderr.write("ERROR: pm2 jlist returned invalid JSON\n")
        return 1

    proc = next(
        (
            p
            for p in processes
            if p.get("name") == "titan-backend"
            and p.get("pm2_env", {}).get("status") == "online"
        ),
        None,
    )
    if not proc:
        proc = next((p for p in processes if p.get("name") == "titan-backend"), None)
    if not proc:
        sys.stderr.write("ERROR: titan-backend not found in pm2 jlist\n")
        return 1

    env = proc.get("pm2_env") or {}
    master_key = env.get("MASTER_KEY") or ""
    if not master_key:
        sys.stderr.write("ERROR: MASTER_KEY missing from live titan-backend env\n")
        return 1

    print(f"MASTER_KEY='{esc(master_key)}'")
    previous = env.get("MASTER_KEY_PREVIOUS") or ""
    if previous:
        print(f"MASTER_KEY_PREVIOUS='{esc(previous)}'")
    mode = env.get("MASTER_KEY_WRITE_MODE") or ""
    if mode:
        print(f"MASTER_KEY_WRITE_MODE='{esc(mode)}'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
