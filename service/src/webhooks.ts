import type { Request, Response } from "express";
import crypto from "node:crypto";
import { cfg } from "./config.js";
import { handleTask } from "./workerEntrypoint.js";

function verifySig(body: string, sig: string | undefined) {
  if (!cfg.webhookSecret) return true;
  if (!sig) return false;
  const h = crypto.createHmac("sha256", cfg.webhookSecret);
  const digest = "sha256=" + h.update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

export async function githubWebhook(req: Request, res: Response) {
  const payloadStr = JSON.stringify(req.body || {});
  const sig = req.header("x-hub-signature-256");
  if (!verifySig(payloadStr, sig)) return res.status(401).send("bad signature");
  // Minimal routing for issues/comments/workflow_run
  const ev = req.header("x-github-event");
  const repo = req.body?.repository?.full_name;
  let type: "intake" | "comment" | "ci_failure" | "pr" | "unknown" = "unknown";
  let issueNumber: number | undefined;

  if (ev === "issues") {
    type = "intake";
    issueNumber = req.body?.issue?.number;
  } else if (ev === "issue_comment") {
    type = "comment";
    issueNumber = req.body?.issue?.number;
  } else if (ev === "workflow_run" && req.body?.action === "completed" && req.body?.workflow_run?.conclusion === "failure") {
    type = "ci_failure";
  } else if (ev === "pull_request") {
    type = "pr";
    issueNumber = req.body?.number;
  }

  await handleTask({ type, repo, issueNumber, payload: req.body });
  res.json({ ok: true });
}
