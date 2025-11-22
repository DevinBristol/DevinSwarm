> **Archive:** Source of truth is `CODEx_RUNBOOK.md` - this file is retained for historical reference.

# ExecPlan: DevinSwarm Doc & Context System

> Goal: migrate `source-of-truth.md` into `CODEx_RUNBOOK.md`,
> wire Codex behavior, and ensure docs never drift out of sync.

## Progress

- [ ] P1 — Read and summarize `source-of-truth.md` inside this plan.
- [ ] P2 — Create/normalize `CODEx_RUNBOOK.md` using that summary.
- [ ] P3 — Stub out `source-of-truth.md` to point at the runbook.
- [ ] P4 — Align `AGENTS.md` with runbook rules.
- [ ] P5 — Create/maintain `docs/INDEX.md`.
- [ ] P6 — Add `scripts/codex_doc_sync.sh` and run it once successfully.

Codex must keep these checkboxes accurate.

## Step Group 1 — Absorb `source-of-truth.md`

1. Find `source-of-truth.md` in the repo.
2. Summarize in this plan:
   - Stated goals.
   - Existing roadmap, milestones, or phases.
   - Current status & next steps.
   - Any rules/invariants already defined.
3. Compare with the structure in `CODEx_RUNBOOK.md`; note anything that doesn’t map cleanly.

## Step Group 2 — Create / Update `CODEx_RUNBOOK.md`

4. If `CODEx_RUNBOOK.md` doesn’t exist, create it using the template pattern from this ExecPlan:
   - End Goals 1 & 2.
   - Roadmap & Milestones.
   - Current Stage + Next Steps for Codex.
   - Documentation rules & repo map.
5. Merge content from `source-of-truth.md` into the appropriate sections:
   - No information loss; if unsure where something belongs, temporarily keep it under a “To sort” subsection.

## Step Group 3 — Stub `source-of-truth.md`

6. Replace `source-of-truth.md` with a short stub:
   - Explain it has been superseded by `CODEx_RUNBOOK.md`.
   - Link to the runbook and `docs/INDEX.md`.

## Step Group 4 — Wire Codex Behavior & Index

7. Update `AGENTS.md`:
   - Add a section describing:
     - CODEx_RUNBOOK usage.
     - Auto-start routine.
     - Doc drift rules.
8. Create/refresh `docs/INDEX.md`:
   - List:
     - `CODEx_RUNBOOK.md` (source of truth)
     - `AGENTS.md`
     - This ExecPlan & any other plans
     - Key architecture and runtime docs.

## Step Group 5 — Automation

9. Create `scripts/codex_doc_sync.sh` (see script in repo for details):
   - Uses `codex exec --full-auto --search`.
   - Tells Codex to:
     - Ensure runbook, AGENTS, INDEX, and this ExecPlan are aligned.
     - Update “Next Steps for Codex”.

10. Run `scripts/codex_doc_sync.sh` from a feature branch:
    - Inspect changes.
    - Update this ExecPlan’s `Progress` to note completion.

## Acceptance Criteria

This ExecPlan is considered done when:

- Humans can:
  - Open `CODEx_RUNBOOK.md` and immediately see goals, roadmap, current stage, and next steps.
- Codex, when run in repo root with no extra guidance, naturally:
  - Reads `AGENTS.md` and `CODEx_RUNBOOK.md`.
  - Proposes work consistent with the runbook.
- Running `scripts/codex_doc_sync.sh` only produces targeted doc updates, not chaotic rewrites.
