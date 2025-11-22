> **Archive:** Source of truth is `CODEx_RUNBOOK.md` - this file is retained for historical reference.

---
doc_type: codex_runbook
project: DevinSwarm
canonical: true
end_goal_1: "Self-iterating AI agent swarm with HITL"
end_goal_2: "Multi-language + multi-platform solutions (first: Salesforce)"
version: 0.1.0
---

# DevinSwarm — CODEx RUNBOOK (Source of Truth)

> This runbook is the **single, canonical source of truth** for:
> - Project goals and scope
> - Roadmap & milestones
> - Current stage & next steps
> - Documentation invariants
> - Codex behavior in this repo
>
> If any other file conflicts with this runbook, **this runbook wins**. Codex must fix the other file.

---

## 0. Migration from `source-of-truth.md`

**For Codex (one-time or as needed):**

1. Locate `source-of-truth.md` in this repo.
2. Read it fully and:
   - Pull over all relevant content into the matching sections below:
     - Goals / vision → sections 1 & 2
     - Roadmap / milestones → section 2
     - Current status / next steps → section 3
     - Rules for Codex / docs → section 4 & 9
   - Preserve important nuance (naming, constraints, edge cases).
3. Once merged:
   - Rewrite `source-of-truth.md` to be a **short stub**:

     > “This file has been replaced by `CODEx_RUNBOOK.md`.
     > Please see `CODEx_RUNBOOK.md` (canonical) for all current goals, plans, and next steps.”

4. Make sure **no information is lost**, only reorganized.

Humans should stop editing `source-of-truth.md` directly after this migration.

---

## 1. End Goals

### 1.1 End Goal 1 — Self-Iterating DevinSwarm with HITL

DevinSwarm is an AI agent swarm that can:

- Plan → implement → review → iterate on tasks inside a Git repo.
- Coordinate multiple agent roles (planner, implementer, reviewer, ops, etc.).
- Keep **human-in-the-loop (HITL)** at key checkpoints (e.g., design approval, risky changes, deployment).
- Produce production-ready changes (tests, diffs, docs) using standard Git flows.

**Definition of Done (End Goal 1):**

- [ ] Stable orchestrator that can run end-to-end on real tasks.
- [ ] Clear agent graph / topology documented and implemented.
- [ ] HITL approval gates designed and wired into the flow.
- [ ] At least one real task completed via multi-iteration + HITL, from intake to merged PR.

### 1.2 End Goal 2 — Multi-Language / Multi-Platform (First: Salesforce)

DevinSwarm must:

- Understand & deliver tasks targeting **multiple languages/platforms**.
- Provide **first-class Salesforce support** (Apex, LWC, metadata, Salesforce DX workflows). :contentReference[oaicite:0]{index=0}
- Make it easy to add new platforms (Node, Python, etc.) via a consistent abstraction.

**Definition of Done (End Goal 2):**

- [ ] Platform abstraction documented (capabilities, build/test/deploy).
- [ ] Salesforce path implemented and used in at least one real run.
- [ ] At least one additional non-Salesforce platform underway or partially implemented.

---

## 2. Roadmap & Milestones

Use these as the “spine” of all planning. Your existing roadmap from `source-of-truth.md` should be merged here.

### Milestone 1 — Documentation & Context System (No Drift)

**Goal:**
Eliminate doc/context/scope/plan/goal drift for both humans and Codex, using this runbook.

Checklist (Codex must keep updated):

- [ ] M1.1 — Migrate `source-of-truth.md` into `CODEx_RUNBOOK.md` (see section 0).
- [ ] M1.2 — Align `AGENTS.md` so Codex:
  - Always reads this runbook first.
  - Knows where ExecPlans live.
  - Knows how to update docs after any work.
- [ ] M1.3 — Create/maintain `docs/INDEX.md` with links to:
  - This runbook
  - ExecPlans
  - Key architecture/runtime docs
- [ ] M1.4 — Add & maintain “Next Steps for Codex” (section 3.2).
- [ ] M1.5 — Add `scripts/codex_doc_sync.sh` and (optionally) CI wiring.

### Milestone 2 — Core Swarm + HITL Loop (End Goal 1, Phase 1)

- [ ] M2.1 — Define agent types & responsibilities clearly (in the code + docs).
- [ ] M2.2 — Implement minimal orchestrator that can:
  - Accept intake tasks
  - Plan & delegate to worker agents
  - Gather results & summaries
