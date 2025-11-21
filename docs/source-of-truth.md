# DevinSwarm Source of Truth (main)

This is the only living plan/status doc. Keep it on `main`, update it every session, and avoid creating parallel plan files. Always sync to the latest `origin/main` before editing.

## Update Rules
- At session start, run `npm run bootstrap:codex` then `npm run codex:context` to fetch/prune, compare to `origin/main`, and surface the current SOT + git status/diff + recent events. To force a clean sync to `origin/main`, set `CODEX_RESET_TO_ORIGIN_MAIN=1` (WARNING: discards local changes).
- Apply any plan/decision/scope/status changes here immediately (no separate drafts); prepend to Session Log.
- If you must diverge on a branch, rebase SOT from `main` first and merge back early.

## Goals (current)
- End-to-end autonomous loop: intake -> plan -> execute -> review/test -> fix/retry -> report/merge.
- Durable run state/events/artifacts in Postgres; observable transitions.
- Safe workspace + GitHub operations with guardrails and HITL paths.

## Current Phase
- Phase: **Phase 1 – Orchestrator & State Model**
- Acceptance: run state persisted between nodes, retry policy enforced, events emitted per transition, resumable after restarts.

## Active Plan
- [ ] Persist run state per node (status/phase/currentNode/retries/tasks/planSummary/statusHistory) and support resume from DB.
- [ ] Emit structured events per transition (start/complete/fail/blocked) with reasons/retries/timestamps.
- [ ] Drive transitions via compiled graph with retry limits; integrate worker results/HITL for success/fail/escalate edges.
- [ ] Set timestamps (`startedAt`/`completedAt`) and `lastError`; finalize Prisma migration for new columns.
- [ ] Deduplicate orchestrator entry (single caller) and let workers publish their own events.

## Decisions
- 2025-11-21: Allowlist starts with `DevinBristol/DevinSwarm`; ensure installation ID matches.
- 2025-11-21: Short-term artifacts stay in Postgres/PR comments; S3/MinIO when blobs >~5 MB or retention >7 days.
- 2025-11-21: Initial retry budgets: plan 1–2; dev 1–2; review 1; ops 1–2; escalate sooner on repeatable failures.

## Risks / Unknowns
- Resumability and per-node persistence not yet implemented; mid-run crashes will lose progress.
- Event/schema changes need migration and app alignment; pending until Phase 1 tasks land.
- Drift risk if SOT updates are skipped; CI guardrail and PR template added to mitigate.

## Open Questions
- Keep allowlist to DevinSwarm only until first self-iteration, or expand sooner?
- Any node-specific retry caps to tighten/loosen beyond the initial defaults?

## Session Log (newest first)
- 2025-11-21: Created single SOT on `main`, archived prior plan docs, added bootstrap/guardrail instructions.

## Backlog / Later Phases
- Phase 2: Tools & workspace management (git/fs/tests/github wrappers, per-run workspace lifecycle).
- Phase 3: Role workers (dev/reviewer/ops queues and scripts).
- Phase 4–6: Policies/HITL, observability, self-iteration behaviors; RAG optional.
- Phase 7: CI/CD safety nets and e2e smoke tests.
