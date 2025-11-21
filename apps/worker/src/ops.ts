import { makeWorker } from "../../../packages/shared/queue";
import { PrismaClient } from "@prisma/client";
import { ALLOWED_REPOS } from "../../../packages/shared/policy";
import { evaluateHitl } from "../../../orchestrator/policies/hitl";

const prisma = new PrismaClient();

// Light env snapshot for debugging (no secrets).
// eslint-disable-next-line no-console
console.log("Ops worker env snapshot", {
  NODE_ENV: process.env.NODE_ENV ?? null,
  DATABASE_URL_PRESENT: Boolean(process.env.DATABASE_URL),
  REDIS_URL_PRESENT: Boolean(process.env.REDIS_URL),
  GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? null,
  GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID ?? null,
  GITHUB_PRIVATE_KEY_PRESENT: Boolean(process.env.GITHUB_PRIVATE_KEY),
  GITHUB_WEBHOOK_SECRET_PRESENT: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
  OPENAI_API_KEY_PRESENT: Boolean(process.env.OPENAI_API_KEY),
  DAILY_BUDGET_USD: process.env.DAILY_BUDGET_USD ?? null,
  AUTO_MERGE_LOW_RISK: process.env.AUTO_MERGE_LOW_RISK ?? null,
  ALLOWED_REPOS: process.env.ALLOWED_REPOS ?? null,
});

makeWorker(
  "ops",
  async (job: any) => {
    const { runId, branch, prNumber, repo } = job.data as {
      runId?: string;
      branch?: string;
      prNumber?: number;
      repo?: string;
    };
    if (!runId) return;

    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run) return;

    const targetRepo = repo ?? run.repo;
    const attempt = typeof job.attemptsMade === "number" ? job.attemptsMade + 1 : 1;

    try {
      if (!ALLOWED_REPOS.has(targetRepo)) {
        await prisma.$transaction([
          prisma.run.update({
            where: { id: runId },
            data: {
              state: "awaiting_unblock",
              blockedReason: "Repo not allowed (ops)",
              phase: "ops",
              opsStatus: "blocked",
            },
          }),
          prisma.event.create({
            data: { runId, type: "ops:failed", payload: { error: "Repo not allowed" } },
          }),
        ]);
        throw new Error(`Repo not allowed for ops: ${run.repo}`);
      }

      // Evaluate HITL before starting ops.
      const hitlPrecheck = evaluateHitl({
        missingSecret:
          !process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY || !process.env.GITHUB_INSTALLATION_ID,
      });
      if (hitlPrecheck.escalate) {
        await prisma.$transaction([
          prisma.run.update({
            where: { id: runId },
            data: {
              state: "awaiting_unblock",
              blockedReason: `HITL: ${hitlPrecheck.reason}`,
              phase: "ops",
              opsStatus: "blocked",
            },
          }),
          prisma.event.create({
            data: {
              runId,
              type: "hitl:escalated",
              payload: { reason: hitlPrecheck.reason, requestedInput: hitlPrecheck.requestedInput },
            },
          }),
        ]);
        return;
      }

      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: { phase: "ops", opsStatus: "running" },
        }),
        prisma.event.create({
          data: {
            runId,
            type: "ops:start",
            payload: { branch: branch ?? run.branch, prNumber: prNumber ?? run.prNumber },
          },
        }),
      ]);

      // Stub ops worker: log and mark run complete. Extend with CI/status gating and merge logic later.
      // eslint-disable-next-line no-console
      console.log(`[ops] stub processed run ${runId} for ${targetRepo}`);

      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: { state: "done", blockedReason: null, phase: "done", opsStatus: "done" },
        }),
        prisma.event.create({ data: { runId, type: "ops:completed", payload: {} } }),
      ]);
    } catch (err: any) {
      const hitlDecision = evaluateHitl({
        failedTestAttempts: attempt,
        explicitReason: err?.response?.data?.message ? String(err.response.data.message) : undefined,
      });

      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: {
            state: "awaiting_unblock",
            blockedReason: hitlDecision.escalate
              ? `HITL: ${hitlDecision.reason ?? String(err?.message ?? err)}`
              : String(err?.message ?? err),
            phase: "ops",
            opsStatus: "blocked",
          },
        }),
        prisma.event.create({
          data: { runId, type: "ops:failed", payload: { error: String(err?.message ?? err) } },
        }),
        hitlDecision.escalate
          ? prisma.event.create({
              data: {
                runId,
                type: "hitl:escalated",
                payload: { reason: hitlDecision.reason, requestedInput: hitlDecision.requestedInput },
              },
            })
          : prisma.event.create({
              data: { runId, type: "hitl:pending", payload: { note: "Awaiting unblock after ops failure" } },
            }),
      ]);

      throw err;
    }
  },
  2,
);
