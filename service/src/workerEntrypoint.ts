import { cfg } from "./config.js";
import { runManager } from "./orchestrator/manager.js";
import { commentOnIssueOrPR } from "./github.js";

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
