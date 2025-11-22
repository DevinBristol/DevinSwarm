#!/usr/bin/env tsx
import assert from "assert";
import { runDevWorkflow, defaultRetries } from "../orchestrator/graph/manager.graph.ts";
import type { StepLog } from "../orchestrator/graph/manager.graph.ts";

async function main() {
  const baseInput = {
    id: "transition-test",
    repo: "DevinBristol/DevinSwarm",
    branch: "main",
    title: "Transition test",
    description: "Test transitions and retry caps",
    planSummary: "Test plan",
    source: "manual",
    status: "queued" as const,
    phase: "intake",
    currentNode: "intake",
    tasks: [],
    retries: defaultRetries,
  };

  // Happy path full traversal
  const full = await runDevWorkflow({
    ...baseInput,
    history: [],
  });
  assert.strictEqual(full.state.status, "completed", "full run should complete");
  const nodesVisited = full.steps.map((s) => s.node);
  ["intake", "plan", "dev-execute", "review", "ops", "report"].forEach((n) =>
    assert(nodesVisited.includes(n), `full run should include node ${n}`),
  );
  assert(full.steps.some((s) => s.node === "review" && s.transition === "complete"), "review should complete");
  assert(full.steps.some((s) => s.node === "ops" && s.transition === "complete"), "ops should complete");
  ["dev", "review", "ops"].forEach((role) => {
    const task = full.state.tasks.find((t) => t.role === role);
    assert(task?.status === "done", `task for ${role} should be marked done`);
  });
  ["plan", "dev", "review", "ops"].forEach((role) => {
    assert(
      typeof (full.state.retries as any)[role] === "number" && (full.state.retries as any)[role] >= 1,
      `retry counter for ${role} should be recorded`,
    );
  });
  assert(full.steps.every((s) => Boolean(s.timestamp)), "steps should carry timestamps");
  assert(
    full.steps.every((s) => s.snapshot.planSummary !== undefined && s.snapshot.retries !== undefined),
    "snapshots should carry planSummary and retries",
  );

  // Retry cap: force dev to exceed limit
  const devRetryState = await runDevWorkflow({
    ...baseInput,
    retries: { ...defaultRetries, dev: 2 }, // already at limit
  });
  assert.strictEqual(devRetryState.state.status, "failed", "dev retry cap should fail run");
  const devFail = devRetryState.steps.find((s) => s.node === "dev-execute" && s.transition === "fail");
  assert(devFail, "dev retry cap should log fail transition");
  assert(
    devFail?.reason === "retry limit exceeded for dev-execute",
    "fail transition should include retry limit reason",
  );

  // Blocked path should stop progression; we assert detection before running.
  const blockedStep: StepLog = {
    node: "plan",
    status: "blocked",
    phase: "plan",
    currentNode: "plan",
    retries: defaultRetries,
    transition: "blocked",
    reason: "test block",
    snapshot: {
      status: "blocked",
      phase: "plan",
      currentNode: "plan",
      retries: defaultRetries,
      tasks: [],
      planSummary: "blocked",
      title: "blocked",
      description: "blocked",
      branch: "main",
      repo: baseInput.repo,
    },
    timestamp: new Date().toISOString(),
  };

  const blockedResult = await runDevWorkflow({
    ...baseInput,
    history: [blockedStep],
    startNode: null,
  });
  const lastBlocked = blockedResult.steps.find((s) => s.transition === "blocked");
  assert(lastBlocked, "blocked history should be preserved in steps");
  assert(lastBlocked?.reason === "test block", "blocked reason should be preserved");
  assert.strictEqual(blockedResult.steps[0].transition, "blocked", "blocked history should remain first step");

  // eslint-disable-next-line no-console
  console.log("orchestrator transition tests passed");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
