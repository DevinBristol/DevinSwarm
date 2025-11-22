> **Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.**

# Agent Roles (M1 snapshot)

This summarizes the current roles while we are in M1 (Orchestrator & State Model). Full definitions, roadmap, and changes live in `CODEx_RUNBOOK.md` sections 2, 3, and 7.

## Startup orientation (every session)
- Read `CODEx_RUNBOOK.md`, this file, and `docs/INDEX.md` before acting.
- Extract: End Goals, `CURRENT_MILESTONE`, `STATUS_SUMMARY`, `BLOCKERS`, `Active work items`, and `Next Steps for Codex`.
- Map incoming work to the runbook; if it conflicts, update the runbook first.

## Doc-sync responsibilities
- Keep docs in lockstep with behavior: runbook first for scope/status changes, then `AGENTS.md`, `SWARM_PING.md`, `DEVINSWARM_RENDER_NEXT_STEPS.md`, and `docs/plans/devinswarm-docs-plan.md` as needed.
- Maintain the SOT banner on focused docs; avoid creating separate plans outside the runbook.
- Check for an ExecPlan under `docs/plans/` for non-trivial work; create/update it when missing.
- When adding non-trivial features or refactors, ensure the runbook and prompts/role definitions reflect the change in the same commit.

## Current roles
- **Manager / orchestrator**: `orchestrator/graph/manager.graph.ts` drives `intake -> plan -> dev -> review -> ops -> report` with retries; `orchestrator/index.ts` persists runs and events.
- **Dev worker**: `apps/worker/src/worker.ts` clones via GitHub App, enforces `ALLOWED_REPOS`, scaffolds a branch/PR, emits events, and hands off to the reviewer queue. Honors HITL blocks when secrets are missing or errors repeat.
- **Reviewer worker**: `apps/worker/src/reviewer.ts` runs `REVIEWER_COMMAND` (default `npm run build`), sets commit status (`swarm/review` by default), posts PR comments, and enqueues ops. Blocks on failures and HITL triggers.
- **Ops worker**: `apps/worker/src/ops.ts` runs `OPS_COMMAND`, sets commit status (`swarm/ops`), and marks runs done (manual merge for now). Blocks on failures and HITL triggers.
- **Scout**: `apps/scout/src/scout.ts` opens an improvement issue (stub; schedule/cron to be added in later milestones).
- **Research / additional agents**: reserved for later milestones (see roadmap).

## Prompts and config
- Prompts: `prompts/manager.md` and `prompts/workers/dev.md` (stubs to expand in M2).
- Env/config: GitHub App fields (`GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`), `ALLOWED_REPOS`, `AUTO_MERGE_LOW_RISK`, `REVIEWER_COMMAND`, `OPS_COMMAND`, `UI_TOKEN`. Workers log env presence but never secrets.

## HITL and reservations
- HITL policy is in `orchestrator/policies/hitl.ts` (missing secrets, destructive changes, repeated test failures, ambiguous spec). Runs enter `awaiting_unblock`; unblock via `POST /runs/:id/unblock` with `x-ui-token`.
- Resume trigger after unblock is still manual/pending (see runbook active work items).

## Pointers
- Roadmap, milestone status, and active work items: `CODEx_RUNBOOK.md`.
- Doc index and doc plan: `docs/INDEX.md`, `docs/plans/devinswarm-docs-plan.md`.
- Render/local deployment quick steps: `DEVINSWARM_RENDER_NEXT_STEPS.md`.
