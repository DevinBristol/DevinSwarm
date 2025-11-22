# DevinSwarm - CODEx Runbook (Source of Truth)

> This runbook is the canonical, up-to-date description of:
> - Project goals and roadmap
> - Current stage and next steps
> - Agent roles and responsibilities
> - Documentation layout and invariants
> - Platform path (Salesforce first)
>
> All other docs and scripts are subordinate to this file. Start here before changing code or docs.

## 1. End Goals

### 1.1 End Goal 1 - Self-Iterating DevinSwarm with HITL

DevinSwarm is a multi-agent orchestrator (LangGraph JS, Node 20+, Redis + Postgres) that plans work, dispatches to workers, iterates, and surfaces changes with human-in-the-loop gates.

**Definition of Done**
- [ ] Orchestrator and workers run continuously (local and Render) handling multiple queued tasks with durable state.
- [ ] Run state, events, and artifacts persist safely with retention defaults enforced (`ARTIFACT_BLOB_THRESHOLD_BYTES`, `ARTIFACT_RETENTION_DAYS`) and resumability tested.
- [ ] Agent roles and prompts are documented and kept in sync in this runbook and `AGENTS.md`.
- [ ] Standard lifecycle (intake -> plan -> dev -> review -> ops -> report/escalate) is observable via UI/logs and events.
- [ ] HITL gates are configurable, pause runs cleanly, and unblock paths are documented and tested.
- [ ] Self-iteration policy is documented and exercised on a real run with guardrails to avoid infinite loops.

### 1.2 End Goal 2 - Multi-Language / Multi-Platform Solutions (Salesforce First)

DevinSwarm should understand platform targets, select the right tools/pipelines, and ship artifacts/tests for that platform. First focus: Salesforce DX (Apex/metadata).

**Definition of Done**
- [ ] Platform abstraction is documented (inputs, tools, build/test/deploy).
- [ ] Platform selection rules (intake metadata, repo signals, explicit config) are documented and used by workers.
- [ ] Salesforce DX path is implemented and used in production runs (branch + validation + deploy flow).
- [ ] DevinSwarm can handle at least one additional non-Salesforce platform path.
- [ ] CI/CD hooks and worker behaviors adapt per platform.

## 2. Roadmap & Milestones

**M0 - Documentation & Context System (Drift Guardrails)**
- [x] Migrate legacy source-of-truth docs into `CODEx_RUNBOOK.md` and stub legacy pointers.
- [x] Keep `AGENTS.md` aligned with runbook startup/responsibility rules and doc-drift prevention.
- [x] Add and maintain `docs/INDEX.md` covering the runbook, `AGENTS.md`, doc plans, and key deployment/runtime docs.
- [x] Maintain `docs/plans/devinswarm-docs-plan.md` with progress for doc-sync work.
- [x] Add an automated doc sync/check script (`check:sot`); wired into CI and available as a pre-push hook sample.

**M1 - Orchestrator & State Model (Phase 1)**
- [x] Define run input/state schemas with zod in `orchestrator/state` and align Prisma schema for runs/events.
- [x] Build LangGraph path `intake -> plan -> dev-execute -> review -> ops -> report` with retry caps and step logs.
- [x] Persist graph history and events to Postgres; map graph status to Prisma run state.
- [x] Wire BullMQ queues and Fastify service endpoints (`/intake`, `/runs`, `/runs/:id/unblock`, `/ui`).
- [x] Scaffold dev/reviewer/ops workers with queue handoffs, GitHub App integration, and `ALLOWED_REPOS` guard.
- [x] HITL policy stub for missing secrets/test failures plus UI unblock endpoint.
- [ ] Automated tests for orchestrator transitions, retry limits, and HITL/resume flows.
- [ ] Document the state model and event schema (Prisma + docs) and clarify retry budgets.
- [x] Add an integration test that simulates a mid-run crash and verifies resumability from the DB (`npm run test:orchestrator`).
- [x] Document and script the resume trigger after `awaiting_unblock` (queue kick + state resume).
- [ ] Capture a fresh local smoke test log for the M1 stack (service + workers + queue + DB).

