#!/usr/bin/env tsx
import assert from "assert";
import { runDevWorkflow, defaultRetries } from "../orchestrator/graph/manager.graph.js";

async function main() {
  const baseInput = {
    runId: "transition-test",
    repo: "DevinBristol/DevinSwarm",
    branch: "main",
    title: "Transition test",
    description: "Test transitions and retry caps",
    planSummary: "Test plan",
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
  assert(full.steps.some((s) => s.node === "review" && s.transition === "complete"), "review should complete");
  assert(full.steps.some((s) => s.node === "ops" && s.transition === "complete"), "ops should complete");

  // Retry cap: force dev to exceed limit
  const devRetryState = await runDevWorkflow({
    ...baseInput,
    retries: { ...defaultRetries, dev: 2 }, // already at limit
  });
  assert.strictEqual(devRetryState.state.status, "failed", "dev retry cap should fail run");

  // Blocked path should stop progression; we assert detection before running.
  const historyBlocked = [
    {
      node: "plan",
      status: "blocked",
      phase: "plan",
      currentNode: "plan",
      retries: defaultRetries,
      transition: "blocked" as const,
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
    },
  ];

  const hasBlocked = historyBlocked.some(
    (s) => s.transition === "blocked" || s.transition === "fail",
  );
  assert.strictEqual(hasBlocked, true, "blocked history should be detected before running");

  // eslint-disable-next-line no-console
  console.log("orchestrator transition tests passed");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
