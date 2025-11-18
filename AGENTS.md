DEVINSWARM – AGENT INSTRUCTIONS FOR CODEX
=========================================

Purpose: When Codex is launched in this repo, always bootstrap yourself with the **live context** stored in GitHub, not just whatever happens to be on disk locally.

Golden rule for this repo:
- Treat `.swarm/state.json` on **GitHub** as the source of truth for mission/guardrails/goals/lastRuns.
- Prefer the hosted Agent Service `/context` endpoint when it is available and healthy.

ON SESSION START (FIRST TURN ONLY)
----------------------------------
When you (the AI agent) start a new Codex session in this repo, do the following before making plans or edits:

1. Load local summary (fast, no network)
   - Read `.swarm/summary.md` if it exists.
   - Use it to very quickly understand mission, workers, guardrails, and recent runs.

2. Fetch live context from GitHub (authoritative)
   - If you have network access and a GitHub token available in the environment (for example `GITHUB_TOKEN` or `GH_PAT`), fetch **remote** `.swarm/state.json` for `DevinBristol/DevinSwarm`:
     - Prefer the raw URL:
       - `https://raw.githubusercontent.com/DevinBristol/DevinSwarm/main/.swarm/state.json`
     - If raw access is not available, fall back to the GitHub REST API:
       - `GET https://api.github.com/repos/DevinBristol/DevinSwarm/contents/.swarm/state.json`
     - Parse the JSON and treat it as the canonical context snapshot.
   - If network access is blocked or the fetch fails, fall back to the **local** `.swarm/state.json` in this checkout (if present).

3. Optionally cross‑check with the hosted `/context` endpoint
   - If you know the Agent Service base URL from env (for example `AGENT_SERVICE_URL`) and network access is allowed:
     - Call `GET $AGENT_SERVICE_URL/context?repo=DevinBristol/DevinSwarm`.
     - Prefer this response over raw `.swarm/state.json` if it succeeds, since the service may add additional derived fields.
   - Do not fail the session if `/context` is unavailable; just log/mention the issue and fall back to the GitHub snapshot.

HOW TO USE THE CONTEXT
----------------------
- Always keep the latest snapshot (from GitHub or `/context`) in mind when:
  - Interpreting user requests.
  - Proposing changes to workflows, the Agent Service, or the mission/goals.
  - Deciding whether a change fits within guardrails/budget.
- When drafting high‑level plans, refer to goals and guardrails from the snapshot instead of inventing new ones.

SCOPE
-----
- These instructions apply to all work in this repository.
- Do not modify this file unless the owner explicitly asks you to update the Codex bootstrap behavior.

