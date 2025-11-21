import Fastify from "fastify";
import health from "fastify-healthcheck";
import { PrismaClient } from "@prisma/client";
import { devQueue } from "../../../packages/shared/queue";
import { registerWebhook } from "./webhooks";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Raw-body parser so GitHub HMAC can be verified in webhooks
app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
  try {
    (req as any).rawBody = body;
    done(null, JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.register(health);
registerWebhook(app);

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
      phase: "intake",
      budgetUsd: Number(budgetUsd ?? 5),
    },
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
    include: { events: true },
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
    data: { state: "running", blockedReason: null },
  });
  return { ok: true };
});

app.get("/debug/env", async (req, rep) => {
  const token = (req.headers["x-ui-token"] ?? "") as string;
  if (token !== process.env.UI_TOKEN) return rep.code(401).send({ error: "unauthorized" });

  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV ?? null,
    PORT: process.env.PORT ?? null,
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    REDIS_URL: Boolean(process.env.REDIS_URL),
    GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? null,
    GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID ?? null,
    GITHUB_PRIVATE_KEY_PRESENT: Boolean(process.env.GITHUB_PRIVATE_KEY),
    GITHUB_WEBHOOK_SECRET_PRESENT: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
    OPENAI_API_KEY_PRESENT: Boolean(process.env.OPENAI_API_KEY),
    DAILY_BUDGET_USD: process.env.DAILY_BUDGET_USD ?? null,
    AUTO_MERGE_LOW_RISK: process.env.AUTO_MERGE_LOW_RISK ?? null,
    ALLOWED_REPOS: process.env.ALLOWED_REPOS ?? null,
    UI_TOKEN_PRESENT: Boolean(process.env.UI_TOKEN),
  };

  return envSnapshot;
});

app.get("/ui", async (_req, rep) => {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const rows = runs
    .map(
      (r) => `
  <tr>
    <td>${r.createdAt.toISOString()}</td>
    <td>${r.state}</td>
    <td>${r.phase ?? ""}</td>
    <td>${r.reviewStatus ?? ""}</td>
    <td>${r.opsStatus ?? ""}</td>
    <td>${r.repo}</td>
    <td>${r.branch ?? ""}</td>
    <td>${r.prNumber ?? ""}</td>
    <td>${r.description ?? ""}</td>
    <td>${
      r.state === "awaiting_unblock" ? "HITL" : ""
    }</td>
    <td>${r.blockedReason ?? ""}</td>
    <td>${
      r.state === "awaiting_unblock" ? `<button onclick="unblock('${r.id}')">Unblock</button>` : ""
    }</td>
  </tr>`,
    )
    .join("");

  const html = `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1">
  <h2>DevinSwarm Runs</h2>
  <div style="margin-bottom:12px;">
    <h4>New Intake</h4>
    <form id="intakeForm" onsubmit="return submitIntake(event)">
      <label>Repo <input name="repo" placeholder="DevinBristol/DevinSwarm" required /></label>
      <label>Title <input name="title" /></label>
      <label>Description <input name="description" /></label>
      <label>Budget USD <input name="budgetUsd" type="number" step="1" value="5" /></label>
      <button type="submit">Submit</button>
    </form>
    <div id="intakeStatus"></div>
  </div>
  <table border=1 cellpadding=6>
    <tr><th>Time</th><th>State</th><th>Phase</th><th>Review</th><th>Ops</th><th>Repo</th><th>Branch</th><th>PR</th><th>Description</th><th>Escalation</th><th>Blocked</th><th>Action</th></tr>
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
    async function submitIntake(evt) {
      evt.preventDefault();
      const form = document.getElementById('intakeForm');
      const data = Object.fromEntries(new FormData(form));
      const resp = await fetch('/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const statusEl = document.getElementById('intakeStatus');
      if (resp.ok) {
        statusEl.textContent = 'Submitted';
        form.reset();
        setTimeout(() => location.reload(), 300);
      } else {
        statusEl.textContent = 'Failed: ' + resp.status;
      }
    }
  </script>`;

  return rep.type("text/html").send(html);
});

app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
