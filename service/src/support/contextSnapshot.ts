import { Octokit } from "@octokit/rest";
import { Buffer } from "node:buffer";
import { cfg } from "../config.js";

const gh = new Octokit({ auth: process.env.GH_PAT || process.env.GITHUB_TOKEN });

// Resolve a repo string to owner/name, falling back to cfg.defaultRepo and enforcing <owner>/<repo> format.
function resolveRepo(inputRepo?: string): { owner: string; name: string } {
  const repo = (inputRepo && inputRepo.trim()) || cfg.defaultRepo;
  if (!repo || !repo.includes("/")) {
    throw new Error(`Invalid repo: "${repo}". Expected <owner>/<repo>.`);
  }
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid repo segments: "${repo}". Expected <owner>/<repo>.`);
  }
  return { owner, name };
}

const defaultState = {
  mission: "Host multiple agents under a Manager; parallel; escalate when stuck; budget soft cap $1,500/mo.",
  budget: { softMonthlyUsd: 1500 },
  repos: { default: cfg.defaultRepo, allowList: [cfg.defaultRepo] },
  workers: ["dev", "test", "research", "ops", "doc"],
  goals: [] as any[],
  lastRuns: [] as any[]
};

export async function getContextSnapshot(repo?: string) {
  const { owner, name } = resolveRepo(repo);
  const path = ".swarm/state.json";
  try {
    const { data } = await gh.repos.getContent({ owner, repo: name, path });
    if (!("content" in data)) throw new Error("state.json is not a file");
    const decoded = Buffer.from((data as any).content, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (e: any) {
    if (e?.status === 404) {
      return { ...defaultState };
    }
    throw e;
  }
}

export async function writeContextSnapshot(repo: string | undefined, json: any, branch = "main") {
  const { owner, name } = resolveRepo(repo);
  const path = ".swarm/state.json";
  let sha: string | undefined;
  try {
    const existing = await gh.repos.getContent({ owner, repo: name, path, ref: branch });
    if ("sha" in existing.data) sha = (existing.data as any).sha;
  } catch {
    // New file; leave sha undefined
  }
  await gh.repos.createOrUpdateFileContents({
    owner,
    repo: name,
    path,
    branch,
    message: "chore(swarm): update context snapshot",
    content: Buffer.from(JSON.stringify(json, null, 2)).toString("base64"),
    sha
  });
}
