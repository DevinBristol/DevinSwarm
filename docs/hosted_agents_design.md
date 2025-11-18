# Design: Agent Service + GitHub + Salesforce

## Architecture (Day‑1)
```
GitHub (Issues, PRs, Actions) ─┐
  ├─ webhook → /webhooks/github ──────┐
  ├─ /intake label & /commands  ──┐   │
  └─ Actions call /tasks (curl) ───┴──►│
                                      Agent Service (Express)
                          Manager (planner, budget, stop rules)
                   ┌──────────┬───────────┬──────────┬──────────┐
                   dev       test       research     ops       doc
                   │          │            │          │          │
                GitHub API   SF CLI via Actions        Comments/PRs
```
- **Separation of duties:** Salesforce deploy/validate runs in **GitHub Actions** (using your sandbox creds). The Agent Service never holds Salesforce keys.
- **Manager** creates a plan and dispatches to Workers in **parallel**. Day‑1 workers return text (plan/diff/notes). Auto‑PR is opt‑in.
- **Persistence:** Minimal in‑memory run state + GitHub as the durable surface. (Add Redis/DB later.)

## Endpoints
- `POST /tasks` Auth: `x-agent-token`
  - Body: `{ type: "intake" | "ci_failure" | "comment", repo, issueNumber?, prNumber?, payload }`
  - Effect: Manager plans → parallel worker calls → comment back to GitHub.
- `POST /webhooks/github` Auth: HMAC `X-Hub-Signature-256`
  - Handles: `issues`, `issue_comment` (commands), `pull_request`, `workflow_run (failure)`.

## Config (env)
- `OPENAI_API_KEY`, `OPENAI_MODEL_MANAGER`, `OPENAI_MODEL_WORKER`
- `AGENT_SERVICE_TOKEN`, `WEBHOOK_SECRET`
- `GH_PAT` (optional for auto‑PRs), `GH_OWNER`, `GH_REPO`
- `BUDGET_USD_DAILY`, `MAX_TOOL_CALLS`

## Safety & Guardrails
- JSON‑schema outputs for plans.
- Hard cap on tool calls per run; timeouts per step.
- All “writes” gated via PRs + tests; default to **comment‑only**.
- Allow‑list repos and allowed file globs per worker.

## Day‑2+
- Add Redis + BullMQ for durable queues.
- Add vector store for RAG on your docs.
- Swap workers to cheaper models; keep Manager strong.
