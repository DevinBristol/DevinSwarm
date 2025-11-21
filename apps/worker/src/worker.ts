import { makeWorker, reviewQueue } from "../../../packages/shared/queue";
import { PrismaClient } from "@prisma/client";
import { ghInstallClient } from "../../../packages/shared/github";
import { ALLOWED_REPOS, AUTO_MERGE_LOW_RISK } from "../../../packages/shared/policy";
import { evaluateHitl } from "../../../orchestrator/policies/hitl";
import { runOrchestratorForRun } from "../../../orchestrator";
import { createWorkspace, cleanupWorkspace, WorkspacePaths } from "../../../tools/fs";

const prisma = new PrismaClient();
const gh = ghInstallClient();

// Log a safe snapshot of worker-relevant env (no secret content).
// This is useful to compare local vs Render configuration via logs.
// Values that could contain secrets are only reported as present/missing.
// eslint-disable-next-line no-console
console.log("Dev worker env snapshot", {
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

// Dev worker v0: simple end-to-end PR to prove wiring.
makeWorker(
  "dev",
  async (job: any) => {
    const { runId } = job.data as { runId: string };
    const attempt = typeof job.attemptsMade === "number" ? job.attemptsMade + 1 : 1;
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run) return;

    let workspace: WorkspacePaths | null = null;

    try {
      workspace = createWorkspace(runId);
      await prisma.event.create({
        data: { runId, type: "workspace:init", payload: { root: workspace.root, tempDir: workspace.tempDir } },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[dev] failed to init workspace for run ${runId}:`, err);
    }

    if (!ALLOWED_REPOS.has(run.repo)) {
      await prisma.$transaction([
      prisma.run.update({
        where: { id: runId },
        data: {
          state: "failed",
          blockedReason: "Repo not allowed",
          phase: "dev",
          reviewStatus: "blocked",
          opsStatus: "blocked",
        },
      }),
      prisma.event.create({
        data: { runId, type: "dev:failed", payload: { error: "Repo not allowed" } },
      }),
    ]);
      throw new Error(`Repo not allowed: ${run.repo}`);
    }

    try {
      await runOrchestratorForRun(
        { prisma },
        {
          id: runId,
          description: run.description ?? "",
          planSummary: run.title ?? null,
        },
      );
    } catch (err) {
      // orchestration logs shouldn't block dev worker
      // eslint-disable-next-line no-console
      console.warn(`[dev] orchestration logging failed for run ${runId}:`, err);
    }

    // Evaluate HITL before starting if required secrets are missing.
    const missingSecret = !process.env.GITHUB_APP_ID || !process.env.GITHUB_INSTALLATION_ID || !process.env.GITHUB_PRIVATE_KEY;
    const hitl = evaluateHitl({ missingSecret });
    if (hitl.escalate) {
      await prisma.$transaction([
        prisma.run.update({
          where: { id: runId },
          data: {
            state: "awaiting_unblock",
            blockedReason: `HITL: ${hitl.reason}`,
            phase: "dev",
            reviewStatus: "blocked",
            opsStatus: "blocked",
          },
        }),
        prisma.event.create({
          data: {
            runId,
            type: "hitl:escalated",
            payload: { reason: hitl.reason, requestedInput: hitl.requestedInput },
          },
        }),
      ]);
      return;
    }

    await prisma.$transaction([
      prisma.run.update({
        where: { id: runId },
        data: { state: "running", phase: "dev", reviewStatus: "pending", opsStatus: "pending" },
      }),
      prisma.event.create({
        data: { runId, type: "dev:start", payload: {} },
      }),
    ]);

    try {
      const [owner, repo] = run.repo.split("/");
      const repoInfo = await gh.request("GET /repos/{owner}/{repo}", { owner, repo });
      const defaultBranch = (repoInfo.data as any).default_branch;

      const baseRef = await gh.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      });
      const baseSha = (baseRef.data as any).object.sha;

      const branch = `swarm/run-${runId.slice(0, 8)}`;
      await gh
        .request("POST /repos/{owner}/{repo}/git/refs", {
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: baseSha,
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
            content: `Run ${runId}\n\n${run.description ?? ""}\n`,
          },
        ],
      });

      const commit = await gh.request("POST /repos/{owner}/{repo}/git/commits", {
        owner,
        repo,
        message: `chore(swarm): scaffold for run ${runId}`,
        tree: (tree.data as any).sha,
        parents: [baseSha],
      });

      await gh.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: (commit.data as any).sha,
        force: true,
      });

      const pr = await gh.request("POST /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        title: `Swarm: ${run.title ?? run.description ?? runId}`,
        head: branch,
        base: defaultBranch,
        body: `Automated PR by DevinSwarm (run ${runId}).`,
      });

      if (AUTO_MERGE_LOW_RISK) {
        try {
          await gh.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
            owner,
            repo,
            pull_number: (pr.data as any).number,
            merge_method: "squash",
          });
        } catch {
          // okay if branch protection blocks auto-merge
        }
      }

      await prisma.event.create({
        data: {
          runId,
          type: "dev:completed",
          payload: { prNumber: (pr.data as any).number, branch },
        },
      });

      await prisma.run.update({
        where: { id: runId },
        data: {
          branch,
          prNumber: (pr.data as any).number,
          phase: "review",
          reviewStatus: "queued",
        },
      });

      // Hand off to reviewer queue; run stays "running" until ops finishes.
      await reviewQueue.add("review.start", {
        runId,
        repo: run.repo,
        branch,
        prNumber: (pr.data as any).number,
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
            state: hitlDecision.escalate ? "awaiting_unblock" : "awaiting_unblock",
            phase: "dev",
            reviewStatus: "blocked",
            opsStatus: "blocked",
            blockedReason: hitlDecision.escalate
              ? `HITL: ${hitlDecision.reason ?? String(err?.message ?? err)}`
              : String(err?.message ?? err),
          },
        }),
        prisma.event.create({
          data: { runId, type: "dev:failed", payload: { error: String(err?.message ?? err) } },
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
              data: {
                runId,
                type: "hitl:pending",
                payload: { note: "Awaiting unblock after failure" },
              },
        }),
      ]);
      throw err;
    } finally {
      if (workspace) {
        cleanupWorkspace(workspace);
        await prisma.event.create({
          data: { runId, type: "workspace:cleanup", payload: { root: workspace.root } },
        }).catch(() => {
          /* best effort cleanup */
        });
      }
    }
  },
  2,
);
