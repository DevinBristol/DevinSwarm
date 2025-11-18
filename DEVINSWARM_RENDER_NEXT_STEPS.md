# DevinSwarm Render v2 – Next Steps Cheat Sheet

This file captures where the bootstrap left off and what to do once GitHub’s server issues (500/502 on `git push`) are resolved.

## Context Snapshot

- Repo is bootstrapped with:
  - Fastify web service at `apps/service/src/server.ts` (`/health`, `/intake`, `/runs`, `/ui`, `/webhooks/github`).
  - Dev worker at `apps/worker/src/worker.ts` using BullMQ and a GitHub App (App ID `2314650`, installation `95392227`).
  - Scout worker at `apps/scout/src/scout.ts`.
  - Prisma schema at `prisma/schema.prisma` backed by Postgres.
  - Shared helpers at `packages/shared/*` (policy, GitHub App client, queue).
  - Infra v2 at `infra/docker-compose.dev.yml` and `infra/render.yaml`.
- Local smoke test is working:
  - `npm run start:service` + `npm run start:worker` + local Redis/Postgres.
  - `/health`, `/intake`, and `/ui` all behave as expected.
- GitHub App is set up with:
  - `GITHUB_APP_ID=2314650`
  - `GITHUB_INSTALLATION_ID=95392227`
  - `GITHUB_PRIVATE_KEY` stored in `.env` as a single line with `\n` escapes.
  - `GITHUB_WEBHOOK_SECRET=placeholder_123456789`
- `.env` (local only, not committed) also includes:
  - `OPENAI_API_KEY=<your OpenAI key>`
  - `DATABASE_URL=postgres://swarm:swarm@localhost:5432/swarm`
  - `REDIS_URL=redis://localhost:6379`
  - `AUTO_MERGE_LOW_RISK=true`
  - `ALLOWED_REPOS=DevinBristol/DevinSwarm`
  - `UI_TOKEN=placeholder_123456789`

If this file exists, the repo is already migrated to the new stack; you mainly need to push and configure Render.

## Local Dev – How to Re-Run

From `C:\Users\Devin\IdeaProjects\Swarm`:

```powershell
# 1) Start Docker-backed infra
docker compose -f infra/docker-compose.dev.yml up -d

# 2) Ensure DB schema is applied (safe if already in sync)
npm run db:push

# 3) Start service and worker (separate terminals)
npm run start:service   # http://localhost:3000/health and /ui
npm run start:worker
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

## When GitHub Push Starts Working Again

1. **Push `main`**
   ```powershell
   git push origin main
   ```

2. **Create Render Blueprint (v2 stack)**
   - In Render:
     - New → Blueprint.
     - Select repo: `DevinBristol/DevinSwarm`.
     - Blueprint path: `infra/render.yaml`.
   - Render should propose:
     - Web service: `devinswarm-service`
     - Worker: `devinswarm-worker`
     - Keyvalue: `devinswarm-kv`
     - Postgres: `devinswarm-postgres`

3. **Set env vars in Render (web + worker)**

   For **both** `devinswarm-service` and `devinswarm-worker`:

   - `OPENAI_API_KEY` = same as in `.env`.
   - `GITHUB_APP_ID` = `2314650`
   - `GITHUB_INSTALLATION_ID` = `95392227`
   - `GITHUB_PRIVATE_KEY` = exactly the same string as in `.env` (one line, `\n`-escaped).
   - `GITHUB_WEBHOOK_SECRET` = `placeholder_123456789`
   - Optionally override:
     - `DAILY_BUDGET_USD` (e.g. `75`)
     - `AUTO_MERGE_LOW_RISK` (`true`/`false`)
     - `ALLOWED_REPOS` (e.g. `DevinBristol/DevinSwarm`)

   Additionally for **web service** (`devinswarm-service`):

   - `UI_TOKEN` = `placeholder_123456789` (or a stronger secret if you change it locally).

   Do **not** override:

   - `DATABASE_URL` (comes from `devinswarm-postgres`).
   - `REDIS_URL` (comes from `devinswarm-kv`).

4. **Apply the Blueprint**
   - Click “Apply Blueprint” in Render.
   - Wait until:
     - `devinswarm-service` is “Live”.
     - `devinswarm-worker` is “Live”.

5. **Update GitHub App webhook**
   - Get the public URL of `devinswarm-service` from Render, e.g.:
     - `https://devinswarm-service.onrender.com`
   - In GitHub App settings:
     - Webhook URL: `https://<service-url>/webhooks/github`
     - Webhook secret: `placeholder_123456789` (same as env).

6. **Remote Smoke Test on Render**

   From your machine:

   ```powershell
   # Health
   Invoke-RestMethod https://<service-url>/health

   # Intake
   Invoke-RestMethod https://<service-url>/intake `
     -Method Post `
     -ContentType "application/json" `
     -Body '{"repo":"DevinBristol/DevinSwarm","description":"Render smoke test"}'
   ```

   Then:

   - Visit `https://<service-url>/ui` in your browser:
     - Confirm the new run shows up.
   - Check GitHub (`DevinBristol/DevinSwarm`):
     - Look for a new branch `swarm/run-...` and a PR titled `Swarm: ...`.

## If Render Fails During Deploy

- Check service logs in Render for:
  - `ECONNREFUSED` to Redis/Postgres (means wiring is wrong).
  - Prisma errors (schema or `DATABASE_URL` issues).
  - Octokit/GitHub App errors (bad App ID, installation ID, or private key).
- Verify:
  - `GITHUB_PRIVATE_KEY` matches the PEM on the GitHub App (string formatting is correct).
  - `GITHUB_INSTALLATION_ID` is the number in the installation URL:
    - `https://github.com/settings/installations/<ID>`
  - `ALLOWED_REPOS` contains `DevinBristol/DevinSwarm`.

Use this file as the quick checklist to resume work if the dev environment crashes or you pick this up later.

