> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Local Smoke Log - 2025-11-21

Commands executed from repo root:
- `npm run test:orchestrator`
- `npm run test:orchestrator-transitions`

Results:
- `npm run test:orchestrator` → passed (`orchestrator resume test passed`, `orchestrator event + HITL tests passed`).
- `npm run test:orchestrator-transitions` → passed (`orchestrator transition tests passed`).

Notes:
- Tests now use `scripts/run-ts-node.js` (ts-node transpile-only) to avoid the esbuild/tsx spawn error on this Windows environment.
- npm emits a Windows-only warning after completion (`CALL "C:\Program Files\nodejs\\node.exe" "C:\Program Files\nodejs\\node_modules\npm\bin\npm-prefix.js" is not recognized...`), but both commands exited 0.
