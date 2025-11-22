import {
  Annotation,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";

import type { RunInput, RunState } from "../state/runState.ts";

type Task = RunState["tasks"][number];
type Retries = RunState["retries"];

export const DEFAULT_MAX_ITERATIONS = 2;

export const defaultRetries: Retries = {
  plan: 0,
  dev: 0,
  review: 0,
  ops: 0,
};

const retryLimits: Retries = {
  plan: 2,
  dev: 2,
  review: 1,
  ops: 1,
};

const bumpTaskStatus = (
  tasks: Task[],
  role: Task["role"],
  status: Task["status"],
): Task[] => {
  return tasks.map((task) =>
    task.role === role ? { ...task, status } : task,
  );
};

const ensureTasks = (
  tasks: Task[],
  description: string,
): Task[] => {
  if (tasks.length > 0) return tasks;

  return [
    { title: `Plan: ${description}`, role: "plan", status: "done" },
    { title: `Dev: ${description}`, role: "dev", status: "pending" },
    { title: "Review changes", role: "review", status: "pending" },
    { title: "Ops merge checks", role: "ops", status: "pending" },
  ];
};

const OrchestratorState = Annotation.Root({
  runId: Annotation<string>(),
  repo: Annotation<string>(),
  branch: Annotation<string>(),
  title: Annotation<string | null>(),
  description: Annotation<string>(),
  planSummary: Annotation<string | null>(),
  status: Annotation<string>(),
  phase: Annotation<string>(),
  currentNode: Annotation<string>(),
  tasks: Annotation<Task[]>({
    default: () => [],
    reducer: (_left, right) => right,
  }),
  retries: Annotation<Retries>({
    default: () => defaultRetries,
    reducer: (left, right) => ({
      ...left,
      ...right,
    }),
  }),
  logs: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  iteration: Annotation<number>({
    default: () => 1,
    reducer: (_left, right) => right,
  }),
  maxIterations: Annotation<number>({
    default: () => DEFAULT_MAX_ITERATIONS,
    reducer: (_left, right) => right,
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;

export interface StepLog {
  node: string;
  status: string;
  phase: string;
  currentNode: string;
  retries: Retries;
  transition: "start" | "complete" | "fail" | "blocked";
  reason?: string;
  snapshot: StateSnapshot;
  timestamp: string;
}

const intakeNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => ({
  status: "running",
  phase: "intake",
  currentNode: "intake",
  logs: [`[intake] received run ${state.runId} for ${state.repo}`],
});

const planNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  const planSummary =
    state.planSummary ??
    `Draft plan for: ${state.description}`;

  return {
    status: "running",
    phase: "plan",
    currentNode: "plan",
    planSummary,
    tasks: ensureTasks(state.tasks, state.description),
    retries: { ...state.retries, plan: state.retries.plan ?? 0 },
    logs: [
      `[plan] planned run ${state.runId}`,
      `[plan] summary: ${planSummary}`,
    ],
  };
};

const devExecuteNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  const retries = {
    ...state.retries,
    dev: state.retries.dev + 1,
  };
  return {
    status: "running",
    phase: "dev",
    currentNode: "dev-execute",
    tasks: bumpTaskStatus(state.tasks, "dev", "in_progress"),
    retries,
    logs: [
      `[dev-execute] attempt ${retries.dev} for ${state.runId}`,
    ],
  };
};

const reviewNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  const retries = {
    ...state.retries,
    review: state.retries.review + 1,
  };
  return {
    status: "running",
    phase: "review",
    currentNode: "review",
    tasks: bumpTaskStatus(state.tasks, "review", "in_progress"),
    retries,
    logs: [
      `[review] attempt ${retries.review} for ${state.runId}`,
    ],
  };
};

const opsNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => {
  const retries = {
    ...state.retries,
    ops: state.retries.ops + 1,
  };
  return {
    status: "running",
    phase: "ops",
    currentNode: "ops",
    tasks: bumpTaskStatus(state.tasks, "ops", "in_progress"),
    retries,
    logs: [
      `[ops] attempt ${retries.ops} for ${state.runId}`,
    ],
  };
};

const reportNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => ({
  status: "completed",
  phase: "report",
  currentNode: "report",
  tasks: bumpTaskStatus(
    bumpTaskStatus(
      bumpTaskStatus(state.tasks, "dev", "done"),
      "review",
      "done",
    ),
    "ops",
    "done",
  ),
  logs: [
    `[report] completed run ${
      state.runId
    } with plan: ${state.planSummary ?? "<none>"}`,
  ],
});

const escalateNode = async (
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> => ({
  status: "blocked",
  phase: "ops",
  currentNode: "escalate",
  logs: [
    `[escalate] run ${state.runId} requires HITL before continuing`,
  ],
});

const graphBuilder = new StateGraph(OrchestratorState)
  .addNode("intake", intakeNode)
  .addNode("plan", planNode)
  .addNode("dev-execute", devExecuteNode)
  .addNode("review", reviewNode)
  .addNode("ops", opsNode)
  .addNode("report", reportNode)
  .addNode("escalate", escalateNode)
  .addEdge(START, "intake")
  .addEdge("intake", "plan")
  .addEdge("plan", "dev-execute")
  .addEdge("dev-execute", "review")
  .addEdge("review", "ops")
  .addEdge("ops", "report")
  .addEdge("ops", "escalate")
  .addEdge("escalate", "report")
  .addEdge("report", END);

export const orchestratorGraph = graphBuilder.compile({
  name: "devinswarm-orchestrator",
});

export interface WorkflowResult {
  state: OrchestratorStateType;
  steps: StepLog[];
}

export type NodeName =
  | "intake"
  | "plan"
  | "dev-execute"
  | "review"
  | "ops"
  | "report"
  | "escalate";

const NODE_ORDER: NodeName[] = [
  "intake",
  "plan",
  "dev-execute",
  "review",
  "ops",
  "report",
];

const nodeFunctions: Record<
  NodeName,
  (s: OrchestratorStateType) => Promise<Partial<OrchestratorStateType>>
> = {
  intake: intakeNode,
  plan: planNode,
  "dev-execute": devExecuteNode,
  review: reviewNode,
  ops: opsNode,
  report: reportNode,
  escalate: escalateNode,
};

type StateSnapshot = Pick<
  OrchestratorStateType,
  | "status"
  | "phase"
  | "currentNode"
  | "retries"
  | "tasks"
  | "planSummary"
  | "title"
  | "description"
  | "branch"
  | "repo"
  | "iteration"
  | "maxIterations"
>;

export async function runDevWorkflow(
  input: RunInput & {
    id: string;
    planSummary?: string | null;
    startNode?: NodeName;
    status?: string;
    phase?: string;
    currentNode?: NodeName;
    retries?: Retries;
    history?: StepLog[];
    maxIterations?: number;
    iteration?: number;
    onStep?: (
      step: StepLog,
      state: OrchestratorStateType,
      steps: StepLog[],
    ) => Promise<void>;
  },
): Promise<WorkflowResult> {
  let state: OrchestratorStateType = {
    runId: input.id,
    repo: input.repo,
    branch: input.branch ?? "main",
    title: input.title ?? null,
    description: input.description,
    planSummary: input.planSummary ?? null,
    status: input.status ?? "queued",
    phase: input.phase ?? "intake",
    currentNode: input.currentNode ?? "intake",
    tasks: input.tasks ?? [],
    retries: input.retries ?? defaultRetries,
    logs: [],
    iteration: input.iteration ?? 1,
    maxIterations: input.maxIterations ?? DEFAULT_MAX_ITERATIONS,
  };

  const steps: StepLog[] = input.history ? [...input.history] : [];

  const snapshot = (): StateSnapshot => ({
    status: state.status,
    phase: state.phase,
    currentNode: state.currentNode,
    retries: state.retries,
    tasks: state.tasks,
    planSummary: state.planSummary,
    title: state.title,
    description: state.description,
    branch: state.branch,
    repo: state.repo,
    iteration: state.iteration,
    maxIterations: state.maxIterations,
  });

  const runNode = async (
    nodeName: keyof typeof graphBuilder["nodes"],
    fn: (
      s: OrchestratorStateType,
    ) => Promise<Partial<OrchestratorStateType>>,
  ) => {
    const startingStep: StepLog = {
      node: nodeName,
      status: state.status,
      phase: state.phase,
      currentNode: state.currentNode,
      retries: state.retries,
      transition: "start",
      snapshot: snapshot(),
      timestamp: new Date().toISOString(),
    };
    steps.push(startingStep);
    if (input.onStep) {
      await input.onStep(startingStep, state, steps);
    }

    // Enforce retry limits for dev/review/ops/plan nodes.
    if (
      nodeName === "dev-execute" ||
      nodeName === "review" ||
      nodeName === "ops" ||
      nodeName === "plan"
    ) {
      const key =
        nodeName === "dev-execute"
          ? "dev"
          : (nodeName as keyof Retries);
      const nextRetries = {
        ...state.retries,
        [key]: state.retries[key] + 1,
      };
      if (nextRetries[key] > retryLimits[key]) {
        state = { ...state, status: "failed", retries: nextRetries };
        const failStep: StepLog = {
          node: nodeName,
          status: state.status,
          phase: state.phase,
          currentNode: state.currentNode,
          retries: state.retries,
          transition: "fail",
          reason: `retry limit exceeded for ${nodeName}`,
          snapshot: snapshot(),
          timestamp: new Date().toISOString(),
        };
        steps.push(failStep);
        if (input.onStep) {
          await input.onStep(failStep, state, steps);
        }
        return;
      }
      state = { ...state, retries: nextRetries };
    }

    const patch = await fn(state);
    state = { ...state, ...patch };
    const completeStep: StepLog = {
      node: nodeName,
      status: state.status,
      phase: state.phase,
      currentNode: state.currentNode,
      retries: state.retries,
      transition: state.status === "blocked" ? "blocked" : "complete",
      snapshot: snapshot(),
      timestamp: new Date().toISOString(),
    };
    steps.push(completeStep);
    if (input.onStep) {
      await input.onStep(completeStep, state, steps);
    }
  };

  const startIndex = input.startNode
    ? Math.max(NODE_ORDER.indexOf(input.startNode), 0)
    : 0;

  const orderedNodes: NodeName[] = NODE_ORDER;
  let iteration = state.iteration ?? 1;
  const maxIterations = state.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  while (iteration <= maxIterations) {
    state.iteration = iteration;
    const iterationStartIndex =
      iteration === 1 ? startIndex : orderedNodes.indexOf("plan");

    for (let i = iterationStartIndex; i < orderedNodes.length; i += 1) {
      const nodeName = orderedNodes[i];
      await runNode(nodeName, nodeFunctions[nodeName]);
      if (state.status === "failed" || state.status === "blocked") {
        break;
      }
    }

    if (state.status === "completed") {
      return { state, steps };
    }
    if (state.status === "blocked") {
      return { state, steps };
    }
    if (state.status === "failed" && iteration < maxIterations) {
      const replanStep: StepLog = {
        node: "replan",
        status: "running",
        phase: "plan",
        currentNode: "plan",
        retries: state.retries,
        transition: "start",
        reason: `iteration ${iteration + 1} / ${maxIterations}`,
        snapshot: snapshot(),
        timestamp: new Date().toISOString(),
      };
      steps.push(replanStep);
      if (input.onStep) {
        await input.onStep(replanStep, state, steps);
      }

      state = {
        ...state,
        status: "running",
        phase: "plan",
        currentNode: "plan",
        retries: { ...defaultRetries },
        tasks: ensureTasks([], state.description),
        logs: state.logs.concat(`[replan] restarting iteration ${iteration + 1}`),
      };
      iteration += 1;
      continue;
    }

    return { state, steps };
  }

  return { state, steps };
}
