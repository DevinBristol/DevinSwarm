# Phase 1 Follow-ups: Orchestrator & State

- [ ] Graph execution is a custom sequential runner, not the compiled `orchestratorGraph`, so success/failure/blocked edges are not exercised and worker outcomes are not driving transitions.
  - Replace the manual `runNode` sequence with the compiled graph; gate edges on node results (success/fail/blocked) and retry policy; wire review/ops paths to queue outcomes.
- [ ] Run state is only persisted after the full workflow finishes, so there is no resumability or mid-run visibility.
  - Persist `Run.state/phase/currentNode/retries/tasks/planSummary/statusHistory` before and after each node; make updates transactional with per-node events; add a resume path that rehydrates the graph from DB.
- [ ] Step events are emitted after the full run and lack reasons/metadata; `statusHistory` is not updated incrementally.
  - Emit `orchestrator:<node>` events on start/complete/fail/blocked with retry counts, reasons, and timestamps; append `statusHistory` as transitions occur instead of all-at-once at the end.
- [ ] `startedAt`, `completedAt`, and `lastError` are never set; there is no Prisma migration recorded for the new columns.
  - Add a Prisma migration for the schema changes; set `startedAt` on first node entry, `completedAt` on report/terminal fail, and `lastError` on failures.
- [ ] `/intake` and the dev worker both call `runOrchestratorForRun`, causing duplicate orchestration logs/events per run.
  - Choose a single entry point (likely intake) to record orchestrator steps; have workers emit their own events and let orchestrator consume those signals instead of re-running.
- [ ] Nodes only mark progress; they do not incorporate worker results, HITL signals, or failure paths into transitions.
  - Add event/queue-driven status updates from dev/review/ops; include HITL/unblock handling and failure transitions (e.g., retry or escalate) before moving to the next node.
