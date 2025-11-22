> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Swarm Ping (status snapshot)

- **End Goals:** End Goal 1 in progress; End Goal 2 not started.
- **Current milestone:** M1 - Orchestrator & State Model. Graph + queues + service + dev/review/ops workers are wired; HITL stub blocks on missing secrets/test failures; resume after unblock is manual/pending.
- **HITL/unblock:** Runs enter `awaiting_unblock` on HITL triggers. Unblock via `POST /runs/:id/unblock` with `x-ui-token` (same token used by `/ui` button).
- **Smoke tests:** No fresh local/Render smoke log recorded after the repo reset; rerun using `DEVINSWARM_RENDER_NEXT_STEPS.md` and capture the log.
- **More detail:** See `CODEx_RUNBOOK.md` (roadmap, active work items, and milestones).
