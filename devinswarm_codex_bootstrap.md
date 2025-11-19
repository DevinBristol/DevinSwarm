# DevinSwarm – Codex Bootstrap Script
**Audience:** Codex running in IntelliJ with `danger` / `workspace-write` enabled.  
**Goal:** Bring the DevinSwarm repo to a working baseline:
- Clean repo (no node_modules/.env/etc in git)
- Add Node/TypeScript toolchain, Postgres (Prisma), Redis queue (BullMQ)
- Add web service (`/health`, `/intake`, `/runs`, `/ui`)
- Add background worker (Dev worker) and Scout worker
- Wire Render (web + worker + Key Value + Postgres) via `infra/render.yaml`
- Enable GitHub App auth for direct repo read/write
- Default to OpenAI
- Enforce daily budget + low‑risk auto‑merge scaffold

You have full write access to the project root and may create folders/files as needed.

---

## 0. Assumptions and environment

- The project root is the DevinSwarm repo.
- Git is already initialized and remote is set.
- You may create/modify files and run Node/PNPM/NPM commands as needed.
- Do **NOT** create or commit any real secrets; only use `.env.example` values.

When in doubt, prefer small, focused commits with clear messages.

---

## 1. Repo hygiene and Node toolchain

1.1 **Create or update `.gitignore` in the repo root** with at least this content:

```gitignore
# Node/build
node_modules/
dist/

# Local env & DB
.env
*.db

# IDE
.idea/
*.iml
.DS_Store
```

1.2 **Create `.nvmrc`** in the repo root with:

```text
20.19.0
```

1.3 **Update `package.json`** (create if it does not exist; otherwise merge) so that at minimum it includes:

```jsonc
{
  "name": "devinswarm",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "build": "tsc --noEmit",
    "start:service": "tsx apps/service/src/server.ts",
    "start:worker": "tsx apps/worker/src/worker.ts",
    "start:scout": "tsx apps/scout/src/scout.ts",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "lint": "echo 'add eslint later'"
  },
  "engines": {
    "node": ">=20 <21",
    "npm": ">=10"
  },
  "dependencies": {
    "@octokit/auth-app": "^7.0.0",
    "@octokit/core": "^6.1.2",
    "@prisma/client": "^5.21.1",
    "bullmq": "^5.7.7",
    "fastify": "^4.28.1",
    "fastify-healthcheck": "^4.4.0",
    "ioredis": "^5.3.2",
    "openai": "^4.77.0",
    "pino": "^9.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/pino": "^9.0.4",
    "prisma": "^5.21.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

If a `package.json` already exists, merge these keys, preserving any existing scripts that are still needed.

1.4 **Create `tsconfig.json`** in the repo root if it does not exist:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "resolveJsonModule": true
  },
  "include": ["apps/**/*", "packages/**/*", "prisma/**/*"]
}
```

1.5 **Create `.env.example`** in the repo root:

```env
# LLM + budgets
OPENAI_API_KEY=
DAILY_BUDGET_USD=75

# GitHub App (for repo read/write)
GITHUB_APP_ID=
GITHUB_INSTALLATION_ID=
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=

# Datastores (local dev via Docker; Render injects its own)
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://swarm:swarm@localhost:5432/swarm?schema=public

# Policy
AUTO_MERGE_LOW_RISK=true
ALLOWED_REPOS=DevinBristol/DevinSwarm

# Minimal UI auth
UI_TOKEN=change-me
```

Do **not** commit a real `.env`. Only `.env.example` should be tracked.

Commit these changes with:

> `chore: base Node toolchain and env template`

---

## 2. Local Docker for Redis and Postgres

2.1 **Create `infra/docker-compose.dev.yml`**:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7
    ports: ["6379:6379"]
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: swarm
      POSTGRES_PASSWORD: swarm
      POSTGRES_DB: swarm
    ports: ["5432:5432"]
```

Commit:

> `chore: add dev docker-compose for Redis and Postgres`

---

## 3. Prisma schema and client

3.1 **Create Prisma schema at `prisma/schema.prisma`** with:

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Run {
  id            String   @id @default(uuid())
  repo          String
  title         String?
  description   String?
  state         RunState @default(queued)
  priority      Int      @default(0)
  budgetUsd     Float    @default(5)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  blockedReason String?
  labels        String[] @default([])
  events        Event[]
}

model Event {
  id        String   @id @default(uuid())
  runId     String
  run       Run      @relation(fields: [runId], references: [id], onDelete: Cascade)
  type      String
  payload   Json
  createdAt DateTime @default(now())
}

enum RunState {
  queued
  running
  blocked
  awaiting_unblock
  done
  failed
}
```

