import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { createHash } from "crypto";

export function ghInstallClient(): Octokit {
  const appId = process.env.GITHUB_APP_ID!;
  const installationId = process.env.GITHUB_INSTALLATION_ID!;
  const rawPrivateKey = process.env.GITHUB_PRIVATE_KEY!;

  const privateKey = rawPrivateKey.replace(/\r\n/g, "\n").replace(/\\n/g, "\n");

  const rawSha = createHash("sha256").update(rawPrivateKey).digest("hex");
  const normalizedSha = createHash("sha256").update(privateKey).digest("hex");

  // eslint-disable-next-line no-console
  console.log("GitHub App key debug", {
    RAW_LENGTH: rawPrivateKey.length,
    NORMALIZED_LENGTH: privateKey.length,
    RAW_HAS_LITERAL_BACKSLASH_N: rawPrivateKey.includes("\\n"),
    RAW_HAS_REAL_NEWLINES: rawPrivateKey.includes("\n"),
    NORMALIZED_HAS_REAL_NEWLINES: privateKey.includes("\n"),
    RAW_SHA256_PREFIX: rawSha.slice(0, 12),
    NORMALIZED_SHA256_PREFIX: normalizedSha.slice(0, 12),
  });

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId: Number(installationId) },
  });
}

export interface CommitStatusInput {
  owner: string;
  repo: string;
  sha: string;
  state: "error" | "failure" | "pending" | "success";
  context: string;
  description?: string;
  targetUrl?: string;
}

export async function setCommitStatus(
  client: Octokit | null,
  input: CommitStatusInput,
): Promise<void> {
  if (!client) return;
  await client.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
    owner: input.owner,
    repo: input.repo,
    sha: input.sha,
    state: input.state,
    context: input.context,
    description: input.description?.slice(0, 140),
    target_url: input.targetUrl,
  });
}

export async function createPrComment(
  client: Octokit | null,
  input: { owner: string; repo: string; pullNumber: number; body: string },
): Promise<void> {
  if (!client) return;
  await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: input.owner,
    repo: input.repo,
    issue_number: input.pullNumber,
    body: input.body,
  });
}
