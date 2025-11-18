import { Annotation, END, START, StateGraph, } from "@langchain/langgraph";
const OrchestratorState = Annotation.Root({
    runId: Annotation(),
    description: Annotation(),
    plan: Annotation(),
    status: Annotation(),
    logs: Annotation({
        reducer: (left, right) => left.concat(right),
        default: () => [],
    }),
});
const intakeNode = async (state) => {
    return {
        status: "intake-complete",
        logs: [`[intake] received run ${state.runId}`],
    };
};
const planNode = async (state) => {
    const plan = state.plan ?? `Draft plan for: ${state.description}`;
    return {
        status: "plan-complete",
        plan,
        logs: [`[plan] planned run ${state.runId}`],
    };
};
const assignNode = async (state) => {
    return {
        status: "assign-complete",
        logs: [
            `[assign] assigned dev worker for run ${state.runId}`,
        ],
    };
};
const reportNode = async (state) => {
    return {
        status: "report-complete",
        logs: [
            `[report] completed run ${state.runId} with plan: ${state.plan ?? "<none>"}`,
        ],
    };
};
const graphBuilder = new StateGraph(OrchestratorState)
    .addNode("intake", intakeNode)
    .addNode("plan", planNode)
    .addNode("assign", assignNode)
    .addNode("report", reportNode)
    .addEdge(START, "intake")
    .addEdge("intake", "plan")
    .addEdge("plan", "assign")
    .addEdge("assign", "report")
    .addEdge("report", END);
export const orchestratorGraph = graphBuilder.compile({
    name: "devinswarm-orchestrator",
});
export async function runDevWorkflow(input) {
    const initialState = {
        runId: input.id,
        description: input.description,
        plan: null,
        status: "queued",
        logs: [],
    };
    const result = await orchestratorGraph.invoke(initialState);
    return result;
}
//# sourceMappingURL=manager.graph.js.map