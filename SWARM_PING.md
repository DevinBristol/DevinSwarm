> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Swarm Ping (status snapshot)

- **End Goals:** End Goal 1 in progress; End Goal 2 not started.
- **Current milestone:** M1 - Orchestrator & State Model. Graph + queues + service + dev/review/ops workers are wired; HITL blocks on missing secrets/test failures; unblock now requeues the correct worker stage automatically.
- **HITL/unblock:** Runs enter `awaiting_unblock` on HITL triggers. Unblock via `POST /runs/:id/unblock` with `x-ui-token` (same token used by `/ui` button); GitHub issue labels/comments hitting `/unblock` also resume.
- **Smoke tests:** Local smoke run complete: `0f92821d-ad1c-4566-b31a-bf3f9a86b93d` (description: "Smoke test via CLI") completed through report. Render smoke run `64addeb2-46ae-4092-ba6d-d9ed15248568` hit reviewer OOM (`HITL: repeated-test-failures`); manual unblock leaves it in review blocked—heap bump applied in reviewer/ops defaults, re-run needed.
- **More detail:** See `CODEx_RUNBOOK.md` (roadmap, active work items, and milestones).
