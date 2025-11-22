> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Local Smoke Log - 2025-11-22

Commands (repo root):
- `npm run test:orchestrator`
- `npm run test:orchestrator-transitions`

Results:
- `test:orchestrator` — pass (`orchestrator resume test passed`; `orchestrator event + HITL tests passed`).
- `test:orchestrator-transitions` — pass (covers node order, blocked history, and retry caps for plan/dev/review/ops).

Notes:
- Tests run via `scripts/run-ts-node.js` (ts-node transpile-only); tsx/esbuild dependency removed to avoid Windows EPERM spawn issues.
- Use `npm run ci:install` (`npm ci --ignore-scripts --prefer-offline --no-audit --progress=false`) for Cloud/CI to avoid `msgpackr` prepare failures.
