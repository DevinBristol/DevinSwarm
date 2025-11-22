#!/usr/bin/env node
import assert from "assert";
import Module from "module";
import path from "path";
import { defaultRetries, type StepLog } from "../orchestrator/graph/manager.graph.ts";
import { evaluateHitl } from "../orchestrator/policies/hitl.ts";

interface FakeRun {
  id: string;
  repo: string;
  description: string;
  branch: string | null;
  planSummary: string | null;
  state: "queued" | "running" | "blocked" | "awaiting_unblock" | "done" | "failed";
  phase: string;
  currentNode: string;
  retries: Record<string, any> | null;
  tasks: any;
  statusHistory?: StepLog[] | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  lastError?: string | null;
  blockedReason?: string | null;
  title?: string | null;
  source?: string | null;
  labels?: string[];
}

class FakePrismaClient {
  public runs: FakeRun[];
  public events: any[];

  constructor(initialRuns: FakeRun[]) {
    this.runs = initialRuns;
    this.events = [];
  }

  run = {
    findUnique: async ({ where: { id } }: { where: { id: string } }) => {
      return this.runs.find((r) => r.id === id) ?? null;
    },
    update: async ({ where: { id }, data }: { where: { id: string }; data: Partial<FakeRun> }) => {
      const run = this.runs.find((r) => r.id === id);
      if (!run) throw new Error(`run ${id} not found`);
      Object.assign(run, data);
      return run;
    },
  };

  event = {
    create: async ({ data }: { data: any }) => {
      this.events.push(data);
      return data;
    },
  };

  async $transaction(actions: Promise<unknown>[]) {
    return Promise.all(actions);
  }
}

// Redirect the .js graph import used in orchestrator/index.ts so ts-node can resolve the .ts source.
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  if (typeof request === "string" && request.includes("manager.graph.js")) {
    const redirected = request.replace("manager.graph.js", "manager.graph.ts");
    return originalResolveFilename.call(this, redirected, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

async function loadOrchestrator() {
  return import(path.resolve(__dirname, "../orchestrator/index.ts"));
}

async function testEventPersistence(): Promise<void> {
  const { runOrchestratorForRun } = await loadOrchestrator();
  const runId = `run-${Date.now()}`;
  const prisma = new FakePrismaClient([
    {
      id: runId,
      repo: "DevinBristol/DevinSwarm",
      description: "Event persistence test",
      branch: "main",
      planSummary: "Event test plan",
      state: "queued",
      phase: "intake",
      currentNode: "intake",
      retries: { ...defaultRetries },
      tasks: [],
      statusHistory: [],
      startedAt: null,
      completedAt: null,
      lastError: null,
      blockedReason: null,
      title: "Event persistence test",
      source: "manual",
      labels: [],
    },
  ]);

  await runOrchestratorForRun(
    { prisma: prisma as any },
    {
      id: runId,
      repo: "DevinBristol/DevinSwarm",
      branch: "main",
      description: "Event persistence test",
      title: "Event persistence test",
      planSummary: "Event test plan",
      tasks: [],
      source: "manual",
    },
  );

  const run = prisma.runs[0];
  assert.strictEqual(run.state, "done", "run should reach done");
  assert.strictEqual(run.phase, "report", "final phase should be report");
  assert(run.startedAt instanceof Date, "startedAt should be set");
  assert(run.completedAt instanceof Date, "completedAt should be set");
  assert(Array.isArray(run.statusHistory), "statusHistory should be stored");
  assert.strictEqual(
    (run.statusHistory as StepLog[]).length,
    12,
    "statusHistory should include start/complete for each node",
  );

  const eventTypes = prisma.events.map((e) => e.type);
  const requiredEvents = [
    "orchestrator:intake:start",
    "orchestrator:intake:complete",
    "orchestrator:plan:complete",
    "orchestrator:dev-execute:start",
    "orchestrator:ops:complete",
    "orchestrator:report:complete",
    "orchestrator:completed",
  ];
  requiredEvents.forEach((evt) => assert(eventTypes.includes(evt), `event ${evt} should be emitted`));

  const planComplete = prisma.events.find((e) => e.type === "orchestrator:plan:complete");
  assert(planComplete?.payload?.snapshot?.planSummary, "plan summary should be present in event payload");
  assert(planComplete?.payload?.snapshot?.tasks, "tasks should be present in payload snapshot");
  assert.strictEqual(planComplete?.payload?.iteration, 1, "iteration should be present in event payload");
  assert(typeof planComplete?.payload?.durationMs === "number", "duration should be present in event payload");

  const finalEvent = prisma.events[prisma.events.length - 1];
  assert.strictEqual(finalEvent.type, "orchestrator:completed", "final event should be orchestrator:completed");
  assert.strictEqual(finalEvent.status, "completed", "final event should mark completed status");
  assert.strictEqual(finalEvent.payload.iteration, 1, "final event should carry iteration");
}

async function testBlockedHistorySkipsRun(): Promise<void> {
  const { runOrchestratorForRun } = await loadOrchestrator();
  const runId = `blocked-${Date.now()}`;
  const blockedHistory: StepLog[] = [
    {
      node: "plan",
      status: "blocked",
      phase: "plan",
      currentNode: "plan",
      retries: { ...defaultRetries },
      transition: "blocked",
      reason: "test block",
      snapshot: {
        status: "blocked",
        phase: "plan",
        currentNode: "plan",
        retries: { ...defaultRetries },
        tasks: [],
        planSummary: "blocked summary",
        title: "blocked test",
        description: "blocked test",
        branch: "main",
        repo: "DevinBristol/DevinSwarm",
      },
      timestamp: new Date().toISOString(),
    },
  ];
  const prisma = new FakePrismaClient([
    {
      id: runId,
      repo: "DevinBristol/DevinSwarm",
      description: "Blocked run test",
      branch: "main",
      planSummary: "blocked summary",
      state: "running",
      phase: "plan",
      currentNode: "plan",
      retries: { ...defaultRetries },
      tasks: [],
      statusHistory: blockedHistory,
      startedAt: null,
      completedAt: null,
      lastError: null,
      blockedReason: "test block",
      title: "Blocked run test",
      source: "manual",
      labels: [],
    },
  ]);

  await runOrchestratorForRun(
    { prisma: prisma as any },
    {
      id: runId,
      repo: "DevinBristol/DevinSwarm",
      branch: "main",
      description: "Blocked run test",
      title: "Blocked run test",
      planSummary: "blocked summary",
      tasks: [],
      source: "manual",
    },
  );

  assert.strictEqual(prisma.events.length, 0, "blocked history should prevent new events");
  const run = prisma.runs[0];
  assert.strictEqual(run.state, "running", "run state should remain unchanged when blocked in history");
  assert.strictEqual(run.startedAt, null, "run should not be started when blocked");
}

function testHitlPolicy(): void {
  const missingSecret = evaluateHitl({ missingSecret: true });
  assert(missingSecret.escalate, "missing secret should trigger escalation");
  assert.strictEqual(missingSecret.reason, "missing-secret");

  const repeatedTests = evaluateHitl({ failedTestAttempts: 3 });
  assert(repeatedTests.escalate, "repeated test failures should escalate");
  assert.strictEqual(repeatedTests.reason, "repeated-test-failures");

  const safePath = evaluateHitl({});
  assert.strictEqual(safePath.escalate, false, "no flags should not escalate");
}

async function main() {
  await testEventPersistence();
  await testBlockedHistorySkipsRun();
  testHitlPolicy();

  // eslint-disable-next-line no-console
  console.log("orchestrator event + HITL tests passed");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
