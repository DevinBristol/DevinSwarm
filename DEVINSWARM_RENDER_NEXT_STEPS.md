# DevinSwarm Render v2 — Next Steps Cheat Sheet

This file captures how to run DevinSwarm locally and on Render now that the service, worker, and GitHub App path are all working (runs reach `done` and open PRs).

## Context Snapshot

- Repo is bootstrapped with:
  - Fastify web service at `apps/service/src/server.ts` (`/health`, `/intake`, `/runs`, `/ui`, `/webhooks/github`).
  - Dev worker at `apps/worker/src/worker.ts` using BullMQ and a GitHub App (App ID `2314650`, installation `95392227`).
  - Reviewer worker stub at `apps/worker/src/reviewer.ts` (review queue).
  - Ops worker stub at `apps/worker/src/ops.ts` (ops queue).
  - Scout worker at `apps/scout/src/scout.ts`.
  - Prisma schema at `prisma/schema.prisma` backed by Postgres.
  - Shared helpers at `packages/shared/*` (policy, GitHub App client, queue).
  - Infra v2 at `infra/docker-compose.dev.yml` and root `render.yaml`.
- Local smoke test is working:
  - `npm run start:service` + `npm run start:worker` + local Redis/Postgres.
  - `/health`, `/intake`, and `/ui` all behave as expected.
- GitHub App is set up with:
  - `GITHUB_APP_ID=2314650`
  - `GITHUB_INSTALLATION_ID=95392227`
  - `GITHUB_PRIVATE_KEY` stored in `.env` as a single line with `\n` escapes (no surrounding quotes).
  - `GITHUB_WEBHOOK_SECRET=placeholder_123456789`
- `.env` (local only, not committed) also includes:
  - `OPENAI_API_KEY=<your OpenAI key>`
  - `DATABASE_URL=postgresql://devinswarm:devinswarm@localhost:5432/devinswarm?schema=public`
  - `REDIS_URL=redis://localhost:6379`
  - `AUTO_MERGE_LOW_RISK=true`
  - `ALLOWED_REPOS=DevinBristol/DevinSwarm` (comma-separated to add more later)
  - `ARTIFACT_BLOB_THRESHOLD_BYTES=5000000`
  - `ARTIFACT_RETENTION_DAYS=7`
  - `UI_TOKEN=placeholder_123456789`

If this file exists, the repo is already migrated to the new stack; use it as the quick start for both local dev and Render.

## Local Dev — How to Re-Run

From `C:\Users\Devin\IdeaProjects\Swarm`:

```powershell
# 1) Start Docker-backed infra
docker compose -f infra/docker-compose.dev.yml up -d

# 2) Ensure DB schema is applied (safe if already in sync)
npm run db:push

# 3) Start service and worker (separate terminals)
npm run start:service   # http://localhost:3000/health and /ui
npm run start:worker
# optional: reviewer and ops workers
npm run start:reviewer-worker
npm run start:ops-worker
```

Test locally:

```powershell
Invoke-RestMethod http://localhost:3000/health

Invoke-RestMethod http://localhost:3000/intake `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"repo":"DevinBristol/DevinSwarm","description":"Local smoke test"}'
```

Then open `http://localhost:3000/ui` in a browser.
- `/ui` shows recent runs with state, phase, review/ops status, branch, and PR; it includes an intake form to enqueue new runs inline.

## Render — Stack and Config (already applied)

Render is already configured via the root `render.yaml` as a Blueprint:

- Web service: `devinswarm-service` (runs `npm run start:service`).
- Dev worker: `devinswarm-worker` (runs `npm run start:worker`).
- Reviewer worker: `devinswarm-reviewer` (runs `npm run start:reviewer-worker`).
- Ops worker: `devinswarm-ops` (runs `npm run start:ops-worker`).
- Keyvalue: `devinswarm-kv` (provides `REDIS_URL`).
- Postgres: `devinswarm-postgres` (provides `DATABASE_URL`).
- Auto-deploy: enabled for the Render services/workers; pushes to `main` trigger deployments.

