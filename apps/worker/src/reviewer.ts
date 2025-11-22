import { PrismaClient } from "@prisma/client";
import { evaluateHitl } from "../../../orchestrator/policies/hitl";
import { ALLOWED_REPOS } from "../../../packages/shared/policy";
import { makeWorker, opsQueue } from "../../../packages/shared/queue";
import { createPrComment, ghInstallClient, setCommitStatus } from "../../../packages/shared/github";
import { runTests } from "../../../tools/tests";

const prisma = new PrismaClient();

// Default command tuned for 512MB instances (Render): smaller heap cap + skip lib checks.
const reviewerCommand =
  process.env.REVIEWER_COMMAND ??
  "node --max-old-space-size=384 node_modules/.bin/tsc --noEmit --skipLibCheck --pretty false";
const reviewStatusContext = process.env.REVIEW_STATUS_CONTEXT ?? "swarm/review";

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
  REVIEWER_COMMAND: reviewerCommand,
  REVIEW_STATUS_CONTEXT: reviewStatusContext,
});

let gh = null as ReturnType<typeof ghInstallClient> | null;
try {
  gh = ghInstallClient();
} catch {
  gh = null;
}

const truncate = (text: string, limit = 2000): string =>
  text.length > limit ? `${text.slice(0, limit)}\n...[truncated]` : text;

const getHeadSha = async (owner: string, repo: string, branch?: string): Promise<string | null> => {
  if (!gh || !branch) return null;
  try {
    const result = await gh.request("GET /repos/{owner}/{repo}/branches/{branch}", {
      owner,
      repo,
      branch,
    });
    return (result.data as any)?.commit?.sha ?? null;
  } catch {
    return null;
  }
};

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
    const [owner, repoName] = targetRepo.split("/");
    const branchName = branch ?? run.branch ?? null;
    const prNum = prNumber ?? run.prNumber ?? null;
    const commitSha = await getHeadSha(owner, repoName, branchName ?? undefined);

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
            payload: { branch: branchName, prNumber: prNum },
          },
        }),
      ]);

      if (commitSha) {
        await setCommitStatus(gh, {
          owner,
          repo: repoName,
          sha: commitSha,
          state: "pending",
          context: reviewStatusContext,
          description: "Reviewer checks running",
        });
      }

      const tests = await runTests(reviewerCommand, { cwd: process.cwd() });
      const trimmedOutput = truncate(tests.output);

      await prisma.event.create({
        data: {
          runId,
          type: "review:tests",
          payload: { success: tests.success, output: trimmedOutput },
        },
      });

      if (commitSha) {
        await setCommitStatus(gh, {
          owner,
          repo: repoName,
          sha: commitSha,
          state: tests.success ? "success" : "failure",
          context: reviewStatusContext,
          description: tests.success ? "Reviewer checks passed" : "Reviewer checks failed",
        });
      }

      if (prNum && gh) {
        await createPrComment(gh, {
          owner,
          repo: repoName,
          pullNumber: prNum,
          body: tests.success
            ? `✅ Reviewer checks passed for run ${runId}.\n\nCommand: \`${reviewerCommand}\`\n\nLogs:\n\`\`\`\n${trimmedOutput}\n\`\`\``
            : `❌ Reviewer checks failed for run ${runId}.\n\nCommand: \`${reviewerCommand}\`\n\nLogs:\n\`\`\`\n${trimmedOutput}\n\`\`\`\n\nPlease unblock or rerun after addressing failures.`,
        });
      }

      if (!tests.success) {
        throw new Error("Reviewer checks failed");
      }

      await prisma.event.create({
        data: {
          runId,
          type: "review:completed",
          payload: { branch: branchName, prNumber: prNum },
        },
      });
      await prisma.run.update({
        where: { id: runId },
        data: { phase: "ops", reviewStatus: "done", opsStatus: "queued" },
      });
      await opsQueue.add("ops.start", {
        runId,
        repo: targetRepo,
        branch: branchName ?? undefined,
        prNumber: prNum ?? undefined,
      });
    } catch (err: any) {
      if (commitSha) {
        await setCommitStatus(gh, {
          owner,
          repo: repoName,
          sha: commitSha,
          state: "failure",
          context: reviewStatusContext,
          description: "Reviewer checks failed",
        });
      }

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
