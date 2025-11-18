import { cfg } from "./config.js";
import { runManager } from "./orchestrator/manager.js";
import { commentOnIssueOrPR } from "./github.js";
import { getContextSnapshot, writeContextSnapshot } from "./support/contextSnapshot.js";

export async function handleTask(input: { type: string; repo?: string; issueNumber?: number; payload: any; }) {
  const context = JSON.stringify(input.payload, null, 2);
  const { plan, results } = await runManager(context);
  const md = renderReport(plan, results);

  // Comment back to GitHub if we can
  try {
    const [owner, repo] = (input.repo || "").split("/");
    if (owner && repo && input.issueNumber) {
      await commentOnIssueOrPR({ owner, repo, issueNumber: input.issueNumber, body: md, token: process.env.GH_PAT || undefined });
    }
  } catch (e) {
    console.error("Failed to comment on GitHub:", e);
  }

  // Update public context snapshot (best-effort)
  try {
    const repo = (input.repo && input.repo.trim()) || cfg.defaultRepo;
    if (repo && repo.includes("/")) {
      const current = await safeGetState(repo);
      const updated = appendRunToState(current, {
        taskType: input.type,
        at: new Date().toISOString()
      });
      await writeContextSnapshot(repo, updated);
    }
  } catch (e) {
    console.error("snapshot update failed", e);
  }

  return { plan, results };
}

function renderReport(plan: any, results: Array<{id: string, who: string, out: string}>) {
  const lines = [
    "### Manager Plan",
    "```json",
    JSON.stringify(plan, null, 2),
    "```",
    "### Worker Results"
  ];
  for (const r of results) {
    lines.push(`#### ${r.who} (${r.id})`, r.out || "_no output_");
  }
  lines.push("\n> _Automated manager report._");
  return lines.join("\n");
}

function safeGetState(repo: string): Promise<any> {
  return getContextSnapshot(repo).catch(() => ({
    mission: "Host multiple agents under a Manager; parallel work; escalate when blocked; maximize autonomy within budget.",
    budget: { softMonthlyUsd: 1500, dailyCapUsd: 75 },
    guardrails: {
      maxToolCallsPerRun: 20,
      escalateIf: ["blocked>10min", ">=3 tool failures", "policy conflict"]
    },
    repos: { default: "DevinBristol/DevinSwarm", allowList: ["DevinBristol/DevinSwarm"] },
    workers: ["dev", "test", "research", "ops", "doc"],
    goals: [
      {
        id: "G-001",
        title: "Hosted parallel Manager/Workers with /context",
        priority: 1
      },
      {
        id: "G-002",
        title: "Autobranch & draft PR on /fix",
        priority: 2
      }
    ],
    lastRuns: []
  }));
}

function appendRunToState(state: any, run: any) {
  const next = { ...state };
  const list = Array.isArray(next.lastRuns) ? next.lastRuns.slice() : [];
  list.push(run);
  next.lastRuns = list.slice(-20);
  next.updatedAt = new Date().toISOString();
  return next;
}
