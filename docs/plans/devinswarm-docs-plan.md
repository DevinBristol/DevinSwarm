> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# DevinSwarm Docs Plan

Purpose: keep documentation accurate for humans and Codex, eliminate context/scope drift, and track doc-guardrail work.

## Status
- Scope: runbook/view-doc alignment, doc index, doc-sync guardrails.
- Owner: Codex (default).
- Last updated: 2025-11-21.

## Checklist
- [x] Merge canibalized guidance into `CODEx_RUNBOOK.md` and align `AGENTS.md`.
- [x] Create `docs/INDEX.md` with canonical doc links and key runtime references.
- [x] Add this doc plan to track progress.
- [x] Add a doc sync/check script (e.g., `check:sot`) and wire it into CI.
- [x] Provide a pre-push hook sample to run `npm run check:sot`.
- [ ] Keep `SWARM_PING.md` and recent smoke logs current alongside runbook updates.

## Progress log
- 2025-11-21: Merged canibalized runbooks into `CODEx_RUNBOOK.md`, refreshed `AGENTS.md`, created `docs/INDEX.md`, and captured this plan to track ongoing doc guardrails.
- 2025-11-21: Added `scripts/check-sot-updated.mjs` (wired to `npm run check:sot`), enabled in CI, and added pre-push hook samples for local enforcement.
- 2025-11-21: Implemented HITL unblock resume enqueue + resume test (`npm run test:orchestrator`); pending smoke log updates.
