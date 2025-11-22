#!/usr/bin/env tsx
import assert from "assert";
import { runDevWorkflow } from "../orchestrator/graph/manager.graph.js";

async function main() {
  const baseInput = {
    runId: "test-run",
    repo: "DevinBristol/DevinSwarm",
    branch: "main",
    title: "Test resume",
    description: "Test orchestrator resume from mid-run",
    planSummary: "Test plan",
    status: "queued" as const,
    phase: "intake",
    currentNode: "intake",
    tasks: [],
    retries: undefined,
  };

  // First pass: capture full step history.
  const first = await runDevWorkflow({
    ...baseInput,
    history: [],
  });

  assert.strictEqual(first.state.status, "completed", "initial run should complete");
  const upToReview = first.steps.filter((step) => step.node !== "ops" && step.node !== "report");
  const lastSnapshot = upToReview[upToReview.length - 1]?.snapshot;
  assert(lastSnapshot, "snapshot should exist after review");

  // Simulate crash after review completion; resume at ops using saved snapshot/history.
  const resumed = await runDevWorkflow({
    runId: baseInput.runId,
    repo: baseInput.repo,
    branch: baseInput.branch,
    title: baseInput.title,
    description: baseInput.description,
    planSummary: lastSnapshot.planSummary,
    status: "running",
    phase: lastSnapshot.phase ?? "review",
    currentNode: lastSnapshot.currentNode ?? "review",
    tasks: lastSnapshot.tasks,
    retries: lastSnapshot.retries,
    history: upToReview,
    startNode: "ops",
  });

  assert.strictEqual(resumed.state.status, "completed", "resumed run should complete");
  assert(resumed.steps.some((s) => s.node === "ops"), "resumed run should execute ops node");
  assert(resumed.steps.some((s) => s.node === "report"), "resumed run should execute report node");

  // Basic guard on retry caps.
  assert(resumed.state.retries.ops >= 1, "ops retries should increment on resume");

  // eslint-disable-next-line no-console
  console.log("orchestrator resume test passed");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
