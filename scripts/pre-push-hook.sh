#!/usr/bin/env bash
# Sample pre-push hook to enforce doc/runbook sync locally.
# Install: ln -s ../../scripts/pre-push-hook.sh .git/hooks/pre-push

set -euo pipefail

echo "[pre-push] running npm run check:sot"
npm run check:sot

echo "[pre-push] done"
