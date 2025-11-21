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
- Reviewer and ops stubs emit test/status events using the stubbed `runTests` helper (no real tests yet).
