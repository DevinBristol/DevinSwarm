import { makeWorker, opsQueue } from "../../../packages/shared/queue";
import { PrismaClient } from "@prisma/client";
import { ALLOWED_REPOS } from "../../../packages/shared/policy";
import { evaluateHitl } from "../../../orchestrator/policies/hitl";

const prisma = new PrismaClient();

// Light env snapshot for debugging (no secrets).
// eslint-disable-next-line no-console
console.log("Reviewer worker env snapshot", {
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
  "review",
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
              blockedReason: "Repo not allowed (review)",
              phase: "review",
              reviewStatus: "blocked",
            },
          }),
          prisma.event.create({
            data: { runId, type: "review:failed", payload: { error: "Repo not allowed" } },
          }),
        ]);
        throw new Error(`Repo not allowed for review: ${run.repo}`);
      }

      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: { phase: "review", reviewStatus: "running" },
        }),
        prisma.event.create({
          data: {
            runId,
            type: "review:start",
            payload: { branch: branch ?? run.branch, prNumber: prNumber ?? run.prNumber },
          },
        }),
      ]);

      // Stub review worker: log and hand off to ops. Extend with tests/linters and PR comments later.
      // eslint-disable-next-line no-console
      console.log(`[review] stub processed run ${runId} for ${targetRepo}`);

      await prisma.event.create({
        data: {
          runId,
          type: "review:completed",
          payload: { branch: branch ?? run.branch, prNumber: prNumber ?? run.prNumber },
        },
      });
      await prisma.run.update({
        where: { id: runId },
        data: { phase: "ops", reviewStatus: "done", opsStatus: "queued" },
      });
      await opsQueue.add("ops.start", {
        runId,
        repo: targetRepo,
        branch: branch ?? run.branch,
        prNumber: prNumber ?? run.prNumber,
      });
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
            phase: "review",
            reviewStatus: "blocked",
          },
        }),
        prisma.event.create({
          data: { runId, type: "review:failed", payload: { error: String(err?.message ?? err) } },
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
              data: { runId, type: "hitl:pending", payload: { note: "Awaiting unblock after review failure" } },
            }),
      ]);

      throw err;
    }
  },
  2,
);
