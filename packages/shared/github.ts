import { Octokit } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";

export function ghInstallClient(): Octokit {
  const appId = process.env.GITHUB_APP_ID!;
  const installationId = process.env.GITHUB_INSTALLATION_ID!;
  const rawPrivateKey = process.env.GITHUB_PRIVATE_KEY!;

  const privateKey = rawPrivateKey.replace(/\r\n/g, "\n").replace(/\\n/g, "\n");

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId: Number(installationId) },
  });
}

