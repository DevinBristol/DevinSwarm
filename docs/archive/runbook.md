# DevinSwarm Runbook

This file mirrors the high‑level operator runbook defined in `CODEx_RUNBOOK.md`.

- For detailed step‑by‑step operator instructions, see `CODEx_RUNBOOK.md` at the repo root.
- For architectural context, see `docs/design.md`.

As we implement the 5‑PR plan described in `CODEx_RUNBOOK.md`, this file can be expanded with:

- Links to relevant PRs and CI runs.
- Notes about secrets and escalation points.
- Operational tips for running DevinSwarm locally and in the cloud.

## Current implementation notes
- Dev worker invokes the LangGraph orchestrator to capture plan/log events per run without altering the existing queue flow.
- Per-run workspaces are allocated in temp storage and cleaned up after the dev worker finishes.
- Reviewer and ops stubs skip the GitHub secret HITL precheck until those secrets are configured for those workers in Render.
- Intake triggers the orchestrator graph (intake -> plan -> assign -> report) and records orchestrator/log events alongside the queue handoff.
- `/ui` now includes a Recent Events table to inspect HITL, orchestrator, and workspace logs.
- Reviewer and ops workers now run configurable commands (defaults to `npm run build`), set commit statuses (`swarm/review`, `swarm/ops`), and comment on PRs; failures block the run and emit HITL events.

### Handoff snapshot (2025-11-21)
- Render service URL: `https://devinswarm-service-g5e2.onrender.com/`.
- Active run to resume: `e2301a55-9302-46b3-b009-84281a6b3fcf` (branch `swarm/run-e2301a55`, PR #16) is blocked in `review` because reviewer command OOM’d during `npm run build` (`tsc --noEmit`), emitting `hitl:escalated`.
- To retry, either unblock the run via `/runs/:id/unblock` after adjusting `REVIEWER_COMMAND` or `NODE_OPTIONS=--max-old-space-size=1024`, or enqueue a fresh run with a lighter reviewer/ops command.