3.2 **Ensure Prisma client is generated via scripts**

The `package.json` already has:

- `db:generate`: `prisma generate`
- `db:push`: `prisma db push`

No additional changes required in this step.

Commit:

> `feat(runtime): add Prisma schema for runs and events`

---

## 4. Shared code: policy, GitHub, and queues

4.1 **Create folder `packages/shared`** if it doesn’t exist.

4.2 **Create `packages/shared/policy.ts`**:

```ts
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 75);
export const AUTO_MERGE_LOW_RISK = (process.env.AUTO_MERGE_LOW_RISK ?? "true") === "true";
export const ALLOWED_REPOS = new Set(
  (process.env.ALLOWED_REPOS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

// naive file-based low-risk heuristic; refine later
export function isLowRiskChangedFiles(files: string[]) {
  const risky = [
    /^src\/security\//,
    /^infra\//,
    /^database\//,
    /package\.json$/,
    /render\.yaml$/
  ];
  if (files.length > 50) return false;
  return files.every(f => !risky.some(rx => rx.test(f)));
}
```

4.3 **Create `packages/shared/github.ts`**:

```ts
import { Octokit } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";

export function ghInstallClient() {
  const appId = process.env.GITHUB_APP_ID!;
  const installationId = process.env.GITHUB_INSTALLATION_ID!;
  const privateKey = process.env.GITHUB_PRIVATE_KEY!.replace(/\n/g, "\n").replace(/\\n/g, "\n");

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId: Number(installationId) }
  });
}
```

4.4 **Create `packages/shared/queue.ts`**:

```ts
import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!);

export const devQueue = new Queue("dev", { connection });
export const reviewQueue = new Queue("review", { connection });
export const scoutQueue = new Queue("scout", { connection });

export const defaultJobOpts: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 1000,
  attempts: 2
};

export function makeWorker(name: string, processor: any, concurrency = 2) {
  return new Worker(name, processor, { connection, concurrency });
}

export function events(name: string) {
  return new QueueEvents(name, { connection });
}
```

Commit:

> `feat(shared): add policy, GitHub App client, and BullMQ helpers`

---

## 5. Web service: health, intake, runs, UI, and GitHub webhooks

Create folder structure: `apps/service/src` if it doesn’t exist.

5.1 **Create `apps/service/src/webhooks.ts`**:

```ts
import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export function registerWebhook(app: FastifyInstance) {
  app.post("/webhooks/github", async (req, rep) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers["x-hub-signature-256"] as string || "";
      const raw = (req as any).rawBody as string;
      const hmac = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (sig !== hmac) return rep.code(401).send({ error: "bad signature" });
    }

    const event = req.headers["x-github-event"];
    const body: any = req.body ?? {};

    if (event === "issues") {
      const labels: string[] = (body.issue?.labels ?? []).map((l: any) => l.name);
      const title = body.issue?.title ?? "";
      const unblock = labels.includes("unblocked") || /\/unblock/i.test(body.comment?.body ?? "");
      const runIdMatch = title.match(/run\s*([0-9a-fA-F-]{6,})/i);
      const runId = runIdMatch?.[1];
      if (unblock && runId) {
        await prisma.run.update({
          where: { id: runId },
          data: { state: "running", blockedReason: null }
        });
      }
    }

    return { ok: true };
  });
}
```

5.2 **Create `apps/service/src/server.ts`**:

