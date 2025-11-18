# DevinSwarm v2 – Codex Operator Script
**Purpose:** Execute the agreed 12‑point plan (ending with §12 alignment) and ship PRs #1‑#5 exactly as specified.  
**You are Codex.** You will do the work, create PRs, and guide the user to unblock anything requiring human accounts, secrets, or approvals.

---

## GLOBAL RULES (read first)

- **Do not change the design or order**. Follow the previously approved 12 sections and the 5 PRs verbatim.
- **Escalate before reallocation**: If any task is blocked (missing secret, permission, unclear spec, failing infra), **escalate to the user** using the template in “Escalation Template” below, then pause that thread. Do not move those workers to new issues until the user unblocks.
- **Run 24/7 + concurrent issues**: Use a **Redis queue** and independent worker processes. Start with one dev worker in PR #1, then add others in PR #3/#4.
- **Direct repo read**: Workers must clone the target repo locally in their sandbox. All proposed changes go through branches + PRs.
- **Human gate**: Merges to `main` require tests/linters/security checks + explicit human approval (the user).
- **Traceability**: In every PR description, include: goals, plan, artifacts (branch, PR, CI links), and “how to unblock” checklist.

### Escalation Template (copy verbatim)
> **🛑 Escalation: {Reason}**  
> **Run/Issue:** {issue or run id}  
> **What I need from you:**
> 1) {Secret or account} → Where to create it: {console/URL}, **exact scopes**, and where to paste it in the repo’s secrets (`Settings → Secrets and variables → Actions → New repository secret`).
> 2) {Permission} → Which permission to grant and to which GitHub App or token.
> 3) {Approval or policy decision} → Yes/No choice.  
     > **I will resume automatically** after you complete the checklist and comment “UNBLOCK #{issueId}” (or add the `unblocked` label). Workers stay reserved until then.

---

