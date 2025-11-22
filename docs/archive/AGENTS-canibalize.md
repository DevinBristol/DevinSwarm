> **Archive:** Source of truth is `CODEx_RUNBOOK.md` - this file is retained for historical reference.

# DevinSwarm — Codex Agent Guidance

## Canonical Source of Truth

- The canonical project doc is **`CODEx_RUNBOOK.md`** at repo root.
- `source-of-truth.md` is legacy and should only point at the runbook after migration.
- Codex must always:
  1. Read `CODEx_RUNBOOK.md` on startup.
  2. Extract:
     - End Goal 1 (self-iterating swarm with HITL)
     - End Goal 2 (multi-language / multi-platform, first Salesforce)
     - `CURRENT_MILESTONE`
     - `Next Steps for Codex`
  3. Use those to guide all actions.

## Doc Drift Prevention

Whenever Codex implements a feature, refactor, or significant change:

1. Check for an ExecPlan under `docs/plans/` that covers the work.
   - If there isn’t one and the work is non-trivial, create one.
2. After code changes:
   - Update `CODEx_RUNBOOK.md` if goals, milestones, or next steps changed.
   - Update the relevant ExecPlan(s) (Progress, Decisions, Outcomes).
   - Ensure `docs/INDEX.md` remains accurate.
3. If **any** doc conflicts with `CODEx_RUNBOOK.md`:
   - Prefer updating the other doc.
   - Only change the runbook if humans have consciously changed direction.

## Auto-Orientation

On *every* new Codex session in this repo, before taking user instructions:

- Read:
  - `AGENTS.md`
  - `CODEx_RUNBOOK.md`
  - `docs/INDEX.md` (if it exists)
- Summarize internally:
  - Where DevinSwarm is in the roadmap.
  - The next 2–3 “Next Steps for Codex”.
- If the user’s request conflicts with that context:
  - Propose an update to the runbook/ExecPlan first.

## End Goals (For Codex’s Decision-Making)

- Optimize for:
  - Progress toward **End Goal 1** (self-iterating swarm with HITL).
  - Progress toward **End Goal 2** (multi-language/platform, Salesforce first).
- When choosing between equivalent options:
  - Prefer the one that improves:
    - Testability
    - Observability
    - Documentation clarity
