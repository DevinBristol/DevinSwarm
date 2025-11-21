import type { Prisma, PrismaClient, RunState as PrismaRunState } from "@prisma/client";

import {
  defaultRetries,
  type NodeName,
  runDevWorkflow,
  type StepLog,
  type WorkflowResult,
} from "./graph/manager.graph.js";
import type { RunInput } from "./state/runState.js";

export interface OrchestratorRunContext {
  prisma: PrismaClient;
}

const mapRunStatusToPrisma = (status: string): PrismaRunState => {
  switch (status) {
    case "running":
      return "running";
    case "blocked":
      return "awaiting_unblock";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
};

const mapPrismaToGraphStatus = (state: PrismaRunState): string => {
  switch (state) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "awaiting_unblock":
    case "blocked":
      return "blocked";
    case "done":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
};

const NODE_SEQUENCE: NodeName[] = [
  "intake",
  "plan",
  "dev-execute",
  "review",
  "ops",
  "report",
];

const nextNodeFromHistory = (history: StepLog[]): NodeName | null => {
  if (history.length === 0) return "intake";

  const last = history[history.length - 1];
  if (last.transition === "blocked" || last.transition === "fail") {
    return null;
  }

  const lastComplete = [...history]
    .reverse()
    .find((h) => h.transition === "complete");
  if (!lastComplete) return "intake";

  const idx = NODE_SEQUENCE.indexOf(lastComplete.node as NodeName);
  if (idx === -1) return "intake";
  if (idx >= NODE_SEQUENCE.length - 1) return null;
  return NODE_SEQUENCE[idx + 1];
};

export async function runOrchestratorForRun(
  ctx: OrchestratorRunContext,
  input: RunInput & {
    id: string;
    planSummary?: string | null;
    source?: string;
  },
): Promise<void> {
  const run = await ctx.prisma.run.findUnique({
    where: { id: input.id },
  });
  if (!run) return;
  if (run.state === "done" || run.state === "failed") return;
  if (run.state === "awaiting_unblock" || run.state === "blocked") return;

  const history = Array.isArray(run.statusHistory)
    ? (run.statusHistory as unknown as StepLog[])
    : [];

  const startNode = nextNodeFromHistory(history);
  if (startNode === null) {
    // Blocked or already completed in history.
    return;
  }

  const initialStatus = mapPrismaToGraphStatus(run.state);
  const startState: Partial<RunInput> & {
    phase?: string | null;
    currentNode?: string | null;
    status?: string;
    retries?: unknown;
  } = {
    repo: run.repo,
    branch: run.branch ?? "main",
    description: run.description ?? input.description,
    title: run.title ?? input.title,
    planSummary: run.planSummary ?? input.planSummary ?? null,
    tasks: (run.tasks as any) ?? input.tasks ?? [],
    source: run.source ?? input.source ?? "manual",
    phase: run.phase ?? "intake",
    currentNode: run.currentNode ?? "intake",
    status: initialStatus,
    retries: (run.retries as any) ?? defaultRetries,
  };

  const persistStep = async (
    step: StepLog,
    state: WorkflowResult["state"],
    steps: StepLog[],
  ) => {
    const prismaState = mapRunStatusToPrisma(state.status);
    const firstStart =
      steps.find((s) => s.transition === "start")?.timestamp ?? step.timestamp;
    const completedAt =
      step.node === "report" &&
      step.transition === "complete" &&
      state.status === "completed"
        ? new Date(step.timestamp)
        : run.completedAt;
    await ctx.prisma.$transaction([
      ctx.prisma.run.update({
        where: { id: input.id },
        data: {
          planSummary: state.planSummary,
          phase: state.phase,
          currentNode: state.currentNode,
          tasks: state.tasks as Prisma.JsonArray,
          retries: state.retries as Prisma.JsonObject,
          statusHistory: steps as unknown as Prisma.JsonArray,
          state: prismaState,
          startedAt:
            run.startedAt ??
            (step.transition === "start" && step.node === "intake"
              ? new Date(step.timestamp)
              : new Date(firstStart)),
          completedAt,
          lastError:
            step.transition === "fail" || step.transition === "blocked"
              ? step.reason ?? null
              : run.lastError,
        },
      }),
      ctx.prisma.event.create({
        data: {
          runId: input.id,
          type: `orchestrator:${step.node}:${step.transition}`,
          node: step.node,
          status: step.status,
          reason: step.reason,
          payload: {
            phase: step.phase,
            retries: step.retries,
            transition: step.transition,
            timestamp: step.timestamp,
            snapshot: step.snapshot,
          },
        },
      }),
    ]);
  };

  const graphState = await runDevWorkflow({
    id: input.id,
    repo: startState.repo!,
    branch: startState.branch ?? "main",
    description: startState.description ?? "",
    title: startState.title,
    planSummary: startState.planSummary ?? null,
    source: startState.source ?? "queue",
    tasks: startState.tasks ?? [],
    retries: (startState.retries as unknown as typeof defaultRetries) ?? defaultRetries,
    startNode: startNode ?? "intake",
    currentNode: (startState.currentNode as NodeName | undefined) ?? "intake",
    phase: startState.phase ?? "intake",
    status: startState.status ?? "queued",
    history,
    onStep: persistStep,
  });

  // Final snapshot event/log.
  await ctx.prisma.event.create({
    data: {
      runId: input.id,
      type: "orchestrator:completed",
      node: graphState.state.currentNode,
      status: graphState.state.status,
      payload: {
        status: graphState.state.status,
        planSummary: graphState.state.planSummary,
        tasks: graphState.state.tasks,
        retries: graphState.state.retries,
        phase: graphState.state.phase,
      },
    },
  });
}