**M2 - Agent Roles & Graph Stabilized**
- [ ] Harden prompts and role definitions; codify expected inputs/outputs per node.
- [ ] Add reservation/assignment metadata in state and enforce re-entrancy across workers.
- [ ] Expand manager graph to replan/retry and emit richer events for UI/observability.

**M3 - HITL & Self-Iteration Loop**
- [ ] Implement end-to-end escalation UI (ChatKit/GitHub) with `/events/chatkit` handling unblock commands.
- [ ] Encode self-iteration policy and safety limits; loop through plan/dev/review automatically when needed.
- [ ] Add observability: event stream in UI and metrics for blocked/failed/retried runs.

**M4 - Salesforce Platform Path**
- [ ] Define platform abstraction and Salesforce platform module/prompt path.
- [ ] Add Salesforce DX workspace bootstrap and tests; document the pipeline.
- [ ] Run a Salesforce-targeted intake end-to-end.

**M5 - Multi-Platform Growth**
- [ ] Add at least one additional language/platform path.
- [ ] Generalize platform selection from intake and repository context.
- [ ] Extend CI/CD and worker behaviors per platform.

## 3. Current Stage & Next Steps

- **Current milestone:** M1 - Orchestrator & State Model (Phase 1).
- **Status summary:** Graph + Postgres + Redis + Fastify service + dev/review/ops workers are wired. HITL blocks on missing secrets/test failures; unblock now requeues the correct worker stage automatically. Basic resume test exists (`npm run test:orchestrator`); fuller transition tests still pending. Local smoke run completed (id `0f92821d-ad1c-4566-b31a-bf3f9a86b93d`). Render smoke runs: `64addeb2-46ae-4092-ba6d-d9ed15248568` and `f36544e0-f8cb-4487-8c8a-9e8e3d532bfc` hit reviewer OOM on 512MB instances; defaults now use a low-heap tsc (`node --max-old-space-size=384 ... --skipLibCheck --pretty false`) for reviewer/ops, redeploy + rerun needed.
- **Blockers:** GitHub App secrets are present locally/Render. Redis/Postgres must be running. Render smoke needs unblock/resolution for review test failures.
- **Active work items:**
  - [ ] Add automated tests for `orchestrator/graph/manager.graph.ts` covering retry caps, status transitions, and event persistence.
  - [ ] Capture a current local smoke test log and link it here and in `SWARM_PING.md`.

### Next Steps for Codex

Default actions to pick up next:
- [ ] Expand orchestrator transition tests (retry caps, HITL paths) beyond the new `npm run test:orchestrator`.
- [ ] Redeploy with reviewer/ops low-heap tsc defaults and rerun Render smoke (blocked runs `64addeb2-46ae-4092-ba6d-d9ed15248568`, `f36544e0-f8cb-4487-8c8a-9e8e3d532bfc`); capture outcome. Local smoke recorded (`0f92821d-ad1c-4566-b31a-bf3f9a86b93d`).

## 4. Repo Map & Documentation Layout

- `apps/service/src/server.ts` - Fastify HTTP service (`/health`, `/intake`, `/runs`, `/ui`, unblock endpoint) using Prisma.
- `apps/service/src/webhooks.ts` - GitHub webhook handler stub (signature verification ready).
- `apps/worker/src/worker.ts` - Dev worker: GitHub App branch/PR scaffold, events, HITL guard, handoff to reviewer.
- `apps/worker/src/reviewer.ts` - Reviewer worker: runs `REVIEWER_COMMAND` (default `npm run build`), sets commit status, enqueues ops.
- `apps/worker/src/ops.ts` - Ops worker: runs `OPS_COMMAND`, sets commit status, and marks runs done (manual merge for now).
- `apps/scout/src/scout.ts` - Scout worker stub opening improvement issues.
- `orchestrator/graph/manager.graph.ts` - LangGraph state machine for intake -> plan -> dev -> review -> ops -> report.
- `orchestrator/index.ts` - Bridges graph state with Prisma runs/events and queue history.
- `orchestrator/state` - zod schemas for run input/state.
- `orchestrator/policies/hitl.ts` - HITL evaluation and reservation helpers.
- `runtime/queue/queue.ts` and `packages/shared/queue.ts` - BullMQ queue factories and shared queue clients.
- `packages/shared/github.ts` - GitHub App client helpers (Octokit).
- `tools/fs.ts`, `tools/tests.ts` - Workspace helpers and test runner wrapper.
- `prompts/manager.md`, `prompts/workers/dev.md` - Current prompt stubs; expand per milestones.
- `devinswarm_codex_bootstrap.md` - Codex contract and bootstrap ritual (doc discipline, startup steps).
- `infra/docker-compose.dev.yml` - Local Redis + Postgres.
- `render.yaml` - Render blueprint for service/workers/Redis/Postgres.
- `docs/INDEX.md` - Index of the canonical docs and focused views.
- View docs: `README.md` (entry), `AGENTS.md`, `DEVINSWARM_RENDER_NEXT_STEPS.md`, `SWARM_PING.md`, `docs/plans/devinswarm-docs-plan.md`, `docs/*` (archived pointers). All defer to this runbook.

