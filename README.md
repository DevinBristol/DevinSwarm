# DevinSwarm

DevinSwarm is a Node 20+ TypeScript orchestrator built around LangGraph JS. It uses a Redis‑backed queue and dedicated workers to run 24/7 and handle multiple issues in parallel.

This repo follows the `CODEx_RUNBOOK.md` plan, evolving toward:

- Manager / orchestrator (LangGraph JS) coordinating workers.
- Workers (`dev`, `reviewer`, `research`, `ops`, `scout`) with full repo access.
- Queue + store (`runtime/queue`, `runtime/store`) for durable, scalable runs.
- Tools (`/tools`) for git, GitHub, CI, RAG, filesystem, etc.
- HITL via ChatKit or GitHub comments.

## Local Development

Prerequisites: Node.js >= 20, npm >= 10, Docker Desktop with Compose.

```bash
# install deps and copy the env template
npm ci
cp .env.example .env

# start Postgres + Redis (Docker)
docker compose -f infra/docker-compose.dev.yml up -d

# generate Prisma client + ensure schema applied
npm run db:generate
npm run db:push

# run the service and worker (separate terminals)
npm run start:service   # http://localhost:3000/ui
npm run start:worker
```

Fill in `.env` with at least:

- `OPENAI_API_KEY` — your OpenAI key (do not commit it).
- `DATABASE_URL=postgresql://devinswarm:devinswarm@localhost:5432/devinswarm?schema=public`
- `REDIS_URL=redis://localhost:6379`

Trigger a dummy run:

```bash
curl -X POST http://localhost:3000/intake \
  -H "Content-Type: application/json" \
  -d "{\"description\":\"Test DevinSwarm run\"}"
```

You should receive a JSON response containing a `id` field. You can then query:

```bash
curl http://localhost:3000/runs/<id>
```

## Cloud Deployment (Render)

This repo includes a root `render.yaml` that defines:

- A **web service** (`devinswarm-service`) running `npm run start:service`.
- A **worker service** (`devinswarm-worker`) running `npm run start:worker`.

High‑level steps:

1. Push this repo to GitHub (e.g., `DevinBristol/DevinSwarm`).
2. In Render, create a new Web Service from this repo:
   - Use the config from the root `render.yaml`.
3. In Render, create a Worker Service from the same repo:
   - Use the `devinswarm-worker` entry in `render.yaml`.
4. Provide environment variables in Render for both services:
   - `OPENAI_API_KEY`
   - `REDIS_URL` (from a Render Redis/Key-Value instance)
   - `DATABASE_URL` (from a Render Postgres database)
   - `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
   - `DAILY_BUDGET_USD`, `AUTO_MERGE_LOW_RISK`, `ALLOWED_REPOS`
   - `UI_TOKEN`

With those in place, the Render web + worker services give you a 24/7 cloud-hosted DevinSwarm that can process jobs from the Redis queue.

## CI

The workflow at `.github/workflows/ci.yml`:

- Runs on pushes and pull requests targeting `main`.
- Installs dependencies and runs `npm run build`.

Later steps in the runbook will extend this to run tests, linters, and security checks, and wire reviewer/ops workers and branch protections.

## Working Across Work/Home PCs

To move seamlessly between machines:

- Make sure each PC has Node 20.19.0, npm ≥ 10, and Docker Desktop with Compose.
- On each PC, copy `.env.example` to `.env` and fill in secrets locally (do not commit `.env`).
- After switching machines, run:
  - `git pull origin main`
  - `npm ci` (if `package-lock.json` changed)
  - `docker compose -f infra/docker-compose.dev.yml up -d`
  - `npm run db:push`
- Then use the local dev commands above or the Render smoke tests from `DEVINSWARM_RENDER_NEXT_STEPS.md`.

## DevinSwarm Bootstrap

This repo contains a multi-agent swarm with:

- Web service: `/health`, `/intake`, `/runs`, `/ui`
- Worker: BullMQ (Redis) with concurrency 2
- Durable state: Postgres (Prisma)
- GitHub App: direct repo read/write (branches, commits, PRs)
- Policy: daily budget, optional low-risk auto-merge
- Escalation: blocked runs marked `awaiting_unblock` and surfaced via UI or GitHub Issue conventions.

### Local development

```bash
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml up -d
npm ci
npm run db:generate
npm run db:push
npm run start:service  # http://localhost:3000/ui
npm run start:worker
```

### Render deployment

Use the root `render.yaml` as a Blueprint in Render. Set the following environment variables in the Render dashboard (do not commit secrets):

- `OPENAI_API_KEY`
- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `UI_TOKEN`

