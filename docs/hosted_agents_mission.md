# Mission: Hosted, Always‑On Manager/Workers

**Goal:** Operate multiple domain workers in parallel under a single **Manager** that reports to the Owner; escalate only when stuck; maximize autonomy while respecting budget and review gates.

**Golden rule (from owner):** *Host multiple agents simultaneously that report to a manager all in parallel.* Budget **$1,500/mo** (flexible). Target **“a month of work in a day.”*

**Scope:** Not limited to Salesforce—Salesforce is one of many domains. Use GitHub (Issues/PRs/checks) as the shared control surface.

## Operating Principles
- **Manager** decomposes goals → plans → assigns to workers → aggregates → reports up.
- **Workers** are narrow (dev, test, research/RAG, ops, doc). They act in parallel.
- **Autonomy:** Act automatically on new tasks (intake, CI failures). Ask for approval only for high‑risk writes.
- **Human review gates:** All production writes require tests + policy checks + explicit approval.
- **Escalation:** If blocked N minutes or after K failed tool calls, escalate with a concise status and options.
- **Budget guardrails:** Per‑run token caps and a daily/weekly spend ceiling; hard‑stop with a summary when exceeded.
- **Observability:** Trace every tool call and decision; log tokens, diffs, approvals, spend, and wall‑clock.

## Day‑1 KPIs
- Mean time to plan (CI failure → plan): **< 5 min**
- Mean time to validated PR for simple fixes: **< 60 min**
- False‑positive escalations: **< 10%**
- Budget adherence: **100%** (no overruns)
