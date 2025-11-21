# DevinSwarm Architecture

DevinSwarm is an orchestrator-first, queue-driven agent swarm built on Node 20+, TypeScript, and LangGraph JS.

- **Manager / Orchestrator** (LangGraph JS) coordinates multi-step runs across workers.
- **Workers** (`dev`, `reviewer`, `research`, `ops`, `scout`) execute concrete tasks.
- **Runtime** uses Redis + BullMQ for queues and Postgres (via Prisma) for durable state.
- **Tools** provide low-level integrations (git/GitHub/CI/RAG/filesystem).
- **Service** exposes HTTP endpoints and webhook adapters (e.g., GitHub, ChatKit).

## High-Level Components

- **/service** – HTTP surface area:
  - Webhook intake for GitHub and ChatKit.
  - Health endpoints and minimal REST for debugging runs.
  - Delegates to `/orchestrator` and `/runtime/queue`.

- **/orchestrator** – Manager graph and policies:
  - `/orchestrator/graph` – LangGraph state graph (intake -> plan -> dev-execute -> review -> ops -> report, with escalate).
  - `/orchestrator/state` – Zod schemas and durable types for runs.
  - `/orchestrator/policies` – HITL escalation rules, budgets, and safety policies.

- **/workers** – Role-specific workers:
  - `dev` – implements changes and opens PRs.
  - `reviewer` – runs tests/linters/security checks; reviews PRs.
  - `research` – gathers context, docs, and examples.
  - `ops` – monitors CI, deploys, and rollbacks.
  - `scout` – mines logs and suggests improvements.

- **/runtime** – Queue + store + events:
  - `/runtime/queue` – BullMQ queues and workers over Redis.
  - `/runtime/store` – Postgres adapters via Prisma.
  - `/runtime/events` – event fan-out to HITL channels and GitHub.

- **/tools** – Integrations:
  - `git`, `github`, `ci`, `fs`, `rag` for repo access and automation.

- **/prompts** – Prompt templates:
  - Manager prompt and worker prompts for each role.

## Orchestrator Flow

Target steady state:

1. **intake** – Normalize and validate the incoming request (issue/PR/task).
2. **plan** – Expand the request into a concrete multi-step plan.
3. **dev-execute** – Apply the plan in a workspace, run targeted tests, and push a branch/PR.
4. **review** – Run wider tests/linters and add PR comments/status.
5. **ops** – Watch CI/status contexts, gate merge, and retry flakiness.
6. **report** – Summarize and report back via GitHub and HITL.
7. **escalate** – Interrupt and hold for HITL/policy blocks, then resume once unblocked.

For the bootstrap, a minimal compiled graph (`intake -> plan -> assign -> report`) with a single `dev` worker is acceptable, but the above flow is the target.

## 24/7, Cloud-Native, and Scaling

- **24/7** – A Redis-backed queue (`runtime/queue`) plus independently deployable workers (`workers/*`) allow continuous processing.
- **Scaling** – Horizontal scaling is achieved by running multiple worker replicas against the same Redis queue.
- **Durability** – Runs are persisted in Postgres via Prisma (`DATABASE_URL`) both locally and in production.

## Human-in-the-Loop (HITL)

HITL is implemented via:

- An `escalate` node in the LangGraph orchestrator.
- Event emission through `/runtime/events`.
- A ChatKit-based HITL page under `/service/public/hitl.html` (PR #2).

Escalations are stored durably and must follow the runbook's **Escalate before reallocation** rule.