- [ ] M2.3 — Add HITL checkpoints (e.g., branch/PR review, manual approvals).
- [ ] M2.4 — Demo scenario exercising multiple iterations and a human approval.

### Milestone 3 — Salesforce Path (End Goal 2, Phase 1)

- [ ] M3.1 — Document Salesforce-specific workflow & how DevinSwarm interacts with it.
- [ ] M3.2 — Implement Salesforce “platform module” (Apex, metadata, DX commands).
- [ ] M3.3 — Add tests / scripts to validate SF flows (validate → quick deploy).
- [ ] M3.4 — Run at least one end-to-end Salesforce change via DevinSwarm.

### Milestone 4 — Multi-Platform Extensibility

- [ ] M4.1 — Finalize a generic platform abstraction.
- [ ] M4.2 — Implement at least one non-Salesforce platform (e.g., Node backend).
- [ ] M4.3 — Document how to add a new platform in a step-by-step checklist.

(Add more milestones as your `source-of-truth.md` content dictates.)

---

## 3. Current Stage & Next Steps

Codex must treat this section as **live configuration**.

### 3.1 Current Stage

- `CURRENT_MILESTONE:` (e.g., `M1`, `M2`, `M3`, …)
- `STATUS_SUMMARY:`
  Short summary of where the project actually is (2–4 sentences).
- `BLOCKERS:`
  Brief list of anything that’s currently in the way.

### 3.2 Next Steps for Codex (Live Checklist)

This list is the “what Codex should do next by default”.

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

**Codex contract:**

- On every new run, Codex must:
  - Read this section.
  - Update it if the real next steps have changed.
  - Mark items done when completed, with a brief note in the commit message.

---

## 4. Documentation System (How to Avoid Drift)

Rules for all docs, scripts, and instructions:

1. This **runbook is canonical**.
2. `docs/INDEX.md` lists all important docs and ExecPlans.
3. Any doc that contains instructions or plans must:
   - Say at the top:
     “**Source of truth is `CODEx_RUNBOOK.md`.** If anything here conflicts, the runbook wins.”
4. No doc is allowed to quietly redefine:
   - End Goals
   - Scope
   - Roadmap / milestone names
5. When Codex makes non-trivial code changes:
   - Update this runbook **first** if any goal/stage/roadmap changed.
   - Then update any subordinate docs (ExecPlans, `AGENTS.md`, feature docs).

---

## 5. Repo Map (High-Level)

(Keep this short and accurate; Codex should update paths as the repo evolves.)

- `/apps` — Entry points (web/API, workers, UI).
- `/docs` — Human-facing docs; indexed in `docs/INDEX.md`.
- `/infra` — Infra & deployment.
- `/orchestrator` — Swarm orchestration logic.
- `/prompts` — Prompts & configs for agents.
- `/runtime` — Job queue, persistence, state.
- `/scripts` — Helper scripts (including Codex doc-sync).
- `/tools`, `/types`, etc. — Shared utilities and types.

---

## 6. Codex Startup Routine (No Human Calls Needed)

Whenever Codex is launched in this repo:

1. **Read `AGENTS.md`.**
2. **Read this `CODEx_RUNBOOK.md` completely**, then:
   - Extract End Goals.
   - Read `CURRENT_MILESTONE` and `Next Steps for Codex`.
3. **Open `docs/INDEX.md`** and any relevant ExecPlan(s) for the current milestone.
4. Formulate a **short plan**:
   - What you’ll do this session.
   - How you’ll verify it (tests, demos).
5. Only then touch code or run commands.

---

## 7. HITL & Self-Iteration (End Goal 1 Details)

Keep high-level here; deeper details can live in a dedicated HITL doc that this runbook links to.

Codex must:

- Respect HITL checkpoints:
  - When modification is risky or architectural, prefer creating a branch and PR.
- Implement self-iteration:
  - If tests fail or validation is weak, re-run planning steps instead of blindly retrying.
- Update this section when:
  - HITL points change.
  - The iteration policy changes.

---

## 8. Multi-Platform & Salesforce (End Goal 2 Details)

Summarize:

- What a “platform” means.
- How DevinSwarm detects/selects the right platform.
- Where platform-specific code/docs live (e.g., `/platforms/salesforce/`).

Codex must add details here as End Goal 2 progresses.

---

## 9. Ground Rules & Invariants

- Never invent new “project goals” outside of this runbook.
- Keep headings stable; add new details under existing sections when possible.
- Prefer incremental doc edits with clear Git history (no huge, noisy reformats).
- Docs, ExecPlans, and code must move **together** in the same PR.

