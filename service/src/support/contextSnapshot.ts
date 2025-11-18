import { Octokit } from "@octokit/rest";
import { Buffer } from "node:buffer";

const gh = new Octokit({ auth: process.env.GH_PAT || process.env.GITHUB_TOKEN });

export async function getContextSnapshot(repo: string) {
  const [owner, name] = repo.split("/");
  const path = ".swarm/state.json";
  const { data } = await gh.repos.getContent({ owner, repo: name, path });
  if (!("content" in data)) throw new Error("state.json is not a file");
  const decoded = Buffer.from((data as any).content, "base64").toString("utf8");
  return JSON.parse(decoded);
}

export async function writeContextSnapshot(repo: string, json: any, branch = "main") {
  const [owner, name] = repo.split("/");
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