```ts
import Fastify from "fastify";
import health from "fastify-healthcheck";
import { PrismaClient } from "@prisma/client";
import { devQueue } from "../../../packages/shared/queue";
import { registerWebhook } from "./webhooks";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Raw-body parser so GitHub HMAC can be verified in webhooks
app.addContentTypeParser("application/json", { parseAs: "string" }, function (req, body, done) {
  try {
    (req as any).rawBody = body;
    done(null, JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.register(health);
registerWebhook(app);

app.get("/health", async () => ({ ok: true }));

app.post("/intake", async (req, rep) => {
  const body: any = req.body ?? {};
  const { repo, description, title, budgetUsd } = body;
  if (!repo) return rep.code(400).send({ error: "repo required" });

  const run = await prisma.run.create({
    data: {
      id: randomUUID(),
      repo,
      description,
      title,
      state: "queued",
      budgetUsd: Number(budgetUsd ?? 5)
    }
  });

  await devQueue.add("dev.start", { runId: run.id });

  return run;
});

app.get("/runs", async () => {
  return prisma.run.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
});

app.get("/runs/:id", async (req, rep) => {
  const id = (req.params as any).id;
  const run = await prisma.run.findUnique({
    where: { id },
    include: { events: true }
  });
  if (!run) return rep.code(404).send({ error: "not found" });
  return run;
});

app.post("/runs/:id/unblock", async (req, rep) => {
  const token = (req.headers["x-ui-token"] ?? "") as string;
  if (token !== process.env.UI_TOKEN) return rep.code(401).send({ error: "unauthorized" });
  const id = (req.params as any).id;
  await prisma.run.update({
    where: { id },
    data: { state: "running", blockedReason: null }
  });
  return { ok: true };
});

app.get("/ui", async (_req, rep) => {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: 30
  });
  const rows = runs
    .map(
      (r) => `
  <tr>
    <td>${r.createdAt.toISOString()}</td>
    <td>${r.state}</td>
    <td>${r.repo}</td>
    <td>${r.description ?? ""}</td>
    <td>${r.blockedReason ?? ""}</td>
    <td>${
      r.state === "awaiting_unblock"
        ? `<button onclick="unblock('${r.id}')">Unblock</button>`
        : ""
    }</td>
  </tr>`
    )
    .join("");

  const html = `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1">
  <h2>DevinSwarm Runs</h2>
  <table border=1 cellpadding=6>
    <tr><th>Time</th><th>State</th><th>Repo</th><th>Description</th><th>Blocked</th><th>Action</th></tr>
    ${rows}
  </table>
  <script>
    async function unblock(id) {
      const resp = await fetch('/runs/' + id + '/unblock', {
        method: 'POST',
        headers: { 'x-ui-token': '${process.env.UI_TOKEN ?? "change-me"}' }
      });
      if (resp.ok) location.reload(); else alert('Failed');
    }
  </script>`;

  return rep.type("text/html").send(html);
});

app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
```

Commit:

> `feat(service): add health, intake, runs API, GitHub webhook, and minimal UI`

---

## 6. Dev worker and Scout worker

Create folder structure: `apps/worker/src` and `apps/scout/src` if they don’t exist.

6.1 **Create `apps/worker/src/worker.ts`**:

```ts
import { makeWorker } from "../../../packages/shared/queue";
import { PrismaClient } from "@prisma/client";
import { ghInstallClient } from "../../../packages/shared/github";
import { ALLOWED_REPOS, AUTO_MERGE_LOW_RISK } from "../../../packages/shared/policy";

const prisma = new PrismaClient();
const gh = ghInstallClient();

// Dev worker v0: simple end-to-end PR to prove wiring.
makeWorker(
  "dev",
  async (job) => {
    const { runId } = job.data as { runId: string };
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run) return;

    if (!ALLOWED_REPOS.has(run.repo)) {
      await prisma.run.update({
        where: { id: runId },
        data: { state: "failed", blockedReason: "Repo not allowed" }
      });
      throw new Error(`Repo not allowed: ${run.repo}`);
    }

    await prisma.run.update({
      where: { id: runId },
      data: { state: "running" }
    });

    try {
      const [owner, repo] = run.repo.split("/");
      const repoInfo = await gh.request("GET /repos/{owner}/{repo}", { owner, repo });
      const defaultBranch = (repoInfo.data as any).default_branch;

      const baseRef = await gh.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      });
      const baseSha = (baseRef.data as any).object.sha;

      const branch = `swarm/run-${runId.slice(0, 8)}`;
      await gh
        .request("POST /repos/{owner}/{repo}/git/refs", {
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: baseSha
        })
        .catch(() => {});

      const tree = await gh.request("POST /repos/{owner}/{repo}/git/trees", {
        owner,
        repo,
        base_tree: baseSha,
        tree: [
          {
            path: "SWARM_PING.md",
            mode: "100644",
            type: "blob",
            content: `Run ${runId}\n\n${run.description ?? ""}\n`
          }
        ]
      });

      const commit = await gh.request("POST /repos/{owner}/{repo}/git/commits", {
        owner,
        repo,
        message: `chore(swarm): scaffold for run ${runId}`,
        tree: (tree.data as any).sha,
        parents: [baseSha]
      });

      await gh.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: (commit.data as any).sha,
        force: true
      });

      const pr = await gh.request("POST /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        title: `Swarm: ${run.title ?? run.description ?? runId}`,
        head: branch,
        base: defaultBranch,
        body: `Automated PR by DevinSwarm (run ${runId}).`
      });

      if (AUTO_MERGE_LOW_RISK) {
        try {
          await gh.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
            owner,
            repo,
            pull_number: (pr.data as any).number,
            merge_method: "squash"
          });
        } catch {
          // okay if branch protection blocks auto-merge
        }
      }

      await prisma.run.update({
        where: { id: runId },
        data: { state: "done" }
      });
    } catch (err: any) {
      await prisma.run.update({
        where: { id: runId },
        data: {
          state: "awaiting_unblock",
          blockedReason: String(err?.message ?? err)
        }
      });
    }
  },
  2 // concurrency
);
```

