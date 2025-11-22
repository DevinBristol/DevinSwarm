> **Archive:** Source of truth is `CODEx_RUNBOOK.md` - this file is retained for historical reference.

# DevinSwarm – CODEx Runbook (Canibalize this)

> This runbook is the canonical, up-to-date description of:
> - Project goals and roadmap
> - Current phase, milestone, and next steps
> - Agent roles and responsibilities
> - Documentation layout and invariants
> - Supported / planned platforms (Salesforce first) and future platform strategy  
>  
> It **merges and supersedes**:
> - The previous `CODEx_RUNBOOK.md` (“DevinSwarm v2 – Codex Operator Script”)
> - `docs/source-of-truth.md` (“DevinSwarm Source of Truth (main)”)  
>  
> All other docs and scripts are **subordinate** to this file.

Codex and humans must treat this document as the **single source of truth** for goals, plan, scope, and status. Any change to direction, milestones, or behavior must be reflected here first, then propagated to code and other docs.

---

## 1. End Goals

### 1.1 End Goal 1 – Self-Iterating DevinSwarm with HITL

**High-level:**  

DevinSwarm is a Node 20+ TypeScript multi-agent orchestrator built around **LangGraph JS**, **Postgres (Prisma)**, and **Redis**. It must:

- Accept intake tasks (via HTTP/API/UI).
- Plan work and dispatch to dev / reviewer / ops / research / scout agents.
- Run a **multi-step graph** (intake → plan → dev-execute → review → ops → report/escalate).
- Persist run state, events, and artifacts durably.
- Expose the run lifecycle via `/ui` and APIs.
- Use **human-in-the-loop (HITL)** for risky or policy-bound steps.
- Iterate on solutions safely (automatic retries, re-planning) without getting stuck.

**Definition of Done – End Goal 1**

These stay **unchecked** until fully true in code + docs + operational usage:

- [ ] Orchestrator can run 24/7 locally and in Render, handling multiple queued runs concurrently via Redis + workers.
- [ ] Durable run state/events/artifacts in Postgres:
  - [ ] Run state persisted between nodes and across restarts.
  - [ ] Full transition history with timestamps and reasons.
  - [ ] Artifacts retained according to policy (`ARTIFACT_BLOB_THRESHOLD_BYTES`, `ARTIFACT_RETENTION_DAYS`).
