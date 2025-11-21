import type { PrismaClient } from "@prisma/client";

import { runDevWorkflow } from "./graph/manager.graph.js";

export interface OrchestratorRunContext {
  prisma: PrismaClient;
}

export async function runOrchestratorForRun(
  ctx: OrchestratorRunContext,
  input: {
    id: string;
    description: string;
    planSummary?: string | null;
    source?: string;
  },
): Promise<void> {
  const graphState = await runDevWorkflow({
    id: input.id,
    description: input.description,
    planSummary: input.planSummary ?? null,
    source: input.source ?? "queue",
  });

  await ctx.prisma.event.create({
    data: {
      runId: input.id,
      type: "orchestrator:completed",
      payload: {
        status: graphState.status,
        planSummary: graphState.planSummary,
        logs: graphState.logs,
      },
    },
  });
}
