import { Octokit } from "@octokit/rest";

export interface GitHubAppConfig {
  appId: string;
  installationId: string;
  privateKey: string;
  webhookSecret: string;
}

export function createOctokitClient(
  authToken: string,
): Octokit {
  return new Octokit({ auth: authToken });
}
