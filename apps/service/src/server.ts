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
    <td>${r.repo}</td>
    <td>${r.description ?? ""}</td>
    <td>${r.blockedReason ?? ""}</td>
    <td>${
      r.state === "awaiting_unblock" ? `<button onclick="unblock('${r.id}')">Unblock</button>` : ""
    }</td>
  </tr>`,
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
