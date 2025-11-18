# DevinSwarm Architecture

DevinSwarm is an orchestrator‑first, queue‑driven agent swarm built on Node 20+, TypeScript, and LangGraph JS.

- **Manager / Orchestrator** (LangGraph JS) coordinates multi‑step runs.
- **Workers** (`dev`, `reviewer`, `research`, `ops`, `scout`) execute concrete tasks.
- **Runtime** uses Redis + BullMQ for queues and SQLite (dev) / Postgres (prod) for durable state.
- **Tools** provide low‑level integrations (git/GitHub/CI/RAG/filesystem).
- **Service** exposes HTTP endpoints and webhook adapters (e.g., GitHub, ChatKit).

## High‑Level Components

- **/service** – HTTP surface area:
  - Webhook intake for GitHub and ChatKit.
  - Health endpoints and minimal REST for debugging runs.
  - Delegates to `/orchestrator` and `/runtime/queue`.

- **/orchestrator** – Manager graph and policies:
  - `/orchestrator/graph` – LangGraph state graph (`intake → plan → assign → report`).
  - `/orchestrator/state` – Zod schemas and durable types for runs.
  - `/orchestrator/policies` – HITL escalation rules, budgets, and safety policies.

- **/workers** – Role‑specific workers:
  - `dev` – implements changes and opens PRs.
  - `reviewer` – runs tests/linters/security checks; reviews PRs.
  - `research` – gathers context, docs, and examples.
  - `ops` – monitors CI, deploys, and rollbacks.
  - `scout` – mines logs and suggests improvements.

- **/runtime** – Queue + store + events:
  - `/runtime/queue` – BullMQ queues and workers over Redis.
  - `/runtime/store` – SQLite dev store and, later, Postgres adapters.
  - `/runtime/events` – event fan‑out to HITL channels and GitHub.

- **/tools** – Integrations:
  - `git`, `github`, `ci`, `fs`, `rag` for repo access and automation.

- **/prompts** – Prompt templates:
  - Manager prompt and worker prompts for each role.

## Orchestrator Flow

The core orchestration flow is modeled as a LangGraph **StateGraph** with the following nominal nodes:

1. **intake** – Normalize and validate the incoming request (issue/PR/task).
2. **plan** – Expand the request into a concrete multi‑step plan.
3. **assign** – Route work to workers (`dev`, then `reviewer`, then `ops`).
4. **monitor** – Track progress, queue depth, and budget usage.
5. **report** – Summarize and report back via GitHub and HITL.

For PR #1 the minimal compiled graph is:

`intake → plan → assign → report`

with a single `dev` worker connected to the queue.

## 24/7, Cloud‑Native, and Scaling

- **24/7** – A Redis‑backed queue (`runtime/queue`) plus independently deployable workers (`workers/*`) allow continuous processing.
- **Scaling** – Horizontal scaling is achieved by running multiple worker replicas against the same Redis queue.
- **Durability** – Runs are persisted in SQLite locally (`runtime/store/sqliteStore.ts`) and later migrated to Postgres with Helm for production (PR #5).

## Human‑in‑the‑Loop (HITL)

HITL is implemented via:

- An `escalate` node in the LangGraph orchestrator.
- Event emission through `/runtime/events`.
- A ChatKit‑based HITL page under `/service/public/hitl.html` (PR #2).

Escalations are stored durably and must follow the runbook’s **Escalate before reallocation** rule.