- [ ] Standard run lifecycle implemented and observable:
  - [ ] `intake → plan → dev-execute → review → ops → report/escalate` (PR #1 may temporarily use `assign`).
  - [ ] `/ui` lists runs with state, phase, agent status, branch, PR, and HITL information.
- [ ] HITL gates:
  - [ ] Configurable checkpoints (design review, risky changes, pre-merge / pre-deploy).
  - [ ] Escalations visible in ChatKit and/or GitHub comments with a clear “Unblock” action.
- [ ] Self-iteration:
  - [ ] Policy documented for when to re-plan vs retry vs escalate.
  - [ ] Safeguards (max iterations, confidence thresholds).
  - [ ] At least one real run completes multiple iterations with HITL approvals.

### 1.2 End Goal 2 – Multi-Language / Multi-Platform Solutions (Salesforce First)

**High-level:**  

DevinSwarm must be able to target **multiple languages and platforms**, starting with **Salesforce (Apex + metadata + Salesforce DX)**:

- Understand tasks that mention target platforms/languages (Apex/Salesforce, Node/TS, Python, etc.).
- Route work to appropriate tools, pipelines, and agents per platform.
- Generate artifacts and tests appropriate for each platform.
- Integrate with platform-specific CI/CD (Salesforce DX, GitHub Actions, etc.).

**Definition of Done – End Goal 2**

- [ ] Platform abstraction defined in this runbook:
  - [ ] Each platform documents: languages, tools, build/test/deploy pipeline, and constraints.
- [ ] Salesforce platform path implemented:
  - [ ] DevinSwarm can accept a Salesforce-focused intake and:
    - [ ] Plan work in terms of Apex classes, triggers, LWCs, metadata.
    - [ ] Produce a branch and PR with Salesforce DX-compatible changes (including `package.xml` / manifests).
    - [ ] Integrate with a validation / quick-deploy pipeline.
- [ ] At least one **additional** platform partially supported (e.g., Node/TS backend or Python service).
- [ ] A documented procedure exists to add new platforms (what code to touch, prompts to add, tests to create, CI hooks, etc.).

---

## 2. Roadmap & Milestones

> **Important:** Use **this section** as the canonical roadmap. Any changes to phases, PR plans, or milestones belong here first.

We combine the earlier **v2 PR plan** and the **Phase-based SOT** into a single milestone view:

- **M0 – v2 PR Series (#1–#5)**
- **M1 – Phase 1: Orchestrator & State Model**
- **M2 – Phase 2: Tools & Workspace Management**
- **M3 – Phase 3: Role Workers & Agent Graph**
- **M4 – Phases 4–6: Policies, HITL, Observability & Self-Iteration**
- **M5 – Phase 7 & Beyond: CI/CD Safety Nets & Multi-Platform (Salesforce First)**

### 2.0 Milestone 0 – v2 PR Series (#1–#5)

> These come from the original “DevinSwarm v2 – Codex Operator Script”. Treat them as near-term structural framing.

- [ ] **PR #1 – Orchestrator skeleton (Postgres store, Redis queue, one dev worker)**  
  - [ ] Create `/orchestrator`, `/runtime`, `/tools`, `/prompts` directories (if not already present).
  - [ ] Implement minimal graph: `intake → plan → assign → report` (or `dev-execute` once ready).
  - [ ] Add Postgres store via Prisma + Redis-backed queue.
  - [ ] Implement **one dev worker** to consume from the queue.
  - [ ] Document local run instructions and `.env.example`.  
  **Acceptance:** `npm run start:service` and one dev worker run concurrently; a dummy job flows through the graph end-to-end.

- [ ] **PR #2 – HITL + ChatKit**  
  - [ ] Add `escalate` node and appropriate `interrupt()` call sites.
  - [ ] Add `/events/chatkit` endpoint to receive unblock events.
  - [ ] Add a minimal **embedded ChatKit HITL UI** under `/service/public/hitl` (or equivalent) showing escalations and an “Unblock” button POSTing to `/events/chatkit`.
  - [ ] Wire HITL to GitHub comments if ChatKit can’t be fully configured yet.  
  **Acceptance:** For a forced block, HITL UI (or GitHub comments) shows the escalation, and the “Unblock” interaction resumes the run.

- [ ] **PR #3 – Reviewer + Ops**  
  - [ ] Add separate **reviewer** and **ops** workers.
  - [ ] Extend graph to route dev output to reviewer, then ops.
  - [ ] Add GitHub workflow(s) to run tests/linters on swarm-created PRs.
  - [ ] Ensure merges to `main` require passing checks + human approval.  
  **Acceptance:** Opening a test PR from the dev worker triggers reviewer → ops; CI passes; merge requires human approval.

- [ ] **PR #4 – Improvement-Scout**  
  - [ ] Add **scout worker** that mines run logs and suggests framework improvements (tools, prompts, budgets).
  - [ ] Add heuristics/config file for scout behavior.
  - [ ] Add scheduled job (e.g., GitHub Actions `schedule`) that opens “Improve the swarm” issues or PRs.  
  **Acceptance:** The scout creates at least one actionable suggestion in an issue/PR based on prior runs.

- [ ] **PR #5 – Postgres + Helm (prod)**  
  - [ ] Harden Postgres usage, retention policy, and migrations.
  - [ ] Add/extend Helm chart or deployment config for the Render/cloud stack.
  - [ ] Ensure service + worker come up against Postgres and Redis with minimal configuration.  
  **Acceptance:** `helm template` (or docker compose) validates; the service comes up; queue processes jobs as expected.

> **Note:** If some PRs are already partially completed, update the checkboxes above to reflect reality. Keep this section aligned with the actual repo history.

---

### 2.1 Milestone 1 – Phase 1: Orchestrator & State Model

Focus: **Run state, events, resumability, and a clean state model**.

This milestone corresponds to **Phase 1 – Orchestrator & State Model** in the previous SOT.

**Implementation (State & Events)**

The following were marked complete in `docs/source-of-truth.md` as of 2025‑11‑21; keep them accurate:

- [x] Persist run state **per node**:
  - Status, phase, current node, retries, tasks, plan summary, status history.
  - Support resume from DB.
- [x] Emit **structured events** per transition:
  - `start`, `complete`, `fail`, `blocked` (with reasons, retries, timestamps).
- [x] Drive transitions via **retry-limited graph nodes** with resume support:
  - Blocked/fail transitions halt until HITL/unblock path taken.
- [x] Set timestamps (`startedAt`, `completedAt`) and `lastError`.
  - Add a Prisma migration for new columns.
- [x] Deduplicate orchestrator entry:
  - Single orchestrator caller; workers emit their own events without double orchestration.

**Docs & Ops**

- [ ] Document the state model and event schema in `prisma/` + `docs/`.
- [ ] Document retry budgets and failure behavior in this runbook and in any relevant code comments.
- [ ] Add at least one **integration test or smoke test** that:
  - [ ] Runs a dummy job.
  - [ ] Forces a crash mid-run.
  - [ ] Confirms resuming behavior from DB.

---

### 2.2 Milestone 2 – Phase 2: Tools & Workspace Management

Focus: **git/fs/tests/GitHub wrappers and per-run workspaces.**

Based on the SOT backlog:

- [ ] Define the **workspace model**:
  - [ ] Per-run workspace directory layout.
  - [ ] Clone/pull rules for target repos.
  - [ ] Clean-up policy (when to delete workspaces).
- [ ] Implement a tools layer (probably under `/tools`):
  - [ ] Git operations (clone, branch, commit, push).
  - [ ] Filesystem operations (safe write, diff, patch).
  - [ ] Test runner helpers (npm, jest, etc.).
  - [ ] GitHub API wrapper (issues, comments, PRs).
- [ ] Wire tools into the runtime:
  - [ ] Dev worker uses workspace + tools to implement diffs.
  - [ ] Review/ops workers use tools to comment, re-run tests, etc.
- [ ] Document the user-facing workflow in `README.md`:
  - [ ] How a run creates a branch and PR.
  - [ ] How HITL interacts with those artifacts.

---

### 2.3 Milestone 3 – Phase 3: Role Workers & Agent Graph

Focus: **Manager/orchestrator + dev/reviewer/ops/research/scout roles and the LangGraph graph.**

- [ ] Define agent roles in `AGENTS.md` and prompts under `/prompts`:
  - [ ] Manager/orchestrator.
  - [ ] Dev worker.
  - [ ] Reviewer worker.
  - [ ] Ops worker.
  - [ ] Research worker (optional initially).
  - [ ] Scout/improvement worker.
- [ ] Implement the **LangGraph graph**:
  - [ ] Nodes wired for each agent stage.
  - [ ] Clear input/output contracts between nodes.
- [ ] Ensure:
  - [ ] The graph corresponds exactly to the run lifecycle documented in End Goal 1.
  - [ ] There is an automated test or script that runs a full graph execution.

---

### 2.4 Milestone 4 – Phases 4–6: Policies, HITL, Observability & Self-Iteration

Focus: **Policies, escalation rules, HITL, observability, and self-iteration.**

- [ ] Policies & HITL:
  - [ ] Define escalation policies (when to interrupt, when to retry automatically).
  - [ ] Implement `escalate` node and HITL surfaces (ChatKit and/or GitHub comments).
  - [ ] Encode **“escalate before reallocate”**:
    - Workers stay assigned until the user unblocks or explicitly re-allocates.
- [ ] Observability:
  - [ ] `/ui` exposes run state, phase, current agent, and HITL status.
  - [ ] Logs/events searchable enough to debug issues.
- [ ] Self-iteration:
  - [ ] Document self-iteration policy (conditions to re-plan vs re-run vs escalate).
  - [ ] Implement safe automatic retries and re-planning loops with guards.
  - [ ] Validate with at least one **real run** that uses multiple iterations + HITL.

---

### 2.5 Milestone 5 – Phase 7 & Beyond: CI/CD Safety Nets & Multi-Platform (Salesforce First)

Focus: **CI/CD hardening plus multi-platform support, starting with Salesforce.**

- [ ] CI/CD safety nets:
  - [ ] GitHub Actions (or equivalent) run tests, linters, security checks on every swarm-created PR.
  - [ ] Merges to `main` require passing checks **and** human approval.
  - [ ] Add e2e smoke tests for a basic run.
- [ ] Salesforce platform path (End Goal 2 – Phase 1):
  - [ ] Document **Salesforce** as a platform (Apex, metadata, Salesforce DX).
  - [ ] Implement a Salesforce-aware workflow:
    - [ ] Detect Salesforce tasks from intake metadata.
    - [ ] Use Salesforce DX structure (e.g., `force-app`, `manifest`, scratch/dev sandbox).
    - [ ] Generate Apex/metadata changes + test classes.
  - [ ] Integrate with Salesforce CI pipeline (validation / quick deploy).
- [ ] Additional platforms:
  - [ ] Choose at least one other platform (Node/TS backend, Python, etc.).
  - [ ] Implement partial support:
    - [ ] Platform definition.
    - [ ] Basic build/test workflow.
    - [ ] Platform-specific prompts and best practices.

---

## 3. Current Stage & Next Steps

> This section is the **live status**. Keep it short, precise, and always current.

### 3.1 Current Stage

(Pre-filled from `docs/source-of-truth.md` as of 2025‑11‑21. Update as reality changes.)

- `CURRENT_MILESTONE:` **M1 – Phase 1: Orchestrator & State Model**
- `CURRENT_PHASE_LABEL:` **Phase 1 – Orchestrator & State Model**
- `STATUS_SUMMARY:`  
  Phase 1 data model and event pipeline are implemented: per-node run state persisted, structured events emitted, retry-limited graph nodes, timestamps, and deduped orchestrator entry. The repo has a single living SOT (this runbook), and guardrails (PR template, SOT checks) are in place to reduce drift.
- `BLOCKERS:`  
  - Need thorough testing of mid-run crash/resume behavior and alignment across app code and DB schema.  
  - Open policy questions about repo allowlist and retry budgets.

### 3.2 Active Work Items (Next Steps)

Keep 3–7 items, ordered by priority:

1. [ ] **Validate resumability end-to-end**: simulate mid-run crash, confirm resuming from DB works and update risk notes accordingly. (M1)
2. [ ] **Document state model and events**: add diagrams and field-level docs in `prisma/` and `docs/` and link them from this runbook. (M1)
3. [ ] **Finalize and document Codex rituals** (bootstrap + startup commands) in both `README.md` and this runbook. (M1)
4. [ ] **Design workspace lifecycle** for Phase 2 (per-run workspace conventions, clean-up policy, git workflow) and capture it under Milestone 2. (M2)
5. [ ] **Decide allowlist policy** (stay on DevinSwarm only vs expand) and encode configuration + documentation. (M1/M2)

Update this list whenever you start/finish meaningful work.

---

## 4. Repo Map & Documentation Layout

> Use this section for quick orientation. Update it whenever you move things.

### 4.1 Directories

- `/apps` – Service/worker entrypoints (HTTP API, UI, etc.).
- `/dist` – Compiled output (ignored for manual edits).
- `/docs` – Human-facing docs. All are subordinate to this runbook. Many legacy docs are archived:
  - `docs/source-of-truth.md` – **Legacy SOT**, now a pointer to this runbook.
  - `docs/runbook.md`, `docs/self-iteration-plan.md` – Archived stubs pointing to the SOT.
  - `docs/archive/*` – Historical copies.
- `/infra` – Docker Compose, k8s/Helm charts, `render.yaml`.
- `/orchestrator` – LangGraph JS orchestrator and graph definitions.
- `/runtime` – Queue, store, state machines, and event handling.
- `/packages` – Shared libraries (e.g., `packages/shared`).
- `/prisma` – Database schema and migrations (Postgres).
- `/prompts` – Agent prompt templates and configuration.
- `/scripts` – Helper scripts (local dev, tooling, tasks).
- `/tools` – Git, GitHub, filesystem, test, and related helpers.
- `/types` – Shared TypeScript types.

### 4.2 Key Top-Level Docs

- `README.md` – High-level description and local dev instructions.  
  Must clearly state this file (`CODEx_RUNBOOK.md`) is the **project runbook & source of truth**.
- `CODEx_RUNBOOK.md` – **This file**. Canonical goals, roadmap, current stage, and invariants.
- `AGENTS.md` – Agent roles, responsibilities, and (eventually) prompt locations.
- `DEVINSWARM_RENDER_NEXT_STEPS.md` – Focused view of Render deployment & smoke tests.  
  Must state: **“Source of truth is `CODEx_RUNBOOK.md` – this file is a focused view.”**
- `SWARM_PING.md` – Short status snapshot: current End Goal progress, current milestone, last smoke test.
- `devinswarm_codex_bootstrap.md` – Codex contract for how to behave in this repo and how to keep docs + code in sync.

---

## 5. Codex Startup Routine (Self-Onboarding – No Human Calls Needed)

Whenever Codex is started in this repo, it must follow this routine:

1. **Bootstrap the environment (human or automation)**  
   - Run `npm ci` if dependencies are stale.  
   - Start infra:  
     ```bash
     docker compose -f infra/docker-compose.dev.yml up -d
     ```  
   - Run the Codex bootstrap ritual (command name may vary; check `package.json`):  
     ```bash
     npm run bootstrap:codex
     ```  
     Optionally set `CODEX_RESET_TO_ORIGIN_MAIN=1` before this in **rare** cases where you want to force local state to match `origin/main` (WARNING: discards local changes).

2. **Identify context**  
   - Confirm you are in the `DevinBristol/DevinSwarm` repo.  
   - Confirm the repo map roughly matches §4.

3. **Load the runbook**  
   - Read this file (`CODEx_RUNBOOK.md`).  
   - Extract:
     - End Goal 1 and End Goal 2.
     - `CURRENT_MILESTONE`, `CURRENT_PHASE_LABEL`, `STATUS_SUMMARY`, `BLOCKERS`.
     - `Active Work Items`.

4. **Align the request with the runbook**  
   - Map the incoming task (prompt/issue/story) to:
     - A milestone (M0–M5).
     - One or more Active Work Items (or create a new one if justified).  
   - If the request conflicts with this runbook, propose the minimal edit to resolve the conflict and then apply it.

5. **Gather local context**  
   - Open relevant files based on the mapped milestone:
     - M0/M1: `orchestrator/*`, `runtime/*`, `prisma/*`, `README.md`.
     - M2: `/tools/*`, workspace-related scripts.
     - M3: `AGENTS.md`, `/prompts/*`, graph definitions.
     - M4: HITL-related endpoints, UI, logs, ChatKit integration.
     - M5: CI configs (`.github/workflows`), platform-specific modules (Salesforce, etc.).

6. **Plan, then execute**  
   - Write a short task-specific plan:
     - Either inline under the relevant Active Work Item.
     - Or as a temporary sub-bullet list referencing that item.  
   - Implement the plan in code + docs.

7. **After implementation**  
   - Run tests/linters/smoke tests as appropriate.  
   - Update:
     - Milestone checkboxes in §2.
     - `STATUS_SUMMARY`, `BLOCKERS`, and Active Work Items in §3.
     - Any relevant view-docs (`AGENTS.md`, `DEVINSWARM_RENDER_NEXT_STEPS.md`, `SWARM_PING.md`, `docs/*`).  
   - Commit **code + doc changes together**.

---

## 6. Documentation Update Rules

These rules merge the previous SOT update rules and the v2 operator discipline.

1. **Runbook-first**  
   - Any new **goal**, **plan**, **scope change**, or **status update** must be captured here first.
   - Do **not** create separate “plan docs” outside of this runbook.

2. **Single source-of-truth principle**  
   - `CODEx_RUNBOOK.md` is the canonical SOT.  
   - `docs/source-of-truth.md` becomes a **pointer** to this file (no independent content).  
   - All other docs must say at the top:

     > **Source of truth is `CODEx_RUNBOOK.md` – this file is a focused view. Do not diverge.**

3. **Session ritual (adapted from legacy SOT)**  
   - At session start:
     - Run the Codex bootstrap (`npm run bootstrap:codex` or equivalent).
     - Review this runbook’s §3 (Current Stage & Next Steps) and the latest Session Log.
   - Apply decisions/scope/status changes **directly** in this file; avoid side drafts.
   - If you must use a branch for longer work, rebase from `main` frequently and merge runbook changes back early.

4. **Checks and guardrails**  
   - Maintain a `check:sot` or equivalent script that:
     - Verifies `CODEx_RUNBOOK.md` was touched for relevant changes.
     - Ensures stub docs in `docs/` point here.  
   - CI should run this check on every PR.

5. **No silent forks of context**  
   - New direction-setting docs (e.g. `docs/salesforce-path.md`) must:
     - Declare subordination to this runbook.
     - Link to the specific section they elaborate.

---

## 7. Encoding End Goal 1 – Self-Iterating Swarm with HITL

This section captures key invariants from the original v2 operator script.

1. **Queue + store architecture**  
   - Durable state in Postgres via Prisma using `DATABASE_URL` (no SQLite).
   - Queue on Redis via `REDIS_URL`.
   - Local infra via `docker compose -f infra/docker-compose.dev.yml up -d`.
   - Cloud deployment via `render.yaml` (service + worker + Redis + Postgres).

2. **Run lifecycle**  
   - Target node flow:
     - `intake → plan → dev-execute → review → ops → report/escalate`  
       (temporarily `intake → plan → assign → report` if dev-execute is not yet wired).
   - Artifact defaults:
     - `ARTIFACT_BLOB_THRESHOLD_BYTES=5000000`
     - `ARTIFACT_RETENTION_DAYS=7` (tunable).

3. **Global rules (adapted)**  
   - **Escalate before reallocation**: if a run is blocked (missing secrets, approvals), escalate and pause. Don’t silently reassign workers.
   - **Run 24/7 + concurrent issues**: architecture assumes Redis-based queues and horizontally scalable workers.
   - **Direct repo read**: workers clone the target repo locally and work in a workspace; all changes go through branches + PRs.
   - **Human gate**: merges to `main` require tests/linters/security checks + explicit human approval.
   - **Traceability**: PR descriptions must include goals, plan, major changes, artifacts (branch, PR, CI links), and “how to unblock” checklists.

4. **Escalation template**

Use this template (adapted) for HITL escalations (in ChatKit or GitHub comments):

> **🛑 Escalation: {Reason}**  
> **Run/Issue:** {run id or issue link}  
> **What I need from you:**  
> 1. {Secret or account} → where to create it and the exact secret name(s).  
> 2. {Permission} → which permission to grant and to which GitHub App or token.  
> 3. {Approval or policy decision} → what yes/no decision is required.  
>  
> **I will resume automatically** after you complete the change and mark this escalation as unblocked (e.g., via ChatKit UI or by adding the `unblocked` label/comment).

---

## 8. Encoding End Goal 2 – Multi-Platform, Salesforce First

1. **Platform abstraction**

A **Platform** is defined by:

- Supported languages (e.g., Apex, TypeScript, Python).
- Tooling (CLIs, SDKs, linters).
- Build/test pipeline.
- Deploy/release pipeline.
- Policy constraints (e.g., coverage thresholds, change windows).

This runbook must:

- List each platform and its properties.
- Document how platform selection happens:
  - From intake metadata.
  - From repo context (e.g., Salesforce repo vs generic Node repo).
  - From explicit configuration.

2. **Salesforce Platform (first-class)**

Add/maintain a subsection (to be expanded as implementation lands):

- [ ] Describe Salesforce DX integration:
  - [ ] How DevinSwarm interacts with a Salesforce repo (e.g., `force-app`, `manifest`, etc.).
  - [ ] Which commands/tools are used (`sfdx`, Salesforce CLI, etc.).
- [ ] Document how dev/reviewer/ops workers handle Salesforce tasks:
  - [ ] Dev: generate/modify Apex classes, triggers, LWCs, metadata.
  - [ ] Reviewer: Apex code review + coverage.
  - [ ] Ops: coordinate validation/quick deploy and rollback where needed.
- [ ] Document environment requirements (sandboxes, orgs, secrets).

3. **Additional platforms**

- [ ] Choose next platform (e.g. Node/TS backend).
- [ ] Add:
  - [ ] Platform definition.
  - [ ] Minimal pipeline (build/test, packaging).
  - [ ] Agent prompt tweaks for that platform.

---

## 9. Git & Commit Discipline

1. **Atomic, aligned commits**

- Every logical change must include:
  - Code changes.
  - Updates to this runbook (if behavior/plan/status changed).
  - Updates to relevant view-docs (`AGENTS.md`, `DEVINSWARM_RENDER_NEXT_STEPS.md`, `SWARM_PING.md`, `docs/*`).

2. **Commit messages**

- Include references to milestones / work items, e.g.:
  - `M1: add per-node state persistence + events`
  - `M2: scaffold workspace tools layer`
  - `M4: wire HITL escalation UI`

3. **No undocumented merges to main**

- Do not merge to `main` if:
  - The runbook would then be stale.
  - HITL/guardrail requirements of the v2 design are bypassed.

---

## 10. Historical Context, Decisions & Session Log

This section captures the **historical SOT content** so we don’t lose context.

### 10.1 Decisions (from 2025‑11‑21 SOT)

- 2025‑11‑21: Allowlist starts with `DevinBristol/DevinSwarm`; ensure installation ID matches.
- 2025‑11‑21: Short-term artifacts stay in Postgres / PR comments; S3/MinIO later for blobs > ~5 MB or retention > 7 days.
- 2025‑11‑21: Initial retry budgets: plan 1–2; dev 1–2; review 1; ops 1–2; escalate sooner on repeatable failures.

### 10.2 Risks / Unknowns (to be kept current)

- [ ] Confirm resumability + per-node persistence behavior under real mid-run crashes.
- [ ] Ensure migrations and app code are fully aligned with the event/state schema.
- [ ] Manage drift risk by enforcing SOT checks and PR template requirements.

### 10.3 Open Questions

- [ ] Keep repo allowlist to DevinSwarm only until first self-iteration, or expand sooner?
- [ ] Tighten/loosen node-specific retry caps beyond the initial defaults?

### 10.4 Session Log (newest first)

(Seeded from SOT; append new entries here.)

- **2025‑11‑21:** Phase 1 persistence/events/resume added (per-node state, structured events, timestamps, retry-limited nodes, deduped orchestrator entry). Single SOT established with guardrails (PR template, checks).
- **2025‑11‑21:** Created initial SOT on `main`, archived prior plan docs, and added bootstrap/guardrail instructions.

### 10.5 Backlog / Later Phases (original SOT mapping)

For historical reference, earlier SOT phrasing:

- Phase 2: Tools & workspace management (git/fs/tests/github wrappers, per-run workspace lifecycle).
- Phase 3: Role workers (dev/reviewer/ops queues and scripts).
- Phases 4–6: Policies/HITL, observability, self-iteration behaviors; RAG optional.
- Phase 7: CI/CD safety nets and e2e smoke tests.

These are now captured and expanded as Milestones M2–M5 in §2. Keep both sections synchronized conceptually.
