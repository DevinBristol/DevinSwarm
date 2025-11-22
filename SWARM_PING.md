> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Swarm Ping (status snapshot)

- **End Goals:** End Goal 1 in progress; End Goal 2 not started.
- **Current milestone:** M1 - Orchestrator & State Model. Graph + queues + service + dev/review/ops workers are wired; HITL blocks on missing secrets/test failures; unblock now requeues the correct worker stage automatically. Transition tests cover plan/dev/review/ops retry caps and blocked history; latest local smoke log: `docs/logs/local-smoke-2025-11-22.md`.
- **HITL/unblock:** Runs enter `awaiting_unblock` on HITL triggers. Unblock via `POST /runs/:id/unblock` with `x-ui-token` (same token used by `/ui` button); GitHub issue labels/comments hitting `/unblock` also resume.
- **Runtime note:** `scripts/run-ts-node.js` (ts-node transpile-only) now used; `tsx` dependency removed to avoid Windows EPERM spawns. For Cloud/CI, install with `npm run ci:install` (`npm ci --ignore-scripts --prefer-offline --no-audit --progress=false`) until `msgpackr` prepare is patched.
- **Iteration:** Retry-limit failures trigger a replan loop with a max of 2 iterations (logged in status history/events) to progress without manual unblock when safe.
- **Smoke tests:** Local smoke run complete: `0f92821d-ad1c-4566-b31a-bf3f9a86b93d` (description: "Smoke test via CLI") completed through report; latest local test log in `docs/logs/local-smoke-2025-11-21.md`. Render smoke success: `1eaab2fd-5760-4e2d-a798-74e1727c17e3` (review/ops done, PR #19) and `f36544e0-f8cb-4487-8c8a-9e8e3d532bfc` after low-heap tuning. Older OOM run `64addeb2-46ae-4092-ba6d-d9ed15248568` archived/closed.
- **More detail:** See `CODEx_RUNBOOK.md` (roadmap, active work items, and milestones).
