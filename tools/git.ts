export interface GitCloneOptions {
  repoUrl: string;
  targetDir: string;
  defaultBranch: string;
}

export interface GitStatus {
  hasChanges: boolean;
}

export function describeGitCloneOptions(
  options: GitCloneOptions,
): string {
  return `Clone ${options.repoUrl} into ${options.targetDir} on ${options.defaultBranch}`;
}

