import { Octokit } from "@octokit/rest";

export function ghClient(pat?: string) {
  const token = pat || process.env.GH_PAT;
  if (!token) throw new Error("GH_PAT not set");
  return new Octokit({ auth: token });
}

export async function commentOnIssueOrPR(opts: { owner: string; repo: string; issueNumber: number; body: string; token?: string; }) {
  const gh = ghClient(opts.token);
  await gh.issues.createComment({ owner: opts.owner, repo: opts.repo, issue_number: opts.issueNumber, body: opts.body });
}
