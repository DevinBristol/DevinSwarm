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