6.2 **Create `apps/scout/src/scout.ts`**:

```ts
import { makeWorker } from "../../../packages/shared/queue";
import { ghInstallClient } from "../../../packages/shared/github";

const gh = ghInstallClient();

// v0 scout: improvement suggestion issue
makeWorker("scout", async () => {
  const [owner, repo] = (process.env.SCOUT_REPO ?? "DevinBristol/DevinSwarm").split("/");
  await gh.request("POST /repos/{owner}/{repo}/issues", {
    owner,
    repo,
    title: "Scout: framework improvement sweep",
    body: "Propose improvements to agent prompts, risk scoring, and CI integration based on recent runs."
  });
}, 1);
```

Commit:

> `feat(workers): add dev worker and scout worker`

---

## 7. Render blueprint (web + worker + KV + Postgres)

7.1 **Create folder `infra`** if it doesn’t exist.

7.2 **Create `infra/render.yaml`** with:

```yaml
services:
  - type: web
    name: devinswarm-service
    runtime: node
    plan: starter
    buildCommand: "npm ci && npm run db:generate && npm run db:push && npm run build"
    startCommand: "npm run start:service"
    envVars:
      - key: NODE_VERSION
        value: "20.19.0"
      - key: OPENAI_API_KEY
        sync: false
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: devinswarm-kv
          property: connectionString
      - key: DATABASE_URL
        fromDatabase:
          name: devinswarm-postgres
          property: connectionString
      - key: GITHUB_APP_ID
        sync: false
      - key: GITHUB_INSTALLATION_ID
        sync: false
      - key: GITHUB_PRIVATE_KEY
        sync: false
      - key: GITHUB_WEBHOOK_SECRET
        sync: false
      - key: DAILY_BUDGET_USD
        value: "75"
      - key: AUTO_MERGE_LOW_RISK
        value: "true"
      - key: ALLOWED_REPOS
        value: "DevinBristol/DevinSwarm"
      - key: UI_TOKEN
        sync: false
    healthCheckPath: "/health"

  - type: worker
    name: devinswarm-worker
    runtime: node
    plan: starter
    buildCommand: "npm ci && npm run db:generate && npm run db:push && npm run build"
    startCommand: "npm run start:worker"
    envVars:
      - key: NODE_VERSION
        value: "20.19.0"
      - key: OPENAI_API_KEY
        sync: false
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: devinswarm-kv
          property: connectionString
      - key: DATABASE_URL
        fromDatabase:
          name: devinswarm-postgres
          property: connectionString
      - key: GITHUB_APP_ID
        sync: false
      - key: GITHUB_INSTALLATION_ID
        sync: false
      - key: GITHUB_PRIVATE_KEY
        sync: false
      - key: DAILY_BUDGET_USD
        value: "75"
      - key: AUTO_MERGE_LOW_RISK
        value: "true"
      - key: ALLOWED_REPOS
        value: "DevinBristol/DevinSwarm"

  - type: keyvalue
    name: devinswarm-kv
    plan: starter
    ipAllowList: []

databases:
  - name: devinswarm-postgres
    plan: starter
```

Commit:

> `infra(render): add render blueprint for service, worker, KV, and Postgres`

---

## 8. README update (optional but recommended)

Append to or create `README.md` in the repo root (merge with any existing content):

```md
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

Use `infra/render.yaml` as a Blueprint in Render. Set the following environment variables in the Render dashboard (do not commit secrets):

- `OPENAI_API_KEY`
- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `UI_TOKEN`
```

Commit:

> `docs: document DevinSwarm bootstrap, local dev, and Render deploy`

---

## 9. Final checks

After all steps above are done:

1. Ensure `npm ci` succeeds.
2. Ensure `npm run db:generate` and `npm run db:push` succeed.
3. Ensure `npm run start:service` and `npm run start:worker` both start without crashing.
4. From a terminal, test:

```bash
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/intake   -H "Content-Type: application/json"   -d '{"repo":"DevinBristol/DevinSwarm","description":"Test run from Codex"}'
```

5. Confirm `/ui` renders a table of runs in a browser.

When all of this works locally, the repo is ready for Render Blueprint deployment using `infra/render.yaml`.
