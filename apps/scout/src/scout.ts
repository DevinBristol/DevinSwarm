import { makeWorker } from "../../../packages/shared/queue";
import { ghInstallClient } from "../../../packages/shared/github";

const gh = ghInstallClient();

// v0 scout: improvement suggestion issue
makeWorker(
  "scout",
  async () => {
    const [owner, repo] = (process.env.SCOUT_REPO ?? "DevinBristol/DevinSwarm").split("/");
    await gh.request("POST /repos/{owner}/{repo}/issues", {
      owner,
      repo,
      title: "Scout: framework improvement sweep",
      body: "Propose improvements to agent prompts, risk scoring, and CI integration based on recent runs.",
    });
  },
  1,
);

