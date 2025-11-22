import { PrismaClient } from "@prisma/client";
import { evaluateHitl } from "../../../orchestrator/policies/hitl";
import { ALLOWED_REPOS } from "../../../packages/shared/policy";
import { makeWorker } from "../../../packages/shared/queue";
import { createPrComment, ghInstallClient, setCommitStatus } from "../../../packages/shared/github";
import { runTests } from "../../../tools/tests";

const prisma = new PrismaClient();

// Default command tuned for 512MB instances (Render): smaller heap cap + skip lib checks.
const opsCommand =
  process.env.OPS_COMMAND ??
  "node --max-old-space-size=384 node_modules/.bin/tsc --noEmit --skipLibCheck --pretty false";
const opsStatusContext = process.env.OPS_STATUS_CONTEXT ?? "swarm/ops";

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
  OPS_COMMAND: opsCommand,
  OPS_STATUS_CONTEXT: opsStatusContext,
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

      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: { phase: "ops", opsStatus: "running" },
        }),
        prisma.event.create({
          data: {
            runId,
            type: "ops:start",
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
          context: opsStatusContext,
          description: "Ops checks running",
        });
      }

      const statusCheck = await runTests(opsCommand, { cwd: process.cwd() });
      const trimmedOutput = truncate(statusCheck.output);

      await prisma.event.create({
        data: {
          runId,
          type: "ops:status",
          payload: { success: statusCheck.success, output: trimmedOutput },
        },
      });

      if (commitSha) {
        await setCommitStatus(gh, {
          owner,
          repo: repoName,
          sha: commitSha,
          state: statusCheck.success ? "success" : "failure",
          context: opsStatusContext,
          description: statusCheck.success ? "Ops checks passed" : "Ops checks failed",
        });
      }

      if (prNum && gh) {
        await createPrComment(gh, {
          owner,
          repo: repoName,
          pullNumber: prNum,
          body: statusCheck.success
            ? `✅ Ops checks passed for run ${runId}.\n\nCommand: \`${opsCommand}\`\n\nLogs:\n\`\`\`\n${trimmedOutput}\n\`\`\``
            : `❌ Ops checks failed for run ${runId}.\n\nCommand: \`${opsCommand}\`\n\nLogs:\n\`\`\`\n${trimmedOutput}\n\`\`\`\n\nPlease unblock or rerun after addressing failures.`,
        });
      }

      if (!statusCheck.success) {
        throw new Error("Ops checks failed");
      }

      // Guard next state to leave merge control manual for now.
      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: { state: "done", blockedReason: null, phase: "done", opsStatus: "done" },
        }),
        prisma.event.create({ data: { runId, type: "ops:completed", payload: {} } }),
      ]);
    } catch (err: any) {
      if (commitSha) {
        await setCommitStatus(gh, {
          owner,
          repo: repoName,
          sha: commitSha,
          state: "failure",
          context: opsStatusContext,
          description: "Ops checks failed",
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