## 5. Codex Startup Routine (Self-Onboarding)

1. Bootstrap the environment if stale:
   - `npm ci`
   - `docker compose -f infra/docker-compose.dev.yml up -d`
   - `npm run db:generate` && `npm run db:push` if Prisma schema changed.
   - Run `npm run bootstrap:codex` if present. Avoid destructive resets (e.g., `CODEX_RESET_TO_ORIGIN_MAIN`) unless explicitly instructed.
2. Identify context:
   - Confirm you are in `DevinBristol/DevinSwarm`.
   - Spot-check the repo map against section 4.
3. Load guidance:
   - Read `CODEx_RUNBOOK.md`, `AGENTS.md`, and `docs/INDEX.md`.
   - Extract End Goals, `CURRENT_MILESTONE`, `STATUS_SUMMARY`, `BLOCKERS`, `Active work items`, and `Next Steps for Codex`.
4. Align the request:
   - Map the incoming task to a milestone/work item; if it conflicts with the runbook, update the runbook first.
5. Gather local context based on milestone focus:
   - M0/M1: orchestrator, runtime, Prisma, queue wiring, UI endpoints.
   - M2: tools/workspace management.
   - M3: prompts and agent role definitions.
   - M4/M5: HITL surfaces, platform modules, CI/CD hooks.
6. Plan, then execute:
   - Write a short plan tied to the relevant work item, implement, and keep docs aligned as you go.
7. After implementation:
   - Run relevant checks (build/tests/smoke).
   - Update this runbook, `AGENTS.md`, `SWARM_PING.md`, `DEVINSWARM_RENDER_NEXT_STEPS.md`, and `docs/plans/devinswarm-docs-plan.md` when applicable.

## 6. Documentation Update Rules

- **Runbook first:** Any change to goals, roadmap, status, roles, or platform behavior lands here before touching code.
- **Single source-of-truth principle:** All focused docs must carry the banner "Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook." No separate plans live outside this file.
- **Session ritual:** At the start of work, skim this runbook and `AGENTS.md`; keep `Active work items` and `Next Steps for Codex` current. If reality changes, edit the runbook immediately.
- **Docs + code together:** Ship doc updates in the same commit/PR as behavior changes. Doc-only syncs are allowed to repair drift.
- **Guardrails and checks:** Maintain `docs/INDEX.md`, keep `docs/plans/devinswarm-docs-plan.md` up to date, and add/enable a `check:sot` (or similar) script/CI step to catch drift.

## 7. Encoding End Goal 1 (Self-Iterating Swarm with HITL)

- **Orchestrator path:** `orchestrator/graph/manager.graph.ts` encodes intake -> plan -> dev -> review -> ops -> report with retry caps and step logs.
- **State persistence:** `orchestrator/index.ts` maps graph status to Prisma run state (`Run.state`, `statusHistory`, `events`) in Postgres.
- **Queue + workers:** BullMQ queues live in `packages/shared/queue.ts`; dev/reviewer/ops workers process runs and hand off queues.
- **HITL:** `orchestrator/policies/hitl.ts` triggers blocks for missing secrets, destructive changes, repeated test failures, or ambiguous specs. `/runs/:id/unblock` clears `awaiting_unblock`; resume trigger is pending.
- **UI/observability:** `/ui` lists runs and events; events are also persisted for future streaming.
- **Repo access:** Workers clone via GitHub App credentials, create branches/PRs, and post commit statuses/comments.
- **Artifacts and retention:** Default limits `ARTIFACT_BLOB_THRESHOLD_BYTES=5000000`, `ARTIFACT_RETENTION_DAYS=7`; shift large/long-lived blobs to external storage when needed.
- **Global rules:** Escalate before reallocating blocked work, design for 24/7 concurrent runs, and require tests/linters/security checks plus human approval before merging to `main`.
- **Escalation template:** When blocked, post a concise request:
  > **Escalation: {reason}**  
  > **Run/Issue:** {id or link}  
  > **What I need:**  
  > 1. {Secret or account} and where to create it.  
  > 2. {Permission} to grant and to which GitHub App/token.  
  > 3. {Approval or policy decision} required.  
  >  
  > I will resume automatically after you mark this escalation unblocked (via UI or unblock comment).

