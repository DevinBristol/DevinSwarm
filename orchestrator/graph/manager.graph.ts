import {
  Annotation,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";

import type { RunInput } from "../state/runState.js";

const OrchestratorState = Annotation.Root({
  runId: Annotation<string>(),
  description: Annotation<string>(),
  planSummary: Annotation<string | null>(),
  status: Annotation<string>(),
  logs: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;

const intakeNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  return {
    status: "intake-complete",
    logs: [`[intake] received run ${state.runId}`],
  };
};

const planNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  const planSummary =
    state.planSummary ??
    `Draft plan for: ${state.description}`;

  return {
    status: "plan-complete",
    planSummary,
    logs: [`[plan] planned run ${state.runId}`],
  };
};

const assignNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  return {
    status: "assign-complete",
    logs: [
      `[assign] assigned dev worker for run ${state.runId}`,
    ],
  };
};

const reportNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  return {
    status: "report-complete",
    logs: [
      `[report] completed run ${
        state.runId
      } with plan: ${state.planSummary ?? "<none>"}`,
    ],
  };
};

const escalateNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  return {
    status: "escalated",
    logs: [
      `[escalate] run ${state.runId} requires HITL before continuing`,
    ],
  };
};

const graphBuilder = new StateGraph(OrchestratorState)
  .addNode("intake", intakeNode)
  .addNode("plan", planNode)
  .addNode("assign", assignNode)
  .addNode("report", reportNode)
  .addNode("escalate", escalateNode)
  .addEdge(START, "intake")
  .addEdge("intake", "plan")
  .addEdge("plan", "assign")
  .addEdge("assign", "report")
  .addEdge("assign", "escalate")
  .addEdge("escalate", "report")
  .addEdge("report", END);

export const orchestratorGraph = graphBuilder.compile({
  name: "devinswarm-orchestrator",
});

export async function runDevWorkflow(
  input: RunInput & { id: string; planSummary?: string | null },
): Promise<OrchestratorStateType> {
  const initialState: OrchestratorStateType = {
    runId: input.id,
    description: input.description,
    planSummary: input.planSummary ?? null,
    status: "queued",
    logs: [],
  };

  const result = await orchestratorGraph.invoke(initialState);

  return result;
}

