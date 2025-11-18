import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { cfg } from "./config.js";
import { githubWebhook } from "./webhooks.js";
import { handleTask } from "./workerEntrypoint.js";
import { contextRoute } from "./routes/context.js";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/context", contextRoute);

// Manual tasks
app.post("/tasks", async (req, res) => {
  const tok = req.header("x-agent-token");
  if (cfg.agentToken && tok !== cfg.agentToken) return res.status(401).send("unauthorized");
  const out = await handleTask(req.body || {});
  res.json(out);
});

// GitHub webhook
app.post("/webhooks/github", githubWebhook);

app.listen(cfg.port, () => {
  console.log(`Agent Service listening on :${cfg.port}`);
});