## 8. Encoding End Goal 2 (Multi-Platform, Salesforce First)

- Platform abstraction and Salesforce path are not yet implemented. Next steps:
  - Define what a platform means here: languages, tools/CLIs, build/test/deploy pipeline, constraints, and where prompts/config live.
  - Document selection rules (intake metadata, repo signals, explicit config) and route workers/CI accordingly.
  - Add Salesforce DX workspace bootstrap, commands, prompts, and required env/secrets; capture validation/quick-deploy expectations.
  - Extend workers to route platform-specific tasks and CI hooks; add tests for the Salesforce path.
  - Choose and document the next non-Salesforce platform and how to add new platforms step-by-step.

## 9. Git & Commit Discipline

- Use conventional, imperative commits (e.g., `feat(orchestrator): log retry caps`).
- Couple code and doc updates; do not merge behavior changes without updating this runbook and view docs.
- Keep commits atomic and reference milestones/work items when possible.

## 10. Historical Context & Appendices

### 10.1 Legacy v2 PR plan (reference only)
- PR #1: Orchestrator skeleton (Postgres store, Redis queue, one dev worker, local/run instructions). Acceptance: service + one dev worker run concurrently; dummy job flows end-to-end.
- PR #2: HITL + ChatKit escalation endpoint and UI. Acceptance: forced block visible in HITL UI/GitHub comment with an unblock interaction that resumes the run.
- PR #3: Reviewer + Ops workers and CI wiring. Acceptance: test PR triggers reviewer then ops; CI passes; merge requires human approval.
- PR #4: Improvement-scout worker and scheduled suggestions. Acceptance: scout opens at least one actionable suggestion issue/PR based on prior runs.
- PR #5: Postgres + Helm/production hardening. Acceptance: helm/compose validate; service + worker come up and queues process jobs.

### 10.2 Decisions (2025-11-21)
- Allowlist starts with `DevinBristol/DevinSwarm`; ensure installation ID matches.
- Short-term artifacts stay in Postgres/PR comments; move large/long retention blobs to S3/MinIO later.
- Initial retry budgets: plan 1-2; dev 1-2; review 1; ops 1-2; escalate sooner on repeatable failures.

### 10.3 Risks / unknowns
- Confirm resumability and per-node persistence behavior under mid-run crashes.
- Ensure migrations and app code are aligned with the event/state schema.
- Manage drift risk by enforcing SOT checks and PR template requirements.

### 10.4 Open questions
- Keep repo allowlist to DevinSwarm only until first self-iteration, or expand sooner?
- Tighten or loosen node-specific retry caps beyond the initial defaults?

### 10.5 Session log (newest first)
- 2025-11-21: Phase 1 persistence/events/resume added (per-node state, structured events, timestamps, retry-limited nodes, deduped orchestrator entry). Single SOT established with guardrails (PR template, checks).
- 2025-11-21: Created initial SOT on `main`, archived prior plan docs, and added bootstrap/guardrail instructions.

### 10.6 Backlog / later phases (legacy phrasing)
- Phase 2: Tools and workspace management (git/fs/tests/github wrappers, per-run workspace lifecycle).
- Phase 3: Role workers (dev/reviewer/ops queues and scripts).
- Phases 4-6: Policies/HITL, observability, self-iteration behaviors.
- Phase 7: CI/CD safety nets and end-to-end smoke tests.

Earlier docs now live under `docs/archive/*`; they should not diverge from this runbook.