## PREP (one‑time variables Codex should capture)
- `REPO_NAME` = DevinSwarm (or the repo URL you provide)
- `DEFAULT_BRANCH` = `main`
- `NODE_VERSION` = `>=20`
- `REDIS_URL` = `redis://localhost:6379` (local) / `redis://redis:6379` (docker)
- `SQLITE_URL` = file `devinswarm.db`
- **Secrets that will be requested when needed** (Codex must escalate for these):
    - `OPENAI_API_KEY`
    - `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY` (PEM), `GITHUB_WEBHOOK_SECRET`
    - (Later) ChatKit config for the embedded escalation page
    - (Later in PR #5) `POSTGRES_URL` and helm/deploy context

---

# (0) What’s in the repo today (quick read)
**Goal:** Inventory current structure and confirm language/runtime.

**Codex do:**
1. List top‑level folders and any existing `service/`, `agents/`, `.github/workflows/`, `docs/`, `scripts/`.
2. Summarize current entrypoints and any ad‑hoc manager logic in `service/`.
3. Open the README to confirm expectations and GH Actions already present.

**Acceptance:** A short comment on issue “DevinSwarm v2 – Bootstrap” with repo map and what will be refactored into `/orchestrator` (manager graph) vs left in `service` (webhook intake).

---

# (1) Target architecture
**Goal:** Record the finalized architecture (no code yet).

**Codex do:**
- Commit a `docs/design.md` that restates the approved hierarchy:
    - Manager/Orchestrator (LangGraph JS) → delegates to workers (dev, reviewer, research, ops, **improvement‑scout**).
    - Tools (git, GitHub, CI, RAG optional), Runtime (Redis queue, SQLite dev store), UI (ChatKit embed + GitHub PR/Issues).
- Include sequence diagram and states (`intake → plan → assign → monitor → report`).

**Acceptance:** `docs/design.md` merged in PR #1 (or included as part of PR #1).

---

# (2) Repo changes (new tree)
**Goal:** Create the new directories without changing behavior yet.

**Codex do (create only):**
/orchestrator/graph/ # manager.graph.ts and nodes
/orchestrator/state/ # durable types/schemas
/orchestrator/policies/ # hitl.ts, budgets.ts
/orchestrator/index.ts # orchestrator server adapter

/workers/{dev,reviewer,research,ops,scout}/
/runtime/{queue,store,events}/
/tools/ # github.ts, git.ts, fs.ts, ci.ts, rag.ts (stub)
/prompts/ # manager.md & workers/*.md
/docs/ # runbook.md (will update later)


**Acceptance:** New folders present; no runtime changes yet.

---

# (3) Stack changes (remove/ add)
**Goal:** Pin the runtime libs and remove ad‑hoc loops.

**Codex do:**
- `package.json` add runtime deps (exact versions may be latest compatible):
    - `"express"`, `"@octokit/rest"`, `"bullmq"`, `"ioredis"`, `"zod"`, `"dotenv"`, `"uuid"`, `"winston"`,
    - LangGraph JS (install the canonical **JS package for LangGraph**),
    - SQLite driver (e.g., `"better-sqlite3"` or `"sqlite3"`).
- Dev deps: `"typescript"`, `"ts-node"`, `"nodemon"`, `"@types/node"`, `"@types/express"`, `"eslint"` (if desired).
- Remove any custom in‑memory loops / “agent chat” files and record them in PR notes as deprecated (do **not** delete user content that carries value; move it to `/docs/archive/` if needed).

**Escalate if blocked:** If `better-sqlite3`/`sqlite3` build fails on Windows, request the user to run the Node build tools installer and confirm Python/VS Build Tools are present, then re‑install.

**Acceptance:** `npm run build` succeeds.

---

# (4) Behaviors (wire skeleton logic)
**Goal:** Minimal code pathways reflecting the required behaviors.

**Codex do:**
- In `/orchestrator/graph/manager.graph.ts`, create a **minimal graph** with nodes: `intake`, `plan`, `assign`, `report`. Each node just logs and advances.
- In `/runtime/queue/redis.ts`, add BullMQ queue producer/consumer scaffolding.
- In `/runtime/store/sqlite.ts`, initialize a DB with tables `runs`, `steps`, `blocks`.
- In `/tools/github.ts`, add an Octokit placeholder (no auth yet).
- In `/prompts/manager.md` and `workers/*.md`, commit the initial role/system prompts (stubs are fine in PR #1).

**Acceptance:** `npm run dev` starts the service; log shows a run can go `intake → plan → assign → report` with static input.

---

# (5) Concrete diffs & files to add
**Goal:** Cement the files listed in (4) and any support files.

**Codex do:**
- Add `tsconfig.json`, `.env.example`, `.editorconfig`, `.eslintrc` (optional), and scripts to `package.json`:
    - `"dev": "nodemon service/index.ts"`
    - `"build": "tsc -p tsconfig.json"`
- Add `/service/index.ts` (Express boot), `/runtime/events/webhooks.ts` (stub), `/runtime/events/chatkit.ts` (stub).
- Ensure **one dev worker** exists in `/workers/dev/worker.ts` with a placeholder “echo” task.

**Acceptance:** Repo compiles and runs; `POST /health` returns 200.

---

# (6) What to rip out right now
**Goal:** Remove drift and sources of loops.

**Codex do:**
- Identify any non‑durable “conversation loops” and move logic to `/orchestrator/graph/*`.
- Remove JSON scratch “memory” files from runtime; keep under `/docs/archive/` if valuable.
- Replace any synchronous fan‑out code with queue submits.

**Acceptance:** No long‑running in‑memory loops remain; only the queue and orchestrator drive work.

---

# (7) Step‑by‑step: get it running fast (local dev)
**Goal:** Make it runnable locally with Redis + SQLite and **one** dev worker.

**Codex do:**
1. Add `docker-compose.dev.yml` with Redis service.
2. Update `.env.example` → `REDIS_URL`, `SQLITE_PATH`, `OPENAI_API_KEY` (left empty).
3. Implement `npm scripts`:
    - `start:service`, `start:dev-worker`.
4. Provide a **README local section** with:
    - `docker compose -f docker-compose.dev.yml up -d redis`
    - `cp .env.example .env && npm i && npm run build && npm run start:service`
    - In a 2nd terminal: `npm run start:dev-worker`
5. Open a tracking issue “Local bring‑up complete” with logs and instructions.

**Escalate if blocked:** If Redis isn’t reachable, ask the user to start docker and re‑run compose.

**Acceptance:** Local smoke test passes; dev worker pulls a dummy job and logs completion.

---

# (8) CI/CD updates
**Goal:** Minimal CI for the swarm repo itself.

**Codex do:**
- `.github/workflows/swarm-ci.yml`:
    - On PR: checkout, `npm ci`, `npm run build`, optionally `eslint`.
- Add branch protection rules for `main` (the user must enable in settings).
- Add checklist to PR template: tests/linters must pass, human approval required.

**Escalate:** Ask the user to enable branch protection and required checks.

**Acceptance:** A test PR proves CI runs and blocks merges until passing + approval.

---

# (9) Exact policy for escalate-before-reallocate (HITL)
**Goal:** Encode the policy now (code stub; UI in PR #2).

**Codex do:**
- In `/orchestrator/policies/hitl.ts` define:
    - Triggers (missing secret, destructive change, failing tests after 2 retries, ambiguous spec).
    - Action: label run `BLOCKED`, call `interrupt()` with `{reason, requested_input}`.
- Teach `manager.graph.ts` to route to an `escalate` node when `state.status === "blocked"` and then loop back once unblocked (resume).
- Implement “reservation”: mark the assigned worker(s) as reserved to the ticket while blocked.

**Acceptance:** Unit test or log trace showing a forced block triggers `escalate` and prevents reassignment.

---

# (10) Costs & scale (brief note in docs)
**Goal:** Document—not implement—cost levers already agreed.

**Codex do:**
- Update `docs/runbook.md` with a short “Costs & scale” section covering model costs, cache/batch levers, and where queue replicas increase throughput.

**Acceptance:** Docs updated; no code change.

---

# (11) Immediate PR plan (execute PRs #1–#5 exactly)

> **You MUST create five separate PRs with these exact contents.** Each PR includes a checklist and “How to unblock” section. If anything requires secrets or accounts, use the Escalation Template.

### PR #1 – Orchestrator skeleton (SQLite dev, Redis queue, one dev worker)
**Include:**
- Add `/orchestrator`, `/runtime`, `/tools`, `/prompts`.
- Minimal graph: `intake → plan → assign → report`.
- SQLite store (dev), Redis queue, **one dev worker**.
- Local run instructions and `.env.example`.

**Escalate for:** None expected, except Redis docker up on user’s machine.

**Acceptance:**
- `npm run start:service` + dev worker both run.
- A dummy job flows through the 4‑node graph.

---

### PR #2 – HITL + ChatKit
**Include:**
- `escalate` node and `interrupt()` call sites.
- `/events/chatkit` endpoint.
- A **basic embedded ChatKit** page under `/service/public/hitl.html` showing escalations and an “Unblock” button that POSTs to `/events/chatkit`.

**Escalate for (secrets/accounts):**
- Request the user to supply ChatKit config (or minimal API keys) and to set:
    - `CHATKIT_...` (document exact keys) in repo **Actions Secrets**.
- If the user prefers to keep HITL only in GitHub comments for now, request approval to point escalations there.

**Acceptance:**
- For a forced block, the page shows the escalation and clicking “Unblock” resumes the run.

---

### PR #3 – Reviewer + Ops
**Include:**
- **Reviewer worker**: runs tests/linters/security scanners; posts PR comments.
- **Ops worker**: checks CI statuses, handles rollout/rollback hooks (no real prod deploys yet).
- Update `.github/workflows` to run tests/linters on every swarm‑created PR.
- Ensure merges require passing checks + human approval.

**Escalate for:**
- Ask the user to enable **branch protection** on `main` and set **required status checks**.

**Acceptance:**
- Opening a test PR from dev worker triggers reviewer → ops; CI passes; merge requires human approval.

---

### PR #4 – Improvement‑Scout
**Include:**
- **Scout worker**: mines run logs and suggests framework improvements (tools, prompts, budgets).
- **Heuristics** file; weekly cron (e.g., GH Actions `schedule`) to open “Improve the swarm” issues/PRs.

**Escalate for:**
- None likely. If org requires approval for scheduled workflows, ask the user to enable them.

**Acceptance:**
- A scheduled (or manually dispatched) run creates at least one improvement suggestion issue/PR.

---

### PR #5 – Postgres + Helm (prod)
**Include:**
- Switch store from SQLite → **Postgres** (keep SQLite for dev).
- Add **Helm chart** (or Docker Compose for prod) and envs for DB, Redis, service + workers.
- Migrations/seeds and readiness/liveness probes.

**Escalate for (secrets/accounts):**
- Request `POSTGRES_URL` (managed DB or self‑hosted), and any K8s context if Helm is used.

**Acceptance:**
- `helm template` (or docker compose) validates; the service comes up against Postgres; the queue processes jobs.

---

# (12) Where this aligns with the initial prompt & our first design
**Goal:** Close the loop explicitly.

**Codex do:**
- Post a comment “Alignment Check” on PR #5 (or as a final issue) that maps the delivered structure to:
    - **Manager/Workers** hierarchy with you as **ultimate supervisor**.
    - Speed to deploy **code‑based solutions** via dev→reviewer→ops path.
    - **Scalability** via queue + worker replicas; durable runs; HITL interrupts for audits.
    - **Costs**: manager on strong model, workers on cheaper models; test gates + human approval to protect prod.
- Link to the runbook sections and the HITL page.
- Confirm the four explicit requirements:
    1) **24/7**, multiple issues in parallel (Redis queue + workers).
    2) **Escalate before reallocating** (interrupt + reservation).
    3) **Improvement‑Scout** present and scheduled.
    4) **Direct repo read** ensured by cloning in worker sandboxes.

**Acceptance:** The user responds “Confirmed” or requests minor tuning; no architectural changes.

---

## APPENDIX

### Minimal Scripts to Add to `package.json`
```json
{
  "scripts": {
    "dev": "nodemon service/index.ts",
    "build": "tsc -p tsconfig.json",
    "start:service": "node dist/service/index.js",
    "start:dev-worker": "node dist/workers/dev/worker.js",
    "lint": "eslint ."
  }
}