For **all services/workers** (`devinswarm-service`, `devinswarm-worker`, `devinswarm-reviewer`, `devinswarm-ops`):

- `OPENAI_API_KEY` = same as in `.env`.
- `GITHUB_APP_ID` = `2314650`
- `GITHUB_INSTALLATION_ID` = `95392227`
- `GITHUB_PRIVATE_KEY` = exactly the same string as in `.env` (one line, `\n`-escaped, no surrounding quotes).
- `GITHUB_WEBHOOK_SECRET` = `placeholder_123456789`
- Optionally override:
  - `DAILY_BUDGET_USD` (e.g. `75`)
  - `AUTO_MERGE_LOW_RISK` (`true`/`false`)
  - `ALLOWED_REPOS` (e.g. `DevinBristol/DevinSwarm`, comma-separated)
  - `ARTIFACT_BLOB_THRESHOLD_BYTES` (default `5000000`)
  - `ARTIFACT_RETENTION_DAYS` (default `7`)

Additionally for **web service** (`devinswarm-service`):

- `UI_TOKEN` = `placeholder_123456789` (or a stronger secret if you change it locally).

Do **not** override:

- `DATABASE_URL` (comes from `devinswarm-postgres`).
- `REDIS_URL` (comes from `devinswarm-kv`).

## Remote Smoke Test on Render

From your machine:

```powershell
# Health
Invoke-RestMethod https://<service-url>/health

# Env debug (requires UI token)
Invoke-RestMethod https://<service-url>/debug/env `
  -Headers @{ "x-ui-token" = "placeholder_123456789" }

# Intake
Invoke-RestMethod https://<service-url>/intake `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"repo":"DevinBristol/DevinSwarm","description":"Render smoke test"}'
```

Then:

- Visit `https://<service-url>/ui` in your browser:
  - Confirm the new run shows up and eventually reaches `done`.
- Check GitHub (`DevinBristol/DevinSwarm`):
  - Look for a new branch `swarm/run-...` and a PR titled `Swarm: ...`.

## HITL / Unblock Paths

To test human-in-the-loop behavior on Render:

1. Trigger a run that will block (e.g. temporarily change `ALLOWED_REPOS` to something else, deploy, and run `/intake`).
2. Watch `/ui` and confirm the run reaches `awaiting_unblock` with a `blockedReason`.
3. Use `/runs/:id/unblock` via the UI button to move it back to `running` and then `done`.
4. Optionally wire the GitHub App webhook (below) and test unblocking via issues.

## GitHub App Webhook

1. Get the public URL of `devinswarm-service` from Render, e.g.:
   - `https://devinswarm-service.onrender.com`
2. In GitHub App settings:
   - Webhook URL: `https://<service-url>/webhooks/github`
   - Webhook secret: `placeholder_123456789` (same as env).
3. To unblock from GitHub:3
4. 
   - Open an issue with a title containing `run <run-id>` and label `unblocked`, **or**
   - Comment `/unblock` on an issue with that title.
   - The webhook will move the corresponding run to `running` and clear `blockedReason`.

## If Render Fails

- Check service logs in Render for:
  - `ECONNREFUSED` to Redis/Postgres (means wiring is wrong).
  - Prisma errors (schema or `DATABASE_URL` issues).
  - Octokit/GitHub App errors (bad App ID, installation ID, or private key).
- Verify:
  - `GITHUB_PRIVATE_KEY` matches the PEM on the GitHub App (string formatting is correct).
  - `GITHUB_INSTALLATION_ID` is the number in the installation URL:
    - `https://github.com/settings/installations/<ID>`
  - `ALLOWED_REPOS` contains `DevinBristol/DevinSwarm`.

Use this file as the quick checklist to resume work if the dev environment crashes or you pick this up later, whether you are on your work PC or home PC.
