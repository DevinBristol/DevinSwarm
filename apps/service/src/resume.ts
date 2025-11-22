import type { PrismaClient, Run } from "@prisma/client";
import { devQueue, opsQueue, reviewQueue } from "../../../packages/shared/queue";

interface ResumeResult {
  status: "ok" | "not_found" | "skipped";
  queue?: "dev" | "review" | "ops";
  run?: Run;
}

export async function resumeRunFromHitl(prisma: PrismaClient, runId: string): Promise<ResumeResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return { status: "not_found" };
  if (run.state !== "awaiting_unblock") return { status: "skipped", run };

  let queue: ResumeResult["queue"];

  // Default updates common to all phases.
  const data: Partial<Run> = {
    state: "running",
    blockedReason: null,
  };

  switch (run.phase) {
    case "dev":
    case null:
    case undefined:
      queue = "dev";
      data.phase = "dev";
      data.reviewStatus = run.reviewStatus ?? "pending";
      data.opsStatus = run.opsStatus ?? "pending";
      break;
    case "review":
      queue = "review";
      data.phase = "review";
      data.reviewStatus = "queued";
      data.opsStatus = run.opsStatus ?? "pending";
      break;
    case "ops":
      queue = "ops";
      data.phase = "ops";
      data.opsStatus = "queued";
      break;
    default:
      queue = "dev";
      data.phase = run.phase ?? "dev";
      data.reviewStatus = run.reviewStatus ?? "pending";
      data.opsStatus = run.opsStatus ?? "pending";
      break;
  }

  await prisma.$transaction([
    prisma.run.update({
      where: { id: runId },
      data,
    }),
    prisma.event.create({
      data: { runId, type: "hitl:unblocked", payload: { phase: run.phase ?? null } },
    }),
    prisma.event.create({
      data: {
        runId,
        type: "hitl:resume_enqueued",
        payload: { queue, phase: data.phase ?? run.phase ?? null },
      },
    }),
  ]);

  if (queue === "dev") {
    await devQueue.add("dev.start", { runId });
  } else if (queue === "review") {
    await reviewQueue.add("review.start", {
      runId,
      repo: run.repo,
      branch: run.branch ?? undefined,
      prNumber: run.prNumber ?? undefined,
    });
  } else if (queue === "ops") {
    await opsQueue.add("ops.start", {
      runId,
      repo: run.repo,
      branch: run.branch ?? undefined,
      prNumber: run.prNumber ?? undefined,
    });
  }

  return { status: "ok", queue, run: { ...run, ...data } as Run };
}
