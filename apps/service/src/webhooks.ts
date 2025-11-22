import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { resumeRunFromHitl } from "./resume";

const prisma = new PrismaClient();

export function registerWebhook(app: FastifyInstance): void {
  app.post("/webhooks/github", async (req, rep) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      const sig = (req.headers["x-hub-signature-256"] as string) || "";
      const raw = (req as any).rawBody as string;
      const hmac = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
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
        await resumeRunFromHitl(prisma, runId);
      }
    }

    return { ok: true };
  });
}

