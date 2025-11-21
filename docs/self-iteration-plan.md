# Self-Iteration Deployment Plan

This document defines the concrete steps to evolve DevinSwarm from a single "PR pinger" into a self-iterating swarm that can plan, execute, review, and improve its own changes in GitHub. Each section includes a checklist to track progress.

## Goals
- End-to-end autonomous loop: intake -> plan -> execute -> review/test -> fix/retry -> report/merge, driven by the orchestrator.
- Multiple workers with clear roles (dev, reviewer, ops) collaborating through the queue and shared state.
- Durable memory of runs, plans, artifacts, and evaluations in Postgres, plus observable events.
- Tooling to operate on a real git workspace (clone, edit, test, push) safely and repeatably.
- Guardrails (HITL, policies, repo allowlists) to avoid unsafe merges.

## Current Focus
- Land Phase 1 end-to-end: schema updates, expanded run state, `manager.graph.ts` nodes/transitions, and persisted state/events.
- Add minimal migrations plus null-safe reads to avoid breaking existing paths while fields backfill.
- Define retry policy + transition reasons per node so later HITL/policy work can subscribe without rework.

## Decisions / Defaults (current)
- Allowlist: `ALLOWED_REPOS` starts at `DevinBristol/DevinSwarm` (comma-separated to add more later); ensure `GITHUB_INSTALLATION_ID` matches allowed repos.
- Artifact storage: stay on Postgres + PR comments now; switch to MinIO/S3 when artifacts routinely exceed ~5 MB or need retention beyond 7 days (tuneable via config when added, e.g., `ARTIFACT_BLOB_THRESHOLD_BYTES`, `ARTIFACT_RETENTION_DAYS`).
- Retry/time budgets (initial): `plan` 1–2 retries at 1–2 min; `dev-execute` 1–2 retries at 10–20 min; `review` 1 retry at 10–15 min; `ops` 1–2 retries at 10–15 min. Escalate sooner on repeatable failures (e.g., lint).
- Testing bar: keep unit tests on state transitions and add a mocked end-to-end graph run after Phase 1 stabilizes to exercise intake → plan → dev → review → ops → report paths and retry/escalate edges.
- Opportunity intake: start with manual enqueue (CLI/HTTP/UI), then GitHub webhooks (PR status/test failures, new issues with labels), and optionally a scheduled sweep for stale/failed PRs.

## Open Decisions / Clarifying Questions
- [ ] Confirm the default retry/time budgets above; any node-specific caps to tighten or loosen?
- [ ] Keep `ALLOWED_REPOS` to DevinSwarm only until first self-iteration, or pre-emptively add more?
- [ ] Confirm intake ordering: manual enqueue now, GitHub webhooks next, scheduled sweep optional—any additions?

## Architecture Anchors
- Orchestrator: LangGraph state machine with branching and retries.
- Queue: Redis/BullMQ with distinct queues for dev, reviewer, ops; status events recorded in Postgres.
- Store: Postgres for runs, events, artifacts; MinIO/S3 or GitHub for larger artifacts.
- Workers: separate processes/services per role, sharing tools and policy.
- Tools: git/GitHub, filesystem, lint/test runners, RAG (optional), policy checks.

## Phases & Checklists

### Phase 1 - Orchestrator & State Model
- [ ] Extend `prisma` schema: add plan, artifacts, status history, worker assignments, and evaluation fields to `Run`/`Event`.
- [ ] Expand `orchestrator/state/runState.ts`: include repo metadata, tasks, retry counts, evaluation signals.
- [ ] Update `manager.graph.ts`: add nodes for `plan`, `dev-execute`, `review`, `ops`, `report`, `escalate`, with transitions on success/failure and retry limits.
- [ ] Persist graph state updates to Postgres between nodes (so we can resume after failures).
- [ ] Add event emissions (to DB + logs) for each node transition.

### Phase 2 - Tools & Workspace Management
- [ ] Create `/tools/git.ts` for clone/checkout/branch/diff/push operations in a per-run workspace.
- [ ] Create `/tools/fs.ts` helpers for reading/writing files safely in the workspace.
- [ ] Create `/tools/tests.ts` to run lint/tests with configurable commands and timeouts.
- [ ] Create `/tools/github.ts` wrappers for PR create/update/comment, status checks, and reviews.
- [ ] Add a workspace lifecycle: per-run temp dir, cloned repo, cleanup on completion.
- [ ] Wire tool usage into dev/reviewer workers.

### Phase 3 - Role Workers
- [ ] Dev worker: consume plan tasks, edit code in workspace, run targeted tests, push branch, open/update PR, report artifacts back to Postgres.
- [ ] Reviewer worker: pull PR diffs, run full/targeted tests, add PR comments/status; emit pass/fail back to orchestrator.
- [ ] Ops worker: watch CI/status contexts; gate merge; retry tests if flaky; surface blocking issues.
- [ ] Update `packages/shared/queue.ts`: add queues for `review` and `ops`, adjust job payloads to include repo/branch/run metadata.
- [ ] Update `package.json` scripts: add `start:reviewer-worker`, `start:ops-worker`; ensure Render blueprint includes them.

### Phase 4 - Policies, Guardrails, HITL
- [ ] Implement policy module (allowlist repos, file-path risk heuristics, budget/time limits, merge gating).
- [ ] Enforce safety checks before push/merge (branch protection awareness, low-risk heuristic fallback).
- [ ] HITL: expose `/events` or UI controls to pause/unblock runs; update orchestrator to route to `escalate` node when blocked.
- [ ] Add configs/env vars for policy tuning (e.g., `AUTO_MERGE_LOW_RISK=false` by default).

### Phase 5 - Observability & Memory
- [ ] Add artifacts table or blob store references for logs, test outputs, diffs.
- [ ] Extend `/ui` to show per-run plan, current node, artifacts, and retry counts.
- [ ] Add `/runs/:id/events` endpoint for debugging timeline.
- [ ] Emit structured logs for all worker actions (with run/branch correlation IDs).

### Phase 6 - Self-Iteration Behaviors
- [ ] Orchestrator loop: on reviewer/test failure, create new dev tasks with context from failures; limit retries.
- [ ] Auto-refresh plan if repo diverges (detect merge conflicts, rebase, re-run tests).
- [ ] Optional: RAG over previous runs/PRs/repo docs to inform planning and fixes.
- [ ] Merge path: only allow merge when reviewer + ops gates are green and policy permits.

### Phase 7 - CI/CD & Safety Nets
- [ ] Ensure CI runs lint/tests on PRs created by the swarm; surface results to orchestrator.
- [ ] Add e2e smoke test for a mock run: intake -> dev change -> reviewer test -> ops gate -> report.
- [ ] Document rollback/cleanup steps for workspaces and branches on failure.

## Environment & Config Checklist
- [ ] `.env.example` includes required GitHub App creds, Redis/Postgres URLs, and policy toggles.
- [ ] `render.yaml` includes all workers (service/dev/reviewer/ops) and required env vars.
- [ ] Local/dev scripts documented (`README.md`, `AGENTS.md`) for running all workers and orchestrator together.

## Acceptance Criteria for "Self-Iterating"
- The system can take an intake specifying a repo/task, produce a plan, apply a non-trivial code change, open a PR, run tests, react to failures by updating the PR, and only mark done after reviewer/ops gates pass.
- Runs persist state in Postgres and can be resumed after process restarts.
- All actions are observable via `/ui` or logs, with artifacts attached.
- Policy/HITL can pause or block merges; auto-merge happens only when permitted.
