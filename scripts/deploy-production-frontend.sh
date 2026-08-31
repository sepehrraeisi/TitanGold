#!/usr/bin/env bash
# LEGACY PRODUCTION FRONTEND DEPLOY — PERMANENTLY REFUSED (Core Rule §109).
#
# Incident class: `npm run build` from /home/ubuntu/webapp/TitanGold while
# nginx root is /home/ubuntu/webapp/TitanGold/dist overwrote live dist from a
# dirty worktree. This script MUST NEVER rebuild from the live production
# worktree and MUST NEVER reload nginx as a side effect of an in-tree build.
#
# Supported flow:
#   1. Isolated clean worktree from a named commit
#   2. scripts/release-frontend-build.sh   (non-live staging outDir)
#   3. scripts/activate-frontend-dist.sh   (backup live dist FIRST, then activate)
#
# Future production-root marker (Owner-gated; NOT executed by this task):
#   printf 'PRODUCTION_ROOT=YES\n' > /home/ubuntu/webapp/TitanGold/.titangold-production-root
#   chmod 0644 /home/ubuntu/webapp/TitanGold/.titangold-production-root
#   # do not git-add the marker
set -euo pipefail

printf '%s\n' \
  'REFUSED: LIVE_WORKTREE_DEPLOY_BUILD_FORBIDDEN' \
  'scripts/deploy-production-frontend.sh no longer builds or reloads nginx.' \
  'Do not run npm run build from /home/ubuntu/webapp/TitanGold.' \
  'Use:' \
  '  scripts/release-frontend-build.sh' \
  '  scripts/activate-frontend-dist.sh <artifact-dist-dir>' \
  >&2
exit 2
