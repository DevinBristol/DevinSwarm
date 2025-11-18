# DevinSwarm

DevinSwarm is a Node 20+ TypeScript orchestrator built around LangGraph JS. It uses a Redis‑backed queue and dedicated workers to run 24/7 and handle multiple issues in parallel.

This repo follows the `CODEx_RUNBOOK.md` plan, evolving toward:

- Manager / orchestrator (LangGraph JS) coordinating workers.
- Workers (`dev`, `reviewer`, `research`, `ops`, `scout`) with full repo access.
- Queue + store (`runtime/queue`, `runtime/store`) for durable, scalable runs.
- Tools (`/tools`) for git, GitHub, CI, RAG, filesystem, etc.
- HITL via ChatKit or GitHub comments.

## Local Development

Prerequisites:

- Node.js >= 20
- npm
- Docker (for Redis in dev)

Install dependencies:

```bash
npm install
```

Create an env file:

```bash
cp .env.example .env
```

Fill in at least:

- `OPENAI_API_KEY` – your OpenAI key (do not commit it).
- `REDIS_URL=redis://localhost:6379`
- `SQLITE_URL=devinswarm.db`

Start Redis locally:

```bash
docker compose -f docker-compose.dev.yml up -d redis
```

Build the project:

```bash
npm run build
```

Run the HTTP service:

```bash
npm run start:service
```

Run the dev worker in another terminal:

```bash
npm run start:dev-worker
```

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

This repo includes a `render.yaml` that defines:

- A **web service** (`devinswarm-service`) running `npm run start:service`.
- A **worker service** (`devinswarm-dev-worker`) running `npm run start:dev-worker`.

High‑level steps:

1. Push this repo to GitHub (e.g., `DevinBristol/DevinSwarm`).
2. In Render, create a new Web Service from this repo:
   - Use the config from `render.yaml`.
3. In Render, create a Worker Service from the same repo:
   - Use the `devinswarm-dev-worker` entry in `render.yaml`.
4. Provide environment variables in Render for both services:
   - `OPENAI_API_KEY`
   - `REDIS_URL` (pointing at a Render Redis instance)
   - `SQLITE_URL` or, later, `POSTGRES_URL` when we add Postgres.
   - `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` once the GitHub App is set up.

With those in place, the Render web + worker services give you a 24/7 cloud‑hosted DevinSwarm that can process jobs from the Redis queue.

## CI

The workflow at `.github/workflows/ci.yml`:

- Runs on pushes and pull requests targeting `main`.
- Installs dependencies and runs `npm run build`.

Later steps in the runbook will extend this to run tests, linters, and security checks, and wire reviewer/ops workers and branch protections.

